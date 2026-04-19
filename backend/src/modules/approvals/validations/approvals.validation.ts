import { ApprovalDecisionType, ApprovalEntityType } from "@prisma/client";
import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";

export const listApprovalQueueSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
    entityType: z.nativeEnum(ApprovalEntityType).optional(),
    eventId: z.string().cuid().optional(),
  }),
});

export const approvalDecisionSchema = z.object({
  params: z.object({
    entityType: z.nativeEnum(ApprovalEntityType),
    entityId: z.string().cuid(),
  }),
  body: z
    .object({
      decision: z.nativeEnum(ApprovalDecisionType),
      comment: z.string().trim().max(1000).optional(),
    })
    .refine(
      (value) =>
        value.decision === ApprovalDecisionType.APPROVED || Boolean(value.comment?.trim()),
      {
        message: "A comment is required when rejecting or returning a request.",
        path: ["comment"],
      },
    ),
});
