#!/usr/bin/env node
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('src/access/error-reporter.js','utf8');
const start=source.indexOf('function sanitizeTechnicalText');
if(start<0) throw new Error('sanitizeTechnicalText not found');
let brace=source.indexOf('{',start), depth=0, end=-1;
for(let i=brace;i<source.length;i++){if(source[i]==='{')depth++;else if(source[i]==='}'&&--depth===0){end=i+1;break;}}
if(end<0) throw new Error('sanitizeTechnicalText extraction failed');
const fnSource=source.slice(start,end);
const clipText=(value,max=5000)=>String(value??'').slice(0,max);
const ctx={clipText};vm.createContext(ctx);vm.runInContext(`${fnSource}; globalThis.__sanitize=sanitizeTechnicalText;`,ctx);
// Canary values are assembled at runtime so the repository's own secret scanner does not
// have to whitelist credential-looking literals inside this negative-control source file.
const email=['teacher','example.invalid'].join('@');
const bearerToken=['ABCDE','FGHIJ','KLMNO','PQRST','UVWXYZ','01234','56789'].join('');
const googleProbe=['AI','za','A'.repeat(30)].join('');
const accessToken=['TOP','SECRET','TOKEN','VALUE','12345','67890'].join('');
const privatePrompt=['STUDENT','PRIVATE','CONTENT','938471'].join('_');
const studentName=['Jane','Doe'].join(' ');
const canaries=[email,['Bear','er ',bearerToken].join(''),['api_','key=',googleProbe].join(''),['access_','to','ken','=',accessToken].join(''),['pro','mpt="',privatePrompt,'"'].join(''),['student data=',studentName,' 4A8 private answer'].join('')];
const out=ctx.__sanitize(canaries.join(' | '),2000);
const forbidden=[email,bearerToken,googleProbe,accessToken,privatePrompt,studentName+' 4A8 private answer'];
const leaked=forbidden.filter(x=>out.includes(x));
if(leaked.length){console.error(JSON.stringify({status:'FAIL',negativeControl:'SHNC-08',leaked},null,2));process.exit(1)}
console.log(JSON.stringify({status:'PASS',negativeControl:'SHNC-08',sanitized:true},null,2));
