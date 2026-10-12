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

## 2026-10-12 / E0008 — first verified concern committed and pushed

- Commands: `git diff --cached --check`; `node --check scripts/scalability/verify-runtime-dependencies.mjs`; `node scripts/scalability/verify-runtime-dependencies.mjs --self-test`; `.cache/security-audit/gitleaks/gitleaks.exe git --staged --redact=100 --no-banner --no-color --report-path .cache/scalability/gitleaks-dependency-gate-staged.json .`; `git commit --author="Nayem <nayem692003@gmail.com>" -m "Nayem: Added verified runtime dependency isolation gate"`; `git push -u origin perf/world-class-scalability`; `git status -sb`.
- Result: syntax/diff/14 contracts pass; staged secret scan zero findings. Commit `6fce5aa` pushed to the new scalability branch. Remaining untracked source-map/model/proposal files are authorized ongoing mission work; no original changes were discarded. Next author Shimul. Main unchanged.

## 2026-10-12 / E0009 — phase-0 hostile review and source proof

- Hypothesis: no executable/config/migration entry or unsupported path should silently evade the source inventory.
- Review: independent agents found missing JSON/TOML/shell/Docker formats, imprecise tool-availability wording, false advisory-lock wording and a loose nonperformance proof exception. Corrected formats/fail-closed discovery/dynamic current counts, retained historical baseline, refined state/ADRs/gates. Initial strict format check rejected an ignored runtime log before reading it; log/PID/nonexecutable exclusions are now explicit.
- Commands: `node scripts/scalability/verify-inventory.mjs`; `node scripts/scalability/inventory.mjs`; `node scripts/scalability/inventory.mjs --check`; `node scripts/scalability/workload-model.mjs --verify`; `node scripts/scalability/workload-model.mjs --check-document`; syntax checks for all four map/model scripts; `.cache/security-audit/semgrep-env/Scripts/semgrep.exe scan --config p/typescript --config p/nodejs --metrics off --disable-version-check --json --output .cache/scalability/semgrep-phase0.json scripts/scalability/inventory.mjs scripts/scalability/operator-inventory.mjs scripts/scalability/verify-inventory.mjs scripts/scalability/workload-model.mjs`.
- Result: 38 inventory checks/27 model checks pass; current map 91 routes/39 pages/27 models/309 app sources/89 operator-config-migration sources/62 commands. Syntax/diff checks pass. Semgrep scans four scripts with 68 applicable JS rules, zero findings, ~100% parsed lines. No application's behavior changed.
- Additional proposal review: PostgreSQL PUBLIC defaults allow TEMP/CONNECT; new-fake-only SQL now revokes them and pairs exact role/database names. Parent primary-key cascading into protected history is an unverified risk requiring a Phase1 negative test; do not call grant preparation an executed restricted-runtime proof.
- Decision: foundation is ready for a snapshot/review PR after staged secret scan. Actual performance validation, original SEC-22 cutover and full security rerun stay open.

## 2026-10-12 / E0010 — approved portable tools

- Commands: `python .cache/scalability/tools/vendor-20261012-c28b11cc/install-vendor-tools.py`; `python .cache/scalability/tools/vendor-20261012-c28b11cc/complete-vendor-tools.py`; `python .cache/scalability/tools/vendor-20261012-c28b11cc/complete-windows-tools.py`; each installed executable's version command; `git check-ignore -v` for both retained provenance files.
- Result: pinned k6 v2.3.0 (Go1.26.8), exact-tag AGPL-3.0; gh2.102.0, exact-tag MIT. Vendor ZIP SHA256 values are k6 `112276d495e5741c968e2bc09ea6196099c1275bd6db9ee0875d173c7148ce43`, gh `ae64e556ecc240b200f7eba60d550e4bb60d78e860e69dd88c449405b86067f4`; both vendor manifests match. Archive extraction checks reject traversal/symlink/duplicate/excessive-size entries. Initial helpers rejected the real Windows `k6.exe v2.3.0` banner; fresh completion helper verified the exact pinned prefix without overwriting downloads.
- Decision: tools are available privately in the ignored directory, without global PATH/auth/account/DB/load/PR changes. Vendor-manifest agreement is verified; artifact signatures were not independently verified. Use only approved local fake workload targets.

## 2026-10-12 / E0011 — Docker installation license gate

- Command: `wsl -d Ubuntu-24.04 -u root -- bash "/mnt/e/4.1/WEB +PROJECT/University-project/.cache/scalability/install-docker.sh"`.
- Result: official GPG fingerprint matched; new approved Docker apt key/source added. Download-only stage selected DockerCE/CLI29.9.0, containerd2.4.1, buildx0.38.0, Compose5.6.0 and eight Ubuntu dependencies: 13 new packages, zero upgrades/removals, 92.3MB archives/366MB prospective disk. Installation stopped before package/service changes because buildx archive lacks copyright metadata; archive layout inspected explicitly. Subsequent read-only review found four Docker packages lacking bundled license files and began exact-tag upstream license/archive-hash verification.
- Decision: retain downloaded artifacts and preserve the source/key created by this mission; do not bypass license review or blindly rerun setup over existing paths. Docker engine/cgroup availability is not yet verified.

## 2026-10-12 / E0012 — approved Docker installation completed

- Commands: `wsl -d Ubuntu-24.04 -u root -- bash '/mnt/e/4.1/WEB +PROJECT/University-project/.cache/scalability/docker-inspect-licenses.sh'`; same invocation for `docker-record-licenses.sh` then `docker-complete-install.sh`. Installation uses all 13 exact APT pins, `--no-download --no-upgrade --no-remove`, only the approved new host packages.
- Result: all archives match signed APT SHA256 metadata; nine genuine package copyrights plus four exact-tag upstream licenses and Tini0.19.0 MIT were reviewed before installation. Actual dpkg delta: 13 new / zero upgrades / zero removals. Engine/CLI29.9.0, Compose5.6.0, Buildx0.38.0, containerd2.4.1. Unix socket root:docker0660; no dockerd TCP listener; automatic startup disabled; Docker group empty. No images/containers/application/database changes. WSL reports eight CPUs / 12,435,705,856 RAM bytes, not an enforced VPS budget.
- Evidence: ignored `.cache/scalability/docker-install/`; `licenses-reviewed/packages.tsv` SHA256 `bced668807dc98bb7b1e7a1f8b821dbf2b89606ca893143beaa8ba53b1c52677`; `installed-change-summary.json` SHA256 `b6c8fcc0b3bc9e78d197fd8fd514a6ce4e614245c0be2c852cfce3e518210885`. Mission-owned apt key/source hashes stayed unchanged. No speed/capacity claim.
- Decision: tooling prerequisite satisfied; container limits, image artifact/security gates and fake-runtime/pooler behavior remain execution tasks. Preserve existing local owner apps/data/MFA.

## 2026-10-12 / E0013 — phase-0 foundation and review snapshot

- Commands: staged redacted Gitleaks/diff checks; `git commit --author="Shimul <shimulc17@gmail.com>" -m "Shimul: Added complete scalability source map and verified workload model"`; `git push origin perf/world-class-scalability`; `git status -sb`; `git rev-parse main origin/main`; `git push origin 13134ea:refs/heads/review/scalability-phase-0`; `node .cache/scalability/phase-pr.mjs 0` (private existing Git credential, GH_TOKEN only in child environment, exact body file).
- Result: 13134ea pushed; staged scan1.19MB/zero findings; main unchanged816d7d6; PR https://github.com/ShimulCoding/university-project/pull/1 against security branch. Snapshot stays stable while perf continues. Independent source rerun38/27/14 passes.
- Decision: next author Nayem. Phase0 source review is available; measured workload/capacity and Phase1 runtime gates remain open.

## 2026-10-12 / E0014 — new patched fake PostgreSQL infrastructure

- Commands: pinned official `docker pull postgres:16.15-bookworm@sha256:0ea6700a3b4f0ae6ce746519073558aed4d88a79d8d07622a9a644946c7319c4` in approvedWSL; `node scripts/scalability/prepare-local-container.mjs --self-test`; elevated preparation; owned Compose config--quiet/up-d--wait; `node scripts/scalability/verify-local-container.mjs <owned-private-directory>`.
- Result: preparation17 input/path checks, fresh owner-only credential ACL before writes; PostgreSQL16.15 (Debian16.15-1.pgdg12+2), nonroot999, read-only rootfs, all capabilities dropped/no-new-privileges, kernel0.75CPU/805306368memory bytes/zero swap/128PIDs. Actual private network suppresses publishing (`NetworkSettings.Ports`5432=null) despite requested HostConfig port; initial verifier incorrectly inferred effective publication. Added effective-port negative; current inspection20 contracts/31 actual checks distinguish requested from effective binding. No whole-VPS capacity/image-CVE certification.
- Decision: retain internal network; use an owned bounded loopback-only WSL test relay to the exact owned container, SCRAM end to end. This is native test plumbing, not a production deployment architecture. First empty fixture directories from blocked ACL preparation contain no credentials. No Windows settings/owner database changes.

## 2026-10-12 / E0015 — isolated roles and hostile helper review

- Commands: guarded new-target provisioner with explicit private operator config;14 migrations on only freshmu_scale target; privilege verifier; individual guarded real-security scripts. Owner.env is privately hashed before/after, never emitted.
- Result: freshmu_scale_5c1271ed818c4d50994ff3ea8f193d0e;29 actual role/DDL/direct-history/PK-cascade/ACL/write checks pass. A rollback-only naive tableUPDATE grant reproduced indirect AuditLog/FinancialIdempotency actor changes; non-PK column grants prevent them. Reviewer found/fixed original-operator fallback, standalonePython hostaddr bypass, GRANT warning/no-op misassertion and browser defaults pointing to ownerports. Pure hostaddr negative makes zero connections/writes. No source assertion/security budget was removed; migrator is fixture-cleanup only.
- Decision: direct full-suite/pooler acceptance still pending. Original runtime is not cut over. Native installedlibpq/psql16.13 remain unchanged; fresh server16.15 is patched. Generated bytecode is retained/excluded as generated output; unsupported source formats still fail.

## 2026-10-12 / E0016 — additional approvals and local interruption

- Owner approved pooler-tooling-proposal.md (officialPgBouncer source/checksum and signed Debian packages), then build-source-proposal.md (officialPrisma binaries/currentNext font downloads). Existing external approvals remain narrow; application/load traffic only local fake targets.
- Two implementing agents reached a usage limit before all gates. Root continues directly. Foreground exec sessions were lost; WSL stopped and direct tests reported Prisma initialization errors. Restored only owned Docker/container/relay through `.cache/scalability/start-owned-test-transport.sh` in `Start-Process -WindowStyle Hidden`; no auto-start/TCPsocket/group/Windows setting changes. PrivatePID/logs retained. Do not misreport transient test-transport failure as a resolved application defect or green test.

## 2026-10-12 / E0017 — hidden-root delivery fixed and proved

- Hypothesis: basename+authorized directory preserves Express root containment/default filename-dotfile denial and restores legitimate hidden private upload roots.
- Commands: `node node_modules/tsx/dist/cli.mjs backend/scripts/verify-file-response.ts`; backendbuild; guarded isolated runtime runner for document-audit/action-limits/project-audit; frontendlint/types and client/financial/PDF/UI/policy/origin/logger/reset contracts.
- Result: transport10; same54-byte syntheticPDF500before→200/exact bytes after. Real restricted-runtime document14/action32/project81 pass after restoring relay. Frontend contracts and lint/types/backendbuild pass. No auth/role/migration change in this fix. Initial non-escalatedtsx was blocked by esbuild spawnEPERM; rerun with authorized local subprocess passed. No assertion/permission expansion/workaround was used.
- Decision: one transport concern is ready for independent commit after source-specific SAST/stagedsecret/diff gates. Pooler/realAV/fullruntimebaseline remain open. Do not label these security/correctness observations a speed gain.

## 2026-10-12 / E0018 — file response hostile source scan

- Command: `.cache/security-audit/semgrep-env/Scripts/semgrep.exe scan --config p/typescript --config p/nodejs --metrics off --disable-version-check --json --output .cache/scalability/semgrep-file-response.json backend/src/utils/file-response.ts backend/src/modules/documents/controllers/documents.controller.ts backend/scripts/verify-file-response.ts`.
- Result: exit0,74 rules/three files, zero findings/~100%parsed. No warning suppressed. The earlier whole-source scan366 files/zero parseerrors/one reviewed sendFile warning predates this moved call and is historical, not a final updated full scan.
- Decision: export the staged index to a fresh ignored snapshot for source-map/build/transport verification. This prevents concurrently prepared database/lifecycle work from being accidentally committed or included in this concern's inventory. No existing working file is discarded.

## 2026-10-12 / E0019 — protected-file concern committed/pushed

- Commands: `node .cache/scalability/verify-staged-snapshot.mjs` (gitcheckout-index to freshignoredsnapshot, its own inventory build/check/verifier, backendbuild and transport test); stageddiff/Gitleaks; `git commit --author="Nayem <nayem692003@gmail.com>" -m "Nayem: Fixed protected downloads from hidden private storage roots"`; immediate branchpush/status/mainhash checks.
- Result: staged snapshot38 inventory checks/310app sources/91API/89operator/62commands; build/transport10 pass. SAST74rules/3files0findings; stagedsecret164.82KB0findings. Commit410f383 pushed. Main unchanged816d7d6. Database/lifecycle/tooling drafts remain uncommitted authorized work; nothing discarded. Next contributor Shimul.
- Decision: continue lifecycle concern with an index-specific snapshot; current workspace's additive readiness and other prepared sources are not falsely certified by the previous snapshot.

## 2026-10-12 / E0020 — complete native drain proof

- Commands: `node node_modules/tsx/dist/cli.mjs backend/scripts/verify-scalability-drain.ts`; backendbuild and independent hostile review; guarded restricted-runtime document/action/project scripts.
- Result:144 checks. Same nativeNode24.13.1/fake80ms task: unfinished-at-disconnect1before→0after; close0.270ms vs drain86.129ms. Unchanged admission12 retains previous independent proof; real document14/action32/project81 pass. Subsequent idle TCP/partial headers/full accepted stream/async middleware/context cases strengthened the original96 checks;2s fixture deadline was never increased. Native Linux/fullsecurity/pooler/staging acceptance unexecuted.
- Decision: per-app tracked drain is ready for final source/stagedsecret/snapshot gates; readiness remains process lifecycle only. Do not claim overall dependency readiness, capacity or completed mission.

## 2026-10-12 / E0021 — drain committed and direct restricted baseline

- Commands: staged index snapshot with `node .cache/scalability/verify-staged-snapshot.mjs --drain`; source-specific Semgrep, staged redacted Gitleaks/diff review; `git commit --author="Shimul <shimulc17@gmail.com>" -m "Shimul: Fixed graceful shutdown for disconnected request work"`; immediate branchpush/status; `node .cache/scalability/run-inherited-suites.mjs`; guarded SQL verifier rerun with explicit ignored fixture/operator files.
- Result: committed/pushed3680c0d, main unchanged816d7d6. Snapshot38 inventory/build/transport10/drain144 pass; SAST74rules/nine files0, staged secret145.32KB0. All24 non-browser inherited backend suites exit0 on new fake PG16.15 under restricted runtime; actual privilege29 passes again. Recorded individual timings are test-run duration, not a throughput benchmark. Fixtures clean up through separately verified migration client only; real application calls remain restricted.
- Decision: direct database concern is ready for its remaining staged-index review. Browser, native Linux, pooler, real ClamAV, distributed stores and final-image gates remain open. Never substitute mocked unit cases for direct database acceptance.

## 2026-10-12 / E0022 — provisioning guards and updated source/advisory checks

- Hypothesis: rejecting explicit target/ACL/configuration before owner-environment hashing prevents an invalid invocation reading owner bytes; preserving reviewed SQLSTATE provides safe permission-failure evidence.
- Commands: `node scripts/scalability/verify-provisioning-contracts.mjs`; prepare/inspect self-tests and actual owned-container inspection; backendTSC; workload verify/check-document; runtime dependency self-test; official `npm audit --omit=dev --json` and `npm audit --json`; Semgrep1.180.0 official p/typescript/p/nodejs/p/python on backend/src/scripts, frontend/src/scripts, scripts, infra and Nextconfig, telemetry off.
- Result: independent pureguard59 passes (zero actual DB connections/provision statements/application spawns/private file contents read), including SQLSTATE42501 and diagnostic rejection. Before reorder the missing-operator source contract hit the owner-byte tripwire; after zero reads before rejection. Prepare17/inspect20/actual31; backendbuild, workload27/document and dependency14 pass. Current Semgrep225rules/369scanned source files0 findings/0 errors. Initial scan exit1 invalid rootfrontend/proxy.ts scanned0; corrected rootfrontend/src is covered and succeeds. Production auditexit0/0; fullauditexit1/7high dev advisories; failure remains visible.
- Decision: keep exact source/negative assertions and review runtime permissions/cascades. Do not broaden grants, ignore the dev advisory, run owner seeds or claim scanner/browser/pooler/image readiness. Record all remaining integration gates in phase-1 report/brief.

## 2026-10-12 / E0023 — clean-index guard proof and expanded type baseline

- Commands: export exact staged files to ignored index-review-uYNBUG; its inventory39/backendbuild/transport10; its pure guards; `node .cache/scalability/check-script-types.mjs` compares immutable pre-DB index-review-yHBV61 and staged DB snapshot with identical strict noEmit settings. Seed-only TSC separately passes.
- Result: source map311app/92API/39pages/27models/99operator/62commands. Pure staged guard initially failed at check17 because owner.env does not exist in a clean export; this exposed realpath-before-policy ordering. Changed privateConfigurationFile to lexical-cache guard before resolution, retaining the resolved symlink-escape check. Expanded strict verifier check exits2 with51 errors in both snapshots, same file/code pairs; existing production and seed builds pass. The earlier combined shell returned the second successful command's exit; it is not a green expanded check.
- Decision: rerun/restage the corrected guard and source map. Repair existing verifier typing in a separate concern without ignoring errors, changing assertions or loosening strict configuration. Do not claim every verification gate green while it remains pending.

- Final database-concern gates: fresh exact-index snapshot index-review-kxC6pR passes inventory39 (311app/92API/99operator), production backend build, transport10 and provisioning59. Corrected provisioner/source guards rerun with219 applicable rules over3 files:0 findings/0 parse errors. Staged redacted Gitleaks scanned106.29KB before the final source-map/evidence addition,0 leaks. Source map is copied from this index, not parallel type/pooler drafts; final stage/diff/secret review precedes commit.
