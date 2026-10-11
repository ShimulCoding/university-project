import { randomBytes } from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";
import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import type { AuthenticatedUser } from "../../../types/auth";
import { AppError } from "../../../utils/app-error";
import { hashValue } from "../../../utils/hash";
import { encryptMfaSecret, decryptMfaSecret } from "../../../utils/mfa-crypto";
import { governanceTransaction } from "../../../utils/governance-transaction";
import { assertPasswordBudget, verifyAccountPassword } from "./password-security";
import { auditService } from "../../audit/services/audit.service";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { mapUserProfile, userWithActiveRolesInclude, type UserWithActiveRoles } from "../../users/users.mappers";
import { usersRepository } from "../../users/repositories/users.repository";
import type { MfaChallengeResult } from "../types/auth.types";
import { issueSession, requiresPrivilegedMfa } from "./auth-session";

export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const failureMessage = "Invalid, expired or already used verification. Sign in again if necessary.";

async function activeChallenge(ticket: string | undefined, db: DbClient) {
  if (!ticket || !/^[a-f0-9]{64}$/.test(ticket)) throw new AppError(401, failureMessage);
  const challenge = await db.mfaChallenge.findUnique({ where: { tokenHash: hashValue(ticket) }, include: { user: { include: userWithActiveRolesInclude } } });
  if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date() || challenge.attempts >= 5 ||
      challenge.user.status !== "ACTIVE" || challenge.sessionVersion !== challenge.user.sessionVersion || !requiresPrivilegedMfa(challenge.user)) throw new AppError(401, failureMessage);
  // Shared database budget prevents new tickets or distributed IPs from
  // multiplying the six-digit guessing allowance. Failure audit and the
  // challenge attempt are committed together under serializable isolation.
  const failures = await db.auditLog.count({ where: { actorId: challenge.userId, action: { in: ["auth.mfa.verify_denied", "auth.mfa.enrollment_denied"] }, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } } });
  if (failures >= 10) throw new AppError(429, "Too many failed verification attempts. Try again after 15 minutes.");
  const profile = mapUserProfile(challenge.user);
  if (challenge.loginScope === "system" && !profile.roles.includes("SYSTEM_ADMIN")) throw new AppError(401, failureMessage);
  if (challenge.loginScope === "event" && (profile.roles.includes("SYSTEM_ADMIN") || !profile.eventRoles.some((role) => role.eventId === challenge.eventId))) throw new AppError(401, failureMessage);
  return challenge;
}

async function spendAttempt(id: string, db: DbClient) {
  const result = await db.mfaChallenge.updateMany({ where: { id, consumedAt: null, expiresAt: { gt: new Date() }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
  if (result.count !== 1) throw new AppError(401, failureMessage);
}

function recoveryHash(userId: string, code: string) { return hashValue(`${userId}:${code.replace(/[\s-]/g, "").toLowerCase()}`); }

// Operator-only helper. The HTTP entry point separately checks a currently
// authenticated System Admin, current password and an identity-check declaration.
export async function createEnrollmentGrant(userId: string, issuerId: string | undefined, metadata?: AuditMetadata, verifiedIssuer?: { passwordHash: string; sessionVersion: number }) {
  return governanceTransaction(async (tx) => {
    const user = await usersRepository.findById(userId, tx);
    if (!user || user.status !== "ACTIVE" || !requiresPrivilegedMfa(user)) throw new AppError(400, "Choose an active privileged account.");
    if (user.mfaFactor) throw new AppError(409, "This account already has MFA. Use an offline recovery code; enrollment cannot replace its factor.");
    if (issuerId) {
      await assertPasswordBudget(issuerId, tx);
      const issuer = await usersRepository.findById(issuerId, tx);
      if (!issuer || issuer.status !== "ACTIVE" || !mapUserProfile(issuer).roles.includes("SYSTEM_ADMIN") ||
          !verifiedIssuer || issuer.passwordHash !== verifiedIssuer.passwordHash || issuer.sessionVersion !== verifiedIssuer.sessionVersion) throw new AppError(403, "System Admin access required.");
    }
    await tx.mfaEnrollmentGrant.updateMany({ where: { userId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    const code = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const grant = await tx.mfaEnrollmentGrant.create({ data: { userId, issuedById: issuerId ?? null, tokenHash: hashValue(code), sessionVersion: user.sessionVersion, expiresAt } });
    await auditService.record({ actorId: issuerId, action: "auth.mfa.enrollment_grant", entityType: "User", entityId: userId, summary: "Issued one-use MFA enrollment authorization after supervised identity check.", context: { grantId: grant.id, operatorIssued: !issuerId }, ...metadata }, tx);
    return { code, expiresAt };
  });
}

export const mfaService = {
  async cancelChallenge(ticket: string | undefined, metadata?: AuditMetadata) {
    if (!ticket || !/^[a-f0-9]{64}$/.test(ticket)) return;
    await governanceTransaction(async (tx) => {
      const challenge = await tx.mfaChallenge.findUnique({ where: { tokenHash: hashValue(ticket) } });
      if (!challenge || challenge.consumedAt) return;
      await tx.mfaChallenge.update({ where: { id: challenge.id }, data: { consumedAt: new Date(), pendingEncryptedSecret: null } });
      await auditService.record({ actorId: challenge.userId, action: "auth.mfa.cancelled", entityType: "User", entityId: challenge.userId, summary: "Cancelled pending sign-in verification.", ...metadata }, tx);
    });
  },
  async beginChallenge(user: UserWithActiveRoles, loginScope: "student" | "system" | "event", eventId: string | undefined, metadata: AuditMetadata | undefined, db: DbClient): Promise<MfaChallengeResult> {
    // Password-stage challenges do not update lastLoginAt. Lock the account
    // snapshot explicitly so concurrent credential/status changes force a
    // transaction retry instead of accepting the stale password snapshot.
    await db.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR SHARE`;
    const ticket = randomBytes(32).toString("hex");
    const mode = user.mfaFactor ? "VERIFY" : "ENROLL";
    await db.mfaChallenge.create({ data: { userId: user.id, tokenHash: hashValue(ticket), sessionVersion: user.sessionVersion, loginScope, eventId: eventId ?? null, mode, expiresAt: new Date(Date.now() + MFA_CHALLENGE_TTL_MS) } });
    await auditService.record({ actorId: user.id, action: "auth.mfa.challenge", entityType: "User", entityId: user.id, summary: "Password verified; second factor required before session issuance.", context: { mode, loginScope, ...(eventId ? { eventId } : {}) }, ...metadata }, db);
    return { mfaRequired: true, mode, ticket, user: mapUserProfile(user) };
  },

  async issueEnrollmentGrant(actor: AuthenticatedUser, userId: string, currentPassword: string, metadata?: AuditMetadata) {
    const current = await verifyAccountPassword(await usersRepository.findById(actor.id), currentPassword, "Current administrator password required.", metadata, 403);
    if (current.status !== "ACTIVE" || !actor.roles.includes("SYSTEM_ADMIN")) throw new AppError(403, "Current administrator password required.");
    // Role/status rechecked again inside the grant transaction.
    return createEnrollmentGrant(userId, actor.id, metadata, { passwordHash: current.passwordHash, sessionVersion: current.sessionVersion });
  },

  async startEnrollment(ticket: string | undefined, enrollmentCode: string, metadata?: AuditMetadata) {
    const result = await governanceTransaction(async (tx) => {
      const challenge = await activeChallenge(ticket, tx);
      await spendAttempt(challenge.id, tx);
      if (challenge.mode !== "ENROLL" || challenge.user.mfaFactor) return null;
      const grant = await tx.mfaEnrollmentGrant.findUnique({ where: { tokenHash: hashValue(enrollmentCode) } });
      if (!grant || grant.userId !== challenge.userId || grant.sessionVersion !== challenge.sessionVersion || grant.usedAt || grant.revokedAt || grant.expiresAt <= new Date()) {
        await auditService.record({ actorId: challenge.userId, action: "auth.mfa.enrollment_denied", entityType: "User", entityId: challenge.userId, summary: "Invalid enrollment authorization.", ...metadata }, tx);
        return null;
      }
      // Keep one secret per ticket. Retrying setup must not silently switch the authenticator.
      const secret = challenge.pendingEncryptedSecret ? decryptMfaSecret(challenge.pendingEncryptedSecret, challenge.userId) : generateSecret();
      await tx.mfaChallenge.update({ where: { id: challenge.id }, data: { pendingEncryptedSecret: encryptMfaSecret(secret, challenge.userId), enrollmentGrantId: grant.id } });
      return { secret, uri: generateURI({ issuer: "MU CSE Transparency", label: challenge.user.email, secret }) };
    });
    if (!result) throw new AppError(401, failureMessage);
    return result;
  },

  async verifyChallenge(ticket: string | undefined, code: string, metadata?: AuditMetadata) {
    const outcome = await governanceTransaction(async (tx) => {
      const challenge = await activeChallenge(ticket, tx);
      await spendAttempt(challenge.id, tx);
      const factor = await tx.mfaFactor.findUnique({ where: { userId: challenge.userId } });
      const enrolling = challenge.mode === "ENROLL";
      let verified = false; let timeStep: number | undefined; let recoveryCodes: string[] | undefined;
      if (enrolling && factor) throw new AppError(401, failureMessage);
      const encrypted = enrolling ? challenge.pendingEncryptedSecret : factor?.encryptedSecret;
      if (encrypted && /^\d{6}$/.test(code)) {
        const result = await verify({ secret: decryptMfaSecret(encrypted, challenge.userId), token: code, epochTolerance: [30, 0], ...(factor?.lastTimeStep == null ? {} : { afterTimeStep: factor.lastTimeStep }) });
        if (result.valid && "timeStep" in result) { verified = true; timeStep = result.timeStep; }
      } else if (!enrolling && factor && /^[a-f0-9]{32}$/.test(code.replace(/[\s-]/g, "").toLowerCase())) {
        const used = await tx.mfaRecoveryCode.updateMany({ where: { userId: challenge.userId, codeHash: recoveryHash(challenge.userId, code), usedAt: null }, data: { usedAt: new Date() } });
        verified = used.count === 1;
      }
      if (!verified) {
        await auditService.record({ actorId: challenge.userId, action: "auth.mfa.verify_denied", entityType: "User", entityId: challenge.userId, summary: "Second factor rejected.", ...metadata }, tx);
        return null;
      }
      if (enrolling) {
        const grant = challenge.enrollmentGrantId ? await tx.mfaEnrollmentGrant.findUnique({ where: { id: challenge.enrollmentGrantId } }) : null;
        if (!grant || grant.userId !== challenge.userId || grant.sessionVersion !== challenge.sessionVersion || grant.usedAt || grant.revokedAt || grant.expiresAt <= new Date()) throw new AppError(401, failureMessage);
        const consumed = await tx.mfaEnrollmentGrant.updateMany({ where: { id: grant.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
        if (consumed.count !== 1) throw new AppError(401, failureMessage);
        await tx.mfaFactor.create({ data: { userId: challenge.userId, encryptedSecret: challenge.pendingEncryptedSecret!, lastTimeStep: timeStep ?? null } });
        recoveryCodes = Array.from({ length: 8 }, () => randomBytes(16).toString("hex").match(/.{4}/g)!.join("-"));
        await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((value) => ({ userId: challenge.userId, codeHash: recoveryHash(challenge.userId, value) })) });
        await tx.refreshToken.updateMany({ where: { userId: challenge.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.user.update({ where: { id: challenge.userId }, data: { sessionVersion: { increment: 1 } } });
      } else if (timeStep !== undefined) {
        const advanced = await tx.mfaFactor.updateMany({ where: { userId: challenge.userId, lastTimeStep: factor!.lastTimeStep }, data: { lastTimeStep: timeStep } });
        if (advanced.count !== 1) throw new AppError(401, failureMessage);
      }
      const consumed = await tx.mfaChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date(), pendingEncryptedSecret: null } });
      if (consumed.count !== 1) throw new AppError(401, failureMessage);
      const user = await usersRepository.updateLastLogin(challenge.userId, tx);
      const tokens = await issueSession(user.id, metadata, tx, new Date());
      await auditService.record({ actorId: user.id, action: enrolling ? "auth.mfa.enrolled" : "auth.mfa.verified", entityType: "User", entityId: user.id, summary: "Multifactor sign-in completed.", context: { loginScope: challenge.loginScope, ...(challenge.eventId ? { eventId: challenge.eventId } : {}) }, ...metadata }, tx);
      return { user: mapUserProfile(user), ...tokens, ...(recoveryCodes ? { recoveryCodes } : {}) };
    });
    if (!outcome) throw new AppError(401, failureMessage);
    return outcome;
  },
};
