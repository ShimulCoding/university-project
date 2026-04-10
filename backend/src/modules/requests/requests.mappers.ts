import { Prisma } from "@prisma/client";

export const safeSupportingDocumentSelect = Prisma.validator<Prisma.SupportingDocumentSelect>()({
  id: true,
  category: true,
  originalName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
});

const actorSummarySelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  fullName: true,
  email: true,
});

const approvalDecisionInclude = {
  actor: {
    select: actorSummarySelect,
  },
  orderBy: {
    createdAt: "asc",
  },
} as const;

export const budgetRequestDetailInclude = Prisma.validator<Prisma.BudgetRequestInclude>()({
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  },
  requestedBy: {
    select: actorSummarySelect,
  },
  documents: {
    select: safeSupportingDocumentSelect,
  },
  approvalDecisions: {
    include: {
      actor: {
        select: actorSummarySelect,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
});

export const expenseRequestDetailInclude = Prisma.validator<Prisma.ExpenseRequestInclude>()({
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  },
  requestedBy: {
    select: actorSummarySelect,
  },
  documents: {
    select: safeSupportingDocumentSelect,
  },
  approvalDecisions: {
    include: {
      actor: {
        select: actorSummarySelect,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
  expenseRecords: {
    select: {
      id: true,
      amount: true,
      category: true,
      state: true,
      paidAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  },
});

export const expenseRecordDetailInclude = Prisma.validator<Prisma.ExpenseRecordInclude>()({
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  },
  recordedBy: {
    select: actorSummarySelect,
  },
  documents: {
    select: safeSupportingDocumentSelect,
  },
  expenseRequest: {
    include: {
      requestedBy: {
        select: actorSummarySelect,
      },
    },
  },
});

export type BudgetRequestWithContext = Prisma.BudgetRequestGetPayload<{
  include: typeof budgetRequestDetailInclude;
}>;

export type ExpenseRequestWithContext = Prisma.ExpenseRequestGetPayload<{
  include: typeof expenseRequestDetailInclude;
}>;

export type ExpenseRecordWithContext = Prisma.ExpenseRecordGetPayload<{
  include: typeof expenseRecordDetailInclude;
}>;

function mapSafeDocument(
  document:
    | BudgetRequestWithContext["documents"][number]
    | ExpenseRequestWithContext["documents"][number]
    | ExpenseRecordWithContext["documents"][number],
) {
  return {
    id: document.id,
    category: document.category,
    originalName: document.originalName,
    mimeType: document.mimeType,
    sizeBytes: Number(document.sizeBytes),
    createdAt: document.createdAt,
    viewPath: `/documents/${document.id}/open`,
  };
}

function mapDecision(
  decision:
    | BudgetRequestWithContext["approvalDecisions"][number]
    | ExpenseRequestWithContext["approvalDecisions"][number],
) {
  return {
    id: decision.id,
    entityType: decision.entityType,
    decision: decision.decision,
    comment: decision.comment ?? null,
    createdAt: decision.createdAt,
    actor: {
      id: decision.actor.id,
      fullName: decision.actor.fullName,
      email: decision.actor.email,
    },
  };
}

function mapEventSummary(
  event:
    | BudgetRequestWithContext["event"]
    | ExpenseRequestWithContext["event"]
    | ExpenseRecordWithContext["event"],
) {
  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    status: event.status,
  };
}

function mapRequestedBy(
  requestedBy: BudgetRequestWithContext["requestedBy"] | ExpenseRequestWithContext["requestedBy"],
) {
  return requestedBy
    ? {
        id: requestedBy.id,
        fullName: requestedBy.fullName,
        email: requestedBy.email,
      }
    : null;
}

export function mapBudgetRequest(request: BudgetRequestWithContext) {
  return {
    id: request.id,
    amount: request.amount.toString(),
    purpose: request.purpose,
    justification: request.justification ?? null,
    state: request.state,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    event: mapEventSummary(request.event),
    requestedBy: mapRequestedBy(request.requestedBy),
    documents: request.documents.map(mapSafeDocument),
    approvalDecisions: request.approvalDecisions.map(mapDecision),
  };
}

export function mapExpenseRequest(request: ExpenseRequestWithContext) {
  return {
    id: request.id,
    amount: request.amount.toString(),
    category: request.category,
    purpose: request.purpose,
    justification: request.justification ?? null,
    state: request.state,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    event: mapEventSummary(request.event),
    requestedBy: mapRequestedBy(request.requestedBy),
    documents: request.documents.map(mapSafeDocument),
    approvalDecisions: request.approvalDecisions.map(mapDecision),
    expenseRecords: request.expenseRecords.map((record) => ({
      id: record.id,
      amount: record.amount.toString(),
      category: record.category,
      state: record.state,
      paidAt: record.paidAt ?? null,
      createdAt: record.createdAt,
    })),
  };
}

export function mapExpenseRecord(record: ExpenseRecordWithContext) {
  return {
    id: record.id,
    amount: record.amount.toString(),
    category: record.category,
    description: record.description,
    state: record.state,
    paidAt: record.paidAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    event: mapEventSummary(record.event),
    recordedBy: record.recordedBy
      ? {
          id: record.recordedBy.id,
          fullName: record.recordedBy.fullName,
          email: record.recordedBy.email,
        }
      : null,
    expenseRequest: record.expenseRequest
      ? {
          id: record.expenseRequest.id,
          amount: record.expenseRequest.amount.toString(),
          category: record.expenseRequest.category,
          purpose: record.expenseRequest.purpose,
          state: record.expenseRequest.state,
          requestedBy: record.expenseRequest.requestedBy
            ? {
                id: record.expenseRequest.requestedBy.id,
                fullName: record.expenseRequest.requestedBy.fullName,
                email: record.expenseRequest.requestedBy.email,
              }
            : null,
        }
      : null,
    documents: record.documents.map(mapSafeDocument),
  };
}
