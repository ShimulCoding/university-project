import type { ApprovalDecisionType, ApprovalEntityType } from "@prisma/client";

export type ApprovalQueueFilters = {
  entityType?: ApprovalEntityType | undefined;
  eventId?: string | undefined;
};

export type ApprovalDecisionInput = {
  decision: ApprovalDecisionType;
  comment?: string | undefined;
};
