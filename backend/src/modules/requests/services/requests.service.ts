import { governanceTransaction } from "../../../utils/governance-transaction";
import {
  DocumentCategory,
  ExpenseRecordState,
  FinancialOperation,
  Prisma,
  RequestState,
  RoleCode,
} from "@prisma/client";
import { financialInputHash, financialRequestKey, financialTransaction, findFinancialReplay, recordFinancialResult } from "../../../utils/financial-idempotency";

import { documentDirectories, uploadRules } from "../../../config/uploads";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import {
  assertAnyEventScopedAccess,
  assertEventScopedOperationalAccess,
  assertSystemAdminOrEventRole,
  hasEventScopedRole,
  scopeEventFilters,
} from "../../../utils/event-scope";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { sanitizeNullableText } from "../../../utils/text-utils";
import { cleanupStoredUploads, storeValidatedUploads } from "../../../utils/upload-utils";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { eventsRepository } from "../../events/repositories/events.repository";
import { reconciliationRepository } from "../../reconciliation/repositories/reconciliation.repository";
import {
  mapBudgetRequest,
  mapExpenseRecord,
  mapExpenseRequest,
} from "../requests.mappers";
import { requestsRepository } from "../repositories/requests.repository";
import type {
  CreateBudgetRequestInput,
  CreateExpenseRecordInput,
  CreateExpenseRequestInput,
  ExpenseRecordFilters,
  RequestFilters,
  SettleExpenseRecordInput,
  UpdateBudgetRequestInput,
  UpdateExpenseRequestInput,
  VoidExpenseRecordInput,
} from "../types/requests.types";

const requestSubmissionEventRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.EVENT_MANAGEMENT_USER,
] as RoleCode[];

const financeReadEventRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.FINANCIAL_CONTROLLER,
  RoleCode.ORGANIZATIONAL_APPROVER,
  RoleCode.EVENT_MANAGEMENT_USER,
] as RoleCode[];

const expenseRecordEventRoles = [RoleCode.FINANCIAL_CONTROLLER] as RoleCode[];


function assertHasAnyRequestSubmissionAssignment(viewer: AuthenticatedUser) {
  assertAnyEventScopedAccess(
    viewer,
    requestSubmissionEventRoles,
    "You are not assigned to any event with request submission access.",
  );
}

function assertRequestSubmissionPermissions(viewer: AuthenticatedUser, eventId: string) {
  assertEventScopedOperationalAccess(
    viewer,
    eventId,
    requestSubmissionEventRoles,
    "Only the Event Admin or Event Manager assigned to this event can submit finance requests.",
  );
}

function assertExpenseRecordManagementPermissions(viewer: AuthenticatedUser, eventId: string) {
  assertEventScopedOperationalAccess(
    viewer,
    eventId,
    expenseRecordEventRoles,
    "Only the Finance Controller assigned to this event can manage expense records.",
  );
}

function assertHasAnyFinanceReadAssignment(viewer: AuthenticatedUser) {
  assertAnyEventScopedAccess(
    viewer,
    financeReadEventRoles,
    "You are not assigned to any event with finance read access.",
  );
}

function assertInternalFinanceReadPermissions(viewer: AuthenticatedUser, eventId: string) {
  assertSystemAdminOrEventRole(
    viewer,
    eventId,
    financeReadEventRoles,
    "You are not assigned to this event with finance read access.",
  );
}

function assertRequestAccess(
  viewer: AuthenticatedUser,
  eventId: string,
  requestedById: string | null | undefined,
) {
  if (
    requestedById === viewer.id &&
    hasEventScopedRole(viewer, eventId, requestSubmissionEventRoles)
  ) {
    return;
  }

  assertInternalFinanceReadPermissions(viewer, eventId);
}

function assertRequestOwnership(
  viewer: AuthenticatedUser,
  eventId: string,
  requestedById: string | null | undefined,
) {
  if (requestedById !== viewer.id) {
    throw new AppError(403, "You are not allowed to modify this request.");
  }

  assertRequestSubmissionPermissions(viewer, eventId);
}

function assertEditableRequestState(state: RequestState) {
  if (state !== RequestState.DRAFT && state !== RequestState.RETURNED) {
    throw new AppError(409, "Only draft or returned requests can be changed.");
  }
}

function assertUpdatePayloadOrFile(
  input: Record<string, unknown>,
  file: Express.Multer.File | undefined,
  entityLabel: string,
) {
  if (Object.keys(input).length === 0 && !file) {
    throw new AppError(400, `Provide at least one ${entityLabel} field or a supporting document.`);
  }
}

function getRequestSubmissionState(submit: boolean | undefined) {
  return submit === false ? RequestState.DRAFT : RequestState.SUBMITTED;
}

export async function assertRequestUploadAccess(
  actor: AuthenticatedUser,
  target: { kind: "budget" | "expense"; requestId: string } | { kind: "create" | "record"; eventId: string },
) {
  if ("requestId" in target) {
    const request = target.kind === "budget"
      ? await requestsRepository.findBudgetRequestById(target.requestId)
      : await requestsRepository.findExpenseRequestById(target.requestId);
    if (!request) throw new AppError(404, "Request not found.");
    assertRequestOwnership(actor, request.eventId, request.requestedById);
    assertEditableRequestState(request.state);
  } else {
    const event = await eventsRepository.findById(target.eventId);
    if (!event) throw new AppError(404, "Event not found.");
    if (target.kind === "record") assertExpenseRecordManagementPermissions(actor, event.id);
    else assertRequestSubmissionPermissions(actor, event.id);
  }
}

export const requestsService = {
  async listMyBudgetRequests(actor: AuthenticatedUser, filters: RequestFilters) {
    assertHasAnyRequestSubmissionAssignment(actor);

    const scopedFilters = scopeEventFilters(actor, filters, requestSubmissionEventRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [requests, totalItems] = await Promise.all([
      requestsRepository.listBudgetRequestsByRequester(actor.id, scopedFilters, paginationOptions),
      requestsRepository.countBudgetRequestsByRequester(actor.id, scopedFilters),
    ]);

    return {
      budgetRequests: requests.map(mapBudgetRequest),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async listBudgetRequests(viewer: AuthenticatedUser, filters: RequestFilters) {
    assertHasAnyFinanceReadAssignment(viewer);

    const scopedFilters = scopeEventFilters(viewer, filters, financeReadEventRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [requests, totalItems] = await Promise.all([
      requestsRepository.listBudgetRequests(scopedFilters, paginationOptions),
      requestsRepository.countBudgetRequests(scopedFilters),
    ]);

    return {
      budgetRequests: requests.map(mapBudgetRequest),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getBudgetRequestById(viewer: AuthenticatedUser, budgetRequestId: string) {
    const request = await requestsRepository.findBudgetRequestById(budgetRequestId);

    if (!request) {
      throw new AppError(404, "Budget request not found.");
    }

    assertRequestAccess(viewer, request.eventId, request.requestedById);
    return mapBudgetRequest(request);
  },

  async createBudgetRequest(
    actor: AuthenticatedUser,
    input: CreateBudgetRequestInput,
    files: Express.Multer.File[] | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    await assertRequestUploadAccess(actor, { kind: "create", eventId: input.eventId });
    const storedUploads = await storeValidatedUploads(files, { category: DocumentCategory.SUPPORTING_DOCUMENT, destinationDir: documentDirectories.SUPPORTING_DOCUMENT, rule: uploadRules.SUPPORTING_DOCUMENT });
    try {
      return await governanceTransaction(async (tx) => {
        const event = await eventsRepository.findById(input.eventId, tx);
        if (!event) {
          throw new AppError(404, "Event not found.");
        }
        assertRequestSubmissionPermissions(actor, event.id);
        const request = await (async () => {
          const createdRequest = await requestsRepository.createBudgetRequest(actor.id, {
            ...input,
            justification: sanitizeNullableText(input.justification),
          }, getRequestSubmissionState(input.submit), tx);
          if (storedUploads && storedUploads.length > 0) {
            await Promise.all(storedUploads.map((upload) => requestsRepository.createSupportingDocument({
              category: upload.category,
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              storedName: upload.storedName,
              relativePath: upload.relativePath,
              sizeBytes: BigInt(upload.sizeBytes),
              uploadedById: actor.id,
              budgetRequestId: createdRequest.id,
            }, tx)));
          }
          const reloadedRequest = await requestsRepository.findBudgetRequestById(createdRequest.id, tx);
          if (!reloadedRequest) {
            throw new AppError(500, "Failed to reload the created budget request.");
          }
          return reloadedRequest;
        })();
        await auditService.record({
          actorId: actor.id,
          action: "budget_requests.create",
          entityType: "BudgetRequest",
          entityId: request.id,
          summary: `Created budget request for ${request.event.title}`,
          context: {
            eventId: request.event.id,
            state: request.state,
            amount: request.amount,
          },
          ...auditMetadata,
        }, tx);
        return mapBudgetRequest(request);
      }, actor);
    }
    catch (error) {
      if (storedUploads && storedUploads.length > 0) {
        await cleanupStoredUploads(storedUploads.map((u) => ({ relativePath: u.relativePath })));
      }
      throw error;
    }
  },

  async updateBudgetRequest(
    actor: AuthenticatedUser,
    budgetRequestId: string,
    input: UpdateBudgetRequestInput,
    files: Express.Multer.File[] | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    await assertRequestUploadAccess(actor, { kind: "budget", requestId: budgetRequestId });
    const storedUploads = await storeValidatedUploads(files, { category: DocumentCategory.SUPPORTING_DOCUMENT, destinationDir: documentDirectories.SUPPORTING_DOCUMENT, rule: uploadRules.SUPPORTING_DOCUMENT });
    try {
      return await governanceTransaction(async (tx) => {
        const existingRequest = await requestsRepository.findBudgetRequestById(budgetRequestId, tx);
        if (!existingRequest) {
          throw new AppError(404, "Budget request not found.");
        }
        assertRequestOwnership(actor, existingRequest.eventId, existingRequest.requestedById);
        assertEditableRequestState(existingRequest.state);
        assertUpdatePayloadOrFile(input, files && files.length > 0 ? files[0] : undefined, "budget request");
        const request = await (async () => {
          await requestsRepository.updateBudgetRequest(budgetRequestId, {
            ...input,
            justification: sanitizeNullableText(input.justification),
          }, tx);
          if (storedUploads && storedUploads.length > 0) {
            await Promise.all(storedUploads.map((upload) => requestsRepository.createSupportingDocument({
              category: upload.category,
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              storedName: upload.storedName,
              relativePath: upload.relativePath,
              sizeBytes: BigInt(upload.sizeBytes),
              uploadedById: actor.id,
              budgetRequestId,
            }, tx)));
          }
          const reloadedRequest = await requestsRepository.findBudgetRequestById(budgetRequestId, tx);
          if (!reloadedRequest) {
            throw new AppError(500, "Failed to reload the updated budget request.");
          }
          return reloadedRequest;
        })();
        await auditService.record({
          actorId: actor.id,
          action: "budget_requests.update",
          entityType: "BudgetRequest",
          entityId: request.id,
          summary: `Updated budget request for ${request.event.title}`,
          context: {
            eventId: request.event.id,
            state: request.state,
            updatedFields: Object.keys(input),
          },
          ...auditMetadata,
        }, tx);
        return mapBudgetRequest(request);
      }, actor);
    }
    catch (error) {
      if (storedUploads && storedUploads.length > 0) {
        await cleanupStoredUploads(storedUploads.map((u) => ({ relativePath: u.relativePath })));
      }
      throw error;
    }
  },

  async submitBudgetRequest(
    actor: AuthenticatedUser,
    budgetRequestId: string,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      const existingRequest = await requestsRepository.findBudgetRequestById(budgetRequestId, tx);
      if (!existingRequest) {
        throw new AppError(404, "Budget request not found.");
      }
      assertRequestOwnership(actor, existingRequest.eventId, existingRequest.requestedById);
      assertEditableRequestState(existingRequest.state);
      const request = await requestsRepository.updateBudgetRequestState(budgetRequestId, RequestState.SUBMITTED, tx);
      await auditService.record({
        actorId: actor.id,
        action: "budget_requests.submit",
        entityType: "BudgetRequest",
        entityId: request.id,
        summary: `Submitted budget request for ${request.event.title}`,
        context: {
          eventId: request.event.id,
          previousState: existingRequest.state,
          nextState: request.state,
        },
        ...auditMetadata,
      }, tx);
      return mapBudgetRequest(request);
    }, actor);
  },

  async listMyExpenseRequests(actor: AuthenticatedUser, filters: RequestFilters) {
    assertHasAnyRequestSubmissionAssignment(actor);

    const scopedFilters = scopeEventFilters(actor, filters, requestSubmissionEventRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [requests, totalItems] = await Promise.all([
      requestsRepository.listExpenseRequestsByRequester(actor.id, scopedFilters, paginationOptions),
      requestsRepository.countExpenseRequestsByRequester(actor.id, scopedFilters),
    ]);

    return {
      expenseRequests: requests.map(mapExpenseRequest),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async listExpenseRequests(viewer: AuthenticatedUser, filters: RequestFilters) {
    assertHasAnyFinanceReadAssignment(viewer);

    const scopedFilters = scopeEventFilters(viewer, filters, financeReadEventRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [requests, totalItems] = await Promise.all([
      requestsRepository.listExpenseRequests(scopedFilters, paginationOptions),
      requestsRepository.countExpenseRequests(scopedFilters),
    ]);

    return {
      expenseRequests: requests.map(mapExpenseRequest),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getExpenseRequestById(viewer: AuthenticatedUser, expenseRequestId: string) {
    const request = await requestsRepository.findExpenseRequestById(expenseRequestId);

    if (!request) {
      throw new AppError(404, "Expense request not found.");
    }

    assertRequestAccess(viewer, request.eventId, request.requestedById);
    return mapExpenseRequest(request);
  },

  async createExpenseRequest(
    actor: AuthenticatedUser,
    input: CreateExpenseRequestInput,
    files: Express.Multer.File[] | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    await assertRequestUploadAccess(actor, { kind: "create", eventId: input.eventId });
    const storedUploads = await storeValidatedUploads(files, { category: DocumentCategory.SUPPORTING_DOCUMENT, destinationDir: documentDirectories.SUPPORTING_DOCUMENT, rule: uploadRules.SUPPORTING_DOCUMENT });
    try {
      return await governanceTransaction(async (tx) => {
        if (!files || files.length === 0) {
          throw new AppError(400, "Expense requests require at least one supporting document.");
        }
        const event = await eventsRepository.findById(input.eventId, tx);
        if (!event) {
          throw new AppError(404, "Event not found.");
        }
        assertRequestSubmissionPermissions(actor, event.id);
        const request = await (async () => {
          const createdRequest = await requestsRepository.createExpenseRequest(actor.id, {
            ...input,
            justification: sanitizeNullableText(input.justification),
          }, getRequestSubmissionState(input.submit), tx);
          await Promise.all(storedUploads.map((upload) => requestsRepository.createSupportingDocument({
            category: upload.category,
            originalName: upload.originalName,
            mimeType: upload.mimeType,
            storedName: upload.storedName,
            relativePath: upload.relativePath,
            sizeBytes: BigInt(upload.sizeBytes),
            uploadedById: actor.id,
            expenseRequestId: createdRequest.id,
          }, tx)));
          const reloadedRequest = await requestsRepository.findExpenseRequestById(createdRequest.id, tx);
          if (!reloadedRequest) {
            throw new AppError(500, "Failed to reload the created expense request.");
          }
          return reloadedRequest;
        })();
        await auditService.record({
          actorId: actor.id,
          action: "expense_requests.create",
          entityType: "ExpenseRequest",
          entityId: request.id,
          summary: `Created expense request for ${request.event.title}`,
          context: {
            eventId: request.event.id,
            state: request.state,
            amount: request.amount,
            category: request.category,
          },
          ...auditMetadata,
        }, tx);
        return mapExpenseRequest(request);
      }, actor);
    }
    catch (error) {
      if (storedUploads && storedUploads.length > 0) {
        await cleanupStoredUploads(storedUploads.map((u) => ({ relativePath: u.relativePath })));
      }
      throw error;
    }
  },

  async updateExpenseRequest(
    actor: AuthenticatedUser,
    expenseRequestId: string,
    input: UpdateExpenseRequestInput,
    files: Express.Multer.File[] | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    await assertRequestUploadAccess(actor, { kind: "expense", requestId: expenseRequestId });
    const storedUploads = await storeValidatedUploads(files, { category: DocumentCategory.SUPPORTING_DOCUMENT, destinationDir: documentDirectories.SUPPORTING_DOCUMENT, rule: uploadRules.SUPPORTING_DOCUMENT });
    try {
      return await governanceTransaction(async (tx) => {
        const existingRequest = await requestsRepository.findExpenseRequestById(expenseRequestId, tx);
        if (!existingRequest) {
          throw new AppError(404, "Expense request not found.");
        }
        assertRequestOwnership(actor, existingRequest.eventId, existingRequest.requestedById);
        assertEditableRequestState(existingRequest.state);
        assertUpdatePayloadOrFile(input, files && files.length > 0 ? files[0] : undefined, "expense request");
        if ((!files || files.length === 0) && existingRequest.documents.length === 0) {
          throw new AppError(400, "Expense requests require at least one supporting document.");
        }
        const request = await (async () => {
          await requestsRepository.updateExpenseRequest(expenseRequestId, {
            ...input,
            justification: sanitizeNullableText(input.justification),
          }, tx);
          if (storedUploads && storedUploads.length > 0) {
            await Promise.all(storedUploads.map((upload) => requestsRepository.createSupportingDocument({
              category: upload.category,
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              storedName: upload.storedName,
              relativePath: upload.relativePath,
              sizeBytes: BigInt(upload.sizeBytes),
              uploadedById: actor.id,
              expenseRequestId,
            }, tx)));
          }
          const reloadedRequest = await requestsRepository.findExpenseRequestById(expenseRequestId, tx);
          if (!reloadedRequest) {
            throw new AppError(500, "Failed to reload the updated expense request.");
          }
          return reloadedRequest;
        })();
        await auditService.record({
          actorId: actor.id,
          action: "expense_requests.update",
          entityType: "ExpenseRequest",
          entityId: request.id,
          summary: `Updated expense request for ${request.event.title}`,
          context: {
            eventId: request.event.id,
            state: request.state,
            updatedFields: Object.keys(input),
          },
          ...auditMetadata,
        }, tx);
        return mapExpenseRequest(request);
      }, actor);
    }
    catch (error) {
      if (storedUploads && storedUploads.length > 0) {
        await cleanupStoredUploads(storedUploads.map((u) => ({ relativePath: u.relativePath })));
      }
      throw error;
    }
  },

  async submitExpenseRequest(
    actor: AuthenticatedUser,
    expenseRequestId: string,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      const existingRequest = await requestsRepository.findExpenseRequestById(expenseRequestId, tx);
      if (!existingRequest) {
        throw new AppError(404, "Expense request not found.");
      }
      assertRequestOwnership(actor, existingRequest.eventId, existingRequest.requestedById);
      assertEditableRequestState(existingRequest.state);
      if (existingRequest.documents.length === 0) {
        throw new AppError(400, "Expense requests require at least one supporting document.");
      }
      const request = await requestsRepository.updateExpenseRequestState(expenseRequestId, RequestState.SUBMITTED, tx);
      await auditService.record({
        actorId: actor.id,
        action: "expense_requests.submit",
        entityType: "ExpenseRequest",
        entityId: request.id,
        summary: `Submitted expense request for ${request.event.title}`,
        context: {
          eventId: request.event.id,
          previousState: existingRequest.state,
          nextState: request.state,
        },
        ...auditMetadata,
      }, tx);
      return mapExpenseRequest(request);
    }, actor);
  },

  async listExpenseRecords(viewer: AuthenticatedUser, filters: ExpenseRecordFilters) {
    assertHasAnyFinanceReadAssignment(viewer);

    const scopedFilters = scopeEventFilters(viewer, filters, financeReadEventRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [records, totalItems] = await Promise.all([
      requestsRepository.listExpenseRecords(scopedFilters, paginationOptions),
      requestsRepository.countExpenseRecords(scopedFilters),
    ]);

    return {
      expenseRecords: records.map(mapExpenseRecord),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getExpenseRecordById(viewer: AuthenticatedUser, expenseRecordId: string) {
    const record = await requestsRepository.findExpenseRecordById(expenseRecordId);

    if (!record) {
      throw new AppError(404, "Expense record not found.");
    }

    assertInternalFinanceReadPermissions(viewer, record.eventId);

    return mapExpenseRecord(record);
  },

  async createExpenseRecord(
    actor: AuthenticatedUser,
    input: CreateExpenseRecordInput,
    files: Express.Multer.File[] | undefined,
    requestKey: string,
    auditMetadata?: AuditMetadata,
  ) {
    await assertRequestUploadAccess(actor, { kind: "record", eventId: input.eventId });
    const submission = { actorId: actor.id, eventId: input.eventId, operation: FinancialOperation.EXPENSE_CREATE,
      key: financialRequestKey(requestKey), inputHash: financialInputHash([
        input.eventId, input.expenseRequestId ?? null, new Prisma.Decimal(input.amount).toFixed(2),
        input.category, input.description, input.paidAt?.toISOString() ?? null,
      ], files) };
    const storedUploads = await storeValidatedUploads(files, { category: DocumentCategory.SUPPORTING_DOCUMENT, destinationDir: documentDirectories.SUPPORTING_DOCUMENT, rule: uploadRules.SUPPORTING_DOCUMENT });
    try {
      const result = await financialTransaction(actor, async (tx) => {
        const event = await eventsRepository.findById(input.eventId, tx);
        if (!event) {
          throw new AppError(404, "Event not found.");
        }
        assertExpenseRecordManagementPermissions(actor, event.id);
        const replayId = await findFinancialReplay(tx, submission);
        if (replayId) {
          const original = await requestsRepository.findExpenseRecordById(replayId, tx);
          if (!original || original.eventId !== event.id) throw new AppError(500, "Financial submission result is unavailable.");
          return { record: mapExpenseRecord(original), created: false };
        }
        let linkedExpenseRequest: Awaited<ReturnType<typeof requestsRepository.findExpenseRequestById>> | null | undefined = undefined;
        if (input.expenseRequestId) {
          linkedExpenseRequest = await requestsRepository.findExpenseRequestById(input.expenseRequestId, tx);
          if (!linkedExpenseRequest) {
            throw new AppError(404, "Linked expense request not found.");
          }
          if (linkedExpenseRequest.eventId !== input.eventId) {
            throw new AppError(400, "Expense records must stay linked to the same event as the request.");
          }
          if (linkedExpenseRequest.state !== RequestState.APPROVED) {
            throw new AppError(409, "Expense records can only link to approved expense requests.");
          }
        }
        if ((!files || files.length === 0) && !linkedExpenseRequest) {
          throw new AppError(400, "Provide a supporting document or link this record to an approved expense request.");
        }
        const initialState = input.paidAt ? ExpenseRecordState.SETTLED : ExpenseRecordState.RECORDED;
        const staledAt = new Date();
        const staleReason = "Expense records changed; reconciliation must be regenerated.";
        const { record, staleReportCount } = await (async () => {
          const createdRecord = await requestsRepository.createExpenseRecord(actor.id, input, initialState, tx);
          if (storedUploads && storedUploads.length > 0) {
            await Promise.all(storedUploads.map((upload) => requestsRepository.createSupportingDocument({
              category: upload.category,
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              storedName: upload.storedName,
              relativePath: upload.relativePath,
              sizeBytes: BigInt(upload.sizeBytes),
              uploadedById: actor.id,
              expenseRecordId: createdRecord.id,
            }, tx)));
          }
          const reloadedRecord = await requestsRepository.findExpenseRecordById(createdRecord.id, tx);
          if (!reloadedRecord) {
            throw new AppError(500, "Failed to reload the created expense record.");
          }
          const staleResult = await reconciliationRepository.markReportsStaleForEvent({
              eventId: input.eventId,
              reason: staleReason,
              staledAt,
            }, tx);
          return {
            record: reloadedRecord,
            staleReportCount: staleResult.count,
          };
        })();
        await auditService.record({
          actorId: actor.id,
          action: "expense_records.create",
          entityType: "ExpenseRecord",
          entityId: record.id,
          summary: `Created expense record for ${record.event.title}`,
          context: {
            eventId: record.event.id,
            state: record.state,
            amount: record.amount,
            expenseRequestId: record.expenseRequest?.id ?? null,
            staleReconciliationReports: staleReportCount,
          },
          ...auditMetadata,
        }, tx);
        await recordFinancialResult(tx, submission, record.id);
        return { record: mapExpenseRecord(record), created: true };
      });
      if (!result.created) await cleanupStoredUploads(storedUploads);
      return result.record;
    }
    catch (error) {
      if (storedUploads && storedUploads.length > 0) {
        await cleanupStoredUploads(storedUploads.map((u) => ({ relativePath: u.relativePath })));
      }
      throw error;
    }
  },

  async settleExpenseRecord(
    actor: AuthenticatedUser,
    expenseRecordId: string,
    input: SettleExpenseRecordInput,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      const existingRecord = await requestsRepository.findExpenseRecordById(expenseRecordId, tx);
      if (!existingRecord) {
        throw new AppError(404, "Expense record not found.");
      }
      assertExpenseRecordManagementPermissions(actor, existingRecord.eventId);
      if (existingRecord.state === ExpenseRecordState.VOIDED) {
        throw new AppError(409, "Voided expense records cannot be settled.");
      }
      if (existingRecord.state === ExpenseRecordState.SETTLED) {
        throw new AppError(409, "Expense record is already settled.");
      }
      const staledAt = new Date();
      const staleReason = `Expense record ${existingRecord.id} was settled; reconciliation must be regenerated.`;
      const { record, staleReportCount } = await (async () => {
        const settledRecord = await requestsRepository.updateExpenseRecordState(expenseRecordId, {
          state: ExpenseRecordState.SETTLED,
          paidAt: input.paidAt ?? staledAt,
        }, tx);
        const staleResult = await reconciliationRepository.markReportsStaleForEvent({
          eventId: existingRecord.eventId,
          reason: staleReason,
          staledAt,
        }, tx);
        return {
          record: settledRecord,
          staleReportCount: staleResult.count,
        };
      })();
      await auditService.record({
        actorId: actor.id,
        action: "expense_records.settle",
        entityType: "ExpenseRecord",
        entityId: record.id,
        summary: `Settled expense record for ${record.event.title}`,
        context: {
          eventId: record.event.id,
          previousState: existingRecord.state,
          nextState: record.state,
          paidAt: record.paidAt,
          staleReconciliationReports: staleReportCount,
        },
        ...auditMetadata,
      }, tx);
      return mapExpenseRecord(record);
    }, actor);
  },

  async voidExpenseRecord(
    actor: AuthenticatedUser,
    expenseRecordId: string,
    input: VoidExpenseRecordInput,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      const existingRecord = await requestsRepository.findExpenseRecordById(expenseRecordId, tx);
      if (!existingRecord) {
        throw new AppError(404, "Expense record not found.");
      }
      assertExpenseRecordManagementPermissions(actor, existingRecord.eventId);
      if (existingRecord.state === ExpenseRecordState.VOIDED) {
        throw new AppError(409, "Expense record is already voided.");
      }
      const staleReason = `Settled expense record ${existingRecord.id} was voided; reconciliation must be regenerated.`;
      const staledAt = new Date();
      const { record, staleReportCount } = await (async () => {
        const voidedRecord = await requestsRepository.updateExpenseRecordState(expenseRecordId, {
          state: ExpenseRecordState.VOIDED,
        }, tx);
        const staleResult = await reconciliationRepository.markReportsStaleForEvent({
            eventId: existingRecord.eventId,
            reason: staleReason,
            staledAt,
          }, tx);
        return {
          record: voidedRecord,
          staleReportCount: staleResult.count,
        };
      })();
      await auditService.record({
        actorId: actor.id,
        action: "expense_records.void",
        entityType: "ExpenseRecord",
        entityId: record.id,
        summary: `Voided expense record for ${record.event.title}`,
        context: {
          eventId: record.event.id,
          previousState: existingRecord.state,
          nextState: record.state,
          reason: input.reason,
          staleReconciliationReports: staleReportCount,
        },
        ...auditMetadata,
      }, tx);
      return mapExpenseRecord(record);
    }, actor);
  },
};
