import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verificationPrisma} from './verification-workspace-boundary.mjs';
import {fixtureConfig,fixtureTransactionPooler} from './verify-local-database.mjs';
import {operatorParameters,privateConfigurationFile} from './provision-local-database.mjs';
import {toWslPath} from './prepare-local-container.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
let stage='arguments';

export function poolerSettings(database) {
  assert(/^mu_scale_[a-z0-9_]{8,35}$/.test(database));
  // Identical SCRAM pass-through requires no forced user in this mapping.
  return `[databases]\n${database} = host=postgres port=5432 dbname=${database}\n\n[pgbouncer]\nlisten_addr = 0.0.0.0\nlisten_port = 6432\nunix_socket_dir =\nauth_type = scram-sha-256\nauth_file = /run/secrets/pooler_auth\nadmin_users =\nstats_users =\npool_mode = transaction\ndefault_pool_size = 5\nmin_pool_size = 0\nreserve_pool_size = 0\nmax_client_conn = 50\nmax_db_connections = 5\nmax_user_connections = 5\nmax_prepared_statements = 200\nquery_wait_timeout = 10\nquery_timeout = 30\nserver_connect_timeout = 5\nserver_login_retry = 5\nclient_login_timeout = 10\nclient_idle_timeout = 120\nidle_transaction_timeout = 30\nserver_idle_timeout = 60\nserver_lifetime = 600\nserver_reset_query = DISCARD ALL\nserver_reset_query_always = 0\nlog_connections = 0\nlog_disconnections = 0\nlog_pooler_errors = 0\nlog_stats = 0\nverbose = 0\npidfile = /run/pgbouncer/pgbouncer.pid\n`;
}

export function runtimeAuth(role,verifier) {
  assert(/^mu_scale_[a-z0-9_]{8,35}_runtime$/.test(role));
  assert(typeof verifier==='string' && /^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=:[A-Za-z0-9+/]{43}=$/.test(verifier),'Only the existing reviewed runtime SCRAM verifier is allowed');
  return `"${role}" "${verifier}"\n`;
}

function ownedCommand(command,args,input='') {
  return new Promise((resolve,reject)=>{
    const child=spawn('wsl.exe',['-d','Ubuntu-24.04','--user','root','--exec',command,...args],{windowsHide:true,stdio:['pipe','pipe','pipe']});
    let output='';child.stdout.on('data',part=>{if(output.length+part.length>2*1024*1024)child.kill();else output+=part.toString();});
    child.stderr.resume();const timeout=setTimeout(()=>child.kill(),30000);
    child.stdin.on('error',()=>{});child.stdin.end(input);
    child.on('error',()=>{clearTimeout(timeout);reject(new Error('Owned Docker inspection failed'));});
    child.on('close',code=>{clearTimeout(timeout);code===0?resolve(output):reject(new Error('Owned Docker inspection failed'));});
  });
}
const docker=args=>ownedCommand('docker',args);

export async function prepare(fixtureFile,operatorFile,containerDirectory) {
  const PrismaClient=await verificationPrisma();
  assert(fixtureFile&&operatorFile&&containerDirectory,'Explicit owned configurations are required');
  stage='private_configuration';
  const config=fixtureConfig(JSON.parse(await readFile(await privateConfigurationFile(fixtureFile),'utf8')));
  assert(config.connectionMode===undefined||config.connectionMode==='direct','Preparation requires the original direct fixture');
  const operator=operatorParameters(JSON.parse(await readFile(await privateConfigurationFile(operatorFile),'utf8')));
  assert(operator.host==='127.0.0.1'&&operator.port===fixtureTransactionPooler.upstreamPort&&operator.user==='mu_scale_operator');
  const metadata=JSON.parse(await readFile(await privateConfigurationFile(path.join(containerDirectory,'metadata.json')),'utf8'));
  assert(/^mu-scale-local-pg-\d{8}-[a-f0-9]{8}$/.test(metadata.project));
  assert(metadata.host==='127.0.0.1'&&metadata.port===15432);
  stage='actual_owned_artifact_network';
  const image=JSON.parse(await docker(['image','inspect',fixtureTransactionPooler.imageId]));
  assert(image.length===1&&image[0].Id===fixtureTransactionPooler.imageId&&image[0].Config.User==='10001:10001');
  const network=metadata.project+'_database';
  const actualNetwork=JSON.parse(await docker(['network','inspect',network]));
  assert(actualNetwork.length===1&&actualNetwork[0].Internal===true&&actualNetwork[0].Labels['com.docker.compose.project']===metadata.project);
  const postgres=JSON.parse(await docker(['inspect',metadata.project+'-postgres-1']));
  assert(postgres.length===1&&postgres[0].State.Status==='running'&&postgres[0].Config.Labels['com.docker.compose.service']==='postgres'&&Object.keys(postgres[0].NetworkSettings.Networks).join()===network);
  const operatorUrl=new URL(config.migrationDatabaseUrl);
  assert(operatorUrl.hostname===operator.host&&operatorUrl.port===operator.port);
  operatorUrl.username=operator.user;operatorUrl.password=operator.password;
  const client=new PrismaClient({datasources:{db:{url:operatorUrl.toString()}},log:[]});
  try {
    stage='actual_operator_and_runtime_verifier';
    const identity=await client.$queryRaw`SELECT current_database() AS database,current_user AS role,current_setting('server_version_num') AS version`;
    assert(identity.length===1&&identity[0].database===config.database&&identity[0].role===operator.user&&identity[0].version==='160015');
    const role=`${config.database}_runtime`;
    const secrets=await client.$queryRaw`SELECT rolpassword AS verifier,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls FROM pg_authid WHERE rolname=${role}`;
    assert(secrets.length===1&&Object.entries(secrets[0]).filter(([key])=>key!=='verifier').every(([,flag])=>flag===false));
    const auth=runtimeAuth(role,secrets[0].verifier);
    const parent=await privateConfigurationFile(path.join('.cache/scalability',config.database));
    const directory=path.join(parent,'pooler-'+randomUUID().replaceAll('-',''));
    await mkdir(directory,{recursive:false,mode:0o700});
    // Parent already has checked owner-only inherited ACL; verify before secrets.
    await privateConfigurationFile(directory);
    const files={config:path.join(directory,'pgbouncer.ini'),auth:path.join(directory,'auth.txt')};
    await writeFile(files.config,poolerSettings(config.database),{flag:'wx',mode:0o600});
    await writeFile(files.auth,auth,{flag:'wx',mode:0o600});
    await Promise.all(Object.values(files).map(privateConfigurationFile));
    stage='private_native_linux_mounts';
    const native=JSON.parse(await ownedCommand('python3',[toWslPath(path.join(root,'infra/scalability/install-pooler-secrets.py'))],JSON.stringify({run:metadata.project+'-'+path.basename(directory),config:poolerSettings(config.database),auth})));
    const nativeDirectory='/var/lib/university-project-test-pooler/'+metadata.project+'-'+path.basename(directory);
    assert(native.directory===nativeDirectory&&native.uid===10001&&native.gid===10001&&native.mode==='0400'&&native.existingFilesChanged===false);
    const secretMounts={config:nativeDirectory+'/pgbouncer.ini',auth:nativeDirectory+'/auth.txt'};
    const runtimeUrl=new URL(config.runtimeDatabaseUrl);runtimeUrl.port=fixtureTransactionPooler.port;
    const pooled={...config,connectionMode:'pgbouncer-transaction',pooler:fixtureTransactionPooler,runtimeDatabaseUrl:runtimeUrl.toString(),runtimeEnvironment:{...config.runtimeEnvironment,DATABASE_URL:runtimeUrl.toString()}};
    fixtureConfig(pooled);
    await writeFile(path.join(directory,'fixture-pooled.json'),JSON.stringify(pooled,null,2),{flag:'wx',mode:0o600});
    const environment=`COMPOSE_PROJECT_NAME=${metadata.project}-pooler\nSCALE_POOLER_IMAGE=${fixtureTransactionPooler.imageId}\nSCALE_DATABASE_NETWORK=${network}\nSCALE_POOLER_CONFIG_FILE=${secretMounts.config}\nSCALE_POOLER_AUTH_FILE=${secretMounts.auth}\n`;
    await writeFile(path.join(directory,'compose.env'),environment,{flag:'wx',mode:0o600});
    await writeFile(path.join(directory,'metadata.json'),JSON.stringify({schemaVersion:1,purpose:'isolated_fake_pooler',project:metadata.project+'-pooler',databaseProject:metadata.project,network,imageId:fixtureTransactionPooler.imageId,host:'127.0.0.1',port:16432,database:config.database,secretMounts,configuration:path.relative(root,files.config),auth:path.relative(root,files.auth),fixture:path.relative(root,path.join(directory,'fixture-pooled.json')),capacity:'Local component compatibility only; TLS/image advisories/whole-VPS capacity unverified'},null,2),{flag:'wx',mode:0o600});
    return {status:'prepared_private_runtime_only_scram',database:config.database,directory:path.relative(root,directory),migrationCredentialsInPooler:false,passwordOrVerifierPrinted:false,rolePasswordChanged:false};
  } finally {await client.$disconnect();}
}

function selfTest() {
  const database='mu_scale_contract_00000000';const text=poolerSettings(database);
  assert(text.startsWith('[databases]\n'+database+' = host=postgres port=5432 dbname='+database+'\n'));
  assert(!text.includes('* =')&&!text.includes(' user=')&&!text.includes('password='));
  assert(text.includes('auth_type = scram-sha-256')&&text.includes('pool_mode = transaction')&&text.includes('max_prepared_statements = 200'));
  for(const bad of ['postgres','owner_database','mu_scale_foo\n* = host=owner','mu_scale_foo password=bad'])assert.throws(()=>poolerSettings(bad));
  const verifier='SCRAM-SHA-256$4096:'+'A'.repeat(22)+'==$'+'A'.repeat(43)+'=:'+'A'.repeat(43)+'=';
  assert(runtimeAuth(database+'_runtime',verifier).startsWith('"'+database+'_runtime" "SCRAM-SHA-256$4096:'));
  for(const bad of ['plain-password','md5'+'a'.repeat(32),verifier+'\n"operator" "x"',verifier.replace('$4096:','$1:')])assert.throws(()=>runtimeAuth(database+'_runtime',bad));
  assert.throws(()=>runtimeAuth(database+'_migration',verifier));
  console.log(JSON.stringify({status:'passed',checks:13,scope:'pure mapping/SCRAM-format guards; no database/docker/credential access'}));
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  if(args.join()==='--self-test')selfTest();
  else if(args.length===6&&args[0]==='--config'&&args[2]==='--operator-config'&&args[4]==='--container-directory')prepare(args[1],args[3],args[5]).then(r=>console.log(JSON.stringify(r))).catch(()=>{console.error(JSON.stringify({status:'failed',stage,privateDiagnosticsSuppressed:true,noOwnerFallback:true}));process.exitCode=1;});
  else {console.error('Use --self-test or explicit --config/--operator-config/--container-directory');process.exitCode=1;}
}
