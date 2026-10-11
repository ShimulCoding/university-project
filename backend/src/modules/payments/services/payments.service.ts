import { governanceTransaction } from "../../../utils/governance-transaction";
import { DocumentCategory, FinancialOperation, IncomeState, PaymentProofState, Prisma, RegistrationPaymentState, RoleCode } from "@prisma/client";
import { financialInputHash, financialRequestKey, financialTransaction, findFinancialReplay, readCompletedFinancialSubmission, recordFinancialResult } from "../../../utils/financial-idempotency";

import { documentDirectories, uploadRules } from "../../../config/uploads";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import {
  assertAnyEventScopedAccess,
  assertEventScopedOperationalAccess,
  assertSystemAdminOrEventRole,
  scopeEventFilters,
} from "../../../utils/event-scope";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { sanitizeOptionalText } from "../../../utils/text-utils";
import { cleanupStoredUploads, storeValidatedUploads } from "../../../utils/upload-utils";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { eventsRepository } from "../../events/repositories/events.repository";
import { reconciliationRepository } from "../../reconciliation/repositories/reconciliation.repository";
import { registrationsRepository } from "../../registrations/repositories/registrations.repository";
import {
  mapIncomeRecord,
  mapPaymentVerificationQueueItem,
  mapReviewedPaymentProof,
  mapSubmittedPaymentProof,
} from "../payments.mappers";
import { paymentsRepository } from "../repositories/payments.repository";
import type {
  CreateIncomeRecordInput,
  IncomeRecordFilters,
  PaymentProofDecisionInput,
  VoidIncomeRecordInput,
  PaymentVerificationQueueFilters,
  SubmitPaymentProofInput,
} from "../types/payments.types";

const financeEventRoles = [RoleCode.FINANCIAL_CONTROLLER] as RoleCode[];
const financeReadEventRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.FINANCIAL_CONTROLLER,
] as RoleCode[];


/**
 * Assert the user has Finance Controller access for the given event.
 * System Admin gets governance read-only — not operational finance access.
 */
function assertEventFinancePermissions(viewer: AuthenticatedUser, eventId: string) {
  assertEventScopedOperationalAccess(
    viewer,
    eventId,
    financeEventRoles,
    "You are not assigned as Finance Controller for this event.",
  );
}

/**
 * Assert the user can read finance data for the given event.
 * Allows Finance Controller + Event Admin.
 */
function assertEventFinanceReadPermissions(viewer: AuthenticatedUser, eventId: string) {
  assertSystemAdminOrEventRole(
    viewer,
    eventId,
    financeReadEventRoles,
    "You are not assigned to this event with finance access.",
  );
}

/**
 * For list endpoints: check the user has at least one event assignment
 * with finance roles. System Admin can list across all events.
 */
function assertHasAnyFinanceAssignment(viewer: AuthenticatedUser) {
  assertAnyEventScopedAccess(
    viewer,
    financeReadEventRoles,
    "You are not assigned to any event with finance access.",
  );
}

export const paymentsService = {
  async assertIncomeRecordUploadAccess(actor: AuthenticatedUser, eventId: string): Promise<void> {
    const event = await eventsRepository.findById(eventId);
    if (!event) throw new AppError(404, "Event not found.");
    assertEventFinancePermissions(actor, event.id);
  },
  async assertPaymentProofUploadAccess(actor: AuthenticatedUser, registrationId: string): Promise<void> {
    const registration = await registrationsRepository.findById(registrationId);
    if (!registration) throw new AppError(404, "Registration not found.");
    if (registration.participantId !== actor.id) assertEventFinancePermissions(actor, registration.eventId);
    if (registration.paymentState === RegistrationPaymentState.VERIFIED) throw new AppError(409, "This registration has already been verified.");
  },

  async submitPaymentProof(
    actor: AuthenticatedUser,
    registrationId: string,
    input: SubmitPaymentProofInput,
    files: Express.Multer.File[] | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    await paymentsService.assertPaymentProofUploadAccess(actor, registrationId);
    const storedUploads = await storeValidatedUploads(files, { category: DocumentCategory.PAYMENT_PROOF, destinationDir: documentDirectories.PAYMENT_PROOF, rule: uploadRules.PAYMENT_PROOF });
    try {
      return await governanceTransaction(async (tx) => {
        const registration = await registrationsRepository.findById(registrationId, tx);
        if (!registration) {
          throw new AppError(404, "Registration not found.");
        }
        const isOwner = registration.participantId === actor.id;
        if (!isOwner) {
          // Non-owner needs event-scoped finance access
          assertEventFinancePermissions(actor, registration.eventId);
        }
        if (registration.paymentState === RegistrationPaymentState.VERIFIED) {
          throw new AppError(409, "This registration has already been verified.");
        }
        const pendingProof = await paymentsRepository.findPendingPaymentProofForRegistration(registrationId, tx);
        if (pendingProof) {
          throw new AppError(409, "A payment proof is already pending verification for this registration.");
        }
        const transactionReference = sanitizeOptionalText(input.transactionReference);
        const referenceText = sanitizeOptionalText(input.referenceText);
        if (!transactionReference && !referenceText && (!files || files.length === 0)) {
          throw new AppError(400, "Provide a transaction reference, reference text, or a proof file.");
        }
        const paymentProof = await (async () => {
          const createdProof = await paymentsRepository.createPaymentProof(registrationId, {
            externalChannel: input.externalChannel.trim(),
            transactionReference,
            referenceText,
            amount: input.amount,
          }, tx);
          if (storedUploads && storedUploads.length > 0) {
            await Promise.all(storedUploads.map((upload) => paymentsRepository.createSupportingDocument({
              category: upload.category,
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              storedName: upload.storedName,
              relativePath: upload.relativePath,
              sizeBytes: BigInt(upload.sizeBytes),
              uploadedById: actor.id,
              paymentProofId: createdProof.id,
            }, tx)));
          }
          await registrationsRepository.updatePaymentState(registrationId, RegistrationPaymentState.PENDING_VERIFICATION, tx);
          const proofWithContext = await paymentsRepository.findPaymentProofById(createdProof.id, tx);
          if (!proofWithContext) {
            throw new AppError(500, "Failed to reload the submitted payment proof.");
          }
          return proofWithContext;
        })();
        await auditService.record({
          actorId: actor.id,
          action: "payments.proof.submit",
          entityType: "PaymentProof",
          entityId: paymentProof.id,
          summary: `Submitted payment proof for registration ${paymentProof.registration.registrationCode}`,
          context: {
            registrationId: paymentProof.registration.id,
            eventId: paymentProof.registration.event.id,
            state: paymentProof.state,
          },
          ...auditMetadata,
        }, tx);
        return mapSubmittedPaymentProof(paymentProof);
      }, actor);
    }
    catch (error) {
      if (storedUploads && storedUploads.length > 0) {
        await cleanupStoredUploads(storedUploads.map((u) => ({ relativePath: u.relativePath })));
      }
      throw error;
    }
  },

  async listVerificationQueue(viewer: AuthenticatedUser, filters: PaymentVerificationQueueFilters) {
    assertHasAnyFinanceAssignment(viewer);

    const scopedFilters = scopeEventFilters(viewer, filters, financeReadEventRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [queue, totalItems] = await Promise.all([
      paymentsRepository.listPendingVerificationQueue(scopedFilters, paginationOptions),
      paymentsRepository.countPendingVerificationQueue(scopedFilters),
    ]);

    return {
      queue: queue.map(mapPaymentVerificationQueueItem),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async decidePaymentProof(
    actor: AuthenticatedUser,
    paymentProofId: string,
    input: PaymentProofDecisionInput,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      const paymentProof = await paymentsRepository.findPaymentProofById(paymentProofId, tx);
      if (!paymentProof) {
        throw new AppError(404, "Payment proof not found.");
      }
      // System Admin cannot verify payments — only event-scoped Finance Controller
      assertEventFinancePermissions(actor, paymentProof.registration.eventId);
      if (paymentProof.state !== PaymentProofState.PENDING_VERIFICATION) {
        throw new AppError(409, "Only pending payment proofs can be reviewed.");
      }
      const reviewerRemark = sanitizeOptionalText(input.remark);
      const proofState = input.decision === "APPROVE"
        ? PaymentProofState.VERIFIED
        : PaymentProofState.REJECTED;
      const registrationState = input.decision === "APPROVE"
        ? RegistrationPaymentState.VERIFIED
        : RegistrationPaymentState.REJECTED;
      const shouldInvalidateReconciliation = proofState === PaymentProofState.VERIFIED;
      const staledAt = new Date();
      const staleReason = `Payment proof ${paymentProof.id} was verified; reconciliation must be regenerated.`;
      const { reviewedPaymentProof, staleReportCount } = await (async () => {
        await paymentsRepository.updatePaymentProofReview(paymentProofId, {
          state: proofState,
          reviewedAt: staledAt,
          reviewerRemark,
          reviewedById: actor.id,
        }, tx);
        await registrationsRepository.updatePaymentState(paymentProof.registrationId, registrationState, tx);
        const reloadedPaymentProof = await paymentsRepository.findPaymentProofById(paymentProofId, tx);
        if (!reloadedPaymentProof) {
          throw new AppError(500, "Failed to reload the reviewed payment proof.");
        }
        const staleResult = shouldInvalidateReconciliation
          ? await reconciliationRepository.markReportsStaleForEvent({
            eventId: paymentProof.registration.eventId,
            reason: staleReason,
            staledAt,
          }, tx)
          : { count: 0 };
        return {
          reviewedPaymentProof: reloadedPaymentProof,
          staleReportCount: staleResult.count,
        };
      })();
      await auditService.record({
        actorId: actor.id,
        action: "payments.proof.review",
        entityType: "PaymentProof",
        entityId: reviewedPaymentProof.id,
        summary: `${input.decision} payment proof for registration ${reviewedPaymentProof.registration.registrationCode}`,
        context: {
          registrationId: reviewedPaymentProof.registration.id,
          eventId: reviewedPaymentProof.registration.event.id,
          decision: input.decision,
          reviewerRemark: reviewerRemark ?? null,
          staleReconciliationReports: staleReportCount,
        },
        ...auditMetadata,
      }, tx);
      return mapReviewedPaymentProof(reviewedPaymentProof);
    }, actor);
  },

  async createIncomeRecord(
    actor: AuthenticatedUser,
    input: CreateIncomeRecordInput,
    files: Express.Multer.File[] | undefined,
    requestKey: string,
    auditMetadata?: AuditMetadata,
  ) {
    // Multipart body supplies the owning event. Role/admission gates precede
    // parsing; this event check precedes scanning/persistence, with a repeat
    // inside the financial write transaction to handle assignment changes.
    await paymentsService.assertIncomeRecordUploadAccess(actor, input.eventId);
    const referenceText = sanitizeOptionalText(input.referenceText);
    const submission = { actorId: actor.id, eventId: input.eventId, operation: FinancialOperation.INCOME_CREATE,
      key: financialRequestKey(requestKey), inputHash: financialInputHash([
        input.eventId, input.sourceType, input.sourceLabel, new Prisma.Decimal(input.amount).toFixed(2),
        referenceText ?? null, input.collectedAt?.toISOString() ?? null,
      ], files) };
    const completed = await readCompletedFinancialSubmission(actor, submission,
      () => assertEventFinancePermissions(actor, input.eventId), paymentsRepository.findIncomeRecordById);
    if (completed) return mapIncomeRecord(completed);
    const storedUploads = await storeValidatedUploads(files, { category: DocumentCategory.SUPPORTING_DOCUMENT, destinationDir: documentDirectories.SUPPORTING_DOCUMENT, rule: uploadRules.SUPPORTING_DOCUMENT });
    try {
      const result = await financialTransaction(actor, async (tx) => {
        const event = await eventsRepository.findById(input.eventId, tx);
        if (!event) {
          throw new AppError(404, "Event not found.");
        }
        // Only event-scoped Finance Controller can create income records
        assertEventFinancePermissions(actor, event.id);
        const replayId = await findFinancialReplay(tx, submission);
        if (replayId) {
          const original = await paymentsRepository.findIncomeRecordById(replayId, tx);
          if (!original || original.eventId !== event.id) throw new AppError(500, "Financial submission result is unavailable.");
          return { record: mapIncomeRecord(original), created: false };
        }
        if (!referenceText && (!files || files.length === 0)) {
          throw new AppError(400, "Provide a reference note or an evidence file for the income record.");
        }
        const incomeRecord = await (async () => {
          const createdIncomeRecord = await paymentsRepository.createIncomeRecord(actor.id, {
            ...input,
            referenceText,
          }, tx);
          if (storedUploads && storedUploads.length > 0) {
            await Promise.all(storedUploads.map((upload) => paymentsRepository.createSupportingDocument({
              category: upload.category,
              originalName: upload.originalName,
              mimeType: upload.mimeType,
              storedName: upload.storedName,
              relativePath: upload.relativePath,
              sizeBytes: BigInt(upload.sizeBytes),
              uploadedById: actor.id,
              incomeRecordId: createdIncomeRecord.id,
            }, tx)));
          }
          const incomeRecordWithContext = await paymentsRepository.findIncomeRecordById(createdIncomeRecord.id, tx);
          if (!incomeRecordWithContext) {
            throw new AppError(500, "Failed to reload the new income record.");
          }
          return incomeRecordWithContext;
        })();
        await reconciliationRepository.markReportsStaleForEvent({
          eventId: incomeRecord.eventId,
          reason: "Manual income records changed; reconciliation must be regenerated.",
          staledAt: new Date(),
        }, tx);
        await auditService.record({
          actorId: actor.id,
          action: "income.create",
          entityType: "IncomeRecord",
          entityId: incomeRecord.id,
          summary: `Recorded ${incomeRecord.sourceType} income for ${incomeRecord.event.title}`,
          context: {
            eventId: incomeRecord.event.id,
            sourceType: incomeRecord.sourceType,
            amount: incomeRecord.amount,
          },
          ...auditMetadata,
        }, tx);
        await recordFinancialResult(tx, submission, incomeRecord.id);
        return { record: mapIncomeRecord(incomeRecord), created: true };
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

  async voidIncomeRecord(
    actor: AuthenticatedUser,
    incomeRecordId: string,
    input: VoidIncomeRecordInput,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      const existingRecord = await paymentsRepository.findIncomeRecordById(incomeRecordId, tx);
      if (!existingRecord) {
        throw new AppError(404, "Income record not found.");
      }
      assertEventFinancePermissions(actor, existingRecord.eventId);
      if (existingRecord.state === IncomeState.REJECTED) {
        throw new AppError(409, "Income record is already voided or rejected.");
      }
      const staleReason = `Manual income record ${existingRecord.id} was voided; reconciliation must be regenerated.`;
      const staledAt = new Date();
      const { incomeRecord, staleReportCount } = await (async () => {
        const voidedRecord = await paymentsRepository.updateIncomeRecordState(incomeRecordId, {
          state: IncomeState.REJECTED,
          verifiedById: null,
        }, tx);
        const staleResult = await reconciliationRepository.markReportsStaleForEvent({
            eventId: existingRecord.eventId,
            reason: staleReason,
            staledAt,
          }, tx);
        return {
          incomeRecord: voidedRecord,
          staleReportCount: staleResult.count,
        };
      })();
      await auditService.record({
        actorId: actor.id,
        action: "income.void",
        entityType: "IncomeRecord",
        entityId: incomeRecord.id,
        summary: `Voided income record for ${incomeRecord.event.title}`,
        context: {
          eventId: incomeRecord.event.id,
          previousState: existingRecord.state,
          nextState: incomeRecord.state,
          reason: input.reason,
          staleReconciliationReports: staleReportCount,
        },
        ...auditMetadata,
      }, tx);
      return mapIncomeRecord(incomeRecord);
    }, actor);
  },

  async verifyIncomeRecord(
    actor: AuthenticatedUser,
    incomeRecordId: string,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      const existingRecord = await paymentsRepository.findIncomeRecordById(incomeRecordId, tx);
      if (!existingRecord) {
        throw new AppError(404, "Income record not found.");
      }
      assertEventFinancePermissions(actor, existingRecord.eventId);
      if (existingRecord.state === IncomeState.VERIFIED) {
        throw new AppError(409, "Income record is already verified.");
      }
      if (existingRecord.state === IncomeState.REJECTED) {
        throw new AppError(409, "Voided or rejected income records cannot be verified.");
      }
      const staleReason = `Manual income record ${existingRecord.id} was verified; reconciliation must be regenerated.`;
      const staledAt = new Date();
      const { incomeRecord, staleReportCount } = await (async () => {
        const verifiedRecord = await paymentsRepository.updateIncomeRecordState(incomeRecordId, {
          state: IncomeState.VERIFIED,
          verifiedById: actor.id,
        }, tx);
        const staleResult = await reconciliationRepository.markReportsStaleForEvent({
          eventId: existingRecord.eventId,
          reason: staleReason,
          staledAt,
        }, tx);
        return {
          incomeRecord: verifiedRecord,
          staleReportCount: staleResult.count,
        };
      })();
      await auditService.record({
        actorId: actor.id,
        action: "income.verify",
        entityType: "IncomeRecord",
        entityId: incomeRecord.id,
        summary: `Verified income record for ${incomeRecord.event.title}`,
        context: {
          eventId: incomeRecord.event.id,
          previousState: existingRecord.state,
          nextState: incomeRecord.state,
          staleReconciliationReports: staleReportCount,
        },
        ...auditMetadata,
      }, tx);
      return mapIncomeRecord(incomeRecord);
    }, actor);
  },

  async listIncomeRecords(viewer: AuthenticatedUser, filters: IncomeRecordFilters) {
    assertHasAnyFinanceAssignment(viewer);

    const scopedFilters = scopeEventFilters(viewer, filters, financeReadEventRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [incomeRecords, totalItems] = await Promise.all([
      paymentsRepository.listIncomeRecords(scopedFilters, paginationOptions),
      paymentsRepository.countIncomeRecords(scopedFilters),
    ]);

    return {
      incomeRecords: incomeRecords.map(mapIncomeRecord),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getIncomeRecordById(viewer: AuthenticatedUser, incomeRecordId: string) {
    const incomeRecord = await paymentsRepository.findIncomeRecordById(incomeRecordId);

    if (!incomeRecord) {
      throw new AppError(404, "Income record not found.");
    }

    assertEventFinanceReadPermissions(viewer, incomeRecord.eventId);

    return mapIncomeRecord(incomeRecord);
  },
};
