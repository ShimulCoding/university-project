export const paymentsService = {
  getOverview() {
    return {
      module: "payments",
      status: "scaffolded",
      responsibilities: [
        "external payment proof intake",
        "verification queue",
        "manual finance-side verification",
      ],
    };
  },
};

