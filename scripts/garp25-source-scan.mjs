#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const skipDirs=new Set(['.git','node_modules','dist','dist-school-server','qa-results']);
const forbiddenNames=new Set(['private-key.pem','id_rsa','id_ed25519','.npmrc','.netrc']);
const forbiddenExt=new Set(['.pem','.key','.p12','.pfx','.p8','.jks','.keystore','.kdb','.ppk']);
const highConfidence=[
  [/-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/g,'private-key-block'],
  [/\bAIza[A-Za-z0-9_-]{20,}\b/g,'google-api-key'],
  [/\bghp_[A-Za-z0-9]{20,}\b/g,'github-token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,'github-fine-grained-pat'],
  [/\bgho_[A-Za-z0-9]{20,}\b/g,'github-oauth-token'],
  [/\bAKIA[0-9A-Z]{16}\b/g,'aws-access-key-id'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g,'openai-style-key'],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}\b/g,'anthropic-key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,'slack-token']
];
const genericAssigned=/(?:api[_-]?key|secret|passwd|password|token)\s*[:=]\s*["'][^"'\s]{12,}["']/ig;
const errors=[]; const info=[]; let files=0;
const posix=p=>p.split(path.sep).join('/');
const testLike=rel=>/(?:^|\/)(?:test-results|audit-evidence|security\/garp25\/tools)(?:\/|$)|(?:test|tests|regression|canary|negative|selftest)/i.test(rel);
function scanText(rel,text){
  for(const [re,label] of highConfidence){ re.lastIndex=0; if(re.test(text)){
    // Canonical GARP selftest deliberately carries synthetic credential-shaped probes.
    if(rel==='security/garp25/tools/selftest-garp251.mjs'){info.push(`synthetic-canonical-tool-probe:${rel}:${label}`); continue;}
    errors.push(`secret-pattern:${rel}:${label}`);
  }}
  genericAssigned.lastIndex=0;
  if(!testLike(rel) && genericAssigned.test(text)) errors.push(`secret-pattern:${rel}:assigned-secret-literal`);
}
function walk(dir,base=''){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const abs=path.join(dir,ent.name), rel=posix(path.join(base,ent.name));
    if(ent.isSymbolicLink()){errors.push(`symlink:${rel}`);continue;}
    if(ent.isDirectory()){
      if(skipDirs.has(ent.name)) continue;
      walk(abs,rel); continue;
    }
    if(!ent.isFile()) continue;
    files++;
    if(forbiddenNames.has(ent.name)) errors.push(`forbidden-name:${rel}`);
    if(ent.name==='.env'||ent.name.startsWith('.env.')) errors.push(`forbidden-env-file:${rel}`);
    if(forbiddenExt.has(path.extname(ent.name).toLowerCase())) errors.push(`forbidden-ext:${rel}`);
    const buf=fs.readFileSync(abs);
    if(buf.subarray(0,Math.min(buf.length,8192)).includes(0)){info.push(`binary-not-scanned:${rel}`);continue;}
    // ZIPs are separately unpacked and rescanned during final-package validation.
    if(path.extname(ent.name).toLowerCase()==='.zip'){info.push(`archive-deferred-to-final-validation:${rel}`);continue;}
    scanText(rel,buf.toString('utf8'));
  }
}
walk(root);
const unique=[...new Set(errors)], details=[...new Set(info)];
const out={status:unique.length?'FAIL':'PASS',scannerRevision:'sortio-garp25-source-high-confidence-v1',filesScanned:files,errors:unique,info:details};
console.log(JSON.stringify(out,null,2));
if(unique.length)process.exit(1);
