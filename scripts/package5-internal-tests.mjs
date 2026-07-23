import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const source=await readFile(path.join(DIST,'tests','tests.js'),'utf8');
const elements=new Map();
function element(){return{innerHTML:'',textContent:'0',addEventListener(){},classList:{add(){},remove(){},toggle(){}},style:{}}}
const document={querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector)}};
const store=new Map();
const localStorage={setItem:(k,v)=>store.set(String(k),String(v)),getItem:k=>store.get(String(k))??null,removeItem:k=>store.delete(String(k))};
async function fetchLocal(url){const clean=String(url).split('?')[0];const target=path.resolve(DIST,'tests',clean);if(!target.startsWith(DIST))return{ok:false,status:403,text:async()=>''};try{const text=await readFile(target,'utf8');return{ok:true,status:200,text:async()=>text}}catch{return{ok:false,status:404,text:async()=>''}}}
const context=vm.createContext({console,document,localStorage,fetch:fetchLocal,navigator:{userAgent:'SORTIO internal node test',clipboard:{writeText:async()=>{}}},window:{addEventListener(){}},setTimeout,clearTimeout,JSON,Math,Date,Promise,String,Number,Array,Set,Map});
vm.runInContext(`${source}\n;globalThis.__run=run;globalThis.__results=()=>results;`,context,{filename:'dist/tests/tests.js'});
await context.__run();
const results=context.__results();
const failed=results.filter(item=>item.state==='fail');
if(failed.length){console.error(failed);process.exit(1)}
console.log(`[internal-tests] ${results.length} kontrol: ${results.filter(item=>item.state==='pass').length} PASS, ${results.filter(item=>item.state==='warn').length} WARN, 0 FAIL.`);
