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
| Event manager | `demo.event.manager@example.com` |
| Finance controller | `demo.finance@example.com` |
| Organizational approver | `demo.approver@example.com` |
| Student | `demo.active.student@example.com` |
| Student | `demo.verified.student@example.com` |
| Student | `demo.verified.student.two@example.com` |

### System admin
The system admin comes from `backend/.env` seed variables.

Current verified local machine values:
- Email: `shimulc17@gmail.com`
- Password: `Admin@123456`

## Recommended Teacher Presentation Flow
1. Open the homepage and explain the public-safe vs protected boundary.
2. Open `/events` and then `Demo Open Finance Workshop 2026`.
3. Show the register page and explain that login is required for private student-owned records.
4. Sign in as `demo.active.student@example.com`.
5. Show `/registrations/[registrationId]` and the payment-proof review state.
6. Show `/complaints/new` and `/complaints`.
7. Sign in as finance and open `/dashboard/payments` and `/dashboard/income-records`.
8. Sign in as event manager and open `/dashboard/budget-requests` and `/dashboard/expense-requests`.
9. Sign in as approver and open `/dashboard/approvals`, `/dashboard/complaints`, and `/dashboard/publications`.
10. Show `/dashboard/reconciliation` and explain draft, reviewed, and finalized status.
11. Open `/financial-summaries` and then the symposium summary detail page.
12. Sign in as system admin and show `/dashboard/audit`.

## Important Demo Notes
- Public pages never show payment proofs, complaint evidence, or reviewer notes.
- Student pages show only student-owned data.
- Internal pages are role-aware and intentionally separated by responsibility.
- Public summary pages resolve to the latest published summary for each event.
- Older published versions remain internal history for traceability.

## Honest Limitation Notes For Demo
- Demo passwords are intentionally simple and are not production-safe.
- Complaint review is fully implemented, but the default runtime seed does not create a separate standalone complaint-review demo login.
- Local uploads are development-only and stored on disk.
