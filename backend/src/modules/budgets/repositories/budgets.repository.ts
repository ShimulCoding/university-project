import { Prisma, type BudgetState } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { budgetDetailInclude } from "../budgets.mappers";
import type { BudgetFilters, BudgetItemInput } from "../types/budgets.types";

type CreateBudgetData = {
  eventId: string;
  version: number;
  title?: string | null | undefined;
  state: BudgetState;
  totalAmount: string;
  isActive?: boolean | undefined;
  createdById: string;
  items: BudgetItemInput[];
};

function buildBudgetWhere(filters: BudgetFilters): Prisma.BudgetWhereInput {
  const where: Prisma.BudgetWhereInput = {};

  if (filters.eventId) {
    where.eventId = filters.eventId;
  }

  if (filters.state) {
    where.state = filters.state;
  }

  if (typeof filters.isActive === "boolean") {
    where.isActive = filters.isActive;
  }

  return where;
}

function buildBudgetCreateData(data: CreateBudgetData): Prisma.BudgetCreateInput {
  return {
    version: data.version,
    state: data.state,
    totalAmount: data.totalAmount,
    isActive: data.isActive ?? false,
    event: {
      connect: {
        id: data.eventId,
      },
    },
    createdBy: {
      connect: {
        id: data.createdById,
      },
    },
    ...(data.title !== undefined ? { title: data.title } : {}),
    items: {
      create: data.items.map((item) => ({
        category: item.category.trim(),
        label: item.label.trim(),
        amount: item.amount,
        ...(item.notes ? { notes: item.notes.trim() } : {}),
      })),
    },
  };
}

export const budgetsRepository = {
  findById(budgetId: string, db: DbClient = prisma) {
    return db.budget.findUnique({
      where: { id: budgetId },
      include: budgetDetailInclude,
    });
  },

  listBudgets(filters: BudgetFilters, db: DbClient = prisma) {
    return db.budget.findMany({
      where: buildBudgetWhere(filters),
      include: budgetDetailInclude,
      orderBy: [{ eventId: "asc" }, { version: "desc" }],
    });
  },

  findLatestBudgetVersion(eventId: string, db: DbClient = prisma) {
    return db.budget.findFirst({
      where: { eventId },
      include: budgetDetailInclude,
      orderBy: {
        version: "desc",
      },
    });
  },

  createBudget(data: CreateBudgetData, db: DbClient = prisma) {
    return db.budget.create({
      data: buildBudgetCreateData(data),
      include: budgetDetailInclude,
    });
  },

  updateBudgetState(budgetId: string, state: BudgetState, db: DbClient = prisma) {
    return db.budget.update({
      where: { id: budgetId },
      data: { state },
      include: budgetDetailInclude,
    });
  },

  markBudgetRevised(budgetId: string, db: DbClient = prisma) {
    return db.budget.update({
      where: { id: budgetId },
      data: {
        state: "REVISED",
        isActive: false,
      },
      include: budgetDetailInclude,
    });
  },

  deactivateEventBudgets(eventId: string, db: DbClient = prisma) {
    return db.budget.updateMany({
      where: {
        eventId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });
  },

  activateBudget(budgetId: string, db: DbClient = prisma) {
    return db.budget.update({
      where: { id: budgetId },
      data: {
        isActive: true,
      },
      include: budgetDetailInclude,
    });
  },
};
