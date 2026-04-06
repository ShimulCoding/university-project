import { Prisma } from "@prisma/client";

import type { PublicFinancialSummaryPayload } from "./types/public.types";

export const publicSummaryDetailInclude = Prisma.validator<Prisma.PublicSummarySnapshotInclude>()({
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  },
  reconciliationReport: {
    select: {
      id: true,
      status: true,
      finalizedAt: true,
      createdAt: true,
    },
  },
});

export type PublicSummarySnapshotWithContext = Prisma.PublicSummarySnapshotGetPayload<{
  include: typeof publicSummaryDetailInclude;
}>;

function parsePayload(value: Prisma.JsonValue | null): PublicFinancialSummaryPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const payload = value as Partial<PublicFinancialSummaryPayload>;

  if (payload.basis !== "FINALIZED_RECONCILIATION" || payload.summaryOnly !== true) {
    return null;
  }

  return {
    basis: "FINALIZED_RECONCILIATION",
    summaryOnly: true,
    breakdown: {
      registrationIncome: String(payload.breakdown?.registrationIncome ?? "0.00"),
      manualIncome: String(payload.breakdown?.manualIncome ?? "0.00"),
      settledExpense: String(payload.breakdown?.settledExpense ?? "0.00"),
    },
  };
}

export function mapPublicFinancialSummary(snapshot: PublicSummarySnapshotWithContext) {
  return {
    id: snapshot.id,
    status: snapshot.status,
    publishedAt: snapshot.publishedAt ?? null,
    totals: {
      collected: snapshot.totalCollected.toString(),
      spent: snapshot.totalSpent.toString(),
      closingBalance: snapshot.closingBalance.toString(),
    },
    event: {
      id: snapshot.event.id,
      title: snapshot.event.title,
      slug: snapshot.event.slug,
      status: snapshot.event.status,
    },
    reconciliation: {
      reportId: snapshot.reconciliationReport.id,
      status: snapshot.reconciliationReport.status,
      finalizedAt: snapshot.reconciliationReport.finalizedAt ?? null,
    },
    payload: parsePayload(snapshot.payload),
  };
}
