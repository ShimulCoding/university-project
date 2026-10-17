# Scalability continuation handoff

Updated2026-10-18. Work remains active and **Phase1 is not accepted**. This file records interruption recovery; it is not a completion or capacity report.

## Branch and safety

- Work only on `perf/world-class-scalability`; latest pushed `6c5ab67` is Shimul. **Next contributor Nayem.** Commit from the repository root; one concern per commit, push this branch immediately, inspect `git status -sb`. Never push/merge main. Main/originmain remain `816d7d60bcd37931a6444d5561b1aeac40e5f7a1`.
- Preserve all working drafts. Never read the owner's dotenv/MFA authorization/factor files. Never run original-workspace Prisma imports/actions for verification: its legacy generated client reads backend dotenv even at import. Use the proven copied workspace and its guarded tools. No reseed/real DB migration/runtime cutover.
- Approvals persist for official docs/registries/advisory feeds/GitHub perf pushes, isolated fake PG/roles/migrations/owned fixture cleanup, Docker/WSL/k6/gh/PgBouncer/tooling sources, and the shared quota adapter. New external services/plugins/MCPs, real-data changes and additional auth/permission behavior require approval. No new plugin is currently needed.

## First unresolved prerequisite: verifier boundary

Read `prisma-verifier-isolation-review.md`. Draft tools are prepare/verify-verification-workspace, verification-workspace-boundary/bootstrap, build-verification-workspace, verify-workspace-backend-suites and five existing operator/contract files. All remain unstaged.

Private snapshot: `.cache/scalability/verification-workspace-36554a28f9f24893a5b8819b972412b2`. It intentionally preserves **pre-quota source/dependencies**, so do not bulk-refresh it from the working tree. Explicit direct fake profile is its `.cache/scalability/mu_scale_cebdcb0b5157492e9d773cf74d5c65ca/fixture.json`; do not print it. Preserve867MB copied dependencies. Refresh only selected public concern files and their manifest hashes, then rerun full constructor proof; never forge its marker.

Completed: constructor48/root module16/provision233; copied-engine logging7; supported contained compiler host407sources/168outputs/0diagnostics,0outside violations. Supported Node resolution/read/native hooks refuse ancestor fallback and outside DLLs before bytes. Windows DOS long-path spelling is normalized, UNC/device paths refused. New wrapper and caught-URL violation strictness were added after the baseline copy; exact final proof/build/runtime sampling is still required.

Baseline report inside its fake profile directory: `backend-suites-03d4749aa8734ff286a29430245f1113.json`: **23/24**, action-limits failed. The private debug-child-a41c report is a successful rerun, not the failure. Safe phase/timing diagnostics subsequently reproduce check5 after427/436ms against the150ms window. The separate exhaustion60s/expiry150ms fixture preserves all32 assertions and adds2; four repaired runs34 pass. Read action-limit-fixture-review.md. The overlapping backend-suites-7cc0 report has an unclassified workspace409; serialize the final24 after all dedicated DB repeats finish. Do not report all green or infer its cause.

Independent hostile review of the byte tripwire confirms fs.openAsBlob can read an outside harmless public AGENTS.md file without incrementing its counter. No owner private bytes were used. The verifier agent owns its guard/regression correction and final source/manifest reproving. Existing proof49/build407 do not close this later finding; do not accept the boundary as complete yet.

Then stage only the completed verifier/timing concern, regenerate exact-index inventory, build/types, relevant suites, Semgrep/secret scan and hostile diff before its required contributor commit. Keep quota/package/application drafts excluded. Earlier index helper compiles/transports without ORM; its ancestor dependency layout is not an ORM-isolation proof.

## Shared quota component and application draft

Read `shared-quota-design.md` and `quota-lifecycle-review.md`. New typed adapter/scripts, request lease utility and two regression scripts exist. Exact runtime test report `.cache/scalability/quota-typed-results-362085a71fcb4e37.json` passes803 including actual pressure/restart; source hashes are recorded there. Lifecycle `.cache/scalability/quota-lifecycle-20261017/product-results.json` passes168. Fake-transport contracts55 are separate. No complete-app shared-mode acceptance yet.

Root-owned drafts: app/server/env/rate-limit, sensitive-action-limits/upload-guard, quota-context/quota-runtime, RequestWork/security logging, scanner production fixture, package/lock and third_party notice. All eight policies preserve current limits, default auth IP validators/IPv6, account identity and route skips. Login uses generation-token refunds and pre-reserved drain leases. Required production configuration is shared Valkey, with no memory fallback; local development defaults to single-instance memory. Runtime recovery establishes a fresh connection/config only; unknown writes are not replayed. New logger emits fixed events while keeping validators active. Later configuration/logger/recovery changes need actual tests.

Next steps in order:

1. Parser400checks/45cases and fixed logger10 pass; lifecycle168 repeats and actual recovery118/73,620ms pass. Recovery moved unchanged to a pure security/quota-recovery.ts utility so its test imports no app/env/ORM. Strict build/all verifier types pass after these edits. Later adapter sequencing changes need their final exact build. Do not import app/env/ORM in original-root unit tools. Complete app runs need the corrected copied boundary.
2. Add npm verification commands and local operator setup documentation. Verification memory mode must be explicit; shared fixture host/ports must stay limited to owned127.0.0.1:17432/17433. Coordinate edits to the dispatcher after its separate concern is frozen.
3. Prepare a separate post-quota snapshot with exact new dependencies and current public sources. Do not overwrite the old baseline. Run all inherited suites in explicit memory mode, real shared API/authenticated two-instance negatives and full relevant frontend/Edge flows. Scanner-production negatives need their new valid synthetic quota settings; do not weaken the production requirement to keep old fixtures passing.
4. Finish actual runtime recovery/backpressure/readiness/drain tests. Provide private Valkey Compose/config/ACL/persistence/log limits and image provenance/security checks. AOF disk growth, fsync/disk-full/crash/failover and whole-stack resource headroom remain open; maxmemory alone is not a disk bound.
5. Complete source/security/dependency/secret/browser/index gates before committing integrated enforcement. No user MFA or original database is a fixture.

Exact dependencies are installed with scripts disabled: @redis/client6.3.0/rate-limit-redis6.0.1/ERL8.7.1. Prisma-generated JS/native bytes remained identical. Official production audit0; fullaudit retains7high dev entries. MIT notices/provenance are retained under third_party and ignored npm-quota-20261017 evidence. Future runtime images must explicitly copy the missing Redis-client notice.

## Owned local services and other drafts

- PG project `mu-scale-local-pg-20261012-3cee55ba`, database `mu_scale_cebdcb0b5157492e9d773cf74d5c65ca`, direct relay15432. Existing reviewed hidden `start-owned-test-transport.sh` supervisor22716 may have stopped after the client switch. Inspect before restarting; quote its spaced path, use `Start-Process -WindowStyle Hidden`. No Docker prune/volume deletion or WSL repair.
- Pooler7e303539 service has native0400 secrets, private network, no public publish,16432 relay. Component fix is committed. Old profiles remain retained.
- Valkey9.1.2 immutable48332870 image, original fake service17432 and separate pressure17433. Exact names/profile/checks live in the assigned ignored quota prototype. Use only explicit owner-only fake profiles; don't print them or change existing ACLs. Typed private copy is beneath the prototype `typed-0452edf6d7f441b39108003059ce708b/profile.json`. Restart only its exact labelled pressure container during its explicit test flag.
- Backend Dockerfile/gates/native verifier and image-security/backend-build docs are uncommitted independent drafts. Candidate0f9b638e passes483 inspection and old-code bounded28 startup; new-pooler recheck409ms shutdown is separate. Those artifacts predate new quota app code/dependencies and must not certify it. OS scanners retain nonzero exit23/vendor findings; current advisory/license/image-layer gates remain open.
- Frontend standalone plan/prototype passes original build/client/PDF/UI and real Edge CSP15 with native peer, but has no tracked frontend implementation change. Linux image, notices, full authenticated flows/browser PDF remain open. Parent prototype tooling's old Prisma import caveat is disclosed.
- Phase0 review PR#1 is open; phases2-9 and50k/VPS capacity remain unmeasured. Do not invent missing grades/payment-gateway/webhook/server-PDF features; current purpose is event finance/registration/complaints/transparency.

If execution is interrupted again, append actual results to LOG, refresh this handoff and PROJECT_STATE, and preserve failing evidence and all unrelated changes. Never mark the mission complete from component tests.
