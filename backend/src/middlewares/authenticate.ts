import type { NextFunction, Request, Response } from "express";
import { AccountStatus } from "@prisma/client";

import { authCookieNames } from "../config/auth";
import { prisma } from "../config/prisma";
import { mapUserProfile, userWithActiveRolesInclude } from "../modules/users/users.mappers";
import { verifyAccessToken } from "../utils/tokens";
import { hasCurrentMfaAssurance, requiresPrivilegedMfa } from "../modules/auth/services/auth-session";

function extractAccessToken(request: Request) {
  const bearerToken = request.headers.authorization?.startsWith("Bearer ")
    ? request.headers.authorization.slice("Bearer ".length)
    : undefined;

  return bearerToken || (request.cookies[authCookieNames.accessToken] as string | undefined);
}

export async function authenticate(request: Request, response: Response, next: NextFunction) {
  response.setHeader("Cache-Control", "private, no-store");
  const token = extractAccessToken(request);
  if (!token) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    response.status(401).json({ message: "Invalid or expired access token." });
    return;
  }
  try {

    if (payload.type !== "access") {
      response.status(401).json({ message: "Invalid access token." });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: userWithActiveRolesInclude,
    });

    const session = payload.sessionId ? await prisma.refreshToken.findUnique({ where: { id: payload.sessionId } }) : null;
    const invalidSession = !payload.sessionId || !session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= new Date();
    if (!user || user.status !== AccountStatus.ACTIVE || (payload.version ?? 0) !== user.sessionVersion || invalidSession) {
      response.status(401).json({ message: "Your account is not allowed to access this resource." });
      return;
    }

    if (requiresPrivilegedMfa(user) && (!user.mfaFactor || !hasCurrentMfaAssurance(session?.mfaVerifiedAt))) {
      response.status(401).json({ message: "Complete multifactor sign-in to access this account." });
      return;
    }

    const profile = mapUserProfile(user);

    request.auth = {
      userId: profile.id,
      sessionId: session!.id,
      sessionVersion: user.sessionVersion,
      roles: profile.roles,
      user: {
        id: profile.id,
        fullName: profile.fullName,
        email: profile.email,
        status: profile.status,
        roles: profile.roles,
        eventRoles: profile.eventRoles.map((eventRole) => ({
          eventId: eventRole.eventId,
          roleCode: eventRole.roleCode,
        })),
      },
    };

    next();
  } catch (error) {
    next(error);
  }
}
