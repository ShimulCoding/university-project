import { Prisma } from "@prisma/client";

export const budgetDetailInclude = Prisma.validator<Prisma.BudgetInclude>()({
  event: {
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  items: {
    orderBy: [{ category: "asc" }, { label: "asc" }],
  },
});

export type BudgetWithContext = Prisma.BudgetGetPayload<{
  include: typeof budgetDetailInclude;
}>;

function mapBudgetItem(item: BudgetWithContext["items"][number]) {
  return {
    id: item.id,
    category: item.category,
    label: item.label,
    amount: item.amount.toString(),
    notes: item.notes ?? null,
  };
}

export function mapBudget(budget: BudgetWithContext) {
  return {
    id: budget.id,
    version: budget.version,
    title: budget.title ?? null,
    state: budget.state,
    totalAmount: budget.totalAmount ? budget.totalAmount.toString() : null,
    isActive: budget.isActive,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    event: {
      id: budget.event.id,
      title: budget.event.title,
      slug: budget.event.slug,
      status: budget.event.status,
    },
    createdBy: budget.createdBy
      ? {
          id: budget.createdBy.id,
          fullName: budget.createdBy.fullName,
          email: budget.createdBy.email,
        }
      : null,
    items: budget.items.map(mapBudgetItem),
  };
}
