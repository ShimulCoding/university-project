import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { hashPassword } from "../src/utils/password";
import { authService } from "../src/modules/auth/services/auth.service";
import { auditService } from "../src/modules/audit/services/audit.service";
import { mfaService } from "../src/modules/auth/services/mfa.service";
import { verifyAccessToken } from "../src/utils/tokens";
import { hashValue } from "../src/utils/hash";
import { createFixtureMfa } from "./helpers/mfa-fixtures";
import type { AuthSessionResult } from "../src/modules/auth/types/auth.types";

const run = randomUUID(); const users: string[] = []; let step = "setup"; let checks = 0;
async function main() {
  const server = createApp().listen(0, "127.0.0.1");
  const record = auditService.record;
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const password = `Synthetic-${run}!`;
    const user = await prisma.user.create({ data: { fullName: "Email security fixture", email: `email-${run}@example.invalid`, studentId: `E${run.slice(0, 20)}`, passwordHash: await hashPassword(password) } }); users.push(user.id);
    const session = await authService.login({ studentId: user.studentId!, password }); assert("accessToken" in session);
    step = "a stolen session must not change recovery email without the password";
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/update-email`, { method: "PATCH", headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ email: `attacker-${run}@example.invalid` }) });
    assert.equal(response.status, 400); checks++;
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email, user.email); checks++;
    function check(value: unknown, label: string) { step = label; assert(value, label); checks++; }
    function context(value: AuthSessionResult) { const payload = verifyAccessToken(value.accessToken); assert(payload.sessionId); return { userId: payload.sub, sessionId: payload.sessionId, sessionVersion: payload.version! }; }
    async function denied(action: () => Promise<unknown>, status = 403) { await assert.rejects(action, (error: { statusCode?: number }) => error.statusCode === status); checks++; }
    async function patch(body: unknown, token = session.accessToken, expected = 200) {
      step = `email PATCH expected ${expected}`;
      const result = await fetch(`http://127.0.0.1:${address.port}/api/auth/update-email`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      assert.equal(result.status, expected); checks++; return result;
    }
    await patch({ email: `attacker-${run}@example.invalid`, currentPassword: "Wrong-password!" }, undefined, 403);
    await patch({ email: `${"x".repeat(250)}@example.invalid`, currentPassword: password }, undefined, 400);
    const other = await prisma.user.create({ data: { fullName: "Email collision fixture", email: `other-${run}@example.invalid`, passwordHash: user.passwordHash } }); users.push(other.id);
    await patch({ email: other.email, currentPassword: password }, undefined, 409);
    const secondSession = await authService.login({ studentId: user.studentId!, password }); assert("accessToken" in secondSession);
    const reset = await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashValue(`reset-${run}`), expiresAt: new Date(Date.now() + 60000) } });
    auditService.record = async () => { throw new Error("Synthetic audit failure"); };
    step = "email, session and recovery writes roll back with audit failure";
    await assert.rejects(() => authService.updateEmail(context(session), `rollback-${run}@example.invalid`, password)); checks++;
    auditService.record = record;
    check((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email === user.email, "Audit failure preserves email");
    check((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).sessionVersion === user.sessionVersion, "Audit failure preserves account version");
    check(!((await prisma.refreshToken.findUniqueOrThrow({ where: { id: context(session).sessionId } })).revokedAt), "Audit failure preserves active session");
    check(!((await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: reset.id } })).usedAt), "Audit failure preserves recovery link");
    const target = `UPDATED-${run}@EXAMPLE.INVALID`;
    const changed = await patch({ email: target, currentPassword: password });
    check(changed.headers.getSetCookie().filter((value) => /Expires=Thu, 01 Jan 1970/i.test(value)).length === 3, "Successful change clears all authentication cookies");
    check(changed.headers.get("cache-control") === "private, no-store", "Email-change responses are private");
    const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    check(current.email === target.toLowerCase() && current.sessionVersion === user.sessionVersion + 1, "Email is normalized and account version advances");
    check(await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } }) === 0, "Every prior session is revoked");
    check(!!(await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: reset.id } })).usedAt, "Old recovery links are consumed");
    await patch({ email: user.email, currentPassword: password }, secondSession.accessToken, 401);
    await denied(() => authService.refreshSession(session.refreshToken), 401);
    await denied(() => authService.resetPassword({ token: `reset-${run}`, newPassword: `New-${run}!` }), 400);
    const fresh = await authService.login({ studentId: user.studentId!, password }); assert("accessToken" in fresh);
    step = "concurrent email changes have one winner";
    const raced = await Promise.allSettled([authService.updateEmail(context(fresh), `race-a-${run}@example.invalid`, password), authService.updateEmail(context(fresh), `race-b-${run}@example.invalid`, password)]);
    check(raced.filter((value) => value.status === "fulfilled").length === 1, "Concurrent changes cannot reuse a revoked session");
    check(raced.filter((value) => value.status === "rejected").every((value) => (value.reason as { statusCode?: number }).statusCode === 403), "Concurrent loser is denied after authority recheck");
    const unassured = await authService.login({ studentId: user.studentId!, password }); assert("accessToken" in unassured);
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "SYSTEM_ADMIN" } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
    await denied(() => authService.updateEmail(context(unassured), user.email, password));
    const codes = await createFixtureMfa(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }), run);
    const challenge = await authService.login({ studentId: user.studentId!, password }); assert("mfaRequired" in challenge);
    const assured = await mfaService.verifyChallenge(challenge.ticket, codes[0]!);
    const pending = await authService.login({ studentId: user.studentId!, password }); assert("mfaRequired" in pending);
    await patch({ email: `privileged-${run}@example.invalid`, currentPassword: password }, assured.accessToken);
    check(await prisma.mfaFactor.count({ where: { userId: user.id } }) === 1, "Changing email preserves the enrolled factor");
    await denied(() => mfaService.verifyChallenge(pending.ticket, codes[1]!), 401);
    const relogin = await authService.login({ studentId: user.studentId!, password }); check("mfaRequired" in relogin, "Legitimate privileged login still requires MFA after the change");
    console.log(`Recovery-email security: ${checks} checks passed.`);
  } finally {
    auditService.record = record;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect();
  }
}
void main().catch(() => { console.error(`Recovery-email verification failed at: ${step}. Private details suppressed.`); process.exitCode = 1; });
