import type { RoleCode } from "@prisma/client";

export type AssignRoleInput = {
  userId: string;
  roleCode: RoleCode;
};

