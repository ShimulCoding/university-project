# Scalability execution log

Append only. Dates use UTC in measurements and Asia/Dhaka for user-facing dates. Each entry records hypothesis, exact command or explicit operation, result, decision and environment/dataset. Credentials/capabilities/PII never belong here. Other documents may summarize these entries but must not invent evidence.

## 2026-10-12 / E0001 — branch and inherited state

- Hypothesis: the requested security baseline exists and can be extended without discarding subsequent owner support.
- Commands: `git status -sb`; `git log -5 --format="%h %an <%ae> %s"`; `git branch --list`; `git rev-parse HEAD security/local-hardening-2026-10-11 main origin/main`; `git switch -c perf/world-class-scalability security/local-hardening-2026-10-11`.
- Result: clean security tip `415a8692a655665b01bfb52a0302a5744e5e359d`; local/remote main both `816d7d60bcd37931a6444d5561b1aeac40e5f7a1`; requested branch created. The base contains 33 security/support commits, rather than the request's historical 28.
- Decision: preserve the entire current baseline. Next author is Nayem. No application/database/environment change in this operation.

## 2026-10-12 / E0002 — execution environment

- Hypothesis: determine whether a VPS-limited Docker baseline can run here before promising measurements.
- Commands: `Get-Command node,npm,docker,k6,gh,python,semgrep,psql -ErrorAction SilentlyContinue`; `node --version`; `npm --version`; `Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors`; `Get-CimInstance Win32_ComputerSystem | Select-Object TotalPhysicalMemory`; `Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,FreePhysicalMemory`; `Test-Path 'C:/Program Files/PostgreSQL/16/bin/psql.exe'`; `Test-Path '.cache/security-audit/semgrep-env/Scripts/python.exe'`.
- Result: Node 24.13.1; npm 11.8.0; Windows 11 Home 10.0.26200; Intel i5-1135G7, 4 cores/8 logical processors; physical RAM 25,559,359,488 bytes; free physical memory at inspection 11,254,640 KiB. Docker, k6, gh and semgrep/psql PATH commands absent. PostgreSQL psql and the existing Semgrep environment exist at the explicit paths above. Python 3.13 is installed. WSL executable exists; engine/distribution readiness has not been verified.
- Dataset: none; OS/tool metadata only. Other local app processes are running and were preserved.
- Decision: no claim of VPS resource isolation or capacity. Continue inventory/security preparation while obtaining an executable local environment.

## 2026-10-12 / E0003 — external permission

- Operation: asked before outbound traffic; owner approved official library documentation, official npm/container registries/security advisory feeds and this repository's GitHub push/phase PR operations.
- Result: source/tooling inspection may use those destinations. Application traffic/load tests remain local. No production endpoint, new account or paid service is authorized.
- Decision: use current primary documentation for new APIs; independently review downloaded tools/dependencies and pin/audit/license-check them. Other destinations still need approval.

## 2026-10-12 / E0004 — isolated database and host tooling approval

- Operation: owner approved `database-boundary-proposal.md` and `local-tooling-proposal.md` through the two explicit approval questions.
- Result: new fake-only local database/roles, migrations only there, owned fixture cleanup, Docker Engine/Compose installation in existing Ubuntu WSL using official Docker/Ubuntu apt sources and checksum-verified k6/GitHub CLI vendor releases are authorized. Original runtime/data/schema cutover, unrelated deletion, real MFA changes and paid services remain unauthorized.
- Commands: `wsl --list --quiet`; `wsl -d Ubuntu-24.04 -- sh -lc 'for task_tool in docker k6 pgbouncer semgrep node; do command -v "$task_tool" || true; done; uname -r; id -u'`; `C:/Program Files/PostgreSQL/16/bin/psql.exe --version`; `.cache/security-audit/semgrep-env/Scripts/semgrep.exe --version`; `wsl -d Ubuntu-24.04 -u root -- bash "/mnt/e/4.1/WEB +PROJECT/University-project/.cache/scalability/docker-preflight.sh"`.
- Result: Ubuntu-24.04/noble, WSL kernel 6.18.33.2-microsoft-standard-WSL2, user ID 1000, systemd init; Docker packages absent from dpkg preflight; curl/gpg/apt-get/dpkg-deb available. PostgreSQL 16.13 and Semgrep 1.180.0 verified. A preliminary nested shell-quoted preflight printed only `Existing`; the explicit ignored script completed successfully. No installation/database change yet.
- Decision: implement new isolated boundaries first. Installation/permission gates must be executed before being marked complete.

## 2026-10-12 / E0005 — SEC-05 isolation proof

- Hypothesis: compatible packaging can remove the known vulnerable development chain from a serving artifact without a risky Tailwind major migration/Next ESLint downgrade.
- Commands: `npm audit --json`; `npm audit --omit=dev --json`; `npm view braces version versions license repository --json`; `npm ls braces micromatch tailwindcss eslint-config-next --all`; fresh manifest-only directory `.cache/sec05-production-install-20261012-b23fe957`: `npm ci --omit=dev --ignore-scripts --no-fund --audit=false`, then separate explicit production audit; `node scripts/scalability/verify-runtime-dependencies.mjs --self-test`; `node scripts/scalability/verify-runtime-dependencies.mjs --mode source`; `node scripts/scalability/verify-runtime-dependencies.mjs --mode runtime --runtime-root .cache/sec05-production-install-20261012-b23fe957`.
- Environment/data: native Windows/Node24.13.1/npm11.8.0 from E0002; copied source manifests and preexisting production outputs only, no environment/owner data/evidence/private traces. Original/copy 1,199-file subset digest and exact timing commands are in `sec05-dependency-boundary.md`; fresh-build source correspondence is unverified.
- Result: full audit remains seven high development entries, exit 1, no patched braces version. Production audit exit 0/zero advisories. Known-chain installed entries 9 → 0 in the isolated 204-package install. Fourteen gate contract/negative checks pass; runtime artifact scans 1,171 JS/JSON/map files, 19,248,593 bytes and 44 Next traces. Root repeated source/runtime gates successfully. Fresh installation observation 27.463s; initial artifact gate 17.773s and later strengthened warmed gate 1.107s are single observations, not a claimed speed gain.
- Review/decision: keep the advisory visible and add the exclusion gate; no package/lock/lint/Tailwind/test/application change. Safe Prisma/chokidar4 remains in npm runtime install. Final image gate/audit/startup required. Rollback reverts only this new verifier/documentation; no database/business-data rollback.

## 2026-10-12 / E0006 — inventory and workload contract checks

- Hypothesis: source-driven mapping and arithmetic can prevent omitted entry points and unsupported capacity claims before optimization.
- Commands: `node scripts/scalability/verify-inventory.mjs`; `node scripts/scalability/inventory.mjs`; `node scripts/scalability/inventory.mjs --check`; `node scripts/scalability/workload-model.mjs --document`; `node scripts/scalability/workload-model.mjs --verify`; `node scripts/scalability/workload-model.mjs --check-document`.
- Result so far: 36 inventory parser/determinism/drift checks; 91 APIs including health, 39 pages, 27 models, 307 TypeScript + 2 supporting app sources, 77 operator/config/migration sources and 62 npm commands before adding infra discovery. Workload checks pass 27. An initial workload route-coverage failure rejected incorrect `/api/public/events` assumptions; source-confirmed `/api/events` and exact parameter names replaced them. No assertion was removed or weakened.
- Decision: regenerate after the final source/infra inputs, review the phase report and keep all demand frequencies explicitly hypothetical. No latency/RPS/application/VPS capacity measurement yet.

## 2026-10-12 / E0007 — dependency concern security review

- Commands: repeated `npm audit --json` and `npm audit --omit=dev --json`; `.cache/security-audit/semgrep-env/Scripts/semgrep.exe scan --config p/typescript --config p/nodejs --metrics off --disable-version-check --json --output .cache/scalability/semgrep-dependency-gate.json scripts/scalability/verify-runtime-dependencies.mjs`.
- Result: full audit exit 1/seven high known development entries; production exit 0/zero advisories. Semgrep 1.180.0 selected 68 applicable JS rules from the 74-rule feed, scanned the new gate with zero findings and ~100% parsed lines, exit 0. No rule suppressed and no test or application permission changed.
- Decision: this bounded gate is ready for the first alternating-author commit; final image/startup and the full Phase 1 application security rerun remain open. Run staged redacted Gitleaks and diff checks before committing.
