# Local security review — 2026-10-11

Base: `816d7d6`. Review branch: `security/local-hardening-2026-10-11`. The user explicitly chose review-branch pushes; main remains unchanged. This is a local audit, not a production deployment or a claim of invulnerability.

## Scope and method

The complete entry-point inventory is in [security-entry-point-map.md](security-entry-point-map.md): 88 HTTP endpoints, 39 page routes, 22 Prisma models and 163 database/filesystem call sites. Authentication changes requiring the user's approval are described in [security-auth-change-proposal.md](security-auth-change-proposal.md). Only loopback PostgreSQL and isolated fixtures are used. Existing records are not reseeded.

Evidence locations below refer to the base commit unless explicitly marked current. Findings are source-confirmed; production exposure is unverified. The report will be updated as each fix is verified.

## Findings

| ID | Severity | Evidence | Attack / consequence | Fix and status |
| --- | --- | --- | --- | --- |
| SEC-01 | High | `backend/src/app.ts:21`; `backend/src/middlewares/error-handler.ts:57`; `backend/src/config/prisma.ts:14`; `backend/src/config/mailer.ts:25,73`; `backend/src/server.ts:39` | Queries and arbitrary error text enter logs. Development email preview URLs confer access to recovery-email contents; a log reader could recover confidential values. | **Fixed:** structured route-template/status/request-reference logs, no raw query/path/body/exception/Prisma text, no mail preview/account logging. Synthetic negative test reproduced the baseline leak and passes after the fix. |
| SEC-02 | High | `backend/src/modules/auth/services/auth.service.ts:197,221,247`; `backend/src/middlewares/authenticate.ts:46` | A stolen privileged password receives a full session without MFA. Student-ID login is another route to the same account, so endpoint-only MFA would be bypassable. | **Fixed locally, approved:** mandatory MFA across every login path, refresh and protected API; deny unbound sessions. Supervised, one-use enrollment grants prevent a stolen password enrolling an attacker's factor. Encrypted TOTP, one-use hashed recovery codes, shared failure budgets and atomic consumption/session/audit writes. Enrolled factors survive demotion and password reset. Additive local migration only; staging/production rollout pending. |
| SEC-03 | High | `backend/src/modules/auth/routes/auth.routes.ts:70`; `backend/src/modules/auth/services/auth.service.ts:484` | A stolen live session can change the recovery email without proving the password. Subsequent recovery can extend account takeover. | **Fixed locally, approved:** current-password reauthentication, live session/version/status/credential/MFA recheck inside the write transaction, bounded email input, and atomic revocation of all sessions, old reset links, pending MFA tickets and enrollment grants with the audit write. Cookies expire and the user signs in again. Institutional mailbox identity policy remains unverified; the change does not claim university identity verification. |
| SEC-04 | High | `backend/src/modules/payments/routes/payments.routes.ts:34`; `backend/src/modules/payments/services/payments.service.ts:98`; `backend/src/modules/requests/routes/requests.routes.ts:63,69,103,109` | Authenticated callers reach multipart memory allocation and file persistence before event/record authorization. Concurrent 15-file requests can exhaust resources even when the final action is forbidden. | **Fixed:** role/record preflight before multipart; services preflight before storage and retain transaction rechecks; all upload routes share a two-request admission cap and 30 submissions/account/15 minutes. Existing 15-file/size allowances remain. Distributed flooding and aggregate disk quotas remain operational risks. |
| SEC-05 | High (development) | `package-lock.json`, npm audit dependency paths: `braces` → `micromatch` / `chokidar` → Tailwind / ESLint | Malicious glob input can trigger the upstream stack-exhaustion advisory in development tooling. This is not an HTTP exploit demonstrated against deployed application code. | **Open:** seven high-severity development dependency entries. Production audit is clear. Forced fixes propose Tailwind major migration and incompatible Next ESLint downgrade; neither has been applied. |

## Verification so far

- `verify:security-logging`: 7 checks passed; the same test failed on the base logging behavior using synthetic values only.
- `verify:project-audit`: all 80 isolated concurrency, security and rollback checks passed after the logging fix.
- `verify:security-uploads`: 11 checks passed after reproducing unauthorized storage on the baseline; forbidden malformed multipart returns 403 before parsing, and cancellation/completion release capacity exactly once. Backend build, the 80-check project audit and 91-check workspace suite pass after upload hardening.
- Approved MFA migration applied only to loopback PostgreSQL; 12 migrations applied, existing data preserved. Prisma validation/generation and backend/frontend builds passed. No real account was enrolled by the audit.
- `verify:security-mfa`: 71 negative, replay, concurrency, assurance, revocation and rollback checks passed. `verify:security-mfa-browser`: 74 actual Edge interaction/design checks passed, including first enrollment, System Admin enrollment authorization and recovery-code login.
- Project audit now passes 81 checks, including a strengthened password-reset assertion that first proves the old bound session works. Workspace checks pass 96 by default and 1,142 with browser/design checks. Frontend client/PDF/UI regressions, lint and standalone type checking passed.
- `verify:security-email`: 26 checks passed after the same negative test reproduced a password-free email change on the baseline. Covers incorrect/missing password, bounded/duplicate addresses, audit rollback, all-session/reset revocation, concurrent changes, privilege promotion without MFA and factor preservation. Backend build passed.
- Gitleaks 8.30.1: all 124 existing commits scanned, zero findings. Redacted scan artifacts remain ignored. This is detector coverage, not proof that no credential ever existed.
- npm production audit: zero known advisories. Full audit: seven high-severity development dependency entries.
- Semgrep 1.180.0 (`p/typescript`, `p/nodejs`, metrics disabled): one `sendFile` review finding and six partial JSX parsing errors. Document access is guarded by current-user/event/category checks and path containment; the rule result is being manually reviewed. Parsing limitations are not treated as application compile failures.

## Remaining verification and external controls

The user approved the authentication proposal and additive local migration. Recovery-email protection, remaining hardening and final scans remain in progress. Hosting/network configuration, TLS termination, database-at-rest encryption, SMTP delivery, malware scanning, external alerting and backup restoration remain unverified. No production data or environment has been touched.

### Hosting discovery (2026-10-12)

The user asked the audit to discover hosting. `README.md:252` states that no deployment pipeline or hosting configuration is included. A repository-wide configuration search found no Vercel, Netlify, Render, Railway, Fly, Docker or GitHub workflow configuration. Local environment inspection reported only service hostnames/storage class: frontend `localhost:3000`, PostgreSQL `localhost:5432`, local filesystem uploads. No credential values were displayed.

Read-only public GitHub metadata for `ShimulCoding/university-project` shows no homepage, zero deployments, zero environments and zero workflows. This does not establish that no independent deployment exists. No live provider or staging URL can be determined from the available evidence; provider-specific TLS/firewall/backup settings must remain unverified. Production application URLs and data were not probed.
