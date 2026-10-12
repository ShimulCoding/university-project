-- REVIEWED PREPARATION ONLY. Run after approval on a NEW isolated fake database.
-- psql variables: database_name, runtime_role, migration_role; identifiers are quoted.
-- No passwords, real-user data, DROP, object ownership transfer or listener change.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('scale.database_name', :'database_name', true);
SELECT set_config('scale.runtime_role', :'runtime_role', true);
SELECT set_config('scale.migration_role', :'migration_role', true);
DO $$
DECLARE
  runtime_name text := current_setting('scale.runtime_role');
  migration_name text := current_setting('scale.migration_role');
  expected text[] := ARRAY[
    'ApprovalDecision','AuditLog','Budget','BudgetItem','BudgetRequest','Complaint',
    'ComplaintRouting','Event','EventTeamMember','ExpenseRecord','ExpenseRequest',
    'FinancialIdempotency','IncomeRecord','MfaChallenge','MfaEnrollmentGrant',
    'MfaFactor','MfaRecoveryCode','PasswordResetToken','PaymentProof',
    'PublicSummarySnapshot','ReconciliationReport','RefreshToken','Registration',
    'Role','SupportingDocument','User','UserRole','_prisma_migrations'
  ];
  actual text[];
BEGIN
  IF current_database() <> current_setting('scale.database_name') OR
     current_database() !~ '^mu_scale_[a-z0-9_]+$' OR
     runtime_name !~ '^mu_scale_[a-z0-9_]+_runtime$' OR
     migration_name !~ '^mu_scale_[a-z0-9_]+_migration$' OR runtime_name = migration_name OR
     runtime_name <> current_database() || '_runtime' OR
     migration_name <> current_database() || '_migration' THEN
    RAISE EXCEPTION 'Refusing unexpected database or role scope';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = runtime_name AND rolcanlogin
    AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls)) OR
    NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = migration_name AND rolcanlogin
    AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls)) OR
    EXISTS (SELECT 1 FROM pg_auth_members WHERE member IN
      (SELECT oid FROM pg_roles WHERE rolname IN (runtime_name, migration_name))) THEN
    RAISE EXCEPTION 'Unexpected role attributes or memberships';
  END IF;
  IF (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = current_database()) <> migration_name THEN
    RAISE EXCEPTION 'Isolated database must be owned by the separate migrator';
  END IF;
  SELECT array_agg(tablename ORDER BY tablename COLLATE "C") INTO actual
    FROM pg_tables WHERE schemaname = 'public';
  SELECT array_agg(value ORDER BY value COLLATE "C") INTO expected FROM unnest(expected) AS value;
  IF actual IS DISTINCT FROM expected OR EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tableowner <> migration_name
  ) THEN RAISE EXCEPTION 'Unexpected schema or table ownership'; END IF;
  IF EXISTS (SELECT 1 FROM public."User") THEN
    RAISE EXCEPTION 'Apply initial fixture grants before adding any user data';
  END IF;
END $$;

REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database_name" TO :"runtime_role";
GRANT CONNECT ON DATABASE :"database_name" TO :"migration_role";
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE ON TABLE
  public."User", public."Role", public."UserRole", public."EventTeamMember",
  public."RefreshToken", public."MfaFactor", public."MfaChallenge",
  public."MfaRecoveryCode", public."MfaEnrollmentGrant", public."PasswordResetToken",
  public."Event", public."Registration", public."PaymentProof", public."Budget",
  public."BudgetItem", public."BudgetRequest", public."ExpenseRequest",
  public."ExpenseRecord", public."IncomeRecord", public."SupportingDocument",
  public."ApprovalDecision", public."Complaint", public."ComplaintRouting",
  public."ReconciliationReport", public."PublicSummarySnapshot"
TO :"runtime_role";
GRANT SELECT, INSERT ON TABLE public."AuditLog", public."FinancialIdempotency" TO :"runtime_role";
GRANT DELETE ON TABLE public."RefreshToken", public."PasswordResetToken", public."MfaChallenge" TO :"runtime_role";
DO $$
DECLARE runtime_name text := current_setting('scale.runtime_role');
BEGIN
  IF has_database_privilege(runtime_name, current_database(), 'TEMP, CREATE') OR
    has_schema_privilege(runtime_name, 'public', 'CREATE') OR
    has_table_privilege(runtime_name, 'public."AuditLog"', 'UPDATE, DELETE, TRUNCATE, INSERT WITH GRANT OPTION') OR
    has_table_privilege(runtime_name, 'public."FinancialIdempotency"', 'UPDATE, DELETE, TRUNCATE, INSERT WITH GRANT OPTION') OR
    has_table_privilege(runtime_name, 'public."_prisma_migrations"', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') THEN
    RAISE EXCEPTION 'Runtime grants exceed the reviewed boundary';
  END IF;
END $$;
COMMIT;
