# Locked Architecture Decisions

## V1 income model
- Keep participant fee income anchored to `Registration` + `PaymentProof`.
- Add `IncomeRecord` for sponsor, donation, university support, and other manual income sources.

## Expense flow
- Keep `ExpenseRequest` for requesting/approving spending.
- Keep `ExpenseRecord` for actual paid or settled expense entries used in reconciliation.
- Do not add a separate `Disbursement` model in V1.

## Auth strategy
- Use credentials auth with email and password.
- Store hashed passwords with `bcrypt`.
- Use short-lived access tokens plus refresh tokens.
- Enforce RBAC on the backend.

## Document handling
- Store files on local disk in development through a storage adapter.
- Store metadata and relational links in PostgreSQL.
- Keep payment proofs, supporting documents, and complaint evidence separated by category.

## Public summary rule
- Public financial summaries are publishable only after the event is closed, reconciliation is finalized, and an authorized internal user publishes the snapshot.

## Git workflow
- Keep `main` stable.
- Allow direct commits for small, low-risk changes.
- Use short-lived branches for schema, auth, backend module, or multi-commit feature work.

