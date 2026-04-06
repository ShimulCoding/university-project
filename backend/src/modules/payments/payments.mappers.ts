import { Prisma } from "@prisma/client";

const safeSupportingDocumentSelect = Prisma.validator<Prisma.SupportingDocumentSelect>()({
  id: true,
  category: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
});

export const paymentProofDetailInclude = Prisma.validator<Prisma.PaymentProofInclude>()({
  reviewedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  documents: {
    select: safeSupportingDocumentSelect,
  },
  registration: {
    include: {
      participant: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
        },
      },
    },
  },
});

export type PaymentProofWithContext = Prisma.PaymentProofGetPayload<{
  include: typeof paymentProofDetailInclude;
}>;

export const incomeRecordDetailInclude = Prisma.validator<Prisma.IncomeRecordInclude>()({
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  },
  recordedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  verifiedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  documents: {
    select: safeSupportingDocumentSelect,
  },
});

export type IncomeRecordWithContext = Prisma.IncomeRecordGetPayload<{
  include: typeof incomeRecordDetailInclude;
}>;

function mapSafeDocument(
  document:
    | PaymentProofWithContext["documents"][number]
    | IncomeRecordWithContext["documents"][number],
) {
  return {
    id: document.id,
    category: document.category,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: Number(document.sizeBytes),
    createdAt: document.createdAt,
  };
}

export function mapSubmittedPaymentProof(proof: PaymentProofWithContext) {
  return {
    id: proof.id,
    state: proof.state,
    externalChannel: proof.externalChannel,
    transactionReference: proof.transactionReference ?? null,
    referenceText: proof.referenceText ?? null,
    amount: proof.amount ? proof.amount.toString() : null,
    submittedAt: proof.submittedAt,
    registration: {
      id: proof.registration.id,
      registrationCode: proof.registration.registrationCode,
      paymentState: proof.registration.paymentState,
      event: {
        id: proof.registration.event.id,
        title: proof.registration.event.title,
        slug: proof.registration.event.slug,
        status: proof.registration.event.status,
      },
    },
    documents: proof.documents.map(mapSafeDocument),
  };
}

export function mapPaymentVerificationQueueItem(proof: PaymentProofWithContext) {
  return {
    id: proof.id,
    state: proof.state,
    externalChannel: proof.externalChannel,
    transactionReference: proof.transactionReference ?? null,
    referenceText: proof.referenceText ?? null,
    amount: proof.amount ? proof.amount.toString() : null,
    submittedAt: proof.submittedAt,
    registration: {
      id: proof.registration.id,
      registrationCode: proof.registration.registrationCode,
      paymentState: proof.registration.paymentState,
      participantName: proof.registration.participantName,
      studentId: proof.registration.studentId,
      email: proof.registration.email,
      phone: proof.registration.phone ?? null,
      participant: proof.registration.participant
        ? {
            id: proof.registration.participant.id,
            fullName: proof.registration.participant.fullName,
            email: proof.registration.participant.email,
          }
        : null,
    },
    event: {
      id: proof.registration.event.id,
      title: proof.registration.event.title,
      slug: proof.registration.event.slug,
      status: proof.registration.event.status,
    },
    documents: proof.documents.map(mapSafeDocument),
  };
}

export function mapReviewedPaymentProof(proof: PaymentProofWithContext) {
  return {
    ...mapPaymentVerificationQueueItem(proof),
    reviewedAt: proof.reviewedAt ?? null,
    reviewerRemark: proof.reviewerRemark ?? null,
    reviewedBy: proof.reviewedBy
      ? {
          id: proof.reviewedBy.id,
          fullName: proof.reviewedBy.fullName,
          email: proof.reviewedBy.email,
        }
      : null,
  };
}

export function mapIncomeRecord(record: IncomeRecordWithContext) {
  return {
    id: record.id,
    sourceType: record.sourceType,
    sourceLabel: record.sourceLabel,
    amount: record.amount.toString(),
    state: record.state,
    referenceText: record.referenceText ?? null,
    collectedAt: record.collectedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    event: {
      id: record.event.id,
      title: record.event.title,
      slug: record.event.slug,
      status: record.event.status,
    },
    recordedBy: record.recordedBy
      ? {
          id: record.recordedBy.id,
          fullName: record.recordedBy.fullName,
          email: record.recordedBy.email,
        }
      : null,
    verifiedBy: record.verifiedBy
      ? {
          id: record.verifiedBy.id,
          fullName: record.verifiedBy.fullName,
          email: record.verifiedBy.email,
        }
      : null,
    documents: record.documents.map(mapSafeDocument),
  };
}
