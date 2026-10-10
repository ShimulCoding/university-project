-- Preflight duplicates before deployment. Fail safely rather than deleting history.
CREATE UNIQUE INDEX "Registration_eventId_participantId_key" ON "Registration"("eventId", "participantId");
CREATE UNIQUE INDEX "PaymentProof_one_pending_per_registration" ON "PaymentProof"("registrationId") WHERE "state" = 'PENDING_VERIFICATION';
CREATE UNIQUE INDEX "Budget_one_active_per_event" ON "Budget"("eventId") WHERE "isActive" = true;

-- Report aggregates can exceed the limit of an individual transaction.
ALTER TABLE "ReconciliationReport"
  ALTER COLUMN "totalIncome" TYPE DECIMAL(18,2),
  ALTER COLUMN "totalExpense" TYPE DECIMAL(18,2),
  ALTER COLUMN "closingBalance" TYPE DECIMAL(18,2);
ALTER TABLE "PublicSummarySnapshot"
  ALTER COLUMN "totalCollected" TYPE DECIMAL(18,2),
  ALTER COLUMN "totalSpent" TYPE DECIMAL(18,2),
  ALTER COLUMN "closingBalance" TYPE DECIMAL(18,2);
