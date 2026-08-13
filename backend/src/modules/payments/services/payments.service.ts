import { DocumentCategory, IncomeState, PaymentProofState, RegistrationPaymentState, RoleCode } from "@prisma/client";

import { documentDirectories, uploadRules } from "../../../config/uploads";
import { prisma } from "../../../config/prisma";
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
import { cleanupStoredUpload, cleanupStoredUploads, storeValidatedUpload } from "../../../utils/upload-utils";
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

async function storeUpload(
  file: Express.Multer.File,
  category: "PAYMENT_PROOF" | "SUPPORTING_DOCUMENT",
) {
  return storeValidatedUpload(file, {
    category: DocumentCategory[category],
    destinationDir: documentDirectories[category],
    rule: uploadRules[category],
    documentName: "this document category",
  });
}

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
  async submitPaymentProof(
    actor: AuthenticatedUser,
    registrationId: string,
    input: SubmitPaymentProofInput,
    files: Express.Multer.File[] | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    const registration = await registrationsRepository.findById(registrationId);

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

    const pendingProof = await paymentsRepository.findPendingPaymentProofForRegistration(registrationId);

    if (pendingProof) {
      throw new AppError(409, "A payment proof is already pending verification for this registration.");
    }

    const transactionReference = sanitizeOptionalText(input.transactionReference);
    const referenceText = sanitizeOptionalText(input.referenceText);

    if (!transactionReference && !referenceText && (!files || files.length === 0)) {
      throw new AppError(400, "Provide a transaction reference, reference text, or a proof file.");
    }

    const storedUploads = files && files.length > 0 ? await Promise.all(files.map(f => storeUpload(f, "PAYMENT_PROOF"))) : [];

    try {
      const paymentProof = await prisma.$transaction(async (tx) => {
        const createdProof = await paymentsRepository.createPaymentProof(
          registrationId,
          {
            externalChannel: input.externalChannel.trim(),
            transactionReference,
            referenceText,
            amount: input.amount,
          },
          tx,
        );

        if (storedUploads && storedUploads.length > 0) {
          await Promise.all(
            storedUploads.map((upload) =>
              paymentsRepository.createSupportingDocument(
                {
                  category: upload.category,
                  originalName: upload.originalName,
                  mimeType: upload.mimeType,
                  storedName: upload.storedName,
                  relativePath: upload.relativePath,
                  sizeBytes: BigInt(upload.sizeBytes),
                  uploadedById: actor.id,
                  paymentProofId: createdProof.id,
                },
                tx,
              )
            )
          );
        }

        await registrationsRepository.updatePaymentState(
          registrationId,
          RegistrationPaymentState.PENDING_VERIFICATION,
          tx,
        );

        const proofWithContext = await paymentsRepository.findPaymentProofById(createdProof.id, tx);

        if (!proofWithContext) {
          throw new AppError(500, "Failed to reload the submitted payment proof.");
        }

        return proofWithContext;
      });

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
      });

      return mapSubmittedPaymentProof(paymentProof);
    } catch (error) {
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
    const paymentProof = await paymentsRepository.findPaymentProofById(paymentProofId);

    if (!paymentProof) {
      throw new AppError(404, "Payment proof not found.");
    }

    // System Admin cannot verify payments — only event-scoped Finance Controller
    assertEventFinancePermissions(actor, paymentProof.registration.eventId);

    if (paymentProof.state !== PaymentProofState.PENDING_VERIFICATION) {
      throw new AppError(409, "Only pending payment proofs can be reviewed.");
    }

    const reviewerRemark = sanitizeOptionalText(input.remark);
    const proofState =
      input.decision === "APPROVE"
        ? PaymentProofState.VERIFIED
        : PaymentProofState.REJECTED;
    const registrationState =
      input.decision === "APPROVE"
        ? RegistrationPaymentState.VERIFIED
        : RegistrationPaymentState.REJECTED;

    const reviewedPaymentProof = await prisma.$transaction(async (tx) => {
      await paymentsRepository.updatePaymentProofReview(
        paymentProofId,
        {
          state: proofState,
          reviewedAt: new Date(),
          reviewerRemark,
          reviewedById: actor.id,
        },
        tx,
      );

      await registrationsRepository.updatePaymentState(
        paymentProof.registrationId,
        registrationState,
        tx,
      );

      const reloadedPaymentProof = await paymentsRepository.findPaymentProofById(paymentProofId, tx);

      if (!reloadedPaymentProof) {
        throw new AppError(500, "Failed to reload the reviewed payment proof.");
      }

      return reloadedPaymentProof;
    });

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
      },
      ...auditMetadata,
    });

    return mapReviewedPaymentProof(reviewedPaymentProof);
  },

  async createIncomeRecord(
    actor: AuthenticatedUser,
    input: CreateIncomeRecordInput,
    files: Express.Multer.File[] | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    const event = await eventsRepository.findById(input.eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    // Only event-scoped Finance Controller can create income records
    assertEventFinancePermissions(actor, event.id);

    const referenceText = sanitizeOptionalText(input.referenceText);

    if (!referenceText && (!files || files.length === 0)) {
      throw new AppError(400, "Provide a reference note or an evidence file for the income record.");
    }

    const storedUploads = files && files.length > 0 ? await Promise.all(files.map(f => storeUpload(f, "SUPPORTING_DOCUMENT"))) : [];

    try {
      const incomeRecord = await prisma.$transaction(async (tx) => {
        const createdIncomeRecord = await paymentsRepository.createIncomeRecord(actor.id, {
          ...input,
          referenceText,
        }, tx);

        if (storedUploads && storedUploads.length > 0) {
          await Promise.all(
            storedUploads.map((upload) =>
              paymentsRepository.createSupportingDocument(
                {
                  category: upload.category,
                  originalName: upload.originalName,
                  mimeType: upload.mimeType,
                  storedName: upload.storedName,
                  relativePath: upload.relativePath,
                  sizeBytes: BigInt(upload.sizeBytes),
                  uploadedById: actor.id,
                  incomeRecordId: createdIncomeRecord.id,
                },
                tx,
              )
            )
          );
        }

        const incomeRecordWithContext = await paymentsRepository.findIncomeRecordById(
          createdIncomeRecord.id,
          tx,
        );

        if (!incomeRecordWithContext) {
          throw new AppError(500, "Failed to reload the new income record.");
        }

        return incomeRecordWithContext;
      });

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
      });

      return mapIncomeRecord(incomeRecord);
    } catch (error) {
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
    const existingRecord = await paymentsRepository.findIncomeRecordById(incomeRecordId);

    if (!existingRecord) {
      throw new AppError(404, "Income record not found.");
    }

    assertEventFinancePermissions(actor, existingRecord.eventId);

    if (existingRecord.state === IncomeState.REJECTED) {
      throw new AppError(409, "Income record is already voided or rejected.");
    }

    const wasVerified = existingRecord.state === IncomeState.VERIFIED;
    const staleReason = `Manual income record ${existingRecord.id} was voided; reconciliation must be regenerated.`;
    const staledAt = new Date();

    const { incomeRecord, staleReportCount } = await prisma.$transaction(async (tx) => {
      const voidedRecord = await paymentsRepository.updateIncomeRecordState(
        incomeRecordId,
        {
          state: IncomeState.REJECTED,
          verifiedById: null,
        },
        tx,
      );

      const staleResult = wasVerified
        ? await reconciliationRepository.markReportsStaleForEvent(
            {
              eventId: existingRecord.eventId,
              reason: staleReason,
              staledAt,
            },
            tx,
          )
        : { count: 0 };

      return {
        incomeRecord: voidedRecord,
        staleReportCount: staleResult.count,
      };
    });

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
    });

    return mapIncomeRecord(incomeRecord);
  },

  async verifyIncomeRecord(
    actor: AuthenticatedUser,
    incomeRecordId: string,
    auditMetadata?: AuditMetadata,
  ) {
    const existingRecord = await paymentsRepository.findIncomeRecordById(incomeRecordId);

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

    const { incomeRecord, staleReportCount } = await prisma.$transaction(async (tx) => {
      const verifiedRecord = await paymentsRepository.updateIncomeRecordState(
        incomeRecordId,
        {
          state: IncomeState.VERIFIED,
          verifiedById: actor.id,
        },
        tx,
      );

      const staleResult = await reconciliationRepository.markReportsStaleForEvent(
        {
          eventId: existingRecord.eventId,
          reason: staleReason,
          staledAt,
        },
        tx,
      );

      return {
        incomeRecord: verifiedRecord,
        staleReportCount: staleResult.count,
      };
    });

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
    });

    return mapIncomeRecord(incomeRecord);
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
