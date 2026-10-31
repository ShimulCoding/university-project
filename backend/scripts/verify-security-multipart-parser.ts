import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

// Small stream teardown control for GHSA-q7qp-rjg7-q26m; maintainer fix:
// https://github.com/expressjs/multer/commit/80a2d9d
// The application has no asynchronous fileFilter. This proves the package defect,
// then checks its unchanged memory-storage limits without importing application routes.
const fixture = String.raw`
const assert=require('node:assert/strict'),http=require('node:http'),{PassThrough}=require('node:stream');
const express=require(process.argv[1]),multer=require(process.argv[2]);
let checks=0;const check=c=>{assert(c);checks++;};
const boundary='bounded-fixture-boundary';
const part=(name,value,file=false)=>'--'+boundary+'\r\nContent-Disposition: form-data; name="'+name+'"'+(file?'; filename="synthetic.txt"':'')+'\r\n'+(file?'Content-Type: text/plain\r\n':'')+'\r\n'+value+'\r\n';
async function storageAbort(failed){
 const req=new PassThrough(),removals=[];let handles=0,nextCalls=0;
 const bytes=part('evidence','ab',true)+'--'+boundary+'--\r\n';
 req.headers={'content-type':'multipart/form-data; boundary='+boundary,'content-length':Buffer.byteLength(bytes)};
 await new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>reject(new Error('storage fixture deadline')),3000);
  const storage={
   _handleFile(_request,file,callback){handles++;file.stream.once('end',()=>setImmediate(()=>callback(failed?new Error('synthetic storage failure'):null,failed?undefined:{size:2,synthetic:true})));file.stream.resume();},
   _removeFile(_request,file,callback){removals.push(file);callback(null);}
  };
  multer({storage,limits:{fileSize:1}}).array('evidence')(req,{},error=>{
   nextCalls++;
   setImmediate(()=>{
    clearTimeout(deadline);
    try{
     check(error?.code==='LIMIT_FILE_SIZE');check(Array.isArray(error.storageErrors)&&error.storageErrors.length===0);
     check(handles===1);check(req.files.length===0);check(nextCalls===1);
     if(failed&&removals.length!==0){console.error(JSON.stringify({label:'unstored-abort-cleanup',removeCalls:removals.length,stored:false}));}
     check(removals.length===(failed?0:1));
     if(!failed)check(removals[0].synthetic===true&&removals[0].size===2);
     resolve();
    }catch(error){reject(error);}
   });
  });req.end(bytes);
 });
}
async function teardown(){
 const req=new PassThrough();const rejected=new Error('synthetic rejected file');let pending,parser,nextCalls=0;
 const bytes=part('parked','a',true)+part('rejected','b',true).slice(0,-2);
 req.headers={'content-type':'multipart/form-data; boundary='+boundary,'content-length':Buffer.byteLength(bytes)};
 await new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>reject(new Error('teardown fixture deadline')),3000);
  multer({fileHwm:1,streamHandler:(request,p)=>{parser=p;request.pipe(p);},fileFilter:(request,file,callback)=>{
   if(file.fieldname==='parked')pending=callback;
   else request.once('end',()=>setImmediate(()=>callback(rejected)));
  }}).any()(req,{},error=>{
   nextCalls++;check(error===rejected);check(typeof pending==='function');
   setImmediate(()=>{parser.once('close',()=>{clearTimeout(deadline);check(nextCalls===1);check(req.files.length===0);resolve();});pending(null,true);});
  });req.end(bytes);
 });
}
async function main(){
 if(process.argv[3]==='storage'){await storageAbort(true);await storageAbort(false);console.log(JSON.stringify({checks,alive:true}));return;}
 await teardown();
 if(process.argv[3]==='attack'){console.log(JSON.stringify({checks}));return;}
 await storageAbort(true);await storageAbort(false);
 const app=express();const upload=multer({storage:multer.memoryStorage(),limits:{fields:30,parts:45,fieldSize:16*1024,files:15,fileSize:8*1024*1024}}).array('evidence',15);
 app.post('/',upload,(req,res)=>res.json({files:req.files.length,bytes:req.files.map(x=>x.buffer.length),fields:Object.keys(req.body).length}));
 app.use((error,_req,res,_next)=>res.status(422).json({code:error.code||'INVALID_MULTIPART'}));
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 async function send(parts,close=true){const bytes=Buffer.from(parts.join('')+(close?'--'+boundary+'--\r\n':''));return await new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port:server.address().port,method:'POST',agent:false,headers:{'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':bytes.length}},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(text)}));});req.on('error',reject);req.setTimeout(4000,()=>req.destroy(new Error('HTTP fixture deadline')));req.end(bytes);
 });}
 try{
  const valid=await send([part('description','synthetic'),part('evidence','fake PDF bytes',true)]);check(valid.status===200&&valid.body.files===1&&valid.body.bytes[0]===14);
  const exactField=await send([part('description','x'.repeat(16384))]);check(exactField.status===200);
  const overField=await send([part('description','x'.repeat(16385))]);check(overField.status===422&&overField.body.code==='LIMIT_FIELD_VALUE');
  const exactFile=await send([part('evidence','x'.repeat(8*1024*1024),true)]);check(exactFile.status===200&&exactFile.body.bytes[0]===8*1024*1024);
  const overFile=await send([part('evidence','x'.repeat(8*1024*1024+1),true)]);check(overFile.status===422&&overFile.body.code==='LIMIT_FILE_SIZE');
  const fields=Array.from({length:30},(_,i)=>part('field'+i,'x')),files=Array.from({length:15},()=>part('evidence','x',true));
  const atCounts=await send([...fields,...files]);check(atCounts.status===200&&atCounts.body.fields===30&&atCounts.body.files===15);
  const overFields=await send([...fields,part('extra','x')]);check(overFields.status===422&&overFields.body.code==='LIMIT_FIELD_COUNT');
  const overFiles=await send([...files,part('evidence','x',true)]);check(overFiles.status===422&&['LIMIT_FILE_COUNT','LIMIT_UNEXPECTED_FILE'].includes(overFiles.body.code));
  const truncated=await send([part('evidence','x',true)],false);check(truncated.status===422&&truncated.body.code==='INVALID_MULTIPART');
  console.log(JSON.stringify({checks,alive:true}));
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
main().catch(()=>{console.error('Multipart fixture failed after '+checks+' completed checks.');process.exitCode=1;});
`;
const at = process.argv.indexOf("--module");
const target = at < 0 ? require.resolve("multer") : path.resolve(process.argv[at + 1]!);
const negative = process.argv.includes("--expect-vulnerable");
const storageNegative = process.argv.includes("--expect-storage-bug");
assert(!(negative && storageNegative), "Select one negative control at a time.");
const result = spawnSync(process.execPath, ["-e", fixture, require.resolve("express"), target, negative ? "attack" : storageNegative ? "storage" : "full"], {
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => new Set(["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"]).has(key.toUpperCase()))),
  encoding: "utf8", windowsHide: true, timeout: 20000, maxBuffer: 1024 * 1024,
});
assert.equal(result.error, undefined, "Multipart child failed to execute or exceeded deadline.");
if (storageNegative) {
  assert.equal(result.status, 1, "Original multipart cleanup did not fail.");
  const observation = result.stderr.trim().split(/\r?\n/).find(line => line.startsWith('{"label":"unstored-abort-cleanup"'));
  assert(observation, "Expected failed-storage cleanup observation was absent.");
  assert.deepEqual(JSON.parse(observation), { label: "unstored-abort-cleanup", removeCalls: 1, stored: false });
  console.log(JSON.stringify({ label: "Multipart failed-storage negative control", childExit: result.status, removedUnstoredFile: true }));
} else if (negative) {
  assert.notEqual(result.status, 0, "Original multipart child did not fail.");
  assert.match(result.stderr, /Unhandled 'error' event/);
  assert.match(result.stderr, /Unexpected end of form/);
  console.log(JSON.stringify({ label: "Multipart negative control", childExit: result.status, uncaughtLateParserError: true }));
} else {
  assert.equal(result.status, 0, result.stderr.trim() || "Multipart regression child failed.");
  const report = JSON.parse(result.stdout.trim()) as { checks: number; alive: boolean };
  assert.equal(report.alive, true); assert.equal(report.checks, 26);
  console.log(`Multipart parser regression: ${report.checks + 5} checks passed.`);
}
