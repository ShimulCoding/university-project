import { Prisma } from "@prisma/client";

const safeSupportingDocumentSelect = Prisma.validator<Prisma.SupportingDocumentSelect>()({
  id: true,
  category: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
});

export const registrationDetailInclude = Prisma.validator<Prisma.RegistrationInclude>()({
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
      registrationOpensAt: true,
      registrationClosesAt: true,
      startsAt: true,
      endsAt: true,
      capacity: true,
    },
  },
  paymentProofs: {
    orderBy: {
      submittedAt: "desc",
    },
    include: {
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
    },
  },
});

export type RegistrationWithContext = Prisma.RegistrationGetPayload<{
  include: typeof registrationDetailInclude;
}>;

function mapSafeDocument(document: RegistrationWithContext["paymentProofs"][number]["documents"][number]) {
  return {
    id: document.id,
    category: document.category,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: Number(document.sizeBytes),
    createdAt: document.createdAt,
  };
}

function maskReference(reference: string | null) {
  if (!reference) {
    return null;
  }

  if (reference.length <= 4) {
    return "*".repeat(reference.length);
  }

  return `${"*".repeat(reference.length - 4)}${reference.slice(-4)}`;
}

function mapEventSummary(registration: RegistrationWithContext) {
  return {
    id: registration.event.id,
    title: registration.event.title,
    slug: registration.event.slug,
    status: registration.event.status,
    registrationOpensAt: registration.event.registrationOpensAt ?? null,
    registrationClosesAt: registration.event.registrationClosesAt ?? null,
    startsAt: registration.event.startsAt ?? null,
    endsAt: registration.event.endsAt ?? null,
    capacity: registration.event.capacity ?? null,
  };
}

function buildBaseRegistrationShape(registration: RegistrationWithContext) {
  return {
    id: registration.id,
    registrationCode: registration.registrationCode,
    paymentState: registration.paymentState,
    participantName: registration.participantName,
    studentId: registration.studentId,
    email: registration.email,
    phone: registration.phone ?? null,
    createdAt: registration.createdAt,
    updatedAt: registration.updatedAt,
    event: mapEventSummary(registration),
  };
}

export function mapRegistrationForOwner(registration: RegistrationWithContext) {
  return {
    ...buildBaseRegistrationShape(registration),
    paymentProofs: registration.paymentProofs.map((proof) => ({
      id: proof.id,
      externalChannel: proof.externalChannel,
      transactionReference: maskReference(proof.transactionReference ?? null),
      referenceText: proof.referenceText ?? null,
      amount: proof.amount ? proof.amount.toString() : null,
      state: proof.state,
      submittedAt: proof.submittedAt,
      reviewedAt: proof.reviewedAt ?? null,
      reviewerRemark: proof.reviewerRemark ?? null,
      hasDocument: proof.documents.length > 0,
      documentCount: proof.documents.length,
    })),
  };
}

export function mapRegistrationForInternal(registration: RegistrationWithContext) {
  const latestPaymentProof = registration.paymentProofs[0] ?? null;

  return {
    ...buildBaseRegistrationShape(registration),
    participant: registration.participant
      ? {
          id: registration.participant.id,
          fullName: registration.participant.fullName,
          email: registration.participant.email,
        }
      : null,
    paymentProofCount: registration.paymentProofs.length,
    latestPaymentProof: latestPaymentProof
      ? {
          id: latestPaymentProof.id,
          state: latestPaymentProof.state,
          submittedAt: latestPaymentProof.submittedAt,
          reviewedAt: latestPaymentProof.reviewedAt ?? null,
          hasDocument: latestPaymentProof.documents.length > 0,
        }
      : null,
  };
}

export function mapRegistrationForFinance(registration: RegistrationWithContext) {
  return {
    ...buildBaseRegistrationShape(registration),
    participant: registration.participant
      ? {
          id: registration.participant.id,
          fullName: registration.participant.fullName,
          email: registration.participant.email,
        }
      : null,
    paymentProofs: registration.paymentProofs.map((proof) => ({
      id: proof.id,
      externalChannel: proof.externalChannel,
      transactionReference: proof.transactionReference ?? null,
      referenceText: proof.referenceText ?? null,
      amount: proof.amount ? proof.amount.toString() : null,
      state: proof.state,
      submittedAt: proof.submittedAt,
      reviewedAt: proof.reviewedAt ?? null,
      reviewerRemark: proof.reviewerRemark ?? null,
      reviewedBy: proof.reviewedBy
        ? {
            id: proof.reviewedBy.id,
            fullName: proof.reviewedBy.fullName,
            email: proof.reviewedBy.email,
          }
        : null,
      documents: proof.documents.map(mapSafeDocument),
    })),
  };
}

export function mapRegistrationListItem(
  registration: RegistrationWithContext,
  financeView: boolean,
) {
  const latestPaymentProof = registration.paymentProofs[0] ?? null;

  return {
    ...buildBaseRegistrationShape(registration),
    participant: registration.participant
      ? {
          id: registration.participant.id,
          fullName: registration.participant.fullName,
          email: registration.participant.email,
        }
      : null,
    paymentProofCount: registration.paymentProofs.length,
    latestPaymentProof: latestPaymentProof
      ? {
          id: latestPaymentProof.id,
          state: latestPaymentProof.state,
          submittedAt: latestPaymentProof.submittedAt,
          reviewedAt: latestPaymentProof.reviewedAt ?? null,
          transactionReference: financeView
            ? latestPaymentProof.transactionReference ?? null
            : maskReference(latestPaymentProof.transactionReference ?? null),
        }
      : null,
  };
}
