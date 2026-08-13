import type { NextFunction, Request, Response } from "express";
import type { RoleCode } from "@prisma/client";

import { prisma } from "../config/prisma";

/**
 * Global role authorization middleware.
 *
 * Use ONLY for System Admin governance endpoints (event creation,
 * user management, audit). For event-scoped operations, use
 * authorizeEventScoped() instead.
 */
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
 *   1. The user holds SYSTEM_ADMIN globally (governance read-only access), OR
 *   2. The user has an active EventTeamMember assignment for the target
 *      event with a roleCode that is in `allowedRoles`.
 *
 * IMPORTANT: Global operational roles (EVENT_ADMIN, FINANCIAL_CONTROLLER,
 * ORGANIZATIONAL_APPROVER, EVENT_MANAGEMENT_USER) do NOT grant access
 * through this middleware. Only event-specific team assignments count.
 *
 * The target event is resolved from `req.params[eventIdParam]`, then
 * from `req.query.eventId`, and finally from `req.body.eventId`.
 */
export function authorizeEventScoped(
  allowedRoles: RoleCode[],
  eventIdParam = "eventLookupKey",
) {
  return async (request: Request, response: Response, next: NextFunction) => {
    const globalRoles = request.auth?.roles ?? [];

    // System Admin always passes — they have governance/oversight access
    if (globalRoles.includes("SYSTEM_ADMIN" as RoleCode)) {
      return next();
    }

    const rawEventRef =
      request.params[eventIdParam] ||
      (typeof request.query.eventId === "string" ? request.query.eventId : undefined) ||
      (typeof request.body?.eventId === "string" ? request.body.eventId : undefined);

    const eventRef = typeof rawEventRef === "string" ? rawEventRef : undefined;

    if (!eventRef) {
      // No event context — check if user has ANY event assignment with one of the allowed roles
      const eventRoles = request.auth?.user?.eventRoles ?? [];
      const hasAnyAssignment = eventRoles.some(
        (assignment) => allowedRoles.includes(assignment.roleCode as RoleCode),
      );

      if (hasAnyAssignment) {
        return next();
      }

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

    // Check EventTeamMember assignments ONLY — no global role fallback
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
