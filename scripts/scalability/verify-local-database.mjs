import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { operatorParameters, privateConfigurationFile } from "./provision-local-database.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let stage = "configuration";

export function fixtureConfig(value) {
  assert(value.purpose === "isolated_fake_scalability" && value.schemaVersion === 1 && /^mu_scale_[a-z0-9_]{8,35}$/.test(value.database), "An explicitly owned isolated configuration is required");
  for (const [url, suffix] of [[value.runtimeDatabaseUrl, "runtime"], [value.migrationDatabaseUrl, "migration"]]) {
    const parsed = new URL(url);
    assert(["postgres:", "postgresql:"].includes(parsed.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) && parsed.pathname === `/${value.database}` && decodeURIComponent(parsed.username) === `${value.database}_${suffix}`, "Fixture URL scope/identity mismatch");
  }
  const runtime = new URL(value.runtimeDatabaseUrl), migration = new URL(value.migrationDatabaseUrl);
  assert.equal(runtime.hostname, migration.hostname); assert.equal(runtime.port, migration.port);
  assert.equal(value.runtimeEnvironment?.DATABASE_URL, value.runtimeDatabaseUrl);
  assert.equal(value.runtimeEnvironment?.NODE_ENV, "test");
  assert.equal(path.resolve(value.runtimeEnvironment?.UPLOADS_ROOT ?? ""), path.join(root, ".cache/scalability", value.database, "uploads"));
  assert.equal(value.runtimeEnvironment?.SMTP_HOST, "127.0.0.1");
  return value;
}

function client(url) { return new PrismaClient({ datasources: { db: { url } }, log: [] }); }
function privilegeDenied(error) { return error?.code === "P2010" && error?.meta?.code === "42501"; }

async function assertIdentity(db, database, role) {
  const actual = await db.$queryRaw`SELECT current_database() AS database, current_user AS role`;
  assert.equal(actual.length, 1); assert.equal(actual[0].database, database); assert.equal(actual[0].role, role);
}

async function denied(db, statement) {
  await assert.rejects(db.$transaction(async (tx) => { await tx.$executeRawUnsafe(statement); }), privilegeDenied);
}

async function operatorClient(config, operatorFile) {
  assert(operatorFile, "An explicit isolated operator configuration is required");
  const parameters = operatorParameters(JSON.parse(await readFile(await privateConfigurationFile(operatorFile), "utf8")));
  const target = new URL(config.migrationDatabaseUrl);
  assert.equal(parameters.host.replace(/^\[|\]$/g, ""), target.hostname.replace(/^\[|\]$/g, "")); assert.equal(parameters.port, target.port);
  target.username = parameters.user; target.password = parameters.password;
  return client(target.toString());
}

export async function verify(config, operatorFile) {
  config = fixtureConfig(config);
  const runtime = client(config.runtimeDatabaseUrl), migration = client(config.migrationDatabaseUrl);
  const operator = await operatorClient(config, operatorFile);
  const run = randomUUID(); const userIds = [], eventIds = [];
  let checks = 0; let naiveCascadeReproduced = false;
  try {
    stage = "actual_client_identity";
    await assertIdentity(runtime, config.database, `${config.database}_runtime`); checks++;
    await assertIdentity(migration, config.database, `${config.database}_migration`); checks++;
    const operatorDatabase = await operator.$queryRaw`SELECT current_database() AS database`;
    assert.equal(operatorDatabase[0].database, config.database); checks++;
    stage = "role_and_migration_metadata";
    const roles = await runtime.$queryRaw`SELECT rolsuper, rolcreatedb, rolcreaterole, rolinherit, rolreplication, rolbypassrls FROM pg_roles WHERE rolname = current_user`;
    assert.equal(roles.length, 1); assert(Object.values(roles[0]).every((flag) => flag === false)); checks++;
    const migrations = await migration.$queryRaw`SELECT migration_name, checksum FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
    assert.equal(migrations.length, 14); checks++;
    // Populate only source-defined role metadata, no admin identity or real account.
    const { roleCatalog } = await import("../../backend/src/modules/roles/role-catalog.ts");
    for (const role of roleCatalog) await migration.role.upsert({ where: { code: role.code }, update: {}, create: { ...role, isSystem: true } });
    assert.equal(await runtime.role.count(), 7); checks++;
    const user = await migration.user.create({ data: { fullName: "Database boundary fixture", email: `database-boundary-${run}@example.invalid`, passwordHash: "synthetic-not-an-authentication-secret" } }); userIds.push(user.id);
    const event = await migration.event.create({ data: { title: "Database boundary fixture", slug: `database-boundary-${run}` } }); eventIds.push(event.id);
    const income = await migration.incomeRecord.create({ data: { eventId: event.id, recordedById: user.id, sourceType: "DONATION", sourceLabel: "Synthetic boundary", amount: "1.00" } });
    const expense = await migration.expenseRecord.create({ data: { eventId: event.id, recordedById: user.id, category: "Synthetic boundary", description: "Synthetic boundary", amount: "1.00" } });
    const audit = await migration.auditLog.create({ data: { actorId: user.id, eventId: event.id, action: "synthetic.boundary", entityType: "Synthetic", entityId: run } });
    const marker = await migration.financialIdempotency.create({ data: { actorId: user.id, eventId: event.id, operation: "INCOME_CREATE", key: run, inputHash: "0".repeat(64), incomeRecordId: income.id } });
    stage = "naive_cascade_negative_control";
    // Reproduce a naive table-wide UPDATE grant only inside an operator-owned
    // transaction. No weakened grant or altered fixture survives rollback.
    const rollback = new Error("controlled rollback");
    try {
      await operator.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`GRANT UPDATE ON TABLE public."User", public."Event", public."IncomeRecord", public."ExpenseRecord" TO "${config.database}_runtime"`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE "${config.database}_runtime"`);
        await assertIdentity(tx, config.database, `${config.database}_runtime`);
        await tx.$executeRawUnsafe("SAVEPOINT direct_history_check");
        await assert.rejects(tx.$executeRaw`UPDATE public."AuditLog" SET action = action WHERE false`, privilegeDenied);
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT direct_history_check");
        await tx.$executeRaw`UPDATE public."User" SET id = ${`${user.id}-cascade`} WHERE id = ${user.id}`;
        const changed = await tx.$queryRaw`SELECT "actorId" FROM public."AuditLog" WHERE id = ${audit.id}`;
        const changedMarker = await tx.$queryRaw`SELECT "actorId" FROM public."FinancialIdempotency" WHERE id = ${marker.id}`;
        assert.equal(changed[0].actorId, `${user.id}-cascade`); assert.equal(changedMarker[0].actorId, `${user.id}-cascade`);
        naiveCascadeReproduced = true;
        throw rollback;
      }, { timeout: 15_000 });
    } catch (error) { if (error !== rollback) throw error; }
    assert(naiveCascadeReproduced); checks++;
    assert.equal((await runtime.auditLog.findUniqueOrThrow({ where: { id: audit.id } })).actorId, user.id); checks++;
    assert.equal((await runtime.financialIdempotency.findUniqueOrThrow({ where: { id: marker.id } })).actorId, user.id); checks++;
    stage = "direct_and_indirect_denial";
    for (const statement of [
      'CREATE TABLE public.synthetic_forbidden (id integer)', 'CREATE TEMP TABLE synthetic_forbidden (id integer)',
      'UPDATE public."AuditLog" SET action = action WHERE false', 'DELETE FROM public."AuditLog" WHERE false', 'TRUNCATE public."AuditLog"',
      'UPDATE public."FinancialIdempotency" SET "inputHash" = "inputHash" WHERE false', 'DELETE FROM public."FinancialIdempotency" WHERE false', 'TRUNCATE public."FinancialIdempotency"',
      'SELECT * FROM public._prisma_migrations', 'UPDATE public._prisma_migrations SET checksum = checksum WHERE false',
      `SET ROLE "${config.database}_migration"`,
      'UPDATE public."User" SET id = id WHERE false', 'UPDATE public."Event" SET id = id WHERE false',
      'UPDATE public."IncomeRecord" SET id = id WHERE false', 'UPDATE public."ExpenseRecord" SET id = id WHERE false',
      'UPDATE public."MfaFactor" SET "userId" = "userId" WHERE false',
    ]) { await denied(runtime, statement); checks++; }
    const grantRollback = new Error("controlled grant no-op rollback");
    try {
      await runtime.$transaction(async (tx) => {
        const before = await tx.$queryRaw`SELECT relacl::text AS acl FROM pg_class WHERE oid = 'public."User"'::regclass`;
        // PostgreSQL may return a warning/no-op rather than 42501 here.
        await tx.$executeRawUnsafe('GRANT SELECT ON public."User" TO PUBLIC');
        const after = await tx.$queryRaw`SELECT relacl::text AS acl FROM pg_class WHERE oid = 'public."User"'::regclass`;
        assert.deepEqual(after, before);
        checks++;
        throw grantRollback;
      });
    } catch (error) { if (error !== grantRollback) throw error; }
    stage = "ordinary_runtime_write_and_maintenance";
    await runtime.user.update({ where: { id: user.id }, data: { fullName: "Updated synthetic fixture" } }); checks++;
    await runtime.auditLog.create({ data: { actorId: user.id, action: "synthetic.runtime_insert", entityType: "Synthetic", entityId: run } }); checks++;
    await runtime.refreshToken.deleteMany({ where: { userId: user.id } }); checks++;
    return { status: "passed", checks, naiveCascadeReproduced, committedPrimaryKeyUpdatesDenied: true, appliedMigrations: migrations.length, migrationChecksums: migrations, runtimeRole: `${config.database}_runtime`, database: config.database };
  } finally {
    stage = "owned_fixture_cleanup";
    if (userIds.length || eventIds.length) await migration.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { OR: [{ actorId: { in: userIds } }, { eventId: { in: eventIds } }] } });
      await tx.event.deleteMany({ where: { id: { in: eventIds } } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    });
    await Promise.all([runtime.$disconnect(), migration.$disconnect(), operator.$disconnect()]);
  }
}

async function runScript(config, script) {
  stage = "owned_verification_child";
  const manifest = JSON.parse(await readFile(path.join(root, "backend/package.json"), "utf8"));
  assert(/^verify:[a-z0-9:-]+$/.test(script) && manifest.scripts[script], "Only existing backend verification scripts are allowed");
  assert(manifest.scripts[script].startsWith("tsx ") && !/[;&|`$<>]/.test(manifest.scripts[script]), "Only reviewed tsx verification commands are accepted");
  assert.equal(config.runtimeEnvironment.DATABASE_URL, config.runtimeDatabaseUrl);
  const workspaceUsesFrontend = script === "verify:event-workspaces" && (process.env.VERIFY_FRONTEND_BASE_URL || process.env.VERIFY_BROWSER === "1" || process.env.VERIFY_DESIGN === "1");
  if (["verify:security-mfa-browser", "verify:security-reset-browser", "verify:network-sign-in"].includes(script) || workspaceUsesFrontend) {
    const frontend = process.env.VERIFY_FRONTEND_BASE_URL, api = process.env.VERIFY_API_BASE_URL;
    assert(frontend && api, "Owned browser/API targets must be supplied explicitly before isolated browser verification");
    const frontUrl = new URL(frontend), apiUrl = new URL(api);
    assert(frontUrl.origin === config.runtimeEnvironment.FRONTEND_URL && apiUrl.origin === `http://127.0.0.1:${config.runtimeEnvironment.PORT}` && apiUrl.pathname === "/api", "Browser/API targets must match the owned fixture application configuration");
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), ...manifest.scripts[script].slice(4).trim().split(/\s+/)], {
      cwd: path.join(root, "backend"), windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...config.runtimeEnvironment, VERIFY_ISOLATED_RUNTIME: "true", VERIFY_FIXTURE_DATABASE_URL: config.migrationDatabaseUrl },
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (data) => { if (stdout.length < 1024 * 1024) stdout += data.toString(); });
    child.stderr.on("data", (data) => { if (stderr.length < 1024 * 1024) stderr += data.toString(); });
    child.on("error", () => reject(new Error("Verification child could not start")));
    child.on("close", (code) => {
      const counts = [...stdout.matchAll(/\b(\d+) (?:[\w/ -]{0,80} )?checks(?: passed\.|\))/g)].map((match) => Number(match[1]));
      if (code !== 0) {
        const failure = new Error("Verification child failed; private output suppressed");
        for (const line of stderr.split(/\r?\n/)) {
          try {
            const report = JSON.parse(line);
            if (report.verificationFailure === true) failure.diagnostics = Object.fromEntries(Object.entries(report).filter(([key, value]) =>
              (["actual", "expected", "status"].includes(key) && Number.isFinite(value)) ||
              (key === "kind" && ["Error", "TypeError", "ReferenceError", "AssertionError", "ZodError", "PrismaClientInitializationError", "PrismaClientKnownRequestError", "PrismaClientUnknownRequestError", "PrismaClientValidationError", "AppError"].includes(value)) ||
              (key === "code" && typeof value === "string" && /^[A-Z][A-Z0-9_]{0,30}$/.test(value)) ||
              (key === "databaseCode" && typeof value === "string" && /^[0-9A-Z]{5}$/.test(value))));
          } catch { /* Raw child diagnostics remain discarded. */ }
        }
        reject(failure);
      }
      else resolve({ status: "passed", script, exitCode: code, reportedCheckCounts: counts });
      stdout = ""; stderr = "";
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), options = new Map();
  for (let index = 0; index < args.length; index += 2) options.set(args[index], args[index + 1]);
  if (!options.get("--config") || [...options.keys()].some((key) => !["--config", "--operator-config", "--run-script"].includes(key)) || args.length !== options.size * 2) {
    console.error("Usage: --config private-fixture.json [--operator-config private-operator.json] [--run-script existing-verification-name]"); process.exitCode = 1;
  } else (async () => {
    const config = fixtureConfig(JSON.parse(await readFile(await privateConfigurationFile(options.get("--config")), "utf8")));
    return options.has("--run-script") ? runScript(config, options.get("--run-script")) : verify(config, options.get("--operator-config"));
  })().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(JSON.stringify({ status: "failed", stage, ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}), details: "Private diagnostics suppressed" })); process.exitCode = 1;
  });
}
