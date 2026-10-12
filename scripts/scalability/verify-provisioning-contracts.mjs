import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { operatorParameters, privateConfigurationFile } from "./provision-local-database.mjs";
import { fixtureConfig } from "./verify-local-database.mjs";

// Pure input/process-boundary contracts. Real restricted-database integration
// remains a separate gate; this script never connects, migrates or provisions.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const database = "mu_scale_guard_contract_00000000";
const url = (suffix) => `postgresql://${database}_${suffix}:synthetic-contract-only@127.0.0.1:15432/${database}`;
const baseline = {
  schemaVersion: 1, purpose: "isolated_fake_scalability", database,
  runtimeDatabaseUrl: url("runtime"), migrationDatabaseUrl: url("migration"),
  runtimeEnvironment: { DATABASE_URL: url("runtime"), NODE_ENV: "test", UPLOADS_ROOT: path.join(root, ".cache/scalability", database, "uploads"), SMTP_HOST: "127.0.0.1", FRONTEND_URL: "http://127.0.0.1:3300", PORT: "4300" },
};
let checks = 0;
let currentCase = "initialization";

function check(label, action) { currentCase = label; action(); checks++; }
async function asyncCheck(label, action) { currentCase = label; await action(); checks++; }
function rejectedConfig(label, change) {
  check(label, () => { const candidate = structuredClone(baseline); change(candidate); assert.throws(() => fixtureConfig(candidate)); });
}

function capture(command, args, input = "") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    let stdout = "", stderr = "";
    let bytes = 0;
    const receive = (kind) => (chunk) => {
      bytes += chunk.length;
      if (bytes > 128 * 1024) child.kill();
      else if (kind === "out") stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    child.stdout.on("data", receive("out")); child.stderr.on("data", receive("err"));
    child.stdin.on("error", () => {});
    child.on("error", () => reject(new Error("Guard contract subprocess could not start.")));
    const timer = setTimeout(() => child.kill(), 20_000);
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout, stderr }); });
    child.stdin.end(input);
  });
}

function functionSource(source, declaration) {
  // Execute only the repository-owned helper under test. node:vm is not an
  // untrusted-code security sandbox; these contexts inject I/O tripwires.
  const start = source.indexOf(declaration);
  const end = source.indexOf("\nif (process.argv[1]", start);
  assert(start >= 0 && end > start, "Expected helper source boundaries must remain present.");
  return source.slice(start, end);
}

async function provisioningOrder() {
  const source = await readFile(path.join(root, "scripts/scalability/provision-local-database.mjs"), "utf8");
  const selected = functionSource(source, "async function provision(operatorFile)");
  let forbiddenReads = 0;
  const forbiddenRead = new Error("owner-byte-read tripwire");
  const invalidFile = new Error("invalid-private-file tripwire");
  const context = vm.createContext({ root, path, createHash, stage: "contract", privateConfigurationFile: async () => { throw invalidFile; }, readFile: async () => { forbiddenReads++; throw forbiddenRead; } });
  const provision = new vm.Script(`${selected}\nprovision;`).runInContext(context, { timeout: 1_000 });
  await asyncCheck("no explicit operator rejects before owner bytes", async () => {
    await assert.rejects(provision(), (error) => error !== forbiddenRead && /explicit isolated operator/.test(error.message));
    assert.equal(forbiddenReads, 0);
  });
  await asyncCheck("invalid private operator path rejects before owner bytes", async () => {
    await assert.rejects(provision("backend/.env"), (error) => error === invalidFile);
    assert.equal(forbiddenReads, 0);
  });
}

async function dispatchContracts() {
  const source = await readFile(path.join(root, "scripts/scalability/verify-local-database.mjs"), "utf8");
  const selected = functionSource(source, "async function runScript(config, script)");
  const manifest = JSON.parse(await readFile(path.join(root, "backend/package.json"), "utf8"));
  const spawnTripwire = new Error("owned-process-spawn tripwire");
  let attemptedSpawns = 0;
  const taskProcess = { env: {}, execPath: process.execPath };
  const context = vm.createContext({
    root, path, assert, URL, stage: "contract", process: taskProcess,
    readFile: async (file) => { assert.equal(file, path.join(root, "backend/package.json")); return JSON.stringify(manifest); },
    spawn: () => { attemptedSpawns++; throw spawnTripwire; },
  });
  const run = new vm.Script(`${selected}\nrunScript;`).runInContext(context, { timeout: 1_000 });
  const blocked = async (label, script, env = {}) => asyncCheck(label, async () => {
    taskProcess.env = env;
    const before = attemptedSpawns;
    await assert.rejects(run(structuredClone(baseline), script), (error) => error !== spawnTripwire && error.name === "AssertionError" && error.code === "ERR_ASSERTION");
    assert.equal(attemptedSpawns, before, "Rejected dispatch must not spawn any application/verifier.");
  });
  const allowed = async (label, script, env = {}) => asyncCheck(label, async () => {
    taskProcess.env = env;
    const before = attemptedSpawns;
    await assert.rejects(run(structuredClone(baseline), script), (error) => error === spawnTripwire);
    assert.equal(attemptedSpawns, before + 1, "Positive guard control must reach the stopped spawn boundary.");
  });
  await blocked("compiler manifest command is rejected", "verify:seed-types");
  await blocked("unknown verifier is rejected", "verify:not-a-script");
  manifest.scripts["verify:unsafe-contract"] = "tsx synthetic.ts; other-command";
  await blocked("shell-bearing manifest command is rejected", "verify:unsafe-contract");
  for (const script of ["verify:security-mfa-browser", "verify:security-reset-browser", "verify:network-sign-in"]) {
    await blocked("browser dispatch requires explicit targets", script);
    await blocked("browser dispatch rejects owner ports", script, { VERIFY_FRONTEND_BASE_URL: "http://localhost:3000", VERIFY_API_BASE_URL: "http://localhost:4000/api" });
  }
  await blocked("workspace browser flag requires owned targets", "verify:event-workspaces", { VERIFY_BROWSER: "1" });
  await blocked("workspace design flag rejects owner ports", "verify:event-workspaces", { VERIFY_DESIGN: "1", VERIFY_FRONTEND_BASE_URL: "http://localhost:3000", VERIFY_API_BASE_URL: "http://localhost:4000/api" });
  await allowed("pure workspace reaches stopped verifier dispatch", "verify:event-workspaces");
  await allowed("owned browser targets reach stopped verifier dispatch", "verify:security-mfa-browser", { VERIFY_FRONTEND_BASE_URL: "http://127.0.0.1:3300", VERIFY_API_BASE_URL: "http://127.0.0.1:4300/api" });
  await allowed("ordinary security verifier reaches stopped dispatch", "verify:security-logging");
  const failedChild = async (lines) => {
    taskProcess.env = {};
    context.spawn = () => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      queueMicrotask(() => { child.stderr.emit("data", Buffer.from(lines.join("\n"))); child.emit("close", 1); });
      return child;
    };
    let captured;
    await assert.rejects(run(structuredClone(baseline), "verify:security-logging"), (error) => {
      captured = error;
      return error.message === "Verification child failed; private output suppressed";
    });
    // Normalize only the synthetic report across VM object prototypes.
    return captured.diagnostics === undefined ? null : JSON.parse(JSON.stringify(captured.diagnostics));
  };
  await asyncCheck("safe SQLSTATE and numeric failure diagnostics survive dispatcher", async () => {
    assert.deepEqual(await failedChild([JSON.stringify({ verificationFailure: true, kind: "PrismaClientKnownRequestError", code: "P2010", databaseCode: "42501", actual: 500, expected: 200, status: 500 })]),
      { kind: "PrismaClientKnownRequestError", code: "P2010", databaseCode: "42501", actual: 500, expected: 200, status: 500 });
  });
  await asyncCheck("raw malformed and unapproved child diagnostic fields are discarded", async () => {
    assert.deepEqual(await failedChild([
      "synthetic raw diagnostic must not survive", "{malformed-json",
      JSON.stringify({ verificationFailure: true, kind: "UnapprovedDiagnosticClass", code: "bad-format:synthetic", databaseCode: "TOOLONG", actual: "synthetic", expected: null, status: "500", message: "synthetic raw message", connection: url("runtime") }),
    ]), {});
  });
  await asyncCheck("unmarked child diagnostic JSON is ignored", async () => {
    assert.equal(await failedChild([JSON.stringify({ verificationFailure: false, kind: "AppError", code: "P2010", databaseCode: "42501", status: 500 })]), null);
  });
}

async function pythonContracts() {
  const source = String.raw`
import copy, io, json, os, pathlib, sys
filename = pathlib.Path('scripts/scalability/postgres-local-admin.py')
namespace = {'__name__': 'provisioning_guard_contract', '__file__': str(filename)}
exec(compile(filename.read_text(encoding='utf-8'), str(filename), 'exec'), namespace)
assert os.name == 'nt', 'These contracts cover the reviewed Windows-only operator helper'
database = 'mu_scale_guard_contract_00000000'
payload = {
 'operation': 'provision_new_fixture',
 'operator': {'host': '127.0.0.1', 'port': '15432', 'user': 'synthetic_operator', 'password': 'synthetic-contract-only', 'dbname': 'postgres'},
 'database': database,
 'passwords': {database+'_runtime': 'A'*43, database+'_migration': 'B'*43},
 'libraryDirectory': 'C:/Program Files/PostgreSQL/16/bin'
}
checks = 0
factory_calls = 0
class ConnectionTripwire(Exception): pass
def stopped_factory(*args):
 global factory_calls
 factory_calls += 1
 raise ConnectionTripwire()
namespace['Postgres'] = stopped_factory
def invoke(candidate):
 sys.stdin = io.StringIO(json.dumps(candidate))
 namespace['main']()
def reject(change, expected):
 global checks
 candidate = copy.deepcopy(payload)
 change(candidate)
 before = factory_calls
 try: invoke(candidate)
 except namespace['BoundaryFailure'] as error: assert error.stage == expected
 else: raise AssertionError('Invalid input reached success')
 assert factory_calls == before
 checks += 1
reject(lambda p: p['operator'].update(hostaddr='203.0.113.123'), 'operator_parameter_allowlist')
reject(lambda p: p['operator'].update(service='unapproved-service'), 'operator_parameter_allowlist')
reject(lambda p: p['operator'].update(options='unapproved-options'), 'operator_parameter_allowlist')
reject(lambda p: p['operator'].update(port=15432), 'operator_parameter_allowlist')
reject(lambda p: p['operator'].update(password='synthetic'+chr(0)+'truncated'), 'operator_parameter_allowlist')
reject(lambda p: p['operator'].update(host='203.0.113.123'), 'loopback_operator_guard')
reject(lambda p: p['operator'].update(dbname='owner_database'), 'loopback_operator_guard')
reject(lambda p: p['operator'].update(port='65536'), 'loopback_operator_guard')
reject(lambda p: p['operator'].update(port='0'), 'loopback_operator_guard')
reject(lambda p: p.update(libraryDirectory='unreviewed-library-directory'), 'installed_library_guard')
reject(lambda p: p.update(database='owner_database'), 'database_name_guard')
reject(lambda p: p['passwords'].update({database+'_runtime': 'short'}), 'generated_password_guard')
reject(lambda p: p.update(operation='modify_existing_database'), 'operation_guard')
try: invoke(copy.deepcopy(payload))
except ConnectionTripwire: pass
else: raise AssertionError('Valid guard control did not reach stopped factory')
assert factory_calls == 1
checks += 1
# Execute the actual version/freshness guard with a response-only stand-in.
# No native libpq call or server connection is involved in these pure cases.
class ResponseOnlyPostgres:
 version = '160013'
 superuser = 'true'
 database = 'postgres'
 queries = []
 def __init__(self, *args): pass
 def query(self, statement, stage, parameters=None):
  self.queries.append((statement, stage))
  if stage == 'operator_guard': return [[self.database, self.superuser, self.version]]
  if stage == 'fresh_database_guard': return 1
  raise AssertionError('Provisioning statement reached pure guard contract')
 def close(self): pass
namespace['Postgres'] = ResponseOnlyPostgres
for version, superuser, expected in [('160013','true','reviewed_patched_fixture_server_required'), ('170001','true','reviewed_patched_fixture_server_required'), ('160015','false','operator_superuser_required'), ('160015','true','refuse_existing_database_or_roles')]:
 ResponseOnlyPostgres.version = version
 ResponseOnlyPostgres.superuser = superuser
 ResponseOnlyPostgres.queries = []
 try: invoke(copy.deepcopy(payload))
 except namespace['BoundaryFailure'] as error: assert error.stage == expected
 else: raise AssertionError('Guard returned success')
 assert all(stage in ('operator_guard','fresh_database_guard') for statement, stage in ResponseOnlyPostgres.queries)
 assert not any(statement.startswith(('CREATE','ALTER','GRANT','REVOKE','BEGIN')) for statement, stage in ResponseOnlyPostgres.queries)
 checks += 1
print(json.dumps({'status':'passed','checks':checks,'actualDatabaseConnections':0,'provisionStatements':0}))
`;
  const result = await capture("python", ["-B", "-c", source]);
  assert.equal(result.code, 0, "Python private-stdin source guard contracts must pass.");
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report, { status: "passed", checks: 18, actualDatabaseConnections: 0, provisionStatements: 0 });
  checks += report.checks;
}

async function main() {
  check("complete loopback operator is accepted", () => {
    const value = operatorParameters({ host: "127.0.0.1", port: 15432, user: "synthetic_operator", password: "synthetic-contract-only", dbname: "postgres", hostaddr: "203.0.113.123" });
    assert.deepEqual(Object.keys(value).sort(), ["dbname", "host", "password", "port", "user"]);
  });
  for (const candidate of [{ host: "203.0.113.123", port: 15432, user: "synthetic", password: "synthetic" }, { host: "127.0.0.1", port: 65536, user: "synthetic", password: "synthetic" }, { host: "127.0.0.1", port: 15432, user: "", password: "synthetic" }]) {
    check("invalid operator parameters are rejected", () => assert.throws(() => operatorParameters(candidate)));
  }
  check("valid isolated configuration is accepted", () => assert.equal(fixtureConfig(structuredClone(baseline)).database, database));
  rejectedConfig("owner database name rejected", (c) => { c.database = "owner_database"; });
  rejectedConfig("different migration database rejected", (c) => { c.migrationDatabaseUrl = c.migrationDatabaseUrl.replace(database, "mu_scale_other_contract_0000"); });
  rejectedConfig("runtime role mismatch rejected", (c) => { c.runtimeDatabaseUrl = c.runtimeDatabaseUrl.replace("_runtime:", "_migration:"); });
  rejectedConfig("migration role mismatch rejected", (c) => { c.migrationDatabaseUrl = c.migrationDatabaseUrl.replace("_migration:", "_runtime:"); });
  rejectedConfig("nonloopback runtime rejected", (c) => { c.runtimeDatabaseUrl = c.runtimeDatabaseUrl.replace("127.0.0.1", "203.0.113.123"); });
  rejectedConfig("different direct hosts rejected", (c) => { c.migrationDatabaseUrl = c.migrationDatabaseUrl.replace("127.0.0.1", "localhost"); });
  rejectedConfig("different direct ports rejected", (c) => { c.migrationDatabaseUrl = c.migrationDatabaseUrl.replace(":15432", ":16432"); });
  rejectedConfig("production mode rejected", (c) => { c.runtimeEnvironment.NODE_ENV = "production"; });
  rejectedConfig("runtime environment DB mismatch rejected", (c) => { c.runtimeEnvironment.DATABASE_URL = c.migrationDatabaseUrl; });
  rejectedConfig("upload root outside owned fixture rejected", (c) => { c.runtimeEnvironment.UPLOADS_ROOT = path.join(root, "backend/uploads"); });
  rejectedConfig("external recovery mail host rejected", (c) => { c.runtimeEnvironment.SMTP_HOST = "mail.example.invalid"; });
  rejectedConfig("wrong provenance rejected", (c) => { c.purpose = "owner_database"; });
  await asyncCheck("owner config path rejected before reading contents", () => assert.rejects(privateConfigurationFile("backend/.env"), /ignored scalability cache/));
  await asyncCheck("outside-cache public config path rejected", () => assert.rejects(privateConfigurationFile("package.json"), /ignored scalability cache/));
  await asyncCheck("missing operator CLI rejected", async () => {
    const result = await capture(process.execPath, ["scripts/scalability/provision-local-database.mjs", "--confirm-isolated-fixture"]);
    assert.equal(result.code, 1); assert.match(result.stderr, /^Usage:/); assert.equal(result.stdout, "");
  });
  await asyncCheck("missing verifier config CLI rejected", async () => {
    const result = await capture(process.execPath, ["scripts/scalability/verify-local-database.mjs"]);
    assert.equal(result.code, 1); assert.match(result.stderr, /^Usage:/); assert.equal(result.stdout, "");
  });
  await asyncCheck("owner verifier config CLI rejected", async () => {
    const result = await capture(process.execPath, ["scripts/scalability/verify-local-database.mjs", "--config", "backend/.env"]);
    assert.equal(result.code, 1); assert.equal(JSON.parse(result.stderr).status, "failed"); assert.equal(result.stdout, "");
  });
  await dispatchContracts();
  currentCase = "independent Python input and version guards";
  await pythonContracts();
  await provisioningOrder();
  console.log(JSON.stringify({ status: "passed", checks, actualDatabaseConnections: 0, provisionStatements: 0, applicationProcessesSpawned: 0, privateFileContentsRead: 0, scope: "pure input and dispatcher contracts; real DB/browser integration is a separate gate" }, null, 2));
}

main().catch(() => { console.error(JSON.stringify({ status: "failed", checksPassed: checks, case: currentCase, details: "Private subprocess/assertion diagnostics suppressed" })); process.exitCode = 1; });
