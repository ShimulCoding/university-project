import type { NextFunction, Request, Response } from "express";
import type { RoleCode } from "@prisma/client";

export function authorize(...allowedRoles: RoleCode[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const roles = request.auth?.roles ?? [];
    const allowed = allowedRoles.some((role) => roles.includes(role));

    if (!allowed) {
      response.status(403).json({ message: "You are not allowed to perform this action." });
      return;
    }

    next();
  };
}

