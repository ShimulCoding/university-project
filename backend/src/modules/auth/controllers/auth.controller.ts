import type { Request, Response } from "express";

import {
  accessTokenCookieOptions,
  authCookieNames,
  clearCookieOptions,
  refreshTokenCookieOptions,
  mfaChallengeCookieOptions,
} from "../../../config/auth";
import { authService } from "../services/auth.service";
import { mfaService } from "../services/mfa.service";
import type { LoginResult } from "../types/auth.types";
import { getRequestMetadata } from "../../../utils/request-metadata";

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
    accessTokenCookieOptions(session.accessToken),
  );
  response.cookie(
    authCookieNames.refreshToken,
    session.refreshToken,
    refreshTokenCookieOptions(session.refreshToken),
  );
}

function writeLoginResponse(response: Response, result: LoginResult, status = 200) {
  if ("mfaRequired" in result) {
    response.clearCookie(authCookieNames.accessToken, clearCookieOptions);
    response.clearCookie(authCookieNames.refreshToken, clearCookieOptions);
    response.cookie(authCookieNames.mfaChallenge, result.ticket, mfaChallengeCookieOptions);
    response.status(status).json({ mfaRequired: true, mode: result.mode });
  } else {
    response.clearCookie(authCookieNames.mfaChallenge, { ...mfaChallengeCookieOptions, maxAge: 0 });
    writeSessionCookies(response, result);
    response.status(status).json({ user: result.user });
  }
}

export const authController = {
  async bootstrapAdmin(request: Request, response: Response) {
    const session = await authService.bootstrapAdmin(request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    writeLoginResponse(response, session, 201);
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

    writeLoginResponse(response, session);
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
    await mfaService.cancelChallenge(request.cookies[authCookieNames.mfaChallenge] as string | undefined, getRequestMetadata(request));
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
    response.clearCookie(authCookieNames.mfaChallenge, { ...mfaChallengeCookieOptions, maxAge: 0 });

    response.status(204).send();
  },

  async getCurrentUser(request: Request, response: Response) {
    const user = await authService.getCurrentUser(request.auth!.userId);

    response.status(200).json({ user });
  },

  async updateEmail(request: Request, response: Response) {
    const user = await authService.updateEmail(
      request.auth!,
      request.body.email,
      request.body.currentPassword,
      getRequestMetadata(request),
    );

    response.clearCookie(authCookieNames.accessToken, clearCookieOptions);
    response.clearCookie(authCookieNames.refreshToken, clearCookieOptions);
    response.clearCookie(authCookieNames.mfaChallenge, { ...mfaChallengeCookieOptions, maxAge: 0 });
    response.status(200).json({ user, message: "Recovery email updated. Sign in again to continue." });
  },

  async internalLogin(request: Request, response: Response) {
    const session = await authService.internalLogin(request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    writeLoginResponse(response, session);
  },

  async eventTeamLogin(request: Request, response: Response) {
    const session = await authService.eventTeamLogin(request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    writeLoginResponse(response, session);
  },

  async issueMfaEnrollmentGrant(request: Request, response: Response) {
    response.status(201).json(await mfaService.issueEnrollmentGrant(request.auth!.user, request.body.userId, request.body.currentPassword, getRequestMetadata(request)));
  },
  async startMfaEnrollment(request: Request, response: Response) {
    response.json(await mfaService.startEnrollment(request.cookies[authCookieNames.mfaChallenge] as string | undefined, request.body.enrollmentCode, getRequestMetadata(request)));
  },
  async verifyMfa(request: Request, response: Response) {
    const session = await mfaService.verifyChallenge(request.cookies[authCookieNames.mfaChallenge] as string | undefined, request.body.code, getRequestMetadata(request));
    writeSessionCookies(response, session);
    response.clearCookie(authCookieNames.mfaChallenge, { ...mfaChallengeCookieOptions, maxAge: 0 });
    response.json({ user: session.user, ...("recoveryCodes" in session ? { recoveryCodes: session.recoveryCodes } : {}) });
  },

  async forgotPassword(request: Request, response: Response) {
    const result = await authService.forgotPassword(request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    response.status(200).json(result);
  },

  async resetPassword(request: Request, response: Response) {
    const result = await authService.resetPassword(request.body, {
      ipAddress: request.ip || undefined,
      userAgent: request.get("user-agent") || undefined,
      route: request.originalUrl,
      method: request.method,
    });

    response.status(200).json(result);
  },
};
