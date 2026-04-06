import type { NextFunction, Request, Response } from "express";
import { RoleCode } from "@prisma/client";
import jwt from "jsonwebtoken";

import { env } from "../config/env";

type AccessTokenPayload = {
  sub: string;
  roles: RoleCode[];
};

export function authenticate(request: Request, response: Response, next: NextFunction) {
  const token = request.cookies.accessToken as string | undefined;

  if (!token) {
    response.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

    request.auth = {
      userId: payload.sub,
      roles: payload.roles,
    };

    next();
  } catch {
    response.status(401).json({ message: "Invalid or expired access token." });
  }
}

