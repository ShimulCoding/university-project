# Protected files under private hidden roots

## Reproduced cause

At `13134ea`, `backend/src/modules/documents/controllers/documents.controller.ts:20` passes the entire absolute path to Express sendFile. The installed send transport treats a dot-prefixed directory in that requested path as a dotfile. An otherwise authorized file in a configured `.cache` upload root is denied; the application's generic error handler returns 500. The fresh restricted-role document/action-limit tests exposed this independently of PostgreSQL permissions.

## Fix and boundaries

`backend/src/utils/file-response.ts:6` requires an absolute service-approved path and sends its basename relative to its already-authorized directory. Controller authorization, event/student ownership, path containment, file-size validation and atomic access audit remain upstream. No user-supplied directory, public evidence route or dotfiles allow option is introduced. Default filename dotfile denial remains enabled. This utility is transport, not an authorization boundary; future callers must preserve those service checks.

## Actual proof

- `node node_modules/tsx/dist/cli.mjs backend/scripts/verify-file-response.ts`: ten checks; the same fresh 54-byte fake PDF, hidden root and native Node24.13.1 machine returns **500 before / 200 with exact bytes after**. Hidden filenames, missing files and relative paths send no evidence or private filesystem diagnostics. No environment/DB/auth mock is used by this transport fixture.
- `node scripts/scalability/verify-local-database.mjs --config <private-fake-fixture.json> --run-script verify:security-document-audit`: fourteen real service/API checks pass through the restricted runtime, including outsider403, unauthenticated401, invalid traversal500, missing404 and audit-failure denial.
- Same guarded runner: action-limit32 and project-audit81 pass. Tests use only new fake PostgreSQL16.15 data, separate privileged fixture cleanup, private upload root and loopback servers. Original accounts/configuration/MFA are untouched.
- Backend build passes; frontend lint/types and unchanged client/financial/PDF/UI/policy/origin/logging/reset contracts pass. Scanner/secret results are recorded in the mission log after execution.

These are correctness/security results, not throughput or VPS capacity. Test transport interruptions initially produced Prisma initialization failures; after restoring the owned WSL loopback relay, the suites passed without permission expansion, data reset or test suppression. Runtime-through-pooler and real antivirus acceptance remain open.

## Rollback

Revert the transport utility/controller call/test as one concern; no migration/data changes. A rollback restores the known hidden-root failure and must be recorded. Preserve upstream authority/audit checks, private no-store headers and the default dotfile filter. Storage-account compromise/symlink replacement remains outside this fix's guarantees and needs deployment isolation/restore/penetration coverage.
