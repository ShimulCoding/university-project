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
import type { AuditMetadata } from "../../audit/types/audit.types";
import { auditService } from "../../audit/services/audit.service";
import { rolesRepository } from "../../roles/repositories/roles.repository";
import { mapUserProfile } from "../../users/users.mappers";
import { usersRepository } from "../../users/repositories/users.repository";
import type { AuthSessionResult, ForgotPasswordInput, LoginInput, RegisterInput, ResetPasswordInput } from "../types/auth.types";
import { authRepository } from "../repositories/auth.repository";

function getRefreshTokenExpiryDate() {
  return new Date(Date.now() + durationToMs(env.REFRESH_TOKEN_TTL));
}

async function issueSession(
  userId: string,
  metadata?: AuditMetadata,
  db: DbClient = prisma,
): Promise<Pick<AuthSessionResult, "accessToken" | "refreshToken">> {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);

  await authRepository.createRefreshToken({
    userId,
    tokenHash: hashValue(refreshToken),
    expiresAt: getRefreshTokenExpiryDate(),
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  }, db);

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
    // The bootstrap endpoint must never be reachable in production.
    if (env.NODE_ENV === "production") {
      throw new AppError(404, "Not found.");
    }

    // Fast reject once we know the system has already been bootstrapped.
    if (bootstrapCompleted) {
      throw new AppError(404, "Not found.");
    }

    const totalUsers = await usersRepository.countUsers();

    if (totalUsers > 0) {
      bootstrapCompleted = true;
      throw new AppError(404, "Not found.");
    }

    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);

    const session = await prisma.$transaction(async (tx) => {
      await rolesRepository.syncCatalog(tx);

      const user = await usersRepository.createUser(
        {
          fullName: input.fullName.trim(),
          email,
          passwordHash,
          status: AccountStatus.ACTIVE,
        },
        tx,
      );

      const systemAdminRole = await rolesRepository.findByCode(RoleCode.SYSTEM_ADMIN, tx);

      if (!systemAdminRole) {
        throw new AppError(500, "System administrator role is unavailable.");
      }

      await rolesRepository.createAssignment(
        {
          userId: user.id,
          roleId: systemAdminRole.id,
        },
        tx,
      );

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
    });

    await auditService.record({
      actorId: session.user.id,
      action: "auth.bootstrap_admin",
      entityType: "User",
      entityId: session.user.id,
      summary: `Bootstrapped initial system admin ${session.user.email}`,
      ...auditMetadata,
    });

    return session;
  },

  async register(input: RegisterInput, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    const email = normalizeEmail(input.email);
    const passwordHash = await hashPassword(input.password);
    const studentId = input.studentId.trim();

    const existingStudent = await usersRepository.findByStudentId(studentId);
    if (existingStudent) {
      throw new AppError(409, "An account with this Student ID already exists.");
    }

    const session = await prisma.$transaction(async (tx) => {
      await rolesRepository.syncCatalog(tx);

      const user = await usersRepository.createUser(
        {
          fullName: input.fullName.trim(),
          email,
          passwordHash,
          studentId,
          batch: input.batch.trim(),
          department: input.department.trim(),
          section: input.section.trim(),
          status: AccountStatus.ACTIVE,
        },
        tx,
      );

      const studentRole = await rolesRepository.findByCode(RoleCode.GENERAL_STUDENT, tx);

      if (!studentRole) {
        throw new AppError(500, "General student role is unavailable.");
      }

      await rolesRepository.createAssignment(
        {
          userId: user.id,
          roleId: studentRole.id,
        },
        tx,
      );

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
    });

    await auditService.record({
      actorId: session.user.id,
      action: "auth.register",
      entityType: "User",
      entityId: session.user.id,
      summary: `Registered user ${session.user.email}`,
      ...auditMetadata,
    });

    return session;
  },

  async login(input: LoginInput, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    const user = await usersRepository.findByStudentId(input.studentId.trim());

    if (!user) {
      throw new AppError(401, "Invalid Student ID or password.");
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "Invalid Student ID or password.");
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new AppError(403, "This account is not active.");
    }

    const updatedUser = await usersRepository.updateLastLogin(user.id);
    const tokens = await issueSession(user.id, auditMetadata);

    await auditService.record({
      actorId: user.id,
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      summary: `Student login via ID ${input.studentId}`,
      ...auditMetadata,
    });

    return {
      user: mapUserProfile(updatedUser),
      ...tokens,
    };
  },

  async internalLogin(input: { email: string; password: string }, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    const email = normalizeEmail(input.email);
    const user = await usersRepository.findByEmail(email);

    if (!user) {
      throw new AppError(401, "Invalid email or password.");
    }

    const passwordMatches = await verifyPassword(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "Invalid email or password.");
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new AppError(403, "This account is not active.");
    }

    const updatedUser = await usersRepository.updateLastLogin(user.id);
    const tokens = await issueSession(user.id, auditMetadata);

    await auditService.record({
      actorId: user.id,
      action: "auth.internal_login",
      entityType: "User",
      entityId: user.id,
      summary: `Internal login as ${user.email}`,
      ...auditMetadata,
    });

    return {
      user: mapUserProfile(updatedUser),
      ...tokens,
    };
  },

  async forgotPassword(input: ForgotPasswordInput, auditMetadata?: AuditMetadata) {
    const user = await usersRepository.findByStudentId(input.studentId.trim());

    if (!user) {
      throw new AppError(404, "No account found with this Student ID.");
    }

    const normalizedInputEmail = normalizeEmail(input.email);
    if (user.email !== normalizedInputEmail) {
      throw new AppError(400, "The email does not match the account registered with this Student ID.");
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new AppError(403, "This account is not active.");
    }

    // Generate token
    const { randomBytes } = await import("crypto");
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = hashValue(rawToken);

    // Set expiry to 1 hour from now
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await authRepository.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetLink = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    await mailer.sendPasswordResetEmail(user.email, resetLink);

    await auditService.record({
      actorId: user.id,
      action: "auth.forgot_password_request",
      entityType: "User",
      entityId: user.id,
      summary: `Password reset requested for Student ID ${input.studentId}`,
      ...auditMetadata,
    });

    return { message: "If the details are correct, a password reset link has been sent to your email." };
  },

  async resetPassword(input: ResetPasswordInput, auditMetadata?: AuditMetadata) {
    const tokenHash = hashValue(input.token);
    const tokenRecord = await authRepository.findPasswordResetTokenByHash(tokenHash);

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
    
    // Perform update and mark token used
    await usersRepository.updatePassword(tokenRecord.userId, newPasswordHash);
    await authRepository.markPasswordResetTokenAsUsed(tokenRecord.id);

    await auditService.record({
      actorId: tokenRecord.userId,
      action: "auth.reset_password",
      entityType: "User",
      entityId: tokenRecord.userId,
      summary: `Password reset completed using token`,
      ...auditMetadata,
    });

    return { message: "Password has been reset successfully. You can now sign in with your new password." };
  },

  async refreshSession(refreshToken: string | undefined, auditMetadata?: AuditMetadata): Promise<AuthSessionResult> {
    if (!refreshToken) {
      throw new AppError(401, "Refresh token is required.");
    }

    let payload;

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AppError(401, "Refresh token is invalid or expired.");
    }

    if (payload.type !== "refresh") {
      throw new AppError(401, "Invalid refresh token.");
    }

    const tokenHash = hashValue(refreshToken);
    const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
      throw new AppError(401, "Refresh token is invalid or expired.");
    }

    if (storedToken.user.status !== AccountStatus.ACTIVE) {
      throw new AppError(403, "This account is not active.");
    }

    const result = await prisma.$transaction(async (tx) => {
      await authRepository.revokeRefreshToken(storedToken.id, tx);
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
    });

    await auditService.record({
      actorId: result.user.id,
      action: "auth.refresh",
      entityType: "User",
      entityId: result.user.id,
      summary: `Refreshed session for ${result.user.email}`,
      ...auditMetadata,
    });

    return result;
  },

  async logout(
    refreshToken: string | undefined,
    actorId?: string,
    auditMetadata?: AuditMetadata,
  ) {
    if (!refreshToken) {
      return;
    }

    try {
      verifyRefreshToken(refreshToken);
    } catch {
      return;
    }

    const tokenHash = hashValue(refreshToken);
    const storedToken = await authRepository.findRefreshTokenByHash(tokenHash);

    if (!storedToken || storedToken.revokedAt) {
      return;
    }

    await authRepository.revokeRefreshToken(storedToken.id);

    await auditService.record({
      actorId: actorId ?? storedToken.userId,
      action: "auth.logout",
      entityType: "RefreshToken",
      entityId: storedToken.id,
      summary: `Logged out refresh session for ${storedToken.user.email}`,
      ...auditMetadata,
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
    const email = normalizeEmail(newEmail);

    const existingUser = await usersRepository.findByEmail(email);
    if (existingUser && existingUser.id !== userId) {
      throw new AppError(409, "This email is already in use by another account.");
    }

    const updatedUser = await usersRepository.updateEmail(userId, email);

    await auditService.record({
      actorId: userId,
      action: "auth.update_email",
      entityType: "User",
      entityId: userId,
      summary: `Updated email to ${email}`,
      ...auditMetadata,
    });

    return mapUserProfile(updatedUser);
  },
};
