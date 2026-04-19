import type { RoleCode } from "@prisma/client";

import type { PaginationInput } from "../../../utils/pagination";

export type RoleListFilters = PaginationInput;

export type AssignRoleInput = {
  userId: string;
  roleCode: RoleCode;
};
