const SUITE_SESSION_STATE_KEY='ghrab.sortio.suite-session-state.v1';
const SUITE_MIGRATION_BACKUP_KEY='ghrab.sortio.migration.p2-storage-namespace-v1.backup';
const SUITE_CONTENT_STORAGE_KEYS=Object.freeze([
  'ghrab.sortio.data.v5',
  'ghrab.sortio.data.v5.last-good',
  'ghrab.sortio.data.v5.pre-import',
  'ghrab.sortio.data.v5.corrupt',
  'ghrab.sortio.data.v4',
  'ghrab.sortio.data.v3',
  'ghrab.sortio.data.v2',
  SUITE_MIGRATION_BACKUP_KEY,
]);
const SUITE_LEGACY_PHYSICAL_KEYS=Object.freeze([
  'sortio.data.v5',
  'sortio.data.v5.last-good',
  'sortio.data.v5.pre-import',
  'sortio.data.v5.corrupt',
  'sortio.data.v4',
  'sortio.data.v3',
  'sortio.data.v2',
]);

function suiteSessionApi(){
  const api=window.GHRAB_PLATFORM?.session;
  return api?.contract==='ghrab-suite-session-v1'?api:null;
}
function suiteSessionGeneration(){
  try{return String(suiteSessionApi()?.generation?.()||'')}catch(_){return''}
}
function suiteCanonicalStorageKey(key){
  try{return window.GHRAB_PLATFORM?.storageAliases?.canonicalKey?.('localStorage',key)||String(key)}catch(_){return String(key)}
}
function suitePhysicalStorageKeys(storage){
  const keys=[];
  try{for(let index=0;index<storage.length;index++){const key=storage.key(index);if(key!==null)keys.push(String(key))}}catch(_){}
  return keys;
}
function readSuiteSessionState(){
  const storage=safeStorage();
  if(!storage)return null;
  try{
    const value=JSON.parse(storage.getItem(SUITE_SESSION_STATE_KEY)||'null');
    return value&&value.schema==='sortio-suite-session-state-v1'?value:null;
  }catch(_){return null}
}
function writeSuiteSessionState(patch){
  const storage=safeStorage();
  if(!storage)return false;
  const previous=readSuiteSessionState()||{schema:'sortio-suite-session-state-v1'};
  const next={...previous,...patch,schema:'sortio-suite-session-state-v1'};
  try{
    storage.setItem(SUITE_SESSION_STATE_KEY,JSON.stringify(next));
    const verify=readSuiteSessionState();
    return Object.entries(patch).every(([key,value])=>verify?.[key]===value);
  }catch(error){captureError(error,'suite-session-state-write');return false}
}
function suiteSessionContentWriteAllowed({triggerCleanup=true}={}){
  if(App.suiteSession?.writeBlocked)return false;
  if(!App.suiteSession?.lifecycleReady)return true;
  const generation=suiteSessionGeneration();
  if(generation===String(App.suiteSession.generationAtHydration||''))return true;
  App.suiteSession.writeBlocked=true;
  if(triggerCleanup&&generation){
    void handleSuiteSessionEnd({schema:'ghrab-suite-session-v1',generation,reason:'write-guard-generation-change',clearApplicationData:true,appId:APP_ID,replay:true});
  }
  return false;
}
function assertSuiteSessionContentWriteAllowed(){
  if(suiteSessionContentWriteAllowed())return true;
  const error=new Error('Společná relace AI Studia byla ukončena. Zastaralý obsah nesmí být znovu uložen.');
  error.code='SUITE_SESSION_ENDED';
  throw error;
}
function closeSuiteSessionOwnedWindows(){
  const windows=Array.isArray(App.ui?.printWindows)?App.ui.printWindows:[];
  for(const child of windows){try{if(child&&!child.closed)child.close()}catch(_){}}
  if(App.ui)App.ui.printWindows=[];
}
function clearSuiteSessionMemory(){
  closeSuiteSessionOwnedWindows();
  LAST_PERSISTED_TEXT=null;
  App.data=defaultData();
  App.recoveryState={storageAvailable:!!safeStorage(),recovered:false,source:'suite-session-end'};
  if(App.ui){
    App.ui.importRows=[];
    App.ui.importInvalid=[];
    App.ui.studentSearch='';
    App.ui.quickResult=null;
  }
}
function removeLegacyPhysicalSuiteKeys(storage){
  const present=new Set(suitePhysicalStorageKeys(storage));
  const legacy=SUITE_LEGACY_PHYSICAL_KEYS.filter(key=>present.has(key));
  if(!legacy.length)return{ok:true,removed:[]};
  let frame=null;
  const removed=[];
  try{
    frame=document.createElement('iframe');
    frame.hidden=true;
    frame.setAttribute('aria-hidden','true');
    frame.tabIndex=-1;
    (document.body||document.documentElement).appendChild(frame);
    const nativeRemove=frame.contentWindow?.Storage?.prototype?.removeItem;
    const nativeGet=frame.contentWindow?.Storage?.prototype?.getItem;
    if(typeof nativeRemove!=='function'||typeof nativeGet!=='function')return{ok:false,removed,reason:'native-storage-method-unavailable'};
    for(const key of legacy){
      nativeRemove.call(storage,key);
      if(nativeGet.call(storage,key)!==null)return{ok:false,removed,reason:`legacy-delete-verification-failed:${key}`};
      removed.push(key);
    }
    return{ok:true,removed};
  }catch(error){return{ok:false,removed,reason:error?.message||'legacy-delete-failed'}}
  finally{try{frame?.remove()}catch(_){}}
}
function verifySuiteSessionContentAbsent(storage){
  const remaining=[];
  for(const key of SUITE_CONTENT_STORAGE_KEYS){
    try{if(storage.getItem(key)!==null)remaining.push(key)}catch(_){remaining.push(key)}
  }
  const physical=new Set(suitePhysicalStorageKeys(storage));
  for(const key of SUITE_LEGACY_PHYSICAL_KEYS)if(physical.has(key))remaining.push(key);
  return{ok:remaining.length===0,remaining:[...new Set(remaining)]};
}
function renderSuiteSessionClosed({failed=false}={}){
  if(!document.body)return;
  document.documentElement.dataset.ghrabAccess='denied';
  document.documentElement.dataset.sortioSuiteSession=failed?'cleanup-failed':'ended';
  const main=document.createElement('main');
  main.className='ghrab-access-gate';
  const mark=document.createElement('div');mark.className='ghrab-access-gate-mark';mark.textContent=failed?'!':'✓';
  const eyebrow=document.createElement('p');eyebrow.className='ghrab-access-gate-eyebrow';eyebrow.textContent='AI STUDIO GHRAB';
  const title=document.createElement('h1');title.textContent=failed?'Ukončení práce vyžaduje kontrolu':'Práce byla bezpečně ukončena';
  const message=document.createElement('p');message.className='ghrab-access-gate-message';message.textContent=failed
    ?'Lokální úklid SORTIO nebylo možné bezpečně dokončit. Aplikace zůstává uzamčená a ukončení nebylo potvrzeno. Zavřete tuto kartu a znovu ji otevřete přes AI Studio.'
    :'Lokální pracovní data SORTIO byla odstraněna. Pro další práci otevřete aplikaci znovu přes AI Studio.';
  main.append(mark,eyebrow,title,message);
  document.body.replaceChildren(main);
}
async function performSuiteSessionCleanup(generation){
  const storage=safeStorage();
  if(!storage)return{ok:false,reason:'local-storage-unavailable'};
  const stateBefore=readSuiteSessionState();
  if(stateBefore?.cleanupCompletedGeneration===generation){
    const verifyExisting=verifySuiteSessionContentAbsent(storage);
    if(verifyExisting.ok){
      clearSuiteSessionMemory();
      return{ok:true,reusedCompletedCleanup:true,removed:[]};
    }
  }
  const removed=[];
  const failures=[];
  for(const key of SUITE_CONTENT_STORAGE_KEYS){
    try{
      storage.removeItem(key);
      if(storage.getItem(key)!==null)failures.push(`delete-verification-failed:${key}`);
      else removed.push(key);
    }catch(error){failures.push(`delete-failed:${key}:${error?.message||error}`)}
  }
  const legacy=removeLegacyPhysicalSuiteKeys(storage);
  if(!legacy.ok)failures.push(legacy.reason||'legacy-delete-failed');
  removed.push(...legacy.removed);
  clearSuiteSessionMemory();
  const verify=verifySuiteSessionContentAbsent(storage);
  if(!verify.ok)failures.push(`remaining-content:${verify.remaining.join(',')}`);
  if(failures.length)return{ok:false,reason:'cleanup-failed',failures,removed,remaining:verify.remaining};
  const completedAt=nowIso();
  if(!writeSuiteSessionState({cleanupCompletedGeneration:generation,cleanupCompletedAt:completedAt})){
    return{ok:false,reason:'cleanup-completion-state-write-failed',removed};
  }
  return{ok:true,removed,cleanupCompletedAt:completedAt};
}
async function handleSuiteSessionEnd(detail={}){
  const session=suiteSessionApi();
  const generation=String(detail.generation||session?.generation?.()||'');
  if(!session||!generation){
    App.suiteSession.writeBlocked=true;
    if(App.suiteSession.hydrated)renderSuiteSessionClosed({failed:true});
    return{ok:false,reason:'suite-session-api-or-generation-missing'};
  }
  if(App.suiteSession.cleanupGeneration===generation&&App.suiteSession.cleanupPromise)return App.suiteSession.cleanupPromise;
  const task=(async()=>{
    App.suiteSession.writeBlocked=true;
    const observedAt=nowIso();
    const state=readSuiteSessionState();
    if(state?.observedGeneration!==generation&&!writeSuiteSessionState({observedGeneration:generation,observedAt})){
      if(App.suiteSession.hydrated)renderSuiteSessionClosed({failed:true});
      return{ok:false,reason:'suite-observed-state-write-failed'};
    }
    const cleanup=await performSuiteSessionCleanup(generation);
    if(!cleanup.ok){
      App.suiteSession.lastFailure={generation,reason:cleanup.reason,at:nowIso()};
      if(App.suiteSession.hydrated)renderSuiteSessionClosed({failed:true});
      return cleanup;
    }
    let acknowledged=false;
    try{acknowledged=session.acknowledge(generation)===true&&String(session.seen?.()||'')===generation}catch(_){acknowledged=false}
    if(!acknowledged){
      App.suiteSession.lastFailure={generation,reason:'suite-acknowledgement-failed',at:nowIso()};
      if(App.suiteSession.hydrated)renderSuiteSessionClosed({failed:true});
      return{ok:false,reason:'suite-acknowledgement-failed',cleanup};
    }
    App.suiteSession.generationAtHydration=generation;
    App.suiteSession.lastCompletedGeneration=generation;
    App.suiteSession.lastFailure=null;
    if(App.suiteSession.hydrated){
      App.suiteSession.writeBlocked=true;
      renderSuiteSessionClosed({failed:false});
    }else App.suiteSession.writeBlocked=false;
    return{ok:true,generation,cleanup,acknowledged:true};
  })();
  App.suiteSession.cleanupGeneration=generation;
  App.suiteSession.cleanupPromise=task;
  try{return await task}
  finally{
    if(App.suiteSession.cleanupPromise===task)App.suiteSession.cleanupPromise=null;
  }
}
function triggerSuiteSessionGenerationCheck(reason='lifecycle-check'){
  if(!App.suiteSession.lifecycleReady)return;
  const generation=suiteSessionGeneration();
  if(!generation||generation===String(App.suiteSession.generationAtHydration||''))return;
  App.suiteSession.writeBlocked=true;
  void handleSuiteSessionEnd({schema:'ghrab-suite-session-v1',generation,reason,clearApplicationData:true,appId:APP_ID,replay:true});
}
async function prepareSuiteSessionLifecycle(){
  const session=suiteSessionApi();
  if(!session){
    App.suiteSession.writeBlocked=true;
    renderSuiteSessionClosed({failed:true});
    return false;
  }
  App.suiteSession.lifecycleReady=true;
  App.suiteSession.generationAtHydration=String(session.generation?.()||'');
  window.addEventListener('storage',event=>{
    if(event.key!==session.generationKey||!event.newValue)return;
    const generation=String(event.newValue);
    if(generation===String(App.suiteSession.generationAtHydration||''))return;
    App.suiteSession.writeBlocked=true;
    void handleSuiteSessionEnd({schema:'ghrab-suite-session-v1',generation,reason:'cross-context-page-guard',clearApplicationData:true,appId:APP_ID});
  });
  window.addEventListener('pageshow',()=>triggerSuiteSessionGenerationCheck('pageshow-generation-check'));
  window.addEventListener('focus',()=>triggerSuiteSessionGenerationCheck('focus-generation-check'));
  const initialGeneration=String(session.generation?.()||'');
  if(initialGeneration&&session.pending?.()){
    const replay=await handleSuiteSessionEnd({schema:'ghrab-suite-session-v1',generation:initialGeneration,reason:'pre-hydration-replay',clearApplicationData:true,appId:APP_ID,replay:true});
    if(!replay?.ok)return false;
  }
  App.suiteSession.unsubscribe=session.onEnd(detail=>handleSuiteSessionEnd(detail),{replay:false});
  const latestGeneration=String(session.generation?.()||'');
  if(latestGeneration&&latestGeneration!==String(App.suiteSession.generationAtHydration||'')){
    const raced=await handleSuiteSessionEnd({schema:'ghrab-suite-session-v1',generation:latestGeneration,reason:'registration-race-replay',clearApplicationData:true,appId:APP_ID,replay:true});
    if(!raced?.ok)return false;
  }
  return true;
}
