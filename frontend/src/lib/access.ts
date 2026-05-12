import type { AppRole, UserProfile } from "@/types";

export const internalWorkspaceRoles: AppRole[] = [
  "SYSTEM_ADMIN",
  "EVENT_ADMIN",
  "FINANCIAL_CONTROLLER",
  "ORGANIZATIONAL_APPROVER",
  "EVENT_MANAGEMENT_USER",
  "COMPLAINT_REVIEW_AUTHORITY",
];

/** Roles that can be assigned per-event (not SYSTEM_ADMIN). */
export const eventScopedRoles: AppRole[] = [
  "EVENT_ADMIN",
  "FINANCIAL_CONTROLLER",
  "ORGANIZATIONAL_APPROVER",
  "EVENT_MANAGEMENT_USER",
  "COMPLAINT_REVIEW_AUTHORITY",
];

export function getInternalRoles(user: UserProfile | null | undefined) {
  if (!user) {
    return [];
  }

  return user.roles.filter((role) => internalWorkspaceRoles.includes(role));
}

export function isInternalUser(user: UserProfile | null | undefined) {
  return getInternalRoles(user).length > 0;
}

export function isSystemAdmin(user: UserProfile | null | undefined) {
  if (!user) return false;
  return user.roles.includes("SYSTEM_ADMIN");
}

/** Returns true when the user only has event-scoped roles (no SYSTEM_ADMIN). */
export function isEventScopedOnlyUser(user: UserProfile | null | undefined) {
  if (!user) return false;
  if (isSystemAdmin(user)) return false;
  return (user.eventRoles ?? []).length > 0;
}

/** Returns true if the user has any event-scoped role for the given event. */
export function hasEventAccess(
  user: UserProfile | null | undefined,
  eventId: string,
) {
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return (user.eventRoles ?? []).some(
    (assignment) => assignment.eventId === eventId,
  );
}

/** Returns the user's role codes for a specific event. */
export function getEventRolesForEvent(
  user: UserProfile | null | undefined,
  eventId: string,
): AppRole[] {
  if (!user) return [];
  if (isSystemAdmin(user)) return internalWorkspaceRoles;
  return (user.eventRoles ?? [])
    .filter((assignment) => assignment.eventId === eventId)
    .map((assignment) => assignment.roleCode);
}

/** Returns unique events the user is assigned to. */
export function getAssignedEvents(user: UserProfile | null | undefined) {
  if (!user) return [];
  const eventMap = new Map<
    string,
    { id: string; title: string; slug: string; status: string; roles: AppRole[] }
  >();

  for (const assignment of user.eventRoles ?? []) {
    const existing = eventMap.get(assignment.eventId);
    if (existing) {
      existing.roles.push(assignment.roleCode);
    } else {
      eventMap.set(assignment.eventId, {
        id: assignment.event.id,
        title: assignment.event.title,
        slug: assignment.event.slug,
        status: assignment.event.status,
        roles: [assignment.roleCode],
      });
    }
  }

  return Array.from(eventMap.values());
}

export function hasAnyRole(
  user: Pick<UserProfile, "roles"> | null | undefined,
  roles: AppRole[],
) {
  if (!user) {
    return false;
  }

  return roles.some((role) => user.roles.includes(role));
}
