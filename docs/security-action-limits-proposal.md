# Approved sensitive-action limits

The user approved the documented quotas and local verification on 2026-10-12. No production action or existing-data change is authorized.

## Reproduced gap (SEC-21, Medium)

At `6b42ee6`, `backend/src/modules/reconciliation/routes/reconciliation.routes.ts:33` has no generation budget or admission cap; `reconciliation.service.ts:390` loads the event ledger and creates a new report/audit per call. Six rapid, properly authenticated local fixture requests all returned 201 and created six reports. This demonstrates unbounded repeat admission, not measured production exhaustion. Only this run's fixtures were removed.

`backend/src/modules/documents/routes/documents.routes.ts:13` has no download budget. `backend/src/middlewares/authenticate.ts:19` authenticates operational and administrative mutations without a shared action budget. Existing login/MFA/session/upload limits remain valuable but do not cover those paths. A compromised assigned account can repeatedly consume database/aggregation/streaming resources within its legitimate data scope.

## Proposed implementation

- Use the existing `express-rate-limit` library: a shared authenticated mutation allowance of **240 requests per account per 15 minutes**; protected evidence **120 opens per account per 15 minutes**; report generation **5 per account per 15 minutes**.
- Keep login/MFA/recovery/refresh/logout on their existing dedicated budgets. The shared mutation budget applies after successful authentication to POST/PATCH/PUT/DELETE; authentication/account recovery remain reachable to restore access.
- Admit **one report-generation job at a time per backend process**, with release exactly once when its work settles and a retryable busy response. A client disconnect does not cancel an active Prisma transaction: keep its slot until completion. Preserve the existing two-upload admission limit and likewise retain a disconnected controller's lease while it still holds buffers/scanner/storage work. Unauthorized event ownership is still checked by the service and again inside governance transactions.
- Return standard rate-limit/retry headers and controlled 429/503 feedback. Test exhaustion, independent actors, read-only navigation, expiry, failed requests, completion/cancellation and denied calls before aggregation/streaming. Re-run financial/browser/governance regressions.

This intentionally changes excessive-request behavior, so the user's security rules require approval. No migration, new external service, existing-data change or production action is proposed. These quotas are per process; any multi-instance deployment must use a shared rate-limit store/edge budgets and load testing before claiming distributed protection. Legitimate bulk-operation needs must be reviewed against these documented allowances.

## Implementation verification

`verify:security-action-limits` passes 32 local quota/expiry/identity/admission/cancellation/API checks. The real API admits five reports and rejects the sixth without a new record, admits 120 owned document opens and denies the next before authorization/streaming, and denies a mutation after 240 attempts even with a spoofed identity header. Independent accounts, read navigation, auth recovery and expired windows remain available. Full backend security/finance/governance/event-scope/project-audit suites and frontend checks pass. The upload cancellation root fix has its own review in `security-upload-lifecycle-review.md`.
