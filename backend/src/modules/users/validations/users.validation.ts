import { passwordField } from "../../../utils/password-validation";
import { AccountStatus, RoleCode } from "@prisma/client";
import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";
import { isGlobalAccountRole } from "../../../utils/event-scope";

const globalAccountRoleSchema = z
  .nativeEnum(RoleCode)
  .refine(isGlobalAccountRole, {
    message: "Event operational roles must be assigned through an event team.",
  });

export const listUsersSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(255),
    password: passwordField,
    studentId: z.string().trim().min(3).max(30).optional(),
    status: z.nativeEnum(AccountStatus).optional(),
    roleCodes: z.array(globalAccountRoleSchema).max(2).optional(),
  }).superRefine((body, context) => {
    if ((body.roleCodes ?? [RoleCode.GENERAL_STUDENT]).includes(RoleCode.GENERAL_STUDENT) && !body.studentId) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["studentId"], message: "A Student ID is required for student sign-in." });
    }
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

export const updateUserProfileSchema = z.object({
  params: z.object({ userId: z.string().cuid() }),
  body: z.object({ fullName: z.string().trim().min(2).max(100).optional(), studentId: z.string().trim().min(3).max(30).optional() })
    .refine((body) => Object.keys(body).length > 0, "At least one profile field is required."),
});
