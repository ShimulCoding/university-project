import type { EventStatus, ReconciliationState } from "@prisma/client";

import type { PaginationInput } from "../../../utils/pagination";

export type ReconciliationFilters = PaginationInput & {
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

export type ReconciliationEventSnapshot = {
  eventId: string;
  status: EventStatus;
  updatedAt: string;
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

export type ReconciliationBreakdownLine = {
  key: string;
  label: string;
  segment: string;
  amount: string;
  recordCount: number;
};

export type ReconciliationPayload = {
  eventSnapshot?: ReconciliationEventSnapshot | undefined;
  warnings: ReconciliationWarning[];
  breakdown: ReconciliationBreakdown;
  incomeBreakdown: ReconciliationBreakdownLine[];
  expenseBreakdown: ReconciliationBreakdownLine[];
};
