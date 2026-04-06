import type { NextFunction, Request, Response } from "express";
import { AccountStatus } from "@prisma/client";

import { authCookieNames } from "../config/auth";
import { prisma } from "../config/prisma";
import { mapUserProfile, userWithActiveRolesInclude } from "../modules/users/users.mappers";
import { verifyAccessToken } from "../utils/tokens";

function extractAccessToken(request: Request) {
  const bearerToken = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice("Bearer ".length)
    : undefined;

  return bearerToken || (request.cookies[authCookieNames.accessToken] as string | undefined);
}

export async function authenticate(request: Request, response: Response, next: NextFunction) {
  const token = extractAccessToken(request);
  if (!token) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (payload.type !== "access") {
      response.status(401).json({ message: "Invalid access token." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: userWithActiveRolesInclude,
    });

    if (!user || user.status !== AccountStatus.ACTIVE) {
      response.status(401).json({ message: "Your account is not allowed to access this resource." });
      return;
    }

    const profile = mapUserProfile(user);

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
    response.status(401).json({ message: "Invalid or expired access token." });
  }
}
