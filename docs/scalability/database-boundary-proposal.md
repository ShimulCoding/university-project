# Phase 1 database boundary proposal

Status: prepared for approval; not executed. The existing database/runtime credential remains unchanged. Existing administrator MFA/key/password/assignments/evidence are outside this work.

## First staged operation: new isolated fake target

Create one fresh database with a unique `mu_scale_` prefix and separate non-superuser runtime and migration login roles in the existing loopback PostgreSQL cluster. Role creation is cluster-wide, so it requires owner approval even though application data is fake. Refuse existing database/role names; never reuse/reset the owner's dataset. The migration role owns only the new database/schema/Prisma objects and has no superuser, role/database-creation, replication, bypass-RLS or inherited role powers. The runtime owns no objects and receives only the current reviewed 27-model application's required operations:

- SELECT/INSERT/UPDATE on ordinary application tables.
- SELECT/INSERT only on AuditLog and FinancialIdempotency.
- DELETE only on expired authentication maintenance tables RefreshToken, PasswordResetToken and MfaChallenge.
- CONNECT/USAGE, no database CREATE/TEMP, schema CREATE, object ownership, migration-table access, GRANT option or membership in the migration/operator role. Revoke PUBLIC database CONNECT/TEMP only on this new isolated database and bind role names exactly to that database's prefix.

Apply the existing fourteen migrations only to that new fake target through the migration credential. Capture migration version/schema hashes; never call migrate reset or seed an existing database. Use separately owned fake fixtures/private upload root and a loopback SMTP fixture; avoid the automatic external Ethereal fallback. Preserve fail-closed scanner policy; real scanner acceptance waits for its approved local engine.

Credentials must be generated privately with the OS CSPRNG, stored only in fresh owner-restricted ignored configuration and never passed as command arguments or printed. PostgreSQL's official createuser/psql password helpers should encrypt the stored SCRAM verifier before SQL transport/logging; do not implement custom password crypto or send raw ALTER ROLE PASSWORD literals. For test setup/cleanup, use the separate migrator/operator fixture client; application/service/API calls must actually use the restricted runtime connection. Verify current_user and denied operations before calling a suite a restricted-runtime pass.

## Verification gates and real-data cutover

Prove denied DDL, audit/retry history UPDATE/DELETE/TRUNCATE, role grants, migrations access and permission escalation with actual SQL errors. Run all existing operational/security tests, financial concurrency/idempotency/rollback, uploads/doc authorization and browser/PDF journeys through the runtime, then repeat through the local transaction pooler. Do not weaken fixture assertions to work around immutable audit history; separate privileged fixture setup/cleanup from tested application calls.

After these gates, prepare a separate concrete original-database role/ownership/cutover script, capture current ownership/grants and a rollback, and request approval before applying it or updating the owner's private backend DATABASE_URL. The prior [reviewed grant SQL](../security-runtime-grants.sql) is an input, not evidence that this cutover has been applied. SEC-22 remains open for the owner's original runtime until that operation passes.

The first approval authorizes new isolated fake database/roles, migrations on that new target, and cleanup of only explicitly owned temporary verification rows/files. It does not authorize dropping databases/roles, deleting the owner's data, real-database application migrations, changing PostgreSQL listener/HBA/firewall, or original-runtime cutover.

## Rollback

The owner application configuration and original schema are preserved. Stop only the new fixture applications. Leave the new fake database/roles/volumes in place unless separate destructive cleanup is approved; no automated DROP/REASSIGN OWNED/prune operation. A failed grant/schema test records its failure and blocks cutover. Keep migration credentials outside the application process and eventual runtime image.

References: [PostgreSQL 16 CREATE ROLE](https://www.postgresql.org/docs/16/sql-createrole.html), [GRANT](https://www.postgresql.org/docs/16/sql-grant.html), [createuser](https://www.postgresql.org/docs/16/app-createuser.html), [psql password handling](https://www.postgresql.org/docs/16/app-psql.html).
