import { ReconciliationState } from "@prisma/client";
import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";

export const listReconciliationReportsSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
    eventId: z.string().cuid().optional(),
    status: z.nativeEnum(ReconciliationState).optional(),
  }),
});

export const reconciliationReportIdParamSchema = z.object({
  params: z.object({
    reportId: z.string().cuid(),
  }),
});

export const generateReconciliationReportSchema = z.object({
  body: z.object({
    eventId: z.string().cuid(),
  }),
});
