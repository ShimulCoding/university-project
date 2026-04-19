import type { ApprovalDecisionType, ApprovalEntityType } from "@prisma/client";

import type { PaginationInput } from "../../../utils/pagination";

export type ApprovalQueueFilters = PaginationInput & {
  entityType?: ApprovalEntityType | undefined;
  eventId?: string | undefined;
};

export type ApprovalDecisionInput = {
  decision: ApprovalDecisionType;
  comment?: string | undefined;
};
