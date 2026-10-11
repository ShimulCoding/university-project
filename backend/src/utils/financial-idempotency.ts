import { createHash } from "node:crypto";
import { FinancialOperation, Prisma } from "@prisma/client";
import type { Request, RequestHandler } from "express";

import type { AuthenticatedUser } from "../types/auth";
import { AppError } from "./app-error";
import { governanceTransaction } from "./governance-transaction";

export function financialRequestKey(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new AppError(400, "A random UUID Idempotency-Key is required for this financial submission.");
  }
  return value.toLowerCase();
}

export function getFinancialRequestKey(request: Request) {
  return financialRequestKey(request.headers["idempotency-key"]);
}

export const requireFinancialRequestKey: RequestHandler = (request, _response, next) => {
  getFinancialRequestKey(request);
  next();
};

// Hash validated, normalized fields in a fixed caller-defined order. Files are
// identified by their content and metadata, never by newly randomized paths.
export function financialInputHash(fields: readonly unknown[], files: Express.Multer.File[] | undefined) {
  const attachments = (files ?? []).map((file) => {
    if (!Buffer.isBuffer(file.buffer) || file.buffer.length !== file.size) {
      throw new AppError(400, "Uploaded file is incomplete.");
    }
    return [file.originalname, file.mimetype, file.size, createHash("sha256").update(file.buffer).digest("hex")];
  });
  return createHash("sha256").update(JSON.stringify([fields, attachments])).digest("hex");
}

export type FinancialSubmission = {
  actorId: string;
  eventId: string;
  operation: FinancialOperation;
  key: string;
  inputHash: string;
};

// Call only AFTER current owning-event authorization in the transaction.
export async function findFinancialReplay(tx: Prisma.TransactionClient, submission: FinancialSubmission) {
  const stored = await tx.financialIdempotency.findUnique({ where: { actorId_operation_key: {
    actorId: submission.actorId, operation: submission.operation, key: submission.key,
  } } });
  if (!stored) return null;
  if (stored.eventId !== submission.eventId || stored.inputHash !== submission.inputHash) {
    throw new AppError(409, "This submission was already used with different details. Retry the original submission.");
  }
  return stored.operation === FinancialOperation.INCOME_CREATE ? stored.incomeRecordId : stored.expenseRecordId;
}

export function recordFinancialResult(tx: Prisma.TransactionClient, submission: FinancialSubmission, resultId: string) {
  return tx.financialIdempotency.create({ data: {
    ...submission,
    ...(submission.operation === FinancialOperation.INCOME_CREATE ? { incomeRecordId: resultId } : { expenseRecordId: resultId }),
  } });
}

// Serializable conflicts use the shared retry policy. PostgreSQL may instead
// report a unique conflict for same-key inserts; retry only this exact marker
// constraint, starting a fresh fully authorized governance transaction.
export async function financialTransaction<T>(actor: AuthenticatedUser, action: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return await governanceTransaction(action, actor); }
    catch (error) {
      const target = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" ? error.meta?.target : null;
      if (!Array.isArray(target) || target.length !== 3 || !["actorId", "operation", "key"].every((field) => target.includes(field))) throw error;
      if (attempt === 2) throw new AppError(409, "The submission is being processed. Please retry with the same details.");
    }
  }
  throw new AppError(409, "Please retry the same submission.");
}
