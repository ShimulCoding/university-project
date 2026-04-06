import { ApprovalEntityType } from "@prisma/client";

import type {
  BudgetRequestWithContext,
  ExpenseRequestWithContext,
} from "../requests/requests.mappers";

type ApprovalQueueSource = BudgetRequestWithContext | ExpenseRequestWithContext;

export function mapApprovalQueueItem(
  entityType: ApprovalEntityType,
  request: ApprovalQueueSource,
) {
  const summary =
    entityType === ApprovalEntityType.BUDGET_REQUEST
      ? {
          purpose: request.purpose,
          justification: request.justification ?? null,
        }
      : {
          category: "category" in request ? request.category : null,
          purpose: request.purpose,
          justification: request.justification ?? null,
        };

  return {
    entityType,
    entityId: request.id,
    state: request.state,
    amount: request.amount.toString(),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    event: {
      id: request.event.id,
      title: request.event.title,
      slug: request.event.slug,
      status: request.event.status,
    },
    requestedBy: request.requestedBy
      ? {
          id: request.requestedBy.id,
          fullName: request.requestedBy.fullName,
          email: request.requestedBy.email,
        }
      : null,
    documentCount: request.documents.length,
    decisionCount: request.approvalDecisions.length,
    summary,
  };
}
