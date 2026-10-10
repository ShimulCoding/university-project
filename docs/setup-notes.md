# Setup Notes

## Prerequisites
- Node.js 22+ and npm
- PostgreSQL running locally
- A PostgreSQL database named `mu_cse_transparency`

## Environment Files
### Frontend
Copy:
`frontend/.env.example` -> `frontend/.env.local`

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Base URL for the backend API used by Next.js |

Default:
`http://localhost:4000/api`

### Backend
Copy:
`backend/.env.example` -> `backend/.env`

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | Yes | Runtime mode |
| `PORT` | Yes | Backend port |
| `FRONTEND_URL` | Yes | Allowed HTTP(S) frontend origins for CORS, separated with commas; first origin hosts recovery links |
| `TRUST_PROXY_HOPS` | No | Trusted reverse-proxy hop count, 0 by default; set only for the actual proxy topology |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Yes | Access token signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret |
| `ACCESS_TOKEN_TTL` | Yes | Access token lifetime |
| `REFRESH_TOKEN_TTL` | Yes | Refresh token lifetime |
| `ACCESS_TOKEN_COOKIE_NAME` | Yes | Access token cookie name |
| `REFRESH_TOKEN_COOKIE_NAME` | Yes | Refresh token cookie name |
| `BCRYPT_SALT_ROUNDS` | Yes | Password hashing cost |
| `UPLOADS_ROOT` | Yes | Local upload root directory |
| `SEED_ADMIN_FULL_NAME` | Yes for admin seed | Seeded admin full name |
| `SEED_ADMIN_EMAIL` | Yes for admin seed | Seeded admin email |
| `SEED_ADMIN_PASSWORD` | Yes for admin seed | Seeded admin password |
| `SMTP_HOST`, `SMTP_FROM` | Yes for production recovery | Real email transport host and sender |
| `SMTP_PORT`, `SMTP_SECURE` | For SMTP | Transport port (default 587) and TLS flag |
| `SMTP_USER`, `SMTP_PASS` | For authenticated SMTP | Transport credentials |

Environment files do not overwrite values already supplied by the shell or deployment. Relative `UPLOADS_ROOT` resolves from the backend directory in both source and compiled runtime. SMTP is used when configured in development; otherwise development can use Ethereal. Mail errors do not reveal matching recovery details. Connection/greeting timeouts are 5 seconds and socket timeout is 10 seconds; real delivery is an integration check separate from local privacy tests.

For server-rendered cookie recovery, frontend cookie-name overrides must match the backend. Local checks use the same hostname for both applications. In deployment, arrange host/cookie/reverse-proxy settings so cookies reach both Next server rendering and the browser API.

## Database Setup
1. Make sure PostgreSQL is running.
2. Create database:
   `mu_cse_transparency`
3. Update `backend/.env` if your PostgreSQL username, password, host, or port is different.

Example connection string:
`postgresql://postgres:postgres@localhost:5432/mu_cse_transparency`

## Installation
Run from the repository root:

```powershell
npm ci
```

## Prisma Commands
### Generate Prisma client
```powershell
npm run db:generate
```

Stop the backend first on Windows so its running process does not lock the generated Prisma client.

### Apply migration
```powershell
npm run db:migrate
```

For an existing environment, apply the committed migrations without creating a new one:

```powershell
npm exec --workspace backend -- prisma migrate deploy
```

The legacy-role migration revokes global operational roles and mixed admin/event memberships. Assign each event's chosen personnel through System Admin → Events and teams; do not automatically copy former global operators into every event.

The project audit adds account session invalidation, unique financial invariants, and wider aggregate totals. Before deploying `20261010130000_financial_invariants`, check these queries on the target database:

```sql
SELECT "eventId", "participantId", COUNT(*) FROM "Registration"
WHERE "participantId" IS NOT NULL GROUP BY "eventId", "participantId" HAVING COUNT(*) > 1;
SELECT "registrationId", COUNT(*) FROM "PaymentProof"
WHERE "state" = 'PENDING_VERIFICATION' GROUP BY "registrationId" HAVING COUNT(*) > 1;
SELECT "eventId", COUNT(*) FROM "Budget"
WHERE "isActive" = true GROUP BY "eventId" HAVING COUNT(*) > 1;
```

All must return no rows. If duplicates exist, review the records and preserve their decision/evidence history before proceeding; the migration intentionally does not delete them. Apply migrations before starting the updated backend. The local database had no duplicates and all 11 migrations are applied.

### Seed roles and system admin
```powershell
npm run prisma:seed --workspace backend
```

### Seed safe demo runtime data
```powershell
npm run seed:demo:runtime --workspace backend
```

## Run Commands
### Development mode
Backend:
```powershell
npm run dev:backend
```

Frontend:
```powershell
npm run dev:frontend
```

### Build checks
Frontend:
```powershell
npm run build --workspace frontend
```

Backend:
```powershell
npm run build --workspace backend
```

## Runtime Verification
Before the live demo check, run the isolated event-workspace verification against a migrated database with the role catalog initialized:

```powershell
npm run verify:event-workspaces --workspace backend
```

This creates temporary uniquely named accounts/events/evidence and removes its own fixtures. It does not require demo reseeding. It verifies role and document isolation, governance concurrency, account/profile authorization and request return/edit/resubmit behavior.

To add eight rendered frontend checks, start the built backend and frontend, then run:

```powershell
$env:VERIFY_FRONTEND_BASE_URL = "http://localhost:3000"
npm run verify:event-workspaces --workspace backend
Remove-Item Env:VERIFY_FRONTEND_BASE_URL
```

Use a local isolated database for verification. Stop the backend before running Prisma client generation on Windows.

To include actual browser interactions, install/use Microsoft Edge (the default channel), start both built apps, then run:

```powershell
$env:VERIFY_FRONTEND_BASE_URL = "http://localhost:3000"
$env:VERIFY_BROWSER = "1"
npm run verify:event-workspaces --workspace backend
Remove-Item Env:VERIFY_FRONTEND_BASE_URL,Env:VERIFY_BROWSER
```

`VERIFY_BROWSER_CHANNEL` can select another installed Playwright-supported channel. Playwright is a frontend dev dependency; `npm ci` installs its runner without downloading a browser. The full local suite passed 154 checks, including 54 browser checks for team isolation, account profile changes, pagination, session recovery, student registration/proof/complaint submissions and PDF download.

Run the remaining verification from the repository root:

```powershell
npm run prisma:validate --workspace backend
npm run build --workspace backend
npm run verify:flows --workspace backend
npm run verify:finance --workspace backend
npm run verify:governance --workspace backend
npm run verify:event-scope --workspace backend
npm run verify:project-audit --workspace backend
npm run lint --workspace frontend
npm run build --workspace frontend
npm exec --workspace frontend -- tsc --noEmit
npm run verify:client --workspace frontend
npm run verify:pdf --workspace frontend
npm run verify:ui --workspace frontend
npm audit --omit=dev
npm audit
```

The audit regression suite uses temporary fixtures and passed 80 checks. Deliberate concurrent conflict logs and injected SMTP/audit error logs are expected when its assertions pass. The full dependency audit currently exits nonzero for 7 upstream development findings; production audit reports 0. See `project-audit.md` for the advisory and verification limits.

Run:
```powershell
npm run verify:demo:runtime --workspace backend
```

What it verifies:
- backend health route
- public events
- public financial summaries
- login and protected auth
- payment verification queue
- income records
- budget requests
- expense records
- approvals
- reconciliation data

## Expected Local URLs
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`
- Health: `http://localhost:4000/health`

## Common Notes
- Backend root `/` is intentionally not a UI route.
- Public API base is `/api`.
- Uploaded files are stored locally in development, while metadata stays in PostgreSQL.
- Demo seed data is safe to rerun and designed for presentation use.
