import type { NextFunction, Request, Response } from "express";
import type { RoleCode } from "@prisma/client";

import { prisma } from "../config/prisma";

export function authorize(...allowedRoles: RoleCode[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const roles = request.auth?.roles ?? [];
    const allowed = allowedRoles.some((role) => roles.includes(role));

    if (!allowed) {
      response.status(403).json({ message: "You are not allowed to perform this action." });
      return;
    }

    next();
  };
}

/**
 * Event-scoped authorization middleware.
 *
 * Allows access when:
 *   1. The user holds one of `allowedRoles` globally (UserRole), OR
 *   2. The user has an active EventTeamMember assignment for the target
 *      event with a roleCode that is in `allowedRoles`.
 *
 * The target event is resolved from `req.params[eventIdParam]`, then
 * from `req.query.eventId`, and finally from `req.body.eventId`.
 *
 * System admins always pass (they hold SYSTEM_ADMIN globally).
 */
export function authorizeEventScoped(
  allowedRoles: RoleCode[],
  eventIdParam = "eventLookupKey",
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const globalRoles = request.auth?.roles ?? [];

    // Global role holders always pass (includes SYSTEM_ADMIN)
    if (allowedRoles.some((role) => globalRoles.includes(role))) {
      return next();
    }

    const rawEventRef =
      request.params[eventIdParam] ||
      (typeof request.query.eventId === "string" ? request.query.eventId : undefined) ||
      (typeof request.body?.eventId === "string" ? request.body.eventId : undefined);

    const eventRef = typeof rawEventRef === "string" ? rawEventRef : undefined;

    if (!eventRef) {
      // No event context — fall back to global role check (already failed above)
      response
        .status(403)
        .json({ message: "You are not allowed to perform this action." });
      return;
    }

    // Resolve eventId from slug or cuid
    const event = await prisma.event.findFirst({
      where: {
        OR: [{ id: eventRef }, { slug: eventRef }],
      },
      select: { id: true },
    });

    if (!event) {
      response.status(404).json({ message: "Event not found." });
      return;
    }

    // Check EventTeamMember assignments
    const eventRoles = request.auth?.user?.eventRoles ?? [];
    const hasEventRole = eventRoles.some(
      (assignment) =>
        assignment.eventId === event.id &&
        allowedRoles.includes(assignment.roleCode as RoleCode),
    );

    if (hasEventRole) {
      return next();
    }

    response
      .status(403)
      .json({ message: "You are not assigned to this event with the required role." });
  };
}
