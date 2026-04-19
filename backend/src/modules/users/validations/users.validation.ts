import { AccountStatus, RoleCode } from "@prisma/client";
import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";

export const listUsersSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    status: z.nativeEnum(AccountStatus).optional(),
    roleCodes: z.array(z.nativeEnum(RoleCode)).min(1).optional(),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({
    userId: z.string().cuid(),
  }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({
    userId: z.string().cuid(),
  }),
  body: z.object({
    status: z.nativeEnum(AccountStatus),
  }),
});
