# Deterministic financial replay verification — 2026-10-12

At `0bca1d2`, `backend/scripts/verify-security-financial-replay.ts:62` constructs a supposedly invalid UUID with `run.replace(/-4/, "-1")`. If the random UUID's second group starts with `4`, that replacement changes the second group and leaves the third group's v4 version nibble intact. The API correctly accepts it, but the fixture expects 400 and fails. This happened during the network follow-up; no application key-validation bypass was reproduced.

The invalid-version cases are now fixed UUID v1 strings whose **third** group starts with `1`, with both a `4`-prefixed and a zero-prefixed second group. The API deterministically rejects both. No product code or legitimate financial behavior changed. The local replay suite passes **62** HTTP/concurrency/negative/rollback checks on two successive runs; all fixtures are uniquely scoped and cleaned up. The previous 61-check result remains historical evidence.
