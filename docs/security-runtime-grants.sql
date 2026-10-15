-- REVIEW ONLY: no permission cutover is authorized by storing this file.
-- Read scalability/runtime-cutover-sql-review.md and prove on fake PostgreSQL first.
-- Explicit psql parameters: database_name, runtime_role, migration_role,
-- operator_role, reviewed_policy=2026-10-12-column-grants-v1.
-- The old handoff command without these parameters refuses before BEGIN.
-- Creates only a NEW runtime role; no passwords, records, ownership transfers,
-- PUBLIC revocation, existing role changes or future/default grants.
\set ON_ERROR_STOP on
\if :{?database_name}
\else
  DO $missing$ BEGIN RAISE EXCEPTION 'Missing explicit approved database_name'; END $missing$;
\endif
\if :{?runtime_role}
\else
  DO $missing$ BEGIN RAISE EXCEPTION 'Missing explicit new runtime_role'; END $missing$;
\endif
\if :{?migration_role}
\else
  DO $missing$ BEGIN RAISE EXCEPTION 'Missing explicit separate migration_role'; END $missing$;
\endif
\if :{?operator_role}
\else
  DO $missing$ BEGIN RAISE EXCEPTION 'Missing explicit current operator_role'; END $missing$;
\endif
\if :{?reviewed_policy}
\else
  DO $missing$ BEGIN RAISE EXCEPTION 'Missing explicit reviewed_policy'; END $missing$;
\endif

BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT set_config('security_cutover.database_name', :'database_name', true);
SELECT set_config('security_cutover.runtime_role', :'runtime_role', true);
SELECT set_config('security_cutover.migration_role', :'migration_role', true);
SELECT set_config('security_cutover.operator_role', :'operator_role', true);
SELECT set_config('security_cutover.reviewed_policy', :'reviewed_policy', true);

DO $policy$
DECLARE
  database_name text := current_setting('security_cutover.database_name');
  runtime_name text := current_setting('security_cutover.runtime_role');
  migration_name text := current_setting('security_cutover.migration_role');
  operator_name text := current_setting('security_cutover.operator_role');
  migration_oid oid;
  public_oid oid;
  expected_tables text[];
  actual_tables text[];
  actual_columns jsonb;
  actual_enums jsonb;
  update_columns text;
  target record;
  -- [PostgreSQL format_type, nullable, primary-key member]. Changes need review.
  expected_columns jsonb := $column_manifest${
"User":{"id":["text",false,true],"fullName":["text",false,false],"email":["text",false,false],"passwordHash":["text",false,false],"sessionVersion":["integer",false,false],"studentId":["text",true,false],"batch":["text",true,false],"department":["text",true,false],"section":["text",true,false],"status":["public.\"AccountStatus\"",false,false],"lastLoginAt":["timestamp(3) without time zone",true,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"Role":{"id":["text",false,true],"code":["public.\"RoleCode\"",false,false],"name":["text",false,false],"description":["text",true,false],"isSystem":["boolean",false,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"UserRole":{"id":["text",false,true],"userId":["text",false,false],"roleId":["text",false,false],"assignedById":["text",true,false],"assignedAt":["timestamp(3) without time zone",false,false],"revokedAt":["timestamp(3) without time zone",true,false]},
"EventTeamMember":{"id":["text",false,true],"eventId":["text",false,false],"userId":["text",false,false],"roleCode":["public.\"RoleCode\"",false,false],"assignedById":["text",true,false],"assignedAt":["timestamp(3) without time zone",false,false],"revokedAt":["timestamp(3) without time zone",true,false]},
"RefreshToken":{"id":["text",false,true],"userId":["text",false,false],"tokenHash":["text",false,false],"expiresAt":["timestamp(3) without time zone",false,false],"lastUsedAt":["timestamp(3) without time zone",true,false],"mfaVerifiedAt":["timestamp(3) without time zone",true,false],"revokedAt":["timestamp(3) without time zone",true,false],"userAgent":["text",true,false],"ipAddress":["text",true,false],"createdAt":["timestamp(3) without time zone",false,false]},
"MfaFactor":{"userId":["text",false,true],"encryptedSecret":["text",false,false],"lastTimeStep":["integer",true,false],"enrolledAt":["timestamp(3) without time zone",false,false]},
"MfaChallenge":{"id":["text",false,true],"tokenHash":["text",false,false],"userId":["text",false,false],"sessionVersion":["integer",false,false],"loginScope":["text",false,false],"eventId":["text",true,false],"mode":["text",false,false],"pendingEncryptedSecret":["text",true,false],"enrollmentGrantId":["text",true,false],"attempts":["integer",false,false],"expiresAt":["timestamp(3) without time zone",false,false],"consumedAt":["timestamp(3) without time zone",true,false],"createdAt":["timestamp(3) without time zone",false,false]},
"MfaRecoveryCode":{"id":["text",false,true],"userId":["text",false,false],"codeHash":["text",false,false],"usedAt":["timestamp(3) without time zone",true,false],"createdAt":["timestamp(3) without time zone",false,false]},
"MfaEnrollmentGrant":{"id":["text",false,true],"userId":["text",false,false],"issuedById":["text",true,false],"tokenHash":["text",false,false],"sessionVersion":["integer",false,false],"expiresAt":["timestamp(3) without time zone",false,false],"usedAt":["timestamp(3) without time zone",true,false],"revokedAt":["timestamp(3) without time zone",true,false],"createdAt":["timestamp(3) without time zone",false,false]},
"PasswordResetToken":{"id":["text",false,true],"userId":["text",false,false],"tokenHash":["text",false,false],"expiresAt":["timestamp(3) without time zone",false,false],"usedAt":["timestamp(3) without time zone",true,false],"createdAt":["timestamp(3) without time zone",false,false]},
"Event":{"id":["text",false,true],"title":["text",false,false],"slug":["text",false,false],"description":["text",true,false],"status":["public.\"EventStatus\"",false,false],"registrationOpensAt":["timestamp(3) without time zone",true,false],"registrationClosesAt":["timestamp(3) without time zone",true,false],"startsAt":["timestamp(3) without time zone",true,false],"endsAt":["timestamp(3) without time zone",true,false],"capacity":["integer",true,false],"createdById":["text",true,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"Registration":{"id":["text",false,true],"eventId":["text",false,false],"participantId":["text",true,false],"participantName":["text",false,false],"studentId":["text",false,false],"email":["text",false,false],"phone":["text",true,false],"registrationCode":["text",false,false],"paymentState":["public.\"RegistrationPaymentState\"",false,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"PaymentProof":{"id":["text",false,true],"registrationId":["text",false,false],"externalChannel":["text",false,false],"transactionReference":["text",true,false],"referenceText":["text",true,false],"amount":["numeric(12,2)",true,false],"state":["public.\"PaymentProofState\"",false,false],"submittedAt":["timestamp(3) without time zone",false,false],"reviewedAt":["timestamp(3) without time zone",true,false],"reviewerRemark":["text",true,false],"reviewedById":["text",true,false]},
"Budget":{"id":["text",false,true],"eventId":["text",false,false],"version":["integer",false,false],"title":["text",true,false],"state":["public.\"BudgetState\"",false,false],"totalAmount":["numeric(12,2)",true,false],"isActive":["boolean",false,false],"createdById":["text",true,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"BudgetItem":{"id":["text",false,true],"budgetId":["text",false,false],"category":["text",false,false],"label":["text",false,false],"amount":["numeric(12,2)",false,false],"notes":["text",true,false]},
"BudgetRequest":{"id":["text",false,true],"eventId":["text",false,false],"requestedById":["text",true,false],"amount":["numeric(12,2)",false,false],"purpose":["text",false,false],"justification":["text",true,false],"state":["public.\"RequestState\"",false,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"ExpenseRequest":{"id":["text",false,true],"eventId":["text",false,false],"requestedById":["text",true,false],"amount":["numeric(12,2)",false,false],"category":["text",false,false],"purpose":["text",false,false],"justification":["text",true,false],"state":["public.\"RequestState\"",false,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"ExpenseRecord":{"id":["text",false,true],"eventId":["text",false,false],"expenseRequestId":["text",true,false],"recordedById":["text",true,false],"amount":["numeric(12,2)",false,false],"category":["text",false,false],"description":["text",false,false],"state":["public.\"ExpenseRecordState\"",false,false],"paidAt":["timestamp(3) without time zone",true,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"IncomeRecord":{"id":["text",false,true],"eventId":["text",false,false],"sourceType":["public.\"IncomeSourceType\"",false,false],"sourceLabel":["text",false,false],"amount":["numeric(12,2)",false,false],"referenceText":["text",true,false],"collectedAt":["timestamp(3) without time zone",true,false],"recordedById":["text",true,false],"verifiedById":["text",true,false],"state":["public.\"IncomeState\"",false,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"FinancialIdempotency":{"id":["text",false,true],"actorId":["text",false,false],"eventId":["text",false,false],"operation":["public.\"FinancialOperation\"",false,false],"key":["uuid",false,false],"inputHash":["character(64)",false,false],"incomeRecordId":["text",true,false],"expenseRecordId":["text",true,false],"createdAt":["timestamp(3) without time zone",false,false]},
"SupportingDocument":{"id":["text",false,true],"category":["public.\"DocumentCategory\"",false,false],"storageDisk":["public.\"StorageDisk\"",false,false],"originalName":["text",false,false],"mimeType":["text",false,false],"storedName":["text",false,false],"relativePath":["text",false,false],"sizeBytes":["bigint",false,false],"uploadedById":["text",true,false],"paymentProofId":["text",true,false],"incomeRecordId":["text",true,false],"budgetRequestId":["text",true,false],"expenseRequestId":["text",true,false],"expenseRecordId":["text",true,false],"complaintId":["text",true,false],"createdAt":["timestamp(3) without time zone",false,false]},
"ApprovalDecision":{"id":["text",false,true],"entityType":["public.\"ApprovalEntityType\"",false,false],"decision":["public.\"ApprovalDecisionType\"",false,false],"comment":["text",true,false],"actorId":["text",false,false],"budgetRequestId":["text",true,false],"expenseRequestId":["text",true,false],"createdAt":["timestamp(3) without time zone",false,false]},
"Complaint":{"id":["text",false,true],"eventId":["text",true,false],"submittedById":["text",true,false],"subject":["text",false,false],"description":["text",false,false],"state":["public.\"ComplaintState\"",false,false],"createdAt":["timestamp(3) without time zone",false,false],"updatedAt":["timestamp(3) without time zone",false,false]},
"ComplaintRouting":{"id":["text",false,true],"complaintId":["text",false,false],"fromRoleId":["text",true,false],"toRoleId":["text",true,false],"routedById":["text",true,false],"note":["text",true,false],"state":["public.\"ComplaintState\"",false,false],"createdAt":["timestamp(3) without time zone",false,false]},
"ReconciliationReport":{"id":["text",false,true],"eventId":["text",false,false],"status":["public.\"ReconciliationState\"",false,false],"totalIncome":["numeric(18,2)",false,false],"totalExpense":["numeric(18,2)",false,false],"closingBalance":["numeric(18,2)",false,false],"payload":["jsonb",true,false],"isStale":["boolean",false,false],"staleReason":["text",true,false],"staledAt":["timestamp(3) without time zone",true,false],"generatedById":["text",true,false],"reviewedById":["text",true,false],"createdAt":["timestamp(3) without time zone",false,false],"finalizedAt":["timestamp(3) without time zone",true,false]},
"PublicSummarySnapshot":{"id":["text",false,true],"eventId":["text",false,false],"reconciliationReportId":["text",false,false],"status":["public.\"PublicSummaryStatus\"",false,false],"publishedById":["text",true,false],"publishedAt":["timestamp(3) without time zone",true,false],"totalCollected":["numeric(18,2)",false,false],"totalSpent":["numeric(18,2)",false,false],"closingBalance":["numeric(18,2)",false,false],"payload":["jsonb",true,false]},
"AuditLog":{"id":["text",false,true],"actorId":["text",true,false],"eventId":["text",true,false],"action":["text",false,false],"entityType":["text",false,false],"entityId":["text",false,false],"summary":["text",true,false],"context":["jsonb",true,false],"ipAddress":["text",true,false],"userAgent":["text",true,false],"route":["text",true,false],"method":["text",true,false],"createdAt":["timestamp(3) without time zone",false,false]}
}$column_manifest$::jsonb;
  expected_enums jsonb := $enum_manifest${
"RoleCode":["COMPLAINT_REVIEW_AUTHORITY","EVENT_ADMIN","EVENT_MANAGEMENT_USER","FINANCIAL_CONTROLLER","GENERAL_STUDENT","ORGANIZATIONAL_APPROVER","SYSTEM_ADMIN"],
"AccountStatus":["ACTIVE","INACTIVE","SUSPENDED"],
"EventStatus":["ARCHIVED","CLOSED","COMPLETED","DRAFT","IN_PROGRESS","PUBLISHED","REGISTRATION_CLOSED"],
"RegistrationPaymentState":["PAYMENT_PENDING","PENDING_VERIFICATION","REJECTED","VERIFIED"],
"PaymentProofState":["PENDING_VERIFICATION","REJECTED","VERIFIED"],
"BudgetState":["APPROVED","DRAFT","REVISED","SUBMITTED"],
"RequestState":["APPROVED","DRAFT","PENDING_REVIEW","REJECTED","RETURNED","SUBMITTED"],
"ExpenseRecordState":["RECORDED","SETTLED","VOIDED"],
"IncomeSourceType":["DONATION","MANUAL_OTHER","SPONSOR","UNIVERSITY_SUPPORT"],
"IncomeState":["RECORDED","REJECTED","VERIFIED"],
"DocumentCategory":["COMPLAINT_EVIDENCE","PAYMENT_PROOF","SUPPORTING_DOCUMENT"],
"StorageDisk":["LOCAL"],
"ApprovalEntityType":["BUDGET_REQUEST","EXPENSE_REQUEST"],
"ApprovalDecisionType":["APPROVED","REJECTED","RETURNED"],
"ComplaintState":["CLOSED","ESCALATED","RESOLVED","ROUTED","SUBMITTED","UNDER_REVIEW"],
"ReconciliationState":["DRAFT","FINALIZED","REVIEWED"],
"PublicSummaryStatus":["DRAFT","PUBLISHED"],
"FinancialOperation":["EXPENSE_CREATE","INCOME_CREATE"]
}$enum_manifest$::jsonb;
BEGIN
  IF current_setting('security_cutover.reviewed_policy') <> '2026-10-12-column-grants-v1' OR
     database_name !~ '^[a-z_][a-z0-9_]{1,62}$' OR
     database_name IN ('postgres', 'template0', 'template1') OR
     current_database() <> database_name OR
     current_user <> operator_name OR session_user <> operator_name OR
     runtime_name !~ '^[a-z_][a-z0-9_]{1,62}$' OR left(runtime_name, 3) = 'pg_' OR
     migration_name !~ '^[a-z_][a-z0-9_]{1,62}$' OR left(migration_name, 3) = 'pg_' OR
     runtime_name IN (migration_name, operator_name) OR migration_name = operator_name THEN
    RAISE EXCEPTION 'Refusing unapproved database, operator or role scope';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = operator_name AND rolsuper AND rolcanlogin) OR
     EXISTS (SELECT 1 FROM pg_roles WHERE rolname = runtime_name) THEN
    RAISE EXCEPTION 'A named administrator and a never-existing runtime role are required';
  END IF;
  SELECT oid INTO migration_oid FROM pg_roles WHERE rolname = migration_name AND rolcanlogin
    AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls);
  IF migration_oid IS NULL OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = migration_oid) OR
     (SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = database_name AND NOT datistemplate) IS DISTINCT FROM migration_name THEN
    RAISE EXCEPTION 'A separate restricted migration owner must be prepared and reviewed first';
  END IF;
  SELECT oid INTO public_oid FROM pg_namespace WHERE nspname = 'public'
    AND pg_get_userbyid(nspowner) IN (migration_name, 'pg_database_owner');
  IF public_oid IS NULL OR EXISTS (
    SELECT 1 FROM pg_namespace WHERE left(nspname, 3) <> 'pg_'
      AND nspname NOT IN ('public', 'information_schema')
  ) THEN RAISE EXCEPTION 'Unexpected application namespace or schema owner'; END IF;

  SELECT array_agg(name ORDER BY name COLLATE "C") INTO expected_tables
    FROM (SELECT jsonb_object_keys(expected_columns) AS name UNION ALL SELECT '_prisma_migrations') AS names;
  SELECT array_agg(c.relname::text ORDER BY c.relname::text COLLATE "C") INTO actual_tables
    FROM pg_class c WHERE c.relnamespace = public_oid AND c.relkind IN ('r', 'p', 'v', 'm', 'f');
  IF actual_tables IS DISTINCT FROM expected_tables OR EXISTS (
    SELECT 1 FROM pg_class c WHERE c.relnamespace = public_oid
      AND (c.relkind <> 'r' OR c.relispartition OR c.relowner <> migration_oid) AND c.relkind IN ('r', 'p', 'v', 'm', 'f', 'S')
  ) THEN RAISE EXCEPTION 'Unexpected application tables, relation types or owners'; END IF;
  FOR target IN SELECT unnest(expected_tables) AS table_name LOOP
    EXECUTE format('LOCK TABLE public.%I IN SHARE UPDATE EXCLUSIVE MODE', target.table_name);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_inherits i JOIN pg_class c ON c.oid IN (i.inhrelid, i.inhparent) WHERE c.relnamespace = public_oid) OR
     EXISTS (SELECT 1 FROM pg_proc p WHERE p.pronamespace = public_oid) OR
     EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = public_oid AND NOT t.tgisinternal) OR
     EXISTS (SELECT 1 FROM pg_rewrite r JOIN pg_class c ON c.oid = r.ev_class WHERE c.relnamespace = public_oid) OR
     EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid WHERE c.relnamespace = public_oid AND a.attnum > 0 AND NOT a.attisdropped AND (a.attgenerated <> '' OR a.attidentity <> '')) THEN
    RAISE EXCEPTION 'Unreviewed inheritance, functions, triggers, rules or generated columns';
  END IF;
  SELECT jsonb_object_agg(table_name, columns) INTO actual_columns FROM (
    SELECT c.relname::text AS table_name, jsonb_object_agg(a.attname, jsonb_build_array(
      format_type(a.atttypid, a.atttypmod), NOT a.attnotnull,
      EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY(i.indkey))
    )) AS columns
    FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND c.relname <> '_prisma_migrations'
    GROUP BY c.relname
  ) AS inspected;
  SELECT jsonb_object_agg(type_name, labels) INTO actual_enums FROM (
    SELECT t.typname::text AS type_name, jsonb_agg(e.enumlabel::text ORDER BY e.enumlabel::text COLLATE "C") AS labels
    FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid WHERE t.typnamespace = public_oid GROUP BY t.typname
  ) AS inspected;
  IF actual_columns IS DISTINCT FROM expected_columns OR actual_enums IS DISTINCT FROM expected_enums OR EXISTS (
    SELECT 1 FROM pg_class c WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND c.relowner <> migration_oid
  ) OR EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typnamespace = public_oid AND t.typowner <> migration_oid
  ) THEN RAISE EXCEPTION 'Unreviewed column names, types, nullability, primary keys or enums'; END IF;

  -- Reject inherited PUBLIC capabilities; do not silently change other clients.
  IF EXISTS (SELECT 1 FROM pg_database d, LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) acl
       WHERE d.datname = database_name AND acl.grantee = 0 AND acl.privilege_type IN ('CREATE', 'TEMPORARY')) OR
     EXISTS (SELECT 1 FROM pg_namespace n, LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) acl
       WHERE n.oid = public_oid AND acl.grantee = 0 AND acl.privilege_type = 'CREATE') OR
     EXISTS (SELECT 1 FROM pg_class c, LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) acl
       WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND acl.grantee = 0) OR
     EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid,
       LATERAL aclexplode(a.attacl) acl WHERE c.relnamespace = public_oid AND a.attnum > 0 AND NOT a.attisdropped AND acl.grantee = 0) OR
     EXISTS (SELECT 1 FROM pg_default_acl d, LATERAL aclexplode(d.defaclacl) acl
       WHERE d.defaclobjtype = 'r' AND d.defaclnamespace IN (0, public_oid) AND acl.grantee = 0) THEN
    RAISE EXCEPTION 'Review PUBLIC database, schema, table, column and future-table grants separately';
  END IF;
  IF EXISTS (
    WITH RECURSIVE history_parents(parent_oid) AS (
      SELECT fk.confrelid FROM pg_constraint fk WHERE fk.contype = 'f'
        AND fk.conrelid IN ('public."AuditLog"'::regclass, 'public."FinancialIdempotency"'::regclass)
      UNION
      SELECT fk.confrelid FROM pg_constraint fk JOIN history_parents h ON fk.conrelid = h.parent_oid WHERE fk.contype = 'f'
    ) SELECT 1 FROM history_parents h JOIN pg_class c ON c.oid = h.parent_oid
      WHERE c.relnamespace = public_oid AND c.relname IN ('RefreshToken', 'PasswordResetToken', 'MfaChallenge')
  ) THEN RAISE EXCEPTION 'Maintenance DELETE could indirectly mutate protected history'; END IF;

  -- All application objects are locked/validated before the new role is created.
  EXECUTE format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS', runtime_name);
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', database_name, runtime_name);
  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', runtime_name);
  EXECUTE format('ALTER ROLE %I IN DATABASE %I SET search_path = pg_catalog, public', runtime_name, database_name);
  FOR target IN SELECT jsonb_object_keys(expected_enums) AS type_name LOOP
    EXECUTE format('GRANT USAGE ON TYPE public.%I TO %I', target.type_name, runtime_name);
  END LOOP;
  FOR target IN SELECT jsonb_object_keys(expected_columns) AS table_name LOOP
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO %I', target.table_name, runtime_name);
    IF target.table_name NOT IN ('AuditLog', 'FinancialIdempotency') THEN
      SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum) INTO update_columns
        FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
        WHERE c.relnamespace = public_oid AND c.relname = target.table_name
          AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY(i.indkey))
          AND NOT EXISTS (SELECT 1 FROM pg_constraint fk WHERE fk.contype = 'f' AND fk.confrelid = c.oid AND a.attnum = ANY(fk.confkey));
      IF update_columns IS NULL THEN RAISE EXCEPTION 'Ordinary table has no reviewed mutable columns'; END IF;
      EXECUTE format('GRANT UPDATE (%s) ON TABLE public.%I TO %I', update_columns, target.table_name, runtime_name);
    END IF;
  END LOOP;
  EXECUTE format('GRANT DELETE ON TABLE public."RefreshToken", public."PasswordResetToken", public."MfaChallenge" TO %I', runtime_name);

  IF NOT has_database_privilege(runtime_name, database_name, 'CONNECT') OR NOT has_schema_privilege(runtime_name, 'public', 'USAGE') OR EXISTS (
    SELECT 1 FROM pg_class c WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND c.relname <> '_prisma_migrations' AND (
      NOT has_table_privilege(runtime_name, c.oid, 'SELECT') OR NOT has_table_privilege(runtime_name, c.oid, 'INSERT')
    )
  ) OR EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND c.relname NOT IN ('AuditLog', 'FinancialIdempotency', '_prisma_migrations')
      AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY(i.indkey))
      AND NOT EXISTS (SELECT 1 FROM pg_constraint fk WHERE fk.contype = 'f' AND fk.confrelid = c.oid AND a.attnum = ANY(fk.confkey))
      AND NOT has_column_privilege(runtime_name, c.oid, a.attnum, 'UPDATE')
  ) THEN RAISE EXCEPTION 'Required ordinary runtime grants were not established'; END IF;
  IF has_database_privilege(runtime_name, database_name, 'TEMP, CREATE') OR
     has_schema_privilege(runtime_name, 'public', 'CREATE') OR
     has_table_privilege(runtime_name, 'public."_prisma_migrations"', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER') OR
     EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid IN (m.member, m.roleid) WHERE r.rolname = runtime_name) OR
     EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND (
       has_table_privilege(runtime_name, c.oid, 'UPDATE') OR
       has_table_privilege(runtime_name, c.oid, 'TRUNCATE, REFERENCES, TRIGGER, SELECT WITH GRANT OPTION, INSERT WITH GRANT OPTION, UPDATE WITH GRANT OPTION, DELETE WITH GRANT OPTION') OR
       (c.relname NOT IN ('RefreshToken', 'PasswordResetToken', 'MfaChallenge') AND has_table_privilege(runtime_name, c.oid, 'DELETE'))
     )) OR EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
       WHERE c.relnamespace = public_oid AND c.relkind = 'r' AND (
         has_column_privilege(runtime_name, c.oid, a.attnum, 'SELECT WITH GRANT OPTION, INSERT WITH GRANT OPTION, UPDATE WITH GRANT OPTION, REFERENCES') OR
         (has_column_privilege(runtime_name, c.oid, a.attnum, 'UPDATE') AND (
           c.relname IN ('AuditLog', 'FinancialIdempotency', '_prisma_migrations') OR
           EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY(i.indkey)) OR
           EXISTS (SELECT 1 FROM pg_constraint fk WHERE fk.contype = 'f' AND fk.confrelid = c.oid AND a.attnum = ANY(fk.confkey))
         ))
       )
     ) THEN RAISE EXCEPTION 'Runtime effective grants exceed the reviewed direct and indirect boundary'; END IF;
END $policy$;
COMMIT;

-- After separate approval and fake-data acceptance, use psql's interactive
-- \password for the chosen NEW runtime role. Keep migration/operator credentials
-- outside the runtime environment. This file never changes application config.
