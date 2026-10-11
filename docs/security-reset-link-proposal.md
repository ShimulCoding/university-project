# Approved reset-link transport change

## Evidence (SEC-26)

At `dfff62e`, `backend/src/modules/auth/services/auth.service.ts:253` adds the raw recovery capability to the URL query, and `frontend/src/app/reset-password/page.tsx:19` reads that query. The installed Next development logger reproduced the raw query in captured synthetic stdout; `node_modules/next/dist/server/dev/next-dev-server.js:377` also attaches `req.url` to a trace span regardless of the stdout logging setting. Actual trace-file/edge-log configuration is unverified. No real reset token or production request was used.

## Proposed change

- Generate new reset links as `/reset-password#token=...`. Browser URL fragments are not part of the HTTP request, keeping the new capability out of frontend/proxy request URLs and framework URL traces.
- Read the fragment only in the client after hydration, with stable subscription/neutral loading state. Submit the capability to the existing reset API in its JSON body over the configured HTTPS deployment. Do not store it in local/session storage or print it.
- Preserve unexpired legacy query links and existing single-use/expiry/session-revocation/MFA-preservation behavior. Legacy query links may remain in external/framework traces until their one-hour validity ends; request-log suppression is additional protection, not a claim that every external log was cleaned.
- Add negative transport/parser tests and actual browser checks for fragment reset success, no capability in GET URLs, legacy compatibility, expired/used tokens and hydration. No migration, real mailbox delivery, existing-account reset or production action.

The user approved this authentication recovery change. The reset form and its legitimate flow remain the same, and existing issued links are not invalidated automatically. Third-party email tracking, browser extensions/history and actual deployment logging remain operator/human-test boundaries.

## Implementation and verification (2026-10-12)

New links use the fragment at `backend/src/modules/auth/services/auth.service.ts:255`. `frontend/src/app/reset-password/page.tsx:30` reads it with React's browser subscription and a neutral server/hydration state; `frontend/src/lib/reset-token.ts:4` rejects ambiguous/empty/oversized fragments and retains legacy query compatibility. The form is keyed to the capability so switching links clears stale input, errors and success state. No browser storage is used.

- `verify:reset-token`: 16 hydration, fragment, legacy, precedence, ambiguity and bounds checks pass.
- `verify:security-reset-browser`: 91 isolated service/API/actual Edge/design checks pass against the built frontend and an isolated loopback API. The mailer is replaced with a private in-process capture; only disposable fixture accounts are reset. Checks cover successful fragment reset, no new capability in GET URLs, session/version invalidation, single use, expiry, unknown/missing/ambiguous capabilities, hash subscription, form-state isolation, legacy success and hydration.
- MFA (71), recovery-email (26), TLS transport (35), project audit (81), frontend client/financial/PDF/UI/CSP/logging, lint, types and both builds pass. The new browser script also passes strict standalone type checking.

The first replay test navigated to the identical fragment without creating a new browser document; it was corrected to reload explicitly before re-attacking the used link. Changing to a different capability is tested without reload. No real mail, existing-account change, trace cleanup, migration or deployment occurred. Existing query links remain log-sensitive for their remaining validity; the approved compatibility requirement intentionally preserves them.
