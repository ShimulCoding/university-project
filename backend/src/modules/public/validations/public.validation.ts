import { z } from "zod";

export const listPublicSummariesSchema = z.object({
  query: z.object({
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
