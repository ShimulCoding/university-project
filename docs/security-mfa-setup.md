# Privileged MFA rollout and operator handoff

Review branch only; local additive migration was approved by the user and applied without reseeding. Production has not been deployed. Existing real accounts have not been enrolled automatically.

## Key and schema

`MFA_ENCRYPTION_KEY` is a **separate random 32-byte key encoded as base64**. It is required at startup. Keep it in the runtime secret store, outside Git and application logs. Back it up encrypted separately from the database. Losing or replacing it without reencrypting factors prevents enrolled users from signing in; do not rotate it by simply overwriting the environment value.

For a new local installation, generate a private key file without displaying the value (PowerShell 5 compatible):

```powershell
$keyFile = Join-Path (Get-Location) '.cache\mfa-key.txt'
if (Test-Path -LiteralPath $keyFile) { throw 'Preserve the existing key; do not overwrite it.' }
New-Item -ItemType Directory -Force -Path '.cache' | Out-Null
$keyBytes = New-Object byte[] 32
$generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$generator.GetBytes($keyBytes)
[System.IO.File]::WriteAllText($keyFile, [Convert]::ToBase64String($keyBytes))
$generator.Dispose()
icacls $keyFile /inheritance:r /grant:r "$($env:USERNAME):(F)" | Out-Null
```

Copy the value privately into the ignored backend environment or the hosting secret store under `MFA_ENCRYPTION_KEY`. Never paste it in chat, terminal output, screenshots or commits. This review already configured the local key; preserve it.

Stop the backend before Prisma generation on Windows, then run from the repository root:

```powershell
npm run prisma:validate --workspace backend
npm run prisma:generate --workspace backend
npm exec --workspace backend -- prisma migrate deploy
npm run build --workspace backend
```

Review the migration SQL and take an encrypted backup before any staging rollout. Approval in this audit applies to the local database only. The MFA migration adds four tables and one nullable refresh-session field; it does not alter financial/document/history data.

## First administrator

1. Confirm the existing administrator's identity in person or through a separately verified channel. Use their exact existing user ID. Do not bootstrap/reseed an existing database.
2. On the local operator machine, issue a new setup authorization into an ignored file:

```powershell
npm run mfa:authorize-enrollment --workspace backend -- --user-id <existing-user-id> --output .cache/first-admin-enrollment.txt --confirm-supervised-identity
icacls '.cache\first-admin-enrollment.txt' /inheritance:r /grant:r "$($env:USERNAME):(F)" | Out-Null
```

The utility only permits a loopback, nonproduction database, refuses to overwrite files, and never prints the code. It cannot replace an enrolled factor. Securely read/share the file with the verified person; grant expiry is 24 hours. The audit did not issue a grant for a real account.

3. Open System Admin sign-in, enter the existing password, enter the one-use authorization, add the displayed private key to a trusted authenticator, and verify its six-digit code. The password-stage challenge expires in five minutes. Save the eight recovery codes privately offline before continuing. Enrollment revokes prior sessions.
4. After the first administrator is enrolled, use **Accounts and roles → Authorize authenticator setup** for each active event team or additional administrator. Confirm identity, reenter the current administrator password, and privately deliver the one-use code. Accounts already enrolled cannot replace their factors through this route. The web flow records grant/enrollment audits.
5. Existing real event assignments remain unchanged. Assign the four previously unstaffed events through the existing System Admin team management UI; no membership is inferred from a global role.

## Recovery and verification

- Email password reset **preserves** the enrolled factor and invalidates sessions/challenges through account versioning. A reset email cannot turn off MFA.
- An unused recovery code substitutes for one authenticator verification and is consumed atomically. It cannot be reused. Recovery codes are stored as hashes; enrolled/pending secrets are encrypted with authenticated, account-bound encryption.
- Role removal does not disable an enrolled account's MFA. Student-ID login, refresh, direct endpoints and later privilege promotion enforce the same assurance boundary. Privileged assurance expires after 12 hours; a new MFA sign-in is required.
- Lost authenticator **and** lost recovery codes require an operator-led identity investigation and a separately reviewed factor reset. There is deliberately no password-only factor replacement route. Do not improvise SQL resets against production.
- `verify:security-mfa` tests bypasses, single-use/concurrency, expiry, enrollment, recovery, audit rollback, distributed guessing budgets, role promotion/demotion and password-reset preservation with isolated fixtures.
- `verify:security-mfa-browser` uses installed Edge and both built local apps for actual supervised authorization, enrollment and recovery screens. `verify:event-workspaces` fixtures now perform real MFA verification; the fixture helper refuses accounts outside that run.

TOTP can be phished and does not stop theft of an already verified live session. A human penetration test should cover real devices, authenticator time drift, factor/recovery custody, phishing-resistant passkeys, browser/session theft, and the human identity-check process. TLS, private backup restore and external alerting remain deployment responsibilities.
