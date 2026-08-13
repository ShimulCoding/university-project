import { RoleCode } from "@prisma/client";

import type { AuthenticatedUser } from "../types/auth";
import {
  hasAnyEventScopedRole,
  hasEventScopedRole,
  isSystemAdmin,
} from "./event-scope";

export function hasAnyRole(userRoles: RoleCode[], allowedRoles: RoleCode[]) {
  return allowedRoles.some((role) => userRoles.includes(role));
}

export function hasAuditReadAccess(userRoles: RoleCode[]) {
  return hasAnyRole(userRoles, [RoleCode.SYSTEM_ADMIN]);
}

export function hasAnyInternalAccess(user: Pick<AuthenticatedUser, "roles" | "eventRoles">) {
  return isSystemAdmin(user) || user.eventRoles.length > 0;
}

export function hasAnyEventAssignment(
  user: Pick<AuthenticatedUser, "eventRoles">,
  allowedRoles: RoleCode[],
) {
  return hasAnyEventScopedRole(user, allowedRoles);
}

export function hasEventFinanceAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [RoleCode.FINANCIAL_CONTROLLER]);
}

export function hasEventApproverAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [RoleCode.ORGANIZATIONAL_APPROVER]);
}

export function hasEventManagementAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [
    RoleCode.EVENT_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]);
}

export function hasEventManagementReadAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [
    RoleCode.EVENT_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.COMPLAINT_REVIEW_AUTHORITY,
  ]);
}

export function hasEventInternalRegistrationAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]);
}

export function hasEventBudgetManagementAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventManagementAccess(user, eventId);
}

export function hasEventRequestSubmissionAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [
    RoleCode.EVENT_ADMIN,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]);
}

export function hasEventFinanceReadAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]);
}

export function hasEventExpenseRecordManagementAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventFinanceAccess(user, eventId);
}

export function hasEventComplaintReviewAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [
    RoleCode.EVENT_ADMIN,
    RoleCode.COMPLAINT_REVIEW_AUTHORITY,
    RoleCode.ORGANIZATIONAL_APPROVER,
  ]);
}

export function hasEventReconciliationReadAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [
    RoleCode.EVENT_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]);
}

export function hasEventReconciliationManagementAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [RoleCode.FINANCIAL_CONTROLLER]);
}

export function hasEventReconciliationFinalizeAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventScopedRole(user, eventId, [RoleCode.ORGANIZATIONAL_APPROVER]);
}

export function hasEventPublicSummaryPublishAccess(
  user: Pick<AuthenticatedUser, "eventRoles" | "roles">,
  eventId: string,
) {
  return hasEventReconciliationFinalizeAccess(user, eventId);
}

export function hasGovernanceReadAccess(user: Pick<AuthenticatedUser, "roles">) {
  return isSystemAdmin(user);
}
