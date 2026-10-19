import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from "node:fs/promises";
import Module, { createRequire, syncBuiltinESMExports } from "node:module";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { containedPath, dependencyPlan, inspectRegularFile, pairedFixture, privateDirectory, publicPathPolicy, safeOsEnvironment } from "./prepare-verification-workspace.mjs";
import { verifyMaterializedFiles, verifyPackageResolutions, verifyNativeInput, registerWorkspaceNativeBoundary, registerWorkspaceResolutionBoundary, workspaceBoundaryStatistics } from "./verification-workspace-boundary.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hash = (value) => createHash("sha256").update(value).digest("hex");
const normalize = (value) => path.resolve(value instanceof URL ? fileURLToPath(value) : String(value)).toLowerCase();

async function contracts() {
  let checks = 0;
  for (const value of [".env", "backend/.env", "frontend/.env.local", "backend/.env.example", ".npmrc", "node_modules/.npmrc", "backend/uploads/.gitkeep", ".cache/private.json", "frontend/.next/server.js", "node_modules/.bin/tsx"]) { assert.equal(publicPathPolicy(value), false); checks++; }
  for (const value of ["../backend/.env", "/absolute", "backend/../.env", "C:/private", "bad\\path", "file\nname"]) { assert.throws(() => publicPathPolicy(value)); checks++; }
  for (const value of ["backend/src/config/env.ts", "package-lock.json", "node_modules/.prisma/client/index.js"]) { assert(publicPathPolicy(value, value.startsWith("node_modules/"))); checks++; }
  assert.throws(() => containedPath(root, path.dirname(root))); checks++;
  assert.throws(() => containedPath(root, root)); checks++;
  const temporary = await mkdtemp(path.join(root, ".cache/scalability/workspace-contract-"));
  await privateDirectory(temporary);
  const graph = path.join(temporary, "node_modules"); await mkdir(graph);
  await writeFile(path.join(graph, "index.js"), "public synthetic package");
  await writeFile(path.join(graph, ".env"), "SYNTHETIC=never-copy"); await writeFile(path.join(graph, ".npmrc"), "synthetic=never-copy");
  const initial = await dependencyPlan(graph, temporary); assert.deepEqual(initial.files.map((file) => file.path), ["index.js"]); assert.equal(initial.skipped.length, 2); checks++;
  const syntheticNative=path.join(graph,"index.js"),nativeBytes=await readFile(syntheticNative);
  const syntheticEntries=new Map([["node_modules/index.js",{bytes:nativeBytes.length,sha256:hash(nativeBytes)}]]);
  assert.equal(verifyNativeInput(temporary,syntheticEntries,path.toNamespacedPath(syntheticNative)),"node_modules/index.js");checks++;
  // Node would find the ancestor repository package when the local package is missing.
  // Resolve only, never import it: the guard must reject that real fallback path.
  await assert.rejects(verifyPackageResolutions(temporary,new Map()), /inside the materialized workspace/); checks++;
  assert.throws(()=>verifyNativeInput(temporary,new Map(),path.join(root,"node_modules/.prisma/client/query_engine-windows.dll.node")),/inside the materialized workspace/);checks++;
  const restoreNative=registerWorkspaceNativeBoundary(temporary,new Map());
  try{assert.throws(()=>process.dlopen({},path.join(root,"node_modules/.prisma/client/query_engine-windows.dll.node")),/inside the materialized workspace/);checks++;}finally{restoreNative();}
  const resolutionHook=registerWorkspaceResolutionBoundary(temporary,new Map());
  const beforeResolution=workspaceBoundaryStatistics().outsideModuleResolutions;
  try{await assert.rejects(import(`data:text/javascript,export default ${JSON.stringify(path.basename(temporary))}`),/builtins or contained/);assert.equal(workspaceBoundaryStatistics().outsideModuleResolutions,beforeResolution+1);checks++;}finally{resolutionHook.deregister();}
  const escape = path.join(temporary, "outside"); await mkdir(escape); await writeFile(path.join(escape, ".env"), "SYNTHETIC=outside");
  await symlink(escape, path.join(graph, "escape"), "junction");
  await assert.rejects(dependencyPlan(graph, temporary), /Unexpected installed dependency link/); checks++;
  await assert.rejects(inspectRegularFile(temporary, "node_modules/escape/.env"), /reparse paths/); checks++;
  const database = "mu_scale_" + "a".repeat(32), original = path.join(temporary, "source"), target = path.join(temporary, "target");
  const runtime = `postgresql://${database}_runtime:synthetic@127.0.0.1:15432/${database}?schema=public&connection_limit=2&pool_timeout=10`;
  const fixture = { schemaVersion: 1, purpose: "isolated_fake_scalability", database, runtimeRole: `${database}_runtime`, migrationRole: `${database}_migration`, runtimeDatabaseUrl: runtime, migrationDatabaseUrl: runtime.replace("_runtime:", "_migration:"), runtimeEnvironment: { DATABASE_URL: runtime, NODE_ENV: "test", SMTP_HOST: "127.0.0.1", UPLOADS_ROOT: path.join(original, ".cache/scalability", database, "uploads") } };
  assert.equal(pairedFixture(fixture, original, target).runtimeEnvironment.UPLOADS_ROOT, path.join(target, ".cache/scalability", database, "uploads")); checks++;
  for (const change of [ { database: "postgres" }, { runtimeDatabaseUrl: runtime.replace("127.0.0.1", "192.0.2.1") }, { runtimeDatabaseUrl: runtime + "&host=/private/socket" }, { runtimeDatabaseUrl: runtime + "&schema=public" }, { migrationRole: fixture.runtimeRole }, { runtimeEnvironment: { ...fixture.runtimeEnvironment, UPLOADS_ROOT: path.join(original, "backend/uploads") } }, { connectionMode: "pgbouncer-transaction" } ]) { assert.throws(() => pairedFixture({ ...fixture, ...change }, original, target)); checks++; }
  checks += await readApiContracts(temporary);
  return checks;
}

async function readApiContracts(workspace) {
  // Exercise the actual registration function with observable synthetic APIs.
  // An omitted API reaches its fake byte reader and fails this contract.
  const source=await readFile(path.join(root,"scripts/scalability/verification-workspace-boundary.mjs"),"utf8");
  const start=source.indexOf("function registerWorkspaceReadBoundary("),end=source.indexOf("\nexport async function verifyMaterializedFiles",start);
  assert(start>=0&&end>start);
  const names=["readFileSync","openSync","readFile","open","openAsBlob","copyFileSync","copyFile","cpSync","cp"],promiseNames=["readFile","open","copyFile","cp"];
  let byteReadersCalled=0,synchronizations=0,metadataCalls=0,exit;
  const redirected=new Map(),missing=new Set(),directories=new Map(),hardlinked=new Set();
  const reader=filename=>{byteReadersCalled++;if(missing.has(filename))throw Object.assign(new Error("Synthetic missing leaf"),{code:"ENOENT"});return "synthetic bytes";};
  const filesystem=Object.fromEntries(names.map(name=>[name,reader]));filesystem.promises=Object.fromEntries(promiseNames.map(name=>[name,reader]));
  filesystem.realpathSync=filename=>{metadataCalls++;if(missing.has(filename))throw Object.assign(new Error("Synthetic missing leaf"),{code:"ENOENT"});return redirected.get(filename)??filename;};
  filesystem.lstatSync=filename=>({isSymbolicLink:()=>false,isDirectory:()=>directories.has(filename),isFile:()=>!directories.has(filename),nlink:hardlinked.has(filename)?2:1});
  filesystem.readdirSync=filename=>directories.get(filename)??[];
  const statistics={materializedWorkspaceBoundary:true,outsideSourceReadAttempts:0,outsideModuleResolutions:0,outsideNativeLoadAttempts:0,nativeModules:[]};
  let written="";
  const taskProcess={stdout:{write:value=>{written+=value;}},once:(_event,handler)=>{exit=handler;},exitCode:0};
  const context=vm.createContext({fs:filesystem,path,statistics,process:taskProcess,same:(a,b)=>process.platform==="win32"?a.toLowerCase()===b.toLowerCase():a===b,inputPath:value=>path.resolve(String(value)),syncBuiltinESMExports:()=>{synchronizations++;},registerWorkspaceNativeBoundary:()=>{}});
  vm.runInContext(source.slice(start,end)+"\nregisterWorkspaceReadBoundary",context)(workspace,root,new Map());
  let checks=0;
  for(const [object,list] of [[filesystem,names],[filesystem.promises,promiseNames]])for(const name of list){assert.throws(()=>object[name](path.join(root,"AGENTS.md")),{code:"EACCES"});checks++;}
  assert.equal(byteReadersCalled,0);checks++;
  assert.equal(metadataCalls,0);checks++;
  assert.equal(statistics.outsideSourceReadAttempts,names.length+promiseNames.length);checks++;
  for(const [object,list] of [[filesystem,names],[filesystem.promises,promiseNames]])for(const name of list)object[name](path.join(workspace,"synthetic-public"));
  assert.equal(byteReadersCalled,names.length+promiseNames.length);checks++;
  assert.equal(synchronizations,1);checks++;
  const alias=path.join(workspace,"redirected","synthetic-public"),outside=path.join(root,"synthetic-outside");redirected.set(alias,outside);
  const beforeAliasReaders=byteReadersCalled;
  for(const [object,list] of [[filesystem,names],[filesystem.promises,promiseNames]])for(const name of list){assert.throws(()=>object[name](alias),{code:"EACCES"});checks++;}
  assert.equal(byteReadersCalled,beforeAliasReaders);checks++;
  redirected.set(alias,path.join(workspace,"other-public"));assert.throws(()=>filesystem.readFileSync(alias),{code:"EACCES"});checks++;
  const externalAlias=path.join(path.dirname(root),"synthetic-external-alias");redirected.set(externalAlias,path.join(root,"AGENTS.md"));
  const beforeExternalReaders=byteReadersCalled;assert.throws(()=>filesystem.readFileSync(externalAlias),{code:"EACCES"});assert.equal(byteReadersCalled,beforeExternalReaders);checks++;
  filesystem.readFileSync(path.join(path.dirname(root),"synthetic-ordinary-external"));assert.equal(byteReadersCalled,beforeExternalReaders+1);checks++;
  const hardlink=path.join(workspace,"synthetic-hardlink");hardlinked.add(hardlink);
  for(const [object,list] of [[filesystem,names],[filesystem.promises,promiseNames]])for(const name of list){const beforeReaders=byteReadersCalled;assert.throws(()=>object[name](hardlink),{code:"EACCES"});assert.equal(byteReadersCalled,beforeReaders);checks++;}
  const externalHardlink=path.join(path.dirname(root),"synthetic-external-hardlink");hardlinked.add(externalHardlink);const beforeExternalHardlink=byteReadersCalled;filesystem.readFileSync(externalHardlink);assert.equal(byteReadersCalled,beforeExternalHardlink+1);checks++;
  const missingLeaf=path.join(workspace,"new",".env");missing.add(missingLeaf);missing.add(path.dirname(missingLeaf));
  const beforeMissing=statistics.outsideSourceReadAttempts;assert.throws(()=>filesystem.readFileSync(missingLeaf),{code:"ENOENT"});assert.equal(statistics.outsideSourceReadAttempts,beforeMissing);checks++;
  const tree=path.join(workspace,"tree"),nestedAlias=path.join(tree,"nested");directories.set(tree,["nested"]);redirected.set(nestedAlias,outside);
  for(const object of [filesystem,filesystem.promises])for(const name of object===filesystem?["cpSync","cp"]:["cp"]){const beforeReaders=byteReadersCalled;assert.throws(()=>object[name](tree,path.join(workspace,"copy"),{recursive:true,dereference:true}),{code:"EACCES"});assert.equal(byteReadersCalled,beforeReaders);checks++;}
  const externalTree=path.join(path.dirname(root),"synthetic-external-tree");directories.set(externalTree,["nested"]);redirected.set(path.join(externalTree,"nested"),outside);
  for(const object of [filesystem,filesystem.promises])for(const name of object===filesystem?["cpSync","cp"]:["cp"]){const beforeReaders=byteReadersCalled;assert.throws(()=>object[name](externalTree,path.join(workspace,"copy"),{recursive:true,dereference:true}),{code:"EACCES"});assert.equal(byteReadersCalled,beforeReaders);checks++;}
  exit();assert.equal(taskProcess.exitCode,1);assert.equal(JSON.parse(written).outsideSourceReadAttempts,statistics.outsideSourceReadAttempts);checks++;
  return checks;
}

async function moduleBoundaryContracts() {
  let privateReadAttempts=0,ormImports=0,networkAttempts=0,checks=0;
  const restorations=[];
  const guard=value=>{
    if(typeof value==="number")return;
    let filename;try{filename=normalize(value);}catch{return;}
    if(/^\.env(?:\.|$)/i.test(path.basename(filename))){privateReadAttempts++;throw Object.assign(new Error("Private environment read blocked before bytes"),{code:"EACCES"});}
  };
  for(const object of [fs,fs.promises])for(const name of object===fs?["readFileSync","openSync","readFile","open","openAsBlob","copyFileSync","copyFile","cpSync","cp"]:["readFile","open","copyFile","cp"]){
    const prior=object[name];restorations.push(()=>object[name]=prior);
    object[name]=function(value,...args){guard(value);return prior.call(this,value,...args);};
  }
  const load=Module._load;restorations.push(()=>Module._load=load);
  Module._load=function(request,...args){if(/(?:@prisma[\\/]client|\.prisma[\\/]client)/.test(request)){ormImports++;throw new Error("Pure module imported an ORM");}return load.call(this,request,...args);};
  const connect=net.Socket.prototype.connect;restorations.push(()=>net.Socket.prototype.connect=connect);
  net.Socket.prototype.connect=function(){networkAttempts++;throw new Error("Pure module opened a socket");};
  syncBuiltinESMExports();
  try {
    const database=await import("./verify-local-database.mjs"),prepare=await import("./prepare-local-pooler.mjs"),pooler=await import("./verify-local-pooler.mjs"),cutover=await import("./verify-cutover-grants-local.mjs"),build=await import("./build-verification-workspace.mjs"),suites=await import("./verify-workspace-backend-suites.mjs");checks+=6;
    for(const action of [()=>database.verify(undefined),()=>database.runScript(undefined,"verify:flows"),()=>prepare.prepare(undefined,undefined,undefined),()=>pooler.verify(undefined),()=>cutover.verifyLocal(undefined),()=>build.buildVerificationWorkspace(),()=>suites.verifyBackendSuites(undefined)]) {
      await assert.rejects(action,/ORM verification requires an explicitly prepared and proven private materialized workspace/);checks++;
    }
    assert.equal(privateReadAttempts,0);assert.equal(ormImports,0);assert.equal(networkAttempts,0);checks+=3;
    return {status:"passed",checks,privateReadAttempts,privateOwnerBytesRead:0,ormImports,networkAttempts,scope:"Actual pure module imports and original-root ORM actions refuse before ORM import"};
  } finally {for(const restore of restorations.reverse())restore();syncBuiltinESMExports();}
}

function constructorProbe(workspace, ownerRoot, mode) {
  assert(["original-deny", "snapshot-normal", "snapshot-canary"].includes(mode));
  assert.equal(ownerRoot, root);
  assert.equal(path.dirname(workspace), path.join(root, ".cache/scalability"));
  assert(/^verification-workspace-[a-f0-9]{32}$/.test(path.basename(workspace)));
  const attempts = [], existenceChecks = [];
  const original = { readFileSync: fs.readFileSync, openSync: fs.openSync, readFile: fs.readFile, open: fs.open, existsSync: fs.existsSync };
  let phase = "client_import", networkAttempts = 0;
  const environmentLocation = (candidate) => {
    if (typeof candidate === "number") return null;
    let normalized; try { normalized = normalize(candidate); } catch { return null; }
    if (!/^\.env(?:\.|$)/i.test(path.basename(normalized))) return null;
    const inside = normalized.startsWith(normalize(workspace) + path.sep);
    return { inside, owner: normalized === normalize(path.join(ownerRoot, "backend/.env")) || normalized === normalize(path.join(ownerRoot, ".env")), virtual: normalized === normalize(path.join(workspace, "backend/.env")) };
  };
  const blocked = () => { const failure = new Error("Blocked environment input before bytes"); failure.code = "EACCES"; return failure; };
  for (const name of ["readFileSync", "openSync", "readFile", "open"]) {
    fs[name] = function (candidate, ...args) {
      const location = environmentLocation(candidate);
      if (location) {
        attempts.push({ api: name, phase, snapshot: location.inside, owner: location.owner, syntheticOnly: mode === "snapshot-canary" && location.virtual });
        if (mode === "snapshot-canary" && location.virtual && name === "readFileSync") {
          const canary = "PRISMA_VERIFICATION_CANARY=synthetic-in-memory-only\n";
          return args[0] === "utf8" ? canary : Buffer.from(canary);
        }
        throw blocked();
      }
      return original[name].call(this, candidate, ...args);
    };
  }
  for (const name of ["readFile", "open"]) {
    const prior = fs.promises[name];
    fs.promises[name] = async function (candidate, ...args) {
      const location = environmentLocation(candidate);
      if (location) { attempts.push({ api: `promises.${name}`, phase, snapshot: location.inside, owner: location.owner, syntheticOnly: false }); throw blocked(); }
      return prior.call(this, candidate, ...args);
    };
  }
  fs.existsSync = function (candidate) {
    const location = environmentLocation(candidate);
    if (location) {
      existenceChecks.push({ phase, snapshot: location.inside, owner: location.owner });
      if (mode === "original-deny" && location.owner) return true; // Virtual existence; never inspect owner bytes or metadata.
      if (mode === "snapshot-canary" && location.virtual) return true;
      if (!location.inside) return false;
    }
    return original.existsSync(candidate);
  };
  syncBuiltinESMExports();
  net.Socket.prototype.connect = function () { networkAttempts++; throw new Error("Constructor-only verification forbids networking"); };
  const require = createRequire(import.meta.url);
  const clientRoot = mode === "original-deny" ? ownerRoot : workspace;
  const { PrismaClient, Prisma } = require(path.join(clientRoot, "node_modules/@prisma/client"));
  phase = "constructor";
  new PrismaClient({ datasources: { db: { url: "postgresql://synthetic:synthetic@127.0.0.1:1/synthetic_owned_fake?schema=public" } }, log: [] });
  return { mode, clientVersion: Prisma.prismaVersion.client, constructed: true, attempts, existenceChecks, privateEnvironmentBytesRead: 0, outsideSnapshotReadAttempts: attempts.filter((entry) => !entry.snapshot).length, ownerReadAttempts: attempts.filter((entry) => entry.owner).length, syntheticCanaryImported: process.env.PRISMA_VERIFICATION_CANARY === "synthetic-in-memory-only", networkAttempts, connectCalled: false };
}

async function probe(workspace, mode, directory) {
  return new Promise((resolve, reject) => {
    const cwd = path.join(directory, mode);
    mkdir(cwd).then(() => {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--probe", workspace, root, mode], { cwd, env: { ...safeOsEnvironment(), NODE_ENV: "test" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
      let output = ""; child.stdout.on("data", (chunk) => { if (output.length < 65536) output += chunk; else child.kill(); }); child.stderr.resume();
      child.on("error", () => reject(new Error("Prisma probe child could not start")));
      const timer = setTimeout(() => child.kill(), 15_000);
      child.on("close", (code) => { clearTimeout(timer); if (code !== 0) reject(new Error("Prisma probe child failed; private diagnostics suppressed")); else { try { resolve(JSON.parse(output)); } catch { reject(new Error("Prisma probe protocol failed")); } } });
    }).catch(reject);
  });
}

export async function verifyVerificationWorkspace(workspaceValue) {
  const workspace = path.resolve(root, workspaceValue);
  assert(/^verification-workspace-[a-f0-9]{32}$/.test(path.basename(workspace)));
  assert.equal(path.dirname(workspace), path.join(root, ".cache/scalability")); assert.equal(await realpath(workspace), workspace);
  const manifestBytes = await readFile(path.join(workspace, "verification-workspace.json"));
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.workspace, workspace); assert.equal(manifest.sourceRoot, root);
  assert.equal(manifest.purpose, "public_source_materialized_dependency_verification");
  let checks = await contracts();
  await verifyMaterializedFiles(workspace, manifest); checks+=2;
  for (const candidate of [".env", "backend/.env", "frontend/.env", ".npmrc", "backend/.npmrc", "frontend/.npmrc"]) {
    await assert.rejects(lstat(path.join(workspace, candidate)), { code: "ENOENT" }); checks++;
  }
  // verifyMaterializedFiles already compared the complete ordinary dependency tree.
  checks++;
  await mkdir(path.join(workspace, ".cache"), { recursive: true });
  const directory = await mkdtemp(path.join(workspace, ".cache", "prisma-proof-"));
  const results = [];
  for (const mode of ["original-deny", "snapshot-normal", "snapshot-canary"]) {
    const result = await probe(workspace, mode, directory);
    assert.equal(result.clientVersion, "6.19.3"); assert.equal(result.constructed, true); assert.equal(result.privateEnvironmentBytesRead, 0); assert.equal(result.networkAttempts, 0);
    if (mode === "original-deny") { assert.equal(result.ownerReadAttempts, 2); assert.equal(result.outsideSnapshotReadAttempts, 2); assert.equal(result.syntheticCanaryImported, false); }
    else {
      assert.equal(result.ownerReadAttempts, 0); assert.equal(result.outsideSnapshotReadAttempts, 0);
      assert(result.existenceChecks.length >= 2 && result.existenceChecks.every((entry) => entry.snapshot));
      assert.equal(result.syntheticCanaryImported, mode === "snapshot-canary");
      assert.equal(result.attempts.length, mode === "snapshot-canary" ? 2 : 0);
    }
    results.push(result); checks++;
  }
  const report = { status: "passed", checks, sourceFiles: manifest.sourceFiles.length, dependencyFiles: manifest.dependencyFiles.length, actualDatabaseConnections: 0, prismaGenerateCommands: 0, privateOwnerBytesRead: 0, constructorProof: results, scope: "Actual pinned Prisma import/constructor with private-read tripwire, snapshot-relative dotenv paths and synthetic in-memory control; no database or full suite proof" };
  await writeFile(path.join(directory, "report.json"), JSON.stringify(report, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  await writeFile(path.join(workspace,"verification-workspace-proof.json"),JSON.stringify({status:"passed",manifestSha256:hash(manifestBytes),privateOwnerBytesRead:0,actualDatabaseConnections:0,evidence:path.relative(workspace,path.join(directory,"report.json"))})+"\n",{mode:0o600});
  return { ...report, evidence: path.relative(root, path.join(directory, "report.json")) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 4 && args[0] === "--probe") {
    try { console.log(JSON.stringify(constructorProbe(args[1], args[2], args[3]))); } catch { console.error(JSON.stringify({ status: "failed", details: "Private Prisma probe diagnostics suppressed" })); process.exitCode = 1; }
  } else if (args.length === 2 && args[0] === "--workspace") {
    verifyVerificationWorkspace(args[1]).then((result) => console.log(JSON.stringify(result, null, 2))).catch(() => { console.error(JSON.stringify({ status: "failed", details: "Workspace verification failed; private diagnostics suppressed" })); process.exitCode = 1; });
  } else if (args.length === 1 && args[0] === "--contracts") {
    contracts().then((checks) => console.log(JSON.stringify({ status: "passed", checks, actualDatabaseConnections: 0, prismaImports: 0, scope: "Synthetic path, junction, read API and paired-profile guards" }))).catch(() => { console.error(JSON.stringify({ status: "failed", details: "Workspace source contracts failed; private diagnostics suppressed" })); process.exitCode = 1; });
  } else if(args.length===1 && args[0]==="--module-boundary") {
    moduleBoundaryContracts().then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error(JSON.stringify({status:"failed",details:"Pure import/root action tripwire failed; private diagnostics suppressed"}));process.exitCode=1;});
  } else { console.error("Use --contracts, --module-boundary or --workspace explicit-owned-workspace"); process.exitCode = 1; }
}
