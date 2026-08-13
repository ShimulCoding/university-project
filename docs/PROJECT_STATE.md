# Current Project State

## Active Architecture
- One global role: `SYSTEM_ADMIN`.
- Event operational roles are stored in `EventTeamMember`: Event Admin, Event Manager, Finance Controller, Organizational Approver, and optional Complaint Review Authority.
- A user can hold roles in multiple events, but every API list, detail, document, and mutation is constrained to active event assignments.
- Public event details and cards link to that event's team sign-in.
- `/dashboard` is the System Admin workspace; `/dashboard/my-events` is the event-team selector; `/dashboard/events/[slug]` is the isolated event workspace.

## Responsibility Boundary
- System Admin: event creation, initial draft setup/publication, team assignment/replacement, users, roles, global audit, and read-only oversight.
- Event Admin/Event Manager: event operations and lifecycle after handoff, budget and expense requests.
- Finance Controller: payment verification, income, settled expenses, and reconciliation for assigned events.
- Organizational Approver: request decisions, reconciliation finalization, and public-summary publication for assigned events.
- Complaint Review Authority: complaint review/routing for assigned events.

## Security Invariants
- No operational role receives cross-event access from `UserRole`.
- Direct record IDs are resolved to their event before authorization.
- Required event roles must use separate accounts within the same event.
- System Admin cannot execute event-team financial decisions.
- System Admin accounts cannot also be assigned event operational roles.
- Revoking the final required role assignment is blocked until a replacement exists.
- Refresh tokens are single-use, atomically rotated, and rejected after replay.
- Password reset consumption and session revocation happen in one transaction.
- Uploaded evidence is available only to its student/complaint owner or a currently assigned, category-authorized event team member.

## Current Runtime Baseline
- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS, and ESLint flat configuration.
- Backend: Express 5, TypeScript, Prisma 6, and PostgreSQL.
- Demo students have stable Student IDs, and owner views expose safe payment-proof metadata without storage paths.
- Production and development npm dependency audits report no known vulnerabilities.

## Verification
- Run `npm run prisma:validate --workspace backend`.
- Run `npm run prisma:generate --workspace backend` while the backend server is stopped on Windows.
- Run `npm run build --workspace backend`.
- Run `npm run lint --workspace frontend`.
- Run `npm run build --workspace frontend`.
- Run `npm run verify:event-scope --workspace backend`.
- Run the flow, finance, and governance verification scripts after database setup.
- After safe demo seeding and starting the backend, run `npm run verify:demo:runtime --workspace backend` for public, student-owner, event-team, auth-replay, and recovery-privacy checks.
