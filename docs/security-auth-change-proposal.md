# Authentication changes requiring approval

Prepared on the security branch from `816d7d6`, 2026-10-11. No authentication behavior or database schema has been changed by this proposal. The user's security-audit rules require approval before authentication changes or migrations.

## Confirmed source evidence

- Privileged sign-in verifies a password and immediately issues a full session, with no second factor: `backend/src/modules/auth/services/auth.service.ts:221` and `:247`. The ordinary Student ID sign-in at `:197` can also authenticate an account with privileged assignments, so adding MFA only to the two internal login routes would be bypassable.
- An authenticated session can change its recovery email without password reauthentication or email verification: the update route is `backend/src/modules/auth/routes/auth.routes.ts:70`; the service is `backend/src/modules/auth/services/auth.service.ts:484`.
- Failed-login limits are per IP only: `backend/src/config/rate-limit.ts:18`. Distributed sources can each spend a separate password-guess budget.
- Bootstrap is blocked in production but unauthenticated on an empty development/staging database: `backend/src/modules/auth/services/auth.service.ts:87`. It must be explicitly enabled by the operator and restricted to local bootstrap.
- Legacy access tokens without a bound session remain accepted: `backend/src/middlewares/authenticate.ts:46`. Removing this compatibility intentionally expires those sessions.

These are source-confirmed controls/gaps. Compromise of a real account, exposure of a real staging database, or production exploitation has not been attempted or claimed.

## Proposed change

The user approved this proposal and the additive local migration on 2026-10-11. Its implementation and isolated API/browser verification are complete on the review branch; main and production remain unchanged. Privileged real-account enrollment remains a supervised operator handoff, not an automatic fixture action.

1. Require authenticator-code MFA for System Admin and every active event operational account, regardless of which login endpoint they use. Enforce assurance again in backend authentication, so role promotion, student login and refresh cannot bypass it.
2. Add nullable MFA/session-assurance fields and dedicated short-lived challenge/recovery-code records through an additive local migration. Preserve existing users, money, documents, revision history and team assignments. Existing privileged accounts must enroll before receiving operational access.
3. Use a maintained TOTP library. Encrypt enrolled/pending factor secrets with Node's authenticated AES-256-GCM API and a separate 32-byte environment key; store only hashes of random recovery codes. Never place secrets or codes in logs. Enrollment proves a current authenticator code; authentication/recovery challenges expire, limit attempts, are single-use and consume counters/codes atomically with session/audit writes.
4. Keep password-reset email from disabling/replacing MFA. Recovery codes are single-use. Initial enrollment and a lost-factor reset require a documented, supervised identity check; a stolen password must not silently remove an enrolled factor.
5. Require the current password when changing a recovery email; bound the address and invalidate other sessions/reset links atomically. Privileged callers must also have verified MFA. The UI will explain the reauthentication and resulting sign-in requirement.
6. Add identity-based failed-login limiting alongside the IP limit, fixed-cost dummy password verification for unknown identities, an explicitly enabled local bootstrap, and deny unbound legacy access tokens. These intentionally change authentication edge behavior, not event authorization rules.

## Local rollout and verification

- Generate the separate local MFA encryption key into an ignored environment file without displaying it. Production/staging keys must be supplied separately by the operator; this audit never changes production.
- Stop the local backend before Prisma client generation. Apply only the new additive migration to the verified local database after approval. No reseeding or historical record deletion.
- Test password-only privileged access denial, alternate-login/refresh/role-promotion bypasses, incorrect/expired/replayed codes and tickets, concurrent ticket/code consumption, recovery and email-change reauthentication, and valid enrollment/sign-in in the browser.
- Run the existing audit, event-isolation, financial, client/PDF/UI and browser workspace suites with the new authentication behavior. Record any legacy-fixture adaptations explicitly.

## Residual risk

TOTP can be phished; passkeys/security keys are the stronger subsequent option. Enrollment, time synchronization, offline recovery-code custody, secret-key rotation, external monitoring, and privileged-account onboarding remain operational responsibilities. Approval of this proposal is not approval to deploy or modify production data.
