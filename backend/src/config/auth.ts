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

export const accessTokenCookieOptions = (token: string): CookieOptions => {
  const payload = JSON.parse(Buffer.from(token.split(".")[1] || "", "base64").toString("utf8"));
  return {
    ...sharedCookieOptions,
    expires: new Date(payload.exp * 1000),
  };
};

export const refreshTokenCookieOptions = (token: string): CookieOptions => {
  const payload = JSON.parse(Buffer.from(token.split(".")[1] || "", "base64").toString("utf8"));
  return {
    ...sharedCookieOptions,
    expires: new Date(payload.exp * 1000),
  };
};

export const clearCookieOptions: CookieOptions = {
  ...sharedCookieOptions,
  maxAge: 0,
};

