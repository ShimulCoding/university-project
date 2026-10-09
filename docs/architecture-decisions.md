# Major Architecture Decisions

## 1. Income Model In V1
- Registration-linked participant income is represented by `Registration` plus `PaymentProof`.
- Non-registration event income is represented by `IncomeRecord`.
- `IncomeRecord` covers sponsor, donation, university support, and manual other approved sources.
- Every income record must stay linked to an event.

## 2. Expense Model In V1
- `ExpenseRequest` represents requested spending before approval and settlement.
- `ExpenseRecord` represents actual recorded or settled spending used in reconciliation.
- The system intentionally separates approved intent from actual paid expense.
- No separate `Disbursement` entity was added in V1.

## 3. Auth Strategy
- Credentials auth with email and password
- Passwords hashed with `bcrypt`
- Access token plus refresh token flow
- HTTP-only cookie-based session behavior from the backend
- RBAC enforced by backend middleware and service boundaries
- Global System Admin login and event-team login are separate entry boundaries.
- Event-team login validates credentials and an active assignment for the requested event before issuing a session.
- Authentication remains user-based; authorization is evaluated again for every event-linked API operation.

## 3A. Event-Specific Internal Teams
- `SYSTEM_ADMIN` remains global; operational roles are not stored as global `UserRole` assignments.
- `EventTeamMember` links a user, event, and event role with assignment and revocation history.
- Upgrades revoke legacy global operational assignments because their target event cannot be inferred safely; any replacement event assignments must be made explicitly by the System Admin.
- Each event requires separate Event Admin, Event Manager, Finance Controller, and Approver accounts at creation.
- Complaint Reviewer is an optional event assignment.
- Required roles use separate accounts within an event to preserve separation of duties.
- Existing accounts can be assigned to more than one event without resetting their credentials.
- A user with active event assignments cannot be promoted to System Admin until those assignments are revoked.
- The final active System Admin assignment cannot be revoked or deactivated.
- Draft publication is a System Admin handoff action and requires all four active separated required roles.
- Team mutations, draft publication, global role mutations, and account status changes use serializable transactions with bounded retries to prevent concurrent changes from orphaning a required role or the last administrator.
- Inactive accounts never count as replacements. Account deactivation checks required-role availability in every affected event.
- Governance audit writes are atomic with their changes and populate the existing event relation when event context is available.
- The frontend root dashboard layout stays neutral; global pages use a System Admin route group and event pages own their sign-in/shell.
- Monetary funding requests and itemized budget versions keep separate workflows. Draft/returned request edits are restricted to their assigned owner.
- General complaints without an event are handled by System Admin; event cases retain event reviewer authority.

## 4. File And Document Handling
- Files are stored on local disk in development through a storage adapter.
- PostgreSQL stores metadata, links, and category references.
- No raw file blobs are stored in the database.
- Proof files, supporting documents, and complaint evidence remain protected.

## 5. Public Summary Publication Rule
- A report must be `FINALIZED`.
- The related event must be `COMPLETED` or `CLOSED`.
- An authorized internal role must explicitly publish the summary.
- Public pages expose summary-only data.
- Public frontend routes show the latest published snapshot per event.
- Historical published snapshots remain internal release history.

## 6. Backend-First Modular Design
- Validation, access control, state transitions, and audit logging live on the backend.
- Each domain stays inside its own module with route, controller, service, repository, types, and validation boundaries.
- No giant cross-domain files are used for core logic.

## 7. Git And Collaboration Decision
- One root repository only
- One root `package-lock.json` because npm workspaces are used
- Shimul commits with explicit `--author="Shimul <shimulc17@gmail.com>"`
- Nayem commits with explicit `--author`
- `main` stays stable and short-lived branches are recommended for larger work
