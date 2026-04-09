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
- Event managers prepare requests and operational event-side records
- Finance controllers verify payments, record income, settle expenses, and manage reconciliation
- Approvers handle approval decisions and publication authority
- System admins retain protected broad access including audit views
- Complaint review authority exists for protected complaint routing flows

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
- Verification queue
- Income records
- Budgets
- Requests
- Expense ledger
- Approvals
- Complaints review
- Reconciliation
- Publication controls
- Audit log
