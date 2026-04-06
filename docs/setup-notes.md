# Setup Notes

## Purpose
These notes explain how to prepare the project locally before feature development starts.

## What Is Already Ready
- Root monorepo workspace
- `frontend/` and `backend/` folder separation
- Backend module folders
- Prisma schema scaffold
- Local upload directory structure
- Initial docs and architecture notes

## What You Need Before Running
- Node.js and npm
- PostgreSQL
- A database created for this project

## Local Setup Steps
1. Run `npm install` from the repository root.
2. Copy `frontend/.env.example` to `frontend/.env.local`.
3. Copy `backend/.env.example` to `backend/.env`.
4. Update the database URL and JWT secrets in `backend/.env`.
5. Run `npm run db:generate` from the root.
6. Start the frontend with `npm run dev:frontend`.
7. Start the backend with `npm run dev:backend`.

## Development Notes
- Keep the backend modular. Do not combine multiple domains into one large file.
- Store uploaded files through the storage adapter, not directly in random folders.
- Keep finance-sensitive logic on the backend, even if the frontend later hides or shows controls.
- Do not expose receipts, payment proofs, complaint evidence, or reviewer notes in public routes.

## Git Reminder
- Small safe changes can go to `main`.
- Use short-lived branches for schema changes, auth changes, or larger feature work.
- Nayem-authored commits should use the correct `--author` value when needed.

