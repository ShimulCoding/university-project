import { randomUUID } from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env";

export type TokenType = "access" | "refresh";

export type AuthTokenPayload = {
  sub: string;
  type: TokenType;
  version?: number;
  sessionId?: string;
};

function signToken(
  payload: AuthTokenPayload,
  secret: string,
  expiresIn: NonNullable<SignOptions["expiresIn"]>,
) {
  return jwt.sign(payload, secret, {
    expiresIn,
    jwtid: randomUUID(),
  });
}

export function signAccessToken(userId: string, version = 0, sessionId?: string) {
  return signToken(
    { sub: userId, type: "access", version, ...(sessionId ? { sessionId } : {}) },
    env.JWT_ACCESS_SECRET,
    env.ACCESS_TOKEN_TTL as NonNullable<SignOptions["expiresIn"]>,
  );
}

export function signRefreshToken(userId: string) {
  return signToken(
    { sub: userId, type: "refresh" },
    env.JWT_REFRESH_SECRET,
    env.REFRESH_TOKEN_TTL as NonNullable<SignOptions["expiresIn"]>,
  );
}

export function verifyAccessToken(token: string) {
  return verifyToken(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token: string) {
  return verifyToken(token, env.JWT_REFRESH_SECRET);
}

function verifyToken(token: string, secret: string): AuthTokenPayload {
  const payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
  if (typeof payload === "string" || typeof payload.sub !== "string" || !payload.sub ||
      !["access", "refresh"].includes(payload.type) ||
      (payload.version !== undefined && (!Number.isSafeInteger(payload.version) || payload.version < 0)) ||
      (payload.sessionId !== undefined && typeof payload.sessionId !== "string")) {
    throw new Error("Invalid token payload.");
  }
  return payload as AuthTokenPayload;
}
