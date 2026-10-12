import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../../src/config/prisma";
import { env } from "../../src/config/env";

const fixtureUrl = process.env.VERIFY_FIXTURE_DATABASE_URL;
const isolated = process.env.VERIFY_ISOLATED_RUNTIME === "true";

export function fixtureDatabaseBoundary(runtimeValue: string, fixtureValue: string) {
  const runtime = new URL(runtimeValue), fixture = new URL(fixtureValue);
  const database = decodeURIComponent(runtime.pathname.slice(1));
  assert([runtime, fixture].every((value) => ["postgres:", "postgresql:"].includes(value.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(value.hostname)), "Fixture clients require loopback PostgreSQL targets");
  assert(/^mu_scale_[a-z0-9_]{8,35}$/.test(database) && fixture.pathname === runtime.pathname, "Fixture clients require the same isolated mu_scale database");
  assert(runtime.hostname === fixture.hostname && runtime.port === fixture.port, "Direct fixture/runtime clients require the same host and port");
  assert(decodeURIComponent(runtime.username) === `${database}_runtime` && decodeURIComponent(fixture.username) === `${database}_migration`, "Fixture clients require paired restricted runtime/migration roles");
  return database;
}

if (isolated) {
  assert(env.NODE_ENV !== "production" && fixtureUrl, "Isolated verification requires a separate fixture credential");
  fixtureDatabaseBoundary(env.DATABASE_URL, fixtureUrl);
}
// Preserve existing verifier invocation; no alternate credential means no elevation.
// Restricted-runtime acceptance always requires isolated=true and a verified pair.
export const fixturePrisma = fixtureUrl
  ? new PrismaClient({ datasources: { db: { url: fixtureUrl } }, log: [] })
  : prisma;

export async function verifyFixtureDatabase() {
  if (!fixtureUrl) { assert(!isolated); return; }
  assert(isolated && env.NODE_ENV !== "production", "A privileged fixture client must explicitly opt into isolated mode");
  const database = fixtureDatabaseBoundary(env.DATABASE_URL, fixtureUrl);
  const [runtime, fixture] = await Promise.all([
    prisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`,
    fixturePrisma.$queryRaw<Array<{ database: string; role: string }>>`SELECT current_database() AS database, current_user AS role`,
  ]);
  assert(runtime.length === 1 && fixture.length === 1 && runtime[0]!.database === database && fixture[0]!.database === database && runtime[0]!.role === `${database}_runtime` && fixture[0]!.role === `${database}_migration`, "Actual fixture/runtime identities must match the isolated target");
}

export async function disconnectFixtureDatabase() {
  if (fixturePrisma !== prisma) await fixturePrisma.$disconnect();
}

export function fixtureFailureDiagnostics(value: unknown) {
  const error = value as { name?: unknown; code?: unknown; meta?: { code?: unknown }; statusCode?: unknown; actual?: unknown; expected?: unknown };
  const knownKinds = ["Error", "TypeError", "ReferenceError", "AssertionError", "ZodError", "PrismaClientInitializationError", "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError", "PrismaClientValidationError", "AppError"];
  return {
    verificationFailure: true,
    ...(typeof error?.name === "string" && knownKinds.includes(error.name) ? { kind: error.name } : {}),
    ...(typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{0,30}$/.test(error.code) ? { code: error.code } : {}),
    ...(typeof error?.meta?.code === "string" && /^[A-Z0-9]{5}$/.test(error.meta.code) ? { databaseCode: error.meta.code } : {}),
    ...(typeof error?.statusCode === "number" ? { status: error.statusCode } : {}),
    ...(typeof error?.actual === "number" ? { actual: error.actual } : {}),
    ...(typeof error?.expected === "number" ? { expected: error.expected } : {}),
  };
}
