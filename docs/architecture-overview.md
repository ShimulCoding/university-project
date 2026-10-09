# Architecture Overview

## System Goal
The system provides event finance transparency for MU CSE Society while protecting evidence, reviewer decisions, and internal governance records. It is designed for academic trust, audit traceability, and clear public disclosure boundaries.

## Architecture Style
- Backend-first
- Modular by domain
- Audit-oriented
- Role-aware
- Public-safe rather than raw-data-public

## Main Layers
### Frontend
- Next.js app with public pages, student-owned flows, and protected internal dashboard flows
- Shared design system with separate public and internal shell patterns
- Server-side data loading for live backend-driven pages

### Backend
- Express API with TypeScript
- Domain modules for auth, roles, users, events, registrations, payments, budgets, requests, approvals, complaints, reconciliation, public publication, and audit
- Zod validation, auth middleware, RBAC checks, service-layer state enforcement, and audit logging

### Database
- PostgreSQL with Prisma
- Event-linked data model for registrations, income, requests, expenses, complaints, reconciliation, and publication
- Revision and decision history kept instead of silent overwrite

### Storage
- Local storage adapter in development
- Database stores document metadata and entity links
- Payment proofs, complaint evidence, and supporting documents remain protected

## Main Backend Modules
- `auth`
- `users`
- `roles`
- `events`
- `registrations`
- `payments`
- `budgets`
- `requests`
- `approvals`
- `complaints`
- `reconciliation`
- `public`
- `audit`

## Main Data Entities
- `User`
- `Role`
- `UserRole`
- `EventTeamMember`
- `Event`
- `Registration`
- `PaymentProof`
- `IncomeRecord`
- `Budget`
- `BudgetItem`
- `BudgetRequest`
- `ExpenseRequest`
- `ExpenseRecord`
- `SupportingDocument`
- `ApprovalDecision`
- `Complaint`
- `ComplaintRouting`
- `ReconciliationReport`
- `AuditLog`

## Access Model
- Public visitors can browse public events and published summaries
- Students can register, submit payment proof, and submit complaints
- `SYSTEM_ADMIN` is the only global internal role. It creates events, assigns event teams, manages platform accounts, and retains governance/audit oversight.
- `EVENT_ADMIN`, `EVENT_MANAGEMENT_USER`, `FINANCIAL_CONTROLLER`, `ORGANIZATIONAL_APPROVER`, and `COMPLAINT_REVIEW_AUTHORITY` are assigned through `EventTeamMember` for a specific event.
- Event-team permissions never fall back to a global operational role. Lists are filtered to assigned event IDs, and direct record/document actions resolve and verify the owning event.
- One user may be assigned to multiple events, with a different role in each event, without sharing access with any unassigned event.
- Public event pages provide an event-context team sign-in. The global dashboard sign-in accepts only the System Admin.
- System Admin can configure and publish a draft. Later operational lifecycle changes belong to the assigned Event Admin or Event Manager.
- Draft publication verifies all four required roles have active separate accounts. Account status/team changes require active replacements and use serializable transactions with audit records in the same transaction.
- General complaints without an event remain System Admin responsibilities; event complaint actions remain assigned to event reviewers.

## Public Summary Rule
Public summaries appear only when:
1. reconciliation is finalized
2. the event is completed or closed
3. an authorized internal role publishes the snapshot
4. the payload is limited to summary-only data

## Route Surface
### Public and student
- Event discovery
- Event details
- Registration flow
- Registration status
- Payment proof submission
- Complaint submission and complaint history
- Published financial summaries

### Internal
- `/dashboard` and `/dashboard/events` provide global System Admin governance.
- Global pages use `(system)/layout.tsx`; the root dashboard layout is neutral so event sign-in is never intercepted by the System Admin shell.
- `/dashboard/users` provides global account creation, status, and role administration.
- `/dashboard/my-events` lists only the authenticated user's active event assignments.
- `/dashboard/events/[slug]/*` contains event-scoped verification, income, budgets, requests, expenses, approvals, complaints, reconciliation, and publication controls.
- `/dashboard/events/[slug]/budget-requests` retains itemized budget creation/revision; `/funding-requests` provides monetary budget requests with owner editing, resubmission, evidence, and decision history.
- `/dashboard/audit` remains a protected global System Admin view.
- Older global operational URLs remain protected read-only oversight views. Global complaint actions are enabled only for cases without an event.

See [the event team audit](event-role-architecture-audit.md) for the detailed permission matrix and verification evidence.
