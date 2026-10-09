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
- Uploaded evidence is available only to its student/complaint owner or a currently assigned, category-authorized event team member.

## Current Runtime Baseline
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, and ESLint flat configuration.
- Backend: Express 5, TypeScript, Prisma 6, and PostgreSQL.
- Demo students have stable Student IDs, and owner views expose safe payment-proof metadata without storage paths.
- npm dependency audit reports only three upstream Prisma CLI advisories (`@prisma/config` via `deepmerge-ts`); npm does not currently provide an installable remediation for the supported Prisma release.

## Verification
- Run `npm run prisma:validate --workspace backend`.
- Run `npm run prisma:generate --workspace backend` while the backend server is stopped on Windows.
- Run `npm run build --workspace backend`.
- Run `npm run lint --workspace frontend`.
- Run `npm run build --workspace frontend`.
- Run `npm run verify:event-scope --workspace backend`.
- Run `npm run verify:event-workspaces --workspace backend` against a migrated local database with its role catalog initialized. It uses isolated fixtures and cleans them up; do not reseed existing data for this check.
- To include rendered frontend checks, start both built apps, set `VERIFY_FRONTEND_BASE_URL=http://localhost:3000`, and run the workspace check. The final suite has 87 API/boundary checks or 95 with frontend rendering.
- Run the flow, finance, and governance verification scripts after database setup.
- After safe demo seeding and starting the backend, run `npm run verify:demo:runtime --workspace backend` for public, student-owner, event-team, auth-replay, and recovery-privacy checks.

## Existing Local Data Handoff

- All nine existing migrations are applied locally, including `20261004120000_revoke_legacy_global_event_roles`; this review adds no schema migration.
- Four older events lack active required teams: MU CP BOOSTER, Spring Coding Bootcamp 2026, MU CP BOOSTER 3.0, and IMUPC. Assign actual personnel through System Admin → Events and teams. No event assignments are inferred from legacy global roles.
- All required schema/build/lint/regression checks and the live demo/workspace checks passed in the architecture review. Rendered-page verification does not claim browser click or visual testing.
