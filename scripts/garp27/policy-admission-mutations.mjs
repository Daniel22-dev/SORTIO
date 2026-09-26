#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..'),V=path.join(ROOT,'vendor/garp-2.7-consolidated-r2');
const validator=path.join(V,'MASTER/TOOLS/validate-policy.mjs'),core=path.join(V,'MASTER/CONTRACTS/garp27-core.json'),inventory=path.join(V,'MASTER/INVENTORY/ecosystem-apps.json'),base=JSON.parse(fs.readFileSync(path.join(ROOT,'security/garp27/garp-policy.json')));
const req=['identity','requestApiAi','egress','files','dataLifecycle','release','inventory','securityHealth','incident','recovery'];
const cases=[
  ['positive',0,x=>x],
  ['unknown-app',1,x=>({...x,appId:'ghost-app'})],
  ['zero-version',1,x=>({...x,appVersion:'0.0.0'})],
  ['invalid-semver',1,x=>({...x,appVersion:'1.1'})],
  ['mode-only',1,x=>{for(const k of req)x[k]={mode:'explicit-app-policy'};return x}],
  ['placeholder',1,x=>{x.incident={...x.incident,response:'replace-with-owner-contact'};return x}]
];
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sortio-g02-'));let failed=0;const results=[];
try{for(const [id,expected,mut] of cases){const f=path.join(dir,id+'.json');fs.writeFileSync(f,JSON.stringify(mut(structuredClone(base)),null,2));const r=spawnSync(process.execPath,[validator,f,'--core',core,'--inventory',inventory],{encoding:'utf8'});const pass=r.status===expected;results.push({id,expectedExit:expected,actualExit:r.status,pass});if(!pass)failed++;}}finally{fs.rmSync(dir,{recursive:true,force:true})}
console.log(JSON.stringify({classification:'GARP27_G02_APP_POLICY_MUTATION_TEST',status:failed?'FAIL':'PASS',total:results.length,passed:results.length-failed,failed,results},null,2));
process.exit(failed?1:0);
