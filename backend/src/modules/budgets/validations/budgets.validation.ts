import { moneyField } from "../../../utils/money-validation";
import { BudgetState } from "@prisma/client";
import { z } from "zod";

import { paginationQuerySchema } from "../../../utils/pagination-validation";


const optionalBooleanField = z.preprocess(
  (value) => {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return value;
  },
  z.boolean().optional(),
);

const budgetItemSchema = z.object({
  category: z.string().trim().min(2).max(80),
  label: z.string().trim().min(2).max(140),
  amount: moneyField,
  notes: z.string().trim().max(1000).optional(),
});

const budgetBodySchema = z.object({
  title: z.string().trim().max(160).optional(),
  items: z.array(budgetItemSchema).min(1).max(100),
  submit: optionalBooleanField,
});

export const listBudgetsSchema = z.object({
  query: z.object({
    ...paginationQuerySchema,
    eventId: z.string().cuid().optional(),
    state: z.nativeEnum(BudgetState).optional(),
    isActive: optionalBooleanField,
  }),
});

export const budgetIdParamSchema = z.object({
  params: z.object({
    budgetId: z.string().cuid(),
  }),
});

export const createBudgetSchema = z.object({
  body: budgetBodySchema.extend({
    eventId: z.string().cuid(),
  }),
});

export const reviseBudgetSchema = z.object({
  params: z.object({
    budgetId: z.string().cuid(),
  }),
  body: budgetBodySchema,
});

export const updateBudgetStateSchema = z.object({
  params: z.object({
    budgetId: z.string().cuid(),
  }),
  body: z.object({
    state: z.nativeEnum(BudgetState),
  }),
});
