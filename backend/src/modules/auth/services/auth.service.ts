import { governanceTransaction, sessionTransaction } from "../../../utils/governance-transaction";
import { AccountStatus, RoleCode } from "@prisma/client";

import { env } from "../../../config/env";
import { mailer } from "../../../config/mailer";
import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { AppError } from "../../../utils/app-error";
import { durationToMs } from "../../../utils/duration";
import { hashValue } from "../../../utils/hash";
import { normalizeEmail } from "../../../utils/normalize-email";
import { hashPassword, verifyPassword } from "../../../utils/password";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../../utils/tokens";
import { eventScopedInternalRoles } from "../../../utils/event-scope";
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { rolesRepository } from "../../roles/repositories/roles.repository";
import { mapUserProfile } from "../../users/users.mappers";
import { usersRepository } from "../../users/repositories/users.repository";
import type {
  AuthSessionResult,
  EventTeamLoginInput,
  ForgotPasswordInput,
  InternalLoginInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "../types/auth.types";
import { authRepository } from "../repositories/auth.repository";

function getRefreshTokenExpiryDate() {
  return new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_TTL));
}

const passwordResetRequestMessage =
  "If the details are correct, a password reset link has been sent to your email.";

type LoginUser = NonNullable<Awaited<ReturnType<typeof usersRepository.findById>>>;

async function verifyLoginCredentials(user: LoginUser | null, password: string, message: string) {
  if (!user || !await verifyPassword(password, user.passwordHash)) {
    throw new AppError(401, message);
  }
  return user;
}

async function currentLoginUser(verified: LoginUser, db: DbClient, message: string) {
  const user = await usersRepository.findById(verified.id, db);
  if (!user || user.passwordHash !== verified.passwordHash || user.email !== verified.email || user.studentId !== verified.studentId) {
    throw new AppError(401, message);
  }
  if (user.status !== AccountStatus.ACTIVE) {
    throw new AppError(403, "This account is not active.");
  }
  return user;
}

async function issueSession(
  userId: string,
  metadata?: AuditMetadata,
  db: DbClient = prisma,
): Promise<Pick<AuthSessionResult, "accessToken" | "refreshToken">> {
  const refreshToken = signRefreshToken(userId);
  const user = await usersRepository.findById(userId, db);
  if (!user || user.status !== AccountStatus.ACTIVE) throw new AppError(401, "This account is not active.");

  const session = await authRepository.createRefreshToken({
    userId,
    tokenHash: hashValue(refreshToken),
    expiresAt: getRefreshTokenExpiryDate(),
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  }, db);
  const accessToken = signAccessToken(userId, user.sessionVersion, session.id);

  return {
    accessToken,
    refreshToken,
  };
}

// In-memory flag: once bootstrap has been attempted and users exist, skip the
// COUNT(*) query on every subsequent call.  Reset only on process restart.
let bootstrapCompleted = false;

export const authService = {
  async bootstrapAdmin(input: RegisterInput, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    return governanceTransaction(async (tx) => {
      // The bootstrap endpoint must never be reachable in production.
      if (env.NODE_ENV === "production") {
        throw new AppError(404, "Not found.");
      }
      // Fast reject once we know the system has already been bootstrapped.
      if (bootstrapCompleted) {
        throw new AppError(404, "Not found.");
      }
      const totalUsers = await usersRepository.countUsers(tx);
      if (totalUsers > 0) {
        bootstrapCompleted = true;
        throw new AppError(404, "Not found.");
      }
      const email = normalizeEmail(input.email);
      const passwordHash = await hashPassword(input.password);
      const session = await (async () => {
        await rolesRepository.syncCatalog(tx);
        const user = await usersRepository.createUser({
          fullName: input.fullName.trim(),
          email,
          passwordHash,
          status: AccountStatus.ACTIVE,
        }, tx);
        const systemAdminRole = await rolesRepository.findByCode(RoleCode.SYSTEM_ADMIN, tx);
        if (!systemAdminRole) {
          throw new AppError(500, "System administrator role is unavailable.");
        }
        await rolesRepository.createAssignment({
          userId: user.id,
          roleId: systemAdminRole.id,
        }, tx);
        await usersRepository.updateLastLogin(user.id, tx);
        const freshUser = await usersRepository.findById(user.id, tx);
        if (!freshUser) {
          throw new AppError(500, "Failed to load the bootstrap admin user.");
        }
        const tokens = await issueSession(user.id, auditMetadata, tx);
        return {
          user: mapUserProfile(freshUser),
          ...tokens,
        };
      })();
      await auditService.record({
        actorId: session.user.id,
        action: "auth.bootstrap_admin",
        entityType: "User",
        entityId: session.user.id,
        summary: `Bootstrapped initial system admin ${session.user.email}`,
        ...auditMetadata,
      }, tx);
      return session;
    });
  },

  async register(input: RegisterInput, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    const studentId = input.studentId.trim();
    // Friendly preflight outside the transaction; unique indexes remain the
    // authoritative check for concurrent email/Student ID registration.
    const existingStudent = await usersRepository.findByStudentId(studentId);
    if (existingStudent) {
      throw new AppError(409, "An account with this Student ID already exists.");
    }
    const passwordHash = await hashPassword(input.password);
    return governanceTransaction(async (tx) => {
      const email = normalizeEmail(input.email);
      const session = await (async () => {
        await rolesRepository.syncCatalog(tx);
        const user = await usersRepository.createUser({
          fullName: input.fullName.trim(),
          email,
          passwordHash,
          studentId,
          batch: input.batch.trim(),
          department: input.department.trim(),
          section: input.section.trim(),
          status: AccountStatus.ACTIVE,
        }, tx);
        const studentRole = await rolesRepository.findByCode(RoleCode.GENERAL_STUDENT, tx);
        if (!studentRole) {
          throw new AppError(500, "General student role is unavailable.");
        }
        await rolesRepository.createAssignment({
          userId: user.id,
          roleId: studentRole.id,
        }, tx);
        await usersRepository.updateLastLogin(user.id, tx);
        const freshUser = await usersRepository.findById(user.id, tx);
        if (!freshUser) {
          throw new AppError(500, "Failed to load the newly registered user.");
        }
        const tokens = await issueSession(user.id, auditMetadata, tx);
        return {
          user: mapUserProfile(freshUser),
          ...tokens,
        };
      })();
      await auditService.record({
        actorId: session.user.id,
        action: "auth.register",
        entityType: "User",
        entityId: session.user.id,
        summary: `Registered user ${session.user.email}`,
        ...auditMetadata,
      }, tx);
      return session;
    });
  },

  async login(input: LoginInput, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    // Keep expensive bcrypt work outside the write transaction.
    // Credentials and current permissions are rechecked on its snapshot.
    const message = "Invalid Student ID or password.";
    const verified = await verifyLoginCredentials(await usersRepository.findByStudentId(input.studentId.trim()), input.password, message);
    return sessionTransaction(async (tx) => {
      const user = await currentLoginUser(verified, tx, message);
      const updatedUser = await usersRepository.updateLastLogin(user.id, tx);
      const tokens = await issueSession(user.id, auditMetadata, tx);
      await auditService.record({
        actorId: user.id,
        action: "auth.login",
        entityType: "User",
        entityId: user.id,
        summary: `Student login via ID ${input.studentId}`,
        ...auditMetadata,
      }, tx);
      return {
        user: mapUserProfile(updatedUser),
        ...tokens,
      };
    });
  },

  async internalLogin(input: InternalLoginInput, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    const message = "Invalid email or password.";
    const verified = await verifyLoginCredentials(await usersRepository.findByEmail(normalizeEmail(input.email)), input.password, message);
    return sessionTransaction(async (tx) => {
      const user = await currentLoginUser(verified, tx, message);
      const isSystemAdmin = user.roles.some((assignment) => assignment.role.code === RoleCode.SYSTEM_ADMIN);
      if (!isSystemAdmin) {
        throw new AppError(403, "This sign-in is reserved for the System Admin. Use the sign-in link for your assigned event.");
      }
      const updatedUser = await usersRepository.updateLastLogin(user.id, tx);
      const tokens = await issueSession(user.id, auditMetadata, tx);
      await auditService.record({
        actorId: user.id,
        action: "auth.internal_login",
        entityType: "User",
        entityId: user.id,
        summary: `Internal login as ${user.email}`,
        ...auditMetadata,
      }, tx);
      return {
        user: mapUserProfile(updatedUser),
        ...tokens,
      };
    });
  },

  async eventTeamLogin(
    input: EventTeamLoginInput,
    auditMetadata?: AuditMetadata,
  ): Promise<AuthSessionResult> {
    const message = "Invalid email or password.";
    const verified = await verifyLoginCredentials(await usersRepository.findByEmail(normalizeEmail(input.email)), input.password, message);
    return sessionTransaction(async (tx) => {
      const user = await currentLoginUser(verified, tx, message);
      const event = await tx.event.findFirst({
        where: {
          OR: [{ id: input.eventLookupKey }, { slug: input.eventLookupKey }],
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
      });
      if (!event) {
        throw new AppError(404, "Event not found.");
      }
      const hasActiveEventAssignment = user.eventTeamMemberships.some((membership) => membership.eventId === event.id &&
        eventScopedInternalRoles.some((roleCode) => roleCode === membership.roleCode));
      if (user.roles.some((assignment) => assignment.role.code === RoleCode.SYSTEM_ADMIN)) {
        throw new AppError(403, "System Admin accounts must use the System Admin sign-in.");
      }
      if (!hasActiveEventAssignment) {
        throw new AppError(403, "This account is not assigned to the selected event.");
      }
      const updatedUser = await usersRepository.updateLastLogin(user.id, tx);
      const tokens = await issueSession(user.id, auditMetadata, tx);
      await auditService.record({
        actorId: user.id,
        action: "auth.event_team_login",
        entityType: "Event",
        entityId: event.id,
        summary: `Opened event team session for ${event.title}`,
        context: {
          eventId: event.id,
          eventSlug: event.slug,
        },
        ...auditMetadata,
      }, tx);
      return {
        user: mapUserProfile(updatedUser),
        ...tokens,
      };
    });
  },

  async forgotPassword(input: ForgotPasswordInput, auditMetadata?: AuditMetadata) {
    const user = await usersRepository.findByStudentId(input.studentId.trim());
    const normalizedInputEmail = normalizeEmail(input.email);

    if (
      !user ||
      user.email !== normalizedInputEmail ||
      user.status !== AccountStatus.ACTIVE
    ) {
      return { message: passwordResetRequestMessage };
    }

    // Generate token
    const { randomBytes } = await import("crypto");
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashValue(rawToken);

    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    const resetLink = new URL("/reset-password", env.corsOrigins[0]);
    resetLink.searchParams.set("token", rawToken);

    try {
      const created = await governanceTransaction(async (tx) => {
        const currentUser = await usersRepository.findByStudentId(input.studentId.trim(), tx);
        if (!currentUser || currentUser.id !== user.id || currentUser.email !== normalizedInputEmail || currentUser.status !== AccountStatus.ACTIVE) return false;
        await authRepository.createPasswordResetToken({ userId: user.id, tokenHash, expiresAt }, tx);
        await auditService.record({
          actorId: user.id,
          action: "auth.forgot_password_request",
          entityType: "User",
          entityId: user.id,
          summary: `Password reset requested for Student ID ${input.studentId}`,
          ...auditMetadata,
        }, tx);
        return true;
      });
      if (created) void mailer.sendPasswordResetEmail(user.email, resetLink.toString()).catch(() => {
        console.error("Password recovery email delivery failed.");
      });
    } catch {
      // Recovery responses must not reveal whether matching account details exist.
      console.error("Password recovery request could not be completed.");
    }

    return { message: passwordResetRequestMessage };
  },

  async resetPassword(input: ResetPasswordInput, auditMetadata?: AuditMetadata) {
    return governanceTransaction(async (tx) => {
      const tokenHash = hashValue(input.token);
      const tokenRecord = await authRepository.findPasswordResetTokenByHash(tokenHash, tx);
      if (!tokenRecord) {
        throw new AppError(400, "Invalid or expired reset token.");
      }
      if (tokenRecord.usedAt) {
        throw new AppError(400, "This reset token has already been used.");
      }
      if (tokenRecord.expiresAt < new Date()) {
        throw new AppError(400, "This reset token has expired.");
      }
      const newPasswordHash = await hashPassword(input.newPassword);
      await (async () => {
        const consumedToken = await authRepository.consumeActivePasswordResetToken(tokenRecord.id, tx);
        if (consumedToken.count !== 1) {
          throw new AppError(400, "This reset token has already been used or expired.");
        }
        await usersRepository.updatePassword(tokenRecord.userId, newPasswordHash, tx);
        await authRepository.invalidatePasswordResetTokensForUser(tokenRecord.userId, tx);
        await authRepository.revokeActiveRefreshTokensForUser(tokenRecord.userId, tx);
      })();
      await auditService.record({
        actorId: tokenRecord.userId,
        action: "auth.reset_password",
        entityType: "User",
        entityId: tokenRecord.userId,
        summary: `Password reset completed using token`,
        ...auditMetadata,
      }, tx);
      return { message: "Password has been reset successfully. You can now sign in with your new password." };
    });
  },

  async refreshSession(refreshToken: string | undefined, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    return governanceTransaction(async (tx) => {
      if (!refreshToken) {
        throw new AppError(401, "Refresh token is required.");
      }
      let payload;
      try {
        payload = verifyRefreshToken(refreshToken);
      }
      catch {
        throw new AppError(401, "Refresh token is invalid or expired.");
      }
      if (payload.type !== "refresh") {
        throw new AppError(401, "Invalid refresh token.");
      }
      const tokenHash = hashValue(refreshToken);
      const storedToken = await authRepository.findRefreshTokenByHash(tokenHash, tx);
      if (!storedToken ||
        storedToken.revokedAt ||
        storedToken.expiresAt <= new Date() ||
        storedToken.userId !== payload.sub) {
        throw new AppError(401, "Refresh token is invalid or expired.");
      }
      if (storedToken.user.status !== AccountStatus.ACTIVE) {
        throw new AppError(403, "This account is not active.");
      }
      const result = await (async () => {
        const revokedToken = await authRepository.revokeActiveRefreshToken(storedToken.id, tx);
        if (revokedToken.count !== 1) {
          throw new AppError(401, "Refresh token has already been used or expired.");
        }
        await usersRepository.updateLastLogin(storedToken.userId, tx);
        const refreshedUser = await usersRepository.findById(storedToken.userId, tx);
        if (!refreshedUser) {
          throw new AppError(404, "User not found for refresh session.");
        }
        const tokens = await issueSession(refreshedUser.id, auditMetadata, tx);
        return {
          user: mapUserProfile(refreshedUser),
          ...tokens,
        };
      })();
      await auditService.record({
        actorId: result.user.id,
        action: "auth.refresh",
        entityType: "User",
        entityId: result.user.id,
        summary: `Refreshed session for ${result.user.email}`,
        ...auditMetadata,
      }, tx);
      return result;
    });
  },

  async logout(
    refreshToken: string | undefined,
    actorId?: string,
    auditMetadata?: AuditMetadata,
  ) {
    return governanceTransaction(async (tx) => {
      if (!refreshToken) {
        return;
      }
      let payload;
      try {
        payload = verifyRefreshToken(refreshToken);
      }
      catch {
        return;
      }
      if (payload.type !== "refresh") {
        return;
      }
      const tokenHash = hashValue(refreshToken);
      const storedToken = await authRepository.findRefreshTokenByHash(tokenHash, tx);
      if (!storedToken || storedToken.revokedAt || storedToken.userId !== payload.sub) {
        return;
      }
      const revokedToken = await authRepository.revokeActiveRefreshToken(storedToken.id, tx);
      if (revokedToken.count !== 1) {
        return;
      }
      await auditService.record({
        actorId: actorId ?? storedToken.userId,
        action: "auth.logout",
        entityType: "RefreshToken",
        entityId: storedToken.id,
        summary: `Logged out refresh session for ${storedToken.user.email}`,
        ...auditMetadata,
      }, tx);
    });
  },

  async getCurrentUser(userId: string) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "Authenticated user not found.");
    }

    return mapUserProfile(user);
  },

  async updateEmail(userId: string, newEmail: string, auditMetadata?: AuditMetadata) {
    return governanceTransaction(async (tx) => {
      const email = normalizeEmail(newEmail);
      const existingUser = await usersRepository.findByEmail(email, tx);
      if (existingUser && existingUser.id !== userId) {
        throw new AppError(409, "This email is already in use by another account.");
      }
      const updatedUser = await usersRepository.updateEmail(userId, email, tx);
      await authRepository.invalidatePasswordResetTokensForUser(userId, tx);
      await auditService.record({
        actorId: userId,
        action: "auth.update_email",
        entityType: "User",
        entityId: userId,
        summary: `Updated email to ${email}`,
        ...auditMetadata,
      }, tx);
      return mapUserProfile(updatedUser);
    });
  },
};
