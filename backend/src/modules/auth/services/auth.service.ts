export const authService = {
  getOverview() {
    return {
      module: "auth",
      status: "scaffolded",
      responsibilities: ["credentials login", "refresh token rotation", "logout", "current user bootstrap"],
    };
  },
};

