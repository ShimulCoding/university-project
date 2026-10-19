import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fixtureConfig, runScript } from "./verify-local-database.mjs";
import { privateConfigurationFile } from "./provision-local-database.mjs";
import { requireVerificationWorkspace } from "./verification-workspace-boundary.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const suites=Object.freeze(["verify:flows","verify:finance","verify:governance","verify:event-scope","verify:event-workspaces","verify:project-audit","verify:security-logging","verify:security-cors","verify:security-seed","verify:security-scanner","verify:security-financial-replay","verify:security-mail-transport","verify:security-admission-lifecycle","verify:security-action-limits","verify:security-audit-metadata","verify:security-uploads","verify:security-mfa","verify:security-mfa-crypto","verify:security-email","verify:security-login","verify:security-session-boundary","verify:security-bootstrap","verify:security-document-audit","verify:demo:mfa-contract"]);

export async function verifyBackendSuites(fixtureFile) {
  await requireVerificationWorkspace();
  assert(fixtureFile,"One explicit private approved fake fixture is required");
  const filename=await privateConfigurationFile(fixtureFile),config=fixtureConfig(JSON.parse(await readFile(filename,"utf8")));
  assert.equal(config.connectionMode??"direct","direct");
  assert.equal(new URL(config.runtimeDatabaseUrl).hostname,"127.0.0.1");
  assert.equal(new URL(config.runtimeDatabaseUrl).port,"15432");
  const reportFile=path.join(path.dirname(filename),`backend-suites-${randomUUID().replaceAll("-","")}.json`);
  const report={status:"running",database:config.database,node:process.version,suites:suites.length,results:[],scope:"All inherited nonbrowser backend suites in one public-source/materialized-dependency snapshot; per-child read/resolution tripwires; direct approved fake fixture only"};
  for(const script of suites) {
    const started=Date.now();
    try {
      const result=await runScript(config,script);
      report.results.push({...result,elapsedMs:Date.now()-started});
    } catch(error) {
      report.results.push({status:"failed",script,elapsedMs:Date.now()-started,...(error.diagnostics?{diagnostics:error.diagnostics}:{})});
    }
    await writeFile(reportFile,JSON.stringify(report,null,2)+"\n",{mode:0o600});
    console.log(JSON.stringify(report.results.at(-1)));
  }
  report.status=report.results.every(result=>result.status==="passed")?"passed":"failed";
  await writeFile(reportFile,JSON.stringify(report,null,2)+"\n",{mode:0o600});
  return {status:report.status,suites:report.suites,passed:report.results.filter(result=>result.status==="passed").length,report:path.relative(root,reportFile)};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.length!==2||args[0]!=="--config"){console.error("Use --config explicit-private-fake-fixture.json");process.exitCode=1;}
  else verifyBackendSuites(args[1]).then(report=>{console.log(JSON.stringify(report));if(report.status!=="passed")process.exitCode=1;}).catch(()=>{console.error(JSON.stringify({status:"failed",details:"Private suite diagnostics suppressed; no target fallback"}));process.exitCode=1;});
}
