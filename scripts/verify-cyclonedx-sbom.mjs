#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const [sbomArg='security/sbom/ludus.cdx.json']=process.argv.slice(2);
const root=process.cwd(), lock=JSON.parse(fs.readFileSync('package-lock.json','utf8')), bom=JSON.parse(fs.readFileSync(sbomArg,'utf8'));
const norm=s=>String(s||'').replace(/\\/g,'/');
const inferName=lp=>{const n=norm(lp),m='node_modules/',i=n.lastIndexOf(m);if(i<0)return'';const seg=n.slice(i+m.length).split('/').filter(Boolean);return seg[0]?.startsWith('@')?seg.slice(0,2).join('/'):(seg[0]||'')};
const expected=[];
for(const [lp,row] of Object.entries(lock.packages||{})){if(!lp||!row?.version||!norm(lp).includes('node_modules/'))continue;expected.push({path:norm(lp),name:inferName(lp),version:String(row.version),dev:row.dev===true,integrity:String(row.integrity||'')})}
const errors=[];const byPath=new Map();
for(const c of bom.components||[]){const prop=(c.properties||[]).find(p=>p.name==='ghrab:lockfilePath');if(!prop){errors.push(`missing-lockfilePath:${c.name}`);continue;}if(byPath.has(prop.value))errors.push(`duplicate:${prop.value}`);byPath.set(prop.value,c)}
for(const e of expected){const c=byPath.get(e.path);if(!c){errors.push(`missing:${e.path}`);continue;}if(c.name!==e.name)errors.push(`name:${e.path}:${c.name}:${e.name}`);if(String(c.version)!==e.version)errors.push(`version:${e.path}`);if(c.scope!==(e.dev?'excluded':'required'))errors.push(`scope:${e.path}:${c.scope}`);const m=e.integrity.match(/^sha512-(.+)$/);const hex=m?Buffer.from(m[1],'base64').toString('hex').toUpperCase():null;const h=(c.hashes||[]).find(x=>x.alg==='SHA-512')?.content;if(!hex||h!==hex)errors.push(`sha512:${e.path}`);const installed=path.join(root,e.path,'package.json');if(fs.existsSync(installed)){const p=JSON.parse(fs.readFileSync(installed,'utf8'));if(p.name!==e.name||String(p.version)!==e.version)errors.push(`node-modules-crosscheck:${e.path}`)}}
for(const k of byPath.keys())if(!expected.some(e=>e.path===k))errors.push(`extra:${k}`);
if(errors.length){console.error(JSON.stringify({status:'FAIL',expected:expected.length,actual:byPath.size,errors},null,2));process.exit(1)}
console.log(JSON.stringify({status:'PASS',expected:expected.length,actual:byPath.size,nodeModulesCrossCheck:expected.filter(e=>fs.existsSync(path.join(root,e.path,'package.json'))).length},null,2));
