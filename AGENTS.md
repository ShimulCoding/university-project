# Repository Instructions

## Start each task

- Read this file and `docs/PROJECT_STATE.md` before making changes.
- Inspect `git status -sb`, recent Git history, and the relevant existing implementation.
- Use the specification and architecture decisions in `docs/`; preserve working workflows and avoid unrelated rewrites.
- Keep repository memory current when architecture, workflows, or verification requirements change.

## Architecture

- This is an npm workspace with a Next.js frontend and an Express/Prisma/PostgreSQL backend.
- `SYSTEM_ADMIN` is global. Operational permissions come only from active `EventTeamMember` assignments for the owning event.
- Enforce authorization in the backend for lists, direct IDs, documents, and mutations. Frontend navigation is not an authorization boundary.
- Required event roles use separate accounts. System Admin accounts cannot also hold event operational roles.
- Preserve student ownership, protected evidence, revision/decision history, and public summary disclosure rules.
- Use the shared governance transaction for event teams, global role changes, and account status changes; keep their audit writes in the same transaction.
- Never infer event assignments from a legacy global operational role. The System Admin chooses each event's personnel.

## Verification

- Follow the commands and setup requirements in `docs/PROJECT_STATE.md` and `docs/setup-notes.md` for implementation verification.
- Stop the backend before regenerating Prisma on Windows.
- Use the isolated `verify:event-workspaces` fixtures for event access and concurrency verification. Do not reseed an existing database merely to run this check.
- Record actual verification results and material limitations; do not claim browser interaction or deployment based only on builds or API checks.
- Keep local environment secrets, credentials, uploads, and generated build output out of commits.

## Git workflow

- Always commit from `E:\4.1\WEB +PROJECT\University-project`.
- Maintain the alternating Shimul/Nayem contributor cycle by inspecting the latest commit.
- Use `Shimul: Added/Fixed/Removed ...` with `--author="Shimul <shimulc17@gmail.com>"`, or `Nayem: Added/Fixed/Removed ...` with `--author="Nayem <nayem692003@gmail.com>"`.
- Push authorized completed changes to `origin/main` immediately after committing.
- Run `git status -sb` after pushing and report any remaining changes or push failures.
