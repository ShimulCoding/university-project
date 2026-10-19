import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { requireVerificationWorkspace, verificationPrisma } from "./verification-workspace-boundary.mjs";
import { operatorParameters, privateConfigurationFile } from "./provision-local-database.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let stage = "configuration";

export const fixtureTransactionPooler = Object.freeze({
  host: "127.0.0.1", port: "16432", upstreamPort: "15432",
  imageId: "sha256:7e303539703c688c9fca8a47c5bf6135cfb43e385f511acaf713d76bdde5371a",
});

function fixtureUrlArguments(url) {
  // Keep this CLI guard aligned with the independently tested TypeScript guard.
  assert.equal(url.hash, "", "Fixture URLs cannot carry fragments");
  const seen = new Set();
  const integerLimits = { connection_limit: 100, pool_timeout: 60, connect_timeout: 60, socket_timeout: 300, statement_cache_size: 1000 };
  for (const [key, value] of url.searchParams) {
    assert(!seen.has(key), "Fixture URL arguments cannot be duplicated");
    seen.add(key);
    if (key === "schema") assert.equal(value, "public", "Fixture clients require the reviewed public schema");
    else if (key === "pgbouncer") assert(value === "true" || value === "false", "Fixture PgBouncer compatibility must be explicit boolean text");
    else {
      const maximum = Object.hasOwn(integerLimits, key) ? integerLimits[key] : undefined;
      assert(maximum !== undefined && /^(0|[1-9][0-9]{0,3})$/.test(value) && Number(value) <= maximum && (key === "statement_cache_size" || Number(value) > 0), "Fixture URL arguments must be reviewed bounded connection settings");
    }
  }
}

export function fixtureConfig(value) {
  assert(value.purpose === "isolated_fake_scalability" && value.schemaVersion === 1 && /^mu_scale_[a-z0-9_]{8,35}$/.test(value.database), "An explicitly owned isolated configuration is required");
  for (const [url, suffix] of [[value.runtimeDatabaseUrl, "runtime"], [value.migrationDatabaseUrl, "migration"]]) {
    const parsed = new URL(url);
    fixtureUrlArguments(parsed);
    assert(["postgres:", "postgresql:"].includes(parsed.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname) && parsed.pathname === `/${value.database}` && decodeURIComponent(parsed.username) === `${value.database}_${suffix}`, "Fixture URL scope/identity mismatch");
  }
  const runtime = new URL(value.runtimeDatabaseUrl), migration = new URL(value.migrationDatabaseUrl);
  const mode = value.connectionMode === undefined ? "direct" : value.connectionMode;
  if (mode === "direct") {
    assert.equal(value.pooler, undefined, "Direct fixtures cannot carry pooler metadata");
    assert.equal(runtime.hostname, migration.hostname); assert.equal(runtime.port, migration.port);
  } else {
    assert.equal(mode, "pgbouncer-transaction", "Only explicit reviewed fixture connection modes are accepted");
    assert(value.pooler && typeof value.pooler === "object" && !Array.isArray(value.pooler), "Pooled fixtures require the reviewed pooler descriptor");
    assert.deepEqual(value.pooler, fixtureTransactionPooler, "Fixture pooler host, ports and owned image must match the reviewed boundary");
    assert.equal(runtime.hostname, value.pooler.host); assert.equal(migration.hostname, value.pooler.host);
    assert.equal(runtime.port, value.pooler.port); assert.equal(migration.port, value.pooler.upstreamPort);
  }
  assert.equal(value.runtimeEnvironment?.DATABASE_URL, value.runtimeDatabaseUrl);
  assert.equal(value.runtimeEnvironment?.NODE_ENV, "test");
  assert.equal(path.resolve(value.runtimeEnvironment?.UPLOADS_ROOT ?? ""), path.join(root, ".cache/scalability", value.database, "uploads"));
  assert.equal(value.runtimeEnvironment?.SMTP_HOST, "127.0.0.1");
  return value;
}

export function fixtureDispatchEnvironment(config) {
  fixtureConfig(config);
  const pooled = config.connectionMode === "pgbouncer-transaction";
  return {
    VERIFY_ISOLATED_RUNTIME: "true", VERIFY_FIXTURE_DATABASE_URL: config.migrationDatabaseUrl,
    VERIFY_FIXTURE_CONNECTION_MODE: pooled ? "pgbouncer-transaction" : "direct",
    VERIFY_FIXTURE_POOLER_PORT: pooled ? config.pooler.port : undefined,
    VERIFY_FIXTURE_UPSTREAM_PORT: pooled ? config.pooler.upstreamPort : undefined,
    VERIFY_FIXTURE_POOLER_IMAGE_ID: pooled ? config.pooler.imageId : undefined,
  };
}

let PrismaClient;
function client(url) { assert(PrismaClient, "Verified workspace must precede ORM construction"); return new PrismaClient({ datasources: { db: { url } }, log: [] }); }
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
  PrismaClient = await verificationPrisma();
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

export function reportedCheckCounts(stdout) {
  // Only numeric aggregate evidence crosses the child-output boundary. Never
  // forward arbitrary lines (browser fixtures can contain synthetic tokens).
  return [...stdout.matchAll(/\b(\d+) (?:[\w/, -]{0,100} )?checks(?: passed[.;]|\))/g)].map((match) => Number(match[1]));
}

export function verificationEnvironment(config, inherited = {}) {
  fixtureConfig(config);
  const osNames = new Set(["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "PROGRAMFILES", "PROGRAMFILES(X86)", "PROGRAMW6432", "PATHEXT"]);
  const environment = Object.fromEntries(Object.entries(inherited).filter(([key, value]) => osNames.has(key.toUpperCase()) && typeof value === "string"));
  const runtimeNames = new Set(["NODE_ENV", "PORT", "FRONTEND_URL", "DATABASE_URL", "ENABLE_LOCAL_ADMIN_BOOTSTRAP", "TRUST_PROXY_HOPS", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "MFA_ENCRYPTION_KEY", "BCRYPT_SALT_ROUNDS", "UPLOADS_ROOT", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "SMTP_SECURE", "ACCESS_TOKEN_TTL", "REFRESH_TOKEN_TTL", "ACCESS_TOKEN_COOKIE_NAME", "REFRESH_TOKEN_COOKIE_NAME", "UPLOAD_SCAN_REQUIRED", "CLAMD_HOST", "CLAMD_PORT", "CLAMD_TIMEOUT_MS"]);
  for (const [key, value] of Object.entries(config.runtimeEnvironment)) {
    assert(runtimeNames.has(key) && typeof value === "string" && !value.includes("\0"), "Only explicit reviewed fixture runtime settings are accepted");
    environment[key] = value;
  }
  if (environment.CLAMD_HOST !== undefined) assert(["localhost", "127.0.0.1", "::1"].includes(environment.CLAMD_HOST), "Fixture scanning must remain on loopback");
  for (const name of ["VERIFY_BROWSER", "VERIFY_DESIGN"]) {
    if (inherited[name] !== undefined) {
      assert(inherited[name] === "0" || inherited[name] === "1", "Verification flags require explicit boolean digits");
      environment[name] = inherited[name];
    }
  }
  for (const [key, expected] of [["VERIFY_FRONTEND_BASE_URL", config.runtimeEnvironment.FRONTEND_URL], ["VERIFY_API_BASE_URL", `http://127.0.0.1:${config.runtimeEnvironment.PORT}/api`]]) {
    if (inherited[key] !== undefined) {
      const candidate = new URL(inherited[key]);
      assert(candidate.protocol === "http:" && candidate.hostname === "127.0.0.1" && candidate.username === "" && candidate.password === "" && candidate.search === "" && candidate.hash === "" && candidate.href.replace(/\/$/, "") === expected, "Verification targets must exactly match the owned fixture");
      environment[key] = inherited[key];
    }
  }
  if (inherited.VERIFY_BROWSER_CHANNEL !== undefined) {
    assert(["msedge", "chrome", "chromium"].includes(inherited.VERIFY_BROWSER_CHANNEL), "Only installed reviewed browser channels are accepted");
    environment.VERIFY_BROWSER_CHANNEL = inherited.VERIFY_BROWSER_CHANNEL;
  }
  if (inherited.VERIFY_OPENSSL_PATH !== undefined) {
    assert(path.resolve(inherited.VERIFY_OPENSSL_PATH) === path.resolve("C:/Program Files/Git/usr/bin/openssl.exe"), "Only the reviewed installed OpenSSL is accepted");
    environment.VERIFY_OPENSSL_PATH = inherited.VERIFY_OPENSSL_PATH;
  }
  if (inherited.VERIFY_DESIGN_SCREENSHOTS !== undefined) {
    const relative = path.relative(path.join(root, ".cache/scalability", config.database), path.resolve(inherited.VERIFY_DESIGN_SCREENSHOTS));
    assert(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "Screenshots must remain in this owned fixture directory");
    environment.VERIFY_DESIGN_SCREENSHOTS = path.resolve(inherited.VERIFY_DESIGN_SCREENSHOTS);
  }
  return { ...environment, TSX_TSCONFIG_PATH: path.join(root,"backend/tsconfig.json"), ...fixtureDispatchEnvironment(config) };
}

export function verificationCommand(manifest, script) {
  assert(/^verify:[a-z0-9:-]+$/.test(script) && Object.hasOwn(manifest.scripts, script) && script !== "verify:demo:runtime", "Only existing isolated backend verification scripts are allowed");
  const match = /^tsx (scripts\/[a-z0-9][a-z0-9-]*\.ts)$/.exec(manifest.scripts[script]);
  assert(match, "Only one reviewed repository TypeScript entry without injected arguments is accepted");
  // Supported tsx loader registration avoids a redundant CLI child process.
  return ["--import", pathToFileURL(path.join(root, "scripts/scalability/verification-workspace-bootstrap.mjs")).href, "--import", pathToFileURL(path.join(root, "node_modules/tsx/dist/loader.mjs")).href, path.join(root, "backend", match[1])];
}

export async function verificationDirectory(config) {
  const directory = path.join(root, ".cache/scalability", config.database);
  assert.equal(await realpath(directory), directory, "Fixture parent cannot redirect outside the owned path");
  const cwd = await mkdtemp(path.join(directory, "verification-"));
  const marker = path.join(cwd, "runner.json");
  await writeFile(marker, JSON.stringify({ purpose: "isolated_verification_working_directory" }), { flag: "wx", mode: 0o600 });
  await privateConfigurationFile(marker); // Verify inherited private ACL before starting an application process.
  assert.deepEqual(await readdir(cwd), ["runner.json"], "A fresh verification directory cannot contain dotenv files or project configuration");
  return cwd;
}

export async function runScript(config, script) {
  await requireVerificationWorkspace();
  stage = "owned_verification_child";
  const environment = verificationEnvironment(config, process.env);
  const manifest = JSON.parse(await readFile(path.join(root, "backend/package.json"), "utf8"));
  const command = verificationCommand(manifest, script);
  const workspaceUsesFrontend = script === "verify:event-workspaces" && (environment.VERIFY_FRONTEND_BASE_URL || environment.VERIFY_BROWSER === "1" || environment.VERIFY_DESIGN === "1");
  if (["verify:security-mfa-browser", "verify:security-reset-browser", "verify:network-sign-in"].includes(script) || workspaceUsesFrontend) {
    const frontend = environment.VERIFY_FRONTEND_BASE_URL, api = environment.VERIFY_API_BASE_URL;
    assert(frontend && api, "Owned browser/API targets must be supplied explicitly before isolated browser verification");
    const frontUrl = new URL(frontend), apiUrl = new URL(api);
    assert(frontUrl.origin === config.runtimeEnvironment.FRONTEND_URL && apiUrl.origin === `http://127.0.0.1:${config.runtimeEnvironment.PORT}` && apiUrl.pathname === "/api", "Browser/API targets must match the owned fixture application configuration");
  }
  const cwd = await verificationDirectory(config);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, command, {
      cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: environment,
    });
    let stdout = "", stderr = "";
    let timedOut=false;
    const timeout=setTimeout(()=>{timedOut=true;child.kill();},300_000);
    child.stdout.on("data", (data) => { if (stdout.length < 1024 * 1024) stdout += data.toString(); });
    child.stderr.on("data", (data) => { if (stderr.length < 1024 * 1024) stderr += data.toString(); });
    child.on("error", () => {clearTimeout(timeout);reject(new Error("Verification child could not start"));});
    child.on("close", (code) => {
      clearTimeout(timeout);
      const counts = reportedCheckCounts(stdout);
      let invalidBoundaryReport=false;
      const boundaryReports=stdout.split(/\r?\n/).flatMap(line=>{
        try{
          const value=JSON.parse(line);if(value.materializedWorkspaceBoundary!==true)return [];
          const counters=[value.outsideSourceReadAttempts,value.outsideModuleResolutions,value.outsideNativeLoadAttempts];
          if(!counters.every(count=>Number.isSafeInteger(count)&&count>=0)||!Array.isArray(value.nativeModules)||!value.nativeModules.every(name=>typeof name==="string"&&/^node_modules\/[a-zA-Z0-9_@./-]+\.node$/.test(name)&&!name.split("/").includes(".."))){invalidBoundaryReport=true;return [];}
          return [{materializedWorkspaceBoundary:true,outsideSourceReadAttempts:counters[0],outsideModuleResolutions:counters[1],outsideNativeLoadAttempts:counters[2],nativeModules:value.nativeModules}];
        }catch{return [];}
      });
      if (code !== 0 || timedOut || invalidBoundaryReport || boundaryReports.length!==1 || boundaryReports.some(value=>value.outsideSourceReadAttempts!==0||value.outsideModuleResolutions!==0||value.outsideNativeLoadAttempts!==0)) {
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
      else resolve({ status: "passed", script, exitCode: code, reportedCheckCounts: counts, boundaryReports });
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
