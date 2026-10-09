# Demo Guide

## Demo URLs
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Health: `http://localhost:4000/health`

## Demo Credentials
### Fixed demo accounts
Password for all accounts below:
`DemoPass123!`

| Role | Email |
| --- | --- |
| Event admin | `demo.event.admin@example.com` |
| Event manager | `demo.event.manager@example.com` |
| Finance controller | `demo.finance@example.com` |
| Organizational approver | `demo.approver@example.com` |
| Student | `demo.active.student@example.com` |
| Student | `demo.verified.student@example.com` |
| Student | `demo.verified.student.two@example.com` |

### System admin
The system admin comes from the `SEED_ADMIN_FULL_NAME`, `SEED_ADMIN_EMAIL`, and
`SEED_ADMIN_PASSWORD` variables in `backend/.env`. Use the credentials configured
for your local environment; they are not stored in this guide.

## Recommended Teacher Presentation Flow
1. Open the homepage and explain the public-safe vs protected boundary.
2. Open `/events` and then `Demo Open Finance Workshop 2026`.
3. Show the register page and explain that login is required for private student-owned records.
4. Sign in as `demo.active.student@example.com`.
5. Show `/registrations/[registrationId]` and the payment-proof review state.
6. Show `/complaints/new` and `/complaints`.
7. On the event page, use **Event Team Sign In** as finance and open the event's `Verification` and `Income records` modules.
8. Sign in from the same event as Event Manager and open its itemized `Budget requests`, monetary `Funding requests`, and `Expense requests` modules. Show draft/returned owner edits and resubmission.
9. Sign in from the same event as Approver and open its `Approvals`, `Complaints`, and `Publications` modules.
10. Open the event's `Reconciliation` module and explain draft, reviewed, and finalized status.
11. Open `/financial-summaries` and then the symposium summary detail page.
12. Sign in as System Admin at `/dashboard`, show event team readiness and draft publication at `/dashboard/events`, account administration at `/dashboard/users`, and `/dashboard/audit`.

## Important Demo Notes
- Public pages never show payment proofs, complaint evidence, or reviewer notes.
- Student pages show only student-owned data.
- Event-team pages are scoped to the selected event and intentionally separated by responsibility.
- The global `/dashboard` sign-in is reserved for System Admin; operational users must use an event's sign-in.
- A signed-in account without an assignment for the requested event sees that event's team sign-in and can switch accounts.
- System Admin handles general platform complaints; event reviewers handle event cases. System Admin event oversight is read-only.
- Before presenting an older event, assign its real team in Events and teams. Draft publication requires four active accounts with separate responsibilities.
- Public summary pages resolve to the latest published summary for each event.
- Older published versions remain internal history for traceability.

## Honest Limitation Notes For Demo
- Demo passwords are intentionally simple and are not production-safe.
- Complaint review is fully implemented, but the default runtime seed does not create a separate standalone complaint-review demo login.
- Local uploads are development-only and stored on disk.
