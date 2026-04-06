import type { AccountStatus, RoleCode } from "@prisma/client";

export type AuthenticatedUser = {
  id: string;
  fullName: string;
  email: string;
  status: AccountStatus;
  roles: RoleCode[];
};

