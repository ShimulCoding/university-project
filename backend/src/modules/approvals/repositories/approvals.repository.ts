import {
  Prisma,
  type ApprovalDecisionType,
  type ApprovalEntityType,
  type RequestState,
} from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import {
  budgetRequestDetailInclude,
  expenseRequestDetailInclude,
} from "../../requests/requests.mappers";
import type { ApprovalQueueFilters } from "../types/approvals.types";

function buildPendingStatesWhere() {
  return {
    in: ["SUBMITTED", "PENDING_REVIEW"] as RequestState[],
  };
}

function buildBudgetQueueWhere(filters: ApprovalQueueFilters): Prisma.BudgetRequestWhereInput {
  const where: Prisma.BudgetRequestWhereInput = {
    state: buildPendingStatesWhere(),
  };

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  return where;
}

function buildExpenseQueueWhere(filters: ApprovalQueueFilters): Prisma.ExpenseRequestWhereInput {
  const where: Prisma.ExpenseRequestWhereInput = {
    state: buildPendingStatesWhere(),
  };

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  return where;
}

export const approvalsRepository = {
  listPendingBudgetRequests(filters: ApprovalQueueFilters, db: DbClient = prisma) {
    return db.budgetRequest.findMany({
      where: buildBudgetQueueWhere(filters),
      include: budgetRequestDetailInclude,
      orderBy: {
        createdAt: "asc",
      },
    });
  },

  listPendingExpenseRequests(filters: ApprovalQueueFilters, db: DbClient = prisma) {
    return db.expenseRequest.findMany({
      where: buildExpenseQueueWhere(filters),
      include: expenseRequestDetailInclude,
      orderBy: {
        createdAt: "asc",
      },
    });
  },

  findBudgetRequestById(budgetRequestId: string, db: DbClient = prisma) {
    return db.budgetRequest.findUnique({
      where: { id: budgetRequestId },
      include: budgetRequestDetailInclude,
    });
  },

  findExpenseRequestById(expenseRequestId: string, db: DbClient = prisma) {
    return db.expenseRequest.findUnique({
      where: { id: expenseRequestId },
      include: expenseRequestDetailInclude,
    });
  },

  updateBudgetRequestState(
    budgetRequestId: string,
    state: RequestState,
    db: DbClient = prisma,
  ) {
    return db.budgetRequest.update({
      where: { id: budgetRequestId },
      data: { state },
      include: budgetRequestDetailInclude,
    });
  },

  updateExpenseRequestState(
    expenseRequestId: string,
    state: RequestState,
    db: DbClient = prisma,
  ) {
    return db.expenseRequest.update({
      where: { id: expenseRequestId },
      data: { state },
      include: expenseRequestDetailInclude,
    });
  },

  createApprovalDecision(
    input: {
      entityType: ApprovalEntityType;
      decision: ApprovalDecisionType;
      comment?: string | undefined;
      actorId: string;
      budgetRequestId?: string | undefined;
      expenseRequestId?: string | undefined;
    },
    db: DbClient = prisma,
  ) {
    return db.approvalDecision.create({
      data: {
        entityType: input.entityType,
        decision: input.decision,
        actorId: input.actorId,
        ...(input.comment ? { comment: input.comment } : {}),
        ...(input.budgetRequestId ? { budgetRequestId: input.budgetRequestId } : {}),
        ...(input.expenseRequestId ? { expenseRequestId: input.expenseRequestId } : {}),
      },
    });
  },
};
