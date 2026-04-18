import { AccountStatus, RoleCode } from "@prisma/client";

import { env } from "../../../config/env";
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
import type { AuthSessionResult, LoginInput, RegisterInput } from "../types/auth.types";
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
      action: "auth.login",
      entityType: "User",
      entityId: user.id,
      summary: `Logged in as ${user.email}`,
      ...auditMetadata,
    });

    return {
      user: mapUserProfile(updatedUser),
      ...tokens,
    };
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
};
