import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

const repository = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export function validatePort(value) {
  const port = Number(value);
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(port) || port < 1024 || port > 65535 || [3000,4000,5432].includes(port)) throw new Error('Refusing unsafe or owner-service port');
  return port;
}
export function toWslPath(value) {
  if (!/^[A-Za-z]:[\\/]/.test(value) || /[\r\n\0]/.test(value)) throw new Error('Expected an absolute Windows drive path');
  return `/mnt/${value[0].toLowerCase()}/${value.slice(3).replaceAll('\\','/')}`;
}
function ownerOnly(directory) {
  if (process.platform !== 'win32') throw new Error('This helper targets the approved Windows/WSL environment');
  const who = spawnSync('whoami', [], { encoding:'utf8', timeout:10000 });
  const owner = who.stdout?.trim();
  if (who.status !== 0 || !/^[^\r\n"\0]+\\[^\r\n"\0]+$/.test(owner ?? '')) throw new Error('Cannot establish private fixture owner');
  const acl = spawnSync('icacls.exe', [directory,'/inheritance:r','/grant:r',`${owner}:(OI)(CI)(F)`], { encoding:'utf8', timeout:10000 });
  if (acl.status !== 0) throw new Error('Private fixture ACL could not be applied');
}
export async function prepare(portValue = 15432) {
  if (realpathSync(process.cwd()) !== realpathSync(repository)) throw new Error('Run from the repository root');
  const port = validatePort(portValue);
  await new Promise((accept,reject) => { const probe=createServer(); probe.once('error',()=>reject(new Error('Fixture port unavailable'))); probe.listen(port,'127.0.0.1',()=>probe.close(accept)); });
  const tag = `local-pg-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomUUID().slice(0,8)}`;
  const directory = resolve(repository,'.cache','scalability',tag);
  const suffix = relative(resolve(repository,'.cache','scalability'),directory);
  if (isAbsolute(suffix) || suffix.startsWith('..') || existsSync(directory)) throw new Error('Refusing an existing or out-of-scope fixture');
  mkdirSync(directory,{ recursive:false,mode:0o700 });
  // Remove inherited ACLs before creating any credential; never overwrite files.
  ownerOnly(directory);
  const password = randomBytes(48).toString('base64url');
  const secret = resolve(directory,'postgres-operator.secret');
  writeFileSync(secret,password,{ flag:'wx',mode:0o600 });
  writeFileSync(resolve(directory,'operator.json'),JSON.stringify({ host:'127.0.0.1',port,user:'mu_scale_operator',password,dbname:'postgres' }),{ flag:'wx',mode:0o600 });
  writeFileSync(resolve(directory,'compose.env'),`COMPOSE_PROJECT_NAME=mu-scale-${tag}\nSCALE_PG_PORT=${port}\nSCALE_PG_PASSWORD_FILE=${toWslPath(secret)}\n`,{ flag:'wx',mode:0o600 });
  const metadata = { directory:relative(repository,directory).replaceAll('\\','/'), project:`mu-scale-${tag}`, host:'127.0.0.1',port,image:'postgres:16.15-bookworm@sha256:0ea6700a3b4f0ae6ce746519073558aed4d88a79d8d07622a9a644946c7319c4',dataPolicy:'Fresh fake-only container volume; no existing database/config/MFA accessed',capacity:'Not measured; this component limit is not a whole-VPS budget' };
  writeFileSync(resolve(directory,'metadata.json'),JSON.stringify(metadata,null,2)+'\n',{ flag:'wx',mode:0o600 });
  return metadata;
}
function selfTest() {
  for (const input of [0,22,3000,4000,5432,65536,'15432;echo','15432\n','NaN']) assert.throws(()=>validatePort(input));
  for(const input of [15432,'16432',65535]) assert.equal(validatePort(input),Number(input));
  assert.equal(toWslPath('E:\\4.1\\WEB +PROJECT\\University-project\\.cache\\secret'),'/mnt/e/4.1/WEB +PROJECT/University-project/.cache/secret');
  for(const input of ['/tmp/secret','relative','E:relative','E:\\bad\npath']) assert.throws(()=>toWslPath(input));
  console.log('Local-container preparation: 17 input/path contracts passed; no fixture or credential created.');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv[2]==='--self-test') selfTest();
  else prepare(process.argv[2] ?? 15432).then(value=>console.log(JSON.stringify(value))).catch(()=>{ console.error('Local-container preparation failed; private diagnostics withheld. Existing fixture files retained.');process.exitCode=1; });
}
