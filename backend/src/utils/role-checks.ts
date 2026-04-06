import { RoleCode } from "@prisma/client";

export function hasAnyRole(userRoles: RoleCode[], allowedRoles: RoleCode[]) {
  return allowedRoles.some((role) => userRoles.includes(role));
}

export function hasFinanceAccess(userRoles: RoleCode[]) {
  return hasAnyRole(userRoles, [RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]);
}

export function hasApproverAccess(userRoles: RoleCode[]) {
  return hasAnyRole(userRoles, [RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]);
}

export function hasEventManagementAccess(userRoles: RoleCode[]) {
  return hasAnyRole(userRoles, [RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]);
}

export function hasInternalRegistrationAccess(userRoles: RoleCode[]) {
  return hasAnyRole(userRoles, [
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]);
}

export function hasBudgetManagementAccess(userRoles: RoleCode[]) {
  return hasFinanceAccess(userRoles);
}

export function hasRequestSubmissionAccess(userRoles: RoleCode[]) {
  return hasAnyRole(userRoles, [RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]);
}

export function hasFinanceReadAccess(userRoles: RoleCode[]) {
  return hasAnyRole(userRoles, [
    RoleCode.SYSTEM_ADMIN,
    RoleCode.FINANCIAL_CONTROLLER,
    RoleCode.ORGANIZATIONAL_APPROVER,
    RoleCode.EVENT_MANAGEMENT_USER,
  ]);
}

export function hasExpenseRecordManagementAccess(userRoles: RoleCode[]) {
  return hasFinanceAccess(userRoles);
}
