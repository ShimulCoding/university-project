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
- Revoking the final required role assignment is blocked until a replacement exists.

## Verification
- Run `npm run prisma:validate --workspace backend`.
- Run `npm run build --workspace backend`.
- Run `npm run build --workspace frontend`.
- Run the finance and governance verification scripts after database setup.
