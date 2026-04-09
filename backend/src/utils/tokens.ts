import { randomUUID } from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env";

export type TokenType = "access" | "refresh";

export type AuthTokenPayload = {
  sub: string;
  type: TokenType;
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

export function signAccessToken(userId: string) {
  return signToken(
    { sub: userId, type: "access" },
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
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthTokenPayload;
}
