-- Move reconciliation report JSON from the legacy warnings column to the correctly named payload column.
ALTER TABLE "ReconciliationReport" ADD COLUMN IF NOT EXISTS "payload" JSONB;

UPDATE "ReconciliationReport"
SET "payload" = "warnings"
WHERE "payload" IS NULL AND "warnings" IS NOT NULL;

ALTER TABLE "ReconciliationReport" DROP COLUMN IF EXISTS "warnings";
