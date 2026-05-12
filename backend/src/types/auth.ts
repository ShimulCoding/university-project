import type { AccountStatus, RoleCode } from "@prisma/client";

export type EventScopedRole = {
  eventId: string;
  roleCode: RoleCode;
};

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  status: AccountStatus;
  roles: RoleCode[];
  eventRoles: EventScopedRole[];
};
