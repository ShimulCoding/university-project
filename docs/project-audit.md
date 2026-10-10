# Project audit and regression report

Audit started: 2026-10-10. Baseline: `3ca2f7c`, with a clean working tree.

## Scope and method

This review follows the existing university event financial transparency workflows: public discovery, student registration and payment evidence, event operations, funding and budget approvals, actual income/expenses, complaint review, reconciliation, public release, and global administration.

The source inventory contains 14 backend modules and 39 frontend page files (40 built routes including the not-found route), with 57 shared/domain components. Review traced route validation and middleware through services, repository queries, Prisma relations, public/internal mappers, frontend API helpers, forms, and error states. Runtime checks use temporary accounts, events, financial records, and uploads; existing data was not reseeded.

| Area | Reviewed interaction and verification |
| --- | --- |
| Public pages and `events`/`public` APIs | Event visibility, registration windows/capacity, event sign-in links, summary disclosure, snapshot selection, filters, counts, pagination, PDF download |
| Student pages, `auth`/`registrations`/`payments` | Signup, Student ID identity, login/recovery/logout, session rotation, ownership, registration, proof upload and owner document access |
| System Admin pages, `users`/`roles`/`events`/`audit` | Accounts, profile repair, global roles, separated event teams, draft publication, account status, last-admin/required-role protection, audit history |
| Event workspace pages and domain action components | Role-specific navigation and direct route denial, selected-record form state, funding requests, budget versions, income/payment review, expense recording, complaints, reconciliation and release |
| `budgets`/`requests`/`approvals` | Amount limits, evidence, revision retention, owner edits, submit/return/resubmit, self-approval denial, concurrent decisions, queue pagination |
| `complaints` | Owner intake, protected evidence, event versus general cases, routing/escalation/history, concurrent review transitions |
| `reconciliation`/`public` | Decimal totals, coherent generation, warning freshness, latest-report review/finalize/publish, idempotent concurrent publication, aggregate limits |
| `documents`, upload middleware and local storage | Parent ownership, event/category authority, path containment, content signatures, size/empty-file checks, batch failure cleanup, private caching |
| Infrastructure and integrations | Environment precedence, CORS, proxy trust/rate limiting, error classification, cookie/JWT validation, SMTP failure privacy, stale-token cleanup, dependency install, Prisma migrations, font/PDF assets |

Build, type and lint coverage includes all source files. Browser coverage exercises the principal workflows and route families; it does not prove every interaction, visual state, browser, or deployment configuration.

## Defects fixed

| Root cause | Permanent change | Regression evidence |
| --- | --- | --- |
| Operational checks, record transitions and audit writes were spread across different database snapshots | Shared serializable transactions now read preconditions, recheck active actor authority, write changes and audit atomically; bounded conflict retries use exponential jitter | Competing capacity, payment, budget, expense, complaint and publication writes; stale actor denial; injected audit rollback; governance races |
| Slow bcrypt work and unnecessary relation/catalog reads caused independent account requests to exhaust retries | Verify passwords before short repeatable-read sign-in transactions, then recheck credentials/status/current roles inside; signup hashes before its serializable transaction; unchanged role catalog rows are not rewritten; database uniqueness remains authoritative | Three rounds of six parallel sign-ins, four parallel signups, competing identical Student IDs, changed-credential and mid-login deactivation tests; live parallel event-team demo logins |
| Session issuance escaped its enclosing transaction; access tokens outlived logout/reset/deactivation | Session and audit creation use the same transaction; new access tokens bind to a live refresh-session row and account session version; reset/deactivation invalidates sessions and reset links | Login audit rollback, logout access denial, reset invalidation, refresh replay and expired-access browser recovery |
| Recovery failures exposed account matching through delivery/error behavior | Reset capability and audit are atomic; delivery occurs asynchronously after commit; matching and unknown details return the same generic response even on injected SMTP/audit failures | Recovery privacy and rollback fixtures; live demo recovery checks |
| System-created student accounts lacked a login identity; event registration accepted another Student ID | Require Student ID when granting student access; audited System Admin profile repair; neutral event-team accounts can have no global role; registration binds Student ID to the current account | Invalid/valid student account creation, login and profile authorization APIs; browser profile repair and prefilled registration; impersonation rejection |
| Lists silently showed only the first API page; selectors lost older records; tied timestamps produced unstable ordering | Preserve API pagination, render page controls, fetch selector catalogs in bounded batches, validate page queries, and add stable ID ordering | Database fixtures spanning pages, literal-search filtering, actual browser next-page interaction, bounded query checks |
| Latest-summary deduplication ran after pagination; approvals loaded whole queues into memory | Select latest published snapshots before SQL pagination/counting; page a parameterized union of pending approval references before loading selected details | 22 events/23 published snapshots, 20+2 page split, correct historical count, 24-row mixed approval queue and entity filters |
| Dashboard/public metrics treated first-page length or failed calls as complete totals | Use pagination totals and historical metadata; label page-local metrics explicitly; failed operational metrics display unavailable; finance data fetches respect role scope | Rendered and browser routes for System Admin, manager, finance and approver; summary count fixtures |
| Reconciliation warning freshness missed unverified/recorded financial changes; report aggregates used individual-transaction limits | Invalidate reports on changes that affect totals or warnings; reject stale/older review, finalization and publication; widen report/public totals to Decimal(18,2) | Financial warning invalidation, stale publication and concurrent release tests; maximum aggregate fixture |
| Request edits discarded old supporting evidence; failed file batches or database writes could leave orphan uploads | Append evidence on revisions; prevalidate batches; save files once outside transaction retries and remove only new files on failure | Retained revision documents, canonical PDF extension, injected partial storage failure and transaction rollback |
| MIME/name/size claims and stored file paths were trusted too broadly | Validate signatures and actual nonempty buffer size, choose canonical storage extension, enforce upload-root containment and multipart limits; unavailable/truncated evidence returns 404 | Traversal/signature/size tests, valid/empty/missing protected-file checks, event and owner document boundaries |
| Amounts, pages and bcrypt password lengths were insufficiently bounded | Shared Decimal(12,2) input limits, aggregate budget limit, bounded integer pagination, bcrypt 72 UTF-8 byte limit and auth identity/token limits | Invalid/oversized money, pages, UTF-8 passwords, malformed/oversized JSON fixtures |
| Broad proxy trust allowed client-IP spoofing; successful campus logins consumed the failed-attempt budget | Default proxy trust is disabled, explicit bounded hop setting; separate failed-login limiter ignores successful sign-ins | Twelve consecutive successful HTTP logins; proxy/CORS configuration review |
| Local env files overwrote deployment/CLI settings; parser and infrastructure failures were misclassified or leaked internals | Preserve supplied environment values; validate origins/token lifetimes; classify JSON/size/CORS/Prisma errors; DB auth failures remain server errors; private auth/document responses use no-store | HTTP 400/413/403 edge checks, builds, error-handler review and authorization fixtures |
| Parallel requests/tabs raced refresh rotation; aborted callers remained attached to shared refresh; server-rendered pages could strand expired sessions | Shared refresh coordination, Web Locks when available, auth-route exclusions, cancellation cleanup, and root browser session recovery before rendering private content | Client refresh/cancellation runner; actual expired-access recovery in Edge |
| Forms retained fields when selecting a different record; pending navigation allowed repeat actions | Key stateful action forms by selected record; keep submission/navigation busy states and internal action reentry guard | Browser edits an account, selects another, verifies the new values; successful income/student submission flows |
| PDFs stripped non-ASCII text and used imprecise money; zero/tiny chart slices were inflated | PDFKit with embedded Bengali/Latin Noto fonts and logical-text metadata, exact decimal formatting, shared proportional slice calculation, bounded/retrying font load and download feedback | Parsed Bengali/Latin multipage PDF, final line items, maximum totals and page bounds; browser PDF download; zero/tiny slice checks |
| Ordinary segment error UI nested a second HTML document | Segment error renders content only; dedicated global error owns the document wrapper and styles | Static-render markup/details/recovery assertions and production build |
| Stale auth tokens accumulated; a diagnostic script selected password hashes | Hourly/startup token pruning and explicit safe diagnostic projection | Auth repository/build review; fixture cleanup and secret exclusion review |
| Known dependency advisories persisted in installable packages | Compatible package updates and explicit tested transitive overrides; clean lockfile installation verified | `npm ci`, Prisma validation/generation, all builds/regressions, production audit |

## Verification evidence

Executed locally using Node 24.13.1, Windows, PostgreSQL and installed Microsoft Edge. The final successful runs include:

| Command/check | Result |
| --- | --- |
| `npm ci` | Passed; reproducible installation from the root lockfile |
| Backend Prisma validate/generate/migrate status | Passed; generated Prisma 6.19.3; all 11 migrations applied locally |
| Backend TypeScript build | Passed |
| Frontend ESLint with zero warnings | Passed |
| Frontend production build and TypeScript | Passed; 40 routes |
| `verify:flows`, `verify:finance`, `verify:governance`, `verify:event-scope` | Passed; existing route/service/governance coverage preserved |
| Backend `verify:project-audit` | Passed, 80 checks |
| Backend `verify:event-workspaces` without frontend flags | Passed, 91 checks |
| Backend `verify:event-workspaces` with frontend/browser flags | Passed, 154 checks including 54 real browser checks |
| Backend `verify:demo:runtime` | Passed against existing local demo data; no reseed |
| Frontend `verify:client`, `verify:pdf`, `verify:ui` | Passed; refresh/cancellation, PDF content/layout, error markup and query bounds |
| Existing stored evidence | 13 database document records checked; no missing or incomplete files |
| `npm audit --omit=dev` with registry access | 0 known production advisories |

Prisma conflict messages in concurrent fixtures are expected: the suite verifies retries and that exactly one competing transition succeeds. Injected SMTP/audit failures are deliberate test inputs. Earlier failing runs were investigated and rerun after code or fixture corrections; those failures are not recorded as passes.

## Remaining dependency finding

The full registry-enabled `npm audit` reports **7 high severity development dependency entries**: `braces`, `micromatch`, `chokidar`, `fast-glob`, Tailwind CSS, `eslint-config-next`, and the Next ESLint plugin. They share the upstream [braces stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), which currently lists no patched release. npm suggests a Tailwind major migration and a Next ESLint configuration downgrade; these are not safe drop-in fixes for this codebase. The finding remains open. Zero production advisories does not imply zero vulnerabilities or zero tooling risk.

`deepmerge-ts` 8.0.2 under Prisma config and `postcss-selector-parser` 7.1.6 are explicit root overrides. The actual installed versions and clean install were checked; schema tooling and Tailwind/ESLint compilation passed. Some npm workspace dependency-tree output marks overridden versions against upstream requested ranges as invalid even though the explicit overrides are installed; do not remove the overrides based only on that diagnostic.

## Rollout and limits

- Deploy the two new migrations before running the updated backend. Preflight duplicates using `setup-notes.md`; migration SQL deliberately fails rather than deleting historical records.
- Set proxy, origins, SMTP and cookie configuration for the actual environment. Local verification used both apps on `localhost` with separate ports. Cookies must reach both the browser API and Next server rendering; different deployment hostnames require appropriate shared-host/reverse-proxy configuration.
- New sessions have immediate server-side logout invalidation. Existing legacy access tokens without a session ID remain supported at version 0 until expiry or account-version invalidation; do not claim retroactive per-session logout for these old tokens.
- Four older events still await personnel chosen by System Admin: MU CP BOOSTER, Spring Coding Bootcamp 2026, MU CP BOOSTER 3.0 and IMUPC. This follows the user's decision to assign them later. No legacy global operational role was converted into event membership.
- SMTP failure/privacy paths were tested. Actual external email delivery, production infrastructure/deployment, all browsers, exhaustive visual/accessibility interaction and sustained load were not verified.
- Bengali and Latin PDF output was tested; this is not universal script coverage. Logical text metadata is included; extraction behavior depends on the PDF reader.

No known reproducible project-code defect remains in the executed verification scope. This is a bounded audit with the open upstream finding and unverified environments above, not a claim that the entire project is bug-free.
