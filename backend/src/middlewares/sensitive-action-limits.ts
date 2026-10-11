import rateLimit from "express-rate-limit";
import type { Request } from "express";
import { createWorkAdmission } from "./resource-admission";

// Factories permit isolated, short-window verification. Runtime allowances are
// fixed below, keyed by the authenticated identity rather than a claimed header.
export function createSensitiveActionLimits(windowMs = 15 * 60 * 1000, limits = { mutations: 240, documents: 120, reports: 5 }) {
  const shared = { windowMs, standardHeaders: "draft-7" as const, legacyHeaders: false,
    keyGenerator: (request: Request) => request.auth!.userId };
  return {
    mutation: rateLimit({ ...shared, limit: limits.mutations,
      skip: (request) => !["POST", "PATCH", "PUT", "DELETE"].includes(request.method) || request.baseUrl.toLowerCase() === "/api/auth",
      message: { message: "Too many account actions. Please retry after the indicated time." },
    }),
    documents: rateLimit({ ...shared, limit: limits.documents, message: { message: "Too many protected file requests. Please retry after the indicated time." } }),
    reports: rateLimit({ ...shared, limit: limits.reports, message: { message: "Report generation limit reached. Please retry after the indicated time." } }),
  };
}

export const sensitiveActionLimits = createSensitiveActionLimits();
export const admitReport = createWorkAdmission(1, "Report generation is busy. Please retry shortly.");
