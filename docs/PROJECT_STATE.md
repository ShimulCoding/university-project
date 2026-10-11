# Current Project State

## Active Architecture

- Six JSX text entities were normalized without changing rendered content to remove Semgrep partial-parse gaps. The current source scan parses all 300 files with zero errors; one protected `sendFile` warning remains explicitly reviewed. Browser rerun passes workspaces (1,142), MFA (74), public design (301), plus frontend lint/types/build/client/PDF/UI.

- The user approved the additional browser CSP/exact-origin CORS, non-destructive local seed, and fail-closed ClamAV integration in `docs/security-boundary-change-proposal.md`. Implement these separately on the security review branch; no production deployment, database change or secret rotation is authorized by this approval.
- Next HTML now uses fresh server nonces and strict script CSP, frame denial/no-referrer/nosniff and private/no-store caching. Inline styles remain supported; eval is development-only. Credentialed CORS accepts only configured frontend origins; list legitimate alternate ports explicitly. CORS (18), policy (13), production Edge attack/hydration (15), public design (301), workspaces (1,142) and MFA browser (74) checks passed.
- Approved local seed hardening preserves existing identities, credentials, status, events and revoked assignments. Initial admin/new demo setup uses the shared governance transaction with atomic audit. All seed commands refuse production/non-loopback targets; demo generators require explicit opt-in/private passwords and a new dataset, with create-only account/event/team writes. `verify:security-seed` passes 35 policy/mocked checks; `verify:seed-types` checks all three entry points. The existing database was never seeded.
- Approved upload scanning uses ClamAV INSTREAM before persistence, with bounded replies/backpressure/absolute deadline and socket cleanup. Production always requires scanner configuration; development/test opt in explicitly. Infected files return 422 and indeterminate scans return 503 without storage. `verify:security-scanner` passes 48 local fake-daemon/negative/cleanup/configuration checks. Real signatures/engine availability are unverified; read `security-upload-scanning.md` before staging/deployment.
- Follow-up upload tracing found manual-income creation omitted shared admission/rates and service preflight. This is now covered: operational-role/rate/shared admission before multipart parsing, owning-event authorization before scan/storage, and transaction recheck retained. `verify:security-uploads` passes 15 checks including student/System Admin/foreign-event income denial before persistence. Finance and 81 project-audit checks pass.
- The user approved `security-financial-replay-proposal.md` and its additive local migration. Manual income and expense-record creates require a random UUID v4 `Idempotency-Key` before multipart parsing. Actor/operation/key markers bind normalized payload/file hashes to the result atomically with the ledger/audit and are retained for that record's lifetime. Replays recheck live authority, return the original record's current state, and clean redundant uploads; changed input is rejected. Local migration 14 is applied without changing old financial rows. Forms retain the exact body/key across uncertain-response retries and lock editing until confirmation; this in-memory protection lasts while the form remains mounted. Do not reload/close and resubmit an unconfirmed entry without checking the ledger. External clients must adopt the header. Verification passes 59 backend replay checks, 17 client checks and 1,157 browser/workspace/design checks including dropped committed responses for both forms; finance/flow/governance/event scope/project audit (81), builds/lint/types/client/PDF/UI pass.
- A new local security review is in progress on `security/local-hardening-2026-10-11`. The user explicitly requested pushing that branch for review and leaving main unchanged. Read `docs/security-entry-point-map.md`, `docs/security-hardening-review.md`, `docs/security-auth-change-proposal.md`, and `docs/security-mfa-setup.md`. Authentication changes and additive local migration were approved. The MFA migration is applied locally (12 migrations); production is untouched.
- Operational logging now excludes query strings, arbitrary paths, raw errors/Prisma diagnostics and development mail preview capabilities. `verify:security-logging` exercises this with synthetic values; the existing 80-check audit suite passes.
- Multipart operations now reject forbidden roles/records before parsing and storage, retain transaction authorization checks, and share bounded upload admission and per-account rates. `verify:security-uploads` passes 11 negative/cancellation checks; the existing audit (80) and workspace (91) suites pass.
- Recovery-email changes require `currentPassword` and a live authenticated session. The write transaction rechecks credentials, session version/status and MFA, then revokes every session, old reset link and pending MFA authorization atomically. The response expires cookies and requires sign-in again. `verify:security-email` passes 26 negative/concurrency/rollback checks. Institutional mailbox ownership policy remains outside the verified code guarantees.
- Login and sensitive password reauthentication share a database-backed account failure budget (10/15 minutes), in addition to IP limits. Unknown identities perform configured-cost dummy bcrypt. `verify:security-login` passes 37 concurrency/expiry/negative checks. The additive audit-count index is applied locally (13 migrations); production is untouched.
- New database audit/session metadata excludes raw request queries and arbitrary header text. Controllers collect server route templates; repositories sanitize independently. Browser family, validated IP/method and bounded route diagnostics remain. `verify:security-audit-metadata` passes 19 checks; historical metadata is preserved.
- Authentication middleware establishes a trusted async session context. Shared governance transactions recheck its live bound session, account version/status and MFA assurance before invoking writes, including controllers that pass only an actor ID. Never derive this context from user input. Trusted fixture/background calls without HTTP context retain their role/account checks. `verify:security-session-boundary` passes 18 request/transaction race and regression checks.
- Initial admin HTTP bootstrap is disabled by default. `ENABLE_LOCAL_ADMIN_BOOTSTRAP=true` is an explicit empty-database operator mode, binds the backend to `127.0.0.1`, and rejects production/browser/forwarded/remote requests. Disable and restart after setup. The service also rejects disabled bootstrap before inspecting the database. `verify:security-bootstrap` passes 15 checks; no real bootstrap/seed was performed.
- Protected evidence authorization and `documents.access_authorized` audit now use the shared transaction/current request-session boundary before bytes are streamed. Audit failure sends no evidence. Records contain entity/category/actor/template, not filename/content, and do not claim completed delivery. `verify:security-document-audit` passes 14 negative/privacy/file-consistency checks.
- MFA encrypted envelopes explicitly require a full 16-byte GCM tag, 12-byte nonce and canonical bounded encoding. This closes the short-tag storage-tampering case found by follow-up SAST. `verify:security-mfa-crypto` passes 15 tampering/format/round-trip checks; existing valid records keep their format.
- Existing-demo runtime verification now completes MFA rather than mistaking a pending cookie for a full session. It requires locally enrolled accounts and private `VERIFY_DEMO_MFA_CODES_JSON` input before any requests; no real account is automatically enrolled. `verify:demo:mfa-contract` passes 16 mocked checks. Full existing-demo verification remains unavailable until the operator supplies those prerequisites; use the isolated workspace/browser suites meanwhile.
- The broader finance fixture now supplies its owned event/account snapshot for upload preflight and keeps the original missing-document assertion, with new missing-event/forbidden-actor negatives. Flow, finance, governance, event-scope and 81 project-audit checks pass after this adaptation.
- One global role: `SYSTEM_ADMIN`.
- Event operational roles are stored in `EventTeamMember`: Event Admin, Event Manager, Finance Controller, Organizational Approver, and optional Complaint Review Authority.
- A user can hold roles in multiple events, but every API list, detail, document, and mutation is constrained to active event assignments.
- Public event details and cards link to that event's team sign-in.
- `/dashboard` is the System Admin workspace; `/dashboard/my-events` is the event-team selector; `/dashboard/events/[slug]` is the isolated event workspace.
- The root dashboard layout is neutral. Global routes use `(system)/layout.tsx`; event routes always use their own sign-in and shell.
- `/dashboard/users` manages accounts/global roles. Event `/funding-requests` exposes monetary budget requests separately from itemized budget versions.
- Read the findings, permission matrix, rollout, and verification evidence in `docs/event-role-architecture-audit.md` for the 2026-10-10 architecture review.
- Read `docs/project-audit.md` for the subsequent project-wide audit, permanent fixes, regression evidence, dependency finding and rollout limits.
- Read `docs/ui-design-review.md` for the subsequent review of all 39 page files, shared UI changes, responsive/accessibility checks and visual verification limits.

## UI Architecture

- Public pages use an editorial layout with warm neutral surfaces, deep ink, jade accents and Fraunces headings. Public Sans supports operational text; financial identifiers use IBM Plex Mono.
- Shared controls provide explicit borders, visible focus, associated labels/help/errors, password visibility and consistent target sizes. Client select controls preserve IDs through the server/client rendering boundary.
- Public navigation uses a native mobile disclosure menu. System Admin and event teams share a responsive workspace sidebar, with separate scopes, role-filtered navigation and clear account context.
- The home ledger uses actual published amounts. Public directories include validated search/status filters; archived and draft events are not offered as public status filters.
- Student participation pages include account/registration/payment progress. Complaint submission keeps previous history available in a disclosure panel.
- Account lists and audit metadata support keyboard scrolling; account selection links directly to the profile. Event creation uses a full-width form.
- Financial category grouping and differences use exact decimal sums shared by web charts and PDFs. Displayed amounts remain exact; charts use proportional geometry without artificial minimum bars and support keyboard/touch selection.
- Reduced motion, a skip link and one main-content target are part of the shared UI. Avoid reintroducing oversized operational heroes, low-contrast translucent text, unsupported semantic colors, or invented bank/cryptographic/health claims.

## Responsibility Boundary
- System Admin: event creation, initial draft setup/publication, team assignment/replacement, users, roles, global audit, and read-only oversight.
- System Admin also handles general complaints without an event; event complaint decisions belong to that event's review personnel.
- Event Admin/Event Manager: event operations and lifecycle after handoff, budget and expense requests.
- Finance Controller: payment verification, income, settled expenses, and reconciliation for assigned events.
- Organizational Approver: request decisions, reconciliation finalization, and public-summary publication for assigned events.
- Complaint Review Authority: complaint review/routing for assigned events.

## Security Invariants
- No operational role receives cross-event access from `UserRole`.
- Existing global operational role assignments are revoked when upgrading to the event-scoped role model; event membership history remains available for audit.
- Direct record IDs are resolved to their event before authorization.
- Required event roles must use separate accounts within the same event.
- System Admin cannot execute event-team financial decisions.
- System Admin accounts cannot also be assigned event operational roles.
- At least one active System Admin assignment must remain available.
- Revoking the final required role assignment is blocked until a replacement exists.
- Draft publication requires all four active required roles. Draft publication cannot be performed by event personnel.
- Event/team changes, global role changes, and account status changes use serializable transactions with conflict retries and atomic audit writes.
- Account deactivation cannot orphan a required event role, and inactive accounts do not count as replacements.
- New event audit records populate the existing `AuditLog.eventId` relation; historical audit context is retained.
- Refresh tokens are single-use, atomically rotated, and rejected after replay.
- Password reset consumption and session revocation happen in one transaction.
- All access tokens must bind to an active refresh session and `User.sessionVersion`; legacy unbound tokens are rejected. Logout invalidates the bound session; password reset and deactivation invalidate account sessions.
- System Admin and event personnel require MFA across every login path, refresh and protected API. Enrollment needs a one-use operator/admin authorization after identity verification. Enrolled factors remain required after role removal. TOTP/recovery codes and tickets consume atomically with session/audit writes; assurance expires after 12 hours. Enrollment revokes prior sessions; email password reset preserves MFA. See the setup document for the separate encryption key and first-admin handoff.
- Operational mutations recheck current account and role authority inside the same serializable transaction as their preconditions, changes and audit writes. Conflict retries are bounded to five attempts with exponential jitter.
- Sign-in uses short repeatable-read transactions after bcrypt verification, rechecking credentials/status/current assignments before atomic session/audit creation. Governance, financial transitions, signup and password reset retain serializable protection.
- Pending MFA sign-in explicitly locks its account snapshot without updating the completed-login timestamp. The bounded transaction retry handles both Prisma P2034 and tagged-query SQLSTATE 40001/40P01 conflicts.
- Required student accounts have a unique Student ID. System Admin can repair names/Student IDs through audited account profile updates. Registration uses the current account's Student ID.
- One registration per account/event, one pending proof per registration, and one active budget per event are enforced by database indexes. No migration deletes duplicate history automatically.
- Individual positive monetary inputs fit Decimal(12,2); reconciliation/public aggregate totals fit Decimal(18,2).
- Uploaded evidence is available only to its student/complaint owner or a currently assigned, category-authorized event team member.

## Current Runtime Baseline
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, and ESLint flat configuration.
- Backend: Express 5, TypeScript, Prisma 6, and PostgreSQL.
- Demo students have stable Student IDs, and owner views expose safe payment-proof metadata without storage paths.
- Tested dependency baseline includes Next.js 16.4.0, Prisma 6.19.3, Nodemailer 10.1.0 and PDFKit 0.20.2. Explicit transitive overrides are documented in the audit report.
- Registry-enabled production dependency audit reports 0 known advisories. The full audit reports 7 high severity development dependency entries from the currently unpatched upstream `braces` stack-exhaustion issue; this finding remains open.
- Public/internal lists retain pagination and stable ordering; option catalogs fetch complete bounded batches. Latest public snapshots are selected before pagination, and approval queues page references before loading details.
- Bengali/Latin PDF exports use bundled OFL Noto fonts. Decimal display is exact and chart slices do not inflate zero/tiny values.
- Uploaded evidence is validated, revisions retain older attachments, failed writes clean new files, and missing/incomplete stored evidence returns unavailable.

## Verification
- Run `npm run prisma:validate --workspace backend`.
- Run `npm run prisma:generate --workspace backend` while the backend server is stopped on Windows.
- Run `npm run build --workspace backend`.
- Run `npm run lint --workspace frontend`.
- Run `npm run build --workspace frontend`.
- Run `npm exec --workspace frontend -- tsc --noEmit` and the frontend `verify:client`, `verify:pdf`, and `verify:ui` scripts.
- For UI changes, start both built apps and run `npm run verify:design --workspace frontend`. Add `VERIFY_DESIGN=1` to the browser workspace run for authenticated screen checks at 360, 768, 1440 and 1920px. See setup notes for optional screenshots and browser selection.
- Run `npm run verify:project-audit --workspace backend` against a migrated local database. It passed 80 isolated concurrency/security/rollback checks.
- Run `npm run verify:event-scope --workspace backend`.
- Run `npm run verify:event-workspaces --workspace backend` against a migrated local database with its role catalog initialized. It uses isolated fixtures and cleans them up; do not reseed existing data for this check.
- The default workspace suite passed 91 HTTP/boundary checks.
- To include rendered frontend checks, start both built apps, set `VERIFY_FRONTEND_BASE_URL=http://localhost:3000`, and run the workspace check. Add `VERIFY_BROWSER=1` for actual browser interactions. The architecture-audit baseline passed 154 checks including 54 browser assertions using installed Microsoft Edge; the subsequent UI review results are recorded below. See setup notes for browser selection.
- Run the flow, finance, and governance verification scripts after database setup.
- With existing demo data and a running backend, run `npm run verify:demo:runtime --workspace backend` for public, student-owner, event-team, auth-replay, and recovery-privacy checks. Do not reseed existing data just to verify.
- Run registry-enabled `npm audit --omit=dev` and `npm audit`; record remaining development advisories separately.

## Existing Local Data Handoff

- All eleven migrations are applied locally, including `20261010120000_session_invalidation` and `20261010130000_financial_invariants`. The audit adds these two migrations; production deployment was not performed.
- Four older events lack active required teams: MU CP BOOSTER, Spring Coding Bootcamp 2026, MU CP BOOSTER 3.0, and IMUPC. Assign actual personnel through System Admin → Events and teams. No event assignments are inferred from legacy global roles.
- Schema/build/type/lint, audit/client/PDF/UI regression suites, existing flow/finance/governance checks, and live demo/workspace checks passed. Actual browser interactions were exercised locally; this does not claim exhaustive visual testing, SMTP delivery, load capacity, or production deployment.

## UI Review Verification (2026-10-11)

- All 39 page files and the shared UI were reviewed; see `ui-design-review.md` for the page inventory and permanent fixes.
- Frontend production build compiled all 40 Next routes (including not-found). Frontend lint with zero warnings, standalone type checking, backend build and Prisma validation passed.
- Client, PDF and UI regressions passed, including exact large category totals/differences, distinct fractional chart ticks, Bengali PDF content, page bounds, explicit control labels and datalist associations.
- The isolated workspace suite with browser/design flags passed 1,136 combined checks: 980 responsive/accessibility assertions across 49 route states, 56 actual browser assertions and 100 API/boundary/rendered-route assertions. It covers all internal route families and authenticated student submission states.
- Public design verification passed 301 checks across 14 route states and interactions at 360, 768, 1440 and 1920px. This includes all visible public status filters, keyboard skip navigation, menu behavior, password visibility, fallback fonts, chart selection and both published PDF downloads.
- The project audit suite passed 80 checks; flow, finance, governance, event-scope and existing demo-runtime checks passed without reseeding the existing database.
- Screenshots were inspected locally. Screenshot output is ignored and is not committed. Microsoft Edge was the browser used; physical devices, other browser engines, assistive-technology certification and production deployment remain outside this verification.
- Registry-enabled production dependency audit remains clear. Full audit remains nonzero for the seven previously documented development entries associated with `braces`; no forced downgrade/major migration was performed.
