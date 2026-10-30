import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Execute from an isolated public frontend copy, with no application server,
// database, secrets, or exploit code. Package checks also cover Linux artifacts
// that cannot be loaded by this Windows verification process.
const require = createRequire(path.resolve("package.json"));
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const lock = JSON.parse(await readFile("../package-lock.json", "utf8"));
let checks = 0;
function check(action) { action(); checks++; }
function fixedNext(version) { return /^16\.4\.(?:[1-9]\d*)$/.test(version); }
check(() => assert.equal(manifest.dependencies.next, "16.4.1"));
check(() => assert.equal(manifest.devDependencies["eslint-config-next"], "16.4.1"));
check(() => assert(fixedNext(require("next/package.json").version)));
for (const version of ["16.4.0", "16.3.9", "16.4.1-canary.0", "^16.4.1"])
  check(() => assert.equal(fixedNext(version), false));
check(() => assert.equal(lock.packages["node_modules/next"].version, "16.4.1"));
check(() => assert.equal(require("next/package.json").optionalDependencies.sharp, "^0.35.5"));
const sharp = require("sharp");
check(() => assert.equal(sharp.versions.sharp, "0.35.5"));
const image = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>'))
  .resize(4, 4).png().toBuffer({ resolveWithObject: true });
check(() => assert.deepEqual([image.info.width, image.info.height, image.info.format], [4, 4, "png"]));
for (const platform of ["linux-x64", "linux-arm64", "linuxmusl-x64", "linuxmusl-arm64", "win32-x64"])
  check(() => assert.equal(lock.packages[`node_modules/@img/sharp-${platform}`].version, "0.35.5"));
for (const name of ["react", "react-dom"])
  check(() => assert.equal(lock.packages[`node_modules/${name}`].version, "19.3.0"));

// Bound the maintained decoder in a child: a regression cannot hang this runner.
// The cyclic model contains three tiny public form entries, no action function.
const probe = String.raw`
const assert = require('node:assert/strict');
const rsc = require('next/dist/compiled/react-server-dom-webpack/server.node.js');
(async()=>{
  const plain = await rsc.decodeReply('{"fixture":"public","count":2}', {});
  assert.deepEqual(plain,{fixture:'public',count:2});
  const cyclic = new FormData();
  cyclic.set('0','"$@1"'); cyclic.set('1','"$@2"'); cyclic.set('2','"$@1"');
  await assert.rejects(Promise.resolve(rsc.decodeReply(cyclic, {})), /Cannot have cyclic thenables/);
  // Serialization of benign disjoint views must preserve only view bytes.
  const secretMarker=Buffer.from('synthetic-outside-view-marker');
  const storage=new Uint8Array(12288);storage.set(secretMarker,0);storage.fill(65,4096,8192);
  const stream=await rsc.renderToReadableStream({first:storage.subarray(4096,8192),second:new Uint8Array([2,3,4])},{});
  const bytes=Buffer.from(await new Response(stream).arrayBuffer());
  assert(!bytes.includes(secretMarker));assert(bytes.includes(Buffer.from([2,3,4])));
  console.log('maintained decoder/typed-array: 4 checks passed');
})().catch(()=>{process.exitCode=1;});`;
const osKeys = new Set(["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "TEMP", "TMP", "PATHEXT", "USERPROFILE", "APPDATA", "LOCALAPPDATA", "PROGRAMDATA"]);
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => osKeys.has(key.toUpperCase())));
const result = spawnSync(process.execPath, ["--conditions=react-server", "-e", probe], {
  cwd: process.cwd(), env: { ...env, NODE_ENV: "production", NODE_OPTIONS: "" },
  timeout: 10_000, maxBuffer: 64 * 1024, encoding: "utf8", windowsHide: true,
});
check(() => assert.equal(result.error, undefined, "Maintained framework probe failed or timed out"));
check(() => assert.equal(result.status, 0, "Maintained framework behavior regressed"));
check(() => assert.match(result.stdout, /4 checks passed/));
console.log(`Framework security patch: ${checks} package/negative/child checks plus 4 maintained-runtime checks passed.`);
