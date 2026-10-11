import assert from "node:assert/strict";
import { createServer } from "node:http";
import { chromium } from "playwright";

const base = process.env.VERIFY_FRONTEND_BASE_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw new Error("Local frontend required.");

async function main() {
  let checks = 0;
  const first = await fetch(base + "/dashboard", { headers: { "x-nonce": "attacker-supplied", "Content-Security-Policy": "script-src 'unsafe-inline'" } });
  assert.equal(first.status, 200); checks++;
  const policy = first.headers.get("content-security-policy") || "";
  const nonce = policy.match(/'nonce-([A-Za-z0-9+/]{32})'/)?.[1]; assert(nonce); checks++;
  assert(!policy.includes("attacker-supplied") && !policy.includes("unsafe-eval")); checks++;
  assert(!policy.match(/script-src [^;]*unsafe-inline/)); checks++;
  assert.equal(first.headers.get("x-frame-options"), "DENY"); checks++;
  assert.equal(first.headers.get("referrer-policy"), "no-referrer"); checks++;
  assert.equal(first.headers.get("x-content-type-options"), "nosniff"); checks++;
  assert.equal(first.headers.get("x-powered-by"), null); checks++;
  assert(first.headers.get("cache-control")?.includes("no-store")); checks++;
  const html = await first.text();
  const scripts = Array.from(html.matchAll(/<script\b([^>]*)>/g));
  assert(scripts.length > 0 && scripts.every((entry) => entry[1]?.includes(`nonce="${nonce}"`))); checks++;
  const second = await fetch(base + "/dashboard");
  assert.notEqual(second.headers.get("content-security-policy")?.match(/'nonce-([^']+)'/)?.[1], nonce); checks++;

  const browser = await chromium.launch({ channel: process.env.VERIFY_BROWSER_CHANNEL || "msedge", headless: true });
  const parent = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<iframe src="${base}/dashboard" title="framing probe"></iframe>`);
  }).listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => parent.once("listening", resolve));
    const context = await browser.newContext(); const page = await context.newPage();
    await page.route(base + "/security-injection-probe", (route) => route.fulfill({ status: 200, headers: { "Content-Type": "text/html", "Content-Security-Policy": policy }, body: `<h1>Local synthetic injection probe</h1><script>window.syntheticAttack=1</script><script nonce="incorrect">window.syntheticAttack=2</script><img src="missing" onerror="window.syntheticAttack=3"><object data="${base}/dashboard"></object>` }));
    await page.goto(base + "/security-injection-probe"); await page.waitForLoadState("networkidle");
    assert.equal(await page.evaluate(() => (window as unknown as { syntheticAttack?: number }).syntheticAttack), undefined); checks++;
    await page.goto(base + "/dashboard");
    await page.getByLabel("Show password").click();
    assert.equal(await page.locator('input[autocomplete="current-password"]').getAttribute("type"), "text"); checks++;
    const address = parent.address(); assert(address && typeof address !== "string");
    await page.goto(`http://127.0.0.1:${address.port}`);
    await page.waitForLoadState("networkidle");
    assert(page.frames().slice(1).every((frame) => !frame.url().startsWith(base))); checks++;
    assert.equal(await page.frameLocator("iframe").getByRole("heading", { name: "System Admin sign in" }).count(), 0); checks++;
    console.log(`Production browser boundary: ${checks} HTTP/Edge negative and hydration checks passed.`);
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => parent.close((error) => error ? reject(error) : resolve()));
  }
}
void main().catch(() => { console.error("Browser boundary verification failed; private details suppressed."); process.exitCode = 1; });
