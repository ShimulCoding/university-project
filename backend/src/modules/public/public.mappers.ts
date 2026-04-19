import { Prisma } from "@prisma/client";

import type {
  PublicFinancialSummaryBreakdownLine,
  PublicFinancialSummaryPayload,
} from "./types/public.types";

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

  const incomeBreakdown = parseBreakdownLines(payload.incomeBreakdown);
  const expenseBreakdown = parseBreakdownLines(payload.expenseBreakdown);
  const registrationIncome = String(payload.breakdown?.registrationIncome ?? "0.00");
  const manualIncome = String(payload.breakdown?.manualIncome ?? "0.00");
  const settledExpense = String(payload.breakdown?.settledExpense ?? "0.00");

  return {
    basis: "FINALIZED_RECONCILIATION",
    summaryOnly: true,
    breakdown: {
      registrationIncome,
      manualIncome,
      settledExpense,
    },
    incomeBreakdown:
      incomeBreakdown.length > 0
        ? incomeBreakdown
        : buildFallbackIncomeBreakdown(registrationIncome, manualIncome),
    expenseBreakdown:
      expenseBreakdown.length > 0
        ? expenseBreakdown
        : buildFallbackExpenseBreakdown(settledExpense),
  };
}

function parseBreakdownLines(value: unknown): PublicFinancialSummaryBreakdownLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((line, index) => {
      if (!line || typeof line !== "object" || Array.isArray(line)) {
        return null;
      }

      const record = line as Record<string, unknown>;

      return {
        key: String(record.key ?? `line-${index}`),
        label: String(record.label ?? "Unlabeled segment"),
        segment: String(record.segment ?? "OTHER"),
        amount: String(record.amount ?? "0.00"),
        recordCount: Number(record.recordCount ?? 0),
      };
    })
    .filter((line): line is PublicFinancialSummaryBreakdownLine => line !== null);
}

function buildFallbackIncomeBreakdown(
  registrationIncome: string,
  manualIncome: string,
): PublicFinancialSummaryBreakdownLine[] {
  return [
    {
      key: "student-registration",
      label: "Student registration fees",
      segment: "REGISTRATION",
      amount: registrationIncome,
      recordCount: 0,
    },
    {
      key: "manual-income",
      label: "Manual income records",
      segment: "MANUAL",
      amount: manualIncome,
      recordCount: 0,
    },
  ].filter((line) => Number(line.amount) > 0);
}

function buildFallbackExpenseBreakdown(
  settledExpense: string,
): PublicFinancialSummaryBreakdownLine[] {
  return [
    {
      key: "settled-expenses",
      label: "Settled expense records",
      segment: "SETTLED_EXPENSE",
      amount: settledExpense,
      recordCount: 0,
    },
  ].filter((line) => Number(line.amount) > 0);
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
