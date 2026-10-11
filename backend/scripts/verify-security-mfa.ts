import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { generate, generateSecret } from "otplib";
import { RoleCode } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { hashPassword } from "../src/utils/password";
import { hashValue } from "../src/utils/hash";
import { signAccessToken, signRefreshToken } from "../src/utils/tokens";
import { decryptMfaSecret, encryptMfaSecret } from "../src/utils/mfa-crypto";
import { authService } from "../src/modules/auth/services/auth.service";
import { mfaService, createEnrollmentGrant } from "../src/modules/auth/services/mfa.service";
import { auditService } from "../src/modules/audit/services/audit.service";

const run = randomUUID(); const users: string[] = []; const events: string[] = [];
let checks = 0; let step = "setup";
function check(value: unknown, label: string) { step = label; assert(value, label); checks++; }
async function denied(action: () => Promise<unknown>, status = 401) { step = "negative service authorization"; await assert.rejects(action, (error: { statusCode?: number }) => error.statusCode === status); checks++; }
function cookies(response: Response) { return response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; "); }
async function main() {
  const server = createApp().listen(0, "127.0.0.1");
  const record = auditService.record;
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    async function http(route: string, cookie = "", body?: unknown, expected = 200) {
      step = `${route} expected HTTP ${expected}`;
      const response = await fetch(`${base}${route}`, { method: body === undefined ? "GET" : "POST", headers: { Cookie: cookie, ...(body === undefined ? {} : { "Content-Type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      assert.equal(response.status, expected); checks++;
      return response;
    }
    const password = `Synthetic-${run}!`; const passwordHash = await hashPassword(password);
    async function account(label: string, sys = false) {
      const role = sys ? await prisma.role.findUniqueOrThrow({ where: { code: RoleCode.SYSTEM_ADMIN } }) : null;
      const user = await prisma.user.create({ data: { fullName: "MFA isolated fixture", email: `mfa-${label}-${run}@example.invalid`, studentId: `M${run.slice(0, 18)}-${label}`, passwordHash, ...(role ? { roles: { create: { roleId: role.id } } } : {}) } }); users.push(user.id); return user;
    }
    const admin = await account("admin", true), student = await account("student"), throttled = await account("throttle", true);
    const event = await prisma.event.create({ data: { title: "MFA isolated fixture", slug: `mfa-${run}` } }); events.push(event.id);
    const roles = [RoleCode.EVENT_ADMIN, RoleCode.EVENT_MANAGEMENT_USER, RoleCode.FINANCIAL_CONTROLLER, RoleCode.ORGANIZATIONAL_APPROVER, RoleCode.COMPLAINT_REVIEW_AUTHORITY];
    for (const [index, roleCode] of roles.entries()) {
      const user = await account(`role${index}`);
      await prisma.eventTeamMember.create({ data: { userId: user.id, eventId: event.id, roleCode } });
      const result = await authService.login({ studentId: user.studentId!, password });
      check("mfaRequired" in result, "Every operational role requires MFA through student login");
      const eventLogin = await authService.eventTeamLogin({ email: user.email, password, eventLookupKey: event.slug });
      check("mfaRequired" in eventLogin, "Every operational role requires MFA through event login");
      check(await prisma.refreshToken.count({ where: { userId: user.id } }) === 0, "Password-only operational login issued no session");
    }
    const started = await http("/auth/internal-login", "", { email: admin.email, password });
    const challengeBody = await started.json(); const pendingCookie = cookies(started);
    check(challengeBody.mfaRequired && challengeBody.mode === "ENROLL" && !challengeBody.user, "Password-only admin response exposes only the challenge state");
    check(/HttpOnly/i.test(started.headers.getSetCookie().find((value) => value.startsWith("mu_mfa_challenge="))!), "Pending ticket is HttpOnly");
    check(started.headers.get("cache-control") === "private, no-store", "Authentication responses are not cached");
    check(await prisma.refreshToken.count({ where: { userId: admin.id } }) === 0, "Password-only admin login issued no session");
    await http("/auth/me", pendingCookie, undefined, 401);
    await http("/auth/mfa/verify", "", { code: "123456" }, 401);
    const alt = await authService.login({ studentId: admin.studentId!, password }); check("mfaRequired" in alt, "Admin cannot bypass MFA through student login");
    const challenge = await authService.internalLogin({ email: admin.email, password }); assert("mfaRequired" in challenge);
    const firstGrant = await createEnrollmentGrant(admin.id, undefined);
    const grant = await createEnrollmentGrant(admin.id, undefined);
    await denied(() => mfaService.startEnrollment(challenge.ticket, firstGrant.code));
    const setup = await mfaService.startEnrollment(challenge.ticket, grant.code);
    const pending = await prisma.mfaChallenge.findUniqueOrThrow({ where: { tokenHash: hashValue(challenge.ticket) } });
    check(pending.pendingEncryptedSecret !== setup.secret && decryptMfaSecret(pending.pendingEncryptedSecret!, admin.id) === setup.secret, "Pending factors are encrypted and recoverable only with their context");
    step = "factor ciphertext binds to account"; assert.throws(() => decryptMfaSecret(pending.pendingEncryptedSecret!, student.id)); checks++;
    const otp = await generate({ secret: setup.secret });
    const wrong = String((Number(otp) + 1) % 1000000).padStart(6, "0");
    await denied(() => mfaService.verifyChallenge(challenge.ticket, wrong));
    const enrolled = await mfaService.verifyChallenge(challenge.ticket, otp);
    check(enrolled.recoveryCodes?.length === 8, "Enrollment creates eight one-use recovery codes");
    check((await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashValue(enrolled.refreshToken) } })).mfaVerifiedAt !== null, "MFA assurance belongs to the server session");
    check((await prisma.mfaChallenge.findUniqueOrThrow({ where: { id: pending.id } })).pendingEncryptedSecret === null, "Consumed challenge clears its pending secret");
    check((await prisma.mfaEnrollmentGrant.findUniqueOrThrow({ where: { tokenHash: hashValue(grant.code) } })).usedAt !== null, "Enrollment grant is consumed");
    await denied(() => createEnrollmentGrant(admin.id, undefined), 409);
    await denied(() => mfaService.verifyChallenge(challenge.ticket, otp));
    await http("/auth/me", `mu_access_token=${enrolled.accessToken}`);
    for (const user of [admin, student]) await http("/auth/me", `mu_access_token=${signAccessToken(user.id)}`, undefined, 401);
    async function nextTicket(user = admin) { const result = await authService.internalLogin({ email: user.email, password }); assert("mfaRequired" in result); return result.ticket; }
    const replay = await nextTicket(); await denied(() => mfaService.verifyChallenge(replay, otp));
    const codes = enrolled.recoveryCodes!;
    check(!(await prisma.mfaRecoveryCode.findMany({ where: { userId: admin.id } })).some((row) => codes.includes(row.codeHash)), "Recovery storage contains hashes, not codes");
    await mfaService.verifyChallenge(replay, codes[0]!); checks++;
    await denied(async () => mfaService.verifyChallenge(await nextTicket(), codes[0]!));
    const [ticketA, ticketB] = await Promise.all([nextTicket(), nextTicket()]);
    const sessionsBefore = await prisma.refreshToken.count({ where: { userId: admin.id } });
    const race = await Promise.allSettled([mfaService.verifyChallenge(ticketA, codes[1]!), mfaService.verifyChallenge(ticketB, codes[1]!)]);
    check(race.filter((result) => result.status === "fulfilled").length === 1, "Concurrent recovery-code replay has one winner");
    check(await prisma.refreshToken.count({ where: { userId: admin.id } }) === sessionsBefore + 1, "Recovery race creates only one session");
    const sameTicket = await nextTicket();
    const ticketRace = await Promise.allSettled([mfaService.verifyChallenge(sameTicket, codes[2]!), mfaService.verifyChallenge(sameTicket, codes[3]!)]);
    check(ticketRace.filter((result) => result.status === "fulfilled").length === 1, "Concurrent ticket replay has one winner");
    const rollbackTicket = await nextTicket();
    auditService.record = async (input, db) => { if (input.action === "auth.mfa.verified") throw new Error("Synthetic audit failure"); return record(input, db); };
    step = "MFA audit rollback"; await assert.rejects(() => mfaService.verifyChallenge(rollbackTicket, codes[4]!)); checks++;
    auditService.record = record;
    check((await prisma.mfaRecoveryCode.findUniqueOrThrow({ where: { codeHash: hashValue(`${admin.id}:${codes[4]!.replaceAll("-", "")}`) } })).usedAt === null, "Audit failure rolls back code consumption");
    await mfaService.verifyChallenge(rollbackTicket, codes[4]!); checks++;
    const expired = await nextTicket(); await prisma.mfaChallenge.update({ where: { tokenHash: hashValue(expired) }, data: { expiresAt: new Date(0) } });
    await denied(() => mfaService.verifyChallenge(expired, codes[5]!));
    const cancelled = await nextTicket(); await mfaService.cancelChallenge(cancelled); await denied(() => mfaService.verifyChallenge(cancelled, codes[5]!));
    const refreshed = await authService.refreshSession(enrolled.refreshToken); checks++;
    await denied(() => authService.refreshSession(enrolled.refreshToken));
    const refreshedSession = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashValue(refreshed.refreshToken) } });
    await prisma.refreshToken.update({ where: { id: refreshedSession.id }, data: { mfaVerifiedAt: new Date(Date.now() - 13 * 60 * 60 * 1000) } });
    await http("/auth/me", `mu_access_token=${refreshed.accessToken}`, undefined, 401); await denied(() => authService.refreshSession(refreshed.refreshToken));
    // Existing student sessions cannot inherit assurance when promoted.
    const normal = await authService.login({ studentId: student.studentId!, password }); assert("accessToken" in normal);
    await http("/auth/me", `mu_access_token=${normal.accessToken}`);
    await prisma.eventTeamMember.create({ data: { userId: student.id, eventId: event.id, roleCode: RoleCode.FINANCIAL_CONTROLLER } });
    await http("/auth/me", `mu_access_token=${normal.accessToken}`, undefined, 401); await denied(() => authService.refreshSession(normal.refreshToken));
    // Ten failures across fresh tickets share one database-backed account budget.
    const throttleSecret = generateSecret(); await prisma.mfaFactor.create({ data: { userId: throttled.id, encryptedSecret: encryptMfaSecret(throttleSecret, throttled.id) } });
    const validThrottle = await generate({ secret: throttleSecret }); const badThrottle = String((Number(validThrottle) + 1) % 1000000).padStart(6, "0");
    for (let group = 0; group < 2; group++) { const ticket = await nextTicket(throttled); for (let attempt = 0; attempt < 5; attempt++) await denied(() => mfaService.verifyChallenge(ticket, badThrottle)); }
    const blocked = await nextTicket(throttled); await denied(() => mfaService.verifyChallenge(blocked, validThrottle), 429);
    const passwordTicket = await nextTicket(); const resetToken = `synthetic-reset-${run}`;
    await prisma.passwordResetToken.create({ data: { userId: admin.id, tokenHash: hashValue(resetToken), expiresAt: new Date(Date.now() + 60000) } });
    await authService.resetPassword({ token: resetToken, newPassword: `New-${run}!` }); checks++;
    await denied(() => mfaService.verifyChallenge(passwordTicket, codes[5]!));
    check(await prisma.mfaFactor.count({ where: { userId: admin.id } }) === 1, "Email password recovery does not disable MFA");
    const newLogin = await authService.internalLogin({ email: admin.email, password: `New-${run}!` }); check("mfaRequired" in newLogin && newLogin.mode === "VERIFY", "Recovered privileged password still requires enrolled MFA");
    await prisma.userRole.updateMany({ where: { userId: admin.id, revokedAt: null }, data: { revokedAt: new Date() } });
    const demoted = await authService.login({ studentId: admin.studentId!, password: `New-${run}!` });
    check("mfaRequired" in demoted && demoted.mode === "VERIFY", "Removing privileged roles does not disable an enrolled factor");
    console.log(`Privileged MFA: ${checks} checks passed.`);
  } finally {
    auditService.record = record;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.auditLog.deleteMany({ where: { OR: [{ actorId: { in: users } }, { entityId: { in: users } }, { eventId: { in: events } }] } });
    await prisma.event.deleteMany({ where: { id: { in: events } } }); await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect();
  }
}
void main().catch(() => { console.error(`MFA verification failed at: ${step}. Private details suppressed.`); process.exitCode = 1; });
