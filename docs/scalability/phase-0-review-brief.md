# Phase 0 independent review brief

Review target: the phase-0 source/model foundation on `perf/world-class-scalability`, based on security tip `415a869`. Main is untouched. Phase 0 is inventory/modeling, not capacity proof or a completed mission. Read [phase report](phase-0-report.md), [PLAN](PLAN.md), [LOG](LOG.md), [architecture/ADRs](ARCHITECTURE.md), [inventory](INVENTORY.md), [workload](WORKLOAD.md), and the earlier security reports.

## Reproduce without private data/network

From the repository root with existing installed dependencies:

```powershell
node scripts/scalability/verify-inventory.mjs
node scripts/scalability/inventory.mjs --check
node scripts/scalability/workload-model.mjs --verify
node scripts/scalability/workload-model.mjs --check-document
node scripts/scalability/verify-runtime-dependencies.mjs --self-test
node scripts/scalability/verify-runtime-dependencies.mjs --mode source
git diff --check
```

Inventory/workload tools never import application modules, read environment/cache/upload records or call a database/network. Self-tests create fresh ignored fake-file directories; no existing data is deleted. The runtime artifact gate requires a real declared serving root; missing artifacts fail. Source mode explicitly does not certify runtime artifacts. Do not run maintenance/seeding/migrations listed in the inventory merely because they are mapped.

## Hostile review questions

- Does router traversal retain ordered inherited middleware and every route/health boundary? Do unsupported aliases/imports/mounts fail instead of disappearing? Do page groups/duplicates and Prisma constraints remain represented?
- Does every app/CLI/config/migration source and npm command have file:line/fingerprint evidence? Are executable formats omitted or private/binary data accidentally read?
- Do model frequencies/cohort shares/fan-out and SLOs remain labelled assumptions? Are gateway/results/server-renderer requests falsely invented? Are load shedding and login/upload/browser work honestly counted?
- Are measured independent-store fixtures clearly distinguished from real separate process/fleet proof? Does a source suspicion ever become a claimed capacity or vulnerability without evidence?
- Does artifact exclusion keep the unresolved development audit visible and refuse missing/unsafe output? Are final-image/startup/obfuscated-vendoring limitations explicit?
- Does any proposal/mapping silently authorize real-data migration/cutover, permission weakening, unattended MFA or unrelated cleanup? Does new database SQL retain PUBLIC TEMP/CONNECT or permit indirect protected-history changes?

## Open gates and review disposition

Phase 1 has not passed: original SEC-22 runtime remains privileged, fake runtime/pooler/whole-suite verification is pending, final Docker artifact startup is pending, and quota/lifecycle defects are reproduced but not fixed. No 50k users, VPS capacity, availability/restore target or production rollout is certified. Reviewer should record findings with source/command/evidence, request corrections, and rerun the affected checks. Do not merge to main or waive security/measurement gates on the strength of this document.
