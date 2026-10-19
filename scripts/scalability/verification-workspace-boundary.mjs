import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import { createRequire, registerHooks, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sha = value => createHash("sha256").update(value).digest("hex");
const same = (a,b) => process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
function inputPath(value) {
  let filename=value instanceof URL?fileURLToPath(value):String(value);
  // Node/Prisma use the supported Win32 extended-length spelling for dlopen.
  // Normalize only its DOS-drive prefix before containment, never UNC devices.
  if(process.platform==="win32" && /^\\\\\?\\[a-z]:\\/i.test(filename))filename=filename.slice(4);
  return path.resolve(filename);
}
let verified;
const statistics={materializedWorkspaceBoundary:true,outsideSourceReadAttempts:0,outsideModuleResolutions:0,outsideNativeLoadAttempts:0,nativeModules:[]};
export function workspaceBoundaryStatistics() {return {...statistics,nativeModules:[...statistics.nativeModules]};}

async function privateSnapshotFile(filename) {
  assert.equal(process.platform,"win32");
  assert(same(await realpath(filename),path.resolve(filename)));
  const literal = `'${filename.replaceAll("'", "''")}'`;
  const script = `$taskFile=${literal}; $taskSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $taskAcl=Get-Acl -LiteralPath $taskFile -ErrorAction Stop; if($taskAcl.Access.Count -ne 1 -or $taskAcl.Access[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $taskSid.Value -or $taskAcl.Access[0].AccessControlType -ne 'Allow'){throw 'Private snapshot ACL required'}`;
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>["PATH","SYSTEMROOT","WINDIR","COMSPEC","TEMP","TMP","PATHEXT","USERPROFILE","APPDATA","LOCALAPPDATA","PROGRAMDATA"].includes(key.toUpperCase())));
  await new Promise((resolve,reject)=>{
    const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-Command",script],{windowsHide:true,stdio:"ignore",env});
    const timer=setTimeout(()=>child.kill(),30000);
    child.on("error",()=>{clearTimeout(timer);reject(new Error("Private snapshot ACL check could not start"));});
    child.on("close",code=>{clearTimeout(timer);code===0?resolve():reject(new Error("Private snapshot ACL check failed"));});
  });
  return filename;
}

function contained(parent, candidate) {
  const relative = path.relative(parent, candidate);
  assert(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), "Verification inputs must remain inside the materialized workspace");
  return relative.replaceAll(path.sep, "/");
}

export async function verifyPackageResolutions(workspace, entries) {
  const require = createRequire(path.join(workspace,"package.json"));
  for (const name of ["@prisma/client", ".prisma/client/default", "tsx/cli", "typescript"]) {
    const filename = require.resolve(name), relative=contained(workspace,filename);
    assert(entries.has(relative) && same(await realpath(filename),path.resolve(filename)), "Package resolution escaped the verified materialized graph");
  }
}

function verifySyncInput(workspace,entries,filename) {
  const relative=contained(workspace,filename),entry=entries.get(relative);
  assert(entry,"Executable input is not in the proven snapshot manifest");
  const info=fs.lstatSync(filename);
  assert(info.isFile()&&!info.isSymbolicLink()&&same(fs.realpathSync(filename),path.resolve(filename)),"Executable input redirected");
  assert.equal(info.size,entry.bytes);assert.equal(sha(fs.readFileSync(filename)),entry.sha256,"Executable input bytes changed");
  return relative;
}

export function registerWorkspaceResolutionBoundary(workspace,entries) {
  const checked=new Set();
  // Node's supported synchronous hooks cover both import and require resolution.
  return registerHooks({resolve(specifier,context,nextResolve) {
    const result=nextResolve(specifier,context);
    if(result.url.startsWith("file:")) {
      const filename=fileURLToPath(result.url);
      try{contained(workspace,filename);if(!checked.has(filename)){verifySyncInput(workspace,entries,filename);checked.add(filename);}}
      catch(error){statistics.outsideModuleResolutions++;throw error;}
    } else if(!result.url.startsWith("node:")) {
      statistics.outsideModuleResolutions++;
      throw new Error("Verification modules must be builtins or contained materialized files");
    }
    return result;
  }});
}

export function verifyNativeInput(workspace,entries,filename) {
  // Containment precedes stat/read: an outside candidate never reads its bytes.
  return verifySyncInput(workspace,entries,inputPath(filename));
}

export function registerWorkspaceNativeBoundary(workspace,entries) {
  const dlopen=process.dlopen;
  process.dlopen=function(module,filename,...args){
    let relative;
    try{relative=verifyNativeInput(workspace,entries,filename);}catch(error){statistics.outsideNativeLoadAttempts++;throw error;}
    statistics.nativeModules.push(relative);
    return dlopen.call(this,module,filename,...args);
  };
  return ()=>{process.dlopen=dlopen;};
}

function registerWorkspaceReadBoundary(workspace,ownerRoot,entries) {
  const writeBoundaryReport=process.stdout.write.bind(process.stdout);
  const physicalPath=fs.realpathSync.bind(fs),fileInfo=fs.lstatSync.bind(fs),directoryNames=fs.readdirSync.bind(fs);
  const inside=(parent,candidate)=>{const relative=path.relative(parent,candidate);return relative===""||(!relative.startsWith(`..${path.sep}`)&&relative!==".."&&!path.isAbsolute(relative));};
  const refuse=()=>{statistics.outsideSourceReadAttempts++;throw Object.assign(new Error("Original repository or redirected reads are forbidden in materialized verification"),{code:"EACCES"});};
  const guard=value=>{
    if(typeof value==="number")return;
    let filename;try{filename=inputPath(value);}catch{return;}
    // Direct outside candidates are refused before even filesystem metadata.
    if(inside(ownerRoot,filename)&&!inside(workspace,filename))refuse();
    {
      const workspaceInput=inside(workspace,filename);
      let candidate=filename;
      for(;;){
        let canonical;
        try{canonical=inputPath(physicalPath(candidate));}
        catch(error){
          if(error?.code!=="ENOENT"&&error?.code!=="ENOTDIR")refuse();
          const parent=path.dirname(candidate);if(parent===candidate)refuse();candidate=parent;continue;
        }
        // Missing dotenv/output leaves may be legitimate. Their nearest
        // existing ancestor must still be ordinary and physically contained.
        if((workspaceInput&&(!inside(workspace,canonical)||!same(canonical,candidate)))||(!workspaceInput&&inside(ownerRoot,canonical)))refuse();
        if(workspaceInput){
          let info;
          try{info=fileInfo(candidate);}catch(error){
            if(error?.code!=="ENOENT"&&error?.code!=="ENOTDIR")refuse();
            const parent=path.dirname(candidate);if(parent===candidate)refuse();candidate=parent;continue;
          }
          // Materialized files are independent writeFile copies. A later
          // multi-link file can alias original bytes without a reparse path.
          if(info.isSymbolicLink()||(info.isFile()&&info.nlink>1))refuse();
        }
        break;
      }
    }
  };
  const guardCopyTree=(value,options)=>{
    if(!options?.recursive)return;
    const filename=inputPath(value);
    const pending=[filename];let visited=0;
    while(pending.length){
      const candidate=pending.pop();guard(candidate);
      let info;try{info=fileInfo(candidate);}catch(error){if(error?.code==="ENOENT"||error?.code==="ENOTDIR")continue;refuse();}
      if(info.isSymbolicLink()||++visited>100_000)refuse();
      if(info.isDirectory())for(const name of directoryNames(candidate))pending.push(path.join(candidate,name));
    }
  };
  // Blob and copy helpers read native-side without necessarily calling the
  // exported open/read methods. Guard their source before invoking that API.
  for(const object of [fs,fs.promises])for(const name of object===fs?["readFileSync","openSync","readFile","open","openAsBlob","copyFileSync","copyFile","cpSync","cp"]:["readFile","open","copyFile","cp"]){
    const prior=object[name];object[name]=function(filename,...args){guard(filename);if(name==="cp"||name==="cpSync")guardCopyTree(filename,args[1]);return prior.call(this,filename,...args);};
  }
  syncBuiltinESMExports();
  registerWorkspaceNativeBoundary(workspace,entries);
  process.once("exit",()=>{
    if(statistics.outsideSourceReadAttempts||statistics.outsideModuleResolutions||statistics.outsideNativeLoadAttempts)process.exitCode=1;
    writeBoundaryReport(JSON.stringify(statistics)+"\n");
  });
}

export async function verifyMaterializedFiles(workspace, manifest, {executionOnly=false}={}) {
  const entries = new Map();
  for (const [prefix, list] of [["", manifest.sourceFiles], ["node_modules/", manifest.dependencyFiles]]) {
    assert(Array.isArray(list) && list.length > 0);
    for (const entry of list) {
      assert(typeof entry.path === "string" && !/[\\\x00-\x1f:]/.test(entry.path) && entry.path.split("/").every(part => part && part !== "." && part !== ".."));
      const relative = prefix + entry.path; assert(!entries.has(relative));
      assert(/^[a-f0-9]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.bytes) && entry.bytes >= 0);
      assert(!relative.split("/").some(part => /^\.env(?:\.|$)/i.test(part) || /^(?:\.npmrc|\.yarnrc(?:\.yml)?)$/i.test(part)), "Private configuration is never a public snapshot input");
      entries.set(relative, entry);
    }
  }
  // Children validate inputs they execute through the resolving/native hooks;
  // package metadata and all public source are checked before loader registration.
  const files = [...entries.entries()].filter(([relative])=>!executionOnly||!relative.startsWith("node_modules/")||relative.endsWith("/package.json")||/\.(?:node|exe)$/i.test(relative)); let cursor = 0;
  await Promise.all(Array.from({length:8}, async () => {
    while(cursor < files.length) {
      const [relative, entry] = files[cursor++], filename = path.join(workspace, relative);
      contained(workspace, filename);
      const info = await lstat(filename);
      assert(info.isFile() && !info.isSymbolicLink() && same(await realpath(filename), path.resolve(filename)), "Snapshot input redirected or missing");
      assert.equal(info.size, entry.bytes); assert.equal(sha(await readFile(filename)), entry.sha256, "Snapshot bytes changed after preparation");
    }
  }));
  async function walk(directory) {
    for (const item of await readdir(directory,{withFileTypes:true})) {
      const filename = path.join(directory,item.name), relative=contained(workspace,filename);
      assert(!item.isSymbolicLink(),"Snapshot dependencies cannot redirect");
      if(item.isDirectory()) {assert(same(await realpath(filename),path.resolve(filename)),"Snapshot dependency directory redirected");await walk(filename);}
      else assert(item.isFile() && entries.has(relative),"Unmanifested dependency file is forbidden");
    }
  }
  if(!executionOnly)await walk(path.join(workspace,"node_modules"));
  for (const location of [".env","backend/.env","frontend/.env",".npmrc","backend/.npmrc","frontend/.npmrc"]) await assert.rejects(lstat(path.join(workspace,location)),{code:"ENOENT"});
  await verifyPackageResolutions(workspace,entries);
  // These are the documented legacy generated client's two dotenv locations.
  for (const candidate of [path.resolve(workspace,"node_modules/.prisma/client","../../../backend/.env"),path.resolve(workspace,"node_modules/.prisma/client","../../../.env")]) contained(workspace,candidate);
  return {sourceFiles:manifest.sourceFiles.length,dependencyFiles:manifest.dependencyFiles.length,entries};
}

export async function requireVerificationWorkspace({executionOnly=false}={}) {
  // Refuse the original repository before resolving or importing any ORM package.
  assert(/^verification-workspace-[a-f0-9]{32}$/.test(path.basename(root)) && path.basename(path.dirname(root)) === "scalability" && path.basename(path.dirname(path.dirname(root))) === ".cache", "ORM verification requires an explicitly prepared and proven private materialized workspace");
  if (!verified) verified=(async()=>{
    assert(same(await realpath(root),root));
    await privateSnapshotFile(root);
    const manifestPath=await privateSnapshotFile(path.join(root,"verification-workspace.json"));
    const manifestBytes=await readFile(manifestPath),manifest=JSON.parse(manifestBytes);
    assert(manifest.schemaVersion===1 && manifest.purpose==="public_source_materialized_dependency_verification" && same(manifest.workspace,root));
    assert(same(path.join(manifest.sourceRoot,".cache/scalability",path.basename(root)),root));
    const proof=JSON.parse(await readFile(await privateSnapshotFile(path.join(root,"verification-workspace-proof.json")),"utf8"));
    assert(proof.status==="passed" && proof.manifestSha256===sha(manifestBytes) && proof.privateOwnerBytesRead===0 && proof.actualDatabaseConnections===0,"Current snapshot needs the actual constructor boundary proof");
    const {entries}=await verifyMaterializedFiles(root,manifest,{executionOnly});
    registerWorkspaceResolutionBoundary(root,entries);
    registerWorkspaceReadBoundary(root,manifest.sourceRoot,entries);
    return root;
  })();
  return verified;
}

export async function verificationPrisma() {
  await requireVerificationWorkspace();
  return (await import("@prisma/client")).PrismaClient;
}
