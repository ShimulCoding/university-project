import type { Request } from "express";

export function getRequestMetadata(request: Request) {
  return {
    ipAddress: request.ip || undefined,
    userAgent: request.get("user-agent") || undefined,
    route: request.originalUrl,
    method: request.method,
  };
}

