export const approvalsService = {
  getOverview() {
    return {
      module: "approvals",
      status: "scaffolded",
      responsibilities: ["approve", "reject", "return", "approval decision history"],
    };
  },
};

