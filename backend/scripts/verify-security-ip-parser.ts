import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

// GHSA-rxp7-6hxx-x8q5: bounded input and observable regex dispatch, not a
// brittle elapsed-time assertion. Retain actual ERL default /56 identities.
const fixture = String.raw`
const assert=require('node:assert/strict'),{performance}=require('node:perf_hooks');
const {Address4,Address6}=require(process.argv[1]);const old=process.argv[3]==='old';
let checks=0;const check=c=>{assert(c);checks++;};
let repeatedZoneMatches=0;const original=RegExp.prototype.exec;
RegExp.prototype.exec=function(value){if(this.source==='%.*$')repeatedZoneMatches++;return Reflect.apply(original,this,[value]);};
const measurements=[];
try{for(const length of [1024,2048,4096]){const input='%'.repeat(length)+'\nx';const started=performance.now();check(Address6.isValid(input)===false);assert.throws(()=>new Address6(input));checks++;measurements.push({length,elapsedMs:performance.now()-started});}}
finally{RegExp.prototype.exec=original;}
check(old?repeatedZoneMatches>0:repeatedZoneMatches===0);
check(Address4.isValid('192.0.2.1'));check(Address6.isValid('2001:db8::1'));
check(new Address6('fe80::1%fixture').zone==='%fixture');
check(Address6.isValid('１２７.０.０.１')===false);check(Address4.isValid('１２７.０.０.１')===false);
// Test the installed unchanged ERL package with this exact candidate dependency.
const Module=require('node:module'),load=Module._load;
Module._load=function(name,...rest){return name==='ip-address'?{Address4,Address6}:Reflect.apply(load,this,[name,...rest]);};
let limiter;try{limiter=require(process.argv[2]);}finally{Module._load=load;}
const key=limiter.ipKeyGenerator;
check(key('192.0.2.1')==='192.0.2.1');check(key('::ffff:192.0.2.1')==='192.0.2.1');
check(key('2001:db8:1234:5600::1')===key('2001:db8:1234:56ff::9'));
check(key('2001:db8:1234:5600::1')!==key('2001:db8:1234:5700::1'));
check(key('2001:db8:1234:5600::1',false)==='2001:db8:1234:5600::1');
const express=require(process.argv[4]),app=express();app.set('trust proxy',1);
const gate=limiter.rateLimit({windowMs:60000,limit:2,standardHeaders:'draft-8',legacyHeaders:false});app.use(gate);app.get('/',(_req,res)=>res.sendStatus(204));
const server=app.listen(0,'127.0.0.1');
server.once('listening',async()=>{try{
 const url='http://127.0.0.1:'+server.address().port+'/';const send=ip=>fetch(url,{headers:{'X-Forwarded-For':ip}});
 check((await send('2001:db8:1234:5600::1')).status===204);check((await send('2001:db8:1234:56ff::9')).status===204);
 const denied=await send('2001:db8:1234:5601::2');check(denied.status===429&&denied.headers.has('retry-after')&&denied.headers.has('ratelimit'));
 check((await send('2001:db8:1234:5700::1')).status===204);
 console.log(JSON.stringify({checks,repeatedZoneMatches,measurements}));
 }finally{gate.resetKey(key('2001:db8:1234:5600::1'));gate.resetKey(key('2001:db8:1234:5700::1'));server.closeAllConnections();server.close();}
});
`;
const at = process.argv.indexOf("--module");
const target = at < 0 ? require.resolve("ip-address") : require.resolve(path.resolve(process.argv[at + 1]!));
const old = process.argv.includes("--expect-vulnerable");
const result = spawnSync(process.execPath, ["-e", fixture, target, require.resolve("express-rate-limit"), old ? "old" : "new", require.resolve("express")], {
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => new Set(["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"]).has(key.toUpperCase()))),
  encoding: "utf8", windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024,
});
assert.equal(result.error, undefined); assert.equal(result.status, 0, "IP parser fixture failed.");
const report = JSON.parse(result.stdout.trim()) as { checks: number; repeatedZoneMatches: number; measurements: { length: number; elapsedMs: number }[] };
assert.equal(report.checks, 21); assert.equal(old ? report.repeatedZoneMatches > 0 : report.repeatedZoneMatches === 0, true);
console.log(JSON.stringify({ label: old ? "IP parser negative control" : "IP parser regression", checks: report.checks + 4, childChecks: report.checks, repeatedZoneMatches: report.repeatedZoneMatches, measurements: report.measurements }));
