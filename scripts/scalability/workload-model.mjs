import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = (route) => ({ method: 'GET', route, kind: 'read' });
const write = (route, kind = 'write') => ({ method: 'POST', route, kind });

// Scripted transport counts, not measured SSR/internal SQL fan-out or usage.
export const journeys = Object.freeze([
  { id: 'public-publication', roles: ['anonymous'], cycleSeconds: 60,
    requests: [read('/api/events'), read('/api/public/financial-summaries'), read('/api/public/financial-summaries/:eventLookup')],
    hypothesis: 'An active visitor makes three public API requests per minute during a publication burst.' },
  { id: 'event-registration-and-fee-evidence', roles: ['GENERAL_STUDENT'], cycleSeconds: 300,
    requests: [read('/api/events/:eventLookupKey'), read('/api/auth/me'), read('/api/registrations/me'), write('/api/registrations'), read('/api/registrations/:registrationId'), read('/api/auth/me'), write('/api/payments/registrations/:registrationId/proofs', 'upload'), read('/api/registrations/:registrationId')],
    hypothesis: 'One already authenticated student registers and uploads one fake payment-evidence file in five minutes. This is evidence submission, not external payment settlement.' },
  { id: 'event-finance-dashboard', roles: ['FINANCIAL_CONTROLLER'], cycleSeconds: 60,
    requests: [read('/api/auth/me'), read('/api/payments/verification-queue'), read('/api/payments/income-records'), read('/api/requests/expense-records'), read('/api/reconciliation')],
    hypothesis: 'Five authenticated dashboard/list API requests per minute; report writes are budgeted separately.' },
  { id: 'ordinary-student-login', roles: ['GENERAL_STUDENT'], cycleSeconds: 300,
    requests: [write('/api/auth/login')],
    hypothesis: 'One initial password sign-in per five-minute arrival wave. Students without an enrolled factor do not require MFA.' },
  { id: 'enrolled-mfa-login', roles: ['SYSTEM_ADMIN', 'event-team', 'enrolled-student'], cycleSeconds: 300,
    requests: [write('/api/auth/internal-login'), write('/api/auth/mfa/verify')],
    hypothesis: 'System Admin transport shown; event teams use event-team-login and enrolled students use login. MFA is real TOTP, not enrollment bypass or reusable recovery fixtures.' },
  { id: 'report-generation', roles: ['FINANCIAL_CONTROLLER'], cycleSeconds: 900,
    requests: Array.from({ length: 5 }, () => write('/api/reconciliation/generate', 'report')),
    hypothesis: 'Upper existing account budget: five reports per fifteen minutes. Per-process report admission may shed this target; that is a measurement, not a reason to weaken it.' },
]);

export const absentJourneys = Object.freeze([
  { id: 'academic-results-and-grade-changes', reason: 'No academic result/grade page, route or model exists in the source inventory.' },
  { id: 'payment-gateway-and-webhook', reason: 'Current money flow reviews uploaded evidence/manual records; no gateway or webhook exists.' },
  { id: 'server-pdf-render', reason: 'PDFKit generates browser-local exports using fixed fonts. HTTP asset traffic and browser CPU/memory need browser measurements, not a nonexistent rendering API.' },
  { id: 'sms-and-bulk-import', reason: 'No SMS integration or import worker exists.' },
]);

export function demand(journey, users, activeFraction = 1) {
  if (!Number.isSafeInteger(users) || users <= 0 || users > 100_000_000) throw new Error('Users must be a positive bounded integer.');
  if (!Number.isFinite(activeFraction) || activeFraction < 0 || activeFraction > 1) throw new Error('Active fraction must be between zero and one.');
  if (!Number.isFinite(journey.cycleSeconds) || journey.cycleSeconds <= 0 || !Array.isArray(journey.requests) || !journey.requests.length) throw new Error('Journey requires a positive cycle and explicit requests.');
  const activeUsers = users * activeFraction;
  const journeysPerSecond = activeUsers / journey.cycleSeconds;
  const reads = journey.requests.filter((r) => r.kind === 'read').length;
  const writes = journey.requests.length - reads;
  return { journey: journey.id, users, activeFraction, activeUsers, cycleSeconds: journey.cycleSeconds,
    requestsPerActiveUserPerMinute: journey.requests.length * 60 / journey.cycleSeconds,
    journeysPerSecond, readRps: reads * journeysPerSecond, writeRps: writes * journeysPerSecond,
    uploadRps: journey.requests.filter((r) => r.kind === 'upload').length * journeysPerSecond,
    reportRps: journey.requests.filter((r) => r.kind === 'report').length * journeysPerSecond,
    apiRps: journey.requests.length * journeysPerSecond, readWriteRatio: `${reads}:${writes}`,
    status: 'assumption-derived target, not measured capacity' };
}

const canonical = (route) => route.length > 1 ? route.replace(/\/$/, '') : route;
export function verifyRoutes(inventory) {
  const actual = new Set(inventory.routes.map((r) => `${r.method} ${canonical(r.path)}`));
  for (const journey of journeys) for (const request of journey.requests) {
    assert(actual.has(`${request.method} ${canonical(request.route)}`), `Unmapped journey request: ${request.method} ${request.route}`);
  }
}

export function model(users = 50_000) {
  const individualTargets = journeys.map((journey) => demand(journey, users));
  // Disjoint active cohorts. Arrival-wave scenarios are separate, not added twice.
  const mixedPeak = [demand(journeys[0], users, .90), demand(journeys[1], users, .099), demand(journeys[2], users, .001)];
  return { schemaVersion: 1, units: 'requests per second', capacityValidated: false,
    assumptionNotice: 'Concurrency means active sessions/people, not simultaneous HTTP sockets. Frequencies and cohort shares are explicit hypotheses. Validate real transport/SSR/SQL fan-out, think time, retries and browser work in Phase 2 and Phase 9.',
    individualTargets, mixedPeak: { cohorts: mixedPeak, apiRps: mixedPeak.reduce((sum, c) => sum + c.apiRps, 0),
      readRps: mixedPeak.reduce((sum, c) => sum + c.readRps, 0), writeRps: mixedPeak.reduce((sum, c) => sum + c.writeRps, 0) },
    absentJourneys };
}

export function documentModel() {
  const number = (value) => Number(value.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3 });
  const current = model();
  const rows = current.individualTargets.map((item) => `| ${item.journey} | ${item.cycleSeconds}s | ${number(item.requestsPerActiveUserPerMinute)} | ${number(item.readRps)} | ${number(item.writeRps)} | ${number(item.apiRps)} | ${item.readWriteRatio} |`).join('\n');
  const roadmap = [10_000, 25_000, 50_000, 100_000].map((users) => `| ${number(users)} | ${number(demand(journeys[0], users).apiRps)} | ${number(model(users).mixedPeak.apiRps)} |`).join('\n');
  return `# Workload model\n\nGenerated by node scripts/scalability/workload-model.mjs --document. Values are explicit assumptions, not telemetry or measured capacity. Concurrent people/sessions are not simultaneous open requests. RPS = active users × transport requests per cycle ÷ cycle seconds. Multiply again by measured SSR/SQL fan-out when sizing those tiers; never silently count them as one. Static assets, retries, login arrivals and browser PDF work require separate measurement.\n\n## Fifty thousand active users: independent journey targets\n\nEach row assigns all 50,000 users to that journey to expose its demand. These mutually exclusive scenarios must not be added together. Financial Controller/System Admin rows are stress envelopes, not a prediction that all students hold those roles.\n\n| Journey | Cycle | Requests/user/minute | Read RPS | Write RPS | Total API RPS | Read:write per cycle |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n\n${journeys.map((journey) => `- **${journey.id}:** ${journey.hypothesis}`).join('\n')}\n\nThe enrolled-MFA scenario does not auto-enroll or bypass a factor. Load fixtures use their own real TOTP factors and unique accounts; tokens/codes are never logged. The basic student scenario reflects current optional student MFA. Financial evidence upload is not gateway payment settlement. At the all-student registration envelope, one upload per cycle yields ${number(current.individualTargets[1].uploadRps)} uploads/second. File sizes/parts must be varied and reported separately; no bandwidth or scanner capacity is assumed.\n\n## Mixed active cohorts\n\nExplicit hypothetical mix: 90% public browsing, 9.9% registration/evidence and 0.1% event finance dashboards, with each person's journey frequency above. The fractions sum to one. Fifty thousand active users yield ${number(current.mixedPeak.readRps)} read RPS and ${number(current.mixedPeak.writeRps)} write RPS, total ${number(current.mixedPeak.apiRps)} API RPS. Initial login waves and budgeted report generation are separate arrivals, not counted twice in this cohort total. Real cohort shares need operator telemetry or a load-model decision before a capacity acceptance run.\n\n| Active users | All-public target RPS | Mixed target RPS |\n| --- | --- | --- |\n${roadmap}\n\n## Initial acceptance targets\n\nThese are proposed SLO test thresholds, not achieved results: public JSON p95 ≤300ms/p99 ≤1s; authenticated read p95 ≤1s/p99 ≤2s; registration/ledger mutation p95 ≤1.5s/p99 ≤3s; password/MFA each p95 ≤2s/p99 ≤4s; valid offered-load errors (including shed 429/503) <1%. Uploaded-byte completion, scanner outcome and client PDF generation have separate size-dependent distributions. Do not exclude legitimate shedding from error rate to make a capacity target pass. Preserve security budgets, bcrypt cost, authority and financial invariants when a threshold is missed.\n\n## Absent journeys and validation limits\n\n${absentJourneys.map((item) => `- **${item.id}: N/A.** ${item.reason}`).join('\n')}\n\nUse publication-day public browsing as the existing read-heavy scenario; it is not an academic results feature. The map covers every current source entry and this script rejects unmapped transport routes. Phase 2 must measure actual page/API/SQL request fan-out, arrival vs closed-loop think-time behavior, retry amplification, file/PDF sizes, cache-hit ratios, CPU/RSS/event-loop/connection pressure and first bottleneck on fixed fake datasets. Phase 9 validates this model with average/stress/spike/soak/breakpoint tests. Native Windows and limited Linux/Compose are separate environments. A 2 CPU/4 GB VPS has not been measured or deployed.\n`;
}

export function verifyModel() {
  let checks = 0;
  const equal = (a, b) => { assert.equal(a, b); checks++; };
  equal(demand(journeys[0], 50_000).apiRps, 2500);
  equal(demand(journeys[1], 50_000).apiRps, 50_000 * 8 / 300);
  equal(demand(journeys[1], 50_000).readWriteRatio, '6:2');
  equal(demand(journeys[1], 50_000).uploadRps, 50_000 / 300);
  equal(demand(journeys[2], 50_000).apiRps, 50_000 * 5 / 60);
  equal(demand(journeys[3], 50_000).apiRps, 50_000 / 300);
  equal(demand(journeys[4], 50_000).apiRps, 50_000 * 2 / 300);
  equal(demand(journeys[5], 50_000).reportRps, 50_000 * 5 / 900);
  for (const n of [0, -1, .1, NaN, Infinity, 100_000_001]) { assert.throws(() => demand(journeys[0], n)); checks++; }
  for (const fraction of [-.01, 1.01, NaN, Infinity]) { assert.throws(() => demand(journeys[0], 100, fraction)); checks++; }
  equal(demand(journeys[0], 100, 0).apiRps, 0);
  equal(demand(journeys[0], 25_000).apiRps * 2, demand(journeys[0], 50_000).apiRps);
  equal(model().capacityValidated, false);
  assert(Math.abs(model().mixedPeak.cohorts.reduce((n, c) => n + c.activeFraction, 0) - 1) < Number.EPSILON * 2); checks++;
  assert.throws(() => demand({ cycleSeconds: 0, requests: [{}] }, 1)); checks++;
  const inventory = JSON.parse(readFileSync(path.join(root, 'docs/scalability/inventory.json'), 'utf8'));
  verifyRoutes(inventory); checks++;
  assert.throws(() => verifyRoutes({ routes: [] }), /Unmapped journey request/); checks++;
  assert.equal(documentModel(), documentModel()); checks++;
  assert(documentModel().includes('not telemetry or measured capacity')); checks++;
  return checks;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--verify') console.log(`Workload arithmetic, absent-feature distinction and route coverage: ${verifyModel()} checks passed.`);
  else if (args.length === 1 && args[0] === '--document') { writeFileSync(path.join(root, 'docs/scalability/WORKLOAD.md'), documentModel()); console.log('Workload assumptions documented; no capacity measurement claimed.'); }
  else if (args.length === 1 && args[0] === '--check-document') { assert.equal(readFileSync(path.join(root, 'docs/scalability/WORKLOAD.md'), 'utf8'), documentModel(), 'Stale workload document'); console.log('Workload document matches the model.'); }
  else if (!args.length || args.length === 2 && args[0] === '--users' && /^\d+$/.test(args[1])) console.log(JSON.stringify(model(args.length ? Number(args[1]) : 50_000), null, 2));
  else throw new Error('Usage: node scripts/scalability/workload-model.mjs [--verify | --document | --check-document | --users positive-integer]');
}
