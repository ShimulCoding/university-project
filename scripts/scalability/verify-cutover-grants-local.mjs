import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { operatorParameters, privateConfigurationFile } from "./provision-local-database.mjs";
import { fixtureConfig } from "./verify-local-database.mjs";
import { verifyCutoverGrantSource } from "./verify-cutover-grant-contracts.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const postgresBin = "C:/Program Files/PostgreSQL/16/bin";
let stage = "arguments", currentCase = "initialization", retainedDirectory, completedChecks = 0;
const hash = (value) => createHash("sha256").update(value).digest("hex");
const roleFlags = "rolsuper OR rolcreatedb OR rolcreaterole OR rolinherit OR rolreplication OR rolbypassrls";

export function cutoverEndpoint(parameters) {
  assert(parameters.host === "127.0.0.1" && parameters.port === "15432" && parameters.dbname === "postgres", "Only the approved exact loopback fake operator endpoint is accepted");
  assert(/^[a-z_][a-z0-9_]{1,62}$/.test(parameters.user), "Reviewed operator identifier required");
  return parameters;
}
function identifier(value) { assert(/^[a-z_][a-z0-9_]{1,62}$/.test(value)); return `"${value}"`; }
function url(parameters, database, user, password) { return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:15432/${database}?schema=public&connection_limit=2&pool_timeout=10`; }
function client(value) { const parsed = new URL(value); assert.equal(parsed.hostname, "127.0.0.1"); assert.equal(parsed.port, "15432"); return new PrismaClient({ datasources: { db: { url: value } }, log: [] }); }

function environment(extra = {}) {
  // Do not inherit owner PG/Prisma/auth settings or service/hostaddr overrides.
  const result = Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA", "PATHEXT"].includes(key.toUpperCase())));
  return { ...result, NODE_ENV: "test", PYTHONDONTWRITEBYTECODE: "1", ...extra };
}

function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: environment(), ...options });
    let stdout = "", stderr = "", bytes = 0, exceeded = false;
    const receive = (kind) => (part) => { bytes += part.length; if (bytes > 1024 * 1024) { exceeded = true; child.kill(); } else if (kind === "out") stdout += part.toString(); else stderr += part.toString(); };
    child.stdout.on("data", receive("out")); child.stderr.on("data", receive("err")); child.stdin.on("error", () => {});
    child.on("error", () => reject(new Error("Owned acceptance helper could not start")));
    const timer = setTimeout(() => child.kill(), 180_000);
    child.on("close", (code) => { clearTimeout(timer); if (exceeded) reject(new Error("Owned acceptance output bound exceeded")); else resolve({ code, stdout, stderr }); });
    child.stdin.end(options.input ?? "");
  });
}

async function ownerOnly(directory) {
  assert.equal(process.platform, "win32");
  const cache = path.join(root, ".cache/scalability"), relative = path.relative(cache, directory);
  assert(!relative.startsWith("..") && !path.isAbsolute(relative));
  const literal = `'${directory.replaceAll("'", "''")}'`;
  const script = `$taskDir=${literal}; $taskSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $taskAcl=New-Object System.Security.AccessControl.DirectorySecurity; $taskAcl.SetAccessRuleProtection($true,$false); $taskAcl.SetOwner($taskSid); $taskRule=New-Object System.Security.AccessControl.FileSystemAccessRule($taskSid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $taskAcl.AddAccessRule($taskRule); Set-Acl -LiteralPath $taskDir -AclObject $taskAcl -ErrorAction Stop; $taskCheck=Get-Acl -LiteralPath $taskDir; if($taskCheck.Access.Count -ne 1 -or $taskCheck.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $taskSid.Value){throw 'Owned acceptance ACL failed'}`;
  assert.equal((await capture("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script])).code, 0, "Private directory ACL required before credentials");
}

async function privateHelper(operation, parameters, database, passwords) {
  const result = await capture("python", ["-B", path.join(root, "scripts/scalability/postgres-cutover-fixture.py")], { input: JSON.stringify({ operation, operator: parameters, database, passwords, libraryDirectory: postgresBin }) });
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error("Private helper returned no reviewed protocol"); }
  if (result.code !== 0) {
    const failure = new Error("Private cutover helper failed");
    if (/^[a-z_]{1,80}$/.test(report.stage)) failure.helperStage = report.stage;
    if (/^[A-Z0-9]{5}$/.test(report.sqlState)) failure.sqlState = report.sqlState;
    throw failure;
  }
  assert.equal(report.database, database); assert.equal(report.serverVersionNumber, 160015);
  assert.equal(report.status, operation === "create_migration_only_fixture" ? "created_migration_only" : "set_new_runtime_password");
  return report;
}

async function identity(db, database, role) {
  const rows = await db.$queryRaw`SELECT current_database() AS database, current_user AS role, current_setting('server_version_num') AS version`;
  assert.deepEqual(rows, [{ database, role, version: "160015" }]);
}

async function migrationState(db, expected) {
  const rows = await db.$queryRaw`SELECT migration_name AS name, checksum FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
  assert.deepEqual(rows, expected); return hash(JSON.stringify(rows));
}

async function schemaState(db) {
  const [relations, columns, enums, schema, defaults, objects, constraints, indexes] = await Promise.all([
    db.$queryRaw`SELECT c.relname, c.relkind, c.relispartition, pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S') ORDER BY c.relname`,
    db.$queryRaw`SELECT c.relname, a.attname, format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull, a.attacl::text AS acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND c.relkind='r' ORDER BY c.relname,a.attnum`,
    db.$queryRaw`SELECT t.typname, pg_get_userbyid(t.typowner) AS owner, e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
    db.$queryRaw`SELECT n.nspname, pg_get_userbyid(n.nspowner) AS owner, n.nspacl::text AS acl, pg_get_userbyid(d.datdba) AS database_owner, d.datacl::text AS database_acl FROM pg_namespace n CROSS JOIN pg_database d WHERE n.nspname='public' AND d.datname=current_database()`,
    db.$queryRaw`SELECT d.defaclrole::text,d.defaclnamespace::text,d.defaclobjtype,d.defaclacl::text FROM pg_default_acl d ORDER BY d.oid`,
    db.$queryRaw`SELECT 'function' AS kind,p.proname AS name FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' UNION ALL SELECT 'trigger',t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal UNION ALL SELECT 'rule',r.rulename FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY kind,name`,
    db.$queryRaw`SELECT c.relname, k.conname, k.contype, k.convalidated, pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname`,
    db.$queryRaw`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname`,
  ]);
  return hash(JSON.stringify({ relations, columns, enums, schema, defaults, objects, constraints, indexes }));
}

async function dataState(db, ids) {
  const rows = await Promise.all([
    db.user.findMany({ where: { id: ids.user } }), db.event.findMany({ where: { id: ids.event } }),
    db.incomeRecord.findMany({ where: { id: ids.income } }), db.expenseRecord.findMany({ where: { id: ids.expense } }),
    db.auditLog.findMany({ where: { actorId: ids.user }, orderBy: { id: "asc" } }), db.financialIdempotency.findMany({ where: { actorId: ids.user }, orderBy: { id: "asc" } }),
    db.refreshToken.findMany({ where: { userId: ids.user } }), db.passwordResetToken.findMany({ where: { userId: ids.user } }), db.mfaChallenge.findMany({ where: { userId: ids.user } }),
  ]);
  return { fingerprint: hash(JSON.stringify(rows)), rows: rows.reduce((sum, value) => sum + value.length, 0) };
}

async function verifyLocal(operatorFile) {
  stage = "private_operator_guard";
  assert(operatorFile, "An explicit approved fake operator file is required");
  const parameters = cutoverEndpoint(operatorParameters(JSON.parse(await readFile(await privateConfigurationFile(operatorFile), "utf8"))));
  const [sqlBytes, schemaBytes] = await Promise.all([readFile(path.join(root, "docs/security-runtime-grants.sql")), readFile(path.join(root, "backend/prisma/schema.prisma"))]);
  const sql = sqlBytes.toString("utf8"); verifyCutoverGrantSource(sql, schemaBytes.toString("utf8"));
  const fences = [...sql.matchAll(/RAISE EXCEPTION '([^']+)'/g)].map((value) => value[1]);
  const schemaEngine = path.join(root, "node_modules/@prisma/engines/schema-engine-windows.exe");
  assert((await stat(schemaEngine)).isFile(), "Only the already installed schema engine is allowed");
  const psqlVersion = await capture(path.join(postgresBin, "psql.exe"), ["--version"]);
  assert.equal(psqlVersion.code, 0); assert(/^psql \(PostgreSQL\) 16\.13\s*$/.test(psqlVersion.stdout.trim()), "Reviewed installed PostgreSQL client required");
  const names = (await readdir(path.join(root, "backend/prisma/migrations"), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  assert.equal(names.length, 14); assert(names.every((name) => /^[a-z0-9_]+$/.test(name)));
  const expectedMigrations = await Promise.all(names.map(async (name) => ({ name, checksum: hash(await readFile(path.join(root, "backend/prisma/migrations", name, "migration.sql"))) })));
  const database = `mu_scale_${randomUUID().replaceAll("-", "")}`, runtimeRole = `${database}_runtime`, migrationRole = `${database}_migration`;
  const passwords = { [runtimeRole]: randomBytes(32).toString("base64url"), [migrationRole]: randomBytes(32).toString("base64url") };
  const directory = path.join(root, ".cache/scalability", database); retainedDirectory = path.relative(root, directory);
  await mkdir(directory, { recursive: false, mode: 0o700 }); await ownerOnly(directory);
  const runtimeDatabaseUrl = url(parameters, database, runtimeRole, passwords[runtimeRole]), migrationDatabaseUrl = url(parameters, database, migrationRole, passwords[migrationRole]);
  const runtimeEnvironment = { NODE_ENV: "test", PORT: "4400", FRONTEND_URL: "http://127.0.0.1:3400", DATABASE_URL: runtimeDatabaseUrl, ENABLE_LOCAL_ADMIN_BOOTSTRAP: "false", TRUST_PROXY_HOPS: "0", JWT_ACCESS_SECRET: randomBytes(48).toString("base64url"), JWT_REFRESH_SECRET: randomBytes(48).toString("base64url"), MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64"), BCRYPT_SALT_ROUNDS: "12", UPLOADS_ROOT: path.join(directory, "uploads"), SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_USER: "isolated-fixture", SMTP_PASS: "isolated-fixture-never-a-real-mailbox", SMTP_FROM: "fixture@example.invalid" };
  const config = fixtureConfig({ schemaVersion: 1, purpose: "isolated_fake_scalability", database, runtimeRole, migrationRole, runtimeDatabaseUrl, migrationDatabaseUrl, runtimeEnvironment });
  await writeFile(path.join(directory, "fixture.json"), JSON.stringify(config, null, 2), { flag: "wx", mode: 0o600 });
  await privateConfigurationFile(path.join(directory, "fixture.json"));
  await writeFile(path.join(directory, "executed-runtime-grants.sql"), sqlBytes, { flag: "wx", mode: 0o600 });
  await writeFile(path.join(directory, "schema.prisma"), schemaBytes, { flag: "wx", mode: 0o600 });
  await mkdir(path.join(directory, "migrations"));
  await copyFile(path.join(root, "backend/prisma/migrations/migration_lock.toml"), path.join(directory, "migrations/migration_lock.toml"));
  for (const name of names) {
    await mkdir(path.join(directory, "migrations", name));
    await copyFile(path.join(root, "backend/prisma/migrations", name, "migration.sql"), path.join(directory, "migrations", name, "migration.sql"));
    assert.equal(hash(await readFile(path.join(directory, "migrations", name, "migration.sql"))), expectedMigrations.find((value) => value.name === name).checksum);
  }
  await writeFile(path.join(directory, "package.json"), JSON.stringify({ private: true, name: "isolated-cutover-acceptance" }), { flag: "wx", mode: 0o600 });
  stage = "create_new_migration_only_fixture";
  const helper = await privateHelper("create_migration_only_fixture", parameters, database, passwords);
  stage = "fourteen_copied_migrations";
  const deployed = await capture(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", path.join(directory, "schema.prisma")], { cwd: directory, env: environment({ DATABASE_URL: migrationDatabaseUrl, PRISMA_SCHEMA_ENGINE_BINARY: schemaEngine, PRISMA_HIDE_UPDATE_MESSAGE: "true" }) });
  assert.equal(deployed.code, 0, "Fresh fake migrations failed; output remains private");
  const operator = client(url(parameters, database, parameters.user, parameters.password)), migration = client(migrationDatabaseUrl);
  let runtime;
  const results = [], check = (label) => { currentCase = label; results.push(label); completedChecks = results.length; };
  const ids = { user: randomUUID(), event: randomUUID(), income: randomUUID(), expense: randomUUID() };
  try {
    await identity(operator, database, parameters.user); await identity(migration, database, migrationRole); check("actual_operator_and_migrator_identity");
    const migrationFingerprint = await migrationState(migration, expectedMigrations); check("fourteen_exact_source_checksums");
    await migration.user.create({ data: { id: ids.user, fullName: "Synthetic cutover sentinel", email: `cutover-${randomUUID()}@example.invalid`, studentId: randomUUID(), passwordHash: "synthetic-not-an-authentication-secret" } });
    await migration.event.create({ data: { id: ids.event, title: "Synthetic cutover sentinel", slug: `cutover-${randomUUID()}` } });
    await migration.incomeRecord.create({ data: { id: ids.income, eventId: ids.event, recordedById: ids.user, sourceType: "DONATION", sourceLabel: "Synthetic sentinel", amount: "1.00" } });
    await migration.expenseRecord.create({ data: { id: ids.expense, eventId: ids.event, recordedById: ids.user, category: "Synthetic", description: "Synthetic sentinel", amount: "1.00" } });
    await migration.auditLog.create({ data: { actorId: ids.user, eventId: ids.event, action: "synthetic.cutover", entityType: "Synthetic", entityId: ids.event } });
    for (const [operation, result] of [["INCOME_CREATE", { incomeRecordId: ids.income }], ["EXPENSE_CREATE", { expenseRecordId: ids.expense }]]) await migration.financialIdempotency.create({ data: { actorId: ids.user, eventId: ids.event, operation, key: randomUUID(), inputHash: "0".repeat(64), ...result } });
    const expiresAt = new Date(Date.now() + 3600_000);
    await migration.refreshToken.create({ data: { userId: ids.user, tokenHash: `synthetic-${randomUUID()}`, expiresAt } });
    await migration.passwordResetToken.create({ data: { userId: ids.user, tokenHash: `synthetic-${randomUUID()}`, expiresAt } });
    await migration.mfaChallenge.create({ data: { userId: ids.user, tokenHash: `synthetic-${randomUUID()}`, expiresAt, sessionVersion: 0, loginScope: "synthetic", mode: "synthetic" } });
    const beforeData = await dataState(migration, ids), beforeSchema = await schemaState(operator);
    assert.equal(beforeData.rows, 10); check("ten_synthetic_rows_preserved_baseline");
    const baseVariables = { database_name: database, runtime_role: runtimeRole, migration_role: migrationRole, operator_role: parameters.user, reviewed_policy: "2026-10-12-column-grants-v1" };
    const psql = async (variables, prefix = "") => {
      await identity(operator, database, parameters.user);
      const args = ["-X", "--no-password", "--host", "127.0.0.1", "--port", "15432", "--username", parameters.user, "--dbname", database, "--set", "ON_ERROR_STOP=on", "--set", "VERBOSITY=verbose", "--set", "ECHO=none"];
      for (const [key, value] of Object.entries(variables)) args.push("--set", `${key}=${value}`);
      return capture(path.join(postgresBin, "psql.exe"), args, { env: environment({ PGPASSWORD: parameters.password, PGHOSTADDR: "127.0.0.1", PGCONNECT_TIMEOUT: "5", PSQL_HISTORY: path.join(directory, "unused_history") }), input: prefix + sql });
    };
    const unchanged = async () => {
      assert.deepEqual(await dataState(migration, ids), beforeData);
      assert.equal(await schemaState(operator), beforeSchema);
      assert.equal(await migrationState(migration, expectedMigrations), migrationFingerprint);
      const flags = await operator.$queryRawUnsafe(`SELECT 1 FROM pg_roles WHERE rolname=$1 AND NOT (${roleFlags})`, migrationRole);
      assert.equal(flags.length, 1);
      const ownedRoles = await operator.$queryRaw`SELECT rolname FROM pg_roles WHERE left(rolname, length(${database}))=${database} ORDER BY rolname`;
      assert.deepEqual(ownedRoles, [{ rolname: migrationRole }], "All negative role creation must roll back");
    };
    const negative = async (label, variables = baseVariables, mutation = "") => {
      stage = "exact_template_negative"; currentCase = label;
      const missingFences = { database_name: "Missing explicit approved database_name", runtime_role: "Missing explicit new runtime_role", migration_role: "Missing explicit separate migration_role", operator_role: "Missing explicit current operator_role", reviewed_policy: "Missing explicit reviewed_policy" };
      const expectedFence = label.startsWith("missing_") ? missingFences[label.slice(8)]
        : ["wrong_database", "wrong_operator", "wrong_policy"].includes(label) ? "Refusing unapproved database, operator or role scope"
        : label === "existing_runtime_role" ? "A named administrator and a never-existing runtime role are required"
        : ["privileged_migrator", "member_migrator", "wrong_database_owner"].includes(label) ? "A separate restricted migration owner must be prepared and reviewed first"
        : ["wrong_table_owner", "unknown_table"].includes(label) ? "Unexpected application tables, relation types or owners"
        : ["wrong_schema_owner", "unknown_namespace"].includes(label) ? "Unexpected application namespace or schema owner"
        : ["wrong_enum_owner", "unknown_column", "changed_precision", "changed_nullability", "changed_primary_key", "unknown_enum_label"].includes(label) ? "Unreviewed column names, types, nullability, primary keys or enums"
        : ["unknown_function", "unknown_trigger", "unknown_rule"].includes(label) ? "Unreviewed inheritance, functions, triggers, rules or generated columns"
        : label === "maintenance_history_parent" ? "Maintenance DELETE could indirectly mutate protected history"
        : label.startsWith("public_") ? "Review PUBLIC database, schema, table, column and future-table grants separately" : null;
      assert(expectedFence && fences.includes(expectedFence), "Every actual negative requires its exact reviewed exception");
      const prefix = mutation ? `BEGIN;\n${mutation}\nSELECT 'cutover_prefix_applied';\n` : "";
      const attempt = await psql(variables, prefix);
      assert.equal(attempt.code, 3, "Negative template must stop with ON_ERROR_STOP");
      assert(/ERROR:\s+P0001:/.test(attempt.stderr), "Negative must fail in an actual template fence, not its setup");
      assert(attempt.stderr.includes(expectedFence), "The exact intended template fence must fail; another exception is not a passing negative");
      if (mutation) assert(attempt.stdout.includes("cutover_prefix_applied"), "Controlled negative setup must complete before the template");
      const roles = await operator.$queryRaw`SELECT 1 FROM pg_roles WHERE rolname=${runtimeRole}`; assert.equal(roles.length, 0);
      await unchanged(); check(label);
    };
    for (const key of Object.keys(baseVariables)) { const values = { ...baseVariables }; delete values[key]; await negative(`missing_${key}`, values); }
    await negative("wrong_database", { ...baseVariables, database_name: `${database}_wrong` });
    await negative("wrong_operator", { ...baseVariables, operator_role: "synthetic_wrong_operator" });
    await negative("wrong_policy", { ...baseVariables, reviewed_policy: "synthetic_wrong_policy" });
    await negative("existing_runtime_role", baseVariables, `CREATE ROLE ${identifier(runtimeRole)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;`);
    await negative("privileged_migrator", baseVariables, `ALTER ROLE ${identifier(migrationRole)} SUPERUSER;`);
    const memberRole = `${database}_member`;
    await negative("member_migrator", baseVariables, `CREATE ROLE ${identifier(memberRole)} NOLOGIN; GRANT ${identifier(memberRole)} TO ${identifier(migrationRole)};`);
    await negative("wrong_database_owner", baseVariables, `ALTER DATABASE ${identifier(database)} OWNER TO ${identifier(parameters.user)};`);
    await negative("wrong_table_owner", baseVariables, `ALTER TABLE public."User" OWNER TO ${identifier(parameters.user)};`);
    await negative("wrong_enum_owner", baseVariables, `ALTER TYPE public."AccountStatus" OWNER TO ${identifier(parameters.user)};`);
    await negative("wrong_schema_owner", baseVariables, `ALTER SCHEMA public OWNER TO ${identifier(parameters.user)};`);
    await negative("unknown_namespace", baseVariables, `CREATE SCHEMA cutover_unreviewed_schema AUTHORIZATION ${identifier(migrationRole)};`);
    await negative("unknown_table", baseVariables, 'CREATE TABLE public.cutover_unreviewed_table(id integer);');
    await negative("unknown_column", baseVariables, 'ALTER TABLE public."User" ADD COLUMN cutover_unreviewed_column text;');
    await negative("changed_precision", baseVariables, 'ALTER TABLE public."IncomeRecord" ALTER COLUMN amount TYPE numeric(13,2);');
    await negative("changed_nullability", baseVariables, 'ALTER TABLE public."User" ALTER COLUMN "studentId" SET NOT NULL;');
    await negative("changed_primary_key", baseVariables, 'ALTER TABLE public."MfaFactor" DROP CONSTRAINT "MfaFactor_pkey";');
    await negative("unknown_enum_label", baseVariables, "ALTER TYPE public.\"AccountStatus\" ADD VALUE 'CUTOVER_UNREVIEWED';");
    await negative("unknown_function", baseVariables, "CREATE FUNCTION public.cutover_unreviewed_function() RETURNS integer LANGUAGE sql IMMUTABLE AS 'SELECT 1';");
    await negative("unknown_trigger", baseVariables, 'CREATE TRIGGER cutover_unreviewed_trigger BEFORE UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION pg_catalog.suppress_redundant_updates_trigger();');
    await negative("unknown_rule", baseVariables, 'CREATE RULE cutover_unreviewed_rule AS ON UPDATE TO public."User" DO INSTEAD NOTHING;');
    await negative("public_database_temp", baseVariables, `GRANT TEMP ON DATABASE ${identifier(database)} TO PUBLIC;`);
    await negative("public_database_create", baseVariables, `GRANT CREATE ON DATABASE ${identifier(database)} TO PUBLIC;`);
    await negative("public_schema_create", baseVariables, 'GRANT CREATE ON SCHEMA public TO PUBLIC;');
    await negative("public_table_select", baseVariables, 'GRANT SELECT ON public."User" TO PUBLIC;');
    await negative("public_key_column_update", baseVariables, 'GRANT UPDATE (id) ON public."User" TO PUBLIC;');
    await negative("public_future_table_select", baseVariables, `ALTER DEFAULT PRIVILEGES FOR ROLE ${identifier(migrationRole)} IN SCHEMA public GRANT SELECT ON TABLES TO PUBLIC;`);
    await negative("maintenance_history_parent", baseVariables, 'ALTER TABLE public."RefreshToken" ADD CONSTRAINT cutover_unique_refresh_user UNIQUE ("userId"); ALTER TABLE public."AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey"; ALTER TABLE public."AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES public."RefreshToken"("userId") ON DELETE SET NULL ON UPDATE CASCADE;');
    stage = "exact_template_success"; currentCase = "exact_template_success";
    const applied = await psql(baseVariables);
    if (applied.code !== 0) { const failure = new Error("Exact template failed"); failure.sqlState = applied.stderr.match(/ERROR:\s+([A-Z0-9]{5}):/)?.[1]; failure.fence = fences.find((value) => applied.stderr.includes(value)); throw failure; }
    check("exact_template_success"); assert.deepEqual(await dataState(migration, ids), beforeData); assert.equal(await migrationState(migration, expectedMigrations), migrationFingerprint); check("success_preserves_data_and_migrations");
    await privateHelper("set_unset_new_runtime_password", parameters, database, passwords);
    runtime = client(runtimeDatabaseUrl); await identity(runtime, database, runtimeRole); check("actual_restricted_runtime_identity");
    const flags = await runtime.$queryRaw`SELECT rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=current_user`;
    assert.equal(flags.length, 1); assert(Object.values(flags[0]).every((value) => value === false)); check("six_restricted_runtime_attributes");
    const rollback = new Error("owned controlled rollback"); let changedBefore = 0;
    try {
      await operator.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`GRANT UPDATE ON TABLE public."User" TO ${identifier(runtimeRole)}`);
        await tx.$executeRawUnsafe(`SET LOCAL ROLE ${identifier(runtimeRole)}`);
        await identity(tx, database, runtimeRole);
        const changedId = `${ids.user}-cascade`;
        await tx.$executeRaw`UPDATE public."User" SET id=${changedId} WHERE id=${ids.user}`;
        changedBefore = await tx.auditLog.count({ where: { actorId: changedId } }) + await tx.financialIdempotency.count({ where: { actorId: changedId } });
        assert.equal(changedBefore, 3); throw rollback;
      }, { timeout: 15_000 });
    } catch (error) { if (error !== rollback) throw error; }
    assert.deepEqual(await dataState(migration, ids), beforeData); check("naive_key_grant_changes_three_history_rows_then_rolls_back");
    const denials = [
      'UPDATE public."User" SET id=id WHERE false', 'UPDATE public."Event" SET id=id WHERE false', 'UPDATE public."IncomeRecord" SET id=id WHERE false', 'UPDATE public."ExpenseRecord" SET id=id WHERE false', 'UPDATE public."MfaFactor" SET "userId"="userId" WHERE false',
      'UPDATE public."AuditLog" SET action=action WHERE false', 'DELETE FROM public."AuditLog" WHERE false', 'TRUNCATE public."AuditLog"',
      'UPDATE public."FinancialIdempotency" SET "inputHash"="inputHash" WHERE false', 'DELETE FROM public."FinancialIdempotency" WHERE false', 'TRUNCATE public."FinancialIdempotency"',
      'SELECT * FROM public._prisma_migrations', 'CREATE TABLE public.cutover_runtime_forbidden(id integer)', 'CREATE TEMP TABLE cutover_runtime_forbidden(id integer)', `SET ROLE ${identifier(migrationRole)}`,
    ];
    for (let index = 0; index < denials.length; index++) {
      stage = "runtime_permission_negative"; currentCase = `runtime_denial_${index}`;
      await assert.rejects(runtime.$transaction(async (tx) => { await tx.$executeRawUnsafe(denials[index]); throw new Error("Forbidden statement unexpectedly succeeded; transaction must roll back"); }), (error) => error?.code === "P2010" && error?.meta?.code === "42501");
      assert.deepEqual(await dataState(migration, ids), beforeData); check(currentCase);
    }
    stage = "ordinary_and_maintenance_positive";
    try {
      await runtime.$transaction(async (tx) => {
        await tx.user.update({ where: { id: ids.user }, data: { fullName: "Synthetic ordinary update" } });
        await tx.incomeRecord.update({ where: { id: ids.income }, data: { state: "VERIFIED", verifiedById: ids.user } });
        await tx.expenseRecord.update({ where: { id: ids.expense }, data: { state: "SETTLED", paidAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: ids.user, action: "synthetic.runtime_acceptance", entityType: "Synthetic", entityId: ids.event } });
        assert.equal((await tx.refreshToken.deleteMany({ where: { userId: ids.user } })).count, 1);
        assert.equal((await tx.passwordResetToken.deleteMany({ where: { userId: ids.user } })).count, 1);
        assert.equal((await tx.mfaChallenge.deleteMany({ where: { userId: ids.user } })).count, 1);
        throw rollback;
      });
    } catch (error) { if (error !== rollback) throw error; }
    assert.deepEqual(await dataState(migration, ids), beforeData); check("ordinary_updates_audit_insert_and_three_maintenance_deletes_rollback");
    assert.equal(await migrationState(migration, expectedMigrations), migrationFingerprint); check("final_fourteen_checksums_and_ten_rows_unchanged");
    assert.equal(hash(await readFile(path.join(root, "docs/security-runtime-grants.sql"))), hash(sqlBytes)); check("executed_exact_current_source_bytes");
    const size = await migration.$queryRaw`SELECT pg_database_size(current_database())::text AS bytes`;
    await identity(migration, database, migrationRole);
    await migration.$transaction(async (tx) => { await tx.auditLog.deleteMany({ where: { actorId: ids.user } }); await tx.event.delete({ where: { id: ids.event } }); await tx.user.delete({ where: { id: ids.user } }); });
    assert.equal((await dataState(migration, ids)).rows, 0); check("only_owned_ten_synthetic_rows_cleaned");
    const report = { status: "passed", checks: results.length, database, fixtureConfiguration: path.relative(root, path.join(directory, "fixture.json")), sourceSqlSha256: hash(sqlBytes), sourceMigrations: expectedMigrations, sourceMigrationCount: 14, serverVersion: "16.15", psqlVersion: "16.13", libpqVersion: helper.libpqVersion, nativeNode: process.version, syntheticRowsBefore: beforeData.rows, unchangedRowsBeforeCleanup: beforeData.rows, ownedRowsAfterCleanup: 0, databaseBytesBeforeCleanup: Number(size[0].bytes), historyRowsChangedUnderNaiveGrant: changedBefore, historyRowsChangedUnderRestrictedGrant: 0, cases: results, scope: "one fresh fake database/direct runtime; owner and existing browser fixture untouched; pooled/full app suites remain separate" };
    await writeFile(path.join(directory, "acceptance-report.json"), JSON.stringify(report, null, 2), { flag: "wx", mode: 0o600 });
    return report;
  } finally {
    await Promise.all([operator.$disconnect(), migration.$disconnect(), runtime?.$disconnect()]);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 3 || args[0] !== "--confirm-new-cutover-fixture" || args[1] !== "--operator-config") { console.error("Usage: --confirm-new-cutover-fixture --operator-config ignored-approved-private-operator.json"); process.exitCode = 1; }
  else verifyLocal(args[2]).then((value) => console.log(JSON.stringify(value, null, 2))).catch(async (error) => {
    const databaseCode = error.sqlState ?? error.meta?.code;
    const failure = { status: "failed", stage, case: currentCase, checksPassed: completedChecks, ...(retainedDirectory ? { retainedDirectory } : {}), ...(/^[a-z_]{1,80}$/.test(error.helperStage) ? { helperStage: error.helperStage } : {}), ...(/^[A-Z0-9]{5}$/.test(databaseCode) ? { sqlState: databaseCode } : {}), ...(/^P[0-9]{4}$/.test(error.code) ? { code: error.code } : {}), ...(typeof error.actual === "number" ? { actual: error.actual } : {}), ...(typeof error.expected === "number" ? { expected: error.expected } : {}), ...(typeof error.fence === "string" ? { fence: error.fence } : {}), details: "Private diagnostics suppressed; retain all new fixture data/files/roles; no owner or existing fixture fallback" };
    if (retainedDirectory) await writeFile(path.join(root, retainedDirectory, `failure-${randomUUID()}.json`), JSON.stringify(failure, null, 2), { flag: "wx", mode: 0o600 }).catch(() => {});
    console.error(JSON.stringify(failure)); process.exitCode = 1;
  });
}
