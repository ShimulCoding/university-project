import assert from "node:assert/strict";
import { assertLocalDemoPrerequisites, completeDemoLogin, DemoMfaPrerequisiteError } from "./helpers/demo-mfa";

async function main() {
  const fetchOriginal = globalThis.fetch; const prior = process.env.VERIFY_DEMO_MFA_CODES_JSON;
  let checks = 0; let calls = 0;
  const cookie = (response: Response) => response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  const challenge = () => new Response(null, { status: 200, headers: { "Set-Cookie": "pending=fixture; HttpOnly" } });
  const completed = () => new Response(JSON.stringify({ user: { id: "fixture-user" } }), { status: 200, headers: { "Set-Cookie": "access=fixture; HttpOnly" } });
  const verifyBody = { mfaRequired: true, mode: "VERIFY" };
  try {
    process.env.VERIFY_DEMO_MFA_CODES_JSON = JSON.stringify({ "fixture-admin": "123456" });
    assertLocalDemoPrerequisites("http://localhost:4000", ["fixture-admin"]); checks++;
    assert.throws(() => assertLocalDemoPrerequisites("https://example.invalid", ["fixture-admin"]), DemoMfaPrerequisiteError); checks++;
    assert.throws(() => assertLocalDemoPrerequisites("http://localhost:4000", ["constructor"]), DemoMfaPrerequisiteError); checks++;
    globalThis.fetch = async (url, init) => {
      calls++; assert.equal(String(url), "http://localhost:4000/api/auth/mfa/verify"); checks++;
      assert.equal(init?.headers && (init.headers as Record<string, string>).Cookie, "pending=fixture"); checks++;
      assert.equal(JSON.parse(String(init?.body)).code, "123456"); checks++;
      return completed();
    };
    const result = await completeDemoLogin("http://localhost:4000", "fixture-admin", challenge(), verifyBody, cookie);
    assert.equal(result.cookieHeader, "access=fixture"); checks++;
    assert.equal(calls, 1); checks++;
    const basic = await completeDemoLogin("http://localhost:4000", "fixture-admin", completed(), { user: { id: "fixture-user" } }, cookie);
    assert.equal(basic.cookieHeader, "access=fixture"); assert.equal(calls, 1); checks++;
    await assert.rejects(() => completeDemoLogin("http://localhost:4000", "fixture-admin", challenge(), { mfaRequired: true, mode: "ENROLL" }, cookie), DemoMfaPrerequisiteError); checks++;
    await assert.rejects(() => completeDemoLogin("http://localhost:4000", "missing", challenge(), verifyBody, cookie), DemoMfaPrerequisiteError); checks++;
    delete process.env.VERIFY_DEMO_MFA_CODES_JSON;
    await assert.rejects(() => completeDemoLogin("http://localhost:4000", "fixture-admin", challenge(), verifyBody, cookie), DemoMfaPrerequisiteError); checks++;
    process.env.VERIFY_DEMO_MFA_CODES_JSON = "malformed";
    assert.throws(() => assertLocalDemoPrerequisites("http://localhost:4000", ["fixture-admin"]), DemoMfaPrerequisiteError); checks++;
    process.env.VERIFY_DEMO_MFA_CODES_JSON = JSON.stringify({ "fixture-admin": "123456" });
    globalThis.fetch = async () => new Response(JSON.stringify({ message: "SYNTHETIC_PRIVATE_RESPONSE" }), { status: 401 });
    await assert.rejects(() => completeDemoLogin("http://localhost:4000", "fixture-admin", challenge(), verifyBody, cookie), (error: Error) => error.message.includes("401") && !error.message.includes("SYNTHETIC_PRIVATE_RESPONSE")); checks++;
    await assert.rejects(() => completeDemoLogin("http://localhost:4000", "fixture-admin", new Response(null, { status: 200 }), verifyBody, cookie)); checks++;
    globalThis.fetch = async () => new Response(JSON.stringify({ mfaRequired: true, mode: "VERIFY" }), { status: 200, headers: { "Set-Cookie": "pending=fixture" } });
    await assert.rejects(() => completeDemoLogin("http://localhost:4000", "fixture-admin", challenge(), verifyBody, cookie)); checks++;
    console.log(`Existing-demo MFA contract: ${checks} checks passed.`);
  } finally { globalThis.fetch = fetchOriginal; if (prior === undefined) delete process.env.VERIFY_DEMO_MFA_CODES_JSON; else process.env.VERIFY_DEMO_MFA_CODES_JSON = prior; }
}
void main().catch(() => { console.error("Existing-demo MFA contract verification failed. Private details suppressed."); process.exitCode = 1; });
