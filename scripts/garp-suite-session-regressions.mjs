#!/usr/bin/env node
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { findChromiumPath } from './chromium-path.mjs';

const root=path.resolve('.');
const dist=path.join(root,'dist');
const outDir=path.join(root,'test-results');
const outPath=path.join(outDir,'garp-suite-session-regressions.json');
const pkg=JSON.parse(await fsp.readFile(path.join(root,'package.json'),'utf8'));
const consumer=JSON.parse(await fsp.readFile(path.join(root,'ghrab-platform.consumer.json'),'utf8'));
if(!fs.existsSync(path.join(dist,'index.html')))throw new Error('Chybí dist/index.html. Nejprve spusťte npm run build.');
if(consumer.platform?.version!=='1.1.2')throw new Error(`Suite-session regression vyžaduje Platform 1.1.2, nalezeno ${consumer.platform?.version||'missing'}.`);
await fsp.mkdir(outDir,{recursive:true});

const runId=randomUUID().replaceAll('-','').slice(0,16);
const baseCanary=`GARP-STUDENT-CANARY-SORTIO-${pkg.version}-${runId}`;
const syntheticEmail=`garp.student.canary.${runId}@example.invalid`;
const SUITE_KEY='ghrab.platform.suite-session-generation.v1';
const SEEN_KEY='ghrab.sortio.suite-session-seen.v1';
const STATE_KEY='ghrab.sortio.suite-session-state.v1';
const MIGRATION_DONE_KEY='ghrab.sortio.migration.p2-storage-namespace-v1.done';
const MIGRATION_BACKUP_KEY='ghrab.sortio.migration.p2-storage-namespace-v1.backup';
const SETTINGS_KEY='ghrab.sortio.settings.v2';
const THEME_KEY='ghrab.sortio.theme.v1';
const CONTENT_KEYS=[
  'ghrab.sortio.data.v5','ghrab.sortio.data.v5.last-good','ghrab.sortio.data.v5.pre-import','ghrab.sortio.data.v5.corrupt',
  'ghrab.sortio.data.v4','ghrab.sortio.data.v3','ghrab.sortio.data.v2',MIGRATION_BACKUP_KEY,
];
const LEGACY_KEYS=['sortio.data.v5','sortio.data.v5.last-good','sortio.data.v5.pre-import','sortio.data.v5.corrupt','sortio.data.v4','sortio.data.v3','sortio.data.v2'];
const cases=[];
function pass(name,detail={}){cases.push({name,status:'PASS',...detail});}
function fail(name,error,detail={}){cases.push({name,status:'FAIL',error:String(error?.stack||error),...detail});}
function assert(ok,message){if(!ok)throw new Error(message);}
function syntheticData(canary){
  const now=new Date().toISOString();
  return {schema:'sortio-data-v5',version:5,selectedClassId:'class-suite-canary',classes:[{id:'class-suite-canary',name:canary,schoolYear:'2026/27',archived:false,demo:false,createdAt:now,updatedAt:now,students:[{id:'student-suite-canary',firstName:'Synteticky',lastName:'Canary',displayName:'Synteticky Canary',key:'synteticky canary',present:true,archived:false,groupLevel:'B',frontPreference:false,createdAt:now,updatedAt:now}],drawState:{remainingIds:['student-suite-canary'],cycle:0,lastDraw:null},drawHistory:[],engagementHistory:[],currentGroups:[],groupHistory:[],lastGroupConfig:null,groupRules:{together:[],apart:[],pins:{}},roleCatalog:['Mluvčí'],topicCatalog:[],roleHistory:[],seatingPlan:{template:'rows',rows:2,columns:2,seats:[],updatedAt:null},toolState:{scores:[],decisionOptions:[],updatedAt:null}}],aliases:{suite:canary},createdAt:now,updatedAt:now,integrity:{saveCount:1,lastSavedAt:now}};
}

const appSource=await fsp.readFile(path.join(dist,'index.html'),'utf8');
const appJs=(await fsp.readFile(path.join(dist,'app.js'),'utf8')).replace(/<\/script/gi,'<\\/script');
const platformCss=await fsp.readFile(path.join(dist,'ghrab','ghrab-platform.css'),'utf8');
const accessCss=await fsp.readFile(path.join(dist,'access','access-gate.css'),'utf8');
const platformJs=(await fsp.readFile(path.join(dist,'ghrab','ghrab-platform.js'),'utf8'))
  .replace("new URL('./ghrab/ghrab-platform.js', location.href)","new URL('https://example.test/app/ghrab/ghrab-platform.js')");
function memoryPrelude(seed={}){
  return `<script data-ghrab-suite-test-prelude>(()=>{const __seed=${JSON.stringify(seed)};class GarpStorage{constructor(initial){this.m=new Map(Object.entries(initial||{}).map(([k,v])=>[String(k),String(v)]))}get length(){return this.m.size}key(i){return [...this.m.keys()][i]??null}getItem(k){k=String(k);return this.m.has(k)?this.m.get(k):null}setItem(k,v){this.m.set(String(k),String(v))}removeItem(k){this.m.delete(String(k))}clear(){this.m.clear()}};Object.defineProperty(window,'Storage',{value:GarpStorage,configurable:true});Object.defineProperty(window,'localStorage',{value:new GarpStorage(__seed),configurable:true});Object.defineProperty(window,'sessionStorage',{value:new GarpStorage(),configurable:true});window.__garpRawStorage=Object.freeze({getItem:GarpStorage.prototype.getItem,setItem:GarpStorage.prototype.setItem,removeItem:GarpStorage.prototype.removeItem,key:GarpStorage.prototype.key});window.matchMedia=window.matchMedia||(()=>({matches:false,addEventListener(){},removeEventListener(){}}));window.alert=()=>{};window.confirm=()=>true;window.prompt=()=>'';window.__suiteErrors=[];addEventListener('error',e=>window.__suiteErrors.push(String(e.error?.stack||e.message||e.error||'error')));addEventListener('unhandledrejection',e=>window.__suiteErrors.push(String(e.reason?.stack||e.reason||'rejection')));try{if(globalThis.ServiceWorkerContainer?.prototype?.register){globalThis.ServiceWorkerContainer.prototype.register=async()=>({update:async()=>{},addEventListener:()=>{},installing:null,waiting:null,active:null});}}catch{}})();<\/script>`;
}
function transformAppHtml(seed={}){
  let html=appSource
    .replace(/data-ghrab-access=["']checking["']/gi,'data-ghrab-access="granted"')
    .replace(/<script\b(?=[^>]*data-ghrab-access-bootstrap)[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/type=["']application\/ghrab-protected["']/gi,'type="text/javascript"')
    .replace(/\sdata-ghrab-protected(?:=["'][^"']*["'])?/gi,'')
    .replace(/<meta\b[^>]*http-equiv=["'](?:refresh|content-security-policy)["'][^>]*>/gi,'')
    .replace(/<link\b[^>]*(?:rel=["']manifest["']|rel=["']icon["']|rel=["']apple-touch-icon["'])[^>]*>/gi,'')
    .replace(/<link\b[^>]*href=["']\.\/access\/access-gate\.css["'][^>]*>/gi,`<style data-garp-inline-access>${accessCss}</style>`)
    .replace(/<link\b[^>]*href=["']\.\/ghrab\/ghrab-platform\.css["'][^>]*>/gi,`<style data-garp-inline-platform>${platformCss}</style>`)
    .replace(/<script\b[^>]*src=["']\.\/ghrab\/ghrab-platform\.js["'][^>]*><\/script>/gi,()=>`<script data-garp-inline-platform>${platformJs}<\/script>`)
    .replace(/<script\b[^>]*src=["']\.\/app\.js["'][^>]*><\/script>/gi,()=>`<script data-garp-inline-app>${appJs}<\/script>`);
  return html.replace(/<head\b[^>]*>/i,m=>`${m}\n${memoryPrelude(seed)}`);
}

async function waitJson(url,options={}){for(let i=0;i<300;i++){try{const r=await fetch(url,options);if(r.ok)return await r.json();}catch{}await sleep(40);}throw new Error(`HTTP/CDP timeout: ${url}`);}
class Cdp{
  constructor(url){this.ws=new WebSocket(url);this.seq=0;this.pending=new Map();this.ready=new Promise((resolve,reject)=>{this.ws.onopen=resolve;this.ws.onerror=reject;});this.ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};}
  async call(method,params={}){await this.ready;return new Promise((resolve,reject)=>{const id=++this.seq;const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error(`CDP timeout ${method}`));},20000);this.pending.set(id,{resolve,reject,timer});this.ws.send(JSON.stringify({id,method,params}));});}
  async eval(expression){const r=await this.call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}
  close(){try{this.ws.close();}catch{}}
}
async function blankPage(){const target=await waitJson(`http://127.0.0.1:${debugPort}/json/new?about:blank`,{method:'PUT'});const c=new Cdp(target.webSocketDebuggerUrl);await c.call('Runtime.enable');await c.call('Page.enable');return c;}
async function appPage(seed={}){const c=await blankPage();const tree=await c.call('Page.getFrameTree');await c.call('Page.setDocumentContent',{frameId:tree.frameTree.frame.id,html:transformAppHtml(seed)});return c;}
async function waitEval(client,expression,predicate=value=>Boolean(value),label='condition',tries=300){let last;for(let i=0;i<tries;i++){try{last=await client.eval(expression);if(predicate(last))return last;}catch{}await sleep(40);}throw new Error(`Timeout waiting for ${label}; last=${JSON.stringify(last)}`);}
async function waitAppReady(client){return waitEval(client,"document.readyState==='complete'&&document.documentElement.dataset.appReady==='true'",Boolean,'SORTIO appReady');}
async function waitSuiteEnd(client,expected='ended'){return waitEval(client,`document.documentElement.dataset.sortioSuiteSession||''`,v=>v===expected,`suite state ${expected}`);}
async function storageDump(client){return client.eval(`(()=>{const out={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);out[k]=localStorage.getItem(k)}return out})()`);}
function makeGeneration(label){return `garp-${label}-${Date.now()}-${randomUUID().replaceAll('-','').slice(0,8)}`;}
async function setGenerationSilently(app,generation){return app.eval(`(()=>{localStorage.setItem(${JSON.stringify(SUITE_KEY)},${JSON.stringify(generation)});return localStorage.getItem(${JSON.stringify(SUITE_KEY)})})()`);}
async function dispatchSuiteStorageSignal(app,generation){return app.eval(`(()=>{const event=new StorageEvent('storage',{key:${JSON.stringify(SUITE_KEY)},oldValue:null,newValue:${JSON.stringify(generation)},url:'https://ai-studio.synthetic.invalid/'});dispatchEvent(event);return true})()`);}
async function coordinatorEndEquivalent(app,label){const generation=makeGeneration(label);await setGenerationSilently(app,generation);await dispatchSuiteStorageSignal(app,generation);return{ok:true,generation};}
async function seedOpenApp(app,canary){
  return app.eval(`(()=>{App.data=defaultData();const student=makeStudent('Synteticky','Canary');const c=createClass({name:${JSON.stringify(canary)},schoolYear:'2026/27',students:[student]});c.name=${JSON.stringify(canary+'-updated')};saveData({render:false,event:'suite_seed_second_write'});const storage=safeStorage();const text=JSON.stringify(App.data);storage.setItem(RECOVERY_KEY,text);storage.setItem(CORRUPT_KEY,${JSON.stringify(canary)});for(const key of LEGACY_DATA_KEYS)storage.setItem(key,text);storage.setItem(SUITE_MIGRATION_BACKUP_KEY,JSON.stringify({schema:'ghrab-storage-migration-backup-v1',appId:'sortio',entries:[{legacy:'sortio.data.v5',canonical:'ghrab.sortio.data.v5',value:${JSON.stringify(canary)}}]}));storage.setItem(SETTINGS_KEY,JSON.stringify({theme:'dark',motion:true,confirmDestructive:true,lastRoute:'overview',suiteKeep:'KEEP'}));localStorage.setItem(${JSON.stringify(THEME_KEY)},'dark');return {classCount:App.data.classes.length,storageCanary:[...Array(localStorage.length)].map((_,i)=>localStorage.getItem(localStorage.key(i))||'').join('\\n').includes(${JSON.stringify(canary)})}})()`);
}
function cleanupSnapshotOk(dump,canary){
  const remainingContent=[...CONTENT_KEYS,...LEGACY_KEYS].filter(key=>dump[key]!=null);
  const anyCanary=Object.values(dump).some(value=>String(value||'').includes(canary));
  return {ok:remainingContent.length===0&&!anyCanary,remainingContent,anyCanary};
}
function lifecycleSnapshot(dump,generation){
  let state=null;try{state=JSON.parse(dump[STATE_KEY]||'null')}catch{}
  return {suiteSignal:dump[SUITE_KEY]===generation,observed:state?.observedGeneration===generation,completed:state?.cleanupCompletedGeneration===generation,acknowledged:dump[SEEN_KEY]===generation,state};
}

const debugPort=14500+(process.pid%700);
const profile=`/tmp/sortio-suite-session-${process.pid}`;
fs.rmSync(profile,{recursive:true,force:true});
const chrome=spawn(findChromiumPath(),['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--disable-background-networking','--disable-extensions','--no-first-run','--mute-audio','--remote-allow-origins=*',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:'ignore',detached:true});
const clients=[];
try{
  await waitJson(`http://127.0.0.1:${debugPort}/json/version`);

  // 1) Open child: externally simulated suite storage signal reaches the live child.
  try{
    const app=await appPage();clients.push(app);await waitAppReady(app);
    assert(await app.eval("window.GHRAB_PLATFORM?.session?.contract==='ghrab-suite-session-v1'"),'Platforma 1.1.2 neposkytla suite-session kontrakt.');
    const canary=`${baseCanary}-OPEN`;const seeded=await seedOpenApp(app,canary);assert(seeded.storageCanary,'Canary nebyl vložen do skutečných writerů aplikace.');
    const end=await coordinatorEndEquivalent(app,'open-child');
    await waitSuiteEnd(app,'ended');
    await waitEval(app,`localStorage.getItem(${JSON.stringify(SEEN_KEY)})===${JSON.stringify(end.generation)}`,Boolean,'SORTIO ack');
    const dump=await storageDump(app);const clean=cleanupSnapshotOk(dump,canary);const lifecycle=lifecycleSnapshot(dump,end.generation);
    assert(clean.ok,`Po open-child cleanupu zůstal obsah: ${JSON.stringify(clean)}`);
    assert(lifecycle.suiteSignal&&lifecycle.observed&&lifecycle.completed&&lifecycle.acknowledged,`F-02 stavy nejsou kompletní: ${JSON.stringify(lifecycle)}`);
    assert(dump[SETTINGS_KEY]!=null,'Suite cleanup chybně odstranil neobsahové nastavení.');
    assert(dump[MIGRATION_DONE_KEY]!=null,'Suite cleanup chybně odstranil migration done marker.');
    pass('open-child-suite-end',{generation:end.generation,clean,lifecycle,settingsPreserved:true,migrationMarkerPreserved:true,signalTransport:'synthetic StorageEvent in Chromium; native same-origin navigation blocked by administrator policy'});
  }catch(error){fail('open-child-suite-end',error);}

  // 2) Delayed-open replay: tombstone and real legacy storage exist before Platform/app boot.
  try{
    const canary=`${baseCanary}-DELAYED`;const data=JSON.stringify(syntheticData(canary));const generation=makeGeneration('delayed-open');
    const seed={
      [SUITE_KEY]:generation,
      'sortio.data.v5':data,'sortio.data.v5.last-good':data,'sortio.data.v5.pre-import':data,'sortio.data.v5.corrupt':canary,
      'sortio.settings.v2':JSON.stringify({theme:'dark',motion:true,confirmDestructive:true,lastRoute:'overview',suiteKeep:'KEEP'}),
    };
    const app=await appPage(seed);clients.push(app);await waitAppReady(app);
    await waitEval(app,`localStorage.getItem(${JSON.stringify(SEEN_KEY)})===${JSON.stringify(generation)}`,Boolean,'delayed replay ack');
    let dump=await storageDump(app);let clean=cleanupSnapshotOk(dump,canary);let lifecycle=lifecycleSnapshot(dump,generation);
    assert(clean.ok,'Delayed-open replay neodstranil canary/migration backup.');assert(lifecycle.observed&&lifecycle.completed&&lifecycle.acknowledged,'Delayed replay nedokončil observed/completed/ack.');
    const completedAt=lifecycle.state?.cleanupCompletedAt;assert(completedAt,'Chybí cleanupCompletedAt po delayed replay.');
    const reloaded=await appPage(dump);clients.push(reloaded);await waitAppReady(reloaded);await sleep(120);
    dump=await storageDump(reloaded);lifecycle=lifecycleSnapshot(dump,generation);
    assert(lifecycle.state?.cleanupCompletedAt===completedAt,'Nový boot z persistovaného stavu zbytečně zopakoval již potvrzený cleanup.');
    pass('delayed-open-replay',{generation,clean,lifecycle,reloadDidNotRepeatCleanup:true,persistenceAcrossReload:'post-cleanup storage snapshot reinjected into a fresh Chromium document because origin navigation is policy-blocked'});
  }catch(error){fail('delayed-open-replay',error);}

  // 3) Multi-tab equivalent: two independent stale browser contexts receive the same generation; stale writer is blocked before event delivery.
  try{
    const appA=await appPage();clients.push(appA);await waitAppReady(appA);const canary=`${baseCanary}-MULTITAB`;await seedOpenApp(appA,canary);
    const baseline=await storageDump(appA);const appB=await appPage(baseline);clients.push(appB);await waitAppReady(appB);
    const generation=makeGeneration('multi-tab');await setGenerationSilently(appB,generation);
    const staleAttempt=await appB.eval(`(()=>{try{App.data.classes.push({id:'stale-suite-canary',name:${JSON.stringify(canary+'-STALE-WRITE')},students:[]});saveData({render:false,event:'suite_stale_write_attempt'});return {threw:false,blocked:App.suiteSession.writeBlocked}}catch(error){return {threw:true,blocked:App.suiteSession.writeBlocked,code:error?.code||'',message:error?.message||''}}})()`);
    await setGenerationSilently(appA,generation);await dispatchSuiteStorageSignal(appA,generation);await dispatchSuiteStorageSignal(appB,generation);
    await waitSuiteEnd(appA,'ended');await waitSuiteEnd(appB,'ended');
    const dumpA=await storageDump(appA),dumpB=await storageDump(appB);const cleanA=cleanupSnapshotOk(dumpA,canary),cleanB=cleanupSnapshotOk(dumpB,canary);
    assert(cleanA.ok&&cleanB.ok,'Multi-tab ekvivalent zanechal/obnovil canary.');assert(staleAttempt.blocked===true,'Stale multi-tab write guard se neaktivoval.');
    assert(dumpA[SEEN_KEY]===generation&&dumpB[SEEN_KEY]===generation,'Obě karty nepotvrdily stejnou generation.');
    pass('multi-tab',{generation,staleAttempt,cleanA,cleanB,bothTabsClosed:true,nativeSharedLocalStorageTransport:'NOT TESTED - Chromium administrator policy blocks navigable same-origin pages; exact same generation and StorageEvent delivered to two real browser contexts'});
  }catch(error){fail('multi-tab',error);}

  // 4) Browser history lifecycle equivalent: a stale page misses the storage event, then pageshow/focus detects generation drift before it may persist.
  try{
    const app=await appPage();clients.push(app);await waitAppReady(app);const canary=`${baseCanary}-HISTORY`;await seedOpenApp(app,canary);
    const generation=makeGeneration('history');await setGenerationSilently(app,generation);
    await app.eval("dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}))");
    await waitSuiteEnd(app,'ended');
    let dump=await storageDump(app);let clean=cleanupSnapshotOk(dump,canary);assert(clean.ok,'pageshow/BFCache lifecycle guard obnovil starý canary.');
    await app.eval("dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));dispatchEvent(new Event('focus'))");await sleep(160);
    dump=await storageDump(app);clean=cleanupSnapshotOk(dump,canary);assert(clean.ok,'Opakovaný pageshow/focus znovu persistoval starý canary.');
    pass('browser-back-forward',{generation,clean,lifecycleEquivalentEvents:2,nativeBackForwardNavigation:'NOT TESTED - Chromium administrator policy blocks HTTP/file navigation; pageshow/focus stale-page guard executed in real Chromium'});
  }catch(error){fail('browser-back-forward',error);}

  // 5) Fail-closed: synthetic delete failure must prevent completion and acknowledgement, then retry may succeed.
  try{
    const app=await appPage();clients.push(app);await waitAppReady(app);const canary=`${baseCanary}-FAILCLOSED`;await seedOpenApp(app,canary);
    await app.eval(`(()=>{window.__suiteOriginalRemove=Storage.prototype.removeItem;Storage.prototype.removeItem=function(key){if(String(key)==='ghrab.sortio.data.v5')throw new Error('GARP synthetic delete failure');return window.__suiteOriginalRemove.call(this,key)};return true})()`);
    const generation=makeGeneration('fail-closed');await setGenerationSilently(app,generation);await dispatchSuiteStorageSignal(app,generation);
    await waitSuiteEnd(app,'cleanup-failed');await sleep(120);
    let dump=await storageDump(app);let lifecycle=lifecycleSnapshot(dump,generation);
    assert(dump[SEEN_KEY]!==generation,'Aplikace falešně potvrdila cleanup po delete failure.');
    assert(lifecycle.observed===true,'Aplikace nezapsala, že suite signal viděla.');
    assert(lifecycle.completed===false,'Aplikace falešně označila cleanup za dokončený.');
    assert(String(dump['ghrab.sortio.data.v5']||'').includes(canary),'Syntetická porucha neudržela primární canary, test by nebyl průkazný.');
    const failureProof={acknowledged:false,observed:lifecycle.observed,completed:lifecycle.completed,primaryCanaryRemained:true};
    await app.eval(`(()=>{if(window.__suiteOriginalRemove)Storage.prototype.removeItem=window.__suiteOriginalRemove;return true})()`);
    const retry=await app.eval(`handleSuiteSessionEnd({schema:'ghrab-suite-session-v1',generation:${JSON.stringify(generation)},reason:'garp-retry-after-fault',clearApplicationData:true,appId:'sortio'})`);
    assert(retry?.ok===true,'Retry po odstranění syntetické poruchy nedokončil cleanup.');
    await waitEval(app,`localStorage.getItem(${JSON.stringify(SEEN_KEY)})===${JSON.stringify(generation)}`,Boolean,'retry ack');
    dump=await storageDump(app);const clean=cleanupSnapshotOk(dump,canary);assert(clean.ok,'Retry po fail-closed poruše neodstranil zbylý canary.');
    pass('fail-closed',{generation,failureProof,retrySucceeded:true,clean});
  }catch(error){fail('fail-closed',error);}

} finally {
  for(const c of clients)c.close();
  if(chrome.exitCode===null){try{process.kill(-chrome.pid,'SIGTERM')}catch{}}
  await Promise.race([new Promise(resolve=>chrome.once('exit',resolve)),sleep(1500)]);
  if(chrome.exitCode===null){try{process.kill(-chrome.pid,'SIGKILL')}catch{}}
  await sleep(80);fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
const failed=cases.filter(item=>item.status!=='PASS');
const report={
  schema:'sortio-ghrab-suite-session-regressions-v1',appId:'sortio',appVersion:pkg.version,platformVersion:consumer.platform.version,contract:'ghrab-suite-session-v1',syntheticOnly:true,runId,canary:baseCanary,syntheticEmail,
  execution:{browser:'system Chromium via CDP',application:'actual dist/index.html with access gate bypassed and platform/app scripts executed',storage:'Storage-compatible in-memory local/sessionStorage so the exact Platform 1.1.2 migration/alias code can run',reason:'Managed Chromium returns ERR_BLOCKED_BY_ADMINISTRATOR for HTTP, HTTPS and file navigation.',notTested:['native same-origin localStorage persistence/StorageEvent transport between navigated tabs','native Back/Forward navigation/BFCache transport','post-boot physical legacy-remnant deletion through native Storage methods']},
  cases,summary:{total:cases.length,passed:cases.length-failed.length,failed:failed.length},status:failed.length?'failed':'passed'};
await fsp.writeFile(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({schema:report.schema,appVersion:report.appVersion,platformVersion:report.platformVersion,syntheticOnly:true,canary:report.canary,syntheticEmail:report.syntheticEmail,execution:report.execution,summary:report.summary,status:report.status,cases:cases.map(({name,status,error})=>({name,status,...(error?{error}:{} )}))},null,2));
if(failed.length)process.exitCode=1;
