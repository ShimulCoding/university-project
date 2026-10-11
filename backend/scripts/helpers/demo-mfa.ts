export class DemoMfaPrerequisiteError extends Error {}

function codes() {
  try {
    const input = process.env.VERIFY_DEMO_MFA_CODES_JSON;
    if (!input || input.length > 8192) throw new Error();
    const value: unknown = JSON.parse(input);
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.values(value).some((code) => typeof code !== "string" || code.trim().length < 6 || code.trim().length > 80)) throw new Error();
    return value as Record<string, string>;
  } catch { throw new DemoMfaPrerequisiteError("Supply VERIFY_DEMO_MFA_CODES_JSON privately for enrolled local demo accounts; use verify:event-workspaces for isolated verification."); }
}

export function assertLocalDemoPrerequisites(baseUrl: string, identities: string[]) {
  const url = new URL(baseUrl);
  if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new DemoMfaPrerequisiteError("Existing-demo verification is restricted to the local loopback instance.");
  const provided = codes();
  if (identities.some((identity) => !Object.hasOwn(provided, identity.trim().toLowerCase()))) throw new DemoMfaPrerequisiteError("Provide a current authenticator or one-use recovery code for every existing demo privileged account. No automatic enrollment is performed.");
}

export async function completeDemoLogin(baseUrl: string, identity: string, response: Response, body: Record<string, unknown> | null, cookieHeader: (response: Response) => string) {
  if (!response.ok) throw new Error(`Demo password verification failed (${response.status}); response details suppressed.`);
  let result = body; let sessionResponse = response;
  if (result?.mfaRequired === true) {
    if (result.mode !== "VERIFY") throw new DemoMfaPrerequisiteError("The existing demo account must complete supervised MFA enrollment before this verifier can use it.");
    const provided = codes(); const key = identity.trim().toLowerCase();
    const code = Object.hasOwn(provided, key) ? provided[key] : undefined;
    if (!code) throw new DemoMfaPrerequisiteError("An explicit current MFA code is required for this local demo account.");
    const pending = cookieHeader(response);
    if (!pending) throw new Error("Demo MFA challenge did not supply its pending cookie.");
    sessionResponse = await fetch(`${baseUrl}/api/auth/mfa/verify`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: pending }, body: JSON.stringify({ code: code.trim() }) });
    if (!sessionResponse.ok) throw new Error(`Demo MFA verification failed (${sessionResponse.status}); response details suppressed.`);
    result = await sessionResponse.json() as Record<string, unknown>;
  }
  const cookie = cookieHeader(sessionResponse);
  if (!result?.user || result.mfaRequired || !cookie) throw new Error("Demo authentication did not complete a full session.");
  return { cookieHeader: cookie, body: result };
}
