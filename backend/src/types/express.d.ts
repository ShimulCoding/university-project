import type { RoleCode } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        roles: RoleCode[];
      };
    }
  }
}

export {};

