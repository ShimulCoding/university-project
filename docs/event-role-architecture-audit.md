# Event Team Architecture Audit and Implementation

Date: 2026-10-10. Baseline: `a6881d4` on `main`.

## Project purpose and audit scope

The MU CSE Financial Transparency Platform manages event participation and money through a protected internal workflow, then publishes summary information for public accountability. Students register, submit payment evidence, and track their own complaints. Event personnel verify income, prepare budgets and requests, decide approvals, settle expenses, reconcile the event, and publish a finalized summary. System Admin governs accounts, event setup, teams, and audit.

The audit covered the repository state and history, project documentation, frontend route/layout hierarchy and navigation, API helpers and forms, backend routes/middleware/validation/services/repositories/mappers, Prisma models and migrations, protected uploads, seeds, and all existing verification scripts. The root `AGENTS.md` was missing at baseline; this change adds the repository instructions supplied for this project.

## Architecture already present at baseline

- Next.js 16 / React 19 frontend, Express 5 / TypeScript backend, Prisma 6 / PostgreSQL database, npm workspaces.
- `UserRole` represents global account roles; only `SYSTEM_ADMIN` and `GENERAL_STUDENT` are valid global assignments.
- `EventTeamMember` represents a user's role within an event, with active/revoked membership and an assigning actor. A user can hold different roles in different events.
- Authentication issues user sessions. Middleware reloads account status and current assignments from PostgreSQL on each protected request.
- Shared event-scope helpers constrain list queries and validate direct record ownership. Operational decisions require the corresponding role in the record's event.
- Student owner views and document access have separate ownership paths. Internal evidence is protected by owning event and document category.
- Reconciliation and publication retain stale-report, event-state, and public disclosure checks.
- The earlier migration revokes legacy global operational roles and mixed System Admin/event memberships. It does not invent replacement teams.

The requested data model therefore existed. The remaining defects were in frontend access boundaries, incomplete workflow exposure, handoff enforcement, and concurrent governance changes. The implementation extends the existing architecture.

## Findings and implemented changes

| Finding | Change |
| --- | --- |
| The parent dashboard layout intercepted signed-out event routes and rendered the global System Admin login. It also wrapped event pages in the global shell. | Keep the dashboard root neutral; place global pages behind a server-side `(system)` layout. Event routes use their own sign-in and shell. Existing URLs remain valid. |
| A student or account assigned to another event could not easily switch into the required team account. | Event routes display the current account and the event-specific sign-in when an assignment is absent, with a link to assigned events. |
| The global overview/navigation presented operational modules as the main dashboard. | Global navigation now exposes event setup/teams, accounts/global roles, general platform complaints, and audit. Event operations are accessed through the event workspace. Older global URLs retain read-only oversight. |
| System Admin account governance APIs had no complete dashboard workflow. | Add `/dashboard/users` with account creation, status changes, global role assignment/revocation, pagination, and links to active event memberships. |
| Event managers could publish drafts using the event update endpoint. | Draft setup and first publication require System Admin. Assigned Event Admin/Manager controls post-publication lifecycle; System Admin remains an observer for operational lifecycle changes. |
| Publishing an existing draft did not verify that all four required roles still had active personnel. | Publication validates an active, separated Event Admin, Manager, Finance Controller, and Approver in the same transaction. The UI shows missing roles and blocks the publish action until ready. |
| Required-role revocation counted inactive replacement accounts. Deactivating a user could leave an event without required personnel. | Shared team-readiness validation counts active non-admin accounts. Revocation and account deactivation require active replacements in every affected event. |
| Concurrent role/account changes could each pass a pre-write count and remove the final required member/admin. | Use serializable governance transactions with bounded conflict retries. Event/team changes, global role changes, account deactivation, and their audit records commit together. Last-admin protection counts active users rather than duplicate assignment rows. |
| The event budget-request page represented itemized budget versions; the separate funding request creation form was unused. Returned requests lacked an edit/recovery interface. | Preserve itemized budget workflows and add `/funding-requests` for monetary requests, owner draft/returned edits, supporting evidence, submission, and decision history. Add returned/draft expense editing as well. |
| Menu and page permissions differed from backend read permissions. | Align navigation and page guards, including Finance access to itemized budgets, Manager read access to expenses and closure reports, and Approver-only decision controls. |
| General complaints without an event had backend System Admin handling but disabled frontend controls. | The global complaint page enables actions only for cases without an event; event cases remain read-only for System Admin. |
| Event audit context was present in JSON, but the existing `AuditLog.eventId` relation was not populated. | Persist event linkage from explicit event context or the Event entity ID. Governance audit writes participate in their mutation transaction. No historical audit rows are rewritten. |
| Public login content exposed a configured admin address and README included an admin password. | Remove those values from login defaults and README; use local environment configuration. |
| Team/account administration lists hid records beyond the default first page. | Add pagination for event setup, accounts, and funding requests. Direct event links resolve the requested event even outside the current list page. |

Existing event detail selectors already bound requested IDs to an event-filtered list. That code was retained; it was not a cross-event leak.

## Responsibility matrix

All event-role permissions below apply only to events with an active assignment. Read and mutation rights are separate.

| Workflow | System Admin | Event Admin | Event Manager | Finance Controller | Approver | Complaint Reviewer |
| --- | --- | --- | --- | --- | --- | --- |
| Create event, assign/replace team, publish draft | Manage | Read own event | Read own event | Read own event | Read own event | Read own event |
| Post-publication event lifecycle | Read | Manage | Manage | Read | Read | Read |
| Payment queue and manual income | Read | Read | — | Manage | — | — |
| Itemized budgets | Read | Create/revise/submit | Create/revise/submit | Read | Approve/read | — |
| Funding and expense requests | Read | Create; edit/submit own | Create; edit/submit own | Read | Decide/read | — |
| Expense records and settlement | Read | Read | Read | Manage | Read | — |
| Event complaints | Read | Manage | — | — | Manage | Manage |
| Reconciliation | Read | Read | Read | Generate/review | Finalize/read | — |
| Public summary releases | Read | Read | Read | Read | Publish/unpublish | — |
| Global accounts, roles, audit, general complaints | Manage | — | — | — | — | — |

Students retain owner access to registrations, proofs, and complaints. Public visitors retain published events and summary-only reports. Required event roles must belong to separate accounts within an event; complaint review is optional. Adding an assignment in another event never reuses the first event's privileges.

## Implementation sequence

1. Inspect repository memory/history and trace identity, event ownership, workflow states, and frontend entry boundaries.
2. Preserve the existing event membership model, scoped services, and public/student workflows.
3. Split global and event layouts; provide the System Admin governance interface and accurate event navigation.
4. Enforce draft handoff, active-team completeness, last-admin availability, and concurrent mutation safety with atomic audit records.
5. Expose the existing funding request workflow and edit/resubmit recovery inside the event workspace.
6. Apply the existing pending migration after a read-only local-data preflight; run schema, build, regression, and isolated live verification.
7. Update repository instructions, architecture memory, setup/demo guidance, and this audit; commit and immediately push using the next contributor in the cycle.

## Database rollout and existing personnel

The local database had seven events, no active legacy global operational roles, and no mixed System Admin/event memberships. The pending migration `20261004120000_revoke_legacy_global_event_roles` was applied successfully; all nine existing migrations are now applied. This change needs no additional schema migration.

Four older events have no active assignments for any of the four required roles:

| Existing event | Status | Required action |
| --- | --- | --- |
| MU CP BOOSTER | DRAFT | Assign four separate accounts before publication. |
| Spring Coding Bootcamp 2026 | COMPLETED | Assign personnel before resuming internal closure work. |
| MU CP BOOSTER 3.0 | PUBLISHED | Assign the event's operational team. |
| IMUPC | PUBLISHED | Assign the event's operational team. |

These records remain intact. Their former global roles cannot establish who should manage each event. The System Admin can fill the gaps using **Events and teams**, and the user was asked for personnel choices. The dashboard makes missing roles visible. Existing public/student records remain accessible under their original visibility and ownership rules.

For another environment, apply committed migrations with `npm exec --workspace backend -- prisma migrate deploy`, then assign the chosen event teams. Do not automatically grant every former global operator access to every event.

## Verification evidence

The following completed successfully against the local project and PostgreSQL database:

- Prisma schema validation and client generation.
- Backend TypeScript build; frontend production build and ESLint with zero warnings.
- Existing event-scope, flow, finance, and governance verification scripts.
- Existing live demo verification: public events/summaries, student proof ownership, scoped finance/request/governance reads, refresh replay rejection, and recovery privacy.
- New `verify:event-workspaces`: 87 HTTP/boundary checks with unique temporary fixtures; 95 when rendered production frontend checks are enabled.

The new suite exercises event/global login separation, list scoping across nine domains, direct record IDs, cross-event mutations and protected evidence, distinct roles across two events, draft publishing and active-team checks, owner draft edits through multipart forms, returned funding recovery, approval history, general/event complaint boundaries, global account administration, immediate membership revocation with an existing cookie, concurrent member removals, concurrent account deactivation/member removal, and persisted event audit linkage.

Rendered checks cover the actual System Admin and event login layouts, assigned Finance data, denied finance access for the same user acting as Manager in another event, funding forms, Manager closure oversight, account administration, and platform complaint controls. These are HTTP-rendered page checks, not automated browser click or visual tests. Concurrent verification intentionally provokes PostgreSQL serialization conflicts; retries preserve the invariant and the losing removal returns `409`.

Verification deletes only its own tracked users, events, records, audit rows, and evidence file. No existing event or seed account is reseeded. The post-verification local audit found zero leftover verification events.
