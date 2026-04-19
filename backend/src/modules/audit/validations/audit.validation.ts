import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";

export const listAuditLogsSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
    actorId: z.string().cuid().optional(),
    entityType: z.string().trim().min(1).optional(),
    entityId: z.string().trim().min(1).optional(),
    limit: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") {
        return 20;
      }

      return Number(value);
    }, z.number().int().min(1).max(100)),
  }),
});

export const auditLogIdParamSchema = z.object({
  params: z.object({
    auditLogId: z.string().cuid(),
  }),
});
