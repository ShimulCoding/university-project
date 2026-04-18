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
    const createData = {
      userId: data.userId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      ...(data.userAgent ? { userAgent: data.userAgent } : {}),
      ...(data.ipAddress ? { ipAddress: data.ipAddress } : {}),
    };

    const token = await db.refreshToken.create({
      data: createData,
    });

    // Probabilistic cleanup: ~10% of token creations trigger a prune of
    // expired and revoked tokens to keep the table from growing unboundedly.
    if (Math.random() < 0.1) {
      void authRepository.pruneStaleTokens();
    }

    return token;
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
   * Fire-and-forget — errors are silently swallowed so this never blocks auth flows.
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
      // Best-effort cleanup only — never block auth flows.
    }
  },
};
