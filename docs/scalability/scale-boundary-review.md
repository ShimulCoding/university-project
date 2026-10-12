# Independent horizontal-scaling boundary review

Reviewed on 2026-10-12 from `perf/world-class-scalability`, source baseline `415a869`. Scope: source inspection and two disposable loopback fixtures. No database, real account, private environment file, uploaded evidence, SMTP service or production target was accessed. No application behavior changed. This is a boundary review, not a load test or a capacity claim.

Environment actually used: Windows/PowerShell, Node `v24.13.1`, npm `11.8.0`, installed Express `5.3.0`, installed express-rate-limit `8.7.1`. Both fixtures use two or fewer ephemeral HTTP servers bound explicitly to `127.0.0.1`, synthetic identities, no persistence and no additional dependency. They require the existing compiled backend matching the reviewed source. All measured numbers below are fixture outcomes; no p95, throughput or VPS capacity has yet been measured here.

## State and trust boundaries

| Boundary | Current evidence | Scaling consequence / required invariant |
| --- | --- | --- |
| Authoritative account/session state | `backend/src/middlewares/authenticate.ts:42` reads the current user and active roles; `:47` reads the bound PostgreSQL RefreshToken. `backend/src/utils/authenticated-session-context.ts:16` and `:17` repeat these checks inside write transactions. | This state is already shared through PostgreSQL. Preserve immediate revocation, current event assignment, account status, session version and MFA assurance. A cache hit or a queue-supplied role claim must not replace these authority checks. |
| Shared password failure budget | `backend/src/modules/auth/services/password-security.ts:17` counts PostgreSQL denial audits; `:29` commits denial count/write under the shared serializable transaction. | Already applies across app instances using the same database. Preserve it when adapting outer IP controls. This is distinct from the process-local limits below. |
| Process-local rate counters | All limiters instantiate express-rate-limit without a supplied store: `backend/src/config/rate-limit.ts:7`, `:16`, `:29`, `:40`; `backend/src/middlewares/sensitive-action-limits.ts:7`, `:20`; `backend/src/middlewares/upload-guard.ts:20`. | Reproduced: two independent configured account budgets of three accept six combined requests. Reboots also reset these counters. Before fleet operation use one atomic, namespaced shared store, preserve existing thresholds/key derivation, and prove behavior across replicas and store failures. |
| Process-local resource slots | `backend/src/middlewares/resource-admission.ts:17` and `:44` hold `active` in closures; `backend/src/middlewares/sensitive-action-limits.ts:21` permits one report; `backend/src/middlewares/upload-guard.ts:29` permits two uploads. | Local memory/CPU admission remains necessary on every process. A separate shared worker/downstream capacity lease is needed where several processes use one scanner/database; a fleet-wide counter alone does not protect each process. Keep cancellation leases until actual work settles. |
| Local evidence filesystem | `backend/src/storage/index.ts:3` always instantiates LocalStorageAdapter. Its interface only has save/remove (`backend/src/storage/types/storage-provider.ts:13`). Reads bypass that interface via `fs.stat` (`backend/src/modules/documents/services/documents.service.ts:117`) and `sendFile` (`backend/src/modules/documents/controllers/documents.controller.ts:20`). SupportingDocument only has `StorageDisk.LOCAL` (`backend/prisma/schema.prisma:90`, `:515`). | Without shared storage, another instance cannot serve an uploaded file. Extend the adapter with opaque object identity, metadata/integrity checks and authorized streaming before adding object storage. Never expose physical paths or public evidence URLs. Preserve audit-before-stream and private/no-store. |
| Scanner/request memory | Multer memoryStorage accepts fifteen files (`backend/src/modules/requests/routes/requests.routes.ts:32`, `:37`), eight MiB each (`backend/src/config/uploads.ts:30`). `backend/src/utils/upload-utils.ts:109` sequentially scans/stores the batch; `backend/src/utils/clamd-stream.ts:14`, `:25` creates a socket and absolute deadline per file. | The retained file-byte allowance is derived as 120 MiB/request and 240 MiB for two admitted maximum batches, before parser/runtime overhead; this is a source-derived allowance, not measured RSS. Use a dedicated bounded scanner bulkhead and quarantine/release states when direct object-store uploads are introduced. Do not weaken fail-closed production scanning. |
| Email delivery | `backend/src/config/mailer.ts:6` caches a process-local transport. `:13` creates an external Ethereal account if development SMTP_HOST is absent; `:26` awaits delivery on the recovery request. SMTP transport protections/timeouts are in `backend/src/utils/smtp-security.ts:4`. | Local-only fixtures must supply controlled loopback SMTP or avoid this path. A durable outbox/email adapter must preserve privacy and reset-token expiry, TLS verification and bounded delivery retries. The cached transporter is not a distributed delivery queue. |
| Maintenance job | Startup and hourly token pruning run in every app process (`backend/src/server.ts:11`, `:12`); pruning uses unbounded deleteMany calls and silently absorbs errors (`backend/src/modules/auth/repositories/auth.repository.ts:73`). | Multiple replicas duplicate maintenance work. Move pruning behind a bounded job/lease adapter with observable results; do not remove token validation or delete history outside a reviewed retention policy. |
| Public vs private cache | Next proxy sets nonce-bearing HTML private/no-store (`frontend/src/proxy.ts:14`); server API helper attaches cookies and uses no-store (`frontend/src/lib/api/server.ts:23`, `:41`). Authentication also sets no-store (`backend/src/middlewares/authenticate.ts:21`). | Cache only explicitly public API projections initially. Do not place cookie-bearing responses or nonce-bearing HTML in a shared cache. Public payload cache invalidation must commit with publication/unpublication or use an independently checked publication version. |
| PDF generation | `frontend/src/lib/pdf.ts:21` creates PDFKit documents in the browser; `:11` loads four fixed same-origin fonts; `:68` creates local Blob downloads. | No server HTML renderer, renderer URL-fetch API or private PDF download endpoint exists to attack. Server renderer/queue adoption would create new trust boundaries; it is not required merely to scale existing browser PDF generation. |

## Concrete reproduced lifecycle defect

**SCB-02: shutdown can disconnect the database before disconnected admitted work finishes.** `backend/src/server.ts:24` uses the HTTP server-close callback to disconnect PostgreSQL and exit. Work admission deliberately keeps disconnected controllers running until their promise settles (`backend/src/middlewares/resource-admission.ts:40`, `:53`; `backend/src/utils/async-handler.ts:12`, `:14`). HTTP socket completion is therefore insufficient evidence that those promises completed.

Measured local negative result: after aborting a disposable admitted request, `server.close` completed while its controller promise remained unresolved (`admittedWorkCompletedWhenCloseCallbackFired=false`). Releasing that promise subsequently completed the work. The fixture did not disconnect a real database or kill an app instance.

Smallest first product improvement after carry-over gates: a process lifecycle coordinator that marks readiness false once, stops new admission, closes/drains HTTP sockets, waits for tracked controller/maintenance promises, then disconnects PostgreSQL. Set an explicit deadline and handle repeated signals idempotently. Do not imply a failed/unfinished financial operation committed successfully; retain retry keys and recover committed outcomes after restart. Rollback is removal of the new coordinator and restoration of the prior lifecycle, with this documented defect restored; rollback must not alter records/schema/permissions.

Proof gates: reproduce the baseline failure above; after the fix, assert database-disconnect callback is not invoked until held controller work completes, including aborted upload/report work; assert repeated shutdown runs disconnect once; assert readiness rejects during drain; assert deadline behavior is bounded and reported without secrets. Measure drain duration, work-promise count at disconnect (target zero for successful graceful drain), and requests accepted after drain begins (target zero). These are lifecycle targets, not claimed improvements already achieved.

## Finance and jobs: semantic gaps, not invented integrations

Current finance is a manually reviewed evidence/transparency system. Registration ownership/capacity checks are in `backend/src/modules/registrations/services/registrations.service.ts:62`, `:80`; uniqueness is enforced for event/student and event/participant (`backend/prisma/schema.prisma:351`). Payment-proof submission rechecks one pending proof and verified registration under governance (`backend/src/modules/payments/services/payments.service.ts:106`, `:116`, `:119`). Manual income/expense create retry markers are durable and atomically linked (`backend/src/utils/financial-idempotency.ts:46`, `:57`; schema `:493`, `:508`). These controls should be retained and re-proved through the runtime role/pooler.

The existing IncomeRecord/ExpenseRecord schema stores amounts plus mutable workflow states, not balanced debit/credit posting lines (`backend/prisma/schema.prisma:444`, `:465`). Income verify/void changes state (`backend/src/modules/payments/services/payments.service.ts:374`, `:427`); expense state updates are in `backend/src/modules/requests/repositories/requests.repository.ts:380`. There is no chart of accounts, balanced double-entry journal, durable outbox or payment-provider settlement/webhook model in this schema. Adding those is an explicit expand-then-contract data/domain change; do not call existing evidence submission a gateway payment or claim that absent gateway callbacks were re-attacked.

Report generation reads all event rows into memory (`backend/src/modules/reconciliation/services/reconciliation.service.ts:188`) and builds one public expense-breakdown entry per settled expense (`:243`) inside its serializable write transaction (`:395`). The transaction timeout is thirty seconds (`backend/src/utils/governance-transaction.ts:50`). Source confirms unbounded row/materialization growth; the first time/size bottleneck still needs measurement on synthetic datasets. SQL aggregates alone cannot remove expense detail without changing current disclosure behavior. A queued computation needs a stable financial version/snapshot, freshness recheck at commit, current actor/event permission revalidation and idempotent job/result identity. Do not serialize the trusted AsyncLocalStorage context or user-supplied role claims into job authorization.

No grade/result, refund/waiver, external payment-provider webhook, SMS, import worker or existing durable queue feature was found in the reviewed source/schema. The current entry-point map records this explicitly (`docs/security-current-entry-point-map.md:13`, `:180`). Workload scripts for absent journeys must be marked N/A with that reason; implementing them requires an explicit domain specification.

## Required adapter boundaries and negative tests

| Adapter | Smallest safe contract | Negative/regression proof |
| --- | --- | --- |
| Session authority | Read live bound session/account/permission/MFA state from primary; transactional recheck remains PostgreSQL-owned. | Revocation on instance A denies reads/writes on B; stale/private cache or a compromised non-authoritative store cannot grant access. |
| Rate-limit store | Existing library Store contract, one atomic namespaced store per deployment; account keys derive only from authenticated identity; IP extraction retains exact trusted proxy configuration. | Same account/IP across two actual instances shares one allowance; racing increments/expiry never exceed it; store outage cannot silently disable sensitive controls. Existing budgets stay unchanged unless owner approves changed auth behavior. |
| Resource admission | Per-process controller lifecycle tracking plus downstream/shared resource leases where required; leases outlive disconnected HTTP responses. | Cancellation does not release active work early; two replicas do not exceed shared scanner worker limits; shutdown waits for unfinished work. |
| Storage | Save/quarantine, inspect/stream authorized object, release and remove by opaque object key; metadata and integrity validation belong behind the adapter. | Upload on A/download on B; private object cannot be read directly or by another event; scan failure never releases data; failures/retries leave no reachable orphan. |
| Queue/outbox | Atomic enqueue intent with business change; durable job identity/attempts/backoff/dead-letter; fresh actor/record authorization and bounded worker payload. | Replay/cancellation/crash cannot duplicate money/result/email intent; revoked actor/stale report cannot finalize; poison payload cannot fetch arbitrary URL/file. |
| Email | Explicit transport adapter with verified TLS and durable bounded delivery semantics; loopback fixture implementation for tests. | No unexpected external account creation in local-only tests; TLS downgrade/certificate failure rejects; token is not logged or delivered after expiry. |
| Public cache | Public-projection/version key only, bounded values/TTL/coalescing; authenticated/private data excluded. | Cross-account/event and cookie-bearing requests never populate shared private responses; unpublication/fresh version invalidates; outage bypass cannot disclose stale withdrawn data. |

For a single small VPS, PostgreSQL authority, private local storage and local memory bulkheads are legitimate starting adapters when documented as one-instance limits. Distributed adapters are required before multiple app/worker instances; naming an adapter alone does not prove horizontal behavior. No additional service was provisioned by this review.

## Exact local reproduction commands and results

Run from the repository root in PowerShell. Neither command starts the real application or reads environment credentials. Compiled module version/source must match the reviewed revision; a fresh `npm run build --workspace backend` can regenerate it without a migration.

### SCB-01: independent process-local quota budgets

```powershell
@'
const assert = require('node:assert/strict');
const express = require('./node_modules/express');
const { createSensitiveActionLimits } = require('./backend/dist/middlewares/sensitive-action-limits');
(async () => {
  const servers = [];
  try {
    for (let i = 0; i < 2; i++) {
      const app = express();
      const limits = createSensitiveActionLimits(60000, { mutations: 3, documents: 3, reports: 3 });
      app.use((request, _response, next) => { request.auth = { userId: 'synthetic-same-account' }; next(); });
      app.post('/fixture', limits.mutation, (_request, response) => response.sendStatus(204));
      const server = app.listen(0, '127.0.0.1');
      await new Promise(resolve => server.once('listening', resolve));
      servers.push(server);
    }
    const results = [];
    for (let i = 0; i < 6; i++) {
      const server = servers[i % 2];
      results.push((await fetch('http://127.0.0.1:' + server.address().port + '/fixture', { method: 'POST' })).status);
    }
    const overflow = [];
    for (const server of servers) overflow.push((await fetch('http://127.0.0.1:' + server.address().port + '/fixture', { method: 'POST' })).status);
    assert.deepEqual(results, [204, 204, 204, 204, 204, 204]);
    assert.deepEqual(overflow, [429, 429]);
    console.log(JSON.stringify({fixture: 'Two independent limiter instances sharing one synthetic identity', configuredLimitPerMinute: 3, acceptedBeforeDenial: results.length, nextStatuses: overflow, datastore: 'none', realAccounts: 'none'}));
  } finally {
    for (const server of servers) await new Promise(resolve => server.close(resolve));
  }
})().catch(() => { console.error('Independent quota fixture failed; no private diagnostics emitted.'); process.exitCode = 1; });
'@ | node
```

Observed exit code `0`; output:

```json
{"fixture":"Two independent limiter instances sharing one synthetic identity","configuredLimitPerMinute":3,"acceptedBeforeDenial":6,"nextStatuses":[429,429],"datastore":"none","realAccounts":"none"}
```

This fixture uses two independent limiter objects in one OS process. It proves their stores are independent; an actual two-process fixture is still required for the future distributed adapter. The old implementation is intentionally expected to demonstrate multiplication, not pass a future shared-budget test. A shared-store test must accept only three total across both replicas.

### SCB-02: socket drain does not drain controller promises

```powershell
@'
const assert = require('node:assert/strict');
const express = require('./node_modules/express');
const { createWorkAdmission } = require('./backend/dist/middlewares/resource-admission');
(async () => {
  let release, began, completed = false;
  const started = new Promise(resolve => { began = resolve; });
  const work = new Promise(resolve => { release = resolve; });
  const app = express();
  app.post('/fixture', createWorkAdmission(1, 'busy')(async (_request, response) => { began(); await work; completed = true; if (!response.destroyed) response.sendStatus(204); }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const controller = new AbortController();
  const pending = fetch('http://127.0.0.1:' + server.address().port + '/fixture', { method: 'POST', signal: controller.signal }).catch(() => null);
  await started;
  controller.abort();
  await pending;
  await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('fixture deadline')), 2000); server.close(() => { clearTimeout(timeout); resolve(); }); });
  assert.equal(completed, false);
  console.log(JSON.stringify({fixture: 'Disconnected admitted controller and server.close callback', admittedWorkCompletedWhenCloseCallbackFired: completed, datastore: 'none', realAccounts: 'none'}));
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(completed, true);
})().catch(() => { console.error('Independent drain fixture failed; no private diagnostics emitted.'); process.exitCode = 1; });
'@ | node
```

Observed exit code `0`; output:

```json
{"fixture":"Disconnected admitted controller and server.close callback","admittedWorkCompletedWhenCloseCallbackFired":false,"datastore":"none","realAccounts":"none"}
```

## Limits and next measurement

No dependency/store/scanner outage was injected into the running owner application; no production capacity was tested. No product fix, migration or permission change was made here. Source-only hypotheses (transaction size, memory allowance, filesystem portability and duplicate maintenance) remain unmeasured until the phase baseline.

Highest security dependency remains SEC-22; changes to the existing real local database require the owner's explicit approval before restricted-role/pooler verification. Highest reproduced small reliability candidate is SCB-02. Highest reproduced fleet security prerequisite is SCB-01. Before/after gates should use identical fixture scripts, machine limits and synthetic dataset, recording concurrency, p50/p95/p99/error rate where the task actually measures request performance; reject a change that improves throughput by skipping authority, audit, scanning or retry protections.
