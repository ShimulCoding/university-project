import type { Request, Response } from "express";

import {
  accessTokenCookieOptions,
  authCookieNames,
  clearCookieOptions,
  refreshTokenCookieOptions,
} from "../../../config/auth";
import { authService } from "../services/auth.service";

function writeSessionCookies(
  response: Response,
  session: {
    accessToken: string;
    refreshToken: string;
  },
) {
  response.cookie(
    authCookieNames.accessToken,
    session.accessToken,
    accessTokenCookieOptions,
  );
  response.cookie(
    authCookieNames.refreshToken,
    session.refreshToken,
    refreshTokenCookieOptions,
  );
}

export const authController = {
  async bootstrapAdmin(request: Request, response: Response) {
    const session = await authService.bootstrapAdmin(request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    writeSessionCookies(response, session);

    response.status(201).json({ user: session.user });
  },

  async register(request: Request, response: Response) {
    const session = await authService.register(request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    writeSessionCookies(response, session);

    response.status(201).json({ user: session.user });
  },

  async login(request: Request, response: Response) {
    const session = await authService.login(request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    writeSessionCookies(response, session);

    response.status(200).json({ user: session.user });
  },

  async refresh(request: Request, response: Response) {
    const session = await authService.refreshSession(
      request.cookies[authCookieNames.refreshToken] as string | undefined,
      {
        ipAddress: request.ip || undefined,
        userAgent: request.get("user-agent") || undefined,
        route: request.originalUrl,
        method: request.method,
      },
    );

    writeSessionCookies(response, session);

    response.status(200).json({ user: session.user });
  },

  async logout(request: Request, response: Response) {
    await authService.logout(
      request.cookies[authCookieNames.refreshToken] as string | undefined,
      request.auth?.userId,
      {
        ipAddress: request.ip || undefined,
        userAgent: request.get("user-agent") || undefined,
        route: request.originalUrl,
        method: request.method,
      },
    );

    response.clearCookie(authCookieNames.accessToken, clearCookieOptions);
    response.clearCookie(authCookieNames.refreshToken, clearCookieOptions);

    response.status(204).send();
  },

  async getCurrentUser(request: Request, response: Response) {
    const user = await authService.getCurrentUser(request.auth!.userId);

    response.status(200).json({ user });
  },
};
