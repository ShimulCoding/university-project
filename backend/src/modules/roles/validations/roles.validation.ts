import { RoleCode } from "@prisma/client";
import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";
import { isGlobalAccountRole } from "../../../utils/event-scope";

const globalAccountRoleSchema = z
  .nativeEnum(RoleCode)
  .refine(isGlobalAccountRole, {
    message: "Event operational roles must be assigned through an event team.",
  });

export const listRolesSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
  }),
});

export const assignRoleSchema = z.object({
  body: z.object({
    userId: z.string().cuid(),
    roleCode: globalAccountRoleSchema,
  }),
});

export const userAssignmentsParamSchema = z.object({
  params: z.object({
    userId: z.string().cuid(),
  }),
  query: z.object({
    ...paginationQuerySchema,
  }),
});

export const revokeRoleAssignmentSchema = z.object({
  params: z.object({
    assignmentId: z.string().cuid(),
  }),
});
