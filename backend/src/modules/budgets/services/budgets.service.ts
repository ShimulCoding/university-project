import { BudgetState, Prisma, RoleCode } from "@prisma/client";

import { prisma } from "../../../config/prisma";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { assertEventScopedAccess, scopeEventFilters } from "../../../utils/event-scope";
import { buildPaginationResult, getPaginationOptions } from "../../../utils/pagination";
import {
  hasApproverAccess,
  hasBudgetManagementAccess,
  hasFinanceReadAccess,
} from "../../../utils/role-checks";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { eventsRepository } from "../../events/repositories/events.repository";
import { mapBudget } from "../budgets.mappers";
import { budgetsRepository } from "../repositories/budgets.repository";
import type {
  BudgetFilters,
  BudgetItemInput,
  CreateBudgetInput,
  ReviseBudgetInput,
  UpdateBudgetStateInput,
} from "../types/budgets.types";

const budgetReadRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.FINANCIAL_CONTROLLER,
  RoleCode.ORGANIZATIONAL_APPROVER,
  RoleCode.EVENT_MANAGEMENT_USER,
] as RoleCode[];

const budgetManagementRoles = [
  RoleCode.EVENT_ADMIN,
  RoleCode.EVENT_MANAGEMENT_USER,
] as RoleCode[];

const budgetApprovalRoles = [RoleCode.ORGANIZATIONAL_APPROVER] as RoleCode[];

type BudgetApprovalLookup = Map<
  string,
  {
    approvedAt: Date;
    approvedBy: {
      id: string;
      fullName: string;
      email: string;
    } | null;
  }
>;

const allowedBudgetStateTransitions: Record<BudgetState, BudgetState[]> = {
  [BudgetState.DRAFT]: [BudgetState.SUBMITTED],
  [BudgetState.SUBMITTED]: [BudgetState.APPROVED, BudgetState.REVISED],
  [BudgetState.APPROVED]: [],
  [BudgetState.REVISED]: [],
};

function assertBudgetReadPermissions(viewer: AuthenticatedUser) {
  if (!hasFinanceReadAccess(viewer.roles)) {
    throw new AppError(403, "You are not allowed to view budget records.");
  }
}

function assertBudgetManagementPermissions(viewer: AuthenticatedUser) {
  if (!hasBudgetManagementAccess(viewer.roles)) {
    throw new AppError(403, "Only event-management roles can create or submit budget versions.");
  }
}

function assertBudgetApprovalPermissions(viewer: AuthenticatedUser) {
  if (!hasApproverAccess(viewer.roles)) {
    throw new AppError(403, "Only approver roles can approve budget versions.");
  }
}

function calculateBudgetTotal(items: BudgetItemInput[]) {
  const total = items.reduce(
    (sum, item) => sum.plus(new Prisma.Decimal(item.amount)),
    new Prisma.Decimal(0),
  );
  return total.toFixed(2);
}

function getDraftOrSubmittedState(submit: boolean | undefined) {
  return submit ? BudgetState.SUBMITTED : BudgetState.DRAFT;
}

function sanitizeNullableTitle(value: string | undefined) {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function assertBudgetStateTransition(currentState: BudgetState, nextState: BudgetState) {
  if (currentState === nextState) {
    throw new AppError(409, `Budget is already in ${nextState} state.`);
  }

  if (!allowedBudgetStateTransitions[currentState].includes(nextState)) {
    throw new AppError(
      409,
      `Budget state cannot transition from ${currentState} to ${nextState}.`,
    );
  }
}

function isApprovalStateChange(context: unknown) {
  return (
    typeof context === "object" &&
    context !== null &&
    "nextState" in context &&
    (context as { nextState?: unknown }).nextState === BudgetState.APPROVED
  );
}

async function getBudgetApprovalLookup(budgetIds: string[]) {
  if (budgetIds.length === 0) {
    return new Map() as BudgetApprovalLookup;
  }

  const logs = await prisma.auditLog.findMany({
    where: {
      action: "budgets.update_state",
      entityType: "Budget",
      entityId: {
        in: budgetIds,
      },
    },
    include: {
      actor: {
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return logs.reduce<BudgetApprovalLookup>((lookup, log) => {
    if (!lookup.has(log.entityId) && isApprovalStateChange(log.context)) {
      lookup.set(log.entityId, {
        approvedAt: log.createdAt,
        approvedBy: log.actor ?? null,
      });
    }

    return lookup;
  }, new Map());
}

function mapBudgetWithApproval(
  budget: Awaited<ReturnType<typeof budgetsRepository.findById>>,
  approvalLookup: BudgetApprovalLookup,
) {
  if (!budget) {
    return null;
  }

  const approval = approvalLookup.get(budget.id);

  return {
    ...mapBudget(budget),
    approvedBy: approval?.approvedBy ?? null,
    approvedAt: approval?.approvedAt ?? null,
  };
}

export const budgetsService = {
  async listBudgets(viewer: AuthenticatedUser, filters: BudgetFilters) {
    assertBudgetReadPermissions(viewer);

    const scopedFilters = scopeEventFilters(viewer, filters, budgetReadRoles);
    const paginationOptions = getPaginationOptions(filters);
    const [budgets, totalItems] = await Promise.all([
      budgetsRepository.listBudgets(scopedFilters, paginationOptions),
      budgetsRepository.countBudgets(scopedFilters),
    ]);
    const approvalLookup = await getBudgetApprovalLookup(budgets.map((budget) => budget.id));

    return {
      budgets: budgets.map((budget) => mapBudgetWithApproval(budget, approvalLookup)!),
      pagination: buildPaginationResult(paginationOptions, totalItems),
    };
  },

  async getBudgetById(viewer: AuthenticatedUser, budgetId: string) {
    assertBudgetReadPermissions(viewer);

    const budget = await budgetsRepository.findById(budgetId);

    if (!budget) {
      throw new AppError(404, "Budget not found.");
    }

    assertEventScopedAccess(viewer, budget.eventId, budgetReadRoles);

    const approvalLookup = await getBudgetApprovalLookup([budget.id]);

    return mapBudgetWithApproval(budget, approvalLookup);
  },

  async createBudget(
    actor: AuthenticatedUser,
    input: CreateBudgetInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertBudgetManagementPermissions(actor);

    const event = await eventsRepository.findById(input.eventId);

    if (!event) {
      throw new AppError(404, "Event not found.");
    }

    assertEventScopedAccess(actor, event.id, budgetManagementRoles);

    const latestBudget = await budgetsRepository.findLatestBudgetVersion(input.eventId);
    const version = latestBudget ? latestBudget.version + 1 : 1;
    const budget = await budgetsRepository.createBudget({
      eventId: input.eventId,
      version,
      title: sanitizeNullableTitle(input.title),
      state: getDraftOrSubmittedState(input.submit),
      totalAmount: calculateBudgetTotal(input.items),
      createdById: actor.id,
      items: input.items,
    });

    await auditService.record({
      actorId: actor.id,
      action: "budgets.create",
      entityType: "Budget",
      entityId: budget.id,
      summary: `Created budget version ${budget.version} for ${budget.event.title}`,
      context: {
        eventId: budget.event.id,
        version: budget.version,
        state: budget.state,
      },
      ...auditMetadata,
    });

    return mapBudget(budget);
  },

  async createBudgetRevision(
    actor: AuthenticatedUser,
    budgetId: string,
    input: ReviseBudgetInput,
    auditMetadata?: AuditMetadata,
  ) {
    assertBudgetManagementPermissions(actor);

    const budget = await budgetsRepository.findById(budgetId);

    if (!budget) {
      throw new AppError(404, "Budget not found.");
    }

    assertEventScopedAccess(actor, budget.eventId, budgetManagementRoles);

    const latestBudget = await budgetsRepository.findLatestBudgetVersion(budget.eventId);

    if (!latestBudget || latestBudget.id !== budget.id) {
      throw new AppError(409, "Only the latest budget version can be revised.");
    }

    const newBudget = await prisma.$transaction(async (tx) => {
      await budgetsRepository.markBudgetRevised(budget.id, tx);

      return budgetsRepository.createBudget(
        {
          eventId: budget.eventId,
          version: budget.version + 1,
          title: sanitizeNullableTitle(input.title) ?? budget.title ?? undefined,
          state: getDraftOrSubmittedState(input.submit),
          totalAmount: calculateBudgetTotal(input.items),
          createdById: actor.id,
          items: input.items,
        },
        tx,
      );
    });

    await auditService.record({
      actorId: actor.id,
      action: "budgets.revise",
      entityType: "Budget",
      entityId: newBudget.id,
      summary: `Created budget revision ${newBudget.version} for ${newBudget.event.title}`,
      context: {
        eventId: newBudget.event.id,
        previousBudgetId: budget.id,
        previousVersion: budget.version,
        nextVersion: newBudget.version,
      },
      ...auditMetadata,
    });

    return mapBudget(newBudget);
  },

  async updateBudgetState(
    actor: AuthenticatedUser,
    budgetId: string,
    input: UpdateBudgetStateInput,
    auditMetadata?: AuditMetadata,
  ) {
    if (input.state === BudgetState.APPROVED || input.state === BudgetState.REVISED) {
      assertBudgetApprovalPermissions(actor);
    } else {
      assertBudgetManagementPermissions(actor);
    }

    const budget = await budgetsRepository.findById(budgetId);

    if (!budget) {
      throw new AppError(404, "Budget not found.");
    }

    assertEventScopedAccess(
      actor,
      budget.eventId,
      input.state === BudgetState.APPROVED || input.state === BudgetState.REVISED
        ? budgetApprovalRoles
        : budgetManagementRoles,
    );

    assertBudgetStateTransition(budget.state, input.state);

    if (
      (input.state === BudgetState.APPROVED || input.state === BudgetState.REVISED) &&
      budget.createdById === actor.id
    ) {
      throw new AppError(409, "Self-approval is not allowed for budget versions.");
    }

    const updatedBudget =
      input.state === BudgetState.APPROVED
        ? await prisma.$transaction(async (tx) => {
            const approvedBudget = await budgetsRepository.updateBudgetState(
              budgetId,
              input.state,
              tx,
            );
            await budgetsRepository.deactivateEventBudgets(approvedBudget.eventId, tx);
            return budgetsRepository.activateBudget(budgetId, tx);
          })
        : input.state === BudgetState.REVISED
          ? await budgetsRepository.markBudgetRevised(budgetId)
          : await budgetsRepository.updateBudgetState(budgetId, input.state);

    await auditService.record({
      actorId: actor.id,
      action: "budgets.update_state",
      entityType: "Budget",
      entityId: updatedBudget.id,
      summary: `Changed budget version ${updatedBudget.version} state to ${updatedBudget.state}`,
      context: {
        eventId: updatedBudget.event.id,
        previousState: budget.state,
        nextState: updatedBudget.state,
        autoActivated: input.state === BudgetState.APPROVED,
      },
      ...auditMetadata,
    });

    return mapBudget(updatedBudget);
  },

  async activateBudget(
    actor: AuthenticatedUser,
    budgetId: string,
    auditMetadata?: AuditMetadata,
  ) {
    assertBudgetManagementPermissions(actor);

    const budget = await budgetsRepository.findById(budgetId);

    if (!budget) {
      throw new AppError(404, "Budget not found.");
    }

    assertEventScopedAccess(actor, budget.eventId, budgetManagementRoles);

    if (budget.state !== BudgetState.APPROVED) {
      throw new AppError(409, "Only approved budget versions can be activated.");
    }

    if (budget.isActive) {
      return mapBudget(budget);
    }

    const activatedBudget = await prisma.$transaction(async (tx) => {
      await budgetsRepository.deactivateEventBudgets(budget.eventId, tx);
      return budgetsRepository.activateBudget(budgetId, tx);
    });

    await auditService.record({
      actorId: actor.id,
      action: "budgets.activate",
      entityType: "Budget",
      entityId: activatedBudget.id,
      summary: `Activated budget version ${activatedBudget.version} for ${activatedBudget.event.title}`,
      context: {
        eventId: activatedBudget.event.id,
        version: activatedBudget.version,
      },
      ...auditMetadata,
    });

    return mapBudget(activatedBudget);
  },
};
