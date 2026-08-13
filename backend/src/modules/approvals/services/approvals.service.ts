import {
  ApprovalDecisionType,
  ApprovalEntityType,
  RequestState,
  RoleCode,
} from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import {
  assertAnyEventScopedAccess,
  assertEventScopedOperationalAccess,
  scopeEventFilters,
} from "../../../utils/event-scope";
import { sanitizeOptionalText } from "../../../utils/text-utils";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { mapApprovalQueueItem } from "../approvals.mappers";
import { approvalsRepository } from "../repositories/approvals.repository";
import {
  mapBudgetRequest,
  mapExpenseRequest,
} from "../../requests/requests.mappers";
import type { ApprovalDecisionInput, ApprovalQueueFilters } from "../types/approvals.types";

const approverEventRoles = [RoleCode.ORGANIZATIONAL_APPROVER] as RoleCode[];

/**
 * Assert the user has Organizational Approver access for the given event.
 * System Admin has governance read-only — NOT operational approval access.
 */
function assertEventApproverPermissions(viewer: AuthenticatedUser, eventId: string) {
  assertEventScopedOperationalAccess(
    viewer,
    eventId,
    approverEventRoles,
    "You are not assigned as Organizational Approver for this event.",
  );
}

/**
 * For list endpoints: check the user has at least one event assignment
 * with approver roles. System Admin can list across all events.
 */
function assertHasAnyApproverAssignment(viewer: AuthenticatedUser) {
  assertAnyEventScopedAccess(
    viewer,
    approverEventRoles,
    "You are not assigned as Organizational Approver for any event.",
  );
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
    assertHasAnyApproverAssignment(actor);

    const queueItems: Array<ReturnType<typeof mapApprovalQueueItem>> = [];
    const scopedFilters = scopeEventFilters(actor, filters, approverEventRoles);
    const paginationOptions = getPaginationOptions(filters);

    if (!scopedFilters.entityType || scopedFilters.entityType === ApprovalEntityType.BUDGET_REQUEST) {
      const budgetRequests = await approvalsRepository.listPendingBudgetRequests(scopedFilters);
      queueItems.push(
        ...budgetRequests.map((request) =>
          mapApprovalQueueItem(ApprovalEntityType.BUDGET_REQUEST, request),
        ),
      );
    }

    if (!scopedFilters.entityType || scopedFilters.entityType === ApprovalEntityType.EXPENSE_REQUEST) {
      const expenseRequests = await approvalsRepository.listPendingExpenseRequests(scopedFilters);
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
    // System Admin cannot make approval decisions — only event-scoped Approver
    const comment = sanitizeOptionalText(input.comment);

    if (entityType === ApprovalEntityType.BUDGET_REQUEST) {
      const request = await approvalsRepository.findBudgetRequestById(entityId);

      if (!request) {
        throw new AppError(404, "Budget request not found.");
      }

      assertEventApproverPermissions(actor, request.eventId);

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

    assertEventApproverPermissions(actor, request.eventId);

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
