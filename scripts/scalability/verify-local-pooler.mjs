import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verificationPrisma} from './verification-workspace-boundary.mjs';
import {fixtureConfig,fixtureTransactionPooler} from './verify-local-database.mjs';
import {privateConfigurationFile} from './provision-local-database.mjs';
import {poolerSettings,runtimeAuth} from './prepare-local-pooler.mjs';

const root=path.resolve(fileURLToPath(new URL('../..',import.meta.url)));
let stage='arguments';
let PrismaClient;
function requireValue(condition) {assert(condition,'Owned pooler contract failed');}
export function denialKind(error,probe) {
  const code=error.code??error.errorCode;
  const expected={'wrong-password':'P1000','migration-role':'P1000','other-database':'P1003','admin-console':'P1010'}[probe];
  if(expected&&code===expected)return {kind:'prisma_code',code};
  // Prisma 6 can omit errorCode on a PgBouncer startup FATAL. Recognize only
  // the specific observed protocol denial; network/timeout errors never pass.
  if(error.name==='PrismaClientInitializationError'&&['wrong-password','migration-role'].includes(probe)&&/SASL authentication failed/i.test(error.message??''))return {kind:'sasl_authentication_denial'};
  if(error.name==='PrismaClientInitializationError'&&probe==='other-database'&&/no such database: postgres\b/i.test(error.message??''))return {kind:'unmapped_database_denial'};
  if(error.name==='PrismaClientInitializationError'&&probe==='admin-console'&&/not allowed/i.test(error.message??''))return {kind:'pooler_console_denial'};
  const failure=new Error('Expected probe-specific authentication/database denial');
  failure.denialSignals={initialization:error.name==='PrismaClientInitializationError',noSuchDatabase:/no such database/i.test(error.message??''),notAllowed:/not allowed/i.test(error.message??''),accessDenied:/access denied/i.test(error.message??'')};throw failure;
}
export function queueDenial(error) {
  return error.code==='P2010'&&/query_wait_timeout/.test(error.meta?.message??error.message??'');
}
export function inspectPooler(item,metadata,configuration,auth) {
  let checks=0;
  const check=(condition)=>{if(!condition){const error=new Error('Owned pooler inspection failed');error.inspectionCheck=checks+1;throw error;}checks++;};
  check(item.Image===fixtureTransactionPooler.imageId);
  check(item.Config.User==='10001:10001');
  check(item.Config.Labels['com.docker.compose.project']===metadata.project);
  check(item.Config.Labels['com.docker.compose.service']==='pooler');
  check(item.State.Status==='running');
  check(item.HostConfig.ReadonlyRootfs===true);
  check(JSON.stringify(item.HostConfig.CapDrop)===JSON.stringify(['ALL']));
  check(item.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
  check(item.HostConfig.Privileged===false);
  check(item.HostConfig.NanoCpus===150000000);
  check(item.HostConfig.Memory===67108864&&item.HostConfig.MemorySwap===67108864);
  check(item.HostConfig.PidsLimit===32);
  check(item.HostConfig.RestartPolicy.Name==='no');
  check(Object.keys(item.HostConfig.PortBindings??{}).length===0);
  check(Object.values(item.NetworkSettings.Ports??{}).every(value=>value===null));
  check(JSON.stringify(Object.keys(item.NetworkSettings.Networks))===JSON.stringify([metadata.network]));
  check(item.HostConfig.NetworkMode===metadata.network);
  check(item.HostConfig.PidMode===''&&item.HostConfig.IpcMode==='private');
  check(item.HostConfig.Devices===null||Array.isArray(item.HostConfig.Devices)&&item.HostConfig.Devices.length===0);
  check(item.HostConfig.Ulimits.length===1&&item.HostConfig.Ulimits[0].Name==='nofile'&&item.HostConfig.Ulimits[0].Soft===256&&item.HostConfig.Ulimits[0].Hard===256);
  check(item.Mounts.length===2);
  for(const [destination,source] of [['/run/secrets/pooler_config',configuration],['/run/secrets/pooler_auth',auth]]) {
    const mount=item.Mounts.find(value=>value.Destination===destination);
    check(mount?.Type==='bind'&&mount.Source===source&&mount.RW===false);
  }
  check(JSON.stringify(Object.keys(item.HostConfig.Tmpfs).sort())===JSON.stringify(['/run/pgbouncer','/tmp']));
  for(const options of Object.values(item.HostConfig.Tmpfs)) check(options==='uid=10001,gid=10001,mode=0700,size=8m');
  check(JSON.stringify(item.Config.Entrypoint)===JSON.stringify(['/usr/local/bin/pgbouncer']));
  check(JSON.stringify(item.Config.Cmd)===JSON.stringify(['/run/secrets/pooler_config']));
  check(item.HostConfig.LogConfig.Type==='local'&&item.HostConfig.LogConfig.Config['max-size']==='5m'&&item.HostConfig.LogConfig.Config['max-file']==='2');
  return checks;
}

function docker(args) {
  return new Promise((resolve,reject)=>{
    const child=spawn('wsl.exe',['-d','Ubuntu-24.04','--user','root','--exec','docker',...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
    let output='',bytes=0;const timer=setTimeout(()=>child.kill(),30000);
    child.stdout.on('data',value=>{bytes+=value.length;if(bytes>2*1024*1024)child.kill();else output+=value.toString();});
    child.stderr.resume();
    child.on('error',()=>{clearTimeout(timer);reject(new Error('Owned Docker inspection could not start'));});
    child.on('close',code=>{clearTimeout(timer);if(code===0)resolve(output);else reject(new Error('Owned Docker inspection failed'));});
  });
}

function prisma(url) {
  const parsed=new URL(url);parsed.searchParams.set('connection_limit','1');parsed.searchParams.set('pool_timeout','15');parsed.searchParams.set('connect_timeout','5');parsed.searchParams.set('socket_timeout','30');
  return new PrismaClient({datasources:{db:{url:parsed.toString()}},log:[]});
}
async function within(action,ms) {
  let timer;try{return await Promise.race([action,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Owned probe deadline exceeded')),ms);})]);}finally{clearTimeout(timer);}
}
async function heldConnections(url,count,waiter) {
  const clients=Array.from({length:count},()=>prisma(url));
  const ready=Array.from({length:count},()=>Promise.withResolvers());
  const release=Promise.withResolvers();
  // Attach rejection handlers immediately so a failed participant is evidence,
  // never an unhandled rejection hidden by the scheduling gate.
  const transactions=clients.map((client,index)=>client.$transaction(async tx=>{
    const rows=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
    ready[index].resolve(rows[0].pid);await release.promise;
  },{maxWait:15000,timeout:25000}).catch(error=>{ready[index].reject(error);throw error;}));
  const settled=Promise.allSettled(transactions);
  try {
    const pids=await within(Promise.all(ready.map(value=>value.promise)),15000);
    requireValue(new Set(pids).size===count);
    return await waiter(pids);
  } finally {
    release.resolve();
    const outcomes=await settled;
    await Promise.all(clients.map(client=>client.$disconnect()));
    requireValue(outcomes.every(value=>value.status==='fulfilled'));
  }
}

async function connectionProof(config) {
  let checks=0;
  const client=prisma(config.runtimeDatabaseUrl),migration=prisma(config.migrationDatabaseUrl);
  const role=config.database+'_runtime';
  const negativeDenials=[];
  try {
    const identity=await client.$queryRaw`SELECT current_database() AS database,current_user AS role`;
    requireValue(identity.length===1&&identity[0].database===config.database&&identity[0].role===role);checks++;
    const baseline=(await client.$queryRaw`SELECT current_setting('application_name') AS name`)[0].name;
    // Every parameter remains data; every transaction-local setting must expire.
    for(let index=0;index<12;index++) {
      const marker=`synthetic-pooler-${index}-'; SELECT pg_sleep(9); --`;
      await client.$transaction(async tx=>{
        const rows=await tx.$queryRaw`SELECT ${marker}::text AS marker, set_config('application_name',${'synthetic-pooler-'+index},true) AS name`;
        requireValue(rows[0].marker===marker&&rows[0].name==='synthetic-pooler-'+index);checks++;
      });
      const rows=await client.$queryRaw`SELECT current_setting('application_name') AS name`;
      requireValue(rows[0].name===baseline);checks++;
    }
    // User/role/other database/admin-console mappings cannot cross the pooler.
    for(const changed of ['wrong-password','migration-role','other-database','admin-console']) {
      stage='negative_'+changed.replaceAll('-','_');
      const url=new URL(config.runtimeDatabaseUrl);
      if(changed==='wrong-password')url.password='synthetic-invalid-password';
      if(changed==='migration-role') {const original=new URL(config.migrationDatabaseUrl);url.username=original.username;url.password=original.password;}
      if(changed==='other-database')url.pathname='/postgres';
      if(changed==='admin-console')url.pathname='/pgbouncer';
      const denied=prisma(url.toString());
      try{await assert.rejects(denied.$queryRaw`SELECT 1`,error=>{
        negativeDenials.push({case:changed,...denialKind(error,changed)});return true;
      });checks++;}finally{await denied.$disconnect();}
    }
    // Identical fake database and six independently constructed native clients.
    // Direct accepts six server transactions; the pooler admits five and fails
    // the sixth at its configured queue deadline. This is not throughput proof.
    const direct=new URL(config.runtimeDatabaseUrl);direct.port=fixtureTransactionPooler.upstreamPort;
    stage='real_connection_bound';
    const before=await heldConnections(direct.toString(),6,async pids=>pids.length);checks++;
    let queueErrorCode,elapsedMs;
    const after=await heldConnections(config.runtimeDatabaseUrl,5,async pids=>{
      const blocked=prisma(config.runtimeDatabaseUrl);const start=performance.now();
      try {
        await assert.rejects(blocked.$queryRaw`SELECT 1`,error=>{queueErrorCode=error.code;return queueDenial(error);});
        elapsedMs=Math.round(performance.now()-start);requireValue(elapsedMs>=9500&&elapsedMs<=18000);checks++;
        return pids.length;
      } finally{await blocked.$disconnect();}
    });checks++;
    const recovered=await client.$queryRaw`SELECT 1 AS value`;requireValue(recovered[0].value===1);checks++;
    const migrations=await migration.$queryRaw`SELECT migration_name,checksum FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
    requireValue(migrations.length===14);checks++;
    return {checks,negativeDenials,directHeldBackends:before,pooledHeldBackends:after,overflowDenied:true,overflowElapsedMs:elapsedMs,overflowErrorCode:queueErrorCode,preparedParameterAndLocalSettingIterations:12,directMigrationConnection:true,capacity:'Compatibility and bound only; no RPS, VPS or fleet capacity claim'};
  } finally{await Promise.all([client.$disconnect(),migration.$disconnect()]);}
}

export async function verify(directoryArgument) {
  PrismaClient=await verificationPrisma();
  stage='private_configuration';
  const directory=await privateConfigurationFile(directoryArgument);
  requireValue(/^pooler-[a-f0-9]{32}$/.test(path.basename(directory)));
  const metadata=JSON.parse(await readFile(await privateConfigurationFile(path.join(directory,'metadata.json')),'utf8'));
  requireValue(metadata.purpose==='isolated_fake_pooler'&&metadata.schemaVersion===1);
  requireValue(/^mu-scale-local-pg-\d{8}-[a-f0-9]{8}$/.test(metadata.databaseProject));
  requireValue(metadata.project===metadata.databaseProject+'-pooler'&&metadata.network===metadata.databaseProject+'_database');
  requireValue(metadata.imageId===fixtureTransactionPooler.imageId&&metadata.host==='127.0.0.1'&&metadata.port===16432);
  const config=fixtureConfig(JSON.parse(await readFile(await privateConfigurationFile(path.join(directory,'fixture-pooled.json')),'utf8')));
  requireValue(config.connectionMode==='pgbouncer-transaction'&&config.database===metadata.database);
  const configuration=await privateConfigurationFile(path.join(directory,'pgbouncer.ini'));
  const auth=await privateConfigurationFile(path.join(directory,'auth.txt'));
  requireValue(await readFile(configuration,'utf8')===poolerSettings(config.database));
  const authText=await readFile(auth,'utf8');
  const match=/^"([^"\n]+)" "([^"\n]+)"\n$/.exec(authText);
  requireValue(match!==null&&match[1]===config.database+'_runtime');
  requireValue(authText===runtimeAuth(match[1],match[2]));
  stage='owned_container';
  const containers=JSON.parse(await docker(['inspect',metadata.project+'-pooler-1']));requireValue(containers.length===1);
  const nativeDirectory='/var/lib/university-project-test-pooler/'+metadata.databaseProject+'-'+path.basename(directory);
  assert.deepEqual(metadata.secretMounts,{config:nativeDirectory+'/pgbouncer.ini',auth:nativeDirectory+'/auth.txt'});
  const item=containers[0];let checks=inspectPooler(item,metadata,metadata.secretMounts.config,metadata.secretMounts.auth);
  stage='owned_network';const networks=JSON.parse(await docker(['network','inspect',metadata.network]));
  requireValue(networks.length===1&&networks[0].Internal===true&&networks[0].Labels['com.docker.compose.project']===metadata.databaseProject);checks++;
  stage='kernel_limits';const cgroups=(await docker(['exec',item.Id,'sh','-c','cat /sys/fs/cgroup/cpu.max /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.swap.max /sys/fs/cgroup/pids.max'])).trim().split(/\r?\n/);
  assert.deepEqual(cgroups,['15000 100000','67108864','0','32']);checks++;
  stage='native_version';const version=await docker(['exec',item.Id,'/usr/local/bin/pgbouncer','--version']);
  requireValue(version.startsWith('PgBouncer 1.26.0\n')&&version.includes('OpenSSL 3.0.22'));checks++;
  stage='native_linkage';const linkage=await docker(['exec',item.Id,'ldd','/usr/local/bin/pgbouncer']);requireValue(!linkage.includes('not found'));checks++;
  // Check effective reads as the real non-root process; never emit mounted text.
  stage='effective_secret_mounts';requireValue((await docker(['exec',item.Id,'sh','-c','test -r /run/secrets/pooler_config && test -r /run/secrets/pooler_auth && test ! -w /run/secrets/pooler_auth && printf readable-readonly'])).trim()==='readable-readonly');checks++;
  const modes=(await docker(['exec',item.Id,'stat','-c','%u:%g %a','/run/secrets/pooler_auth','/run/secrets/pooler_config'])).trim().split(/\r?\n/);
  assert.deepEqual(modes,['10001:10001 400','10001:10001 400']);checks++;
  requireValue((await docker(['exec','--user','65534:65534',item.Id,'sh','-c','test ! -r /run/secrets/pooler_auth && test ! -r /run/secrets/pooler_config && printf unrelated-uid-denied'])).trim()==='unrelated-uid-denied');checks++;
  stage='real_pooling';const connections=await connectionProof(config);
  const result={status:'passed',checks:checks+connections.checks,inspectionChecks:checks,connectionChecks:connections.checks,imageId:item.Image,limits:{cpuCores:0.15,memoryBytes:67108864,swapBytes:0,pids:32},kernelCgroups:cgroups,networkInternal:true,dockerPortPublished:false,nonrootPrivateMountsReadOnly:true,version:'1.26.0',connections,tls:'Unencrypted local test transport only; cross-host verified TLS is an open gate',advisories:'OS/image scan remains open'};
  await writeFile(path.join(directory,`pooler-evidence-${Date.now()}.json`),JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  return result;
}

function selfTest() {
  const metadata={project:'mu-scale-local-pg-20261012-12345678-pooler',network:'mu-scale-local-pg-20261012-12345678_database'};
  const baseline={Image:fixtureTransactionPooler.imageId,Config:{User:'10001:10001',Labels:{'com.docker.compose.project':metadata.project,'com.docker.compose.service':'pooler'},Entrypoint:['/usr/local/bin/pgbouncer'],Cmd:['/run/secrets/pooler_config']},State:{Status:'running'},HostConfig:{ReadonlyRootfs:true,CapDrop:['ALL'],SecurityOpt:['no-new-privileges:true'],Privileged:false,NanoCpus:150000000,Memory:67108864,MemorySwap:67108864,PidsLimit:32,RestartPolicy:{Name:'no'},PortBindings:{},NetworkMode:metadata.network,PidMode:'',IpcMode:'private',Devices:[],Ulimits:[{Name:'nofile',Soft:256,Hard:256}],Tmpfs:{'/run/pgbouncer':'uid=10001,gid=10001,mode=0700,size=8m','/tmp':'uid=10001,gid=10001,mode=0700,size=8m'},LogConfig:{Type:'local',Config:{'max-size':'5m','max-file':'2'}}},NetworkSettings:{Ports:{},Networks:{[metadata.network]:{}}},Mounts:[{Type:'bind',Source:'/owned/config',Destination:'/run/secrets/pooler_config',RW:false},{Type:'bind',Source:'/owned/auth',Destination:'/run/secrets/pooler_auth',RW:false}]};
  const positive=inspectPooler(baseline,metadata,'/owned/config','/owned/auth');
  const dockerNullDevices=structuredClone(baseline);dockerNullDevices.HostConfig.Devices=null;
  assert.equal(inspectPooler(dockerNullDevices,metadata,'/owned/config','/owned/auth'),positive);
  const mutations=[value=>value.Image='sha256:'+'0'.repeat(64),value=>value.Config.User='0',value=>value.Config.Labels['com.docker.compose.project']='owner',value=>value.Config.Labels['com.docker.compose.service']='owner',value=>value.State.Status='exited',value=>value.HostConfig.ReadonlyRootfs=false,value=>value.HostConfig.CapDrop=[],value=>value.HostConfig.SecurityOpt=[],value=>value.HostConfig.Privileged=true,value=>value.HostConfig.NanoCpus=0,value=>value.HostConfig.Memory=0,value=>value.HostConfig.MemorySwap=-1,value=>value.HostConfig.PidsLimit=0,value=>value.HostConfig.PortBindings={'6432/tcp':[{}]},value=>value.NetworkSettings.Ports={'6432/tcp':[{HostIp:'0.0.0.0'}]},value=>value.NetworkSettings.Networks.other={},value=>value.HostConfig.NetworkMode='host',value=>value.HostConfig.PidMode='host',value=>value.HostConfig.IpcMode='host',value=>value.HostConfig.Devices=[{}],value=>value.HostConfig.Ulimits[0].Hard=0,value=>value.Mounts.push({Source:'/var/run/docker.sock'}),value=>value.Mounts[0].RW=true,value=>value.Mounts[1].Source='/owner/auth',value=>value.HostConfig.Tmpfs['/tmp']='size=1g',value=>value.HostConfig.Tmpfs['/owner']='size=1m',value=>value.Config.Entrypoint=['sh'],value=>value.Config.Cmd=['/owner/config'],value=>value.HostConfig.LogConfig.Type='json-file'];
  for(const mutation of mutations){const item=structuredClone(baseline);mutation(item);assert.throws(()=>inspectPooler(item,metadata,'/owned/config','/owned/auth'));}
  for(const probe of ['wrong-password','migration-role','other-database','admin-console']) {
    assert.throws(()=>denialKind({name:'PrismaClientInitializationError',errorCode:'P1001',message:'Cannot connect to database'},probe));
  }
  assert.deepEqual(denialKind({name:'PrismaClientInitializationError',message:'SASL authentication failed'},'wrong-password'),{kind:'sasl_authentication_denial'});
  assert.throws(()=>denialKind({name:'PrismaClientInitializationError',message:'SASL authentication failed'},'admin-console'));
  assert.deepEqual(denialKind({code:'P1003'},'other-database'),{kind:'prisma_code',code:'P1003'});
  assert.throws(()=>denialKind({code:'P1003'},'wrong-password'));
  assert.deepEqual(denialKind({name:'PrismaClientInitializationError',message:'no such database: postgres'},'other-database'),{kind:'unmapped_database_denial'});
  assert.throws(()=>denialKind({name:'PrismaClientInitializationError',message:'no such database: another'},'other-database'));
  assert.deepEqual(denialKind({name:'PrismaClientInitializationError',message:'not allowed'},'admin-console'),{kind:'pooler_console_denial'});
  assert.throws(()=>denialKind({name:'PrismaClientInitializationError',message:'not allowed'},'migration-role'));
  assert.equal(queueDenial({code:'P2010',meta:{message:'query_wait_timeout'}}),true);
  assert.equal(queueDenial({code:'P2010',message:'another SQL error'}),false);
  assert.equal(queueDenial({code:'P1001',message:'query_wait_timeout'}),false);
  return {status:'passed',checks:mutations.length+17,positiveInspectionAssertions:positive,scope:'pure inspection/denial mutations only; no Docker/database/private-file access'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length===3) (async()=>process.argv[2]==='--self-test'?selfTest():verify(process.argv[2]))().then(result=>console.log(JSON.stringify(result,null,2))).catch(error=>{console.error(JSON.stringify({status:'failed',stage,...(Number.isInteger(error.inspectionCheck)?{inspectionCheck:error.inspectionCheck}:{}),...(error.denialSignals?{denialSignals:error.denialSignals}:{}),privateDiagnosticsSuppressed:true}));process.exitCode=1;});
  else{console.error('Use --self-test or an explicitly owned private pooler directory');process.exitCode=1;}
}
