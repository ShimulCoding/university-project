import { PrismaClient } from "@prisma/client";

import { env } from "./env";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prisma error text can include query arguments or connection details.
    // Application failures use the redacted, request-correlated logger instead.
    log: [],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase() {
  await prisma.$connect();
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}

