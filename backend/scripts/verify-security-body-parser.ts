import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

// Bounded regression for GHSA-27r3-jxmh-p828. Maintainer fix:
// https://github.com/expressjs/body-parser/commit/f7075ea
// Run any vulnerable comparison in a disposable child; never absorb its uncaught error.
const fixture = String.raw`
const assert = require('node:assert/strict');
const http = require('node:http');
const zlib = require('node:zlib');
const express = require(process.argv[1]);
const parser = require(process.argv[2]);
const attackOnly = process.argv[3] === 'attack';
let checks=0;const check=(condition)=>{assert(condition);checks++;};
const app=express();app.get('/health',(_req,res)=>res.sendStatus(204));
app.use('/form',parser.urlencoded({extended:true}));
app.use(parser.json({limit:'2mb'}));
app.post(/.*/, (req,res)=>res.json(req.body));
app.use((error,_req,res,_next)=>res.status(error.status||500).json({type:error.type||'unknown'}));
const server=app.listen(0,'127.0.0.1',async()=>{
 const port=server.address().port;
 async function send(url,body,headers={},split=false){return await new Promise((resolve,reject)=>{
  const req=http.request({host:'127.0.0.1',port,path:url,method:'POST',headers:{'Content-Type':'application/json','Content-Length':body.length,...headers},agent:false},res=>{let text='';res.on('data',b=>text+=b);res.on('end',()=>resolve({status:res.statusCode,text}));});
  req.setTimeout(3000,()=>req.destroy(new Error('fixture deadline')));req.on('error',reject);
  if(split){req.write(body.subarray(0,body.length-102400));setTimeout(()=>req.end(body.subarray(body.length-102400)),30);}else req.end(body);
 });}
 try{
  const json=Buffer.from('{"fixture":true}');
  const gzip=zlib.gzipSync(json);const junk=Buffer.alloc(102400,0x58);
  const result=await send('/json',Buffer.concat([gzip,Buffer.from([0]),junk]),{'Content-Encoding':'gzip'});
  check([200,400].includes(result.status));
  await new Promise(resolve=>setTimeout(resolve,250));
  check((await fetch('http://127.0.0.1:'+port+'/health')).status===204);
  if(!attackOnly){
   for(const [encoding,compress]of [['gzip',zlib.gzipSync],['deflate',zlib.deflateSync],['br',zlib.brotliCompressSync]]){
    const ok=await send('/json',compress(json),{'Content-Encoding':encoding});check(ok.status===200&&JSON.parse(ok.text).fixture===true);
   }
   const continued=await send('/json',Buffer.concat([zlib.deflateSync(json),junk]),{'Content-Encoding':'deflate'},true);check([200,400].includes(continued.status));
   await new Promise(resolve=>setTimeout(resolve,250));check((await fetch('http://127.0.0.1:'+port+'/health')).status===204);
   const plain=await send('/json',json);check(plain.status===200&&JSON.parse(plain.text).fixture===true);
   const invalid=await send('/json',Buffer.from('{'));check(invalid.status===400&&JSON.parse(invalid.text).type==='entity.parse.failed');
   const large=await send('/json',Buffer.from('{"data":"'+'x'.repeat(2*1024*1024)+'"}'));check(large.status===413&&JSON.parse(large.text).type==='entity.too.large');
   if(typeof zlib.zstdCompressSync==='function'){
    const zstd=await send('/json',zlib.zstdCompressSync(json),{'Content-Encoding':'zstd'});check(zstd.status===200&&JSON.parse(zstd.text).fixture===true);
    const zstdLarge=await send('/json',zlib.zstdCompressSync(Buffer.from('{"data":"'+'x'.repeat(2*1024*1024)+'"}')),{'Content-Encoding':'zstd'});check(zstdLarge.status===413&&JSON.parse(zstdLarge.text).type==='entity.too.large');
    const zstdInvalid=await send('/json',Buffer.from('invalid-zstd-fixture'),{'Content-Encoding':'zstd'});check(zstdInvalid.status===400);
    check((await fetch('http://127.0.0.1:'+port+'/health')).status===204);
   }
   const form=await send('/form',Buffer.from('fixture[value]=yes'),{'Content-Type':'application/x-www-form-urlencoded'});check(form.status===200&&JSON.parse(form.text).fixture.value==='yes');
  }
  console.log(JSON.stringify({checks,alive:true,zstdSupported:typeof zlib.zstdCompressSync==='function'}));
 }finally{server.closeAllConnections();server.close();}
});
server.on('error',()=>process.exit(2));
`;

const candidate = process.argv.indexOf("--module");
const modulePath = candidate < 0 ? require.resolve("body-parser") : path.resolve(process.argv[candidate + 1]!);
const expectedVulnerable = process.argv.includes("--expect-vulnerable");
const result = spawnSync(process.execPath, ["-e", fixture, require.resolve("express"), modulePath, expectedVulnerable ? "attack" : "full"], {
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => new Set(["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"]).has(key.toUpperCase()))),
  encoding: "utf8", windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024,
});
assert.equal(result.error, undefined, "Parser child failed to execute or exceeded its deadline.");
if (expectedVulnerable) {
  assert.notEqual(result.status, 0, "Negative control did not reproduce the vulnerable child failure.");
  assert.match(result.stderr, /Unhandled 'error' event/);
  assert.match(result.stderr, /Z_DATA_ERROR|incorrect header check/);
  console.log(JSON.stringify({ label: "Body parser negative control", childExit: result.status, uncaughtDecoderError: true }));
} else {
  assert.equal(result.status, 0, "Patched parser child failed.");
  const report = JSON.parse(result.stdout.trim()) as { checks: number; alive: boolean; zstdSupported: boolean };
  const supportsZstd = typeof require("node:zlib").zstdCompressSync === "function";
  assert.equal(report.alive, true); assert.equal(report.zstdSupported, supportsZstd);
  assert.equal(report.checks, 11 + (supportsZstd ? 4 : 0));
  console.log(`Body parser regression: ${report.checks + 5} checks passed; child remains alive.`);
}
