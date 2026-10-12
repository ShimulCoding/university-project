# Isolated PostgreSQL boundary review

## Scope and outcome

The owner approved a fresh fake-only database, separate runtime/migration roles, fourteen migrations on that new target and cleanup of owned test fixtures. Execution used a new PostgreSQL **16.15** container, not the owner's PostgreSQL 16.13 cluster. No original data, backend environment, credentials or enrolled MFA factor changed. **SEC-22 remains open for the original runtime.** Pooler/browser/real-scanner/final-image acceptance is pending.

The direct SQL verifier passed **29 checks**; **24 inherited non-browser backend suites** subsequently returned exit 0. These are correctness/security measurements on native Node **24.13.1**, Windows 11, an i5-1135G7 (4 physical/8 logical CPUs), 25,559,359,488 bytes RAM, and a fresh fake database. Other owner applications were running. They establish neither VPS capacity nor a throughput improvement.

## Trust boundary and permanent fix

`infra/postgres/grant-test-runtime.sql` grants no ownership, role membership, CREATE/TEMP, schema creation, migration-table access or grant option. AuditLog and FinancialIdempotency allow SELECT/INSERT only. Ordinary tables allow SELECT/INSERT and UPDATE of **non-primary-key columns**. DELETE is limited to RefreshToken, PasswordResetToken and MfaChallenge maintenance. Both login roles deny SUPERUSER, CREATEDB, CREATEROLE, INHERIT, REPLICATION and BYPASSRLS.

The previous table-wide UPDATE design had an indirect history-mutation path. PostgreSQL's referential actions can cascade a User primary-key update into AuditLog.actorId and FinancialIdempotency.actorId even when direct history updates are denied. The verifier temporarily applies the naive grant **inside a transaction**, reproduces both cascades, throws a controlled rollback, and proves the original rows/grants survived. Committed column grants then deny primary-key changes with SQLSTATE **42501**. Do not replace the column grants with table-wide UPDATE.

The fixture helper separates tested application calls from privileged cleanup. Services, HTTP handlers and negative/concurrency assertions still use `src/config/prisma.ts` under the restricted runtime account. Only test cleanup and explicitly simulated audit-age adjustments use the migration account. Before fixture operations, both clients must report the exact fresh database and paired actual `current_user`. The helper is outside production compilation. Test credentials never enter the application environment, runtime image or command arguments.

Provisioning requires an explicit private operator file beneath ignored `.cache/scalability`, checked owner-only ACLs, loopback addresses, generated database/role names and a patched 16.x server. It refuses pre-existing target names. All explicit configuration checks precede the private owner-environment preservation hash. PostgreSQL's official libpq SCRAM helper encrypts role passwords; identifiers/literals use libpq escaping. Credentials travel in private files/stdin, not SQL/logged arguments. Raw child/Prisma diagnostics are suppressed; reviewed numeric fields, known error kinds and SQLSTATE remain available.

Pure input/dispatch contracts pass **59 checks** without database connections, provisioning statements, application spawns or private-file contents. Private paths are checked lexically before filesystem resolution and checked again after resolution for symlink escape. The same assertions run in an exported index containing no owner environment file; nonexistent outside-cache paths are denied by policy rather than filesystem accident.

## Local infrastructure evidence

Pinned image: `postgres:16.15-bookworm@sha256:0ea6700a3b4f0ae6ce746519073558aed4d88a79d8d07622a9a644946c7319c4`. Actual server: 16.15, Debian 16.15-1.pgdg12+2. Installed Windows libpq/psql remain 16.13; no host PostgreSQL upgrade occurred.

Inspection passes **31 actual checks**, in addition to preparation **17** and inspection **20** pure contracts: UID999, read-only root filesystem, dropped capabilities/no-new-privileges, kernel 0.75 CPU, **805,306,368 bytes memory**, zero swap and 128 PIDs. These are component limits, not a measured whole-stack 2 CPU/4 GB fit. Image/OS advisory scanning remains open.

Docker 29's internal network suppressed the requested published port: actual `NetworkSettings.Ports` is null. The verifier now distinguishes requested loopback binding from effective publication. Native tests use an owned bounded **127.0.0.1:15432** WSL relay to the exact owned container IP, preserving end-to-end SCRAM, with no protocol/SQL logging. No Windows listener forwarding, public Docker socket or owner port was changed. This relay is test plumbing; deployment must verify its own effective network and firewall boundaries.

## Reproduction

Run from the repository root using **your own approved fresh fixture**, never the owner's backend `.env` as the target. The operator scripts currently require reviewed Windows PostgreSQL tools and ACL verification. Private paths below are placeholders for already generated owner-only files, not secret values.

```powershell
node scripts/scalability/prepare-local-container.mjs --self-test
node scripts/scalability/verify-local-container.mjs --self-test
node scripts/scalability/verify-provisioning-contracts.mjs
node scripts/scalability/verify-local-container.mjs <owned-private-container-directory>
node scripts/scalability/verify-local-database.mjs --config <private-fixture.json> --operator-config <private-operator.json>
node scripts/scalability/verify-local-database.mjs --config <private-fixture.json> --run-script verify:project-audit
node scripts/scalability/verify-local-database.mjs --config <private-fixture.json> --run-script verify:security-financial-replay
```

| Inherited backend suite | Direct isolated result |
| --- | --- |
| flows, finance, governance, event-scope | Exit0 each. Existing mocked repository cases remain unit evidence, not real transaction/permission proof. |
| event-workspaces | Exit0; API-only. Browser/SSR not enabled. |
| project-audit | 81 checks |
| security-logging, security-seed, security-scanner | Exit0 each; scanner uses a synthetic daemon, not actual antivirus signatures. |
| security-cors | 18 checks |
| security-financial-replay | 62 checks |
| security-mail-transport | 35 checks; synthetic loopback TLS/mail only |
| security-admission-lifecycle | 12 checks |
| security-action-limits | 32 checks |
| security-audit-metadata | 19 checks |
| security-uploads | 15 checks |
| security-mfa | 71 checks, disposable accounts only |
| security-mfa-crypto | 15 checks |
| security-email | 26 checks |
| security-login | 37 checks |
| security-session-boundary | 18 checks |
| security-bootstrap | 15 checks; no owner bootstrap |
| security-document-audit | 14 checks |
| demo:mfa-contract | 16 checks; no real demo enrollment |

The guarded dispatcher recorded exact suite exits and available reported counts in ignored `inherited-suite-progress.json`. Missing numeric counts above mean the output parser did not capture that format; no count is inferred from old results. All 24 scripts passed. Real financial races/rollback, current authorization, MFA and document-audit tests are retained. Browser scripts require explicit fixture frontend/API URLs and reject owner-port defaults.

## Hostile review, rollback and unresolved risks

Review all grant paths including foreign-key cascades, warning/no-op GRANT behavior, object ownership, PUBLIC privileges and future schema changes. New columns default to no UPDATE until reviewed/granted; new tables receive no runtime privileges. Neither append-only permissions nor tests prevent a compromised migrator/operator from rewriting history. Separate secrets/processes/backup custody are still required.

The owner runtime is untouched, so rollback is to stop only new fixture applications and retain the fake database/roles/volumes for inspection. Do not automatically DROP, reset, prune, reassign ownership or delete records. Reverting test tooling does not require owner-data changes. A future owner cutover requires a separate reviewed proposal, backup/restore evidence, permission review and explicit approval.

Open gates: actual PgBouncer transactions and all relevant regressions through it; fresh Linux/runtime-only artifacts; actual browser/CSP/MFA/PDF journeys; real ClamAV detection/outage; complete image/dependency/secret scanning; distributed quotas; dependency readiness; measured whole-stack resources/load; actual owner-runtime cutover. Passing the direct fake-data tests cannot close these gates.

The production build and existing seed-type gate pass. A newly expanded strict check of all backend verifiers found **51 existing type errors** in both immutable pre-database and staged-database snapshots, with matching file/error-code pairs. They are not introduced by the fixture split and are being repaired as a separate concern; the expanded verifier-type gate is not green. Runtime assertions were not removed or relaxed.
