-- REVIEW ONLY: run by a database operator after approval, never automatically.
-- Creates a new runtime role; errors if it already exists, preserving its policy.
-- No password or application record is included/changed by this script.
BEGIN;
CREATE ROLE mu_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
GRANT CONNECT ON DATABASE mu_cse_transparency TO mu_runtime;
GRANT USAGE ON SCHEMA public TO mu_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE
  public."User", public."Role", public."UserRole", public."EventTeamMember",
  public."RefreshToken", public."MfaFactor", public."MfaChallenge",
  public."MfaRecoveryCode", public."MfaEnrollmentGrant", public."PasswordResetToken",
  public."Event", public."Registration", public."PaymentProof", public."Budget",
  public."BudgetItem", public."BudgetRequest", public."ExpenseRequest",
  public."ExpenseRecord", public."IncomeRecord", public."SupportingDocument",
  public."ApprovalDecision", public."Complaint", public."ComplaintRouting",
  public."ReconciliationReport", public."PublicSummarySnapshot"
TO mu_runtime;
GRANT SELECT, INSERT ON TABLE public."AuditLog" TO mu_runtime;
-- Ledger retry markers are immutable after their atomic creation.
GRANT SELECT, INSERT ON TABLE public."FinancialIdempotency" TO mu_runtime;
-- The runtime maintenance job prunes only these expiring authentication records.
GRANT DELETE ON TABLE public."RefreshToken", public."PasswordResetToken", public."MfaChallenge" TO mu_runtime;
-- Do not grant ownership, schema creation, migrations-table access or audit edits.
-- Fail rather than silently inheriting an existing broad PUBLIC grant.
DO $$ BEGIN
  IF has_schema_privilege('mu_runtime', 'public', 'CREATE') OR
     has_table_privilege('mu_runtime', 'public."AuditLog"', 'UPDATE, DELETE, TRUNCATE') OR
     has_table_privilege('mu_runtime', 'public."FinancialIdempotency"', 'UPDATE, DELETE, TRUNCATE') THEN
    RAISE EXCEPTION 'Review inherited PUBLIC privileges before provisioning the runtime role.';
  END IF;
END $$;
COMMIT;

-- Then use psql's interactive \password mu_runtime command; never put passwords
-- in this script, shell arguments, history, reports or version control.
