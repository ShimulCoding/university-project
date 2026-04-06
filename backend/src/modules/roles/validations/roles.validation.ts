import { RoleCode } from "@prisma/client";
import { z } from "zod";

export const assignRoleSchema = z.object({
  body: z.object({
    userId: z.string().cuid(),
    roleCode: z.nativeEnum(RoleCode),
  }),
});

export const userAssignmentsParamSchema = z.object({
  params: z.object({
    userId: z.string().cuid(),
  }),
});

export const revokeRoleAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().cuid(),
  }),
});

