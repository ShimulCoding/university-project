# Action-limit fixture timing correction

## Reproduced cause

`backend/scripts/verify-security-action-limits.ts` used one 150 ms store for exhaustion, identity, read-skip, recovery-skip and expiry assertions. The copied, instrumented local run reached the exhausted-budget assertion after the window had legitimately expired: both allowed responses completed after 427 ms and the expected denial returned after 436 ms. The assertion failed at check 5, phase `unit-budget`, with zero workspace read/module/native violations. The application correctly opened a new window.

Evidence: the private pre-quota snapshot's `.cache/action-diagnostic-b7eb7b8d47a04d7d9822d6e74ce80828.json`. This reproduces the intermittent baseline failure; increasing a production budget would not repair its cause. An earlier `.cache/debug-child-a41cfee1189d480e81032d73548cf80d.json` is a successful rerun, not the failing baseline artifact. The original 23/24 report remains retained.

## Change

The exhaustion/identity/navigation checks now use a separate 60-second test store with the same two-request budget. A dedicated 150 ms store receives three concurrent requests and must return exactly two 204s and one 429 with rate/retry headers. After a real 180 ms wait, its next request must return 204. All previous 32 assertions remain; two explicit short-window exhaustion/header assertions bring the total to 34. The production fifteen-minute windows, allowances, authorization, identity sources and concurrent-work controls are unchanged.

Failure diagnostics add only a fixed phase enum, numeric completed/next check and elapsed timings. Error bodies, URLs, credentials, actors and tokens are not printed. There is no retry-until-success path. As with any wall-clock fixture, arbitrary OS descheduling can still affect the short real-time assertion; numeric diagnostics preserve evidence if that happens.

## Executed evidence

On the same Windows/Node 24.13.1 machine, same copied pre-quota application/dependencies and same restricted fake database, four independent repaired runs pass **34 checks each** with zero workspace violations. They retain the original cancellation/admission assertions and actual authenticated API mutations, reports, private-file bytes and ownership denials. The first repaired run overlapped the same instrumented build workload that exposed the old failure.

The copied `.cache/action-diagnostic-*.json` artifacts have identifiers beginning `7e229160`, `74f8257c`, `39783d05` and `07500e3d`. The final snapshot constructor proof passes 49, and its contained backend build checks 407 source files / emits 168 files with zero diagnostics. The broader verifier boundary remains a separate uncommitted concern under hostile review; these results do not certify it as a general sandbox.

A full-suite attempt that overlapped these dedicated database tests encountered a separate event-workspace 409/200 assertion. That failure is retained and unclassified. Whole-database suites are now serialized; a clean full-suite rerun remains required. No suite or security control is skipped. This fixture fix does not imply Phase 1 or shared-application acceptance.

## Review and rollback

The code diff affects only this verification fixture. Reverting it restores the reproduced false exhaustion failure; it does not alter application data or operational limits. The actual elapsed-time failure and four after runs are correctness evidence, not throughput or user-capacity measurements. Main, the owner's database/environment and supervised MFA remain unchanged.
