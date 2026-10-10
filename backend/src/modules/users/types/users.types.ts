import type { AccountStatus, RoleCode } from "@prisma/client";

import type { PaginationInput } from "../../../utils/pagination";

export type UserListFilters = PaginationInput;

export type CreateUserInput = {
  fullName: string;
  email: string;
  password: string;
  studentId?: string;
  status?: AccountStatus;
  roleCodes?: RoleCode[];
};

export type UpdateUserProfileInput = { fullName?: string; studentId?: string };
