import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { userWithActiveRolesInclude } from "../../users/users.mappers";

export const authRepository = {
  createRefreshToken(
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

    return db.refreshToken.create({
      data: createData,
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
};
