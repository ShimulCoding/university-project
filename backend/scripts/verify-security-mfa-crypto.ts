import assert from "node:assert/strict";
import { encryptMfaSecret, decryptMfaSecret } from "../src/utils/mfa-crypto";

function main() {
  const encrypted = encryptMfaSecret("SYNTHETIC_FACTOR_FOR_FORMAT_TEST", "fixture-user");
  const parts = encrypted.split(":");
  parts[2] = Buffer.from(parts[2]!, "base64").subarray(0, 4).toString("base64");
  assert.throws(() => decryptMfaSecret(parts.join(":"), "fixture-user"), "Truncated GCM tag was accepted");
  let checks = 1;
  function rejects(value: string, user = "fixture-user") { assert.throws(() => decryptMfaSecret(value, user)); checks++; }
  assert.equal(decryptMfaSecret(encrypted, "fixture-user"), "SYNTHETIC_FACTOR_FOR_FORMAT_TEST"); checks++;
  rejects(encrypted, "another-user");
  for (const index of [1, 2, 3]) {
    const tampered = encrypted.split(":"); const bytes = Buffer.from(tampered[index]!, "base64"); bytes[0] = bytes[0]! ^ 1;
    tampered[index] = bytes.toString("base64"); rejects(tampered.join(":"));
  }
  for (const index of [1, 2, 3]) { const malformed = encrypted.split(":"); malformed[index] += "!"; rejects(malformed.join(":")); }
  rejects(encrypted.replace(/^v1:/, "v2:")); rejects(`${encrypted}:extra`); rejects("x".repeat(3000));
  assert.throws(() => encryptMfaSecret("x".repeat(1025), "fixture-user")); checks++;
  assert.throws(() => encryptMfaSecret("", "fixture-user")); checks++;
  assert.notEqual(encrypted, encryptMfaSecret("SYNTHETIC_FACTOR_FOR_FORMAT_TEST", "fixture-user")); checks++;
  console.log(`MFA cryptographic envelope: ${checks} checks passed.`);
}
try { main(); } catch { console.error("MFA cryptographic envelope verification failed. Private details suppressed."); process.exitCode = 1; }
