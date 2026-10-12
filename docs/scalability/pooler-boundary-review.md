# Local transaction-pooler boundary

Status: local compatibility/security concern verified; Phase 1 remains in progress. No owner database/configuration/MFA or main change. This is not VPS, fleet, TLS or throughput acceptance.

## Hypothesis and observed change

A bounded transaction pool can retain existing Prisma/session/governance/financial behavior while limiting server connections, without giving the pooler a migration identity. On the same fake PostgreSQL16.15 database and native Node24.13.1 machine, six independently constructed clients can hold six direct backend transactions. Through PgBouncer1.26.0, five hold distinct backend transactions; the sixth fails at the configured ten-second queue deadline. Final sequential observation: **10,257ms**, Prisma P2010; subsequent query succeeds. This is a connection bound, not a requests-per-second improvement.

| Reproduced issue / source | Fix and proof |
| --- | --- |
| The direct-only fixture helper refused the two required ports; CLI URL queries could override transport via `host`. `backend/scripts/helpers/fixture-boundary.ts`; `scripts/scalability/verify-local-database.mjs` | Explicit transaction-pooler descriptor fixes host, ports and owned image; direct migrator stays separate. URL query allow-list rejects transport overrides, duplicates, fragments, unbounded options and foreign schema. Actual current_database/current_user checks remain mandatory. Pure dispatcher/helper207; actual privilege29. |
| Windows-backed Compose secret mounts actually appeared as UID1000/mode777; unrelated UID65534 could read the fake SCRAM file. `scripts/scalability/prepare-local-pooler.mjs`; `infra/scalability/install-pooler-secrets.py` | Fresh Linux root0700 run directories, exclusive/no-follow writes, UID10001/GID10001/mode0400 files; bind mounts read-only. The actual process can read, cannot write, and unrelated UID65534 cannot read either file. Before denial exit1; after denial exit0. Windows owner ACLs are retained, not assumed to supply Linux modes. |
| Source inventory omitted suffix Dockerfiles/context ignore files. `scripts/scalability/operator-inventory.mjs` | Cover Dockerfile and exact Docker context configuration; hidden `.env` remains excluded. New positive/drift contracts; inventory40 passes. Source mapping never executes these files. |
| Wrapper dropped comma-separated browser aggregates. `scripts/scalability/verify-local-database.mjs` | Numeric-only parser recognizes existing comma/semicolon formats; raw child lines/tokens remain discarded. Negative source contract preserves no arbitrary output. |

The pooler receives only the existing fake runtime SCRAM verifier, copied privately from its exact role. No password reset, forced user, wildcard database, auto-discovery auth query, admin/stats account, migration secret or real account enrollment is involved. Scope checks precede operator reads. The new helper creates only fresh files and never deletes/replaces a run.

## Exact component and enforcement

Built image `sha256:b5b268e6b371aab1cc3ef00cc92a0106e2c30643bc98e4534982e5b07df367a2`, size133,832,933B, Linux/amd64. PgBouncer1.26.0/source hash and immutable official bases are specified in [build plan](pgbouncer-build-plan.md). Native version: libevent2.1.12, OpenSSL3.0.22; linkage has no missing library.

Actual Docker/kernel controls: UID10001, read-only root, cap-drop ALL/no-new-privileges, 0.15CPU, 67,108,864B RAM, zero swap, 32PIDs, nofile256, two bounded tmpfs mounts, owned internal network, no published port or daemon socket. Kernel `cpu.max=15000 100000`, `memory.max=67108864`, `memory.swap.max=0`, `pids.max=32`. Runtime/migrator traffic reaches only owned loopback relays; these are native test plumbing, not a deployment proxy or cross-host encryption proof.

Transaction mode: five backend connections, fifty clients, no reserve pool, max_prepared_statements200, query_wait_timeout10s/query_timeout30s, finite login/connect/idle/transaction limits. Raw connection/disconnection/pooler-error/statistics logging is disabled. Migrations and fixture cleanup use the independently verified direct migrator, never the runtime pooler. [Prisma6 official guidance](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/pgbouncer) supports transaction mode/prepared statements and omitting the legacy compatibility flag for this version. [PgBouncer settings](https://www.pgbouncer.org/config.html) define the independent client/backend/queue limits.

## Verification and reproducible commands

Run from repository root with an explicitly approved fake stack. Preparation emits only its fresh private directory, never credentials. Supply private paths through the documented named parameters; do not read owner `.env` or substitute owner ports.

```powershell
node scripts/scalability/verify-pgbouncer-build-contracts.mjs
node scripts/scalability/prepare-local-pooler.mjs --self-test
python infra/scalability/install-pooler-secrets.py --self-test
node scripts/scalability/verify-local-pooler.mjs --self-test
node scripts/scalability/verify-provisioning-contracts.mjs
node scripts/scalability/verify-inventory.mjs
node node_modules/typescript/bin/tsc -p backend/scripts/tsconfig.verification.json
```

Actual preparation: `node scripts/scalability/prepare-local-pooler.mjs --config <private-direct-fixture.json> --operator-config <private-operator.json> --container-directory <owned-private-container-directory>`. Use generated compose.env with `infra/scalability/compose.pooler.yml` in approved Ubuntu WSL; `docker compose ... config --quiet`, then `up --detach --force-recreate --wait --wait-timeout 30`. Force recreation matters: observed Compose5.6 retained old secret-source mounts after an ordinary up. This targets only the owned pooler, never PostgreSQL/volumes or owner apps. Restart/revalidate only its owned relay if its container address changes.

Actual acceptance: `node scripts/scalability/verify-local-pooler.mjs <fresh-private-pooler-directory>`; `node scripts/scalability/verify-local-database.mjs --config <private-fixture-pooled.json> --operator-config <private-operator.json>`. Scripts suppress private diagnostics and retain new ignored evidence files. The pooler verifier occupies the five-server budget during its queue test; run it sequentially with application/browser/load tests.

| Gate | Actual result |
| --- | --- |
| Source/context48; preparation13; native installer8; inspection/denial mutations46 | Pass. Pure checks do not establish runtime isolation. Docker represents absent devices as null, covered alongside the empty-list fixture; nonempty devices still fail. |
| Actual pooler | 70 pass: 36 inspection/kernel/linkage/mode/read-denial checks; 34 actual connection/parameter/transaction/denial/deadline checks. Twelve parameterized transactions retain injected-looking text as data and expire LOCAL settings. |
| Negative identities/mappings | Wrong password and migrator: actual SASL authentication denial; other database: unmapped postgres denial; admin console: not allowed. Prisma6 startup FATAL can omit errorCode: exact probe-specific denials are asserted. Network/timeout errors fail the negative test; no generic rejection is accepted. |
| Actual restricted SQL / migration metadata | 29 pass, same14 migration checksums; direct and indirect history/key/DDL/GRANT denials and ordinary writes/maintenance retained. |
| Inherited backend suites | All24 pass twice through pooled runtime, final run against native0400 mounts. Includes project81, replay62, MFA71, session18, document14, uploads15, action32. Existing mocked unit cases and fake scanner are not real-engine proof. |
| Real native Edge against owned3300/4300 | Final event workspace/API/render/browser/design1135; MFA74; fragment/legacy reset91; sign-in14; strict CSP/hydration15; public design195. Public run has no retained published fixture event, so dynamic public-event/summaries coverage is not inferred from195. Workspace run includes actual protected-file/PDF download and financial retry workflows. |
| Frontend/backend checks | Frontend lint/types/client/PDF/UI/financial26 and backend product/all-verifier types pass. Fresh native frontend build already passed; this is not a Linux frontend-image build. |
| Source security | Semgrep225 applicable rules/10 changed sources:0 findings/0 parse errors before final denial assertions; final exact-index/scanner/secret results recorded in LOG. No rule/assertion/compiler/security budget was weakened. |

The 208,905ms combined workspace verification duration is test duration under other host activity, not latency/throughput. Native hardware is the already recorded Windows/WSL host, not2CPU/4GB. Dataset is fresh source migrations/role catalog plus isolated per-run fixtures cleaned by the verified migrator; no bulk capacity dataset was generated.

## Hostile review, rollback and remaining gates

Initial actual verification found Docker null representation and DrvFS mode leakage that the source-only checks did not prove. Both are recorded and reattacked. The first metadata inspection was insufficient for unrelated-UID privacy; only final70 includes that gate. Error-code assumptions were replaced with narrowly tested actual protocol denials, not ignored failures.

Stop only the owned pooler/relay or restore the existing direct fake-runtime profile to the owned test API. Keep the private native files/evidence/volumes/WSL backup; no deletion is needed. A normal follow-up source revert is possible without changing original records. Never fall back to owner/superuser runtime credentials to pass a gate.

Remaining: real ClamAV/signatures and mail delivery, image/OS/layer/full-license advisory acceptance, Linux production app startup/whole-stack limits, shared multi-instance quotas/cache/session/job threats and load/failure/restore profiling. Original SEC-22 runtime cutover and the separately prepared handoff SQL remain unexecuted/approval-gated. A stolen runtime credential can still perform allowed business writes/audit INSERT; privileged operators can change history. No RLS, encrypted distributed transport, complete tamper resistance or50k capacity is established here.
