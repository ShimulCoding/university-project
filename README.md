# MU CSE Financial Transparency Platform

MU CSE Financial Transparency Platform is a full-stack academic project for event finance transparency, audit-friendly internal workflows, and public-safe publication. It separates public visibility from protected internal operations such as payment proof review, approval decisions, complaint routing, reconciliation, and audit logging.

## Completed Scope
- Public event discovery and event details
- Student registration, registration status, and payment proof submission
- Finance-side payment verification queue
- Manual income records for non-registration event income
- Budget versions and budget-item revision history
- Budget requests and expense requests
- Expense records for settled spending
- Approval queue with approve, reject, and return decisions
- Complaint submission, routing, escalation, resolve, and close flow
- Reconciliation generation, review, finalization, and warning display
- Public financial summary publication based on finalized reconciliation
- Protected audit log views
- Role-aware internal dashboard shell and public-facing frontend
- Demo-safe seed and runtime verification helpers

## Tech Stack
- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn-style component layer
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth: credentials auth with JWT access and refresh tokens
- Access control: backend-enforced RBAC
- File handling: local uploads in development with DB metadata only

## Repository Structure
```text
F:\University-project
|-- frontend\
|   |-- src\app\                # Next.js routes
|   |-- src\components\         # UI, shell, student, public, internal components
|   |-- src\lib\                # API helpers, access helpers, formatters
|   `-- src\types\              # Shared frontend types
|-- backend\
|   |-- prisma\                 # Prisma schema, migration, base seed
|   |-- scripts\                # Demo seed and verification scripts
|   |-- src\config\             # Env, Prisma, auth, uploads config
|   |-- src\middlewares\        # Auth, RBAC, validation, error handling
|   |-- src\modules\            # Domain modules
|   |-- src\storage\            # Storage adapter abstraction
|   `-- src\utils\              # Shared backend helpers
|-- docs\                       # Final handoff and setup docs
|-- diagrams\                   # Optional diagrams for submission
|-- database\                   # Optional DB notes and exports
|-- package.json                # Root npm workspace config
`-- package-lock.json           # Single lockfile for the whole repo
```

## Prerequisites
- Node.js 22+ and npm
- PostgreSQL running locally
- A PostgreSQL database named `mu_cse_transparency`

## Environment Files
### Frontend
Copy:
`frontend/.env.example` -> `frontend/.env.local`

Required variable:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api`

### Backend
Copy:
`backend/.env.example` -> `backend/.env`

Required variables:
- `NODE_ENV`
- `PORT`
- `FRONTEND_URL`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`
- `ACCESS_TOKEN_COOKIE_NAME`
- `REFRESH_TOKEN_COOKIE_NAME`
- `BCRYPT_SALT_ROUNDS`
- `UPLOADS_ROOT`
- `SEED_ADMIN_FULL_NAME`
- `SEED_ADMIN_EMAIL`
- `SEED_ADMIN_PASSWORD`

Detailed explanations are in [docs/setup-notes.md](./docs/setup-notes.md).

## Beginner Quick Start
1. Install dependencies from the root:
   `npm install`
2. Copy env files:
   `frontend/.env.example` -> `frontend/.env.local`
   `backend/.env.example` -> `backend/.env`
3. Create the PostgreSQL database:
   `mu_cse_transparency`
4. Generate Prisma client:
   `npm run db:generate`
5. Apply the migration:
   `npm run db:migrate`
6. Seed base roles and the system admin:
   `npm run prisma:seed --workspace backend`
7. Seed safe demo runtime data:
   `npm run seed:demo:runtime --workspace backend`
8. Start the backend:
   `npm run dev:backend`
9. Start the frontend in a second terminal:
   `npm run dev:frontend`
10. Optional runtime verification:
   `npm run verify:demo:runtime --workspace backend`

## Exact Local Commands
### Install
```powershell
npm install
```

### Prisma
```powershell
npm run db:generate
npm run db:migrate
npm run prisma:seed --workspace backend
npm run seed:demo:runtime --workspace backend
```

### Run in development
```powershell
npm run dev:backend
npm run dev:frontend
```

### Build checks
```powershell
npm run build --workspace frontend
npm run build --workspace backend
```

### Runtime verification
```powershell
npm run verify:demo:runtime --workspace backend
```

## Local URLs
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Backend health: `http://localhost:4000/health`
- Backend public events API: `http://localhost:4000/api/events`
- Backend public summaries API: `http://localhost:4000/api/public/financial-summaries`

## Frontend Route Map
### Public
- `/`
- `/events`
- `/events/[eventLookup]`
- `/financial-summaries`
- `/financial-summaries/[eventLookup]`

### Student
- `/events/[eventLookup]/register`
- `/registrations/[registrationId]`
- `/registrations/[registrationId]/payment-proof`
- `/complaints/new`
- `/complaints`

### Internal
- `/dashboard`
- `/dashboard/payments`
- `/dashboard/income-records`
- `/dashboard/budgets`
- `/dashboard/budget-requests`
- `/dashboard/expense-requests`
- `/dashboard/expense-records`
- `/dashboard/approvals`
- `/dashboard/complaints`
- `/dashboard/reconciliation`
- `/dashboard/publications`
- `/dashboard/audit`
- `/dashboard/controls`

## Roles
- `SYSTEM_ADMIN`
- `FINANCIAL_CONTROLLER`
- `ORGANIZATIONAL_APPROVER`
- `EVENT_MANAGEMENT_USER`
- `GENERAL_STUDENT`
- `COMPLAINT_REVIEW_AUTHORITY`

## Demo Credentials
### Demo accounts seeded by `seed-demo-runtime-data.ts`
All of these use:
`DemoPass123!`

- Event manager: `demo.event.manager@example.com`
- Finance controller: `demo.finance@example.com`
- Organizational approver: `demo.approver@example.com`
- Student: `demo.active.student@example.com`
- Student: `demo.verified.student@example.com`
- Student: `demo.verified.student.two@example.com`

### System admin
The system admin is created from `backend/.env`:
- Email: `SEED_ADMIN_EMAIL`
- Password: `SEED_ADMIN_PASSWORD`

On the prepared local machine used during final verification, that admin login is:
- `shimulc17@gmail.com`
- `Admin@123456`

If you reseed with different env values, use your own admin credentials instead.

## Public Summary Logic
- A public summary can only be published after reconciliation is `FINALIZED`.
- The related event must be `COMPLETED` or `CLOSED`.
- Publishing is an explicit protected action by an authorized internal role.
- Public pages expose summary-only data, not raw evidence.
- The public list and detail pages resolve to the latest published snapshot per event.
- Older published snapshots remain available only as protected internal history.

## Demo Data Notes
The demo seed is idempotent and prepares realistic academic demo scenarios:
- 2 public events
- at least 1 active registration flow
- pending and verified payment proofs
- manual income records
- budgets and request history
- settled expense record
- finalized reconciliation
- published public summary
- complaint history and routing

## Known Limitations
- File storage is local-development only, not cloud object storage.
- No live payment gateway is implemented in V1.
- No deployment pipeline or hosting config is included in this handoff.
- Public summary history is intentionally internal; public pages show only the latest published version per event.
- The dedicated `COMPLAINT_REVIEW_AUTHORITY` role exists in the system, but the default demo seed does not create a separate standalone complaint-review demo account.
- The project uses runtime verification scripts and manual smoke checks, not a full automated end-to-end test suite.

## Teacher Demo Flow
1. Open `/` and explain the public-safe vs protected boundary.
2. Open `/events` and then an event detail page.
3. Show student registration and student-owned registration status.
4. Show payment proof submission state handling.
5. Show complaint submission and my complaints.
6. Sign in as finance and open payment verification plus income records.
7. Sign in as event manager and open budget/expense request pages.
8. Sign in as approver and open approvals plus complaint review.
9. Show reconciliation and publication controls.
10. Return to `/financial-summaries` and open the public summary.
11. Sign in as admin and open `/dashboard/audit`.

## Documentation Map
- [docs/handoff-summary.md](./docs/handoff-summary.md)
- [docs/setup-notes.md](./docs/setup-notes.md)
- [docs/demo-guide.md](./docs/demo-guide.md)
- [docs/architecture-decisions.md](./docs/architecture-decisions.md)
- [docs/architecture-overview.md](./docs/architecture-overview.md)
- [docs/git-workflow.md](./docs/git-workflow.md)
- [docs/implementation-placeholders.md](./docs/implementation-placeholders.md)
