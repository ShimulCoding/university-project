# Security entry-point and trust-boundary map

Current review branch after approved controls, 2026-10-12. The original pre-assessment inventory remains in security-entry-point-map.md. Local repository/loopback fixtures only; production configuration and data are outside this review.

## Stack, roles and data stores

- Next.js 16 / React 19 / TypeScript / Tailwind frontend; Express 5 / Prisma 6 / PostgreSQL backend (`package.json`, both workspace manifests, `backend/prisma/schema.prisma:1`).
- Anonymous visitors: public events and approved financial snapshots. `GENERAL_STUDENT`: owned registrations, proofs and complaints. `SYSTEM_ADMIN`: global governance/oversight. Event assignments: `EVENT_ADMIN`, `EVENT_MANAGEMENT_USER`, `FINANCIAL_CONTROLLER`, `ORGANIZATIONAL_APPROVER`, `COMPLAINT_REVIEW_AUTHORITY` (`backend/src/utils/event-scope.ts`). Accounts may have no role while awaiting assignment. Active assignments are the operational authority.
- PostgreSQL tables/models (27): `User`, `Role`, `UserRole`, `EventTeamMember`, `RefreshToken`, `MfaFactor`, `MfaChallenge`, `MfaRecoveryCode`, `MfaEnrollmentGrant`, `PasswordResetToken`, `Event`, `Registration`, `PaymentProof`, `Budget`, `BudgetItem`, `BudgetRequest`, `ExpenseRequest`, `ExpenseRecord`, `IncomeRecord`, `FinancialIdempotency`, `SupportingDocument`, `ApprovalDecision`, `Complaint`, `ComplaintRouting`, `ReconciliationReport`, `PublicSummarySnapshot`, `AuditLog`. Identity/PII, bcrypt hashes, hashed refresh/reset capabilities, memberships, Decimal financial records, revision/decision history, approved snapshots, document metadata and audit context.
- Private local evidence: `backend/src/config/uploads.ts` and `backend/src/storage/adapters/local-storage.adapter.ts`. The database contains paths/ownership; files are outside Next public assets and have random UUID names.
- Browser: HttpOnly access/refresh cookies (`backend/src/config/auth.ts`); short-lived PDF Blob URLs and browser font cache (`frontend/src/lib/pdf.ts`). Public fonts are static assets, not uploads.
- Process memory: rate-limiter counters, Prisma client, SMTP transporter, bootstrap flag. SMTP sends password-reset capabilities; development may use Ethereal (`backend/src/config/mailer.ts`). Stdout/stderr and AuditLog are additional data sinks.
- Repository/lockfile/tooling and ignored environment files are operator trust inputs. No hosting/firewall/backup/IaC or CI workflow was found in tracked files. No grades, refunds, waivers, payment-provider integration or inbound webhook implementation was found; those requested categories are not implemented features.

## Controls added since the baseline

- All privileged paths require supervised MFA enrollment and current bound sessions; encrypted factor secrets, hashed one-use tickets/recovery codes and assurance enter the database. The shared governance transaction rechecks trusted HTTP session context.
- Next proxy supplies fresh CSP nonces; exact configured CORS origins are accepted. Multipart admission/role/record checks precede storage; ClamAV INSTREAM adds a private scanner transport boundary before persistence.
- Manual income and expense creates require UUID retry keys before multipart. Only normalized request/file hashes and linked result IDs enter FinancialIdempotency; result/audit/ledger commit together. Replays recheck current authority.
- Reset email requires verified TLS for configured SMTP and Ethereal; no raw message, credential or preview URL enters application logs. New reset capabilities use browser URL fragments, read after hydration and submitted only in the API JSON body. Valid legacy query links remain supported and log-sensitive. Next raw request/action/fetch logging is disabled.
- All seed entry points require loopback nonproduction targets and create-only governed identities/teams. Existing accounts/data are never reseeded by verification.

## Trust boundaries

1. Internet/browser → Next pages: URL/search parameters and cookies are untrusted. Server rendering forwards cookies to the configured API (`frontend/src/lib/api/server.ts`); browser fetches use credentials (`frontend/src/lib/api/client.ts`). React text/attribute rendering escapes text; no application `dangerouslySetInnerHTML`/`eval`/shell execution was found in the source inventory.
2. Browser/Next → Express: JSON, URL-encoded and multipart bodies, parameters, query, Origin, forwarded IP headers and User-Agent. Route Zod schemas validate body/query/IDs; two payment upload handlers parse schemas inside their controllers (`backend/src/modules/payments/controllers/payments.controller.ts`). Route authorization is followed by owning-event/owner checks in services.
3. Express → PostgreSQL: Prisma parameterized operations and `Prisma.sql` tagged queries in approvals/public repositories. Governance mutations and audit writes share serializable transactions (`backend/src/utils/governance-transaction.ts`); sign-in uses repeatable read.
4. Multipart → storage → protected response: user bytes/MIME/name/size cross the upload validator, storage provider and document authorization service. Document download is authenticated and parent-owned/event-scoped (`backend/src/modules/documents/services/documents.service.ts`).
5. Published snapshot → HTML/SVG/PDF: public mappers disclose approved aggregates/breakdown labels; text enters React and PDFKit text APIs. Raw PDF drawing commands are generated by application geometry, while labels use structured `PdfText` (`frontend/src/lib/pdf.ts`, `:53`, `:60`). PDF generation occurs in the browser, with a fixed four-font same-origin allow-list; there is no server HTML renderer or private PDF-export endpoint.
6. Authentication → SMTP/browser/logs: password hashes and token hashes reside in the DB; raw reset tokens are delivered through verified-TLS mail in browser fragments, then cross the existing JSON reset API boundary. New fragments do not reach GET request URLs; legacy query links remain sensitive. Request metadata and failures enter controlled operational/audit records; raw Next stdout diagnostics are disabled. Credentials, PII, browser history/extensions and external mail/trace/proxy handling require review.
7. Operator → scripts/database: Prisma migrations and seed/demo scripts are CLI entry points. They are not HTTP routes and must not run against production as part of this audit.

## All HTTP entry points

Inventory: 91 Express routes including health. Middleware shown is the route-level gate, not proof that each service permission check is correct.

| Method/path | Source | Middleware and handler |
| --- | --- | --- |
| `GET /health` | `backend/src/app.ts:27` | (_request, response) => { response.status(200).json({ status: "ok", service: "mu-cse-transparency-backend", timestamp: new Date().toISOString(), }); } |
| `GET /api/approvals/queue` | `backend/src/modules/approvals/routes/approvals.routes.ts:20` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]) → validateRequest(listApprovalQueueSchema) → asyncHandler(approvalsController.listApprovalQueue) |
| `POST /api/approvals/:entityType/:entityId/decisions` | `backend/src/modules/approvals/routes/approvals.routes.ts:26` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]) → validateRequest(approvalDecisionSchema) → asyncHandler(approvalsController.decide) |
| `GET /api/audit/` | `backend/src/modules/audit/routes/audit.routes.ts:16` | authenticate, authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(listAuditLogsSchema) → asyncHandler(auditController.listAuditLogs) |
| `GET /api/audit/:auditLogId` | `backend/src/modules/audit/routes/audit.routes.ts:17` | authenticate, authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(auditLogIdParamSchema) → asyncHandler(auditController.getAuditLogById) |
| `POST /api/auth/mfa/enrollment-grants` | `backend/src/modules/auth/routes/auth.routes.ts:28` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → authenticate → authorize(RoleCode.SYSTEM_ADMIN) → mfaRateLimiter → validateRequest(mfaGrantSchema) → asyncHandler(authController.issueMfaEnrollmentGrant) |
| `POST /api/auth/mfa/start-enrollment` | `backend/src/modules/auth/routes/auth.routes.ts:29` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → mfaRateLimiter → validateRequest(mfaEnrollmentSchema) → asyncHandler(authController.startMfaEnrollment) |
| `POST /api/auth/mfa/verify` | `backend/src/modules/auth/routes/auth.routes.ts:30` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → mfaRateLimiter → validateRequest(mfaVerificationSchema) → asyncHandler(authController.verifyMfa) |
| `POST /api/auth/bootstrap-admin` | `backend/src/modules/auth/routes/auth.routes.ts:32` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → requireLocalBootstrap → authRateLimiter → validateRequest(bootstrapAdminSchema) → asyncHandler(authController.bootstrapAdmin) |
| `POST /api/auth/register` | `backend/src/modules/auth/routes/auth.routes.ts:39` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → authRateLimiter → validateRequest(registerSchema) → asyncHandler(authController.register) |
| `POST /api/auth/login` | `backend/src/modules/auth/routes/auth.routes.ts:45` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → loginRateLimiter → validateRequest(loginSchema) → asyncHandler(authController.login) |
| `POST /api/auth/internal-login` | `backend/src/modules/auth/routes/auth.routes.ts:51` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → loginRateLimiter → validateRequest(internalLoginSchema) → asyncHandler(authController.internalLogin) |
| `POST /api/auth/event-team-login` | `backend/src/modules/auth/routes/auth.routes.ts:57` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → loginRateLimiter → validateRequest(eventTeamLoginSchema) → asyncHandler(authController.eventTeamLogin) |
| `POST /api/auth/forgot-password` | `backend/src/modules/auth/routes/auth.routes.ts:63` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → authRateLimiter → validateRequest(forgotPasswordSchema) → asyncHandler(authController.forgotPassword) |
| `POST /api/auth/reset-password` | `backend/src/modules/auth/routes/auth.routes.ts:69` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → authRateLimiter → validateRequest(resetPasswordSchema) → asyncHandler(authController.resetPassword) |
| `POST /api/auth/refresh` | `backend/src/modules/auth/routes/auth.routes.ts:75` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → sessionRateLimiter → asyncHandler(authController.refresh) |
| `POST /api/auth/logout` | `backend/src/modules/auth/routes/auth.routes.ts:76` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → sessionRateLimiter → asyncHandler(authController.logout) |
| `GET /api/auth/me` | `backend/src/modules/auth/routes/auth.routes.ts:81` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → authenticate → asyncHandler(authController.getCurrentUser) |
| `PATCH /api/auth/update-email` | `backend/src/modules/auth/routes/auth.routes.ts:82` | (_request, response, next) => { response.setHeader("Cache-Control", "private, no-store"); next(); } → authenticate → authRateLimiter → validateRequest(updateEmailSchema) → asyncHandler(authController.updateEmail) |
| `GET /api/budgets/` | `backend/src/modules/budgets/routes/budgets.routes.ts:22` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(listBudgetsSchema) → asyncHandler(budgetsController.listBudgets) |
| `GET /api/budgets/:budgetId` | `backend/src/modules/budgets/routes/budgets.routes.ts:34` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(budgetIdParamSchema) → asyncHandler(budgetsController.getBudgetById) |
| `POST /api/budgets/` | `backend/src/modules/budgets/routes/budgets.routes.ts:46` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]) → validateRequest(createBudgetSchema) → asyncHandler(budgetsController.createBudget) |
| `POST /api/budgets/:budgetId/revisions` | `backend/src/modules/budgets/routes/budgets.routes.ts:52` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]) → validateRequest(reviseBudgetSchema) → asyncHandler(budgetsController.createBudgetRevision) |
| `PATCH /api/budgets/:budgetId/state` | `backend/src/modules/budgets/routes/budgets.routes.ts:58` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER, RoleCode.ORGANIZATIONAL_APPROVER, ]) → validateRequest(updateBudgetStateSchema) → asyncHandler(budgetsController.updateBudgetState) |
| `POST /api/budgets/:budgetId/activate` | `backend/src/modules/budgets/routes/budgets.routes.ts:69` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER]) → validateRequest(budgetIdParamSchema) → asyncHandler(budgetsController.activateBudget) |
| `GET /api/complaints/mine` | `backend/src/modules/complaints/routes/complaints.routes.ts:45` | authenticate → validateRequest(listComplaintQueueSchema) → asyncHandler(complaintsController.listMyComplaints) |
| `POST /api/complaints/` | `backend/src/modules/complaints/routes/complaints.routes.ts:50` | authenticate → uploadRateLimiter → uploadAdmission → upload.array("evidence", 15) → validateRequest(createComplaintSchema) → asyncHandler(complaintsController.createComplaint) |
| `GET /api/complaints/review-queue` | `backend/src/modules/complaints/routes/complaints.routes.ts:59` | authenticate → requireComplaintReviewer → validateRequest(listComplaintQueueSchema) → asyncHandler(complaintsController.listReviewQueue) |
| `GET /api/complaints/:complaintId` | `backend/src/modules/complaints/routes/complaints.routes.ts:66` | authenticate → validateRequest(complaintIdParamSchema) → asyncHandler(complaintsController.getComplaintById) |
| `POST /api/complaints/:complaintId/review` | `backend/src/modules/complaints/routes/complaints.routes.ts:71` | authenticate → requireComplaintReviewer → validateRequest(reviewComplaintSchema) → asyncHandler(complaintsController.startReview) |
| `POST /api/complaints/:complaintId/route` | `backend/src/modules/complaints/routes/complaints.routes.ts:77` | authenticate → requireComplaintReviewer → validateRequest(routeComplaintSchema) → asyncHandler(complaintsController.routeComplaint) |
| `POST /api/complaints/:complaintId/escalate` | `backend/src/modules/complaints/routes/complaints.routes.ts:83` | authenticate → requireComplaintReviewer → validateRequest(escalateComplaintSchema) → asyncHandler(complaintsController.escalateComplaint) |
| `POST /api/complaints/:complaintId/resolve` | `backend/src/modules/complaints/routes/complaints.routes.ts:89` | authenticate → requireComplaintReviewer → validateRequest(resolveComplaintSchema) → asyncHandler(complaintsController.resolveComplaint) |
| `POST /api/complaints/:complaintId/close` | `backend/src/modules/complaints/routes/complaints.routes.ts:95` | authenticate → requireComplaintReviewer → validateRequest(closeComplaintSchema) → asyncHandler(complaintsController.closeComplaint) |
| `GET /api/documents/:documentId/open` | `backend/src/modules/documents/routes/documents.routes.ts:14` | authenticate → sensitiveActionLimits.documents → validateRequest(protectedDocumentParamSchema) → asyncHandler(documentsController.openProtectedDocument) |
| `GET /api/events/` | `backend/src/modules/events/routes/events.routes.ts:22` | validateRequest(listPublicEventsSchema) → asyncHandler(eventsController.listPublicEvents) |
| `GET /api/events/manage/list` | `backend/src/modules/events/routes/events.routes.ts:27` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.COMPLAINT_REVIEW_AUTHORITY, ]) → validateRequest(listManageEventsSchema) → asyncHandler(eventsController.listManageEvents) |
| `GET /api/events/manage/:eventLookupKey` | `backend/src/modules/events/routes/events.routes.ts:41` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.COMPLAINT_REVIEW_AUTHORITY, ]) → validateRequest(eventLookupParamSchema) → asyncHandler(eventsController.getManageEvent) |
| `POST /api/events/` | `backend/src/modules/events/routes/events.routes.ts:55` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(createEventSchema) → asyncHandler(eventsController.createEvent) |
| `PATCH /api/events/:eventLookupKey` | `backend/src/modules/events/routes/events.routes.ts:62` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(updateEventSchema) → asyncHandler(eventsController.updateEvent) |
| `POST /api/events/:eventLookupKey/team-members` | `backend/src/modules/events/routes/events.routes.ts:73` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(assignEventTeamMemberSchema) → asyncHandler(eventsController.assignEventTeamMember) |
| `DELETE /api/events/:eventLookupKey/team-members/:teamMemberId` | `backend/src/modules/events/routes/events.routes.ts:80` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(eventTeamMemberParamSchema) → asyncHandler(eventsController.revokeEventTeamMember) |
| `GET /api/events/:eventLookupKey` | `backend/src/modules/events/routes/events.routes.ts:87` | validateRequest(eventLookupParamSchema) → asyncHandler(eventsController.getPublicEvent) |
| `POST /api/payments/registrations/:registrationId/proofs` | `backend/src/modules/payments/routes/payments.routes.ts:37` | authenticate → asyncHandler(async (request, _response, next) => { await paymentsService.assertPaymentProofUploadAccess(request.auth!.user, String(request.params.registrationId)); next(); }) → uploadRateLimiter → uploadAdmission → upload.array("proofFile", 15) → asyncHandler(paymentsController.submitPaymentProof) |
| `GET /api/payments/verification-queue` | `backend/src/modules/payments/routes/payments.routes.ts:48` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(listVerificationQueueSchema) → asyncHandler(paymentsController.listVerificationQueue) |
| `POST /api/payments/proofs/:paymentProofId/decision` | `backend/src/modules/payments/routes/payments.routes.ts:54` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(paymentProofDecisionSchema) → asyncHandler(paymentsController.decidePaymentProof) |
| `GET /api/payments/income-records` | `backend/src/modules/payments/routes/payments.routes.ts:60` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(listIncomeRecordsSchema) → asyncHandler(paymentsController.listIncomeRecords) |
| `GET /api/payments/income-records/:incomeRecordId` | `backend/src/modules/payments/routes/payments.routes.ts:66` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(incomeRecordIdParamSchema) → asyncHandler(paymentsController.getIncomeRecordById) |
| `POST /api/payments/income-records/:incomeRecordId/verify` | `backend/src/modules/payments/routes/payments.routes.ts:72` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(incomeRecordIdParamSchema) → asyncHandler(paymentsController.verifyIncomeRecord) |
| `POST /api/payments/income-records/:incomeRecordId/void` | `backend/src/modules/payments/routes/payments.routes.ts:78` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(voidIncomeRecordSchema) → asyncHandler(paymentsController.voidIncomeRecord) |
| `POST /api/payments/income-records` | `backend/src/modules/payments/routes/payments.routes.ts:84` | authenticate → authorizeOperationalUpload([RoleCode.FINANCIAL_CONTROLLER]) → requireFinancialRequestKey → uploadRateLimiter → uploadAdmission → upload.array("evidenceFile", 15) → asyncHandler(paymentsController.createIncomeRecord) |
| `GET /api/public/financial-summaries` | `backend/src/modules/public/routes/public.routes.ts:19` | validateRequest(listPublicSummariesSchema) → asyncHandler(publicController.listPublishedFinancialSummaries) |
| `GET /api/public/financial-summaries/:eventLookup` | `backend/src/modules/public/routes/public.routes.ts:24` | validateRequest(publicSummaryLookupParamSchema) → asyncHandler(publicController.getPublishedFinancialSummary) |
| `POST /api/public/manage/financial-summaries/:publicSummaryId/unpublish` | `backend/src/modules/public/routes/public.routes.ts:29` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]) → validateRequest(unpublishPublicSummaryParamSchema) → asyncHandler(publicController.unpublishFinancialSummary) |
| `POST /api/public/manage/financial-summaries/:reconciliationReportId/publish` | `backend/src/modules/public/routes/public.routes.ts:36` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]) → validateRequest(publishPublicSummaryParamSchema) → asyncHandler(publicController.publishFinancialSummary) |
| `GET /api/reconciliation/` | `backend/src/modules/reconciliation/routes/reconciliation.routes.ts:21` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(listReconciliationReportsSchema) → asyncHandler(reconciliationController.listReports) |
| `POST /api/reconciliation/generate` | `backend/src/modules/reconciliation/routes/reconciliation.routes.ts:33` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(generateReconciliationReportSchema) → sensitiveActionLimits.reports → admitReport(reconciliationController.generateReport) |
| `GET /api/reconciliation/:reportId` | `backend/src/modules/reconciliation/routes/reconciliation.routes.ts:40` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(reconciliationReportIdParamSchema) → asyncHandler(reconciliationController.getReportById) |
| `POST /api/reconciliation/:reportId/review` | `backend/src/modules/reconciliation/routes/reconciliation.routes.ts:52` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(reconciliationReportIdParamSchema) → asyncHandler(reconciliationController.reviewReport) |
| `POST /api/reconciliation/:reportId/finalize` | `backend/src/modules/reconciliation/routes/reconciliation.routes.ts:58` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.ORGANIZATIONAL_APPROVER]) → validateRequest(reconciliationReportIdParamSchema) → asyncHandler(reconciliationController.finalizeReport) |
| `GET /api/registrations/me` | `backend/src/modules/registrations/routes/registrations.routes.ts:21` | authenticate → validateRequest(listRegistrationsSchema) → asyncHandler(registrationsController.listMyRegistrations) |
| `POST /api/registrations/` | `backend/src/modules/registrations/routes/registrations.routes.ts:26` | authenticate → validateRequest(createRegistrationSchema) → asyncHandler(registrationsController.createRegistration) |
| `GET /api/registrations/event/:eventId` | `backend/src/modules/registrations/routes/registrations.routes.ts:31` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER, RoleCode.FINANCIAL_CONTROLLER, ]) → validateRequest(eventRegistrationsParamSchema) → asyncHandler(registrationsController.listEventRegistrations) |
| `GET /api/registrations/:registrationId` | `backend/src/modules/registrations/routes/registrations.routes.ts:42` | authenticate → validateRequest(registrationIdParamSchema) → asyncHandler(registrationsController.getRegistrationById) |
| `GET /api/requests/budget-requests/mine` | `backend/src/modules/requests/routes/requests.routes.ts:47` | authenticate → validateRequest(listRequestsSchema) → asyncHandler(requestsController.listMyBudgetRequests) |
| `GET /api/requests/budget-requests` | `backend/src/modules/requests/routes/requests.routes.ts:52` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(listRequestsSchema) → asyncHandler(requestsController.listBudgetRequests) |
| `GET /api/requests/budget-requests/:budgetRequestId` | `backend/src/modules/requests/routes/requests.routes.ts:64` | authenticate → validateRequest(budgetRequestIdParamSchema) → asyncHandler(requestsController.getBudgetRequestById) |
| `POST /api/requests/budget-requests` | `backend/src/modules/requests/routes/requests.routes.ts:69` | authenticate → requireRequestUpload → uploadRateLimiter → uploadAdmission → upload.array("supportingDocument", 15) → validateRequest(createBudgetRequestSchema) → asyncHandler(requestsController.createBudgetRequest) |
| `PATCH /api/requests/budget-requests/:budgetRequestId` | `backend/src/modules/requests/routes/requests.routes.ts:78` | authenticate → requireRequestUpload → asyncHandler(async (request, _response, next) => { await assertRequestUploadAccess(request.auth!.user, { kind: "budget", requestId: String(request.params.budgetRequestId) }); next(); }) → uploadRateLimiter → uploadAdmission → upload.array("supportingDocument", 15) → validateRequest(updateBudgetRequestSchema) → asyncHandler(requestsController.updateBudgetRequest) |
| `POST /api/requests/budget-requests/:budgetRequestId/submit` | `backend/src/modules/requests/routes/requests.routes.ts:90` | authenticate → validateRequest(budgetRequestIdParamSchema) → asyncHandler(requestsController.submitBudgetRequest) |
| `GET /api/requests/expense-requests/mine` | `backend/src/modules/requests/routes/requests.routes.ts:96` | authenticate → validateRequest(listRequestsSchema) → asyncHandler(requestsController.listMyExpenseRequests) |
| `GET /api/requests/expense-requests` | `backend/src/modules/requests/routes/requests.routes.ts:101` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(listRequestsSchema) → asyncHandler(requestsController.listExpenseRequests) |
| `GET /api/requests/expense-requests/:expenseRequestId` | `backend/src/modules/requests/routes/requests.routes.ts:113` | authenticate → validateRequest(expenseRequestIdParamSchema) → asyncHandler(requestsController.getExpenseRequestById) |
| `POST /api/requests/expense-requests` | `backend/src/modules/requests/routes/requests.routes.ts:118` | authenticate → requireRequestUpload → uploadRateLimiter → uploadAdmission → upload.array("supportingDocument", 15) → validateRequest(createExpenseRequestSchema) → asyncHandler(requestsController.createExpenseRequest) |
| `PATCH /api/requests/expense-requests/:expenseRequestId` | `backend/src/modules/requests/routes/requests.routes.ts:127` | authenticate → requireRequestUpload → asyncHandler(async (request, _response, next) => { await assertRequestUploadAccess(request.auth!.user, { kind: "expense", requestId: String(request.params.expenseRequestId) }); next(); }) → uploadRateLimiter → uploadAdmission → upload.array("supportingDocument", 15) → validateRequest(updateExpenseRequestSchema) → asyncHandler(requestsController.updateExpenseRequest) |
| `POST /api/requests/expense-requests/:expenseRequestId/submit` | `backend/src/modules/requests/routes/requests.routes.ts:139` | authenticate → validateRequest(expenseRequestIdParamSchema) → asyncHandler(requestsController.submitExpenseRequest) |
| `GET /api/requests/expense-records` | `backend/src/modules/requests/routes/requests.routes.ts:145` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(listExpenseRecordsSchema) → asyncHandler(requestsController.listExpenseRecords) |
| `GET /api/requests/expense-records/:expenseRecordId` | `backend/src/modules/requests/routes/requests.routes.ts:157` | authenticate → authorizeEventScoped([ RoleCode.SYSTEM_ADMIN, RoleCode.EVENT_ADMIN, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.EVENT_MANAGEMENT_USER, ]) → validateRequest(expenseRecordIdParamSchema) → asyncHandler(requestsController.getExpenseRecordById) |
| `POST /api/requests/expense-records` | `backend/src/modules/requests/routes/requests.routes.ts:169` | authenticate → requireFinanceUpload → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → requireFinancialRequestKey → uploadRateLimiter → uploadAdmission → upload.array("supportingDocument", 15) → validateRequest(createExpenseRecordSchema) → asyncHandler(requestsController.createExpenseRecord) |
| `POST /api/requests/expense-records/:expenseRecordId/settle` | `backend/src/modules/requests/routes/requests.routes.ts:180` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(settleExpenseRecordSchema) → asyncHandler(requestsController.settleExpenseRecord) |
| `POST /api/requests/expense-records/:expenseRecordId/void` | `backend/src/modules/requests/routes/requests.routes.ts:186` | authenticate → authorizeEventScoped([RoleCode.SYSTEM_ADMIN, RoleCode.FINANCIAL_CONTROLLER]) → validateRequest(voidExpenseRecordSchema) → asyncHandler(requestsController.voidExpenseRecord) |
| `GET /api/roles/` | `backend/src/modules/roles/routes/roles.routes.ts:21` | authenticate → validateRequest(listRolesSchema) → asyncHandler(rolesController.listRoles) |
| `GET /api/roles/assignments/:userId` | `backend/src/modules/roles/routes/roles.routes.ts:22` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(userAssignmentsParamSchema) → asyncHandler(rolesController.listUserAssignments) |
| `POST /api/roles/assignments` | `backend/src/modules/roles/routes/roles.routes.ts:28` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(assignRoleSchema) → asyncHandler(rolesController.assignRole) |
| `DELETE /api/roles/assignments/:assignmentId` | `backend/src/modules/roles/routes/roles.routes.ts:34` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(revokeRoleAssignmentSchema) → asyncHandler(rolesController.revokeAssignment) |
| `GET /api/users/me` | `backend/src/modules/users/routes/users.routes.ts:22` | authenticate → asyncHandler(usersController.getCurrentUser) |
| `GET /api/users/` | `backend/src/modules/users/routes/users.routes.ts:23` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(listUsersSchema) → asyncHandler(usersController.listUsers) |
| `GET /api/users/:userId` | `backend/src/modules/users/routes/users.routes.ts:29` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(userIdParamSchema) → asyncHandler(usersController.getUserById) |
| `POST /api/users/` | `backend/src/modules/users/routes/users.routes.ts:35` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(createUserSchema) → asyncHandler(usersController.createUser) |
| `PATCH /api/users/:userId/profile` | `backend/src/modules/users/routes/users.routes.ts:41` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(updateUserProfileSchema) → asyncHandler(usersController.updateProfile) |
| `PATCH /api/users/:userId/status` | `backend/src/modules/users/routes/users.routes.ts:47` | authenticate → authorize(RoleCode.SYSTEM_ADMIN) → validateRequest(updateUserStatusSchema) → asyncHandler(usersController.updateStatus) |

## All Next page entry points

There are no application Next API route handlers or server-action mutation endpoints in this inventory. All mutations use Express. Shared root/system/event layouts, session recovery, loading, segment/global errors and not-found also participate in rendering.

| Page | Source |
| --- | --- |
| `/complaints/new` | `frontend/src/app/complaints/new/page.tsx:1` |
| `/complaints` | `frontend/src/app/complaints/page.tsx:1` |
| `/dashboard/approvals` | `frontend/src/app/dashboard/(system)/approvals/page.tsx:1` |
| `/dashboard/audit` | `frontend/src/app/dashboard/(system)/audit/page.tsx:1` |
| `/dashboard/budget-requests` | `frontend/src/app/dashboard/(system)/budget-requests/page.tsx:1` |
| `/dashboard/budgets` | `frontend/src/app/dashboard/(system)/budgets/page.tsx:1` |
| `/dashboard/complaints` | `frontend/src/app/dashboard/(system)/complaints/page.tsx:1` |
| `/dashboard/controls` | `frontend/src/app/dashboard/(system)/controls/page.tsx:1` |
| `/dashboard/events` | `frontend/src/app/dashboard/(system)/events/page.tsx:1` |
| `/dashboard/expense-records` | `frontend/src/app/dashboard/(system)/expense-records/page.tsx:1` |
| `/dashboard/expense-requests` | `frontend/src/app/dashboard/(system)/expense-requests/page.tsx:1` |
| `/dashboard/income-records` | `frontend/src/app/dashboard/(system)/income-records/page.tsx:1` |
| `/dashboard` | `frontend/src/app/dashboard/(system)/page.tsx:1` |
| `/dashboard/payments` | `frontend/src/app/dashboard/(system)/payments/page.tsx:1` |
| `/dashboard/publications` | `frontend/src/app/dashboard/(system)/publications/page.tsx:1` |
| `/dashboard/reconciliation` | `frontend/src/app/dashboard/(system)/reconciliation/page.tsx:1` |
| `/dashboard/users` | `frontend/src/app/dashboard/(system)/users/page.tsx:1` |
| `/dashboard/events/[slug]/approvals` | `frontend/src/app/dashboard/events/[slug]/approvals/page.tsx:1` |
| `/dashboard/events/[slug]/budget-requests` | `frontend/src/app/dashboard/events/[slug]/budget-requests/page.tsx:1` |
| `/dashboard/events/[slug]/budgets` | `frontend/src/app/dashboard/events/[slug]/budgets/page.tsx:1` |
| `/dashboard/events/[slug]/complaints` | `frontend/src/app/dashboard/events/[slug]/complaints/page.tsx:1` |
| `/dashboard/events/[slug]/expense-records` | `frontend/src/app/dashboard/events/[slug]/expense-records/page.tsx:1` |
| `/dashboard/events/[slug]/expense-requests` | `frontend/src/app/dashboard/events/[slug]/expense-requests/page.tsx:1` |
| `/dashboard/events/[slug]/funding-requests` | `frontend/src/app/dashboard/events/[slug]/funding-requests/page.tsx:1` |
| `/dashboard/events/[slug]/income-records` | `frontend/src/app/dashboard/events/[slug]/income-records/page.tsx:1` |
| `/dashboard/events/[slug]` | `frontend/src/app/dashboard/events/[slug]/page.tsx:1` |
| `/dashboard/events/[slug]/payments` | `frontend/src/app/dashboard/events/[slug]/payments/page.tsx:1` |
| `/dashboard/events/[slug]/publications` | `frontend/src/app/dashboard/events/[slug]/publications/page.tsx:1` |
| `/dashboard/events/[slug]/reconciliation` | `frontend/src/app/dashboard/events/[slug]/reconciliation/page.tsx:1` |
| `/dashboard/my-events` | `frontend/src/app/dashboard/my-events/page.tsx:1` |
| `/events` | `frontend/src/app/events/page.tsx:1` |
| `/events/[eventLookup]` | `frontend/src/app/events/[eventLookup]/page.tsx:1` |
| `/events/[eventLookup]/register` | `frontend/src/app/events/[eventLookup]/register/page.tsx:1` |
| `/financial-summaries` | `frontend/src/app/financial-summaries/page.tsx:1` |
| `/financial-summaries/[eventLookup]` | `frontend/src/app/financial-summaries/[eventLookup]/page.tsx:1` |
| `/` | `frontend/src/app/page.tsx:1` |
| `/registrations/[registrationId]` | `frontend/src/app/registrations/[registrationId]/page.tsx:1` |
| `/registrations/[registrationId]/payment-proof` | `frontend/src/app/registrations/[registrationId]/payment-proof/page.tsx:1` |
| `/reset-password` | `frontend/src/app/reset-password/page.tsx:1` |

## Background and operator entry points

- Backend startup: connect database, synchronize role catalog, prune stale tokens; hourly token pruning (`backend/src/server.ts`, `:11`). No external job queue or webhook worker is present.
- Prisma schema/migrate/generate/seed commands and root/workspace npm scripts (`backend/package.json`, `package.json:9`). Seed/demo and verification scripts are operator-only; verification fixtures delete only their own created IDs.
- Browser PDF export buttons (`frontend/src/components/public/summary-pdf-download-button.tsx`) create a local download; no cloud download URL or expiry mechanism is involved.

## Input-to-sink inventory

HTTP input follows each route handler into its domain service/repository. Auth/user input → User/Role/session/reset tables; event/team input → Event/EventTeamMember; registration/proof input → Registration/PaymentProof/SupportingDocument; budgets/requests/expense/income input → versioned finance tables; decisions/complaints → ApprovalDecision/Complaint/ComplaintRouting; reconciliation/publication → Decimal totals and JSON snapshots; all audited actions → AuditLog. Upload bytes/names → validator and local storage. Public labels/amounts → React text/SVG and structured PDFKit text/geometry.

The table below enumerates backend database/filesystem call sites, including calls that only consume trusted internal data. SQL operations are separately identifiable; it is a coverage index, not a vulnerability assertion.

| Sink | Source |
| --- | --- |
| `prisma.$connect` | `backend/src/config/prisma.ts:22` |
| `prisma.$disconnect` | `backend/src/config/prisma.ts:26` |
| `prisma.user.findUnique` | `backend/src/middlewares/authenticate.ts:42` |
| `prisma.refreshToken.findUnique` | `backend/src/middlewares/authenticate.ts:47` |
| `prisma.event.findFirst` | `backend/src/middlewares/authorize.ts:79` |
| `db.$queryRaw` | `backend/src/modules/approvals/repositories/approvals.repository.ts:41` |
| `db.$queryRaw` | `backend/src/modules/approvals/repositories/approvals.repository.ts:48` |
| `db.budgetRequest.findMany` | `backend/src/modules/approvals/repositories/approvals.repository.ts:53` |
| `db.expenseRequest.findMany` | `backend/src/modules/approvals/repositories/approvals.repository.ts:60` |
| `db.budgetRequest.findUnique` | `backend/src/modules/approvals/repositories/approvals.repository.ts:67` |
| `db.expenseRequest.findUnique` | `backend/src/modules/approvals/repositories/approvals.repository.ts:74` |
| `db.budgetRequest.update` | `backend/src/modules/approvals/repositories/approvals.repository.ts:85` |
| `db.budgetRequest.updateMany` | `backend/src/modules/approvals/repositories/approvals.repository.ts:97` |
| `db.expenseRequest.update` | `backend/src/modules/approvals/repositories/approvals.repository.ts:111` |
| `db.expenseRequest.updateMany` | `backend/src/modules/approvals/repositories/approvals.repository.ts:123` |
| `db.approvalDecision.create` | `backend/src/modules/approvals/repositories/approvals.repository.ts:143` |
| `db.auditLog.create` | `backend/src/modules/audit/repositories/audit.repository.ts:48` |
| `db.auditLog.findMany` | `backend/src/modules/audit/repositories/audit.repository.ts:54` |
| `db.auditLog.count` | `backend/src/modules/audit/repositories/audit.repository.ts:72` |
| `db.auditLog.findUnique` | `backend/src/modules/audit/repositories/audit.repository.ts:78` |
| `db.refreshToken.create` | `backend/src/modules/auth/repositories/auth.repository.ts:19` |
| `db.refreshToken.findUnique` | `backend/src/modules/auth/repositories/auth.repository.ts:32` |
| `db.refreshToken.updateMany` | `backend/src/modules/auth/repositories/auth.repository.ts:45` |
| `db.refreshToken.updateMany` | `backend/src/modules/auth/repositories/auth.repository.ts:58` |
| `prisma.mfaChallenge.deleteMany` | `backend/src/modules/auth/repositories/auth.repository.ts:77` |
| `prisma.refreshToken.deleteMany` | `backend/src/modules/auth/repositories/auth.repository.ts:79` |
| `prisma.passwordResetToken.deleteMany` | `backend/src/modules/auth/repositories/auth.repository.ts:87` |
| `db.passwordResetToken.create` | `backend/src/modules/auth/repositories/auth.repository.ts:103` |
| `db.passwordResetToken.findUnique` | `backend/src/modules/auth/repositories/auth.repository.ts:109` |
| `db.passwordResetToken.updateMany` | `backend/src/modules/auth/repositories/auth.repository.ts:117` |
| `db.passwordResetToken.updateMany` | `backend/src/modules/auth/repositories/auth.repository.ts:130` |
| `tx.event.findFirst` | `backend/src/modules/auth/services/auth.service.ts:207` |
| `tx.refreshToken.findUnique` | `backend/src/modules/auth/services/auth.service.ts:427` |
| `tx.user.update` | `backend/src/modules/auth/services/auth.service.ts:440` |
| `tx.mfaChallenge.updateMany` | `backend/src/modules/auth/services/auth.service.ts:443` |
| `tx.mfaEnrollmentGrant.updateMany` | `backend/src/modules/auth/services/auth.service.ts:444` |
| `db.mfaChallenge.findUnique` | `backend/src/modules/auth/services/mfa.service.ts:23` |
| `db.auditLog.count` | `backend/src/modules/auth/services/mfa.service.ts:29` |
| `db.mfaChallenge.updateMany` | `backend/src/modules/auth/services/mfa.service.ts:38` |
| `tx.mfaEnrollmentGrant.updateMany` | `backend/src/modules/auth/services/mfa.service.ts:57` |
| `tx.mfaEnrollmentGrant.create` | `backend/src/modules/auth/services/mfa.service.ts:60` |
| `tx.mfaChallenge.findUnique` | `backend/src/modules/auth/services/mfa.service.ts:70` |
| `tx.mfaChallenge.update` | `backend/src/modules/auth/services/mfa.service.ts:72` |
| `db.mfaChallenge.create` | `backend/src/modules/auth/services/mfa.service.ts:83` |
| `tx.mfaEnrollmentGrant.findUnique` | `backend/src/modules/auth/services/mfa.service.ts:100` |
| `tx.mfaChallenge.update` | `backend/src/modules/auth/services/mfa.service.ts:107` |
| `tx.mfaFactor.findUnique` | `backend/src/modules/auth/services/mfa.service.ts:118` |
| `tx.mfaRecoveryCode.updateMany` | `backend/src/modules/auth/services/mfa.service.ts:127` |
| `tx.mfaEnrollmentGrant.findUnique` | `backend/src/modules/auth/services/mfa.service.ts:135` |
| `tx.mfaEnrollmentGrant.updateMany` | `backend/src/modules/auth/services/mfa.service.ts:137` |
| `tx.mfaFactor.create` | `backend/src/modules/auth/services/mfa.service.ts:139` |
| `tx.mfaRecoveryCode.createMany` | `backend/src/modules/auth/services/mfa.service.ts:141` |
| `tx.refreshToken.updateMany` | `backend/src/modules/auth/services/mfa.service.ts:142` |
| `tx.user.update` | `backend/src/modules/auth/services/mfa.service.ts:143` |
| `tx.mfaFactor.updateMany` | `backend/src/modules/auth/services/mfa.service.ts:145` |
| `tx.mfaChallenge.updateMany` | `backend/src/modules/auth/services/mfa.service.ts:148` |
| `db.auditLog.count` | `backend/src/modules/auth/services/password-security.ts:17` |
| `db.budget.findUnique` | `backend/src/modules/budgets/repositories/budgets.repository.ts:72` |
| `db.budget.findMany` | `backend/src/modules/budgets/repositories/budgets.repository.ts:79` |
| `db.budget.count` | `backend/src/modules/budgets/repositories/budgets.repository.ts:88` |
| `db.budget.findFirst` | `backend/src/modules/budgets/repositories/budgets.repository.ts:94` |
| `db.budget.create` | `backend/src/modules/budgets/repositories/budgets.repository.ts:102` |
| `db.budget.update` | `backend/src/modules/budgets/repositories/budgets.repository.ts:109` |
| `db.budget.update` | `backend/src/modules/budgets/repositories/budgets.repository.ts:117` |
| `db.budget.updateMany` | `backend/src/modules/budgets/repositories/budgets.repository.ts:128` |
| `db.budget.update` | `backend/src/modules/budgets/repositories/budgets.repository.ts:140` |
| `prisma.auditLog.findMany` | `backend/src/modules/budgets/services/budgets.service.ts:147` |
| `db.complaint.findUnique` | `backend/src/modules/complaints/repositories/complaints.repository.ts:158` |
| `db.complaint.findMany` | `backend/src/modules/complaints/repositories/complaints.repository.ts:170` |
| `db.complaint.count` | `backend/src/modules/complaints/repositories/complaints.repository.ts:183` |
| `db.complaint.findMany` | `backend/src/modules/complaints/repositories/complaints.repository.ts:193` |
| `db.complaint.count` | `backend/src/modules/complaints/repositories/complaints.repository.ts:202` |
| `db.complaint.create` | `backend/src/modules/complaints/repositories/complaints.repository.ts:208` |
| `db.complaint.update` | `backend/src/modules/complaints/repositories/complaints.repository.ts:224` |
| `db.complaintRouting.create` | `backend/src/modules/complaints/repositories/complaints.repository.ts:232` |
| `db.supportingDocument.create` | `backend/src/modules/complaints/repositories/complaints.repository.ts:245` |
| `db.supportingDocument.findUnique` | `backend/src/modules/documents/repositories/documents.repository.ts:6` |
| `fs.stat` | `backend/src/modules/documents/services/documents.service.ts:117` |
| `db.event.findUnique` | `backend/src/modules/events/repositories/events.repository.ts:138` |
| `db.event.findFirst` | `backend/src/modules/events/repositories/events.repository.ts:145` |
| `db.event.findUnique` | `backend/src/modules/events/repositories/events.repository.ts:152` |
| `db.event.findFirst` | `backend/src/modules/events/repositories/events.repository.ts:162` |
| `db.event.findMany` | `backend/src/modules/events/repositories/events.repository.ts:178` |
| `db.event.count` | `backend/src/modules/events/repositories/events.repository.ts:187` |
| `db.event.findMany` | `backend/src/modules/events/repositories/events.repository.ts:193` |
| `db.event.count` | `backend/src/modules/events/repositories/events.repository.ts:202` |
| `db.registration.count` | `backend/src/modules/events/repositories/events.repository.ts:208` |
| `db.event.create` | `backend/src/modules/events/repositories/events.repository.ts:214` |
| `db.event.update` | `backend/src/modules/events/repositories/events.repository.ts:221` |
| `db.eventTeamMember.upsert` | `backend/src/modules/events/repositories/events.repository.ts:229` |
| `db.eventTeamMember.findUnique` | `backend/src/modules/events/repositories/events.repository.ts:256` |
| `db.eventTeamMember.update` | `backend/src/modules/events/repositories/events.repository.ts:262` |
| `db.paymentProof.findFirst` | `backend/src/modules/payments/repositories/payments.repository.ts:133` |
| `db.paymentProof.findUnique` | `backend/src/modules/payments/repositories/payments.repository.ts:143` |
| `db.paymentProof.create` | `backend/src/modules/payments/repositories/payments.repository.ts:154` |
| `db.paymentProof.update` | `backend/src/modules/payments/repositories/payments.repository.ts:170` |
| `db.paymentProof.findMany` | `backend/src/modules/payments/repositories/payments.repository.ts:186` |
| `db.paymentProof.count` | `backend/src/modules/payments/repositories/payments.repository.ts:195` |
| `db.supportingDocument.create` | `backend/src/modules/payments/repositories/payments.repository.ts:201` |
| `db.incomeRecord.create` | `backend/src/modules/payments/repositories/payments.repository.ts:221` |
| `db.incomeRecord.update` | `backend/src/modules/payments/repositories/payments.repository.ts:239` |
| `db.incomeRecord.findMany` | `backend/src/modules/payments/repositories/payments.repository.ts:254` |
| `db.incomeRecord.count` | `backend/src/modules/payments/repositories/payments.repository.ts:266` |
| `db.incomeRecord.findUnique` | `backend/src/modules/payments/repositories/payments.repository.ts:272` |
| `db.$queryRaw` | `backend/src/modules/public/repositories/public.repository.ts:52` |
| `db.publicSummarySnapshot.findMany` | `backend/src/modules/public/repositories/public.repository.ts:57` |
| `db.$queryRaw` | `backend/src/modules/public/repositories/public.repository.ts:63` |
| `db.publicSummarySnapshot.findMany` | `backend/src/modules/public/repositories/public.repository.ts:74` |
| `db.publicSummarySnapshot.count` | `backend/src/modules/public/repositories/public.repository.ts:83` |
| `db.publicSummarySnapshot.findUnique` | `backend/src/modules/public/repositories/public.repository.ts:89` |
| `db.publicSummarySnapshot.findFirst` | `backend/src/modules/public/repositories/public.repository.ts:96` |
| `db.publicSummarySnapshot.findFirst` | `backend/src/modules/public/repositories/public.repository.ts:109` |
| `db.publicSummarySnapshot.update` | `backend/src/modules/public/repositories/public.repository.ts:120` |
| `db.publicSummarySnapshot.create` | `backend/src/modules/public/repositories/public.repository.ts:130` |
| `db.reconciliationReport.findMany` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:62` |
| `db.reconciliationReport.count` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:71` |
| `db.reconciliationReport.findUnique` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:77` |
| `db.reconciliationReport.findFirst` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:84` |
| `db.reconciliationReport.create` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:92` |
| `db.reconciliationReport.update` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:110` |
| `db.reconciliationReport.updateMany` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:122` |
| `db.paymentProof.findMany` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:136` |
| `db.registration.count` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:152` |
| `db.incomeRecord.findMany` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:161` |
| `db.expenseRecord.findMany` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:179` |
| `db.expenseRequest.findMany` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:198` |
| `db.budgetItem.findMany` | `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts:217` |
| `db.registration.findUnique` | `backend/src/modules/registrations/repositories/registrations.repository.ts:20` |
| `db.registration.findFirst` | `backend/src/modules/registrations/repositories/registrations.repository.ts:27` |
| `db.registration.findUnique` | `backend/src/modules/registrations/repositories/registrations.repository.ts:37` |
| `db.registration.findMany` | `backend/src/modules/registrations/repositories/registrations.repository.ts:54` |
| `db.registration.count` | `backend/src/modules/registrations/repositories/registrations.repository.ts:63` |
| `db.registration.findMany` | `backend/src/modules/registrations/repositories/registrations.repository.ts:69` |
| `db.registration.count` | `backend/src/modules/registrations/repositories/registrations.repository.ts:78` |
| `db.registration.create` | `backend/src/modules/registrations/repositories/registrations.repository.ts:84` |
| `db.registration.update` | `backend/src/modules/registrations/repositories/registrations.repository.ts:103` |
| `db.budgetRequest.findUnique` | `backend/src/modules/requests/repositories/requests.repository.ts:120` |
| `db.budgetRequest.findMany` | `backend/src/modules/requests/repositories/requests.repository.ts:127` |
| `db.budgetRequest.count` | `backend/src/modules/requests/repositories/requests.repository.ts:136` |
| `db.budgetRequest.findMany` | `backend/src/modules/requests/repositories/requests.repository.ts:147` |
| `db.budgetRequest.count` | `backend/src/modules/requests/repositories/requests.repository.ts:163` |
| `db.budgetRequest.create` | `backend/src/modules/requests/repositories/requests.repository.ts:177` |
| `db.budgetRequest.update` | `backend/src/modules/requests/repositories/requests.repository.ts:195` |
| `db.budgetRequest.update` | `backend/src/modules/requests/repositories/requests.repository.ts:207` |
| `db.expenseRequest.findUnique` | `backend/src/modules/requests/repositories/requests.repository.ts:215` |
| `db.expenseRequest.findMany` | `backend/src/modules/requests/repositories/requests.repository.ts:222` |
| `db.expenseRequest.count` | `backend/src/modules/requests/repositories/requests.repository.ts:231` |
| `db.expenseRequest.findMany` | `backend/src/modules/requests/repositories/requests.repository.ts:242` |
| `db.expenseRequest.count` | `backend/src/modules/requests/repositories/requests.repository.ts:258` |
| `db.expenseRequest.create` | `backend/src/modules/requests/repositories/requests.repository.ts:272` |
| `db.expenseRequest.update` | `backend/src/modules/requests/repositories/requests.repository.ts:291` |
| `db.expenseRequest.update` | `backend/src/modules/requests/repositories/requests.repository.ts:303` |
| `db.supportingDocument.deleteMany` | `backend/src/modules/requests/repositories/requests.repository.ts:311` |
| `db.supportingDocument.create` | `backend/src/modules/requests/repositories/requests.repository.ts:317` |
| `db.expenseRecord.create` | `backend/src/modules/requests/repositories/requests.repository.ts:339` |
| `db.expenseRecord.findMany` | `backend/src/modules/requests/repositories/requests.repository.ts:359` |
| `db.expenseRecord.count` | `backend/src/modules/requests/repositories/requests.repository.ts:368` |
| `db.expenseRecord.findUnique` | `backend/src/modules/requests/repositories/requests.repository.ts:374` |
| `db.expenseRecord.update` | `backend/src/modules/requests/repositories/requests.repository.ts:385` |
| `db.role.findMany` | `backend/src/modules/roles/repositories/roles.repository.ts:10` |
| `db.role.upsert` | `backend/src/modules/roles/repositories/roles.repository.ts:18` |
| `db.role.findMany` | `backend/src/modules/roles/repositories/roles.repository.ts:36` |
| `db.role.count` | `backend/src/modules/roles/repositories/roles.repository.ts:43` |
| `db.role.findUnique` | `backend/src/modules/roles/repositories/roles.repository.ts:47` |
| `db.userRole.findFirst` | `backend/src/modules/roles/repositories/roles.repository.ts:53` |
| `db.userRole.create` | `backend/src/modules/roles/repositories/roles.repository.ts:70` |
| `db.userRole.findMany` | `backend/src/modules/roles/repositories/roles.repository.ts:85` |
| `db.userRole.count` | `backend/src/modules/roles/repositories/roles.repository.ts:100` |
| `db.userRole.findUnique` | `backend/src/modules/roles/repositories/roles.repository.ts:109` |
| `db.userRole.update` | `backend/src/modules/roles/repositories/roles.repository.ts:120` |
| `tx.user.count` | `backend/src/modules/roles/services/roles.service.ts:170` |
| `db.user.count` | `backend/src/modules/users/repositories/users.repository.ts:10` |
| `db.user.create` | `backend/src/modules/users/repositories/users.repository.ts:26` |
| `db.user.findUnique` | `backend/src/modules/users/repositories/users.repository.ts:32` |
| `db.user.findUnique` | `backend/src/modules/users/repositories/users.repository.ts:39` |
| `db.user.findUnique` | `backend/src/modules/users/repositories/users.repository.ts:46` |
| `db.user.findMany` | `backend/src/modules/users/repositories/users.repository.ts:53` |
| `db.user.update` | `backend/src/modules/users/repositories/users.repository.ts:61` |
| `db.user.update` | `backend/src/modules/users/repositories/users.repository.ts:69` |
| `db.user.update` | `backend/src/modules/users/repositories/users.repository.ts:73` |
| `db.user.update` | `backend/src/modules/users/repositories/users.repository.ts:81` |
| `db.user.update` | `backend/src/modules/users/repositories/users.repository.ts:89` |
| `tx.user.count` | `backend/src/modules/users/services/users.service.ts:148` |
| `fs.mkdir` | `backend/src/storage/adapters/local-storage.adapter.ts:15` |
| `fs.writeFile` | `backend/src/storage/adapters/local-storage.adapter.ts:21` |
| `fs.rm` | `backend/src/storage/adapters/local-storage.adapter.ts:33` |
| `db.user.findUnique` | `backend/src/utils/authenticated-session-context.ts:16` |
| `db.refreshToken.findUnique` | `backend/src/utils/authenticated-session-context.ts:17` |
| `db.eventTeamMember.findMany` | `backend/src/utils/event-team.ts:18` |
| `tx.financialIdempotency.findUnique` | `backend/src/utils/financial-idempotency.ts:47` |
| `tx.financialIdempotency.create` | `backend/src/utils/financial-idempotency.ts:58` |
| `tx.user.count` | `backend/src/utils/governance-transaction.ts:18` |
| `prisma.$transaction` | `backend/src/utils/governance-transaction.ts:47` |
| `tx.role.upsert` | `backend/src/utils/local-seed.ts:10` |
| `tx.user.findUnique` | `backend/src/utils/local-seed.ts:13` |
| `tx.userRole.count` | `backend/src/utils/local-seed.ts:23` |
| `tx.user.create` | `backend/src/utils/local-seed.ts:26` |
| `tx.user.count` | `backend/src/utils/local-seed.ts:37` |
| `tx.event.findUnique` | `backend/src/utils/local-seed.ts:38` |
| `tx.event.create` | `backend/src/utils/local-seed.ts:41` |
| `tx.user.create` | `backend/src/utils/local-seed.ts:44` |
| `tx.eventTeamMember.create` | `backend/src/utils/local-seed.ts:45` |
| `tx.event.update` | `backend/src/utils/local-seed.ts:47` |
| `db.user.count` | `backend/src/utils/local-seed.ts:59` |
| `db.event.count` | `backend/src/utils/local-seed.ts:60` |
| `tx.user.create` | `backend/src/utils/local-seed.ts:67` |

Frontend HTML sinks span the 39 page files above and shared components. Explicit non-React sinks are API `fetch` (`frontend/src/lib/api/client.ts`, `server.ts`), static font `fetch`, `doc.text`/`markContent`/generated `addContent`, and local Blob download (`frontend/src/lib/pdf.ts`, `:50`, `:53`, `:60`, `:69`). No arbitrary user URL is used for renderer asset fetching.

## Explicit browser network, PDF and DOM sinks

React escapes page/component text and attributes. The explicit sinks below consume configured API paths, fixed font paths, generated drawing commands or local PDF Blob URLs; the calling forms/API helpers remain in the source index.

| Sink | Current source |
| --- | --- |
| `fetch` | `frontend/src/lib/api/client.ts:15` |
| `fetch` | `frontend/src/lib/api/client.ts:18` |
| `fetch` | `frontend/src/lib/api/client.ts:69` |
| `fetch` | `frontend/src/lib/api/server.ts:38` |
| `fetch` | `frontend/src/lib/pdf.ts:12` |
| `doc.registerFont` | `frontend/src/lib/pdf.ts:26` |
| `doc.registerFont` | `frontend/src/lib/pdf.ts:27` |
| `doc.registerFont` | `frontend/src/lib/pdf.ts:28` |
| `doc.registerFont` | `frontend/src/lib/pdf.ts:29` |
| `doc.markContent` | `frontend/src/lib/pdf.ts:51` |
| `URL.createObjectURL` | `frontend/src/lib/pdf.ts:69` |
| `document.body.appendChild` | `frontend/src/lib/pdf.ts:73` |
| `URL.revokeObjectURL` | `frontend/src/lib/pdf.ts:77` |

## Complete application source coverage index

- `backend/src/app.ts`
- `backend/src/config/auth.ts`
- `backend/src/config/cors.ts`
- `backend/src/config/env.ts`
- `backend/src/config/load-env.ts`
- `backend/src/config/mailer.ts`
- `backend/src/config/prisma.ts`
- `backend/src/config/rate-limit.ts`
- `backend/src/config/uploads.ts`
- `backend/src/middlewares/authenticate-refresh-session.ts`
- `backend/src/middlewares/authenticate.ts`
- `backend/src/middlewares/authorize.ts`
- `backend/src/middlewares/error-handler.ts`
- `backend/src/middlewares/local-bootstrap.ts`
- `backend/src/middlewares/not-found.ts`
- `backend/src/middlewares/resource-admission.ts`
- `backend/src/middlewares/sensitive-action-limits.ts`
- `backend/src/middlewares/upload-guard.ts`
- `backend/src/middlewares/validate-request.ts`
- `backend/src/modules/approvals/approvals.mappers.ts`
- `backend/src/modules/approvals/controllers/approvals.controller.ts`
- `backend/src/modules/approvals/index.ts`
- `backend/src/modules/approvals/repositories/approvals.repository.ts`
- `backend/src/modules/approvals/routes/approvals.routes.ts`
- `backend/src/modules/approvals/services/approvals.service.ts`
- `backend/src/modules/approvals/types/approvals.types.ts`
- `backend/src/modules/approvals/validations/approvals.validation.ts`
- `backend/src/modules/audit/controllers/audit.controller.ts`
- `backend/src/modules/audit/index.ts`
- `backend/src/modules/audit/repositories/audit.repository.ts`
- `backend/src/modules/audit/routes/audit.routes.ts`
- `backend/src/modules/audit/services/audit.service.ts`
- `backend/src/modules/audit/types/audit.types.ts`
- `backend/src/modules/audit/validations/audit.validation.ts`
- `backend/src/modules/auth/controllers/auth.controller.ts`
- `backend/src/modules/auth/index.ts`
- `backend/src/modules/auth/repositories/auth.repository.ts`
- `backend/src/modules/auth/routes/auth.routes.ts`
- `backend/src/modules/auth/services/auth-session.ts`
- `backend/src/modules/auth/services/auth.service.ts`
- `backend/src/modules/auth/services/mfa.service.ts`
- `backend/src/modules/auth/services/password-security.ts`
- `backend/src/modules/auth/types/auth.types.ts`
- `backend/src/modules/auth/validations/auth.validation.ts`
- `backend/src/modules/budgets/budgets.mappers.ts`
- `backend/src/modules/budgets/controllers/budgets.controller.ts`
- `backend/src/modules/budgets/index.ts`
- `backend/src/modules/budgets/repositories/budgets.repository.ts`
- `backend/src/modules/budgets/routes/budgets.routes.ts`
- `backend/src/modules/budgets/services/budgets.service.ts`
- `backend/src/modules/budgets/types/budgets.types.ts`
- `backend/src/modules/budgets/validations/budgets.validation.ts`
- `backend/src/modules/complaints/complaints.mappers.ts`
- `backend/src/modules/complaints/controllers/complaints.controller.ts`
- `backend/src/modules/complaints/index.ts`
- `backend/src/modules/complaints/repositories/complaints.repository.ts`
- `backend/src/modules/complaints/routes/complaints.routes.ts`
- `backend/src/modules/complaints/services/complaints.service.ts`
- `backend/src/modules/complaints/types/complaints.types.ts`
- `backend/src/modules/complaints/validations/complaints.validation.ts`
- `backend/src/modules/documents/controllers/documents.controller.ts`
- `backend/src/modules/documents/index.ts`
- `backend/src/modules/documents/repositories/documents.repository.ts`
- `backend/src/modules/documents/routes/documents.routes.ts`
- `backend/src/modules/documents/services/documents.service.ts`
- `backend/src/modules/documents/validations/documents.validation.ts`
- `backend/src/modules/events/controllers/events.controller.ts`
- `backend/src/modules/events/events.mappers.ts`
- `backend/src/modules/events/index.ts`
- `backend/src/modules/events/repositories/events.repository.ts`
- `backend/src/modules/events/routes/events.routes.ts`
- `backend/src/modules/events/services/events.service.ts`
- `backend/src/modules/events/types/events.types.ts`
- `backend/src/modules/events/validations/events.validation.ts`
- `backend/src/modules/payments/controllers/payments.controller.ts`
- `backend/src/modules/payments/index.ts`
- `backend/src/modules/payments/payments.mappers.ts`
- `backend/src/modules/payments/repositories/payments.repository.ts`
- `backend/src/modules/payments/routes/payments.routes.ts`
- `backend/src/modules/payments/services/payments.service.ts`
- `backend/src/modules/payments/types/payments.types.ts`
- `backend/src/modules/payments/validations/payments.validation.ts`
- `backend/src/modules/public/controllers/public.controller.ts`
- `backend/src/modules/public/index.ts`
- `backend/src/modules/public/public.mappers.ts`
- `backend/src/modules/public/repositories/public.repository.ts`
- `backend/src/modules/public/routes/public.routes.ts`
- `backend/src/modules/public/services/public.service.ts`
- `backend/src/modules/public/types/public.types.ts`
- `backend/src/modules/public/validations/public.validation.ts`
- `backend/src/modules/reconciliation/controllers/reconciliation.controller.ts`
- `backend/src/modules/reconciliation/index.ts`
- `backend/src/modules/reconciliation/reconciliation.mappers.ts`
- `backend/src/modules/reconciliation/repositories/reconciliation.repository.ts`
- `backend/src/modules/reconciliation/routes/reconciliation.routes.ts`
- `backend/src/modules/reconciliation/services/reconciliation.service.ts`
- `backend/src/modules/reconciliation/types/reconciliation.types.ts`
- `backend/src/modules/reconciliation/validations/reconciliation.validation.ts`
- `backend/src/modules/registrations/controllers/registrations.controller.ts`
- `backend/src/modules/registrations/index.ts`
- `backend/src/modules/registrations/registrations.mappers.ts`
- `backend/src/modules/registrations/repositories/registrations.repository.ts`
- `backend/src/modules/registrations/routes/registrations.routes.ts`
- `backend/src/modules/registrations/services/registrations.service.ts`
- `backend/src/modules/registrations/types/registrations.types.ts`
- `backend/src/modules/registrations/validations/registrations.validation.ts`
- `backend/src/modules/requests/controllers/requests.controller.ts`
- `backend/src/modules/requests/index.ts`
- `backend/src/modules/requests/repositories/requests.repository.ts`
- `backend/src/modules/requests/requests.mappers.ts`
- `backend/src/modules/requests/routes/requests.routes.ts`
- `backend/src/modules/requests/services/requests.service.ts`
- `backend/src/modules/requests/types/requests.types.ts`
- `backend/src/modules/requests/validations/requests.validation.ts`
- `backend/src/modules/roles/controllers/roles.controller.ts`
- `backend/src/modules/roles/index.ts`
- `backend/src/modules/roles/repositories/roles.repository.ts`
- `backend/src/modules/roles/role-catalog.ts`
- `backend/src/modules/roles/routes/roles.routes.ts`
- `backend/src/modules/roles/services/roles.service.ts`
- `backend/src/modules/roles/types/roles.types.ts`
- `backend/src/modules/roles/validations/roles.validation.ts`
- `backend/src/modules/users/controllers/users.controller.ts`
- `backend/src/modules/users/index.ts`
- `backend/src/modules/users/repositories/users.repository.ts`
- `backend/src/modules/users/routes/users.routes.ts`
- `backend/src/modules/users/services/users.service.ts`
- `backend/src/modules/users/types/users.types.ts`
- `backend/src/modules/users/users.mappers.ts`
- `backend/src/modules/users/validations/users.validation.ts`
- `backend/src/routes/index.ts`
- `backend/src/server.ts`
- `backend/src/storage/adapters/local-storage.adapter.ts`
- `backend/src/storage/index.ts`
- `backend/src/storage/types/storage-provider.ts`
- `backend/src/types/auth.ts`
- `backend/src/types/database.ts`
- `backend/src/types/express.d.ts`
- `backend/src/utils/app-error.ts`
- `backend/src/utils/async-handler.ts`
- `backend/src/utils/audit-metadata.ts`
- `backend/src/utils/authenticated-session-context.ts`
- `backend/src/utils/clamd-stream.ts`
- `backend/src/utils/duration.ts`
- `backend/src/utils/event-scope.ts`
- `backend/src/utils/event-team.ts`
- `backend/src/utils/financial-idempotency.ts`
- `backend/src/utils/governance-transaction.ts`
- `backend/src/utils/hash.ts`
- `backend/src/utils/local-seed-policy.ts`
- `backend/src/utils/local-seed.ts`
- `backend/src/utils/mfa-crypto.ts`
- `backend/src/utils/money-validation.ts`
- `backend/src/utils/normalize-email.ts`
- `backend/src/utils/pagination-validation.ts`
- `backend/src/utils/pagination.ts`
- `backend/src/utils/password-validation.ts`
- `backend/src/utils/password.ts`
- `backend/src/utils/request-metadata.ts`
- `backend/src/utils/role-checks.ts`
- `backend/src/utils/security-logging.ts`
- `backend/src/utils/slugify.ts`
- `backend/src/utils/smtp-security.ts`
- `backend/src/utils/text-utils.ts`
- `backend/src/utils/tokens.ts`
- `backend/src/utils/upload-scanner.ts`
- `backend/src/utils/upload-utils.ts`
- `frontend/src/app/complaints/loading.tsx`
- `frontend/src/app/complaints/new/page.tsx`
- `frontend/src/app/complaints/page.tsx`
- `frontend/src/app/dashboard/(system)/approvals/page.tsx`
- `frontend/src/app/dashboard/(system)/audit/page.tsx`
- `frontend/src/app/dashboard/(system)/budget-requests/page.tsx`
- `frontend/src/app/dashboard/(system)/budgets/page.tsx`
- `frontend/src/app/dashboard/(system)/complaints/page.tsx`
- `frontend/src/app/dashboard/(system)/controls/page.tsx`
- `frontend/src/app/dashboard/(system)/events/page.tsx`
- `frontend/src/app/dashboard/(system)/expense-records/page.tsx`
- `frontend/src/app/dashboard/(system)/expense-requests/page.tsx`
- `frontend/src/app/dashboard/(system)/income-records/page.tsx`
- `frontend/src/app/dashboard/(system)/layout.tsx`
- `frontend/src/app/dashboard/(system)/page.tsx`
- `frontend/src/app/dashboard/(system)/payments/page.tsx`
- `frontend/src/app/dashboard/(system)/publications/page.tsx`
- `frontend/src/app/dashboard/(system)/reconciliation/page.tsx`
- `frontend/src/app/dashboard/(system)/users/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/approvals/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/budget-requests/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/budgets/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/complaints/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/expense-records/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/expense-requests/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/funding-requests/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/income-records/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/layout.tsx`
- `frontend/src/app/dashboard/events/[slug]/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/payments/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/publications/page.tsx`
- `frontend/src/app/dashboard/events/[slug]/reconciliation/page.tsx`
- `frontend/src/app/dashboard/layout.tsx`
- `frontend/src/app/dashboard/loading.tsx`
- `frontend/src/app/dashboard/my-events/page.tsx`
- `frontend/src/app/error.tsx`
- `frontend/src/app/events/[eventLookup]/page.tsx`
- `frontend/src/app/events/[eventLookup]/register/page.tsx`
- `frontend/src/app/events/loading.tsx`
- `frontend/src/app/events/page.tsx`
- `frontend/src/app/financial-summaries/[eventLookup]/page.tsx`
- `frontend/src/app/financial-summaries/loading.tsx`
- `frontend/src/app/financial-summaries/page.tsx`
- `frontend/src/app/global-error.tsx`
- `frontend/src/app/layout.tsx`
- `frontend/src/app/loading.tsx`
- `frontend/src/app/not-found.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/registrations/[registrationId]/page.tsx`
- `frontend/src/app/registrations/[registrationId]/payment-proof/page.tsx`
- `frontend/src/app/registrations/loading.tsx`
- `frontend/src/app/reset-password/page.tsx`
- `frontend/src/components/auth/mfa-access-panel.tsx`
- `frontend/src/components/foundation/controls-showcase.tsx`
- `frontend/src/components/internal/account-actions.tsx`
- `frontend/src/components/internal/action-utils.tsx`
- `frontend/src/components/internal/approvals-actions.tsx`
- `frontend/src/components/internal/budget-pdf-download-button.tsx`
- `frontend/src/components/internal/budgets-actions.tsx`
- `frontend/src/components/internal/complaint-routing-card.tsx`
- `frontend/src/components/internal/complaints-actions.tsx`
- `frontend/src/components/internal/decision-history-card.tsx`
- `frontend/src/components/internal/event-team-access-panel.tsx`
- `frontend/src/components/internal/events-actions.tsx`
- `frontend/src/components/internal/filter-card.tsx`
- `frontend/src/components/internal/internal-access-panel.tsx`
- `frontend/src/components/internal/internal-session-card.tsx`
- `frontend/src/components/internal/mfa-enrollment-authorization.tsx`
- `frontend/src/components/internal/payments-actions.tsx`
- `frontend/src/components/internal/reconciliation-actions.tsx`
- `frontend/src/components/internal/requests-actions.tsx`
- `frontend/src/components/internal/supporting-document-list.tsx`
- `frontend/src/components/providers/role-preview-provider.tsx`
- `frontend/src/components/providers/session-recovery.tsx`
- `frontend/src/components/public/expense-budget-actual-chart.tsx`
- `frontend/src/components/public/income-pie-chart.tsx`
- `frontend/src/components/public/public-event-card.tsx`
- `frontend/src/components/public/public-summary-card.tsx`
- `frontend/src/components/public/summary-breakdown-chart.tsx`
- `frontend/src/components/public/summary-pdf-download-button.tsx`
- `frontend/src/components/shell/access-layout.tsx`
- `frontend/src/components/shell/app-logo.tsx`
- `frontend/src/components/shell/dashboard-header.tsx`
- `frontend/src/components/shell/dashboard-shell.tsx`
- `frontend/src/components/shell/dashboard-sidebar.tsx`
- `frontend/src/components/shell/event-dashboard-header.tsx`
- `frontend/src/components/shell/event-dashboard-shell.tsx`
- `frontend/src/components/shell/event-dashboard-sidebar.tsx`
- `frontend/src/components/shell/public-footer.tsx`
- `frontend/src/components/shell/public-header.tsx`
- `frontend/src/components/shell/public-page-shell.tsx`
- `frontend/src/components/shell/role-preview-switcher.tsx`
- `frontend/src/components/shell/workspace-sidebar.tsx`
- `frontend/src/components/student/complaint-form.tsx`
- `frontend/src/components/student/complaint-update-summary.tsx`
- `frontend/src/components/student/logout-button.tsx`
- `frontend/src/components/student/participation-steps.tsx`
- `frontend/src/components/student/payment-proof-form.tsx`
- `frontend/src/components/student/registration-form.tsx`
- `frontend/src/components/student/student-access-panel.tsx`
- `frontend/src/components/student/student-session-card.tsx`
- `frontend/src/components/ui/badge.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/card.tsx`
- `frontend/src/components/ui/field.tsx`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/ui/list-pagination.tsx`
- `frontend/src/components/ui/loading-state.tsx`
- `frontend/src/components/ui/metric-card.tsx`
- `frontend/src/components/ui/page-header.tsx`
- `frontend/src/components/ui/password-input.tsx`
- `frontend/src/components/ui/segmented-control.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/ui/skeleton.tsx`
- `frontend/src/components/ui/state-panel.tsx`
- `frontend/src/components/ui/table.tsx`
- `frontend/src/components/ui/textarea.tsx`
- `frontend/src/features/foundation/data/demo-content.ts`
- `frontend/src/lib/access.ts`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/api/financial-submission.ts`
- `frontend/src/lib/api/internal.ts`
- `frontend/src/lib/api/list.ts`
- `frontend/src/lib/api/public.ts`
- `frontend/src/lib/api/server.ts`
- `frontend/src/lib/api/shared.ts`
- `frontend/src/lib/api/student.ts`
- `frontend/src/lib/charts.ts`
- `frontend/src/lib/detail-query.ts`
- `frontend/src/lib/format.ts`
- `frontend/src/lib/navigation.tsx`
- `frontend/src/lib/pdf.ts`
- `frontend/src/lib/public-summary.ts`
- `frontend/src/lib/reset-token.ts`
- `frontend/src/lib/security/browser-policy.ts`
- `frontend/src/lib/session.ts`
- `frontend/src/lib/utils.ts`
- `frontend/src/proxy.ts`
- `frontend/src/types/index.ts`

## Sensitive-action and cancellation boundaries

Verified authentication supplies the account key for shared operational/admin mutation quotas; auth/recovery retain their dedicated budgets. Protected opens and report generation have separate quotas. One aggregation job runs per process; two upload leases retain capacity until controller work settles even after client cancellation. These are per-process controls, not a shared multi-instance guarantee (`backend/src/middlewares/sensitive-action-limits.ts`, `resource-admission.ts`, `utils/async-handler.ts`).
