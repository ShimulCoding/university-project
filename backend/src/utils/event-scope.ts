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

export function isSystemAdmin(user: Pick<AuthenticatedUser, "roles">) {
  return user.roles.includes(RoleCode.SYSTEM_ADMIN);
}

export function getAssignedEventIds(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  allowedRoles: RoleCode[] = [...eventScopedInternalRoles],
) {
  if (isSystemAdmin(user)) {
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
  return (
    isSystemAdmin(user) ||
    user.eventRoles.some(
      (assignment) =>
        assignment.eventId === eventId && allowedRoles.includes(assignment.roleCode),
    )
  );
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
    eventIds: getAssignedEventIds(user, allowedRoles) ?? [],
  };
}
