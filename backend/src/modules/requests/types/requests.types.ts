import type { ExpenseRecordState, RequestState } from "@prisma/client";

export type RequestFilters = {
  eventId?: string | undefined;
  state?: RequestState | undefined;
};

export type ExpenseRecordFilters = {
  eventId?: string | undefined;
  state?: ExpenseRecordState | undefined;
  expenseRequestId?: string | undefined;
};

export type CreateBudgetRequestInput = {
  eventId: string;
  amount: string;
  purpose: string;
  justification?: string | null | undefined;
  submit?: boolean | undefined;
};

export type UpdateBudgetRequestInput = {
  amount?: string | undefined;
  purpose?: string | undefined;
  justification?: string | null | undefined;
};

export type CreateExpenseRequestInput = {
  eventId: string;
  amount: string;
  category: string;
  purpose: string;
  justification?: string | null | undefined;
  submit?: boolean | undefined;
};

export type UpdateExpenseRequestInput = {
  amount?: string | undefined;
  category?: string | undefined;
  purpose?: string | undefined;
  justification?: string | null | undefined;
};

export type CreateExpenseRecordInput = {
  eventId: string;
  expenseRequestId?: string | undefined;
  amount: string;
  category: string;
  description: string;
  paidAt?: Date | undefined;
};

export type SettleExpenseRecordInput = {
  paidAt?: Date | undefined;
};

export type VoidExpenseRecordInput = {
  reason: string;
};
