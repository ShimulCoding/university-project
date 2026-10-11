# Approved additional security boundary changes

Prepared on the security review branch, 2026-10-12. The security-audit rules require approval before changing behavior. These controls are separate from the previously approved authentication proposal. No production access or deployment is proposed.

The user approved all three controls on 2026-10-12. Implementation and verification will be recorded in `security-hardening-review.md`; approval is not a claim of deployment.

## Concrete changes

1. **Browser boundary:** add per-response nonce CSP to Next HTML, prohibit unapproved scripts/frames/objects, set frame-denial, no-referrer and nosniff headers, and remove automatic credentialed CORS trust of other localhost ports. Permit the explicitly configured frontend/API origins; local operators can list alternate legitimate ports in `FRONTEND_URL`. Preserve the application's bundled fonts, PDF downloads, inline styles and framework scripts. Test injected scripts, framing, origin denial and existing browser workflows before pushing.
   - Evidence: `frontend/next.config.ts:3` has no HTML security headers; `backend/src/config/cors.ts:8` trusts localhost ports 3000–3009 and 4000 independently of configured origins.
2. **Seed boundary:** reject production seeding and template admin passwords; require explicit opt-in and a supplied password for demo seeding. Never reset/reactivate existing accounts or restore revoked assignments merely by rerunning seed. Keep the role catalog initialization and new local demonstration setup available. Test with isolated fixture accounts; never run seed against the existing local database.
   - Evidence: `backend/prisma/seed.ts:43` overwrites existing admin credentials/status; `:98` supplies a fixed demo password; `:126` resets existing demo accounts.
3. **Upload scanning:** add a bounded, fail-closed ClamAV scanner integration before file persistence. Production must configure a scanner; local/staging opt-in can be tested without changing current data. Reject malware verdicts and unavailable/timed-out scans before writing files. Use a local mock daemon for transport/negative tests; actual malware-definition coverage remains unverified until the operator supplies ClamAV. No real malware or production files will be used.
   - Evidence: `backend/src/utils/upload-utils.ts:57` checks file headers but no malware scanner is invoked before `:72` stores evidence.

## Behavior and deployment implications

Unconfigured alternate frontend origins will be rejected. Pages cannot be embedded in other sites or execute injected inline scripts. Seed will stop acting as an implicit credential-reset tool. Enforced scanning rejects uploads when its scanner is unavailable, so staging rollout needs the daemon configured first. No database migration, deletion, production request, cloud change or secret rotation is included.

All changes will remain on the review branch, in separate finding commits, with negative and legitimate-workflow regressions. Main remains unchanged.
