import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireVerificationWorkspace } from "./verification-workspace-boundary.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");

export async function buildVerificationWorkspace() {
  await requireVerificationWorkspace();
  const {default:ts}=await import("typescript");
  const allowed=filename=>{const relative=path.relative(root,path.resolve(filename));return relative===""||(!relative.startsWith(`..${path.sep}`)&&relative!==".."&&!path.isAbsolute(relative));};
  let excluded=0,emitted=0;
  const system={...ts.sys};
  // A supported compiler host ends ancestor discovery before a filesystem call.
  // Every copied local type/dependency and all strict project options remain in use.
  for(const [name,fallback] of [["readFile",undefined],["fileExists",false],["directoryExists",false],["getDirectories",[]],["readDirectory",[]]]) {
    const prior=ts.sys[name];
    if(prior)system[name]=function(filename,...args){if(!allowed(filename)){excluded++;return fallback;}return prior.call(ts.sys,filename,...args);};
  }
  system.realpath=filename=>allowed(filename)?ts.sys.realpath(filename):path.resolve(filename);
  const parsed=ts.getParsedCommandLineOfConfigFile(path.join(root,"backend/tsconfig.json"),{typeRoots:[path.join(root,"node_modules/@types")]},{...system,onUnRecoverableConfigFileDiagnostic:diagnostic=>{throw new Error(`Snapshot compiler configuration diagnostic ${diagnostic.code}`);}});
  assert(parsed&&parsed.fileNames.every(allowed),"Compiler inputs must remain inside snapshot");
  const host=ts.createCompilerHost(parsed.options);
  for(const name of ["readFile","fileExists","directoryExists","getDirectories","readDirectory","realpath"])if(system[name])host[name]=system[name];
  host.getCurrentDirectory=()=>root;
  const write=host.writeFile;
  host.writeFile=(filename,...args)=>{assert(allowed(filename),"Compiler output must remain inside snapshot");emitted++;return write.call(host,filename,...args);};
  const program=ts.createProgram({rootNames:parsed.fileNames,options:parsed.options,projectReferences:parsed.projectReferences,host,configFileParsingDiagnostics:parsed.errors});
  assert(program.getSourceFiles().every(file=>allowed(file.fileName)),"Compiler cannot consume ancestor source files");
  const result=program.emit(),diagnostics=ts.getPreEmitDiagnostics(program).concat(result.diagnostics);
  return {status:diagnostics.length===0&&!result.emitSkipped?"passed":"failed",diagnosticCodes:diagnostics.map(diagnostic=>diagnostic.code),checkedSourceFiles:program.getSourceFiles().length,emittedFiles:emitted,ancestorCandidatesExcludedBeforeFilesystem:excluded,scope:"Public snapshot backend build through a contained supported TypeScript host; strict options retained; no owner output or database operation"};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==2){console.error("Run without arguments inside an explicitly prepared and proven private verification snapshot");process.exitCode=1;}
  else buildVerificationWorkspace().then(report=>{console.log(JSON.stringify(report));if(report.status!=="passed")process.exitCode=1;}).catch(()=>{console.error(JSON.stringify({status:"failed",details:"Snapshot compiler diagnostics suppressed; no owner source fallback"}));process.exitCode=1;});
}
