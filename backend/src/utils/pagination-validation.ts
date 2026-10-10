import { z } from "zod";

const paginationNumberField = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") {
      return undefined;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  },
  z.number().int().positive().max(1_000_000).optional(),
);

export const paginationQuerySchema = {
  page: paginationNumberField,
  pageSize: paginationNumberField,
} as const;
