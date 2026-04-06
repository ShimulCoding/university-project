import type { RoleCode } from "@prisma/client";
import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env";

type TokenPayload = {
  sub: string;
  roles: RoleCode[];
};

function signToken(
  payload: TokenPayload,
  secret: string,
  expiresIn: NonNullable<SignOptions["expiresIn"]>,
) {
  return jwt.sign(payload, secret, { expiresIn });
}

export function signAccessToken(payload: TokenPayload) {
  return signToken(
    payload,
    env.JWT_ACCESS_SECRET,
    env.ACCESS_TOKEN_TTL as NonNullable<SignOptions["expiresIn"]>,
  );
}

export function signRefreshToken(payload: TokenPayload) {
  return signToken(
    payload,
    env.JWT_REFRESH_SECRET,
    env.REFRESH_TOKEN_TTL as NonNullable<SignOptions["expiresIn"]>,
  );
}
