# Graceful drain preserves unfinished work

## Reproduced failure

At `13134ea`, `backend/src/server.ts:24` disconnects Prisma and exits when HTTP server.close completes. A disconnected client can leave its controller promise running after its socket closes. One native loopback fixture held a controller for80ms; the old close ordering observed **one unfinished operation at disconnect**. Independent review also traced unwrapped authentication/session/event-preflight reads (`middlewares/authenticate.ts:20`, `authenticate-refresh-session.ts:12`, `authorize.ts:46`) which can outlive an aborted socket.

## Applied control

- `backend/src/utils/request-work.ts`: per-app server-owned registry, synchronous promise registration and idempotent release; closed sockets do not release running controller/maintenance/middleware promises. Existing upload/report admission retains its own cap. Async middleware still returns its actual promise; live authority/MFA/session checks and AsyncLocalStorage context remain intact.
- `backend/src/app.ts`: drain rejection before parsers, private/no-store503 and Retry-After; `/health` remains liveness and new `/readyz` reports accepting/draining. This readiness **does not yet measure dependency health**.
- `backend/src/server.ts`: track startup/hourly pruning; stop new work, wait for accepted sockets and registry idle, disconnect once. A referenced60s deadline covers work and disconnect; failure exits1 with fixed diagnostics and bounded250ms flushing. No premature successful process.exit.
- Close never-requested/partial-header TCP sockets during drain; after a response finishes, close only idle keep-alive connections. Accepted evidence streams remain intact. Forced close occurs only on explicit failed deadline/cleanup, never a successful drain.

## Actual verification

`node node_modules/tsx/dist/cli.mjs backend/scripts/verify-scalability-drain.ts` passes **144 checks** on native Node24.13.1. Same fake80ms controller/machine: unfinished-at-disconnect **1 before / 0 after**, observed close0.270ms vs drain86.129ms. Waiting for work is the correctness gain; this is not a throughput improvement. Cases cover controller/upload/report cancellation, parsing/preflight lateness, per-app isolation, full accepted stream delivery, raw/partial TCP, double signals/releases, background work, errors, stuck work/disconnect deadlines and explicit failed child exit.

Middleware lifecycle cases execute the real middleware with bounded fake DAL reads, isolated ephemeral configuration, real signed token handling, invalid token/missing factor negatives and preserved authenticated context. They make no owner/database connection; they are **not substitutes for real-database authentication regressions**. The unchanged admission lifecycle retains12 checks. Restricted-runtime document14/action32/project81 have also passed with these middleware changes. Full inherited suites and native Linux/pooler/startup/shutdown acceptance remain open.

## Hostile review and rollback

No request header supplies registry state. No cache replaces permission reads. Maintenance/controller promises cannot disappear on cancellation; late work is rejected. Async work created outside these registered paths must explicitly use the registry. Prune repository error swallowing remains a separate reliability/observability task. A platform force-kill shorter than60s can still interrupt work; deploy stop grace must exceed the application's deadline and record failed exits.

Revert this concern's registry/wrappers/app/server/test and additive readiness coverage together; no database migration/data rollback. Reversion restores the reproduced shutdown race. Real financial transaction idempotency/history invariants remain independently required for retries after failed drains.
