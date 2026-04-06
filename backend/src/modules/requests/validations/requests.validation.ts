import { ExpenseRecordState, RequestState } from "@prisma/client";
import { z } from "zod";

const moneyField = z.preprocess(
  (value) => {
    if (typeof value === "number") {
      return value.toString();
    }

    if (typeof value === "string") {
      return value.trim();
    }

    return value;
  },
  z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid monetary value."),
);

const optionalDateField = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

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

export const listRequestsSchema = z.object({
  query: z.object({
    eventId: z.string().cuid().optional(),
    state: z.nativeEnum(RequestState).optional(),
  }),
});

export const listExpenseRecordsSchema = z.object({
  query: z.object({
    eventId: z.string().cuid().optional(),
    state: z.nativeEnum(ExpenseRecordState).optional(),
    expenseRequestId: z.string().cuid().optional(),
  }),
});

export const budgetRequestIdParamSchema = z.object({
  params: z.object({
    budgetRequestId: z.string().cuid(),
  }),
});

export const expenseRequestIdParamSchema = z.object({
  params: z.object({
    expenseRequestId: z.string().cuid(),
  }),
});

export const expenseRecordIdParamSchema = z.object({
  params: z.object({
    expenseRecordId: z.string().cuid(),
  }),
});

export const createBudgetRequestSchema = z.object({
  body: z.object({
    eventId: z.string().cuid(),
    amount: moneyField,
    purpose: z.string().trim().min(3).max(200),
    justification: z.string().trim().max(2000).optional(),
    submit: optionalBooleanField,
  }),
});

export const updateBudgetRequestSchema = z.object({
  params: z.object({
    budgetRequestId: z.string().cuid(),
  }),
  body: z.object({
    amount: moneyField.optional(),
    purpose: z.string().trim().min(3).max(200).optional(),
    justification: z.string().trim().max(2000).optional(),
  }),
});

export const createExpenseRequestSchema = z.object({
  body: z.object({
    eventId: z.string().cuid(),
    amount: moneyField,
    category: z.string().trim().min(2).max(80),
    purpose: z.string().trim().min(3).max(200),
    justification: z.string().trim().max(2000).optional(),
    submit: optionalBooleanField,
  }),
});

export const updateExpenseRequestSchema = z.object({
  params: z.object({
    expenseRequestId: z.string().cuid(),
  }),
  body: z.object({
    amount: moneyField.optional(),
    category: z.string().trim().min(2).max(80).optional(),
    purpose: z.string().trim().min(3).max(200).optional(),
    justification: z.string().trim().max(2000).optional(),
  }),
});

export const createExpenseRecordSchema = z.object({
  body: z.object({
    eventId: z.string().cuid(),
    expenseRequestId: z.string().cuid().optional(),
    amount: moneyField,
    category: z.string().trim().min(2).max(80),
    description: z.string().trim().min(3).max(2000),
    paidAt: optionalDateField,
  }),
});

export const settleExpenseRecordSchema = z.object({
  params: z.object({
    expenseRecordId: z.string().cuid(),
  }),
  body: z.object({
    paidAt: optionalDateField,
  }),
});

export const voidExpenseRecordSchema = z.object({
  params: z.object({
    expenseRecordId: z.string().cuid(),
  }),
  body: z.object({
    reason: z.string().trim().min(3).max(1000),
  }),
});
