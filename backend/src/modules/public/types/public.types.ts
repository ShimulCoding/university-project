export type PublicSummaryFilters = {
  search?: string | undefined;
};

export type PublicFinancialSummaryPayload = {
  basis: "FINALIZED_RECONCILIATION";
  summaryOnly: true;
  breakdown: {
    registrationIncome: string;
    manualIncome: string;
    settledExpense: string;
  };
};
