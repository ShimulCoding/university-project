import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import morgan from "morgan";

// Log an allow-list of server-owned fields. Request bodies, query strings,
// arbitrary paths, exception messages/stacks and mail capabilities stay private.
export const requestReference: RequestHandler = (_request, response, next) => {
  response.locals.requestId = randomUUID();
  response.setHeader("X-Request-Id", response.locals.requestId);
  next();
};

export const requestLogger = morgan<Request, Response>((tokens, request, response) => JSON.stringify({
  event: "http.request",
  requestId: response.locals.requestId,
  method: tokens.method?.(request, response),
  route: typeof request.route?.path === "string" ? request.route.path : "unmatched",
  status: Number(tokens.status?.(request, response)) || 0,
  durationMs: Number(tokens["response-time"]?.(request, response)) || 0,
}));

export function logInternalFailure(event: "api.failure" | "startup.failure" | "token.cleanup.failure", requestId?: string) {
  console.error(JSON.stringify({ event, ...(requestId ? { requestId } : {}) }));
}
