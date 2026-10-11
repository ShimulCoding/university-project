# Approved financial replay control

The user approved implementation and the additive local migration on 2026-10-12. Main, production and existing financial records remain untouched. The source evidence below records the pre-fix behavior.

Local isolated HTTP probe, 2026-10-12: two identical `POST /api/payments/income-records` requests carrying the **same** `Idempotency-Key` both returned 201 and created two records. The owning Finance Controller was properly authenticated/authorized; the endpoint ignores the header. This is a lost-response/retry integrity risk, not an unauthenticated money-writing bypass. The fixture was removed; existing records were untouched.

The same negative probe reproduced two standalone expense records from repeated `POST /api/requests/expense-records` with the same key and benign synthetic evidence. Storage was mocked and only this run's database fixtures were removed. Cover both ledger creation endpoints with the shared mechanism.

Evidence: `backend/src/modules/payments/controllers/payments.controller.ts:43` does not read a retry identity; `backend/src/modules/payments/services/payments.service.ts:282` inserts a new record for each call. Source line numbers refer to the current review branch before this proposed change.

## Proposed permanent fix

- Add an **additive local migration** for a bounded financial-operation idempotency record: owning actor, operation, validated random request key, request fingerprint and created result ID, with a unique actor/operation/key constraint. Preserve all existing financial records; do not deduplicate/delete past entries automatically.
- Require `Idempotency-Key` on manual-income and expense-record creation and supply a stable random key from each first-party form. Keep it across retries after an uncertain response; create a new key only after confirmed success/new operation. Update owned verification callers. Existing external API clients must supply the new header.
- Consume the key/result atomically with the ledger entry and audit in the existing governance transaction. A repeat with identical validated inputs returns the original result without another ledger entry; a reused key with different input/files is rejected. Recheck current session/account/event authority on every replay. Clean new redundant uploads on replay/failure. No raw request/token/file contents go into the idempotency table.
- Cover concurrent retries, changed payload/files, missing/invalid keys, revocation and audit rollback with negative tests. Preserve separate legitimate contributions by using separate keys. Bound key length; keep the marker for the owning ledger record's lifetime so old keys cannot become new financial operations after an expiry window.

This changes a financial API contract and adds a table, so the security rules require explicit approval. Only local fixtures and the review branch are involved. No production migration/deployment or modification of existing money records is proposed. Other financial transitions retain their existing unique constraints/atomic state guards; further replay gaps will be documented separately if reproduced.
