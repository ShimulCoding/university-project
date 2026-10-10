import { AccountStatus, Prisma } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "./app-error";
import type { AuthenticatedUser } from "../types/auth";

// Governance and operational mutations must validate and write on one snapshot.
// Serializable transactions prevent two concurrent removals from each seeing
// the other assignment as a replacement and leaving a role without an owner.
export async function governanceTransaction<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  actor?: Pick<AuthenticatedUser, "id" | "roles" | "eventRoles">,
): Promise<T> {
  return transactionWithRetries(async (tx) => {
    if (actor) {
      const current = await tx.user.count({ where: {
        id: actor.id,
        status: AccountStatus.ACTIVE,
        AND: [
          ...actor.roles.map((code) => ({ roles: { some: { revokedAt: null, role: { code } } } })),
          ...(actor.eventRoles ?? []).map(({ eventId, roleCode }) => ({ eventTeamMemberships: { some: { eventId, roleCode, revokedAt: null } } })),
        ],
      } });
      if (current !== 1) throw new AppError(403, "Your account or permissions changed. Reload before trying again.");
    }
    return action(tx);
  }, Prisma.TransactionIsolationLevel.Serializable);
}

// Sign-in reads one coherent account/permission snapshot and atomically writes
// its session and audit. RepeatableRead avoids predicate-lock conflicts between
// unrelated logins; writes to the same account still conflict and retry.
// Access tokens carry no operational permissions: every API checks live roles.
export function sessionTransaction<T>(action: (tx: Prisma.TransactionClient) => Promise<T>) {
  return transactionWithRetries(action, Prisma.TransactionIsolationLevel.RepeatableRead);
}

async function transactionWithRetries<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
  isolationLevel: Prisma.TransactionIsolationLevel,
): Promise<T> {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(action, {
        isolationLevel,
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") {
        throw error;
      }
      // Avoid synchronized retries when independent requests contend on index pages.
      if (attempt < maxAttempts - 1) {
        const delay = (25 + Math.floor(Math.random() * 50)) * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw new AppError(409, "The record changed concurrently. Please try again.");
}
