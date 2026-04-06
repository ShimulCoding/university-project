import { z } from "zod";

export const listAuditLogsSchema = z.object({
  query: z.object({
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

