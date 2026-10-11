import type { RequestHandler } from "express";
import type { RoleCode } from "@prisma/client";
import rateLimit from "express-rate-limit";
import { AppError } from "../utils/app-error";
import { hasAnyEventScopedRole, isSystemAdmin } from "../utils/event-scope";

export function authorizeOperationalUpload(roles: RoleCode[]): RequestHandler {
  return (request, _response, next) => {
    const actor = request.auth?.user;
    if (!actor || isSystemAdmin(actor) || !hasAnyEventScopedRole(actor, roles)) {
      return next(new AppError(403, "You are not assigned to an event with upload access for this action."));
    }
    next();
  };
}

// Applied only after authenticate and cheap record/role preflight. Retain the
// existing fifteen-file allowance, but bound simultaneous memory allocations.
export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: (request) => request.auth!.userId,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many upload submissions. Please try again later." },
});

export function createUploadAdmission(maxConcurrent = 2): RequestHandler {
  let active = 0;
  return (_request, response, next) => {
    if (active >= maxConcurrent) {
      response.setHeader("Retry-After", "5");
      response.status(503).json({ message: "Uploads are busy. Please retry shortly." });
      return;
    }
    active++;
    let released = false;
    const release = () => { if (!released) { released = true; active--; } };
    response.once("finish", release);
    response.once("close", release);
    next();
  };
}

export const uploadAdmission = createUploadAdmission();
