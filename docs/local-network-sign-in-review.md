# Local network sign-in follow-up — 2026-10-12

## Root cause and fix

At `ecccd1b`, `frontend/next.config.ts:3` has no `allowedDevOrigins` configuration; `frontend/src/lib/api/shared.ts:3` defaults the API to localhost. The user's network-IP dashboard loads HTML but Next rejects its development HMR origin (`node_modules/next/dist/server/lib/router-utils/block-cross-site-dev.js:75`). Actual Edge reproduction found no attached React form handler and no login POST; clicking Sign In performs a native `/dashboard?` navigation. The same credentials work on localhost and reach mandatory MFA enrollment. Password, account status and global assignment were checked privately; there was no password lockout.

`NEXT_DEV_ALLOWED_ORIGINS` now configures explicit hostnames in Next's supported allow-list through `frontend/src/lib/security/development-origins.ts:3`. Wildcards, schemes, credentials, ports and paths are rejected. No incoming Host/Origin header contributes trusted configuration. Unknown and opaque origins remain blocked. The ignored local frontend/API configuration now uses the user's confirmed machine address consistently, with its exact frontend origin listed in backend CORS. No password, role, session-security policy or factor key was changed.

For another local machine, replace `LAN_HOST` below with its actual local interface address, then restart development:

```dotenv
# frontend/.env.local (ignored)
NEXT_DEV_ALLOWED_ORIGINS=LAN_HOST
NEXT_PUBLIC_API_BASE_URL=http://LAN_HOST:4000/api

# backend/.env (ignored): retain other legitimate exact origins
FRONTEND_URL=http://localhost:3000,http://LAN_HOST:3000
```

Open the frontend using the **same hostname as the configured API**. Cookies span ports on that host; switching between localhost and a network address while retaining an API on the other host does not preserve the intended authenticated browser/server-rendering boundary. To use localhost again, change the API base back to localhost and restart. Production uses the documented same-origin HTTPS proxy; this configuration is local development, not deployment or a claim of TLS protection on LAN HTTP. Reference: [Next allowedDevOrigins](https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins).

## MFA handoff

The existing administrator had neither an enrolled factor nor an active setup grant. The owner explicitly confirmed the account and authorized initial setup. The operator utility issued a one-use grant into a fresh ignored directory/file with owner-only Windows ACLs. Its code, password and private path are not committed. The owner subsequently completed enrollment using their own authenticator on 2026-10-12. Read-only local metadata confirms the factor, consumed grant, eight unused recovery codes, enrollment audit and a later successful authenticator sign-in followed by logout. Recovery-code values and the real factor were not read; offline code custody is not verified. No factor was enrolled by the agent, and no security check was bypassed. The existing password is preserved; grant lifetime is 24 hours and each password-stage challenge lasts five minutes.

The owner's later setup error occurred after opening the frontend on localhost while retaining the LAN API configuration. A disposable Edge account reproduced password response 200, no browser challenge cookie, setup response 401 and zero challenge attempts: rejection happens before checking the enrollment code. Opening the frontend on the configured LAN hostname gives password response 200, a challenge cookie, setup response 200 and the authenticator-key screen. This diagnosis did not require reading the owner's authorization file, replacing the grant or changing authentication policy. Keep frontend/API hosts consistent; a valid setup grant cannot repair a missing browser cookie.

## Verification

- `verify:development-origins`: 19 parser and installed-Next allow/deny checks pass, including a negative control reproducing the unconfigured-host block and hostile/opaque-origin denial after configuration.
- `verify:network-sign-in`: 14 actual Edge/cookie/MFA/server-rendering/negative checks pass on the confirmed local network host with a disposable account. Hydration and password submission work; password alone remains unauthorized; MFA produces the correct host cookie; authenticated reload and logout work. No real account's factor/recovery code is used. The first fixture cookie assertion queried `/api` instead of its `/api/auth` path; it was corrected before the successful run.
- The actual owner's password-stage browser recheck accepts the unchanged password and shows enrollment without native reload. Its test challenge is cancelled afterward; the owner's setup grant is not consumed by verification.
- Both builds, frontend lint and standalone types, strict network-fixture types, exact-origin CORS (18), frontend client/financial (17)/PDF/UI/CSP (13)/framework logging (5)/reset parser (16) pass.
- The subsequent complete HTTP-LAN workspace run passes 1,157 combined checks, including 72 browser interactions and 980 design checks across 49 route states. Its financial-form compatibility correction is in `local-network-financial-review.md`; current financial client checks pass 26. The flaky invalid-version fixture correction is recorded separately in `financial-replay-fixture-review.md` (62 replay checks, repeated).

The audit's previous production/browser results remain historical evidence; this follow-up specifically reproduces the user's **development network origin**. Existing records were not reseeded and production/main were not modified.
