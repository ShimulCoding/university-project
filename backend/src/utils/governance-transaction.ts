import { Prisma } from "@prisma/client";

import { prisma } from "../config/prisma";
import { AppError } from "./app-error";

// Team changes, account status, and global roles must agree on one snapshot.
// Serializable transactions prevent two concurrent removals from each seeing
// the other assignment as a replacement and leaving a role without an owner.
export async function governanceTransaction<T>(
  action: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(action, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") {
        throw error;
      }
    }
  }

  throw new AppError(409, "The team or account changed concurrently. Please try again.");
}
