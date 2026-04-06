import type { CookieOptions } from "express";

import { env } from "./env";
import { durationToMs } from "../utils/duration";

const sharedCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
};

export const authCookieNames = {
  accessToken: env.ACCESS_TOKEN_COOKIE_NAME,
  refreshToken: env.REFRESH_TOKEN_COOKIE_NAME,
} as const;

export const accessTokenCookieOptions: CookieOptions = {
  ...sharedCookieOptions,
  maxAge: durationToMs(env.ACCESS_TOKEN_TTL),
};

export const refreshTokenCookieOptions: CookieOptions = {
  ...sharedCookieOptions,
  maxAge: durationToMs(env.REFRESH_TOKEN_TTL),
};

export const clearCookieOptions: CookieOptions = {
  ...sharedCookieOptions,
};

