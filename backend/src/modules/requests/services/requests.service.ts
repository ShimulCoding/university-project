import {
  DocumentCategory,
  ExpenseRecordState,
  RequestState,
  RoleCode,
} from "@prisma/client";

import { documentDirectories, uploadRules } from "../../../config/uploads";
import { prisma } from "../../../config/prisma";
import { storageProvider } from "../../../storage";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import {
  hasExpenseRecordManagementAccess,
  hasFinanceReadAccess,
  hasRequestSubmissionAccess,
} from "../../../utils/role-checks";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { eventsRepository } from "../../events/repositories/events.repository";
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

type StoredUpload = {
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedName: string;
  relativePath: string;
};

function sanitizeNullableText(value: string | null | undefined) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function assertSupportingDocument(file: Express.Multer.File) {
  const rule = uploadRules.SUPPORTING_DOCUMENT;

  if (!rule.allowedMimeTypes.some((mimeType) => mimeType === file.mimetype)) {
    throw new AppError(400, "Uploaded file type is not allowed for supporting documents.");
  }

  if (file.size > rule.maxFileSizeBytes) {
    throw new AppError(400, "Uploaded file exceeds the maximum allowed size.");
  }
}

async function storeSupportingDocument(file: Express.Multer.File): Promise<StoredUpload> {
  assertSupportingDocument(file);

  const storedFile = await storageProvider.saveFile({
    buffer: file.buffer,
    destinationDir: documentDirectories.SUPPORTING_DOCUMENT,
    originalName: file.originalname,
  });

  return {
    category: DocumentCategory.SUPPORTING_DOCUMENT,
    originalName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storedName: storedFile.storedName,
    relativePath: storedFile.relativePath,
  };
}

async function cleanupStoredUpload(upload: StoredUpload | undefined) {
  if (!upload) {
    return;
  }

  try {
    await storageProvider.removeFile(upload.relativePath);
  } catch {
    // Best effort cleanup only.
  }
}

function assertRequestSubmissionPermissions(viewer: AuthenticatedUser) {
  if (!hasRequestSubmissionAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to submit finance requests.");
  }
}

function assertExpenseRecordManagementPermissions(viewer: AuthenticatedUser) {
  if (!hasExpenseRecordManagementAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to manage expense records.");
  }
}

function assertInternalFinanceReadPermissions(viewer: AuthenticatedUser) {
  if (!hasFinanceReadAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to view these finance records.");
  }
}

function assertRequestAccess(viewer: AuthenticatedUser, requestedById: string | null | undefined) {
  if (requestedById === viewer.id || hasFinanceReadAccess(viewer.roles)) {
    return;
  }

  throw new AppError(403, "You are not allowed to access this request.");
}

function assertRequestOwnership(viewer: AuthenticatedUser, requestedById: string | null | undefined) {
  if (requestedById === viewer.id || viewer.roles.includes(RoleCode.SYSTEM_ADMIN)) {
    return;
  }

  throw new AppError(403, "You are not allowed to modify this request.");
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

export const requestsService = {
  async listMyBudgetRequests(actor: AuthenticatedUser) {
    assertRequestSubmissionPermissions(actor);

    const requests = await requestsRepository.listBudgetRequestsByRequester(actor.id);
    return requests.map(mapBudgetRequest);
  },

  async listBudgetRequests(viewer: AuthenticatedUser, filters: RequestFilters) {
    assertInternalFinanceReadPermissions(viewer);

    const requests = await requestsRepository.listBudgetRequests(filters);
    return requests.map(mapBudgetRequest);
  },

  async getBudgetRequestById(viewer: AuthenticatedUser, budgetRequestId: string) {
    const request = await requestsRepository.findBudgetRequestById(budgetRequestId);

    if (!request) {
      throw new AppError(404, "Budget request not found.");
    }

    assertRequestAccess(viewer, request.requestedById);
    return mapBudgetRequest(request);
  },

  async createBudgetRequest(
    actor: AuthenticatedUser,
    input: CreateBudgetRequestInput,
    file: Express.Multer.File | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    assertRequestSubmissionPermissions(actor);

    const event = await eventsRepository.findById(input.eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const storedUpload = file ? await storeSupportingDocument(file) : undefined;

    try {
      const request = await prisma.$transaction(async (tx) => {
        const createdRequest = await requestsRepository.createBudgetRequest(
          actor.id,
          {
            ...input,
            justification: sanitizeNullableText(input.justification),
          },
          getRequestSubmissionState(input.submit),
          tx,
        );

        if (storedUpload) {
          await requestsRepository.createSupportingDocument(
            {
              category: storedUpload.category,
              originalName: storedUpload.originalName,
              mimeType: storedUpload.mimeType,
              storedName: storedUpload.storedName,
              relativePath: storedUpload.relativePath,
              sizeBytes: BigInt(storedUpload.sizeBytes),
              uploadedById: actor.id,
              budgetRequestId: createdRequest.id,
            },
            tx,
          );
        }

        const reloadedRequest = await requestsRepository.findBudgetRequestById(createdRequest.id, tx);

        if (!reloadedRequest) {
          throw new AppError(500, "Failed to reload the created budget request.");
        }

        return reloadedRequest;
      });

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
      });

      return mapBudgetRequest(request);
    } catch (error) {
      await cleanupStoredUpload(storedUpload);
      throw error;
    }
  },

  async updateBudgetRequest(
    actor: AuthenticatedUser,
    budgetRequestId: string,
    input: UpdateBudgetRequestInput,
    file: Express.Multer.File | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    assertRequestSubmissionPermissions(actor);

    const existingRequest = await requestsRepository.findBudgetRequestById(budgetRequestId);

    if (!existingRequest) {
      throw new AppError(404, "Budget request not found.");
    }

    assertRequestOwnership(actor, existingRequest.requestedById);
    assertEditableRequestState(existingRequest.state);
    assertUpdatePayloadOrFile(input, file, "budget request");

    const storedUpload = file ? await storeSupportingDocument(file) : undefined;

    try {
      const request = await prisma.$transaction(async (tx) => {
        await requestsRepository.updateBudgetRequest(
          budgetRequestId,
          {
            ...input,
            justification: sanitizeNullableText(input.justification),
          },
          tx,
        );

        if (storedUpload) {
          await requestsRepository.createSupportingDocument(
            {
              category: storedUpload.category,
              originalName: storedUpload.originalName,
              mimeType: storedUpload.mimeType,
              storedName: storedUpload.storedName,
              relativePath: storedUpload.relativePath,
              sizeBytes: BigInt(storedUpload.sizeBytes),
              uploadedById: actor.id,
              budgetRequestId,
            },
            tx,
          );
        }

        const reloadedRequest = await requestsRepository.findBudgetRequestById(budgetRequestId, tx);

        if (!reloadedRequest) {
          throw new AppError(500, "Failed to reload the updated budget request.");
        }

        return reloadedRequest;
      });

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
      });

      return mapBudgetRequest(request);
    } catch (error) {
      await cleanupStoredUpload(storedUpload);
      throw error;
    }
  },

  async submitBudgetRequest(
    actor: AuthenticatedUser,
    budgetRequestId: string,
    auditMetadata?: AuditMetadata,
  ) {
    assertRequestSubmissionPermissions(actor);

    const existingRequest = await requestsRepository.findBudgetRequestById(budgetRequestId);

    if (!existingRequest) {
      throw new AppError(404, "Budget request not found.");
    }

    assertRequestOwnership(actor, existingRequest.requestedById);
    assertEditableRequestState(existingRequest.state);

    const request = await requestsRepository.updateBudgetRequestState(
      budgetRequestId,
      RequestState.SUBMITTED,
    );

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
    });

    return mapBudgetRequest(request);
  },

  async listMyExpenseRequests(actor: AuthenticatedUser) {
    assertRequestSubmissionPermissions(actor);

    const requests = await requestsRepository.listExpenseRequestsByRequester(actor.id);
    return requests.map(mapExpenseRequest);
  },

  async listExpenseRequests(viewer: AuthenticatedUser, filters: RequestFilters) {
    assertInternalFinanceReadPermissions(viewer);

    const requests = await requestsRepository.listExpenseRequests(filters);
    return requests.map(mapExpenseRequest);
  },

  async getExpenseRequestById(viewer: AuthenticatedUser, expenseRequestId: string) {
    const request = await requestsRepository.findExpenseRequestById(expenseRequestId);

    if (!request) {
      throw new AppError(404, "Expense request not found.");
    }

    assertRequestAccess(viewer, request.requestedById);
    return mapExpenseRequest(request);
  },

  async createExpenseRequest(
    actor: AuthenticatedUser,
    input: CreateExpenseRequestInput,
    file: Express.Multer.File | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    assertRequestSubmissionPermissions(actor);

    if (!file) {
      throw new AppError(400, "Expense requests require at least one supporting document.");
    }

    const event = await eventsRepository.findById(input.eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const storedUpload = await storeSupportingDocument(file);

    try {
      const request = await prisma.$transaction(async (tx) => {
        const createdRequest = await requestsRepository.createExpenseRequest(
          actor.id,
          {
            ...input,
            justification: sanitizeNullableText(input.justification),
          },
          getRequestSubmissionState(input.submit),
          tx,
        );

        await requestsRepository.createSupportingDocument(
          {
            category: storedUpload.category,
            originalName: storedUpload.originalName,
            mimeType: storedUpload.mimeType,
            storedName: storedUpload.storedName,
            relativePath: storedUpload.relativePath,
            sizeBytes: BigInt(storedUpload.sizeBytes),
            uploadedById: actor.id,
            expenseRequestId: createdRequest.id,
          },
          tx,
        );

        const reloadedRequest = await requestsRepository.findExpenseRequestById(createdRequest.id, tx);

        if (!reloadedRequest) {
          throw new AppError(500, "Failed to reload the created expense request.");
        }

        return reloadedRequest;
      });

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
      });

      return mapExpenseRequest(request);
    } catch (error) {
      await cleanupStoredUpload(storedUpload);
      throw error;
    }
  },

  async updateExpenseRequest(
    actor: AuthenticatedUser,
    expenseRequestId: string,
    input: UpdateExpenseRequestInput,
    file: Express.Multer.File | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    assertRequestSubmissionPermissions(actor);

    const existingRequest = await requestsRepository.findExpenseRequestById(expenseRequestId);

    if (!existingRequest) {
      throw new AppError(404, "Expense request not found.");
    }

    assertRequestOwnership(actor, existingRequest.requestedById);
    assertEditableRequestState(existingRequest.state);
    assertUpdatePayloadOrFile(input, file, "expense request");

    if (!file && existingRequest.documents.length === 0) {
      throw new AppError(400, "Expense requests require at least one supporting document.");
    }

    const storedUpload = file ? await storeSupportingDocument(file) : undefined;

    try {
      const request = await prisma.$transaction(async (tx) => {
        await requestsRepository.updateExpenseRequest(
          expenseRequestId,
          {
            ...input,
            justification: sanitizeNullableText(input.justification),
          },
          tx,
        );

        if (storedUpload) {
          await requestsRepository.createSupportingDocument(
            {
              category: storedUpload.category,
              originalName: storedUpload.originalName,
              mimeType: storedUpload.mimeType,
              storedName: storedUpload.storedName,
              relativePath: storedUpload.relativePath,
              sizeBytes: BigInt(storedUpload.sizeBytes),
              uploadedById: actor.id,
              expenseRequestId,
            },
            tx,
          );
        }

        const reloadedRequest = await requestsRepository.findExpenseRequestById(expenseRequestId, tx);

        if (!reloadedRequest) {
          throw new AppError(500, "Failed to reload the updated expense request.");
        }

        return reloadedRequest;
      });

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
      });

      return mapExpenseRequest(request);
    } catch (error) {
      await cleanupStoredUpload(storedUpload);
      throw error;
    }
  },

  async submitExpenseRequest(
    actor: AuthenticatedUser,
    expenseRequestId: string,
    auditMetadata?: AuditMetadata,
  ) {
    assertRequestSubmissionPermissions(actor);

    const existingRequest = await requestsRepository.findExpenseRequestById(expenseRequestId);

    if (!existingRequest) {
      throw new AppError(404, "Expense request not found.");
    }

    assertRequestOwnership(actor, existingRequest.requestedById);
    assertEditableRequestState(existingRequest.state);

    if (existingRequest.documents.length === 0) {
      throw new AppError(400, "Expense requests require at least one supporting document.");
    }

    const request = await requestsRepository.updateExpenseRequestState(
      expenseRequestId,
      RequestState.SUBMITTED,
    );

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
    });

    return mapExpenseRequest(request);
  },

  async listExpenseRecords(viewer: AuthenticatedUser, filters: ExpenseRecordFilters) {
    assertInternalFinanceReadPermissions(viewer);

    const records = await requestsRepository.listExpenseRecords(filters);
    return records.map(mapExpenseRecord);
  },

  async getExpenseRecordById(viewer: AuthenticatedUser, expenseRecordId: string) {
    assertInternalFinanceReadPermissions(viewer);

    const record = await requestsRepository.findExpenseRecordById(expenseRecordId);

    if (!record) {
      throw new AppError(404, "Expense record not found.");
    }

    return mapExpenseRecord(record);
  },

  async createExpenseRecord(
    actor: AuthenticatedUser,
    input: CreateExpenseRecordInput,
    file: Express.Multer.File | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    assertExpenseRecordManagementPermissions(actor);

    const event = await eventsRepository.findById(input.eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    let linkedExpenseRequest:
      | Awaited<ReturnType<typeof requestsRepository.findExpenseRequestById>>
      | null
      | undefined = undefined;

    if (input.expenseRequestId) {
      linkedExpenseRequest = await requestsRepository.findExpenseRequestById(input.expenseRequestId);

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

    if (!file && !linkedExpenseRequest) {
      throw new AppError(
        400,
        "Provide a supporting document or link this record to an approved expense request.",
      );
    }

    const storedUpload = file ? await storeSupportingDocument(file) : undefined;

    try {
      const record = await prisma.$transaction(async (tx) => {
        const createdRecord = await requestsRepository.createExpenseRecord(
          actor.id,
          input,
          input.paidAt ? ExpenseRecordState.SETTLED : ExpenseRecordState.RECORDED,
          tx,
        );

        if (storedUpload) {
          await requestsRepository.createSupportingDocument(
            {
              category: storedUpload.category,
              originalName: storedUpload.originalName,
              mimeType: storedUpload.mimeType,
              storedName: storedUpload.storedName,
              relativePath: storedUpload.relativePath,
              sizeBytes: BigInt(storedUpload.sizeBytes),
              uploadedById: actor.id,
              expenseRecordId: createdRecord.id,
            },
            tx,
          );
        }

        const reloadedRecord = await requestsRepository.findExpenseRecordById(createdRecord.id, tx);

        if (!reloadedRecord) {
          throw new AppError(500, "Failed to reload the created expense record.");
        }

        return reloadedRecord;
      });

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
        },
        ...auditMetadata,
      });

      return mapExpenseRecord(record);
    } catch (error) {
      await cleanupStoredUpload(storedUpload);
      throw error;
    }
  },

  async settleExpenseRecord(
    actor: AuthenticatedUser,
    expenseRecordId: string,
    input: SettleExpenseRecordInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertExpenseRecordManagementPermissions(actor);

    const existingRecord = await requestsRepository.findExpenseRecordById(expenseRecordId);

    if (!existingRecord) {
      throw new AppError(404, "Expense record not found.");
    }

    if (existingRecord.state === ExpenseRecordState.VOIDED) {
      throw new AppError(409, "Voided expense records cannot be settled.");
    }

    if (existingRecord.state === ExpenseRecordState.SETTLED) {
      throw new AppError(409, "Expense record is already settled.");
    }

    const record = await requestsRepository.updateExpenseRecordState(
      expenseRecordId,
      {
        state: ExpenseRecordState.SETTLED,
        paidAt: input.paidAt ?? new Date(),
      },
    );

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
      },
      ...auditMetadata,
    });

    return mapExpenseRecord(record);
  },

  async voidExpenseRecord(
    actor: AuthenticatedUser,
    expenseRecordId: string,
    input: VoidExpenseRecordInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertExpenseRecordManagementPermissions(actor);

    const existingRecord = await requestsRepository.findExpenseRecordById(expenseRecordId);

    if (!existingRecord) {
      throw new AppError(404, "Expense record not found.");
    }

    if (existingRecord.state === ExpenseRecordState.VOIDED) {
      throw new AppError(409, "Expense record is already voided.");
    }

    const record = await requestsRepository.updateExpenseRecordState(
      expenseRecordId,
      {
        state: ExpenseRecordState.VOIDED,
      },
    );

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
      },
      ...auditMetadata,
    });

    return mapExpenseRecord(record);
  },
};
