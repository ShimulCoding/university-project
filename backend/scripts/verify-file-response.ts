import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import express from "express";
import { sendAuthorizedLocalFile } from "../src/utils/file-response";

// Transport regression only: no env, database, auth mock or owner file access.
// The existing isolated document/API suites prove authorization and audit gates.
async function main() {
  const parent=resolve(__dirname,"../../.cache/scalability");
  await mkdir(parent,{recursive:true});
  const directory=await mkdtemp(join(parent,"file-response-"));
  const bytes=Buffer.from("%PDF-1.4\n% Owned synthetic transport regression\n%%EOF\n");
  const file=join(directory,"evidence.pdf");
  await writeFile(file,bytes,{flag:"wx"});
  await writeFile(join(directory,".hidden.pdf"),bytes,{flag:"wx"});
  const app=express();
  app.get("/before",(_request,response)=>response.sendFile(file));
  app.get("/after",(_request,response)=>sendAuthorizedLocalFile(response,file));
  app.get("/hidden",(_request,response)=>sendAuthorizedLocalFile(response,join(directory,".hidden.pdf")));
  app.get("/missing",(_request,response)=>sendAuthorizedLocalFile(response,join(directory,"missing.pdf")));
  app.get("/relative",(_request,response)=>sendAuthorizedLocalFile(response,"../evidence.pdf"));
  app.use((_error:unknown,_request:express.Request,response:express.Response,_next:express.NextFunction)=>response.status(500).json({message:"Internal server error."}));
  const server=app.listen(0,"127.0.0.1");let checks=0;
  try {
    await new Promise<void>(done=>server.once("listening",done));
    const port=(server.address() as {port:number}).port;
    const before=await fetch(`http://127.0.0.1:${port}/before`);
    assert.equal(before.status,500);checks++;
    assert(!(await before.text()).includes(bytes.toString()));checks++;
    const after=await fetch(`http://127.0.0.1:${port}/after`);
    assert.equal(after.status,200);checks++;
    assert.deepEqual(Buffer.from(await after.arrayBuffer()),bytes);checks++;
    for(const route of ["hidden","missing","relative"]) {
      const denied=await fetch(`http://127.0.0.1:${port}/${route}`);
      assert.equal(denied.status,500);checks++;
      const text=await denied.text();
      assert(!text.includes(bytes.toString())&&!text.includes(directory)&&!text.includes(basename(directory)));checks++;
    }
    console.log(JSON.stringify({verification:"file-response",checks,before:{authorizedHiddenRootStatus:500},after:{authorizedHiddenRootStatus:200,exactBytes:true},dataset:`one ${bytes.length}-byte synthetic file, same root/machine`,node:process.version,capacity:"Transport correctness only; no throughput measurement",fixturePolicy:"Fresh ignored evidence retained"}));
  } finally {
    server.closeAllConnections();
    await new Promise<void>((done,reject)=>server.close(error=>error?reject(error):done()));
  }
}
void main().catch(()=>{console.error("Private-root file transport verification failed; private diagnostics withheld.");process.exitCode=1;});
