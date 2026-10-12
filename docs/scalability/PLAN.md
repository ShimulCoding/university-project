# Scalability plan

## Operating contract

Started 2026-10-12 from `security/local-hardening-2026-10-11` at `415a8692a655665b01bfb52a0302a5744e5e359d`, preserving all 33 security/support commits after main. Work branch: `perf/world-class-scalability`. Main remains `816d7d60bcd37931a6444d5561b1aeac40e5f7a1`. Next contribution after the base is Nayem; alternate thereafter. Commit from the repository root and push each completed concern to this branch. Phase PRs target the security branch for review; merging into main is not authorized.

Read this plan, the append-only [log](LOG.md), phase reports/review briefs, `../PROJECT_STATE.md` and repository instructions at every session. Every implementation follows hypothesis, smallest correct change, tests/security and comparable before/after measurement, hostile review, rollback and evidence. Do not substitute documentation or static checks for an unexecuted runtime gate.

Only fake datasets and local application targets are permitted. No production exists. External permission granted for official documentation, official npm/container registries, advisory feeds and this repository's GitHub push/PR operations. Real-database migrations, permission/authentication changes, data deletion, paid services/accounts, weakened controls and additional external sources need approval first. Preserve the owner's enrolled MFA factor and key. Existing local application data and private configuration are not scalability fixtures.

## Ranking

Security prerequisites precede throughput changes. Performance ranking requires Phase 2 measurements; source suspicions below are explicitly unmeasured. Fifty thousand active users is a workload input, never a measured capacity claim.

| ID | Phase | Work / hypothesis and measurable gate | Status | Evidence / next dependency |
| --- | --- | --- | --- | --- |
| P0-01 | 0 | Inventory every page/API/model/job/source and detect source drift; exact coverage and negative parser checks | In progress | Current audit: 91 APIs, 39 page files, 27 models. New source-derived inventory under independent implementation. |
| P0-02 | 0 | Convert active users, journey frequency and request fan-out into explicit RPS; validate arithmetic and absent journeys | In progress | Workload assumptions must be labelled assumptions, not usage telemetry. |
| P0-03 | 0 | Architecture/trust boundaries, adapters, ADRs, review brief and environment limits | In progress | Native Windows: 4 physical / 8 logical CPU, 25,559,359,488 bytes RAM; not a 2 CPU / 4 GB VPS. |
| S1-22 | 1 | Restricted runtime and separate migrator; runtime cannot change audit/retry history or perform DDL; real finance/upload/browser regressions through direct and pooled connections | Isolated target approved; implementation pending | Owner approved new fake database/roles/migrations and owned fixture cleanup. Original runtime cutover remains separately approval-gated. Guarded test grant SQL prepared; not executed. |
| S1-05 | 1 | Eliminate/isolate unpatched dev advisory; deployed runtime artifact audit has zero vulnerable chain packages without hiding full audit failure | In progress | Registry audit: seven high development entries; no patched braces release. Isolated installation/artifact checks under independent review. |
| S1-BASE | 1 | Rerun all existing security/regression suites and scanners on isolated fake fixtures | Waiting for isolated target | Real-account demo prerequisite remains distinct; do not supply owner's factor or auto-enroll it. |
| S1-DIST | 1 / 6 | Global quotas across two instances: accept only the configured total, fail closed on shared-store failure | Reproduced; not fixed | Two process-local limiter factories with limit 3 accepted 6 requests for the same fake identity. Existing PostgreSQL account guessing budget is already shared. |
| S1-DRAIN | 1 / 6 | Shutdown must retain disconnected controller work until settlement before disconnecting DB | Reproduced; not fixed | Local controller remained pending when server.close callback fired. Negative drain regression required. |
| P2-BASE | 2 | Real journey k6/browser baseline, CPU/RAM/event-loop/query metrics, p50/p95/p99 and first bottleneck on repeatable fake data | Tooling preparation | Docker, k6 and GitHub CLI unavailable through PATH at discovery. Native profiling is a separate environment, not VPS emulation. |
| P3-DATA | 3 | EXPLAIN-driven indexes/projections/cursor contracts, pooler safety, ledger/outbox/race proof | Not started | Requires workload baseline, approved migrations and compatibility review; retain primary authoritative checks. |
| P4-CACHE | 4 | Public-only shared caching, versions/invalidation/coalescing with cross-user negative tests | Not started | No shared cache exists today. Nonce/private HTML must not enter shared caches. |
| P5-JOBS | 5 | Durable isolated workers/quarantine/object storage and idempotent delivery | Not started | Current PDF generation is client-side; recovery email is synchronous integration and token cleanup is process-local. Behavior changes need approval. |
| P6-TIER | 6 | Readiness/draining/timeouts/backpressure/distributed controls/feature switches/degraded mode | Not started | Keep current upload/scanner/MFA budgets until equivalent controls are proven. |
| P7-EDGE | 7 | Bundle/mobile/accessibility budgets, static asset delivery and measured CWV | Not started | Real browser budgets follow a built-app baseline; no offline caching of private student/finance data. |
| P8-OPS | 8 | Metrics/traces without PII, encrypted restore/PITR, failure injection, runbooks and RPO/RTO measurements | Not started | Actual encryption/restore and failure drills are execution gates, not configuration claims. |
| P9-PROOF | 9 | Average/stress/spike/hours-long soak/breakpoint tests, race/security/performance CI, capacity model validation | Not started | No production capacity or 50k acceptance claimed. Requires earlier gates and measured infrastructure. |
| P10-EXTRA | 10 | Optional additions only after all mandatory gates, one separately approved feature at a time | Not authorized | Do not invent results/grades/webhooks/SMS features to satisfy nonexistent journeys. |

## Definition of done

Each concern has green applicable tests, unweakened negative security checks, same-environment/data measurements, diff review, rollback, updated evidence and commit. Nonperformance work must still prove a measurable correctness/security/lifecycle outcome; it does not waive the prove gate. Examples are coverage-drift rejection, accepted cross-instance attack requests and unfinished work at shutdown. Each phase has a report, independent review brief and review PR. An unexecuted gate remains open. SEC-05's explicitly permitted isolation path retains the visible development advisory and requires a clean production artifact audit; it does not mean the full dependency audit is green.

## Current limits

Docker/Compose, k6 and GitHub CLI were unavailable through PATH at discovery; this is not proof that no installation exists elsewhere. Ubuntu-24.04 WSL starts, but its PATH also lacks Docker/k6/pgbouncer/node. Owner approved the documented local Docker Engine/Compose installation and checksum-verified k6/GitHub CLI vendor downloads; installation has not yet been performed. Installed local PostgreSQL binaries and existing Semgrep/Gitleaks are available under known paths; versions and commands must be recorded when executed. Any Windows run includes the other running local development applications and is not isolated CPU capacity evidence. A missing tool is recorded and the next authorized task proceeds. Write `HANDOFF.md` if an execution limit prevents completing the mission; do not mark unfinished phases complete.
