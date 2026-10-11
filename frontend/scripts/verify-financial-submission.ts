import assert from "node:assert/strict";
import { FinancialSubmission } from "../src/lib/api/financial-submission";
import { ApiError } from "../src/lib/api/shared";

async function main() {
  const originalFetch = globalThis.fetch;
  let checks = 0;
  const check = (condition: unknown, message: string) => { assert(condition, message); checks++; };
  const calls: { key: string; body: FormData }[] = [];
  let status = 201, offline = false;
  globalThis.fetch = async (_input, init) => {
    calls.push({ key: new Headers(init?.headers).get("Idempotency-Key")!, body: init?.body as FormData });
    if (offline) throw new TypeError("Synthetic lost response");
    return new Response(JSON.stringify({ message: "Synthetic response", incomeRecord: { id: "same-record" } }), { status });
  };
  try {
    const action = new FinancialSubmission();
    const body = new FormData(); body.set("amount", "10.00"); body.set("evidenceFile", new Blob(["%PDF-1.4"], { type: "application/pdf" }), "evidence.pdf");
    offline = true;
    await assert.rejects(() => action.submit("/payments/income-records", body), (error: ApiError) => error.status === 503); checks++;
    check(action.isUnresolved, "Lost response did not lock submission");
    const originalKey = calls[0]!.key;
    check(/^[0-9a-f-]{36}$/.test(originalKey), "Random key missing");
    body.set("amount", "99.00");
    offline = false; status = 429;
    await assert.rejects(() => action.submit("/payments/income-records", body)); checks++;
    check(action.isUnresolved, "Later rate limit forgot uncertain commit");
    check(calls[1]!.key === originalKey && calls[1]!.body.get("amount") === "10.00", "Retry changed key or original payload");
    check((calls[1]!.body.get("evidenceFile") as File).name === "evidence.pdf", "Retry lost uploaded evidence");
    await assert.rejects(() => action.submit("/requests/expense-records", body), (error: ApiError) => error.status === 409); checks++;
    check(calls.length === 2, "Unresolved operation moved to another endpoint");
    status = 201;
    await action.submit("/payments/income-records", new FormData());
    check(calls[2]!.key === originalKey && calls[2]!.body.get("amount") === "10.00", "Uncertain retry did not preserve original");
    check(!action.isUnresolved, "Confirmed success stayed locked");
    await action.submit("/payments/income-records", body);
    check(calls[3]!.key !== originalKey && calls[3]!.body.get("amount") === "99.00", "New operation reused previous key/body");
    status = 400;
    await assert.rejects(() => action.submit("/payments/income-records", body)); checks++;
    check(!action.isUnresolved, "Known initial validation error locked editing");
    const rejectedKey = calls[4]!.key;
    status = 201;
    await action.submit("/payments/income-records", body);
    check(calls[5]!.key !== rejectedKey, "Corrected rejected operation reused key");

    const refreshed = new FinancialSubmission(); let expired = true;
    const retryKeys: string[] = [];
    globalThis.fetch = async (input, init) => {
      if (String(input).endsWith("/auth/me")) return new Response("{}", { status: 401 });
      if (String(input).endsWith("/auth/refresh")) { expired = false; return new Response("{}", { status: 200 }); }
      retryKeys.push(new Headers(init?.headers).get("Idempotency-Key")!);
      return new Response("{}", { status: expired ? 401 : 201 });
    };
    await refreshed.submit("/payments/income-records", body);
    check(retryKeys.length === 2 && retryKeys[0] === retryKeys[1], "Session recovery changed financial key");
    check(!refreshed.isUnresolved, "Recovered session did not complete");
    console.log(`Financial submission client: ${checks} key/body/recovery/negative checks passed.`);
  } finally { globalThis.fetch = originalFetch; }
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
