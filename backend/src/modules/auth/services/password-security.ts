import { randomBytes } from "node:crypto";
import { prisma } from "../../../config/prisma";
import type { DbClient } from "../../../types/database";
import { hashPassword, verifyPassword } from "../../../utils/password";
import { AppError } from "../../../utils/app-error";
import { governanceTransaction } from "../../../utils/governance-transaction";
import { auditService } from "../../audit/services/audit.service";
import type { AuditMetadata } from "../../audit/types/audit.types";

export const PASSWORD_FAILURE_LIMIT = 10;
export const PASSWORD_FAILURE_WINDOW_MS = 15 * 60 * 1000;
// Unknown identities still perform bcrypt at the configured cost. This random
// dummy credential is never accepted, persisted, logged or used for an account.
const dummyHash = hashPassword(randomBytes(32).toString("hex"));

export async function assertPasswordBudget(userId: string, db: DbClient = prisma) {
  const failures = await db.auditLog.count({ where: { actorId: userId, action: "auth.password.denied", createdAt: { gt: new Date(Date.now() - PASSWORD_FAILURE_WINDOW_MS) } } });
  if (failures >= PASSWORD_FAILURE_LIMIT) throw new AppError(429, "Too many failed password attempts. Try again after 15 minutes.");
}

export async function verifyAccountPassword<T extends { id: string; passwordHash: string }>(user: T | null, password: string, message: string, metadata?: AuditMetadata, status = 401): Promise<T> {
  if (user) await assertPasswordBudget(user.id);
  const matches = await verifyPassword(password, user?.passwordHash ?? await dummyHash);
  if (!user) throw new AppError(status, message);
  if (!matches) {
    // Commit denial before returning the error; rolling it back would erase
    // the guessing budget. Serializable count+write prevents parallel guesses
    // from each using a separate budget, including across server instances.
    await governanceTransaction(async (tx) => {
      await assertPasswordBudget(user.id, tx);
      await auditService.record({ actorId: user.id, action: "auth.password.denied", entityType: "User", entityId: user.id, summary: "Password verification denied.", ...metadata }, tx);
    });
    throw new AppError(status, message);
  }
  return user;
}
