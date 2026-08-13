import { RoleCode } from "@prisma/client";

import type { AuthenticatedUser } from "../types/auth";
import { AppError } from "./app-error";

export type EventFilterScope = {
  eventId?: string | undefined;
  eventIds?: string[] | undefined;
};

export const eventScopedInternalRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.FINANCIAL_CONTROLLER,
  RoleCode.ORGANIZATIONAL_APPROVER,
  RoleCode.EVENT_MANAGEMENT_USER,
  RoleCode.COMPLAINT_REVIEW_AUTHORITY,
] as const;

export const globalAccountRoles = [
  RoleCode.SYSTEM_ADMIN,
  RoleCode.GENERAL_STUDENT,
] as const;

export function isGlobalAccountRole(roleCode: RoleCode) {
  return globalAccountRoles.some((allowedRole) => allowedRole === roleCode);
}

export function assertGlobalAccountRole(roleCode: RoleCode) {
  if (!isGlobalAccountRole(roleCode)) {
    throw new AppError(
      400,
      `${roleCode} is event-scoped and must be assigned through an event team.`,
    );
  }
}

export function isSystemAdmin(user: Pick<AuthenticatedUser, "roles">) {
  return user.roles.includes(RoleCode.SYSTEM_ADMIN);
}

export function getAssignedEventIds(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  allowedRoles: RoleCode[] = [...eventScopedInternalRoles],
  options: { includeSystemAdmin?: boolean } = {},
) {
  if (options.includeSystemAdmin !== false && isSystemAdmin(user)) {
    return undefined;
  }

  const allowedRoleSet = new Set(allowedRoles);
  return [
    ...new Set(
      user.eventRoles
        .filter((assignment) => allowedRoleSet.has(assignment.roleCode))
        .map((assignment) => assignment.eventId),
    ),
  ];
}

export function hasEventScopedRole(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
  allowedRoles: RoleCode[],
) {
  return user.eventRoles.some(
    (assignment) =>
      assignment.eventId === eventId && allowedRoles.includes(assignment.roleCode),
  );
}

export function hasAnyEventScopedRole(
  user: Pick<AuthenticatedUser, "eventRoles">,
  allowedRoles: RoleCode[],
) {
  return user.eventRoles.some((assignment) => allowedRoles.includes(assignment.roleCode));
}

export function assertEventScopedAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
  allowedRoles: RoleCode[],
  message = "You are not assigned to this event with the required role.",
) {
  if (!hasEventScopedRole(user, eventId, allowedRoles)) {
    throw new AppError(403, message);
  }
}

export function assertEventScopedOperationalAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
  allowedRoles: RoleCode[],
  message = "You are not assigned to this event with the required role.",
) {
  if (isSystemAdmin(user)) {
    throw new AppError(
      403,
      "System Admin access is reserved for governance and event setup; operational control belongs to the assigned event team.",
    );
  }

  assertEventScopedAccess(user, eventId, allowedRoles, message);
}

export function assertSystemAdminOrEventRole(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
  allowedRoles: RoleCode[],
  message = "You do not have the required access for this event.",
) {
  if (isSystemAdmin(user)) {
    return;
  }

  assertEventScopedAccess(user, eventId, allowedRoles, message);
}

export function assertAnyEventScopedAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  allowedRoles: RoleCode[],
  message = "You are not assigned to any event with the required role.",
) {
  if (isSystemAdmin(user)) {
    return;
  }

  if (!hasAnyEventScopedRole(user, allowedRoles)) {
    throw new AppError(403, message);
  }
}

export function scopeEventFilters<TFilters extends EventFilterScope>(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  filters: TFilters,
  allowedRoles: RoleCode[] = [...eventScopedInternalRoles],
): TFilters {
  if (isSystemAdmin(user)) {
    return filters;
  }

  if (filters.eventId) {
    assertEventScopedAccess(user, filters.eventId, allowedRoles);
    return filters;
  }

  return {
    ...filters,
    eventIds: getAssignedEventIds(user, allowedRoles, { includeSystemAdmin: false }) ?? [],
  };
}
