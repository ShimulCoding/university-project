import assert from "node:assert/strict";
import { auditRepository } from "../src/modules/audit/repositories/audit.repository";
import type { DbClient } from "../src/types/database";
import { sanitizeAuditMetadata } from "../src/utils/audit-metadata";
import { getRequestMetadata } from "../src/utils/request-metadata";
import { authRepository } from "../src/modules/auth/repositories/auth.repository";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { hashPassword } from "../src/utils/password";
import { randomUUID } from "node:crypto";
import type { Request } from "express";

async function main() {
  const marker = "SYNTHETIC_QUERY_CAPABILITY_93f";
  let stored: unknown;
  const db = { auditLog: { create: async (input: unknown) => { stored = input; return {}; } } } as unknown as DbClient;
  await auditRepository.create({ action: "fixture.action", entityType: "Fixture", entityId: "fixture", route: `/api/fixture?token=${marker}`, userAgent: `Synthetic ${marker}`, method: "POST", ipAddress: "127.0.0.1" }, db);
  assert(!JSON.stringify(stored).includes(marker), "Query or raw header capability reached database audit storage");
  let checks = 1;
  function check(value: unknown, label: string) { assert(value, label); checks++; }
  const saved = stored as { data: { route: string; userAgent: string; method: string; ipAddress: string } };
  check(saved.data.route === "/api/fixture", "Server route diagnostics remain");
  check(saved.data.userAgent === "Other", "Unrecognized headers record only a family");
  check(saved.data.method === "POST" && saved.data.ipAddress === "127.0.0.1", "Validated method and address remain");
  check(sanitizeAuditMetadata({ route: `/foo#${marker}` }).route === "/foo", "Fragments never reach audit storage");
  check(sanitizeAuditMetadata({ route: `/foo\r\n${"x".repeat(1000)}`, method: `POST\n${marker}`, ipAddress: marker }).route!.length === 512, "Stored routes have bounded size");
  check(!sanitizeAuditMetadata({ method: marker, ipAddress: marker }).method && !sanitizeAuditMetadata({ ipAddress: marker }).ipAddress, "Invalid diagnostics are omitted");
  for (const [header, family] of [["Mozilla Chrome/100 Edg/100", "Edge"], ["Mozilla Chrome/100", "Chrome"], ["Mozilla Firefox/100", "Firefox"], ["Mozilla Safari/100", "Safari"], ["Edge", "Edge"]]) check(sanitizeAuditMetadata({ userAgent: `${header}` }).userAgent === family, "Known families retain a controlled label");
  const metadata = getRequestMetadata({ ip: "127.0.0.1", route: { path: "/:recordId" }, originalUrl: `/${marker}?token=${marker}`, method: "PATCH", get: () => marker } as unknown as Request);
  check(metadata.route === "/:recordId" && !JSON.stringify(metadata).includes(marker), "Controllers use a server template rather than user path/query");
  check(getRequestMetadata({ method: "GET", get: () => undefined } as unknown as Request).route === "unmatched", "Missing route uses a controlled label");
  let storedSession: unknown;
  await authRepository.createRefreshToken({ userId: "fixture", tokenHash: "fixture-hash", expiresAt: new Date(), userAgent: marker, ipAddress: marker }, { refreshToken: { create: async (input: unknown) => { storedSession = input; return {}; } } } as unknown as DbClient);
  check(!JSON.stringify(storedSession).includes(marker), "Session metadata also excludes arbitrary header text");
  const run = randomUUID(); let userId: string | undefined;
  const server = createApp().listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string");
    const password = `Synthetic-${run}!`;
    const user = await prisma.user.create({ data: { fullName: "Audit metadata fixture", studentId: `A${run.slice(0, 20)}`, email: `audit-metadata-${run}@example.invalid`, passwordHash: await hashPassword(password) } }); userId = user.id;
    const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/login?token=${marker}`, { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": marker }, body: JSON.stringify({ studentId: user.studentId, password }) });
    check(response.status === 200, "Legitimate sign-in remains functional");
    const audit = await prisma.auditLog.findMany({ where: { actorId: user.id } });
    check(audit.some((item) => item.action === "auth.login" && item.route === "/login"), "Actual sign-in retains its action and template");
    check(!JSON.stringify(audit).includes(marker), "Actual database audit excludes query/header capabilities");
    check(!JSON.stringify(await prisma.refreshToken.findMany({ where: { userId } })).includes(marker), "Actual database sessions exclude raw headers");
    console.log(`Audit metadata privacy: ${checks} checks passed.`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (userId) { await prisma.auditLog.deleteMany({ where: { actorId: userId } }); await prisma.user.delete({ where: { id: userId } }); }
    await prisma.$disconnect();
  }
}
void main().catch(() => { console.error("Audit metadata privacy verification failed. Private details suppressed."); process.exitCode = 1; });
