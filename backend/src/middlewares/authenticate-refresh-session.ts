import type { NextFunction, Request, Response } from "express";
import { AccountStatus } from "@prisma/client";

import { authCookieNames } from "../config/auth";
import { authRepository } from "../modules/auth/repositories/auth.repository";
import { mapUserProfile } from "../modules/users/users.mappers";
import { hashValue } from "../utils/hash";
import { verifyRefreshToken } from "../utils/tokens";

export async function authenticateRefreshSession(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const refreshToken = request.cookies[authCookieNames.refreshToken] as string | undefined;

  if (!refreshToken) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const payload = verifyRefreshToken(refreshToken);

    if (payload.type !== "refresh") {
      response.status(401).json({ message: "Invalid refresh token." });
      return;
    }

    const storedToken = await authRepository.findRefreshTokenByHash(hashValue(refreshToken));

    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.expiresAt <= new Date() ||
      storedToken.userId !== payload.sub ||
      storedToken.user.status !== AccountStatus.ACTIVE
    ) {
      response.status(401).json({ message: "Invalid or expired refresh token." });
      return;
    }

    const profile = mapUserProfile(storedToken.user);

    request.auth = {
      userId: profile.id,
      roles: profile.roles,
      user: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        status: profile.status,
        roles: profile.roles,
      },
    };

    next();
  } catch {
    response.status(401).json({ message: "Invalid or expired refresh token." });
  }
}
