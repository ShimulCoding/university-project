import type { IncomeSourceType } from "@prisma/client";

export type SubmitPaymentProofInput = {
  externalChannel: string;
  transactionReference?: string | undefined;
  referenceText?: string | undefined;
  amount?: string | undefined;
};

export type PaymentVerificationQueueFilters = {
  eventId?: string | undefined;
  search?: string | undefined;
};

export type PaymentProofDecisionInput = {
  decision: "APPROVE" | "REJECT";
  remark?: string | undefined;
};

export type CreateIncomeRecordInput = {
  eventId: string;
  sourceType: IncomeSourceType;
  sourceLabel: string;
  amount: string;
  referenceText?: string | undefined;
  collectedAt?: Date | undefined;
};

export type IncomeRecordFilters = {
  eventId?: string | undefined;
  search?: string | undefined;
};
