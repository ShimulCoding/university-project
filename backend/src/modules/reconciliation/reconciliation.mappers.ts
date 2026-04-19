import { EventStatus, Prisma } from "@prisma/client";

import type { ReconciliationPayload } from "./types/reconciliation.types";

const actorSummarySelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  fullName: true,
  email: true,
});

export const reconciliationReportDetailInclude = Prisma.validator<Prisma.ReconciliationReportInclude>()({
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      updatedAt: true,
    },
  },
  generatedBy: {
    select: actorSummarySelect,
  },
  reviewedBy: {
    select: actorSummarySelect,
  },
  publicSummarySnapshots: {
    select: {
      id: true,
      status: true,
      publishedAt: true,
    },
    orderBy: {
      publishedAt: "desc",
    },
  },
});

export type ReconciliationReportWithContext = Prisma.ReconciliationReportGetPayload<{
  include: typeof reconciliationReportDetailInclude;
}>;

const emptyPayload: ReconciliationPayload = {
  eventSnapshot: undefined,
  warnings: [],
  breakdown: {
    verifiedRegistrationIncome: "0.00",
    manualIncome: "0.00",
    settledExpense: "0.00",
    verifiedPaymentProofCount: 0,
    verifiedPaymentProofsMissingAmount: 0,
    manualIncomeRecordCount: 0,
    unverifiedManualIncomeRecordCount: 0,
    settledExpenseRecordCount: 0,
    pendingExpenseRecordCount: 0,
    approvedExpenseRequestsWithoutSettledRecord: 0,
  },
  incomeBreakdown: [],
  expenseBreakdown: [],
};

function parseEventSnapshot(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const snapshot = value as Record<string, unknown>;

  if (
    typeof snapshot.eventId !== "string" ||
    typeof snapshot.status !== "string" ||
    typeof snapshot.updatedAt !== "string" ||
    !Object.values(EventStatus).includes(snapshot.status as EventStatus)
  ) {
    return undefined;
  }

  return {
    eventId: snapshot.eventId,
    status: snapshot.status as EventStatus,
    updatedAt: snapshot.updatedAt,
  };
}

function parsePayload(value: Prisma.JsonValue | null): ReconciliationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyPayload;
  }

  const payload = value as Partial<ReconciliationPayload>;

  return {
    eventSnapshot: parseEventSnapshot(payload.eventSnapshot),
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    breakdown: {
      ...emptyPayload.breakdown,
      ...(payload.breakdown && typeof payload.breakdown === "object"
        ? payload.breakdown
        : {}),
    },
    incomeBreakdown: Array.isArray(payload.incomeBreakdown) ? payload.incomeBreakdown : [],
    expenseBreakdown: Array.isArray(payload.expenseBreakdown) ? payload.expenseBreakdown : [],
  };
}

function mapActor(actor: ReconciliationReportWithContext["generatedBy"]) {
  return actor
    ? {
        id: actor.id,
        fullName: actor.fullName,
        email: actor.email,
      }
    : null;
}

export function mapReconciliationReport(report: ReconciliationReportWithContext) {
  const payload = parsePayload(report.payload);

  return {
    id: report.id,
    status: report.status,
    totalIncome: report.totalIncome.toString(),
    totalExpense: report.totalExpense.toString(),
    closingBalance: report.closingBalance.toString(),
    isStale: report.isStale,
    staleReason: report.staleReason ?? null,
    staledAt: report.staledAt ?? null,
    warnings: payload.warnings,
    breakdown: payload.breakdown,
    incomeBreakdown: payload.incomeBreakdown,
    expenseBreakdown: payload.expenseBreakdown,
    createdAt: report.createdAt,
    finalizedAt: report.finalizedAt ?? null,
    event: {
      id: report.event.id,
      title: report.event.title,
      slug: report.event.slug,
      status: report.event.status,
      updatedAt: report.event.updatedAt,
    },
    generatedBy: mapActor(report.generatedBy),
    reviewedBy: mapActor(report.reviewedBy),
    publicSummarySnapshots: report.publicSummarySnapshots.map((snapshot) => ({
      id: snapshot.id,
      status: snapshot.status,
      publishedAt: snapshot.publishedAt ?? null,
    })),
  };
}

export function getReconciliationPayload(report: ReconciliationReportWithContext) {
  return parsePayload(report.payload);
}
