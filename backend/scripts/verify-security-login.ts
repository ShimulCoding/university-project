import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../src/config/prisma";
import { env } from "../src/config/env";
import { hashPassword } from "../src/utils/password";
import { authService } from "../src/modules/auth/services/auth.service";
import { verifyAccountPassword, PASSWORD_FAILURE_LIMIT, PASSWORD_FAILURE_WINDOW_MS } from "../src/modules/auth/services/password-security";
import { auditService } from "../src/modules/audit/services/audit.service";

const run = randomUUID(); const users: string[] = []; let step = "setup"; let checks = 0;
async function main() {
  const compare = bcrypt.compare; const record = auditService.record;
  try {
    const password = `Synthetic-${run}!`;
    const user = await prisma.user.create({ data: { fullName: "Login security fixture", email: `login-${run}@example.invalid`, studentId: `L${run.slice(0, 20)}`, passwordHash: await hashPassword(password), roles: { create: { role: { connect: { code: "SYSTEM_ADMIN" } } } } } }); users.push(user.id);
    step = "shared account budget must reject a correct password after distributed failures";
    for (let index = 0; index < 10; index++) {
      const action = index % 3 === 0 ? () => authService.login({ studentId: user.studentId!, password: "Wrong-password!" }) : index % 3 === 1 ? () => authService.internalLogin({ email: user.email, password: "Wrong-password!" }) : () => authService.eventTeamLogin({ email: user.email, password: "Wrong-password!", eventLookupKey: "irrelevant" });
      await assert.rejects(action, (error: { statusCode?: number }) => error.statusCode === 401); checks++;
    }
    await assert.rejects(() => authService.internalLogin({ email: user.email, password }), (error: { statusCode?: number }) => error.statusCode === 429); checks++;
    function check(value: unknown, label: string) { step = label; assert(value, label); checks++; }
    async function denied(action: () => Promise<unknown>, status = 401) { await assert.rejects(action, (error: { statusCode?: number }) => error.statusCode === status); checks++; }
    check(await prisma.auditLog.count({ where: { actorId: user.id, action: "auth.password.denied" } }) === PASSWORD_FAILURE_LIMIT, "Denials persist across all login aliases");
    await denied(() => authService.login({ studentId: user.studentId!, password }), 429);
    await denied(() => verifyAccountPassword(user, password, "Denied", undefined, 403), 429);
    check(await prisma.refreshToken.count({ where: { userId: user.id } }) === 0, "Locked identity issues no session");
    check(await prisma.mfaChallenge.count({ where: { userId: user.id } }) === 0, "Locked identity issues no MFA ticket");
    await prisma.auditLog.updateMany({ where: { actorId: user.id, action: "auth.password.denied" }, data: { createdAt: new Date(Date.now() - PASSWORD_FAILURE_WINDOW_MS - 1000) } });
    check("mfaRequired" in await authService.internalLogin({ email: user.email, password }), "Budget expires without permanently locking legitimate users");
    let comparedHash: string | undefined;
    bcrypt.compare = ((value: string, digest: string) => { comparedHash = digest; return compare(value, digest); }) as typeof bcrypt.compare;
    await denied(() => authService.internalLogin({ email: `missing-${run}@example.invalid`, password }));
    check(!!comparedHash && bcrypt.getRounds(comparedHash) === env.BCRYPT_SALT_ROUNDS, "Unknown identity performs configured-cost bcrypt");
    const firstDummy = comparedHash; comparedHash = undefined;
    await denied(() => authService.login({ studentId: `missing-${run}`, password }));
    check(comparedHash === firstDummy, "Unknown student identity uses the same dummy verification path");
    bcrypt.compare = compare;
    const concurrent = await prisma.user.create({ data: { fullName: "Concurrent login fixture", email: `login-race-${run}@example.invalid`, studentId: `R${run.slice(0, 20)}`, passwordHash: user.passwordHash } }); users.push(concurrent.id);
    for (let index = 0; index < 8; index++) await denied(() => authService.login({ studentId: concurrent.studentId!, password: "Wrong-password!" }));
    step = "parallel guesses share one atomic account budget";
    const race = await Promise.allSettled(Array.from({ length: 6 }, () => authService.login({ studentId: concurrent.studentId!, password: "Wrong-password!" })));
    check(race.every((value) => value.status === "rejected" && [401, 429].includes((value.reason as { statusCode?: number }).statusCode!)), "Parallel failed guesses never issue a session");
    check(await prisma.auditLog.count({ where: { actorId: concurrent.id, action: "auth.password.denied" } }) === PASSWORD_FAILURE_LIMIT, "Parallel denial count cannot exceed its allowance");
    await denied(() => authService.login({ studentId: concurrent.studentId!, password }), 429);
    const rollback = await prisma.user.create({ data: { fullName: "Login audit fixture", email: `login-rollback-${run}@example.invalid`, studentId: `A${run.slice(0, 20)}`, passwordHash: user.passwordHash } }); users.push(rollback.id);
    auditService.record = async () => { throw new Error("Synthetic audit failure"); };
    await assert.rejects(() => authService.login({ studentId: rollback.studentId!, password: "Wrong-password!" })); checks++;
    auditService.record = record;
    check(await prisma.auditLog.count({ where: { actorId: rollback.id } }) === 0, "Failed audit rolls back the denial write and fails closed");
    check("accessToken" in await authService.login({ studentId: rollback.studentId!, password }), "Normal student sign-in remains available");
    await denied(() => verifyAccountPassword(rollback, "Wrong-password!", "Wrong password", undefined, 403), 403);
    check(await prisma.auditLog.count({ where: { actorId: rollback.id, action: "auth.password.denied" } }) === 1, "Sensitive password reauthentication shares the login budget");
    console.log(`Password guessing security: ${checks} checks passed.`);
  } finally {
    bcrypt.compare = compare; auditService.record = record;
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } }); await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect();
  }
}
void main().catch(() => { console.error(`Password guessing verification failed at: ${step}. Private details suppressed.`); process.exitCode = 1; });
