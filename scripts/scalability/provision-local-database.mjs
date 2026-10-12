import { randomBytes, randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const postgresBin = "C:/Program Files/PostgreSQL/16/bin";
let stage = "arguments";

export function operatorParameters(value) {
  const parameters = typeof value === "string" ? (() => {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Invalid operator protocol.");
    return { host: url.hostname.replace(/^\[|\]$/g, ""), port: url.port || "5432", user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), dbname: "postgres" };
  })() : { ...value, dbname: "postgres" };
  if (!["localhost", "127.0.0.1", "::1"].includes(parameters.host) || !/^\d+$/.test(String(parameters.port)) || Number(parameters.port) < 1 || Number(parameters.port) > 65535 || typeof parameters.user !== "string" || !parameters.user || typeof parameters.password !== "string" || !parameters.password) {
    throw new Error("A complete loopback operator configuration is required.");
  }
  return Object.fromEntries(["host", "port", "user", "password", "dbname"].map((key) => [key, String(parameters[key])]));
}

function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"], ...options });
    const output = [];
    let bytes = 0;
    child.stdout.on("data", (part) => { bytes += part.length; if (bytes > 1024 * 1024) child.kill(); else output.push(part); });
    child.stderr.resume(); // Raw child errors can contain credentials. Never forward or retain them.
    child.on("error", () => reject(new Error("Owned helper process could not start.")));
    const timeout = setTimeout(() => child.kill(), 180_000);
    child.on("close", (code) => {
      clearTimeout(timeout);
      const stdout = Buffer.concat(output).toString("utf8");
      if (code !== 0) {
        const failure = new Error("Owned helper process failed.");
        // Python emits a reviewed public protocol, never raw connection errors.
        try {
          const protocol = JSON.parse(stdout);
          if (protocol.status === "failed" && /^[a-z_]{1,80}$/.test(protocol.stage)) failure.helperStage = protocol.stage;
          if (/^[0-9A-Z]{5}$/.test(protocol.sqlState)) failure.sqlState = protocol.sqlState;
        } catch { /* Other child output remains private and discarded. */ }
        reject(failure);
      } else resolve(stdout);
    });
    child.stdin.on("error", () => {});
    child.stdin.end(options.input ?? "");
  });
}

async function ownerOnly(directory) {
  if (process.platform !== "win32") throw new Error("This operator provisioner requires the reviewed Windows PostgreSQL installation.");
  const literal = `'${directory.replaceAll("'", "''")}'`;
  const script = `$taskDir = ${literal}; $taskSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User; $taskAcl = New-Object System.Security.AccessControl.DirectorySecurity; $taskAcl.SetAccessRuleProtection($true,$false); $taskAcl.SetOwner($taskSid); $taskRule = New-Object System.Security.AccessControl.FileSystemAccessRule($taskSid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'); $taskAcl.AddAccessRule($taskRule); Set-Acl -LiteralPath $taskDir -AclObject $taskAcl -ErrorAction Stop; $taskCheck = Get-Acl -LiteralPath $taskDir; if ($taskCheck.Access.Count -ne 1 -or $taskCheck.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $taskSid.Value) { throw 'Private-directory ACL verification failed' }`;
  await capture("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
}

export async function privateConfigurationFile(file) {
  const cacheRoot = path.join(root, ".cache/scalability");
  const candidate = path.resolve(root, file);
  const candidateRelative = path.relative(cacheRoot, candidate);
  if (candidateRelative.startsWith("..") || path.isAbsolute(candidateRelative)) throw new Error("Private operator/fixture configuration must remain under the ignored scalability cache.");
  const resolved = await realpath(candidate);
  const relative = path.relative(cacheRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Private operator/fixture configuration must remain under the ignored scalability cache.");
  if (process.platform !== "win32") throw new Error("This operator helper requires reviewed Windows file ACL verification.");
  const literal = `'${resolved.replaceAll("'", "''")}'`;
  const script = `$taskFile = ${literal}; $taskSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User; $taskAcl = Get-Acl -LiteralPath $taskFile -ErrorAction Stop; if ($taskAcl.Access.Count -ne 1 -or $taskAcl.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $taskSid.Value -or $taskAcl.Access[0].AccessControlType -ne 'Allow') { throw 'Private-file ACL verification failed' }`;
  await capture("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
  return resolved;
}

function databaseUrl(parameters, database, user, password) {
  const host = parameters.host === "::1" ? "[::1]" : parameters.host;
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${parameters.port}/${database}?schema=public&connection_limit=5&pool_timeout=10`;
}

export async function provision(operatorFile) {
  stage = "private_operator_configuration";
  if (!operatorFile) throw new Error("An explicit isolated operator file is required; original credentials are never a fallback.");
  const resolved = await privateConfigurationFile(operatorFile);
  const parameters = operatorParameters(JSON.parse(await readFile(resolved, "utf8")));
  const ownerEnvFile = path.join(root, "backend/.env");
  const ownerEnvBefore = createHash("sha256").update(await readFile(ownerEnvFile)).digest();

  const database = `mu_scale_${randomUUID().replaceAll("-", "")}`;
  const runtimeRole = `${database}_runtime`, migrationRole = `${database}_migration`;
  const passwords = { [runtimeRole]: randomBytes(32).toString("base64url"), [migrationRole]: randomBytes(32).toString("base64url") };
  const directory = path.join(root, ".cache/scalability", database);
  await mkdir(directory, { recursive: false, mode: 0o700 });
  stage = "owner_only_directory";
  await ownerOnly(directory); // Apply and verify ACL before writing any credential.
  const runtimeDatabaseUrl = databaseUrl(parameters, database, runtimeRole, passwords[runtimeRole]);
  const migrationDatabaseUrl = databaseUrl(parameters, database, migrationRole, passwords[migrationRole]);
  const runtimeEnvironment = {
    NODE_ENV: "test", PORT: "4300", FRONTEND_URL: "http://127.0.0.1:3300",
    DATABASE_URL: runtimeDatabaseUrl, ENABLE_LOCAL_ADMIN_BOOTSTRAP: "false", TRUST_PROXY_HOPS: "0",
    JWT_ACCESS_SECRET: randomBytes(48).toString("base64url"), JWT_REFRESH_SECRET: randomBytes(48).toString("base64url"),
    MFA_ENCRYPTION_KEY: randomBytes(32).toString("base64"), BCRYPT_SALT_ROUNDS: "12",
    UPLOADS_ROOT: path.join(directory, "uploads"), SMTP_HOST: "127.0.0.1", SMTP_PORT: "1",
    SMTP_USER: "isolated-fixture", SMTP_PASS: "isolated-fixture-never-a-real-mailbox", SMTP_FROM: "fixture@example.invalid",
  };
  await writeFile(path.join(directory, "fixture.json"), JSON.stringify({ schemaVersion: 1, purpose: "isolated_fake_scalability", database, runtimeRole, migrationRole, runtimeDatabaseUrl, migrationDatabaseUrl, runtimeEnvironment }, null, 2), { flag: "wx", mode: 0o600 });
  stage = "new_database_and_roles";
  const created = JSON.parse(await capture("python", [path.join(root, "scripts/scalability/postgres-local-admin.py")], {
    input: JSON.stringify({ operation: "provision_new_fixture", operator: parameters, database, passwords, libraryDirectory: postgresBin }),
  }));
  if (created.status !== "created" || created.database !== database) throw new Error("Unexpected provisioner response.");
  stage = "isolated_migrations";
  await capture(process.execPath, [path.join(root, "node_modules/prisma/build/index.js"), "migrate", "deploy", "--schema", "backend/prisma/schema.prisma"], {
    env: { ...process.env, DATABASE_URL: migrationDatabaseUrl, NODE_ENV: "test", PRISMA_HIDE_UPDATE_MESSAGE: "true" },
  });
  stage = "isolated_grants";
  const passfile = path.join(directory, "migration.pgpass");
  const escapePass = (value) => value.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
  await writeFile(passfile, [parameters.host, parameters.port, database, migrationRole, passwords[migrationRole]].map(escapePass).join(":") + "\n", { flag: "wx", mode: 0o600 });
  await capture(path.join(postgresBin, "psql.exe"), ["-X", "--no-password", "--host", parameters.host, "--port", parameters.port, "--username", migrationRole, "--dbname", database, "--set", "ON_ERROR_STOP=on", "--set", `database_name=${database}`, "--set", `runtime_role=${runtimeRole}`, "--set", `migration_role=${migrationRole}`, "--file", "infra/postgres/grant-test-runtime.sql"], {
    env: { ...process.env, PGPASSFILE: passfile, PSQL_HISTORY: path.join(directory, "unused_history"), PGCONNECT_TIMEOUT: "5" },
  });
  stage = "runtime_configuration_and_owner_preservation";
  await writeFile(path.join(directory, "runtime.json"), JSON.stringify(runtimeEnvironment, null, 2), { flag: "wx", mode: 0o600 });
  const ownerEnvAfter = createHash("sha256").update(await readFile(ownerEnvFile)).digest();
  if (!ownerEnvBefore.equals(ownerEnvAfter)) throw new Error("Original owner configuration changed during fixture provisioning.");
  return { status: "created_migrated_granted", database, libpqVersion: created.libpqVersion, originalEnvironmentPreserved: true, fixtureConfiguration: path.relative(root, path.join(directory, "fixture.json")), runtimeConfiguration: path.relative(root, path.join(directory, "runtime.json")) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args[0] !== "--confirm-isolated-fixture" || args.length !== 3 || args[1] !== "--operator-config") {
    console.error("Usage: --confirm-isolated-fixture --operator-config ignored-private-file.json"); process.exitCode = 1;
  } else provision(args[2]).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error) => {
    console.error(JSON.stringify({ status: "failed", stage, ...(error.helperStage ? { helperStage: error.helperStage } : {}), ...(error.sqlState ? { sqlState: error.sqlState } : {}), details: "Private diagnostics suppressed; original data/configuration is not a recovery target. Retain any new fixture target for review." })); process.exitCode = 1;
  });
}
