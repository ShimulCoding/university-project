import type { Request } from "express";
import { sanitizeAuditMetadata } from "./audit-metadata";

export function getRequestMetadata(request: Request) {
  return sanitizeAuditMetadata({
    ipAddress: request.ip || undefined,
    userAgent: request.get("user-agent") || undefined,
    route: typeof request.route?.path === "string" ? request.route.path : "unmatched",
    method: request.method,
  });
}

