ALTER TABLE "ReconciliationReport"
ADD COLUMN "isStale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "staleReason" TEXT,
ADD COLUMN "staledAt" TIMESTAMP(3);
