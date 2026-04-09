import type { AppRole, UserProfile } from "@/types";

export const internalWorkspaceRoles: AppRole[] = [
  "SYSTEM_ADMIN",
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

export function hasAnyRole(
  user: Pick<UserProfile, "roles"> | null | undefined,
  roles: AppRole[],
) {
  if (!user) {
    return false;
  }

  return roles.some((role) => user.roles.includes(role));
}
