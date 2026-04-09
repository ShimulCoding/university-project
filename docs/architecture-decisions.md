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
- Shimul commits normally
- Nayem commits with explicit `--author`
- `main` stays stable and short-lived branches are recommended for larger work
