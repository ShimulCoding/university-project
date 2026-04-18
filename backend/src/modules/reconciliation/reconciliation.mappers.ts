import { Prisma } from "@prisma/client";

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
};

function parsePayload(value: Prisma.JsonValue | null): ReconciliationPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return emptyPayload;
  }

  const payload = value as Partial<ReconciliationPayload>;

  return {
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    breakdown: {
      ...emptyPayload.breakdown,
      ...(payload.breakdown && typeof payload.breakdown === "object"
        ? payload.breakdown
        : {}),
    },
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
    warnings: payload.warnings,
    breakdown: payload.breakdown,
    createdAt: report.createdAt,
    finalizedAt: report.finalizedAt ?? null,
    event: {
      id: report.event.id,
      title: report.event.title,
      slug: report.event.slug,
      status: report.event.status,
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
