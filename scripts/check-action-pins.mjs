#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.github/workflows');
const files = fs.existsSync(root) ? fs.readdirSync(root).filter(x => /\.ya?ml$/i.test(x)).sort() : [];
const findings=[]; let refs=0;
for (const file of files) {
  const rel=path.posix.join('.github/workflows',file);
  const lines=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/);
  lines.forEach((line,i)=>{
    const m=line.match(/^\s*(?:-\s*)?uses:\s*([^\s#]+)/);
    if(!m)return;
    refs++;
    const value=m[1];
    if(value.startsWith('./')) return;
    const at=value.lastIndexOf('@');
    const pin=at>=0?value.slice(at+1):'';
    if(!/^[0-9a-f]{40}$/i.test(pin)) findings.push({path:rel,line:i+1,uses:value});
  });
}
const out={status:findings.length?'FAIL':'PASS',workflowFiles:files.length,externalUses:refs,findings};
const sink=findings.length?console.error:console.log;
sink(JSON.stringify(out,null,2));
if(findings.length) process.exit(1);
