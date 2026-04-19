import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { userWithActiveRolesInclude } from "../../users/users.mappers";

export const authRepository = {
  async createRefreshToken(
    data: {
      userId: string;
      tokenHash: string;
      expiresAt: Date;
      userAgent?: string | undefined;
      ipAddress?: string | undefined;
    },
    db: DbClient = prisma,
  ) {
    await authRepository.pruneStaleTokens(db);

    return db.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        ...(data.userAgent ? { userAgent: data.userAgent } : {}),
        ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
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

  revokeRefreshToken(tokenId: string, db: DbClient = prisma) {
    return db.refreshToken.update({
      where: { id: tokenId },
      data: {
        revokedAt: new Date(),
      },
    });
  },

  updateRefreshTokenUsage(tokenId: string, db: DbClient = prisma) {
    return db.refreshToken.update({
      where: { id: tokenId },
      data: {
        lastUsedAt: new Date(),
      },
    });
  },

  /**
   * Remove refresh tokens that are expired or were revoked more than 24 hours ago.
   * Best-effort cleanup runs deterministically before issuing a new refresh token.
   */
  async pruneStaleTokens(db: DbClient = prisma) {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await db.refreshToken.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { revokedAt: { lt: oneDayAgo } },
          ],
        },
      });
    } catch {
      // Best-effort cleanup only; never block auth flows.
    }
  },
};
