import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";

// Local recipient parsing only; no SMTP connection, credentials, or delivery.
// Primary advisories: GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w,
// GHSA-85x2-q946-cp5h (https://github.com/advisories/<identifier>).
const fixture = String.raw`
const assert=require('node:assert/strict'),net=require('node:net'),tls=require('node:tls');
let connections=0;const denied=()=>{connections++;throw Error('Network forbidden in parser fixture');};net.connect=denied;net.createConnection=denied;tls.connect=denied;
const mailer=require(process.argv[1]),parser=require(process.argv[2]);const parse=typeof parser==='function'?parser:parser.default;
const negative=process.argv[3]==='old';let checks=0;const check=c=>{assert(c);checks++;};
const recipient='recipient@example.invalid',untrusted='untrusted@other.invalid';
const cases=[
 ['nested-comment','Student (outer(inner) <'+untrusted+'>) <'+recipient+'>',recipient],
 ['group-comment','Students: (label; <'+untrusted+'>) <'+recipient+'>;',recipient],
 ['quoted-angle','<"part@other.invalid>"@example.invalid>','"part@other.invalid>"@example.invalid'],
];
async function main(){
 let incorrect=0;const transport=mailer.createTransport({jsonTransport:true});
 for(const [label,input,expected]of cases){
  const addresses=parse(input,{flatten:true}).map(x=>x.address);const right=addresses.length===1&&addresses[0]===expected;
  if(negative){check(!right);incorrect++;}else check(right);
  if(!negative){const message=await transport.sendMail({from:'sender@example.invalid',to:input,subject:'Synthetic parser fixture',text:'Synthetic content only',disableFileAccess:true,disableUrlAccess:true});const envelopeExpected=label==='quoted-angle'?'"part@other.invalid "@example.invalid':expected;check(message.envelope.to.length===1&&message.envelope.to[0]===envelopeExpected);}
 }
 if(!negative){
  check(parse('Student <'+recipient+'>',{flatten:true})[0].address===recipient);
  check(parse(recipient+', second@example.invalid',{flatten:true}).length===2);
  check(parse('Students: '+recipient+';',{flatten:true})[0].address===recipient);
  const result=await transport.sendMail({from:'sender@example.invalid',to:recipient,subject:'Synthetic',text:'Synthetic',disableFileAccess:true,disableUrlAccess:true});
  check(result.envelope.to.length===1&&result.envelope.to[0]===recipient);
 }
 for(const address of ['student+fees@example.invalid','first.last@example.invalid',"o'connor@example.invalid",'student@dept.example.invalid']){
  const parsed=parse(address,{flatten:true});check(parsed.length===1&&parsed[0].address===address);
  const message=await transport.sendMail({from:'sender@example.invalid',to:address,subject:'Synthetic parity fixture',text:'Synthetic only',disableFileAccess:true,disableUrlAccess:true});
  check(message.envelope.to.length===1&&message.envelope.to[0]===address);
 }
 transport.close();check(connections===0);console.log(JSON.stringify({checks,incorrect,connections}));
}
main().catch(()=>{console.error('Mail parser fixture failed after '+checks+' completed checks.');process.exitCode=1;});
`;
const index = process.argv.indexOf("--module");
const mailer = index < 0 ? require.resolve("nodemailer") : require.resolve(path.resolve(process.argv[index + 1]!));
const parser = path.join(path.dirname(mailer), "addressparser/index.js");
const negative = process.argv.includes("--expect-vulnerable");
const result = spawnSync(process.execPath, ["-e", fixture, mailer, parser, negative ? "old" : "new"], {
  env: Object.fromEntries(Object.entries(process.env).filter(([key]) => new Set(["PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT"]).has(key.toUpperCase()))),
  encoding: "utf8", windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024,
});
assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr.trim() || "Mail parser fixture failed.");
const report = JSON.parse(result.stdout.trim()) as { checks: number; incorrect: number; connections: number };
assert.equal(report.connections, 0); assert.equal(report.incorrect, negative ? 3 : 0);
assert.equal(report.checks, negative ? 12 : 19);
console.log(`Mail parser ${negative ? "negative control" : "regression"}: ${report.checks + 5} checks passed; zero network connections.`);
