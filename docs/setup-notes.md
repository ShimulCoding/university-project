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
| `FRONTEND_URL` | Yes | Allowed frontend origin for CORS |
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
npm install
```

## Prisma Commands
### Generate Prisma client
```powershell
npm run db:generate
```

### Apply migration
```powershell
npm run db:migrate
```

For an existing environment, apply the committed migrations without creating a new one:

```powershell
npm exec --workspace backend -- prisma migrate deploy
```

The legacy-role migration revokes global operational roles and mixed admin/event memberships. Assign each event's chosen personnel through System Admin → Events and teams; do not automatically copy former global operators into every event.

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

This creates temporary uniquely named accounts/events/evidence and removes its own fixtures. It does not require demo reseeding. It verifies 87 HTTP/boundary checks, including concurrent changes and request return/edit/resubmit behavior.

To add eight rendered frontend checks, start the built backend and frontend, then run:

```powershell
$env:VERIFY_FRONTEND_BASE_URL = "http://localhost:3000"
npm run verify:event-workspaces --workspace backend
Remove-Item Env:VERIFY_FRONTEND_BASE_URL
```

Use a local isolated database for verification. Stop the backend before running Prisma client generation on Windows.

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
