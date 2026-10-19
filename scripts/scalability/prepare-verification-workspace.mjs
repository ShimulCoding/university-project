import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { privateConfigurationFile } from "./provision-local-database.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const approvedDrafts = ["scripts/scalability/prepare-verification-workspace.mjs", "scripts/scalability/verify-verification-workspace.mjs", "scripts/scalability/verification-workspace-boundary.mjs", "scripts/scalability/verification-workspace-bootstrap.mjs", "scripts/scalability/build-verification-workspace.mjs", "scripts/scalability/verify-workspace-backend-suites.mjs", "docs/scalability/prisma-verifier-isolation-review.md"];
const samePath = (left, right) => process.platform === "win32" ? left.toLowerCase() === right.toLowerCase() : left === right;
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function containedPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  assert(relative && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative), "Workspace path must remain beneath its explicit parent");
  return relative;
}

export function publicPathPolicy(relative, dependency = false) {
  assert(typeof relative === "string" && relative.length > 0 && !/[\\\x00-\x1f:]/.test(relative) && !relative.startsWith("/") && relative.split("/").every((part) => part && part !== "." && part !== ".."), "Only normalized public relative paths are accepted");
  const parts = relative.split("/");
  if (parts.some((part) => /^\.env(?:\.|$)/i.test(part) || /^(?:\.npmrc|\.yarnrc(?:\.yml)?|\.pnp\..*)$/i.test(part))) return false;
  if (parts.some((part) => [".git", ".cache", ".next", ".bin", "uploads"].includes(part))) return false;
  if (!dependency && parts.some((part) => ["node_modules", "dist", "build", "coverage"].includes(part))) return false;
  return true;
}

export function safeOsEnvironment() {
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => ["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "PATHEXT", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA"].includes(key.toUpperCase())));
}

function capture(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: safeOsEnvironment(), windowsHide: true, stdio: ["ignore", "pipe", "pipe"], ...options });
    let output = "", bytes = 0;
    child.stdout.on("data", (chunk) => { bytes += chunk.length; if (bytes > 8 * 1024 * 1024) child.kill(); else output += chunk; });
    child.stderr.resume();
    child.on("error", () => reject(new Error("Workspace helper could not start")));
    const timer = setTimeout(() => child.kill(), 60_000);
    child.on("close", (code) => { clearTimeout(timer); if (code !== 0 || bytes > 8 * 1024 * 1024) reject(new Error("Workspace helper failed; diagnostics suppressed")); else resolve(output); });
  });
}

export async function privateDirectory(directory) {
  assert.equal(process.platform, "win32", "This preparation requires the reviewed Windows ACL boundary");
  const literal = `'${directory.replaceAll("'", "''")}'`;
  const script = `$taskDir=${literal}; $taskSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $taskAcl=New-Object System.Security.AccessControl.DirectorySecurity; $taskAcl.SetAccessRuleProtection($true,$false); $taskAcl.SetOwner($taskSid); $taskAcl.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($taskSid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))); Set-Acl -LiteralPath $taskDir -AclObject $taskAcl -ErrorAction Stop; $taskCheck=Get-Acl -LiteralPath $taskDir; if($taskCheck.Access.Count -ne 1 -or $taskCheck.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $taskSid.Value -or $taskCheck.Access[0].AccessControlType -ne 'Allow'){throw 'Private workspace ACL failed'}`;
  await capture("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script]);
}

export async function inspectRegularFile(parent, relative) {
  const file = path.join(parent, relative);
  containedPath(parent, file);
  const info = await lstat(file);
  assert(info.isFile() && !info.isSymbolicLink(), "Public inputs must be regular files");
  assert(samePath(await realpath(file), path.resolve(file)), "Public inputs cannot traverse links or reparse paths");
  assert(info.size <= 256 * 1024 * 1024, "Public input exceeds the bounded per-file copy size");
  return { path: relative.replaceAll(path.sep, "/"), bytes: info.size, mtime: info.mtimeMs };
}

export async function dependencyPlan(dependencyRoot, sourceRoot = path.dirname(dependencyRoot)) {
  assert(samePath(await realpath(dependencyRoot), path.resolve(dependencyRoot)), "Installed dependency root cannot redirect");
  const files = [], skipped = [];
  async function walk(relative = "") {
    const directory = path.join(dependencyRoot, relative);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const item = [relative, entry.name].filter(Boolean).join("/");
      if (!publicPathPolicy(item, true)) { skipped.push({ path: item, reason: "excluded private/configuration/generated path" }); continue; }
      const location = path.join(dependencyRoot, item), info = await lstat(location);
      if (info.isSymbolicLink()) {
        assert(["backend", "frontend"].includes(item) && samePath(await realpath(location), path.join(sourceRoot, item)), "Unexpected installed dependency link; no target contents were read");
        skipped.push({ path: item, reason: "workspace junction omitted; public workspace source is copied separately" });
      } else if (info.isDirectory()) {
        assert(samePath(await realpath(location), path.resolve(location)), "Dependency directories cannot traverse reparse paths");
        await walk(item);
      } else {
        files.push(await inspectRegularFile(dependencyRoot, item));
        assert(files.length <= 100_000, "Installed graph exceeds bounded file count");
      }
    }
  }
  await walk();
  assert(files.reduce((sum, file) => sum + file.bytes, 0) <= 2 * 1024 ** 3, "Installed graph exceeds bounded copy bytes");
  return { files, skipped };
}

async function copyChecked(parent, destinationRoot, descriptor) {
  const source = path.join(parent, descriptor.path), destination = path.join(destinationRoot, descriptor.path);
  containedPath(destinationRoot, destination);
  const before = await inspectRegularFile(parent, descriptor.path);
  assert.equal(before.bytes, descriptor.bytes); assert.equal(before.mtime, descriptor.mtime, "Input changed after preflight");
  const input = await open(source, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let bytes;
  try {
    assert((await input.stat()).isFile());
    assert(samePath(await realpath(source), path.resolve(source)), "Input redirected before read");
    bytes = await input.readFile();
  } finally { await input.close(); }
  assert.equal(bytes.length, descriptor.bytes);
  const after = await inspectRegularFile(parent, descriptor.path);
  assert.equal(after.mtime, descriptor.mtime, "Input changed during copy");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes, { flag: "wx", mode: 0o600 });
  const hash = sha(bytes); assert.equal(sha(await readFile(destination)), hash, "Copied public bytes differ");
  return { path: descriptor.path, bytes: bytes.length, sha256: hash };
}

async function copyPlan(parent, destination, descriptors) {
  const copied = new Array(descriptors.length); let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < descriptors.length) { const index = cursor++; copied[index] = await copyChecked(parent, destination, descriptors[index]); }
  }));
  return copied;
}

export function pairedFixture(value, sourceRoot, destinationRoot) {
  assert(value?.schemaVersion === 1 && value.purpose === "isolated_fake_scalability" && /^mu_scale_[a-f0-9]{32}$/.test(value.database), "Only an explicitly selected owned fake fixture is accepted");
  assert(value.connectionMode === undefined || value.connectionMode === "direct", "This verification snapshot currently supports direct fixtures only");
  assert.equal(value.pooler, undefined);
  const runtime = new URL(value.runtimeDatabaseUrl), migration = new URL(value.migrationDatabaseUrl);
  for (const [url, suffix] of [[runtime, "runtime"], [migration, "migration"]]) {
    assert.equal(url.protocol, "postgresql:"); assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "15432");
    assert.equal(url.pathname, `/${value.database}`); assert.equal(decodeURIComponent(url.username), `${value.database}_${suffix}`); assert(url.password);
    assert.equal(url.hash, "");
    const keys = new Set();
    for (const [key, setting] of url.searchParams) {
      assert(!keys.has(key)); keys.add(key);
      assert((key === "schema" && setting === "public") || (["connection_limit", "pool_timeout", "connect_timeout"].includes(key) && /^[1-9][0-9]?$/.test(setting)), "Fixture URL options must remain reviewed connection bounds");
    }
  }
  assert.equal(value.runtimeRole, `${value.database}_runtime`); assert.equal(value.migrationRole, `${value.database}_migration`);
  assert.equal(value.runtimeEnvironment?.DATABASE_URL, value.runtimeDatabaseUrl); assert.equal(value.runtimeEnvironment?.NODE_ENV, "test");
  assert.equal(value.runtimeEnvironment?.SMTP_HOST, "127.0.0.1");
  assert.equal(path.resolve(value.runtimeEnvironment?.UPLOADS_ROOT ?? ""), path.join(sourceRoot, ".cache/scalability", value.database, "uploads"));
  return { ...value, runtimeEnvironment: { ...value.runtimeEnvironment, UPLOADS_ROOT: path.join(destinationRoot, ".cache/scalability", value.database, "uploads") } };
}

export async function prepareVerificationWorkspace({ fixtureFile, operatorFile } = {}) {
  assert(!operatorFile || fixtureFile, "An operator profile needs the explicitly paired fake fixture");
  const sourceNames = (await capture("git", ["ls-files", "--cached", "-z"])).split("\0").filter(Boolean);
  for (const draft of approvedDrafts) { try { await lstat(path.join(root, draft)); if (!sourceNames.includes(draft)) sourceNames.push(draft); } catch (error) { if (error.code !== "ENOENT") throw error; } }
  const allowed = sourceNames.filter((name) => publicPathPolicy(name));
  const sources = await Promise.all(allowed.map((name) => inspectRegularFile(root, name)));
  const dependencies = await dependencyPlan(path.join(root, "node_modules"), root);
  const cache = path.join(root, ".cache/scalability");
  assert(samePath(await realpath(cache), path.resolve(cache)), "Owned workspace parent cannot redirect");
  const destination = path.join(cache, `verification-workspace-${randomUUID().replaceAll("-", "")}`);
  await mkdir(destination, { recursive: false, mode: 0o700 }); await privateDirectory(destination);
  const sourceManifest = await copyPlan(root, destination, sources);
  const dependencyManifest = await copyPlan(path.join(root, "node_modules"), path.join(destination, "node_modules"), dependencies.files);
  for (const entry of sourceManifest) { assert.equal(sha(await readFile(path.join(root, entry.path))), entry.sha256, "Source changed while snapshot was prepared"); }
  let fixturePath = null, operatorPath = null;
  if (fixtureFile) {
    const selected = await privateConfigurationFile(fixtureFile);
    const config = pairedFixture(JSON.parse(await readFile(selected, "utf8")), root, destination);
    assert.equal(path.basename(path.dirname(selected)), config.database); assert.equal(path.basename(selected), "fixture.json");
    const directory = path.join(destination, ".cache/scalability", config.database);
    await mkdir(directory, { recursive: true });
    fixturePath = path.join(directory, "fixture.json"); await writeFile(fixturePath, JSON.stringify(config, null, 2), { flag: "wx", mode: 0o600 });
    if (operatorFile) {
      const operator = JSON.parse(await readFile(await privateConfigurationFile(operatorFile), "utf8"));
      assert(operator && typeof operator === "object" && operator.host === "127.0.0.1" && String(operator.port) === "15432" && operator.dbname === "postgres" && typeof operator.user === "string" && typeof operator.password === "string", "Only the explicitly selected paired fake operator endpoint is accepted");
      operatorPath = path.join(directory, "operator.json"); await writeFile(operatorPath, JSON.stringify(operator), { flag: "wx", mode: 0o600 });
    }
    // Verify inherited private ACLs using the snapshot's safe source helper.
    const aclCheck = `import {privateConfigurationFile} from ${JSON.stringify(pathToFileURL(path.join(destination, "scripts/scalability/provision-local-database.mjs")).href)}; await privateConfigurationFile(${JSON.stringify(fixturePath)});`;
    await capture(process.execPath, ["--input-type=module", "--eval", aclCheck], { cwd: destination });
  }
  const manifest = { schemaVersion: 1, purpose: "public_source_materialized_dependency_verification", sourceRoot: root, workspace: destination, sourceFiles: sourceManifest, dependencyFiles: dependencyManifest, skippedDependencies: dependencies.skipped, sourceExcluded: sourceNames.length - allowed.length, fixture: fixturePath && path.relative(destination, fixturePath), operator: operatorPath && path.relative(destination, operatorPath), privateSourceEnvironmentFilesCopied: 0, installedDependencyLinksCopied: 0, dependencyInstallPerformed: false, scope: "Byte-checked installed dependency snapshot; no npm install, Prisma generation, owner environment or database operation" };
  await writeFile(path.join(destination, "verification-workspace.json"), JSON.stringify(manifest, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  return { status: "prepared", directory: path.relative(root, destination), sourceFiles: sourceManifest.length, dependencyFiles: dependencyManifest.length, dependencyBytes: dependencyManifest.reduce((sum, file) => sum + file.bytes, 0), dependencyLinksCopied: 0, privateSourceEnvironmentFilesCopied: 0, explicitFakeFixtureCopied: !!fixturePath, sourceManifestSha256: sha(JSON.stringify(sourceManifest)), dependencyManifestSha256: sha(JSON.stringify(dependencyManifest)) };
}

// Refresh only the public source half of a previously prepared, proven snapshot.
// Installed dependency bytes are retained and rechecked by the next full proof.
export async function refreshVerificationWorkspace(workspaceValue) {
  const destination=path.resolve(root,workspaceValue);
  assert.equal(path.dirname(destination),path.join(root,".cache/scalability"));
  assert(/^verification-workspace-[a-f0-9]{32}$/.test(path.basename(destination)));
  assert(samePath(await realpath(destination),destination));
  const manifestPath=path.join(destination,"verification-workspace.json"), manifest=JSON.parse(await readFile(manifestPath,"utf8"));
  assert.equal(manifest.workspace,destination); assert.equal(manifest.sourceRoot,root);
  const sourceNames=(await capture("git",["ls-files","--cached","-z"])).split("\0").filter(Boolean);
  for(const draft of approvedDrafts)if(!sourceNames.includes(draft))sourceNames.push(draft);
  const sourceManifest=[];
  for(const name of sourceNames.filter(name=>publicPathPolicy(name))) {
    const descriptor=await inspectRegularFile(root,name),bytes=await readFile(path.join(root,name));
    const target=path.join(destination,name); containedPath(destination,target);
    await mkdir(path.dirname(target),{recursive:true});
    try {await inspectRegularFile(destination,name);}catch(error){if(error.code!=="ENOENT")throw error;}
    await writeFile(target,bytes,{mode:0o600});
    assert.equal(sha(await readFile(target)),sha(bytes));
    assert.equal((await inspectRegularFile(root,name)).mtime,descriptor.mtime,"Public source changed during refresh");
    sourceManifest.push({path:name,bytes:bytes.length,sha256:sha(bytes)});
  }
  manifest.sourceFiles=sourceManifest;
  // Changing the manifest invalidates the previous proof by its exact byte hash.
  await writeFile(manifestPath,JSON.stringify(manifest,null,2)+"\n",{mode:0o600});
  return {status:"refreshed_public_sources",sourceFiles:sourceManifest.length,dependencyFilesRetained:manifest.dependencyFiles.length,dependencyBytesRecopied:0,nextRequiredAction:"Full hashes, constructor tripwires and proof marker"};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 0 && !(args.length === 2 && args[0] === "--fixture")) { console.error(JSON.stringify({ status: "failed", details: "Use no arguments or one explicit --fixture approved-private-fixture.json; no owner target fallback" })); process.exitCode = 1; }
  else prepareVerificationWorkspace({ fixtureFile: args[1] }).then((result) => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error(JSON.stringify({ status: "failed", details: "Workspace preparation failed; private diagnostics suppressed; retain newly created workspace" })); process.exitCode = 1; });
}
