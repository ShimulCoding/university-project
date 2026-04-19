import type { PaginationInput } from "../../../utils/pagination";

export type PublicSummaryFilters = PaginationInput & {
  search?: string | undefined;
};

export type PublicFinancialSummaryBreakdownLine = {
  key: string;
  label: string;
  segment: string;
  amount: string;
  recordCount: number;
};

export type PublicFinancialSummaryPayload = {
  basis: "FINALIZED_RECONCILIATION";
  summaryOnly: true;
  breakdown: {
    registrationIncome: string;
    manualIncome: string;
    settledExpense: string;
  };
  incomeBreakdown: PublicFinancialSummaryBreakdownLine[];
  expenseBreakdown: PublicFinancialSummaryBreakdownLine[];
};
