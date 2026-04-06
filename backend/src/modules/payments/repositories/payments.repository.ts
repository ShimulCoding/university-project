import { Prisma, type DocumentCategory, type PaymentProofState } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import {
  incomeRecordDetailInclude,
  paymentProofDetailInclude,
} from "../payments.mappers";
import type {
  CreateIncomeRecordInput,
  PaymentVerificationQueueFilters,
  SubmitPaymentProofInput,
} from "../types/payments.types";

type CreateSupportingDocumentData = {
  category: DocumentCategory;
  originalName: string;
  mimeType: string;
  storedName: string;
  relativePath: string;
  sizeBytes: bigint;
  uploadedById: string;
  paymentProofId?: string | undefined;
  incomeRecordId?: string | undefined;
};

type UpdatePaymentProofReviewData = {
  state: PaymentProofState;
  reviewedAt: Date;
  reviewerRemark?: string | undefined;
  reviewedById: string;
};

function buildQueueWhere(filters: PaymentVerificationQueueFilters): Prisma.PaymentProofWhereInput {
  const where: Prisma.PaymentProofWhereInput = {
    state: "PENDING_VERIFICATION",
  };

  if (filters.eventId) {
    where.registration = {
      eventId: filters.eventId,
    };
  }

  const trimmedSearch = filters.search?.trim();

  if (trimmedSearch) {
    where.OR = [
      {
        registration: {
          participantName: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
      },
      {
        registration: {
          studentId: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
      },
      {
        registration: {
          email: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
      },
      {
        transactionReference: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
      {
        referenceText: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}

function buildIncomeWhere(filters: { eventId?: string | undefined; search?: string | undefined }): Prisma.IncomeRecordWhereInput {
  const where: Prisma.IncomeRecordWhereInput = {};

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  const trimmedSearch = filters.search?.trim();

  if (trimmedSearch) {
    where.OR = [
      {
        sourceLabel: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
      {
        referenceText: {
          contains: trimmedSearch,
          mode: "insensitive",
        },
      },
    ];
  }

  return where;
}

export const paymentsRepository = {
  findPendingPaymentProofForRegistration(registrationId: string, db: DbClient = prisma) {
    return db.paymentProof.findFirst({
      where: {
        registrationId,
        state: "PENDING_VERIFICATION",
      },
      include: paymentProofDetailInclude,
    });
  },

  findPaymentProofById(paymentProofId: string, db: DbClient = prisma) {
    return db.paymentProof.findUnique({
      where: { id: paymentProofId },
      include: paymentProofDetailInclude,
    });
  },

  createPaymentProof(
    registrationId: string,
    input: SubmitPaymentProofInput,
    db: DbClient = prisma,
  ) {
    return db.paymentProof.create({
      data: {
        registrationId,
        externalChannel: input.externalChannel.trim(),
        ...(input.transactionReference ? { transactionReference: input.transactionReference } : {}),
        ...(input.referenceText ? { referenceText: input.referenceText } : {}),
        ...(input.amount ? { amount: input.amount } : {}),
      },
    });
  },

  updatePaymentProofReview(
    paymentProofId: string,
    data: UpdatePaymentProofReviewData,
    db: DbClient = prisma,
  ) {
    return db.paymentProof.update({
      where: { id: paymentProofId },
      data: {
        state: data.state,
        reviewedAt: data.reviewedAt,
        reviewedById: data.reviewedById,
        ...(data.reviewerRemark ? { reviewerRemark: data.reviewerRemark } : {}),
      },
    });
  },

  listPendingVerificationQueue(filters: PaymentVerificationQueueFilters, db: DbClient = prisma) {
    return db.paymentProof.findMany({
      where: buildQueueWhere(filters),
      include: paymentProofDetailInclude,
      orderBy: {
        submittedAt: "asc",
      },
    });
  },

  createSupportingDocument(data: CreateSupportingDocumentData, db: DbClient = prisma) {
    return db.supportingDocument.create({
      data: {
        category: data.category,
        originalName: data.originalName,
        mimeType: data.mimeType,
        storedName: data.storedName,
        relativePath: data.relativePath,
        sizeBytes: data.sizeBytes,
        uploadedById: data.uploadedById,
        ...(data.paymentProofId ? { paymentProofId: data.paymentProofId } : {}),
        ...(data.incomeRecordId ? { incomeRecordId: data.incomeRecordId } : {}),
      },
    });
  },

  createIncomeRecord(
    actorId: string,
    input: CreateIncomeRecordInput,
    db: DbClient = prisma,
  ) {
    return db.incomeRecord.create({
      data: {
        eventId: input.eventId,
        sourceType: input.sourceType,
        sourceLabel: input.sourceLabel.trim(),
        amount: input.amount,
        recordedById: actorId,
        ...(input.referenceText ? { referenceText: input.referenceText } : {}),
        ...(input.collectedAt ? { collectedAt: input.collectedAt } : {}),
      },
    });
  },

  listIncomeRecords(
    filters: { eventId?: string | undefined; search?: string | undefined },
    db: DbClient = prisma,
  ) {
    return db.incomeRecord.findMany({
      where: buildIncomeWhere(filters),
      include: incomeRecordDetailInclude,
      orderBy: {
        createdAt: "desc",
      },
    });
  },

  findIncomeRecordById(incomeRecordId: string, db: DbClient = prisma) {
    return db.incomeRecord.findUnique({
      where: { id: incomeRecordId },
      include: incomeRecordDetailInclude,
    });
  },
};
