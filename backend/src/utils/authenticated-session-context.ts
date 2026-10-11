import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthenticatedSession } from "../types/auth";
import type { DbClient } from "../types/database";
import { AppError } from "./app-error";
import { userWithActiveRolesInclude } from "../modules/users/users.mappers";
import { hasCurrentMfaAssurance, requiresPrivilegedMfa } from "../modules/auth/services/auth-session";

// Only authentication middleware establishes this context. It follows async
// controller/service calls, including controllers that pass only an actor ID.
// Never populate it from a body/header or a service caller's claimed roles.
export const authenticatedSessionContext = new AsyncLocalStorage<Readonly<AuthenticatedSession>>();

export async function assertCurrentRequestSession(db: DbClient, actorId?: string) {
  const context = authenticatedSessionContext.getStore();
  if (!context) return; // Trusted scripts/background operations have no HTTP context.
  const user = await db.user.findUnique({ where: { id: context.userId }, include: userWithActiveRolesInclude });
  const session = await db.refreshToken.findUnique({ where: { id: context.sessionId } });
  if ((actorId && actorId !== context.userId) || !user || user.status !== "ACTIVE" || user.sessionVersion !== context.sessionVersion ||
      !session || session.userId !== context.userId || session.revokedAt || session.expiresAt <= new Date() ||
      (requiresPrivilegedMfa(user) && (!user.mfaFactor || !hasCurrentMfaAssurance(session.mfaVerifiedAt)))) {
    throw new AppError(403, "Your sign-in authority changed. Sign in again before continuing.");
  }
}
