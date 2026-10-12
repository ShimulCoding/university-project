import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toWslPath } from './prepare-local-container.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const image='postgres:16.15-bookworm@sha256:0ea6700a3b4f0ae6ce746519073558aed4d88a79d8d07622a9a644946c7319c4';
export function verifyInspection(value,project,port) {
  assert.equal(value.Config.Image,image,'Unexpected database image');
  assert.equal(value.Config.User,'999:999','Database must run nonroot');
  assert.equal(value.Config.Labels['com.docker.compose.project'],project,'Refusing another project');
  assert.equal(value.Config.Labels['com.docker.compose.service'],'postgres');
  assert.equal(value.State.Status,'running');assert.equal(value.State.Health.Status,'healthy');
  assert.equal(value.HostConfig.ReadonlyRootfs,true);
  assert.deepEqual(value.HostConfig.CapDrop,['ALL']);
  assert(value.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
  assert.equal(value.HostConfig.Privileged,false);
  assert.equal(value.HostConfig.NanoCpus,750000000);
  assert.equal(value.HostConfig.Memory,768*1024*1024);
  assert.equal(value.HostConfig.MemorySwap,value.HostConfig.Memory);
  assert.equal(value.HostConfig.PidsLimit,128);
  assert.deepEqual(value.HostConfig.PortBindings,{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:String(port)}]});
  assert.deepEqual(value.NetworkSettings.Ports,{'5432/tcp':null},'Internal Docker network must retain no effective public port');
  assert.equal(Object.keys(value.NetworkSettings.Networks).length,1);
  assert.equal(value.HostConfig.RestartPolicy.Name,'no');
  assert.equal(value.Mounts.filter(item=>item.Type==='volume').length,1);
  assert.equal(value.Mounts.find(item=>item.Type==='volume').Name,`${project}_postgres_data`);
  assert(!value.Mounts.some(item=>item.Source?.includes('docker.sock')));
  return 21;
}
function docker(args) {
  const result=spawnSync('wsl',['-d','Ubuntu-24.04','-u','root','--','docker',...args],{encoding:'utf8',timeout:30000,maxBuffer:5*1024*1024});
  if(result.status!==0) throw new Error('Local Docker verification command failed; private diagnostics withheld');
  return result.stdout;
}
function selfTest() {
  const project='mu-scale-local-pg-20261012-12345678';const port=15432;
  const value={Config:{Image:image,User:'999:999',Labels:{'com.docker.compose.project':project,'com.docker.compose.service':'postgres'}},State:{Status:'running',Health:{Status:'healthy'}},HostConfig:{ReadonlyRootfs:true,CapDrop:['ALL'],SecurityOpt:['no-new-privileges:true'],Privileged:false,NanoCpus:750000000,Memory:805306368,MemorySwap:805306368,PidsLimit:128,PortBindings:{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:String(port)}]},RestartPolicy:{Name:'no'}},NetworkSettings:{Networks:{database:{}},Ports:{'5432/tcp':null}},Mounts:[{Type:'volume',Name:`${project}_postgres_data`}]};
  assert.equal(verifyInspection(value,project,port),21);
  const unsafe=[v=>v.Config.Image='postgres:latest',v=>v.Config.User='0',v=>v.Config.Labels['com.docker.compose.project']='owner',v=>v.State.Health.Status='unhealthy',v=>v.HostConfig.ReadonlyRootfs=false,v=>v.HostConfig.CapDrop=[],v=>v.HostConfig.SecurityOpt=[],v=>v.HostConfig.Privileged=true,v=>v.HostConfig.NanoCpus=0,v=>v.HostConfig.Memory=0,v=>v.HostConfig.MemorySwap=-1,v=>v.HostConfig.PidsLimit=0,v=>v.HostConfig.PortBindings['5432/tcp'][0].HostIp='0.0.0.0',v=>v.HostConfig.PortBindings['5433/tcp']=[],v=>v.NetworkSettings.Ports['5432/tcp']=[{HostIp:'0.0.0.0',HostPort:String(port)}],v=>v.NetworkSettings.Networks.other={},v=>v.HostConfig.RestartPolicy.Name='always',v=>v.Mounts[0].Name='owner_data',v=>v.Mounts.push({Type:'bind',Source:'/var/run/docker.sock'})];
  for(const mutate of unsafe) {const copy=structuredClone(value);mutate(copy);assert.throws(()=>verifyInspection(copy,project,port));}
  console.log('Local-container inspection: 20 baseline/negative contracts passed; no Docker command or credential access.');
}
function verify(directoryArgument) {
  const directory=realpathSync(resolve(directoryArgument));
  const suffix=relative(realpathSync(join(root,'.cache','scalability')),directory);
  if(isAbsolute(suffix)||suffix.startsWith('..')||!/^local-pg-\d{8}-[a-f0-9]{8}$/.test(suffix)) throw new Error('Refusing nonowned fixture directory');
  const metadata=JSON.parse(readFileSync(join(directory,'metadata.json'),'utf8'));
  assert.equal(metadata.project,`mu-scale-${suffix}`);assert.equal(metadata.host,'127.0.0.1');
  const id=docker(['compose','--env-file',toWslPath(join(directory,'compose.env')),'-f',toWslPath(join(root,'infra/scalability/compose.database.yml')),'ps','-q','postgres']).trim();
  assert(/^[a-f0-9]{64}$/.test(id),'Expected exactly one owned container');
  const inspection=JSON.parse(docker(['inspect',id]));assert.equal(inspection.length,1);
  const checks=verifyInspection(inspection[0],metadata.project,metadata.port);
  const network=Object.keys(inspection[0].NetworkSettings.Networks)[0];
  assert.equal(JSON.parse(docker(['network','inspect',network]))[0].Internal,true);
  assert.equal(docker(['exec',id,'postgres','--version']).trim(),'postgres (PostgreSQL) 16.15 (Debian 16.15-1.pgdg12+2)');
  const cgroups=docker(['exec',id,'sh','-c','cat /sys/fs/cgroup/cpu.max /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.swap.max /sys/fs/cgroup/pids.max']).trim().split(/\r?\n/);
  assert.deepEqual(cgroups,['75000 100000','805306368','0','128']);
  const images=JSON.parse(docker(['image','inspect',image]));assert.equal(images[0].Architecture,'amd64');assert.equal(images[0].Os,'linux');
  assert(images[0].RepoDigests.includes(`postgres@${image.split('@')[1]}`));
  const result={status:'passed',checks:checks+10,project:metadata.project,port:metadata.port,image,imageId:images[0].Id,postgresVersion:'16.15',limits:{cpuCores:0.75,memoryBytes:805306368,swapBytes:0,pids:128},kernelCgroups:cgroups,networkInternal:true,loopbackPortRequested:true,dockerPublishEffective:false,runsNonroot:true,composeSha256:createHash('sha256').update(readFileSync(join(root,'infra/scalability/compose.database.yml'))).digest('hex'),capacity:'Component controls verified only; no whole-VPS/application capacity measurement',advisories:'Server release patches verified from official release notes; image/OS CVE scan still pending'};
  const output=join(directory,`container-evidence-${Date.now()}.json`);if(existsSync(output)) throw new Error('Refusing evidence overwrite');
  writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log(JSON.stringify(result));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {if(process.argv[2]==='--self-test') selfTest();else if(process.argv.length===3) verify(process.argv[2]);else throw new Error('Expected an owned fixture directory or --self-test');}
  catch {console.error('Local-container verification failed; private diagnostics withheld.');process.exitCode=1;}
}
