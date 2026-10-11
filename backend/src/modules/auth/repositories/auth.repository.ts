import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { userWithActiveRolesInclude } from "../../users/users.mappers";
import { sanitizeAuditMetadata } from "../../../utils/audit-metadata";

export const authRepository = {
  async createRefreshToken(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      mfaVerifiedAt?: Date | null;
      userAgent?: string | undefined;
      ipAddress?: string | undefined;
    },
    db: DbClient = prisma,
  ) {
    const metadata = sanitizeAuditMetadata(data);
    return db.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        mfaVerifiedAt: data.mfaVerifiedAt ?? null,
        ...(metadata.userAgent ? { userAgent: metadata.userAgent } : {}),
        ...(metadata.ipAddress ? { ipAddress: metadata.ipAddress } : {}),
      },
    });
  },

  findRefreshTokenByHash(tokenHash: string, db: DbClient = prisma) {
    return db.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: userWithActiveRolesInclude,
        },
      },
    });
  },

  revokeActiveRefreshToken(tokenId: string, db: DbClient = prisma) {
    const revokedAt = new Date();

    return db.refreshToken.updateMany({
      where: {
        id: tokenId,
        revokedAt: null,
        expiresAt: { gt: revokedAt },
      },
      data: {
        revokedAt,
      },
    });
  },

  revokeActiveRefreshTokensForUser(userId: string, db: DbClient = prisma) {
    return db.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  /**
   * Remove refresh tokens that are expired or were revoked more than 24 hours ago.
   * Run outside request transactions so maintenance failures cannot abort sign-in.
   */
  async pruneStaleTokens() {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await prisma.mfaChallenge.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: { lt: oneDayAgo } }] } });

      await prisma.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { lt: oneDayAgo } },
          ],
        },
      });
      await prisma.passwordResetToken.deleteMany({
        where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { lt: oneDayAgo } }] },
      });
    } catch {
      // Best-effort cleanup only; never block auth flows.
    }
  },

  createPasswordResetToken(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
    },
    db: DbClient = prisma,
  ) {
    return db.passwordResetToken.create({
      data,
    });
  },

  findPasswordResetTokenByHash(tokenHash: string, db: DbClient = prisma) {
    return db.passwordResetToken.findUnique({
      where: { tokenHash },
    });
  },

  consumeActivePasswordResetToken(tokenId: string, db: DbClient = prisma) {
    const usedAt = new Date();

    return db.passwordResetToken.updateMany({
      where: {
        id: tokenId,
        usedAt: null,
        expiresAt: { gt: usedAt },
      },
      data: {
        usedAt,
      },
    });
  },

  invalidatePasswordResetTokensForUser(userId: string, db: DbClient = prisma) {
    return db.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  },
};
