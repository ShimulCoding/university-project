import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { fixturePrisma, verifyFixtureDatabase, disconnectFixtureDatabase, fixtureFailureDiagnostics } from "./helpers/fixture-database";
import { hashPassword } from "../src/utils/password";
import { authService } from "../src/modules/auth/services/auth.service";
import { mfaService } from "../src/modules/auth/services/mfa.service";
import { usersService } from "../src/modules/users/services/users.service";
import { createFixtureMfa } from "./helpers/mfa-fixtures";
import { hashValue } from "../src/utils/hash";
import { verifyAccessToken } from "../src/utils/tokens";
import type { AuthSessionResult } from "../src/modules/auth/types/auth.types";

const run = randomUUID(); const users: string[] = []; let step = "setup"; let checks = 0;
async function main() {
  await verifyFixtureDatabase();
  const server = createApp().listen(0, "127.0.0.1"); const update = usersService.updateProfile;
  let release: (() => void) | undefined;
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    const password = `Synthetic-${run}!`;
    const admin = await prisma.user.create({ data: { fullName: "Session boundary fixture", email: `session-boundary-${run}@example.invalid`, passwordHash: await hashPassword(password), roles: { create: { role: { connect: { code: "SYSTEM_ADMIN" } } } } } }); users.push(admin.id);
    const codes = await createFixtureMfa(admin, run);
    const challenge = await authService.internalLogin({ email: admin.email, password }); assert("mfaRequired" in challenge);
    const session = await mfaService.verifyChallenge(challenge.ticket, codes[0]!);
    assert.equal((await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${session.accessToken}` } })).status, 200); checks++;
    let enter!: () => void;
    const entered = new Promise<void>((resolve) => { enter = resolve; });
    const paused = new Promise<void>((resolve) => { release = resolve; });
    usersService.updateProfile = async (...args) => { enter(); await paused; return update(...args); };
    const pending = fetch(`${base}/users/${admin.id}/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "Revoked session must not write" }) });
    await entered;
    await authService.logout(session.refreshToken);
    step = "a session revoked after authentication must not enter a mutation transaction";
    release();
    assert.equal((await pending).status, 403); checks++;
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).fullName, admin.fullName); checks++;
    assert.equal(await prisma.auditLog.count({ where: { actorId: admin.id, action: "users.profile.update" } }), 0); checks++;
    let currentPassword = password;
    async function nextSession(index: number) {
      const nextChallenge = await authService.internalLogin({ email: admin.email, password: currentPassword }); assert("mfaRequired" in nextChallenge);
      return mfaService.verifyChallenge(nextChallenge.ticket, codes[index]!);
    }
    async function stoppedMutation(value: AuthSessionResult, invalidate: () => Promise<unknown>, label: string) {
      step = label;
      let reached!: () => void;
      const reachedBoundary = new Promise<void>((resolve) => { reached = resolve; });
      const gate = new Promise<void>((resolve) => { release = resolve; });
      usersService.updateProfile = async (...args) => { reached(); await gate; return update(...args); };
      const attempt = fetch(`${base}/users/${admin.id}/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${value.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ fullName: label }) });
      await reachedBoundary; await invalidate(); release!();
      assert.equal((await attempt).status, 403); checks++;
      assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).fullName, admin.fullName); checks++;
      assert.equal(await prisma.auditLog.count({ where: { actorId: admin.id, action: "users.profile.update" } }), 0); checks++;
    }
    const resetSession = await nextSession(1);
    await stoppedMutation(resetSession, async () => {
      const token = `reset-${run}`; currentPassword = `New-${run}!`;
      await prisma.passwordResetToken.create({ data: { userId: admin.id, tokenHash: hashValue(token), expiresAt: new Date(Date.now() + 60000) } });
      await authService.resetPassword({ token, newPassword: currentPassword });
    }, "Password reset before transaction rejects stale authority");
    const expiredSession = await nextSession(2);
    await stoppedMutation(expiredSession, () => prisma.refreshToken.update({ where: { id: verifyAccessToken(expiredSession.accessToken).sessionId! }, data: { expiresAt: new Date(Date.now() - 1000) } }), "Session expiration before transaction rejects stale authority");
    const oldAssurance = await nextSession(3);
    await stoppedMutation(oldAssurance, () => prisma.refreshToken.update({ where: { id: verifyAccessToken(oldAssurance.accessToken).sessionId! }, data: { mfaVerifiedAt: new Date(Date.now() - 13 * 60 * 60 * 1000) } }), "Expired MFA assurance before transaction rejects stale authority");
    usersService.updateProfile = update;
    const valid = await nextSession(4);
    const positive = await fetch(`${base}/users/${admin.id}/profile`, { method: "PATCH", headers: { Authorization: `Bearer ${valid.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "Legitimate updated profile" }) });
    assert.equal(positive.status, 200); checks++;
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).fullName, "Legitimate updated profile"); checks++;
    assert.equal(await prisma.auditLog.count({ where: { actorId: admin.id, action: "users.profile.update" } }), 1); checks++;
    assert.equal((await fetch(`${base}/users/${admin.id}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: "Unbound request cannot inherit another context" }) })).status, 401); checks++;
    await usersService.updateProfile(admin.id, admin.id, { fullName: "Trusted isolated service operation" }); checks++;
    console.log(`Session transaction boundary: ${checks} checks passed.`);
  } finally {
    release?.(); usersService.updateProfile = update;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await fixturePrisma.auditLog.deleteMany({ where: { actorId: { in: users } } }); await fixturePrisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect(); await disconnectFixtureDatabase();
  }
}
void main().catch((error: unknown) => { console.error(JSON.stringify(fixtureFailureDiagnostics(error))); process.exitCode = 1; });
