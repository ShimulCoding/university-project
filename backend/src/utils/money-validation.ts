import { z } from "zod";

// All individual money columns use PostgreSQL DECIMAL(12, 2).
export const moneyField = z.preprocess(
  (value) => typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : value,
  z.string().max(32).regex(/^\d+(\.\d{1,2})?$/, "Amount must be a valid monetary value.")
    .refine((value) => Number(value) > 0 && Number(value) <= 9_999_999_999.99,
      "Amount must be greater than zero and at most 9,999,999,999.99."),
);
