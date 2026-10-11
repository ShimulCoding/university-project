import assert from "node:assert/strict";
import { pieSlices } from "../src/lib/charts";
import { apiFetchClient, recoverClientSession } from "../src/lib/api/client";
import { accessCookieExpired } from "../src/lib/session";
import { formatMoney } from "../src/lib/format";

async function main() {
  const originalFetch = globalThis.fetch;
  let refreshed = false, rotations = 0, initial = 0;
  globalThis.fetch = async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/auth/me")) return new Response("{}", { status: refreshed ? 200 : 401 });
    if (path.endsWith("/auth/refresh")) {
      rotations++;
      await new Promise((resolve) => setTimeout(resolve, 25));
      refreshed = true;
      return new Response("{}", { status: 200 });
    }
    if (!refreshed) { initial++; return new Response("{}", { status: 401 }); }
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  };
  try {
    const results = await Promise.all(["/protected", "/protected", "/auth/mfa/enrollment-grants"].map((route) => apiFetchClient<{ success: boolean }>(route)));
    assert(results.every((result) => result.success));
    assert.equal(initial, 3);
    assert.equal(rotations, 1, "Concurrent requests rotated the same refresh token more than once");
    await recoverClientSession();
    assert.equal(rotations, 1, "A current session was unnecessarily rotated");

    let refreshAttempts = 0;
    globalThis.fetch = async (input) => {
      if (String(input).includes("/auth/refresh")) refreshAttempts++;
      return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 });
    };
    for (const path of ["/auth/login", "/auth/internal-login", "/auth/event-team-login", "/auth/register", "/auth/forgot-password", "/auth/reset-password", "/auth/logout", "/auth/mfa/verify", "/auth/mfa/start-enrollment"]) {
      await assert.rejects(() => apiFetchClient(path), (e: { status: number }) => e.status === 401);
    }
    assert.equal(refreshAttempts, 0, "Credential/recovery/logout failures triggered session rotation");

    const signal = new AbortController();
    let added = 0, removed = 0;
    const add = signal.signal.addEventListener.bind(signal.signal), remove = signal.signal.removeEventListener.bind(signal.signal);
    signal.signal.addEventListener = (...args: Parameters<AbortSignal["addEventListener"]>) => { added++; return add(...args); };
    signal.signal.removeEventListener = (...args: Parameters<AbortSignal["removeEventListener"]>) => { removed++; return remove(...args); };
    globalThis.fetch = async () => new Response("{}", { status: 200 });
    await apiFetchClient("/protected", { signal: signal.signal });
    assert.equal(added, removed, "Caller abort listeners leaked after completion");
    const waiting = new AbortController();
    let finishRefresh: (value: Response) => void = () => {};
    let refreshStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => { refreshStarted = resolve; });
    globalThis.fetch = async (input) => {
      if (String(input).includes("/auth/refresh")) {
        refreshStarted();
        return new Promise<Response>((resolve) => { finishRefresh = resolve; });
      }
      return new Response("{}", { status: 401 });
    };
    const cancelled = apiFetchClient("/protected", { signal: waiting.signal });
    await started;
    waiting.abort();
    await assert.rejects(() => cancelled, (e: { status: number }) => e.status === 408);
    finishRefresh(new Response("{}", { status: 200 }));
    await recoverClientSession();
    globalThis.fetch = async (_input, init) => {
      if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      return new Response("{}");
    };
    signal.abort();
    await assert.rejects(() => apiFetchClient("/protected", { signal: signal.signal }), (e: { status: number }) => e.status === 408);
    assert(accessCookieExpired(undefined));
    assert(accessCookieExpired("malformed"));
    const jwt = (exp: number) => `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
    assert(accessCookieExpired(jwt(1)));
    assert(!accessCookieExpired(jwt(Math.floor(Date.now() / 1000) + 60)));
    assert.equal(formatMoney("9999999999999999.99"), "৳ 9,999,999,999,999,999.99");
    assert.equal(formatMoney("-0.01"), "৳ -0.01");
    assert.deepEqual(pieSlices(["100", "0"]), [{ index: 0, startAngle: 0, endAngle: 360 }]);
    assert.deepEqual(pieSlices(["0", "0"]), []);
    const slices = pieSlices(["9999999999999999.99", "0.01", "0"]);
    assert.equal(slices.length, 2);
    assert.equal(slices.at(-1)?.endAngle, 360);
    assert(slices.every((slice) => slice.endAngle >= slice.startAngle && slice.endAngle <= 360));
    console.log("Client API verification passed: refresh sharing, auth exclusions, abort cleanup, recovery hints, and exact monetary display.");
  } finally { globalThis.fetch = originalFetch; }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
