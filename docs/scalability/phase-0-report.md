# Phase 0 report — source map and workload model

## Outcome and scope

The current application is mapped and the workload assumptions are executable and checked. This phase changes tooling/documentation, not application behavior, data or permissions. It establishes **no measured application/VPS/production capacity**. The mission is still in progress; Phase 1 security carry-over and subsequent phases are open.

Base: `415a869` on the requested `perf/world-class-scalability` branch, preserving 33 security/support commits. First mission concern `6fce5aa` (Nayem) adds the SEC-05 exclusion gate. Main remains `816d7d60bcd37931a6444d5561b1aeac40e5f7a1`. This foundation concern follows as Shimul's turn; its hash is in branch history/log after commit.

## Complete coverage

The section-by-section [inventory](INVENTORY.md) and [machine-readable inventory](inventory.json) contain a row for each API/page/model/job/timer/application source and operator/config/migration source, with file:line, middleware or source classification, bottleneck hypothesis, owning phase, explicit N/A before/after reason and baseline commit. These hypotheses are not performance findings. Fingerprints and commands invalidate the check after additions/removals/changes. Private environment/cache/upload data and generated/binary assets are excluded explicitly; font/PDF/image bytes need browser/artifact profiling.

| Surface | Actual mapped count | Evidence |
| --- | --- | --- |
| Express routes including liveness | 91 | AST import/re-export/router mount traversal; effective ordered middleware, health included |
| Next page files | 39 | Route groups normalized; duplicate/unsupported parallel/intercepted patterns reject rather than vanish |
| Prisma models / role definitions | 27 / 7 | Source declarations/fields/indexes/model constraints; enum membership grants no authority |
| App sources | 309 | 307 TypeScript files plus globals.css and module README; every file fingerprinted |
| Operator/config/migration sources | 89 | Seeds, supervised MFA CLI, all verification tools, loose maintenance, TypeScript/JSON/TOML, guarded infra SQL and future shell/Docker entrypoint formats |
| npm commands | 62 | Every root/workspace command and manifest fingerprint |
| Recurring scheduler | 1 | Hourly token pruning; startup role catalog/token work and separate deadline/browser timers also indexed |
| Timers / explicit input-sink candidates | 7 / 224 | Candidates require data-flow inspection; a method match is not proof of user control/vulnerability |

Academic results/grades, payment gateway/webhooks, SMS, server PDF rendering and durable queue/shared cache/object-store integrations are N/A at this baseline with source-search scope/reason. Financial evidence submission is not gateway settlement. Browser PDFKit/fixed fonts are real current export paths. Do not add absent features to disguise missing load coverage.

## Workload and targets

[WORKLOAD.md](WORKLOAD.md) is generated from the checked model. Explicit formula: active users × scripted requests/cycle ÷ cycle seconds. It does not assume simultaneous sockets, measured user frequency, SQL count or SSR fan-out. Fifty thousand users produce an all-public target of **2,500 API RPS** at three requests/minute. A hypothetical disjoint 90% public / 9.9% registration-evidence / 0.1% finance mix yields **2,386.167 API RPS**, including **33 write RPS**. Independent all-student registration/evidence envelope yields **1,333.333 API RPS** and **166.667 uploads/s** at one cycle/five minutes. File sizes/scanner bandwidth and login/report arrival waves are separate parameters.

The model provides 10k/25k/50k/100k targets and proposed latency/error SLO thresholds; none has been achieved or capacity-certified. Phase 2 must measure real fan-out, queues, CPU/RAM/event-loop/DB/AV pressure and first bottleneck on fixed fake data. Phase 9 must validate average, stress, spike, hours-long soak and breakpoint behavior. All legitimate 429/503 shedding counts as offered-load error; no security cost/budget can be removed to improve a chart.

## Measured correctness/security outcomes

| Metric | Before | After / actual outcome |
| --- | --- | --- |
| Machine-checkable source drift/parser contract | No dedicated scalability inventory check at base | 38 passing checks, including omitted/dynamic/unmounted/duplicate routing, malformed syntax, stale/missing/edited outputs, source and CLI drift, shell/Docker coverage and unsupported formats |
| Workload arithmetic/transport coverage | Narrative goal without executable journey contract | 27 passing arithmetic/bounds/cohort/determinism/route/document checks; an initial nonexistent event path was rejected before use |
| SEC-05 serving-artifact boundary | Nine installed known-chain entries in development workspace; full audit seven high | Isolated production-only copy has zero known-chain entries and zero production advisories; 14 verifier checks pass; unpatched dev advisory remains open |
| Quota multiplication | Two independent process-local limiter factories, same fake identity, limit 3 | Six combined requests accepted, then both deny with 429: **reproduced, not fixed**. This is two stores in one OS process, not yet a real two-process deployment test. |
| Disconnected-work shutdown | Held controller outlives aborted socket | HTTP server-close callback fired with work unfinished: **reproduced, not fixed**. No real DB was disconnected by the fixture. |

Native environment: Windows 11, i5-1135G7, four cores/eight logical processors, 25,559,359,488 bytes RAM, Node24.13.1/npm11.8.0. Other local apps were preserved. There was no 2 CPU/4 GB isolation. Dependency copy/install timing is a single observation in `sec05-dependency-boundary.md`, not a speed claim. Exact reproduction commands are in the append-only [log](LOG.md) and independent [boundary review](scale-boundary-review.md).

## Independent review and corrections

Independent source reviews identified and corrected unsupported config/shell/Docker discovery, a false global-advisory-lock statement, imprecise tool-availability claims and a permissive nonperformance prove exception. Current transactions use Serializable/RepeatableRead with bounded retries; no advisory lock exists. Unsupported inputs fail rather than being silently omitted. Current source counts are generated from measured counts; 307 remains historical evidence.

Review also found default PostgreSQL PUBLIC TEMP/CONNECT in the initial isolated grant proposal. The prepared SQL now revokes those **only on the new fake database**, pairs exact database/role names and asserts denied TEMP/CREATE. It has not run; real permission proofs remain Phase 1 gates. A possible indirect foreign-key cascade into protected history from parent primary-key UPDATE is **unverified** and must be tested before granting table UPDATE or claiming immutable audit/retry history. No code/permission workaround or direct real-data operation was made for this finding.

## Approvals, limits and next work

Owner approved official docs/npm/container/advisory/repository traffic, the new isolated fake database/roles/migrations/owned fixture cleanup, Docker Engine/Compose in existing Ubuntu WSL and checksum-verified vendor k6/GitHub CLI binaries. Original database/runtime cutover, real-data migrations, MFA changes, unrelated deletion, paid services and optional Phase 10 features remain separately gated.

Docker preflight confirmed Ubuntu24.04/noble/systemd with no installed Docker packages. Initial installation stopped before package changes because vendor copyright files were missing. Review then retained genuine package copyrights or exact upstream version licenses for all 13 packages and verified every archive against signed APT metadata. Installation completed: Engine/CLI29.9.0, Compose5.6.0, Buildx0.38.0, containerd2.4.1; actual delta 13 new / zero upgrades / zero removals. Unix socket only, no automatic startup or Docker group users. WSL exposes eight CPUs / 12,435,705,856 RAM bytes; this is **not** VPS isolation or capacity proof. Portable k6/gh are also verified. Container resource enforcement and phase PR remain separate execution gates. Source Semgrep scans four map/model scripts with 68 applicable rules and zero findings/parse errors; staged secret results and actual PR details are recorded after execution.

Next: complete approved tooling and isolated-role provisioning; prove direct/indirect denied DB capabilities and real flow correctness; rerun every inherited security suite/scanner; fix the reproduced lifecycle/distributed quota defects without weakening controls; establish reproducible fake-data/load baselines before performance prioritization.

## Rollback

These map/model/documentation tools can be reverted independently without changing database or application behavior. Generated inventory is reproducible; do not delete the existing security history or suppress a failing check. No business-data rollback exists because none changed. Host tooling rollback and fake-data retention are defined in their approved proposals; destructive cleanup and original-runtime cutover remain separately controlled.
