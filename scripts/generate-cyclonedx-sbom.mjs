#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const args=process.argv.slice(2), deployMode=args.includes('--deploy'), checkMode=args.includes('--check');
const positional=args.filter(a=>!a.startsWith('--'));
const outArg=positional[0]||(deployMode?'security/sbom/sortio-1.1.18-deployment.cdx.json':'security/sbom/sortio-1.1.18.cdx.json');
const deployRoot=path.resolve(positional[1]||'dist-school-server'), root=process.cwd();
const norm=s=>String(s||'').replace(/\\/g,'/'), sha256=b=>createHash('sha256').update(b).digest('hex');
const purl=(n,v)=>`pkg:npm/${n.startsWith('@')?n.split('/').map(encodeURIComponent).join('/'):encodeURIComponent(n)}@${encodeURIComponent(v)}`;
function output(bom){const text=JSON.stringify(bom,null,2)+'\n', out=path.resolve(outArg); if(checkMode){if(!fs.existsSync(out)||fs.readFileSync(out,'utf8')!==text){console.error(`FAIL: SBOM snapshot drift: ${out}`);process.exit(1)}console.log(`PASS: SBOM snapshot current: ${out}`)}else{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,text);console.log(`PASS: CycloneDX 1.7 SBOM: ${out} (${bom.components?.length||0} components)`)}}
function inferName(lp){const n=norm(lp),m='node_modules/',i=n.lastIndexOf(m);if(i<0)return'';const seg=n.slice(i+m.length).split('/').filter(Boolean);return seg[0]?.startsWith('@')?seg.slice(0,2).join('/'):(seg[0]||'')}
function intHash(v){const m=String(v||'').match(/^sha512-([A-Za-z0-9+/=]+)$/);return m?Buffer.from(m[1],'base64').toString('hex').toUpperCase():null}
if(!deployMode){
 const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8')), pkg=JSON.parse(fs.readFileSync('package.json','utf8')); const entries=[];
 for(const [lp,row] of Object.entries(lock.packages||{})){if(!lp||!row?.version||!norm(lp).includes('node_modules/'))continue;const name=inferName(lp),hash=intHash(row.integrity);if(!name||!hash)throw new Error(`Incomplete lock entry ${lp}`);entries.push({lp:norm(lp),row,name,ref:`${purl(name,row.version)}?path=${encodeURIComponent(norm(lp))}`,hash});}
 entries.sort((a,b)=>a.lp.localeCompare(b.lp)); const rootRef=`${purl(pkg.name,pkg.version)}?root=true`;
 const comps=entries.map(e=>({type:'library',name:e.name,version:String(e.row.version),purl:purl(e.name,e.row.version),'bom-ref':e.ref,scope:e.row.dev===true?'excluded':'required',hashes:[{alg:'SHA-512',content:e.hash}],properties:[{name:'ghrab:lockfilePath',value:e.lp}]}));
 const direct=Object.keys({...pkg.dependencies,...pkg.devDependencies,...pkg.optionalDependencies}).map(n=>entries.find(e=>e.lp===`node_modules/${n}`)?.ref).filter(Boolean).sort();
 output({'$schema':'https://cyclonedx.org/schema/bom-1.7.schema.json',bomFormat:'CycloneDX',specVersion:'1.7',version:1,metadata:{component:{type:'application',name:pkg.name,version:pkg.version,purl:purl(pkg.name,pkg.version),'bom-ref':rootRef}},components:comps,dependencies:[{ref:rootRef,dependsOn:direct}]});
}else{
 if(!fs.existsSync(deployRoot))throw new Error(`Deployment missing: ${deployRoot}`); const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
 function collect(paths){return paths.map(rel=>{const abs=path.join(deployRoot,rel);if(!fs.existsSync(abs))throw new Error(`Deployment component missing: ${rel}`);return{path:rel,sha256:sha256(fs.readFileSync(abs))}})}
 const groups=[
  {name:'ghrab-platform',version:'1.1.2',files:collect(['ghrab/ghrab-platform.js','ghrab/ghrab-platform.css','ghrab/ghrab-platform-manifest-1.1.2.json','ghrab/ghrab-artifact-envelope-v1.schema.json','ghrab/ghrab-app-registry-v2.schema.json'])},
  {name:'ghrab-error-reporter',version:'1',files:collect(['access/error-reporter.js','access/error-reporter.css','access/error-reporter-adapter.js','access/reporter-bootstrap.js'])}
 ];
 const components=groups.map(g=>{const agg=sha256(Buffer.from(g.files.map(f=>`${f.sha256}  ${f.path}\n`).join(''))).toUpperCase();return{type:'library',name:g.name,version:g.version,'bom-ref':`pkg:generic/${encodeURIComponent(g.name)}@${encodeURIComponent(g.version)}`,hashes:[{alg:'SHA-256',content:agg}],properties:g.files.map(f=>({name:`ghrab:fileSha256:${f.path}`,value:f.sha256}))}});
 output({'$schema':'https://cyclonedx.org/schema/bom-1.7.schema.json',bomFormat:'CycloneDX',specVersion:'1.7',version:1,metadata:{component:{type:'application',name:pkg.name,version:pkg.version}},components});
}
