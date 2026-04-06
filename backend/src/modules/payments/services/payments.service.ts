import { DocumentCategory, PaymentProofState, RegistrationPaymentState } from "@prisma/client";

import { documentDirectories, uploadRules } from "../../../config/uploads";
import { prisma } from "../../../config/prisma";
import { storageProvider } from "../../../storage";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { hasFinanceAccess } from "../../../utils/role-checks";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { eventsRepository } from "../../events/repositories/events.repository";
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
  PaymentVerificationQueueFilters,
  SubmitPaymentProofInput,
} from "../types/payments.types";

type StoredUpload = {
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storedName: string;
  relativePath: string;
};

function sanitizeOptionalText(value: string | undefined) {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function assertUploadMatchesRule(
  file: Express.Multer.File,
  category: keyof typeof uploadRules,
) {
  const rule = uploadRules[category];

  if (!rule.allowedMimeTypes.some((mimeType) => mimeType === file.mimetype)) {
    throw new AppError(400, "Uploaded file type is not allowed for this document category.");
  }

  if (file.size > rule.maxFileSizeBytes) {
    throw new AppError(400, "Uploaded file exceeds the maximum allowed size.");
  }
}

async function storeUpload(
  file: Express.Multer.File,
  category: "PAYMENT_PROOF" | "SUPPORTING_DOCUMENT",
): Promise<StoredUpload> {
  assertUploadMatchesRule(file, category);

  const storedFile = await storageProvider.saveFile({
    buffer: file.buffer,
    destinationDir: documentDirectories[category],
    originalName: file.originalname,
  });

  return {
    category: DocumentCategory[category],
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

function assertFinancePermissions(viewer: AuthenticatedUser) {
  if (!hasFinanceAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to manage finance verification or income records.");
  }
}

export const paymentsService = {
  async submitPaymentProof(
    actor: AuthenticatedUser,
    registrationId: string,
    input: SubmitPaymentProofInput,
    file: Express.Multer.File | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    const registration = await registrationsRepository.findById(registrationId);

    if (!registration) {
      throw new AppError(404, "Registration not found.");
    }

    const isOwner = registration.participantId === actor.id;

    if (!isOwner && !hasFinanceAccess(actor.roles)) {
      throw new AppError(403, "You are not allowed to submit payment proof for this registration.");
    }

    if (registration.paymentState === RegistrationPaymentState.VERIFIED) {
      throw new AppError(409, "This registration has already been verified.");
    }

    if (registration.paymentState === RegistrationPaymentState.PENDING_VERIFICATION) {
      throw new AppError(409, "A payment proof is already pending verification for this registration.");
    }

    const pendingProof = await paymentsRepository.findPendingPaymentProofForRegistration(registrationId);

    if (pendingProof) {
      throw new AppError(409, "A payment proof is already pending verification for this registration.");
    }

    const transactionReference = sanitizeOptionalText(input.transactionReference);
    const referenceText = sanitizeOptionalText(input.referenceText);

    if (!transactionReference && !referenceText && !file) {
      throw new AppError(400, "Provide a transaction reference, reference text, or a proof file.");
    }

    const storedUpload = file ? await storeUpload(file, "PAYMENT_PROOF") : undefined;

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

        if (storedUpload) {
          await paymentsRepository.createSupportingDocument(
            {
              category: storedUpload.category,
              originalName: storedUpload.originalName,
              mimeType: storedUpload.mimeType,
              storedName: storedUpload.storedName,
              relativePath: storedUpload.relativePath,
              sizeBytes: BigInt(storedUpload.sizeBytes),
              uploadedById: actor.id,
              paymentProofId: createdProof.id,
            },
            tx,
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
      await cleanupStoredUpload(storedUpload);
      throw error;
    }
  },

  async listVerificationQueue(viewer: AuthenticatedUser, filters: PaymentVerificationQueueFilters) {
    assertFinancePermissions(viewer);

    const queue = await paymentsRepository.listPendingVerificationQueue(filters);
    return queue.map(mapPaymentVerificationQueueItem);
  },

  async decidePaymentProof(
    actor: AuthenticatedUser,
    paymentProofId: string,
    input: PaymentProofDecisionInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertFinancePermissions(actor);

    const paymentProof = await paymentsRepository.findPaymentProofById(paymentProofId);

    if (!paymentProof) {
      throw new AppError(404, "Payment proof not found.");
    }

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
    file: Express.Multer.File | undefined,
    auditMetadata?: AuditMetadata,
  ) {
    assertFinancePermissions(actor);

    const event = await eventsRepository.findById(input.eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    const referenceText = sanitizeOptionalText(input.referenceText);

    if (!referenceText && !file) {
      throw new AppError(400, "Provide a reference note or an evidence file for the income record.");
    }

    const storedUpload = file ? await storeUpload(file, "SUPPORTING_DOCUMENT") : undefined;

    try {
      const incomeRecord = await prisma.$transaction(async (tx) => {
        const createdIncomeRecord = await paymentsRepository.createIncomeRecord(actor.id, {
          ...input,
          referenceText,
        }, tx);

        if (storedUpload) {
          await paymentsRepository.createSupportingDocument(
            {
              category: storedUpload.category,
              originalName: storedUpload.originalName,
              mimeType: storedUpload.mimeType,
              storedName: storedUpload.storedName,
              relativePath: storedUpload.relativePath,
              sizeBytes: BigInt(storedUpload.sizeBytes),
              uploadedById: actor.id,
              incomeRecordId: createdIncomeRecord.id,
            },
            tx,
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
      await cleanupStoredUpload(storedUpload);
      throw error;
    }
  },

  async listIncomeRecords(viewer: AuthenticatedUser, filters: IncomeRecordFilters) {
    assertFinancePermissions(viewer);

    const incomeRecords = await paymentsRepository.listIncomeRecords(filters);
    return incomeRecords.map(mapIncomeRecord);
  },

  async getIncomeRecordById(viewer: AuthenticatedUser, incomeRecordId: string) {
    assertFinancePermissions(viewer);

    const incomeRecord = await paymentsRepository.findIncomeRecordById(incomeRecordId);

    if (!incomeRecord) {
      throw new AppError(404, "Income record not found.");
    }

    return mapIncomeRecord(incomeRecord);
  },
};
