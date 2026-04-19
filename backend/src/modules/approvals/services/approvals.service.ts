import {
  ApprovalDecisionType,
  ApprovalEntityType,
  RequestState,
} from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { sanitizeOptionalText } from "../../../utils/text-utils";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import { hasApproverAccess } from "../../../utils/role-checks";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { mapApprovalQueueItem } from "../approvals.mappers";
import { approvalsRepository } from "../repositories/approvals.repository";
import {
  mapBudgetRequest,
  mapExpenseRequest,
} from "../../requests/requests.mappers";
import type { ApprovalDecisionInput, ApprovalQueueFilters } from "../types/approvals.types";

function assertApproverPermissions(viewer: AuthenticatedUser) {
  if (!hasApproverAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to review approval requests.");
  }
}

function assertPendingApprovalState(state: RequestState) {
  if (state !== RequestState.SUBMITTED && state !== RequestState.PENDING_REVIEW) {
    throw new AppError(409, "Only pending requests can receive approval decisions.");
  }
}

function mapDecisionToRequestState(decision: ApprovalDecisionType) {
  switch (decision) {
    case ApprovalDecisionType.APPROVED:
      return RequestState.APPROVED;
    case ApprovalDecisionType.REJECTED:
      return RequestState.REJECTED;
    case ApprovalDecisionType.RETURNED:
      return RequestState.RETURNED;
  }
}

export const approvalsService = {
  async listApprovalQueue(actor: AuthenticatedUser, filters: ApprovalQueueFilters) {
    assertApproverPermissions(actor);

    const queueItems: Array<ReturnType<typeof mapApprovalQueueItem>> = [];
    const paginationOptions = getPaginationOptions(filters);

    if (!filters.entityType || filters.entityType === ApprovalEntityType.BUDGET_REQUEST) {
      const budgetRequests = await approvalsRepository.listPendingBudgetRequests(filters);
      queueItems.push(
        ...budgetRequests.map((request) =>
          mapApprovalQueueItem(ApprovalEntityType.BUDGET_REQUEST, request),
        ),
      );
    }

    if (!filters.entityType || filters.entityType === ApprovalEntityType.EXPENSE_REQUEST) {
      const expenseRequests = await approvalsRepository.listPendingExpenseRequests(filters);
      queueItems.push(
        ...expenseRequests.map((request) =>
          mapApprovalQueueItem(ApprovalEntityType.EXPENSE_REQUEST, request),
        ),
      );
    }

    const sortedQueue = queueItems.sort(
      (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
    );

    return {
      queue: sortedQueue.slice(
        paginationOptions.skip,
        paginationOptions.skip + paginationOptions.take,
      ),
      pagination: buildPaginationResult(paginationOptions, sortedQueue.length),
    };
  },

  async decide(
    actor: AuthenticatedUser,
    entityType: ApprovalEntityType,
    entityId: string,
    input: ApprovalDecisionInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertApproverPermissions(actor);

    const comment = sanitizeOptionalText(input.comment);

    if (entityType === ApprovalEntityType.BUDGET_REQUEST) {
      const request = await approvalsRepository.findBudgetRequestById(entityId);

      if (!request) {
        throw new AppError(404, "Budget request not found.");
      }

      assertPendingApprovalState(request.state);

      if (request.requestedById === actor.id) {
        throw new AppError(409, "Self-approval is not allowed for budget requests.");
      }

      const updatedRequest = await prisma.$transaction(async (tx) => {
        const transition = await approvalsRepository.transitionBudgetRequestFromPending(
          entityId,
          mapDecisionToRequestState(input.decision),
          tx,
        );

        if (transition.count !== 1) {
          throw new AppError(409, "This budget request has already received a decision.");
        }

        await approvalsRepository.createApprovalDecision(
          {
            entityType,
            decision: input.decision,
            comment,
            actorId: actor.id,
            budgetRequestId: entityId,
          },
          tx,
        );

        const reloadedRequest = await approvalsRepository.findBudgetRequestById(entityId, tx);

        if (!reloadedRequest) {
          throw new AppError(500, "Failed to reload the decided budget request.");
        }

        return reloadedRequest;
      });

      await auditService.record({
        actorId: actor.id,
        action: "approvals.decide",
        entityType: "BudgetRequest",
        entityId: updatedRequest.id,
        summary: `${input.decision} budget request for ${updatedRequest.event.title}`,
        context: {
          approvalEntityType: entityType,
          decision: input.decision,
          previousState: request.state,
          nextState: updatedRequest.state,
          comment: comment ?? null,
        },
        ...auditMetadata,
      });

      return {
        entityType,
        request: mapBudgetRequest(updatedRequest),
      };
    }

    const request = await approvalsRepository.findExpenseRequestById(entityId);

    if (!request) {
      throw new AppError(404, "Expense request not found.");
    }

    assertPendingApprovalState(request.state);

    if (request.requestedById === actor.id) {
      throw new AppError(409, "Self-approval is not allowed for expense requests.");
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const transition = await approvalsRepository.transitionExpenseRequestFromPending(
        entityId,
        mapDecisionToRequestState(input.decision),
        tx,
      );

      if (transition.count !== 1) {
        throw new AppError(409, "This expense request has already received a decision.");
      }

      await approvalsRepository.createApprovalDecision(
        {
          entityType,
          decision: input.decision,
          comment,
          actorId: actor.id,
          expenseRequestId: entityId,
        },
        tx,
      );

      const reloadedRequest = await approvalsRepository.findExpenseRequestById(entityId, tx);

      if (!reloadedRequest) {
        throw new AppError(500, "Failed to reload the decided expense request.");
      }

      return reloadedRequest;
    });

    await auditService.record({
      actorId: actor.id,
      action: "approvals.decide",
      entityType: "ExpenseRequest",
      entityId: updatedRequest.id,
      summary: `${input.decision} expense request for ${updatedRequest.event.title}`,
      context: {
        approvalEntityType: entityType,
        decision: input.decision,
        previousState: request.state,
        nextState: updatedRequest.state,
        comment: comment ?? null,
      },
      ...auditMetadata,
    });

    return {
      entityType,
      request: mapExpenseRequest(updatedRequest),
    };
  },
};
