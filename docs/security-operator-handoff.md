# Security operator handoff (local evidence, 2026-10-12)

The database/network/backup/deployment steps below have **not** been executed. The subsequent local sign-in support configured the owner's confirmed development origin and issued an owner-authorized initial MFA grant privately. The owner completed authenticator enrollment and a later authenticator sign-in; read-only metadata confirms both audited events and consumption of the grant. No real factor or recovery code was read by the agent. Main and production remain unchanged. Changes to database users, credentials, PostgreSQL/firewall settings, backups or deployment require operator review. The application changes are on `security/local-hardening-2026-10-11`.

## Confirmed local configuration

- PostgreSQL **16.13**, database `mu_cse_transparency`, loopback port 5432. Config: `C:/Program Files/PostgreSQL/16/data/postgresql.conf`; host rules: `C:/Program Files/PostgreSQL/16/data/pg_hba.conf`.
- The runtime connection has superuser, database-creation and role-creation privileges. `listen_addresses='*'`, SSL off, password encryption SCRAM. Host-rule inspection found **zero nonloopback host rules, zero trust rules and zero parse errors**. Broad listener binding is not evidence that remote authentication succeeds. Firewall and disk encryption were not verified.
- The signing keys differ from the example values and each other; the separate MFA key is not reused. Only booleans were inspected, never secret values. SMTP is not configured locally.
- Repository/GitHub metadata supplies no hosting provider, staging URL, deployment/environment/workflow or homepage. Do not assume a cloud provider or test production URLs.

## 1. Privileged onboarding

Follow [security-mfa-setup.md](security-mfa-setup.md) for the separate encryption key and supervised first-admin enrollment grant. Keep the existing factor key; replacing it makes enrolled factors unreadable. Store offline recovery codes privately. Password reset does not remove MFA; losing all factors/codes requires supervised operator recovery.

Initial local owner enrollment is complete. Other privileged accounts still require their own supervised setup. Open the frontend on the same hostname as the configured API: mixing localhost with the LAN API allows the password response but drops the setup cookie. The matching-host browser case is verified in [local-network-sign-in-review.md](local-network-sign-in-review.md).

After signing in as System Admin, assign actual personnel to the four older unstaffed events through **Events and teams**. The user chose to do this later. Assign separate accounts to each required role; never infer assignments from legacy global roles. Review every privileged account and revoke unexpected assignments through the audited UI.

## 2. Separate runtime and migration privileges

Review [security-runtime-grants.sql](security-runtime-grants.sql). It creates a new `mu_runtime` role for the current 27-model schema, grants only required table operations, and denies audit/retry-marker update/delete/truncate and DDL. No default grants to future tables are included; review privileges with each migration. This role has not been provisioned or runtime-tested; local audit fixtures still use the original operator connection.

An authorized local PostgreSQL administrator can run it with the installed psql client. Enter the existing operator role and password interactively; do not put a connection URL/password in shell history:

```powershell
$operatorRole = Read-Host 'Existing database administrator role'
& 'C:/Program Files/PostgreSQL/16/bin/psql.exe' -h 127.0.0.1 -p 5432 -U $operatorRole -d mu_cse_transparency -W -v ON_ERROR_STOP=1 -f docs/security-runtime-grants.sql
& 'C:/Program Files/PostgreSQL/16/bin/psql.exe' -h 127.0.0.1 -p 5432 -U $operatorRole -d mu_cse_transparency -W -c '\password mu_runtime'
```

Provision a unique generated runtime password through that interactive prompt and update the **private** runtime `DATABASE_URL` with correctly URL-encoded credentials. Preserve the original migration/operator credential in a separate restricted secret store, not the deployed application's environment. Add a bounded Prisma pool (`connection_limit=10`) appropriate to the current single-process local setup; size it again for the actual deployment.

Before switching a staging runtime, verify its role:

```sql
SELECT rolsuper, rolcreatedb, rolcreaterole, rolbypassrls FROM pg_roles WHERE rolname = current_user;
SELECT has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema_objects,
       has_table_privilege(current_user, 'public."AuditLog"', 'UPDATE, DELETE, TRUNCATE') AS can_edit_audit;
```

All flags must be false. Verify ordinary sign-in, event/team management, financial writes, protected documents and token maintenance with the runtime credential. Run migration/fixture-cleanup verification using the separate authorized local operator credential: isolated fixture suites delete their own audit rows, which the deployed runtime intentionally cannot do. Never restore the superuser credential to fix a runtime permission failure; investigate the specific denied operation and review its grant.

Also verify `has_table_privilege(current_user, 'public."FinancialIdempotency"', 'UPDATE, DELETE, TRUNCATE')` is false. Read-only inspection confirmed that the current original connection can change both audit and retry history; the proposed restricted role is not yet in use. A superuser/OS administrator can still alter records, so forward audit events to a separate collector rather than calling database history tamper-proof.

## 3. Network and TLS

For this **local-only** instance, review changing `listen_addresses` in the confirmed configuration file from `'*'` to `'localhost'`. Keep the existing loopback SCRAM host rules. The change needs a coordinated PostgreSQL restart after stopping local dependent apps; it has not been performed by this audit.

For a future staging/cloud environment, expose PostgreSQL only to the backend network and require authenticated TLS (`sslmode=verify-full` with the provider CA). The public reverse proxy should expose HTTPS only for the frontend/API; keep the Node and database ports private. Set `NODE_ENV=production`, exact HTTPS `FRONTEND_URL` origins, the matching HTTPS `NEXT_PUBLIC_API_BASE_URL`, and the **actual** `TRUST_PROXY_HOPS` topology. Backend cookies are Secure in production. Configure HSTS at the verified HTTPS edge; do not apply it to local HTTP development.

No provider-specific console commands can be supplied until a provider/account is actually identified. The public GitHub repository has no associated deployment metadata.

Route `/api` to Express on the **same public HTTPS origin** as Next (for example, frontend origin `https://your-owned-host` and API base `https://your-owned-host/api`). Current server-rendered authentication forwards that origin's cookies; unrelated frontend/API domains have not been verified and require a separately reviewed cookie/session architecture. Keep the direct Node ports private behind this proxy.

The application budgets are per backend process: 240 authenticated operational/admin mutations, 120 protected file opens and five report generations per account/15 minutes, with two upload leases and one aggregation job. Before adding replicas, configure an approved shared rate-limit store/edge policy and repeat distributed tests; do not assume process counters are global. Bound request body/idle timeouts and aggregate upload-disk usage for the actual host, and alert before storage exhaustion. The audit did not determine a safe production storage quota or measure large-ledger/load capacity.

## 4. Backup and recovery acceptance

Back up PostgreSQL, private uploaded evidence and the separately protected MFA encryption key as one recovery plan. Use PostgreSQL 16 `pg_dump`/`pg_restore` and an encrypted, access-restricted backup destination; upload files and document metadata must correspond to the same recovery point. Do not put dumps, factor keys or uploads in Git.

Before relying on the backup, restore it into a **new isolated nonproduction** database/file root and verify: account/role counts; registration uniqueness; income/expense/reconciliation totals; document sizes/ownership; revision and decision history; and factor decryption using the separately restored key. Rotate session signing keys after an actual disaster restore so an older snapshot cannot revive previously revoked sessions. A restore has **not** been tested in this audit; no backup provider or encrypted storage configuration is known.

For the confirmed local PostgreSQL installation, an authorized operator can use these commands **after selecting an encrypted, restricted backup destination and stopping local application writers**. A custom-format dump is compressed, not encrypted; the destination's encryption must be verified independently. Back up the factor key separately in the restricted secret store. No production target is included:

```powershell
$pgTools = 'C:/Program Files/PostgreSQL/16/bin'
$backupDirectory = Read-Host 'Existing encrypted, restricted backup directory'
$operatorRole = Read-Host 'Local PostgreSQL administrator role'
$backupRunDirectory = Join-Path $backupDirectory ('mu-local-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backupRunDirectory -ErrorAction Stop | Out-Null
& "$pgTools/pg_dump.exe" -h 127.0.0.1 -p 5432 -U $operatorRole -W -Fc -f "$backupRunDirectory/database.dump" mu_cse_transparency
if ($LASTEXITCODE -ne 0) { throw 'Local dump failed' }
Copy-Item -LiteralPath 'E:/4.1/WEB +PROJECT/University-project/backend/uploads' -Destination "$backupRunDirectory/uploads" -Recurse -ErrorAction Stop
$restoreDatabase = 'mu_restore_' + (Get-Date -Format 'yyyyMMdd_HHmmss')
& "$pgTools/createdb.exe" -h 127.0.0.1 -p 5432 -U $operatorRole -W -T template0 $restoreDatabase
if ($LASTEXITCODE -ne 0) { throw 'Isolated restore database creation failed' }
& "$pgTools/pg_restore.exe" -h 127.0.0.1 -p 5432 -U $operatorRole -W --exit-on-error --single-transaction --no-owner --no-privileges -d $restoreDatabase "$backupRunDirectory/database.dump"
if ($LASTEXITCODE -ne 0) { throw 'Isolated restore failed' }
```

The upload source above is the confirmed local default; if private `UPLOADS_ROOT` differs, resolve and review that source first. Use a separate private runtime configuration pointing only to the newly named restore database and a **copy** of restored uploads. Disable real SMTP/external integrations, keep loopback binding, and compare the required invariants before calling the restore successful. Preserve the original database/file root. These instructions are based on PostgreSQL 16's [pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html) and [pg_restore](https://www.postgresql.org/docs/16/app-pgrestore.html); they have not been executed by this audit.

## 5. Monitoring and incident handling

The app emits controlled JSON request records and persistent `auth.password.denied`, `auth.mfa.verify_denied`, `auth.mfa.enrollment_denied`, enrollment-grant, session, role, payment and protected-document authorization events. Restrict database audit writes with the runtime role above; forward request/audit events to a separate append-only collector once hosting is identified.

At minimum, alert on >=10 password/MFA denials for one actor in 15 minutes, any unexpected privileged role/enrollment grant, repeated 403/429/503 responses on financial/upload routes, and a burst of protected-document access. A local operator can inspect the existing event totals without querying tokens or file content:

```sql
SELECT "actorId", action, COUNT(*) AS occurrences
FROM "AuditLog"
WHERE "createdAt" > now() - interval '15 minutes'
  AND action IN ('auth.password.denied', 'auth.mfa.verify_denied',
                 'auth.mfa.enrollment_denied', 'auth.mfa.enrollment_grant',
                 'documents.access_authorized')
GROUP BY "actorId", action ORDER BY occurrences DESC;
```

For a suspected compromised account, deactivate it/revoke its assignments through the audited System Admin UI, preserving required-role replacements. Preserve logs/evidence. Revoke sessions and investigate before reactivation; password reset preserves MFA. Rotate signing/mail/storage credentials only when exposure warrants it. Factor-key rotation needs a controlled re-encryption/enrollment plan; do not overwrite the existing key blindly.

## 6. Scanner, SMTP and release acceptance

Approved CSP/exact-origin CORS, safe seeding, ClamAV integration, financial retry protection and recovery-email TLS are implemented on the review branch. Read [security-upload-scanning.md](security-upload-scanning.md): install/update an actual private ClamAV engine, configure `CLAMD_HOST`/port, and prove clean/detection/unavailable behavior in isolated staging fixtures before release. Production always requires scanner configuration. The audit tested a synthetic daemon, not real signatures or existing-file scanning; existing uploads were not modified.

Configure real SMTP with `SMTP_HOST`, `SMTP_FROM`, and both `SMTP_USER`/`SMTP_PASS` if required. Port 587 with `SMTP_SECURE=false` requires STARTTLS; port 465/true uses implicit TLS. Valid certificates/TLS 1.2+ are required, with no plaintext fallback. Test a staging-only recovery address and sender authorization before release; external provider delivery/SPF/DKIM/DMARC are unverified. Never paste SMTP credentials into commands or reports.

New reset mail uses browser fragment capabilities. Verify the actual provider preserves the full fragment and disable click tracking on recovery mail; inspect only a disposable staging token. Keep external logging from collecting authentication bodies, URL queries or mail links. Old query links remain supported for their remaining one-hour lifetime; no historical proxy/framework trace was inspected or cleaned. Browser extensions/history and mailbox compromise still expose recovery links. Next's raw request/action/fetch logger is disabled, while controlled backend request references remain available.

External financial API clients must send one UUID v4 `Idempotency-Key` per intended income/expense create. Retry uncertain writes using the same key and identical payload/files. Never mint a new key to recover a lost response. The first-party forms preserve the original while mounted; after closing/reloading an unconfirmed form, inspect the ledger before re-entering it.

Keep `ENABLE_LOCAL_ADMIN_BOOTSTRAP=false` and demo seeding disabled on deployed environments. Review any historical demo identities/credentials before exposing a restored or older database; the audit intentionally did not reset them. Do not deploy the review branch before privileged onboarding, separate runtime privileges, verified HTTPS origins/proxy hops and real scanner/mail checks.

The development `braces` advisory remains open: seven high-severity tooling entries, zero production advisories in the latest registry check. Forced npm remediation proposes a Tailwind major migration and incompatible Next ESLint downgrade; it has not been used. Avoid processing untrusted glob configuration in local/CI tooling, and review a compatible upstream fix when available. This containment does not resolve the advisory.
