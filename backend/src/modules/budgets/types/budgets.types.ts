import type { BudgetState } from "@prisma/client";

export type BudgetItemInput = {
  category: string;
  label: string;
  amount: string;
  notes?: string | undefined;
};

export type BudgetFilters = {
  eventId?: string | undefined;
  state?: BudgetState | undefined;
  isActive?: boolean | undefined;
};

export type CreateBudgetInput = {
  eventId: string;
  title?: string | undefined;
  items: BudgetItemInput[];
  submit?: boolean | undefined;
};

export type ReviseBudgetInput = {
  title?: string | undefined;
  items: BudgetItemInput[];
  submit?: boolean | undefined;
};

export type UpdateBudgetStateInput = {
  state: Exclude<BudgetState, "REVISED">;
};
