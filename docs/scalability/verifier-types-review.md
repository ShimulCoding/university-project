# Strict verifier contracts

## Finding and measurable outcome

The production `backend/tsconfig.json` excludes verification scripts. The previous seed gate checked only four seed-related entrypoints. A broader strict noEmit check exposed **51 errors** in the immutable pre-database snapshot and the isolated-database snapshot, with matching file/error-code pairs. Test execution through tsx alone does not detect these errors.

The same TypeScript installation, machine, sources and strict settings now produce **zero errors**. The retained fixture dataset and all **24 non-browser backend suites** pass again through the restricted fake database. This is a verification-quality/correctness improvement, not measured capacity or request-speed gain.

## Changes and hostile review

- Added `backend/scripts/tsconfig.verification.json` and `npm run verify:types --workspace backend`: all backend verifier/fixture/operator TypeScript now inherits strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes. No compiler control was weakened.
- Existing throw-on-false assertion helpers advertise their actual `asserts condition` contract. Known errors are narrowed before field access; enum fixtures retain their real union; captured inputs use explicit holders; indexed evidence/report/decision accesses prove presence before inspection. Original assertions remain.
- Complete typed authentication fixtures replace a partial asserted object in the unit-only quota harness. Actual endpoint authentication remains independently exercised. Validated server addresses/tokens are captured before closure use; fixture scanner modes and pause callbacks must exist.
- Synthetic PDF Blob input copies to an ArrayBuffer-backed Uint8Array, avoiding SharedArrayBuffer-incompatible typing while retaining the same evidence bytes/replay assertions.
- Three repository signatures expose the plain Promise contract consumed by existing callers: AuditLog creation, user count and active-role user lookup. They return the **same actual Prisma objects**; there is no async wrapper or changed transaction/timing behavior. All production callers were checked for fluent relation access or array-transaction usage; none relies on these methods for those APIs.

The two affected compiled repository `.js` files are **byte-identical** to the staged database baseline. A whole-output comparison covers168 files: three unrelated files differ only in CRLF/LF text bytes from clean index versus working-tree compilation; normalized content matches. Do not describe raw full-output identity as proven. No schema, role, password, MFA, authorization condition or runtime dependency changed.

## Reproduction and actual results

```powershell
npm run verify:types --workspace backend
npm run verify:seed-types --workspace backend
npm run build --workspace backend
node scripts/scalability/verify-provisioning-contracts.mjs
```

For data-backed acceptance use the approved private fixture runner, as documented in [database boundary review](database-boundary-review.md). All24 retained scripts passed again: project81, replay62, action32, uploads15, MFA71, email26, login37, session18, document14, TLS35 and the other inherited suites. Mocked unit portions remain unit evidence; actual DB/service/API assertions still use the restricted runtime. Neither account impersonation nor assertion suppression was introduced to make the new gate green.

The exact expanded baseline command/config and diagnostics are recorded in LOG E0023. Root reran the actual positive/negative suites after the combined independent edits; agents' source checks are not substituted for this run.

## Rollback and limits

Revert this concern in a normal alternating-author follow-up commit if a consumer proves it needs a fluent Prisma return contract; do not delete failing tests or loosen compiler settings. Reverting restores the verifier typing defects without requiring a database change. Existing lifecycle, security and role boundaries must continue to pass.

This gate does not establish Linux native engines, private HTTPS browser behavior, pooler compatibility, real scanner signatures, distributed quotas, production capacity or absence of other defects. Those remain separate phase gates.
