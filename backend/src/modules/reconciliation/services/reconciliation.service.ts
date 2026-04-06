export const reconciliationService = {
  getOverview() {
    return {
      module: "reconciliation",
      status: "scaffolded",
      responsibilities: [
        "verified registration income aggregation",
        "manual income record aggregation",
        "expense record aggregation",
        "public summary readiness",
      ],
    };
  },
};

