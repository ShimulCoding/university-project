import assert from "node:assert/strict";
import { createApp } from "../src/app";
import { env } from "../src/config/env";

async function main() {
  const server = createApp().listen(0, "127.0.0.1");
  let checks = 0;
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    assert.equal((await fetch(base + "/health")).status, 200); checks++;
    const allowed = env.corsOrigins[0]!;
    const response = await fetch(base + "/health", { headers: { Origin: allowed } });
    assert.equal(response.status, 200); checks++;
    assert.equal(response.headers.get("access-control-allow-origin"), allowed); checks++;
    assert.equal(response.headers.get("access-control-allow-credentials"), "true"); checks++;
    for (const origin of ["http://localhost:3009", "http://localhost:4000", "http://127.0.0.1:3008", "https://attacker.example.invalid", "null", `${allowed}.attacker.example.invalid`]) {
      if (env.corsOrigins.includes(origin)) continue;
      const denied = await fetch(base + "/api/auth/signup", { method: "POST", headers: { Origin: origin, "Content-Type": "application/json" }, body: "{}" });
      assert.equal(denied.status, 403); checks++;
      assert.equal(denied.headers.get("access-control-allow-origin"), null); checks++;
    }
    const options = await fetch(base + "/api/auth/signup", { method: "OPTIONS", headers: { Origin: allowed, "Access-Control-Request-Method": "POST" } });
    assert.equal(options.status, 204); checks++;
    assert.equal(options.headers.get("access-control-allow-origin"), allowed); checks++;
    console.log(`Exact-origin CORS: ${checks} real HTTP boundary checks passed.`);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}
void main().catch(() => { console.error("CORS verification failed; request details suppressed."); process.exitCode = 1; });
