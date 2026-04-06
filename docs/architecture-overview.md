# Architecture Overview

## System Goal
This project is a financial transparency system for MU CSE Society events. It is designed to reduce silent edits, unclear approvals, undocumented expenses, and weak traceability.

## Core Design Style
- Backend-first
- Modular
- Audit-oriented
- Role-based
- Summary-transparent, not raw-data-public

## Main Layers
### Frontend
- Next.js app for public pages and role-based internal workflows
- Minimal UI surface needed to drive backend-controlled processes

### Backend
- Express API with TypeScript
- Feature modules separated by domain
- Validation, role checks, state transitions, and traceability live here

### Database
- PostgreSQL with Prisma
- Strong relational model
- Event-linked finance records
- Historical records preserved instead of silently overwritten

### Storage
- Local file storage in development through a storage adapter
- File metadata and entity links stored in PostgreSQL

## Key V1 Data Decisions
- Participant payment flow uses `Registration` and `PaymentProof`
- Non-registration income uses `IncomeRecord`
- Planned/requested expense uses `ExpenseRequest`
- Actual paid/settled expense uses `ExpenseRecord`
- Public reporting uses reconciliation-backed summary snapshots

## Auth and Access
- Credentials-based login
- Backend-enforced RBAC
- Internal roles assigned by authorized admins only
- Public visitors do not need authentication

## Public Transparency Rule
Public financial summaries become visible only after:
1. the event is operationally closed
2. reconciliation is finalized
3. an authorized user publishes the public snapshot
