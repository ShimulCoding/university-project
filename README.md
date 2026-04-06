# MU CSE Financial Transparency System

This repository contains the scaffold for the MU CSE Society financial transparency platform. The project is designed as a backend-first, audit-oriented system for event registration, external payment proof verification, budgeting, expense control, complaint handling, reconciliation, and public-safe financial summaries.

## Current Status
- Root monorepo structure is ready
- `frontend/` and `backend/` apps are scaffolded
- Prisma schema is prepared for Version 1
- Locked architecture decisions are documented
- Full business logic is not implemented yet

## Tech Stack
- Frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL
- ORM: Prisma
- Auth direction: credentials auth + RBAC
- File handling direction: local uploads in development through a storage adapter

## Project Structure
```text
university-project/
|-- frontend/   # Next.js app
|-- backend/    # Express API + Prisma schema
|-- docs/       # Setup notes, architecture notes, placeholders
|-- diagrams/   # DFD, ERD, sequence diagrams, future visuals
`-- database/   # Database-related notes and future artifacts
```

## Locked V1 Decisions
- Keep `IncomeRecord` in V1 for sponsor, donation, university support, and other manual income sources.
- Keep `ExpenseRequest` separate from `ExpenseRecord`.
- Use credentials auth with backend-enforced RBAC.
- Store file metadata in the database and files on local disk in development.
- Publish public financial summaries only after finalized reconciliation and explicit publish action.
- Keep `main` stable and use short-lived branches when a change is bigger or riskier.

## First-Time Setup
1. Install dependencies from the repository root:
   `npm install`
2. Copy the example environment files:
   `frontend/.env.example` -> `frontend/.env.local`
   `backend/.env.example` -> `backend/.env`
3. Create a PostgreSQL database for the backend.
4. Update `backend/.env` with the correct database URL and JWT secrets.
5. Generate the Prisma client:
   `npm run db:generate`
6. When migrations are ready later, run:
   `npm run db:migrate`

## Useful Commands
- Frontend dev server: `npm run dev:frontend`
- Backend dev server: `npm run dev:backend`
- Generate Prisma client: `npm run db:generate`
- Run migrations: `npm run db:migrate`

## Beginner Notes
- The backend is intentionally modular. Each feature should stay inside its own module folder.
- The database schema already includes the core entities needed for finance traceability.
- Public transparency in this project means summary-level visibility, not exposing raw evidence or internal reviewer notes.
- Version 1 does not include live payment gateway integration.

## Docs Map
- [Setup Notes](./docs/setup-notes.md)
- [Architecture Decisions](./docs/architecture-decisions.md)
- [Architecture Overview](./docs/architecture-overview.md)
- [Implementation Placeholders](./docs/implementation-placeholders.md)
