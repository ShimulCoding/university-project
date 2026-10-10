# Current Project State

## Active Architecture
- One global role: `SYSTEM_ADMIN`.
- Event operational roles are stored in `EventTeamMember`: Event Admin, Event Manager, Finance Controller, Organizational Approver, and optional Complaint Review Authority.
- A user can hold roles in multiple events, but every API list, detail, document, and mutation is constrained to active event assignments.
- Public event details and cards link to that event's team sign-in.
- `/dashboard` is the System Admin workspace; `/dashboard/my-events` is the event-team selector; `/dashboard/events/[slug]` is the isolated event workspace.
- The root dashboard layout is neutral. Global routes use `(system)/layout.tsx`; event routes always use their own sign-in and shell.
- `/dashboard/users` manages accounts/global roles. Event `/funding-requests` exposes monetary budget requests separately from itemized budget versions.
- Read the findings, permission matrix, rollout, and verification evidence in `docs/event-role-architecture-audit.md` for the 2026-10-10 architecture review.
- Read `docs/project-audit.md` for the subsequent project-wide audit, permanent fixes, regression evidence, dependency finding and rollout limits.

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
- New access tokens bind to an active refresh session and `User.sessionVersion`. Logout invalidates the bound session; password reset and deactivation invalidate account sessions. Legacy unbound access tokens remain compatible until expiry/version invalidation.
- Operational mutations recheck current account and role authority inside the same serializable transaction as their preconditions, changes and audit writes. Conflict retries are bounded to five attempts with exponential jitter.
- Sign-in uses short repeatable-read transactions after bcrypt verification, rechecking credentials/status/current assignments before atomic session/audit creation. Governance, financial transitions, signup and password reset retain serializable protection.
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
- Run `npm run verify:project-audit --workspace backend` against a migrated local database. It passed 80 isolated concurrency/security/rollback checks.
- Run `npm run verify:event-scope --workspace backend`.
- Run `npm run verify:event-workspaces --workspace backend` against a migrated local database with its role catalog initialized. It uses isolated fixtures and cleans them up; do not reseed existing data for this check.
- The default workspace suite passed 91 HTTP/boundary checks.
- To include rendered frontend checks, start both built apps, set `VERIFY_FRONTEND_BASE_URL=http://localhost:3000`, and run the workspace check. Add `VERIFY_BROWSER=1` for actual browser interactions; the full suite passed 154 checks including 54 browser checks using installed Microsoft Edge. See setup notes for browser selection.
- Run the flow, finance, and governance verification scripts after database setup.
- With existing demo data and a running backend, run `npm run verify:demo:runtime --workspace backend` for public, student-owner, event-team, auth-replay, and recovery-privacy checks. Do not reseed existing data just to verify.
- Run registry-enabled `npm audit --omit=dev` and `npm audit`; record remaining development advisories separately.

## Existing Local Data Handoff

- All eleven migrations are applied locally, including `20261010120000_session_invalidation` and `20261010130000_financial_invariants`. The audit adds these two migrations; production deployment was not performed.
- Four older events lack active required teams: MU CP BOOSTER, Spring Coding Bootcamp 2026, MU CP BOOSTER 3.0, and IMUPC. Assign actual personnel through System Admin → Events and teams. No event assignments are inferred from legacy global roles.
- Schema/build/type/lint, audit/client/PDF/UI regression suites, existing flow/finance/governance checks, and live demo/workspace checks passed. Actual browser interactions were exercised locally; this does not claim exhaustive visual testing, SMTP delivery, load capacity, or production deployment.
