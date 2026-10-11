import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Prisma, RoleCode } from "@prisma/client";
import { localSeedConfig, requireDemoSeedPassword, seedPassword } from "../src/utils/local-seed-policy";
import { assertFreshDemoDataset, createSeedAccount, seedLocalDataset } from "../src/utils/local-seed";

async function main() {
  let checks = 0;
  const local = { NODE_ENV: "test", DATABASE_URL: "postgresql://synthetic@127.0.0.1:5432/synthetic" };
  const inputs = { ...local, SEED_ADMIN_FULL_NAME: "Synthetic operator", SEED_ADMIN_EMAIL: "fixture@example.invalid", SEED_ADMIN_PASSWORD: "Synthetic-private-input-2026!" };
  for (const changed of [{ NODE_ENV: "production" }, { DATABASE_URL: "postgresql://synthetic@cloud.example.invalid/db" }, { DATABASE_URL: "not-a-url" }, { SEED_ADMIN_PASSWORD: "change-this-before-seeding" }, { SEED_ADMIN_PASSWORD: "DemoPass123!" }, { SEED_ADMIN_PASSWORD: "short" }, { SEED_ADMIN_PASSWORD: "🙂".repeat(19) }, { SEED_ADMIN_EMAIL: "" }]) {
    assert.throws(() => localSeedConfig({ ...inputs, ...changed })); checks++;
  }
  assert.equal(localSeedConfig(local).demoPassword, undefined); checks++;
  assert.throws(() => requireDemoSeedPassword(local)); checks++;
  assert.throws(() => requireDemoSeedPassword({ ...local, ENABLE_LOCAL_DEMO_SEED: "true" })); checks++;
  assert.throws(() => seedPassword("replace-with-a-private-password")); checks++;
  const config = localSeedConfig(inputs);
  const demoConfig = localSeedConfig({ ...inputs, ENABLE_LOCAL_DEMO_SEED: "true", SEED_DEMO_PASSWORD: "Synthetic-private-demo-2026!" });
  function fake(existing: object | null, demoExists = false, admins = 0) {
    const writes: Array<{ model: string; data: Record<string, unknown> }> = [];
    const write = (model: string) => async ({ data }: { data: Record<string, unknown> }) => { writes.push({ model, data }); return { id: `${model}-${writes.length}`, ...data }; };
    const tx = { role: { upsert: async () => ({}) }, user: { findUnique: async () => existing, count: async () => demoExists ? 1 : 0, create: write("user"), upsert: async () => { throw new Error("Unsafe account upsert invoked."); } }, userRole: { count: async () => admins }, event: { findUnique: async () => demoExists ? { id: "old-event" } : null, count: async () => demoExists ? 1 : 0, create: write("event"), update: write("event-update") }, eventTeamMember: { create: write("team") }, auditLog: { create: write("audit") } } as unknown as Prisma.TransactionClient;
    return { tx, writes };
  }
  const old = { id: "existing-admin", status: "ACTIVE", passwordHash: "historic", sessionVersion: 9, roles: [{ role: { code: "SYSTEM_ADMIN" } }] };
  const before = JSON.stringify(old); const retained = fake(old);
  await seedLocalDataset(retained.tx, config, { admin: "new-unused-hash" });
  assert.equal(retained.writes.length, 0); checks++;
  assert.equal(JSON.stringify(old), before); checks++;
  for (const identity of [{ ...old, status: "INACTIVE" }, { ...old, roles: [] }]) {
    const invalid = fake(identity); await assert.rejects(() => seedLocalDataset(invalid.tx, config, { admin: "unused" })); checks++;
    assert.equal(invalid.writes.length, 0); checks++;
  }
  const collision = fake(old, true);
  await assert.rejects(() => seedLocalDataset(collision.tx, demoConfig, { admin: "unused", demo: "new-hash" })); checks++;
  assert.equal(collision.writes.length, 0, "Existing/revoked demo assignments must not be restored"); checks++;
  const installed = fake(null, false, 1);
  await assert.rejects(() => seedLocalDataset(installed.tx, config, { admin: "synthetic" })); checks++;
  assert.equal(installed.writes.length, 0); checks++;
  const initial = fake(null);
  await seedLocalDataset(initial.tx, demoConfig, { admin: "admin-hash", demo: "demo-hash" });
  assert.equal(initial.writes.filter((entry) => entry.model === "user").length, 5); checks++;
  assert.equal(initial.writes.filter((entry) => entry.model === "team").length, 4); checks++;
  assert.equal(new Set(initial.writes.filter((entry) => entry.model === "team").map((entry) => entry.data.userId)).size, 4); checks++;
  assert.equal(initial.writes.filter((entry) => entry.model === "audit").length, 2); checks++;
  assert(initial.writes.filter((entry) => entry.model === "user").slice(1).every((entry) => !entry.data.roles)); checks++;
  const fresh = fake(null); await assertFreshDemoDataset(fresh.tx, ["synthetic@example.invalid"], ["synthetic-event"]); checks++;
  await assert.rejects(() => assertFreshDemoDataset(collision.tx, ["synthetic@example.invalid"], ["synthetic-event"])); checks++;
  await assert.rejects(() => createSeedAccount(fresh.tx, { fullName: "Synthetic", email: "x@example.invalid", roles: [RoleCode.SYSTEM_ADMIN] }, "synthetic", "operator")); checks++;
  const demoStudent = fake(null);
  await createSeedAccount(demoStudent.tx, { fullName: "Synthetic", email: "student@example.invalid", roles: [RoleCode.GENERAL_STUDENT] }, "synthetic", "operator");
  assert.equal(demoStudent.writes.filter((entry) => entry.model === "audit").length, 1); checks++;
  for (const file of ["scripts/seed-demo-runtime-data.ts", "scripts/seed-events-payments-demo.ts"]) {
    const source = readFileSync(file, "utf8");
    assert(!source.includes("user.upsert") && !source.includes("eventTeamMember.upsert") && !source.includes("DemoPass123!")); checks++;
    assert(source.indexOf("requireDemoSeedPassword(process.env)") < source.lastIndexOf("await ensureRoleCatalog()")); checks++;
  }
  console.log(`Local seed security: ${checks} policy/mocked negative and creation checks passed; no database was seeded.`);
}
void main().catch(() => { console.error("Seed verification failed; private details suppressed."); process.exitCode = 1; });
