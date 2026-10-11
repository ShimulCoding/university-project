import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { generateSecret } from "otplib";
import { prisma } from "../../src/config/prisma";
import { encryptMfaSecret } from "../../src/utils/mfa-crypto";
import { hashValue } from "../../src/utils/hash";

// Fixture provisioning only: refuses accounts outside the caller's fresh run.
// Production authentication never imports this helper. HTTP tests still prove
// actual MFA verification with independent, one-use recovery codes.
export async function createFixtureMfa(user: { id: string; email: string }, runId: string) {
  assert(runId.length >= 32 && user.email.includes(runId), "MFA provisioning is restricted to this run's isolated accounts");
  await prisma.mfaFactor.create({ data: { userId: user.id, encryptedSecret: encryptMfaSecret(generateSecret(), user.id) } });
  const codes = Array.from({ length: 32 }, () => randomBytes(16).toString("hex"));
  await prisma.mfaRecoveryCode.createMany({ data: codes.map((code) => ({ userId: user.id, codeHash: hashValue(`${user.id}:${code}`) })) });
  return codes;
}
