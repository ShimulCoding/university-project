import type { RoleCode } from "@prisma/client";

import type { AuthenticatedUser } from "./auth";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        sessionId: string;
        sessionVersion: number;
        roles: RoleCode[];
        user: AuthenticatedUser;
      };
    }
  }
}

export {};
