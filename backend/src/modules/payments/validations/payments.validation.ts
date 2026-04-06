import { IncomeSourceType } from "@prisma/client";
import { z } from "zod";

const optionalDateField = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional(),
);

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

const optionalMoneyField = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  moneyField.optional(),
);

export const submitPaymentProofSchema = z.object({
  params: z.object({
    registrationId: z.string().cuid(),
  }),
  body: z.object({
    externalChannel: z.string().trim().min(2).max(80),
    transactionReference: z.string().trim().max(120).optional(),
    referenceText: z.string().trim().max(2000).optional(),
    amount: optionalMoneyField,
  }),
});

export const listVerificationQueueSchema = z.object({
  query: z.object({
    eventId: z.string().cuid().optional(),
    search: z.string().trim().max(120).optional(),
  }),
});

export const paymentProofDecisionSchema = z.object({
  params: z.object({
    paymentProofId: z.string().cuid(),
  }),
  body: z
    .object({
      decision: z.enum(["APPROVE", "REJECT"]),
      remark: z.string().trim().max(1000).optional(),
    })
    .refine((value) => value.decision === "APPROVE" || Boolean(value.remark?.trim()), {
      message: "A reviewer remark is required when rejecting a payment proof.",
      path: ["remark"],
    }),
});

export const createIncomeRecordSchema = z.object({
  body: z.object({
    eventId: z.string().cuid(),
    sourceType: z.nativeEnum(IncomeSourceType),
    sourceLabel: z.string().trim().min(2).max(150),
    amount: moneyField,
    referenceText: z.string().trim().max(2000).optional(),
    collectedAt: optionalDateField,
  }),
});

export const listIncomeRecordsSchema = z.object({
  query: z.object({
    eventId: z.string().cuid().optional(),
    search: z.string().trim().max(120).optional(),
  }),
});

export const incomeRecordIdParamSchema = z.object({
  params: z.object({
    incomeRecordId: z.string().cuid(),
  }),
});
