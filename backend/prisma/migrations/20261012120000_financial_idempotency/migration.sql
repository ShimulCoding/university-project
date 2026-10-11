CREATE TYPE "FinancialOperation" AS ENUM ('INCOME_CREATE', 'EXPENSE_CREATE');

CREATE TABLE "FinancialIdempotency" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "operation" "FinancialOperation" NOT NULL,
    "key" UUID NOT NULL,
    "inputHash" CHAR(64) NOT NULL,
    "incomeRecordId" TEXT,
    "expenseRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinancialIdempotency_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FinancialIdempotency_result_check" CHECK (
        ("operation" = 'INCOME_CREATE' AND "incomeRecordId" IS NOT NULL AND "expenseRecordId" IS NULL)
        OR ("operation" = 'EXPENSE_CREATE' AND "expenseRecordId" IS NOT NULL AND "incomeRecordId" IS NULL)
    )
);

CREATE UNIQUE INDEX "FinancialIdempotency_actorId_operation_key_key" ON "FinancialIdempotency"("actorId", "operation", "key");
CREATE UNIQUE INDEX "FinancialIdempotency_incomeRecordId_key" ON "FinancialIdempotency"("incomeRecordId");
CREATE UNIQUE INDEX "FinancialIdempotency_expenseRecordId_key" ON "FinancialIdempotency"("expenseRecordId");
CREATE INDEX "FinancialIdempotency_eventId_idx" ON "FinancialIdempotency"("eventId");

ALTER TABLE "FinancialIdempotency" ADD CONSTRAINT "FinancialIdempotency_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialIdempotency" ADD CONSTRAINT "FinancialIdempotency_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialIdempotency" ADD CONSTRAINT "FinancialIdempotency_incomeRecordId_fkey" FOREIGN KEY ("incomeRecordId") REFERENCES "IncomeRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancialIdempotency" ADD CONSTRAINT "FinancialIdempotency_expenseRecordId_fkey" FOREIGN KEY ("expenseRecordId") REFERENCES "ExpenseRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
