# Runtime cutover SQL review

## Scope and decision

This concern corrects the operator template [security-runtime-grants.sql](../security-runtime-grants.sql) and executes its exact bytes only on two separately approved, newly created fake databases. No owner database, private environment, existing MFA factor or original runtime permission/configuration was changed. The owner's original runtime remains a superuser; **SEC-22 stays open**. Fake acceptance is not approval to cut over that runtime.

The baseline inspected was commit `8d54d58`, with the earlier template unchanged. The independent 29-check database fixture validates [grant-test-runtime.sql](../../infra/postgres/grant-test-runtime.sql). This concern adds separate PostgreSQL acceptance for the replacement handoff itself: each exact-template run passes 59 checks. The original naive User primary-key grant changes three synthetic history rows (one audit and two retry markers) inside a rollback; the restricted replacement prevents that update with SQLSTATE 42501.

## Findings and root causes

Baseline line references below refer to `docs/security-runtime-grants.sql` at `8d54d58`.

| ID | Severity / evidence | Path and consequence | Change / status |
| --- | --- | --- | --- |
| RGT-01 | High if the old handoff is applied. Baseline SQL:8; initial migration:606; audit-event migration:8; financial-idempotency migration:25. | The runtime receives UPDATE on User.id while AuditLog and FinancialIdempotency receive only SELECT/INSERT. Referential UPDATE CASCADE rewrites their actorId under referential-integrity trigger authority despite the direct history denial. | Only ordinary non-key columns receive UPDATE. Actual exact-template acceptance reproduces three naive history changes under rollback, then denies all five tested parent/primary-key updates and direct history mutations with 42501. |
| RGT-02 | High conditional setup risk. Baseline SQL:5–7 and 26. | The old script does not verify the current database/operator/owners/schema. GRANT CONNECT names one database, while table GRANT acts on the connected database; a wrong-target invocation with matching table names can provision the policy on another dataset. | Explicit database/operator/policy, owner and closed-schema gates pass their actual intended exception checks on fresh fake fixtures. No wrong owner target was contacted. |
| RGT-03 | Medium conditional setup risk. Baseline SQL:26–30. | The old checks omit database TEMP/CREATE, column ACLs, memberships and default PUBLIC table grants. Owner ACL contents remain unverified. | Effective ACL checks and six injected PUBLIC privilege cases refuse in rolled-back fake transactions; no shared PUBLIC policy is changed. |
| RGT-04 | Medium operator setup risk found in independent review of the new handoff, before commit. Handoff section2 originally passed only `-h 127.0.0.1` without a scoped libpq environment. | An inherited `PGHOSTADDR` selects the network address even when `host` is explicit. Another cluster with matching database/operator/schema names could satisfy the logical SQL checks. This is an operator environment hazard; no application input or actual wrong-server mutation was demonstrated. | Both interactive psql calls now run inside a `try/finally` that clears inherited `PG*` variables, pins `PGHOSTADDR=127.0.0.1`/`PGCONNECT_TIMEOUT=5`, then restores all original variables on success or failure. Passwords remain interactive, each failed command stops the sequence, and no saved environment values are printed. Actual documented-block fake-child regression passes18 checks. |

Source FK evidence for other keys is [financial_idempotency/migration.sql:26](../../backend/prisma/migrations/20261012120000_financial_idempotency/migration.sql), :27 and :28: Event.id, IncomeRecord.id and ExpenseRecord.id are also parents of immutable retry markers with UPDATE CASCADE. [add_event_id_to_audit_log/migration.sql:8](../../backend/prisma/migrations/20260523131331_add_event_id_to_audit_log/migration.sql) links Event.id to audit history. Exact-template runtime checks deny those parent key updates. Ordinary DELETE grants are limited to three authentication-maintenance tables, and a synthetic FK placing protected history beneath a maintenance table is rejected before role creation.

## Prepared policy

The template requires explicit psql parameters `database_name`, `runtime_role`, `migration_role`, `operator_role` and `reviewed_policy=2026-10-12-column-grants-v1`. Missing parameters refuse before BEGIN. The updated [operator handoff](../security-operator-handoff.md) supplies every parameter, interactive password prompts and fail-stop exit checks. Do not follow password/configuration steps after a failed grant command.

The operator must be the explicitly named current/session administrator. The runtime name must not exist or match the operator/migrator. The existing migrator must deny SUPERUSER, CREATEDB, CREATEROLE, INHERIT, REPLICATION and BYPASSRLS, have no inherited role membership, and own the database/tables/types. The public schema may belong to that migrator or PostgreSQL's `pg_database_owner`. The original owner's database is not assumed to satisfy these conditions. Ownership transfer, role preparation and shared PUBLIC policy changes require a separate approved plan.

The closed manifest covers **27 application tables, 259 scalar columns and 18 enum label sets**, plus the migration table for namespace/ownership checks. It checks PostgreSQL type/precision, nullability and primary-key membership, including MfaFactor.userId. Unknown tables, columns, enum labels, owners, relation kinds, generated columns, application functions/triggers/rules and inheritance refuse before role creation. DDL-blocking relation locks precede typed-column inspection; names and columns are identifier-quoted. Concurrent administrator/schema changes must be quiesced for the operator run; these locks do not neutralize a privileged competing administrator.

Application privileges retain the established isolated matrix: SELECT/INSERT on all application tables; UPDATE on ordinary non-key columns; no UPDATE on AuditLog or FinancialIdempotency; DELETE only on RefreshToken, PasswordResetToken and MfaChallenge. The update exclusion also covers non-primary referenced keys if a future FK exists. A recursive history-parent check refuses a schema where authentication maintenance could indirectly delete/change protected history. No future/default grants, PUBLIC revocation, ownership transfer, existing role mutation or record rewrite is performed. The new role receives a database-specific `pg_catalog, public` search path and no embedded password.

This is a grant-boundary check, not complete schema equivalence: arbitrary CHECK constraints, all index definitions, defaults and migration checksums require the separate migration/schema verification gates. New schema changes need an updated manifest/policy and renewed testing. Permissions do not replace current-session/event authorization in application transactions.

## Verification performed

Exact command, repository root, native Node **24.13.1**, Windows, fake source fixtures only:

```powershell
node scripts/scalability/verify-cutover-grant-contracts.mjs
```

Result: **29 checks passed**, 27 tables / 259 columns / 18 enums; zero actual database connections, SQL statements or private files read. The positive source policy passes; mutations adding table-wide UPDATE/ALL, missing key/FK/scope/owner/type/lock/ordinary-relation fences, default grants, PUBLIC revocation, ownership changes and data deletion are rejected. Precision, marker-hash type, primary-key and newly added Prisma-column drift fail. PostgreSQL16 does not support a numeric quit status; missing-parameter guards instead raise a constant exception before the permission transaction, with ON_ERROR_STOP. This source contract is distinct from the executed PostgreSQL proof below.

Installed official PostgreSQL **16.13** documentation was read locally: `C:/Program Files/PostgreSQL/16/doc/postgresql/html/sql-grant.html`, `catalog-pg-constraint.html`, `functions-info.html` and `app-psql.html`. Column GRANT, ACL/privilege inspection, FK parent-key metadata and psql missing-variable guards are supported there. Actual fresh servers were PostgreSQL **16.15**; the installed psql/libpq clients remain **16.13 / 160013**.

Independent read-only review also checked the exact template, runner/helper, source mutations and handoff for identifier/literal injection, inherited memberships/PUBLIC/default ACLs, parent-key UPDATE and maintenance DELETE cascades, target selection, secret arguments and rollback claims. It found RGT-04 above. PostgreSQL16's installed `libpq-connect.html` states that when both `host` and `hostaddr` are supplied, `hostaddr` gives the network address; `libpq-envars.html` defines `PGHOSTADDR` and service/options/password defaults. Primary references: [connection address rules](https://www.postgresql.org/docs/16/libpq-connect.html#LIBPQ-CONNECT-HOSTADDR), [environment parameters](https://www.postgresql.org/docs/16/libpq-envars.html). The fixture runner already sets a clean environment and explicit hostaddr; its PostgreSQL evidence is unchanged by this handoff-only correction.

Executed from the repository root, with Windows PowerShell5.1:

```powershell
powershell.exe -NoProfile -NonInteractive -File scripts/scalability/verify-cutover-handoff.ps1
```

Result: **18 checks passed**, covering AST syntax/command scope/fail-stop guards and three actual executions of the documented block with only the psql executable and Read-Host seams replaced. Fresh fake psql child processes verify exact loopback address/timeout, absence of synthetic inherited service/options/password/canary variables, and explicit `-X`/`-W`/database/operator/policy arguments. Success invokes both commands; grant failure prevents password setup; password failure stops after its command. Every scenario verifies original synthetic `PG*` values are restored. Workers start with an OS-variable allowlist, read zero parent `PG*` values and execute zero actual psql processes/database connections. Safe reports/helpers remain under fresh ignored `.cache/scalability/handoff-env-*` directories. No wrong endpoint, original database, password or MFA factor was contacted for this test.

## Exact-template fresh-fake acceptance

The dedicated [local acceptance runner](../../scripts/scalability/verify-cutover-grants-local.mjs) and [private-stdin helper](../../scripts/scalability/postgres-cutover-fixture.py) create only a new `mu_scale_` database and restricted migrator. The existing general provisioner precreates a runtime role and cannot prove this template's never-existing runtime requirement. The dedicated helper verifies the approved loopback operator, server16.15, database/role freshness and exact new target before provisioning. It deploys only the fourteen repository migrations to that new fake schema, then runs the exact current SQL file with every explicit psql variable. Passwords remain private; native helper output and database errors are suppressed except allowlisted stage/SQLSTATE diagnostics. No owner environment or existing fixture is a fallback.

Both successful runs used the following repository-root command with an explicit previously approved private operator file beneath the ignored scalability cache (the placeholder is deliberately not a usable default):

```powershell
node scripts/scalability/verify-cutover-grants-local.mjs --confirm-new-cutover-fixture --operator-config '<approved-private-operator-file>'
```

Each report records **59 passing checks**, the exact source SQL SHA-256, fourteen source-matching migration checksums, ten sentinel rows unchanged before cleanup, and zero owned rows after cleanup. Each fresh database measured **9,747,479 bytes** at the recorded point. Private reports remain under `.cache/scalability/mu_scale_d525ff9c789a4b798690058592085665/` and `.cache/scalability/mu_scale_cebdcb0b5157492e9d773cf74d5c65ca/`. Only each runner's ten sentinel rows were removed; databases/roles and private evidence were retained. The initial pre-acceptance execution exposed a missing relation-kind projection in the SQL manifest query; it was corrected before both passing exact-byte runs, with a source contract for that regression.

| Gate | Observed evidence / remaining scope |
| --- | --- |
| Actual template success | Both runs execute the exact current source and commit the new role. Actual database/current_user identities, six denied elevated role attributes, ownership separation and effective ACLs pass; fourteen migration checksums and ten sentinel rows remain unchanged. |
| Scope rollback negatives | **32 actual negative setups**, including five missing variables, wrong selected database/operator/policy, pre-existing runtime, privileged/member migrator, database/table/type/schema owners, new namespace/table/column/enum/function/trigger/rule, precision/nullability/PK changes, PUBLIC grants and maintenance-history cascade. Each must reach its exact reviewed P0001 exception with psql exit3; injected setup is confirmed complete first. After each, schema/ACL fingerprint, sentinel data, checksums and role set are unchanged. Wrong database is tested by mismatching the explicit variable on the same owned connection, never by contacting another database. |
| Inherited privilege negatives | Six controlled PUBLIC TEMP/database CREATE/schema CREATE/table SELECT/key-column UPDATE/future-table SELECT injections reach their intended fence and roll back. No shared PUBLIC grant is revoked. |
| Key-cascade reattack | Naive User.id UPDATE rewrites **three** synthetic history rows inside rollback. Restricted User/Event/IncomeRecord/ExpenseRecord PK and MfaFactor.userId UPDATE, both history tables' UPDATE/DELETE/TRUNCATE, migration-table SELECT, permanent/temp DDL and migrator SET ROLE give **15 actual SQLSTATE42501 denials**. All ten rows are preserved after each attempt. |
| Positive business behavior | Ordinary user/income/expense updates, audit INSERT and all three maintenance DELETE paths succeed inside rollback. **All24 inherited non-browser suites pass** on the second exact-template database under the isolated dispatcher: project81, replay62, workspace96, login37, session18, bootstrap15, document14 and other unchanged suites. See [environment review](runtime-verifier-isolation-review.md) for run composition. Real browser/PDF and pooled execution under this exact replacement remain open. |
| Schema safety | Fourteen source checksums are checked before, after every negative and after success. The fresh migrations establish source constraints; financial replay/project/governance/workspace suites preserve their concurrency and rollback assertions. The manifest does not establish complete arbitrary schema equivalence or backup/restore acceptance. |

No capacity number is inferred from grant checks or suite duration. The original runtime cutover, ownership/ACL preparation, verified encrypted backup/restore, real browser/PDF and pooled exact-template acceptance remain explicit future gates. No runtime password belongs in arguments, logs or this file.

Final staged snapshot Lfx8WD passes inventory45 (including the explicit grant SQL), backend build, all verifier/seed types, file transport10, SQL source29, fixture226 and handoff18. Semgrep1.180.0 runs219 applicable JS/Python rules on six changed sources with0findings/0errors; unsupported SQL/PowerShell semantics are covered by the separate executed gates. Staged secret/diff review is recorded in LOG.

## Proposed further tightening; not applied here

| Candidate | Source evidence / proposed change | Status |
| --- | --- | --- |
| ApprovalDecision | [approvals.repository.ts:143](../../backend/src/modules/approvals/repositories/approvals.repository.ts) creates decisions; no production UPDATE/DELETE call was found. The operator-only seed-demo-runtime-data.ts:495 updates existing decisions, so its separate trusted execution needs review. Consider SELECT/INSERT-only for runtime. | Source candidate; requires proven usage/negative tests and permission-change approval. Current isolated matrix retained. |
| ComplaintRouting | [complaints.repository.ts:232](../../backend/src/modules/complaints/repositories/complaints.repository.ts) creates routing history; no production UPDATE/DELETE call was found. Consider SELECT/INSERT-only. | Proposed, unexecuted. |
| SupportingDocument | Create paths: [requests.repository.ts:317](../../backend/src/modules/requests/repositories/requests.repository.ts), [complaints.repository.ts:245](../../backend/src/modules/complaints/repositories/complaints.repository.ts), payments.repository.ts:201. No production UPDATE call was found. The actual negative document-audit verifier mutates/restores relativePath at verify-security-document-audit.ts:51/53; preserve that attack test under an independently verified fixture identity if tightening is approved. The legacy `deleteSupportingDocumentsForExpenseRequest` at requests.repository.ts:310–311 has no application caller; finance verifier:1100 mocks that method. Existing restricted policy denies its DELETE. Consider SELECT/INSERT-only after usage verification. | Proposed, unexecuted; no dead-code removal or fixture-policy change. |

These observations do not prove the absence of dynamic/runtime consumers. They are not silently included in the replacement's permission matrix.

## Rollback and residual risk

No owner-runtime rollback is needed because it was never changed. A failed operator transaction aborts the new role/grants; retain evidence and investigate before retrying. Never DROP roles/data, transfer ownership, reset MFA, widen fixture grants or restore a superuser credential to make a gate pass. A future committed permission/configuration cutover requires its own approved rollback and verified backup/restore plan.

The runtime still needs ordinary record writes and audit/marker INSERT; stolen runtime credentials can damage those permitted records or forge new entries. Column grants do not supply event/user RLS, double-entry financial semantics or cryptographic audit attestation. A privileged migrator/operator can rewrite history. External audit collection, credential isolation, backups, transport/firewall controls and human testing remain necessary external/later-phase gates. SEC-22 and the listed unexecuted exact-template integrations remain open; the original16.13 server was not upgraded here. No production capacity or complete compromise resistance is claimed.
