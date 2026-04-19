import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";

export const listPublicSummariesSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
    search: z.string().trim().min(1).max(200).optional(),
  }),
});

export const publicSummaryLookupParamSchema = z.object({
  params: z.object({
    eventLookup: z.string().trim().min(1).max(200),
  }),
});

export const publishPublicSummaryParamSchema = z.object({
  params: z.object({
    reconciliationReportId: z.string().cuid(),
  }),
});
