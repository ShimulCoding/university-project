import type { ReconciliationState } from "@prisma/client";

export type ReconciliationFilters = {
  eventId?: string | undefined;
  status?: ReconciliationState | undefined;
};

export type GenerateReconciliationInput = {
  eventId: string;
};

export type ReconciliationWarning = {
  code: string;
  severity: "info" | "warning";
  message: string;
  count?: number | undefined;
};

export type ReconciliationBreakdown = {
  verifiedRegistrationIncome: string;
  manualIncome: string;
  settledExpense: string;
  verifiedPaymentProofCount: number;
  verifiedPaymentProofsMissingAmount: number;
  manualIncomeRecordCount: number;
  unverifiedManualIncomeRecordCount: number;
  settledExpenseRecordCount: number;
  pendingExpenseRecordCount: number;
  approvedExpenseRequestsWithoutSettledRecord: number;
};

export type ReconciliationPayload = {
  warnings: ReconciliationWarning[];
  breakdown: ReconciliationBreakdown;
};
