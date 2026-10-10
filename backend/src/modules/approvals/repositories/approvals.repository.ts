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
import type { PaginationOptions } from "../../../utils/pagination";

function buildPendingStatesWhere() {
  return {
    in: ["SUBMITTED", "PENDING_REVIEW"] as RequestState[],
  };
}

function queueSql(filters: ApprovalQueueFilters) {
  const scope = filters.eventId
    ? Prisma.sql`"eventId" = ${filters.eventId}`
    : filters.eventIds
      ? filters.eventIds.length ? Prisma.sql`"eventId" IN (${Prisma.join(filters.eventIds)})` : Prisma.sql`FALSE`
      : Prisma.sql`TRUE`;
  return Prisma.sql`
    SELECT "id", "createdAt", 'BUDGET_REQUEST' AS "entityType" FROM "BudgetRequest"
    WHERE "state" IN ('SUBMITTED', 'PENDING_REVIEW') AND ${scope}
      AND ${!filters.entityType || filters.entityType === "BUDGET_REQUEST"}
    UNION ALL
    SELECT "id", "createdAt", 'EXPENSE_REQUEST' AS "entityType" FROM "ExpenseRequest"
    WHERE "state" IN ('SUBMITTED', 'PENDING_REVIEW') AND ${scope}
      AND ${!filters.entityType || filters.entityType === "EXPENSE_REQUEST"}`;
}

export const approvalsRepository = {
  listQueueReferences(filters: ApprovalQueueFilters, pagination: PaginationOptions, db: DbClient = prisma) {
    return db.$queryRaw<Array<{ id: string; entityType: ApprovalEntityType }>>(Prisma.sql`
      SELECT * FROM (${queueSql(filters)}) queue
      ORDER BY "createdAt" ASC, "id" ASC, "entityType" ASC
      OFFSET ${pagination.skip} LIMIT ${pagination.take}`);
  },

  async countQueue(filters: ApprovalQueueFilters, db: DbClient = prisma) {
    const [row] = await db.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT COUNT(*) AS total FROM (${queueSql(filters)}) queue`);
    return Number(row?.total ?? 0);
  },

  findBudgetRequestsByIds(ids: string[], db: DbClient = prisma) {
    return db.budgetRequest.findMany({
      where: { id: { in: ids } },
      include: budgetRequestDetailInclude,
    });
  },

  findExpenseRequestsByIds(ids: string[], db: DbClient = prisma) {
    return db.expenseRequest.findMany({
      where: { id: { in: ids } },
      include: expenseRequestDetailInclude,
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

  transitionBudgetRequestFromPending(
    budgetRequestId: string,
    state: RequestState,
    db: DbClient = prisma,
  ) {
    return db.budgetRequest.updateMany({
      where: {
        id: budgetRequestId,
        state: buildPendingStatesWhere(),
      },
      data: { state },
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

  transitionExpenseRequestFromPending(
    expenseRequestId: string,
    state: RequestState,
    db: DbClient = prisma,
  ) {
    return db.expenseRequest.updateMany({
      where: {
        id: expenseRequestId,
        state: buildPendingStatesWhere(),
      },
      data: { state },
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
