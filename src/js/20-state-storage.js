const SETTINGS_KEY='sortio.settings.v2';
const DATA_KEY='sortio.data.v5';
const LAST_GOOD_KEY='sortio.data.v5.last-good';
const RECOVERY_KEY='sortio.data.v5.pre-import';
const CORRUPT_KEY='sortio.data.v5.corrupt';
const LEGACY_DATA_KEYS=['sortio.data.v4','sortio.data.v3','sortio.data.v2'];
const MAX_BACKUP_BYTES=5*1024*1024;
const HISTORY_LIMITS=Object.freeze({draw:100,group:60,role:300,engagement:1000});
function rawStorage(){try{return window.localStorage}catch(_){return null}}
function safeStorage(){const storage=rawStorage();if(!storage)return null;try{void storage.length;return storage}catch(_){return null}}
function defaultRoleCatalog(){return['Mluvčí','Zapisovatel','Hlídač času','Kontrolor zadání']}
function defaultSeatingPlan(){return{template:'rows',rows:4,columns:6,seats:[],updatedAt:null}}
function defaultToolState(){return{scores:[],decisionOptions:[],updatedAt:null}}
function defaultData(){return{schema:'sortio-data-v5',version:5,selectedClassId:null,classes:[],aliases:{},createdAt:nowIso(),updatedAt:nowIso(),integrity:{saveCount:0,lastSavedAt:null}}}
function loadSettings(){const storage=safeStorage();if(!storage)return{...App.settings};try{const saved=JSON.parse(storage.getItem(SETTINGS_KEY)||'{}');return{theme:['dark','light','system'].includes(saved.theme)?saved.theme:'dark',motion:saved.motion!==false,confirmDestructive:saved.confirmDestructive!==false,lastRoute:String(saved.lastRoute||'overview')}}catch(_){return{...App.settings}}}
function saveSettings(){
  const storage=safeStorage();
  if(!storage)return false;
  try{storage.setItem(SETTINGS_KEY,JSON.stringify({...App.settings,lastRoute:App.route}));return true}
  catch(error){captureError(error,'save-settings');return false}
}
function parseDataText(text,key){if(!text)return null;try{return JSON.parse(text)}catch(error){if(key===DATA_KEY){try{safeStorage()?.setItem(CORRUPT_KEY,text)}catch(_){}}throw error}}
function acceptedDataSchema(schema){return['sortio-data-v2','sortio-data-v3','sortio-data-v4','sortio-data-v5'].includes(schema)}
function persistDataSnapshot(data,{updateIntegrity=true}={}){
  const storage=safeStorage();
  if(!storage)return false;
  if(updateIntegrity){
    data.integrity={...(data.integrity||{}),saveCount:Number(data.integrity?.saveCount||0)+1,lastSavedAt:nowIso()};
  }
  const text=JSON.stringify(data);
  const previous=storage.getItem(DATA_KEY);
  if(previous&&previous!==text){
    try{
      const parsed=JSON.parse(previous);
      if(acceptedDataSchema(parsed?.schema))storage.setItem(LAST_GOOD_KEY,previous);
    }catch(error){
      if(!(error instanceof SyntaxError))throw error;
      // Poškozený primární zápis se nikdy nepřenáší do bezpečné kopie.
    }
  }
  storage.setItem(DATA_KEY,text);
  return true;
}
function loadData(){
  const storage=safeStorage();
  if(!storage){
    App.recoveryState={storageAvailable:false,recovered:false,source:'memory'};
    return defaultData();
  }
  let raw=null;
  let source=DATA_KEY;
  try{
    raw=parseDataText(storage.getItem(DATA_KEY),DATA_KEY);
  }catch(error){
    captureError(error,'data-primary-corrupt');
  }
  if(!raw){
    try{
      raw=parseDataText(storage.getItem(LAST_GOOD_KEY),LAST_GOOD_KEY);
      if(raw){
        source=LAST_GOOD_KEY;
        App.recoveryState={storageAvailable:true,recovered:true,source:'last-good',message:'Primární data byla poškozená. SORTIO obnovilo poslední bezpečný stav.'};
      }
    }catch(error){
      captureError(error,'data-last-good-corrupt');
    }
  }
  if(!raw){
    for(const key of LEGACY_DATA_KEYS){
      try{
        raw=parseDataText(storage.getItem(key),key);
        if(raw){source=key;break;}
      }catch(error){
        captureError(error,`legacy-${key}`);
      }
    }
  }
  if(!raw){
    App.recoveryState={storageAvailable:true,recovered:false,source:'empty'};
    return defaultData();
  }
  if(!acceptedDataSchema(raw.schema)){
    App.recoveryState={storageAvailable:true,recovered:false,source:'unsupported',message:'Nalezená data mají nepodporovaný formát a nebyla načtena.'};
    return defaultData();
  }
  const data=sanitizeData(raw);
  try{
    persistDataSnapshot(data,{updateIntegrity:false});
    LEGACY_DATA_KEYS.forEach(key=>storage.removeItem(key));
  }catch(error){
    captureError(error,'data-migration-save');
  }
  if(!App.recoveryState)App.recoveryState={storageAvailable:true,recovered:false,source};
  return data;
}
function sanitizeData(raw){const defaults=defaultData();const source=raw&&typeof raw==='object'?raw:{};const data={schema:'sortio-data-v5',version:5,selectedClassId:source.selectedClassId?String(source.selectedClassId):null,classes:Array.isArray(source.classes)?source.classes.map(sanitizeClass).filter(Boolean):[],aliases:source.aliases&&typeof source.aliases==='object'?Object.fromEntries(Object.entries(source.aliases).slice(0,500).map(([key,value])=>[String(key).slice(0,100),String(value).slice(0,100)])):{},createdAt:source.createdAt||defaults.createdAt,updatedAt:source.updatedAt||defaults.updatedAt,integrity:{saveCount:Math.max(0,Number(source.integrity?.saveCount)||0),lastSavedAt:source.integrity?.lastSavedAt||source.updatedAt||null}};if(!data.classes.some(item=>item.id===data.selectedClassId))data.selectedClassId=data.classes.find(item=>!item.archived)?.id||data.classes[0]?.id||null;return data}
function sanitizeClass(item){if(!item||typeof item!=='object')return null;const students=Array.isArray(item.students)?item.students.slice(0,500).map(sanitizeStudent).filter(Boolean):[];const ids=new Set(students.map(student=>student.id));const rules=item.groupRules&&typeof item.groupRules==='object'?item.groupRules:{};return{id:String(item.id||uid('class')),name:String(item.name||'Třída bez názvu').slice(0,160),schoolYear:String(item.schoolYear||'').slice(0,40),archived:!!item.archived,demo:!!item.demo,createdAt:item.createdAt||nowIso(),updatedAt:item.updatedAt||nowIso(),students,drawState:{remainingIds:Array.isArray(item.drawState?.remainingIds)?item.drawState.remainingIds.map(String).filter(id=>ids.has(id)):[],cycle:Number(item.drawState?.cycle||0),lastDraw:item.drawState?.lastDraw||null},drawHistory:Array.isArray(item.drawHistory)?item.drawHistory.slice(0,HISTORY_LIMITS.draw):[],engagementHistory:sanitizeEngagementHistory(item.engagementHistory,ids),currentGroups:Array.isArray(item.currentGroups)?item.currentGroups.map(group=>sanitizeGroup(group,ids)).filter(Boolean):[],groupHistory:Array.isArray(item.groupHistory)?item.groupHistory.slice(0,HISTORY_LIMITS.group):[],lastGroupConfig:item.lastGroupConfig&&typeof item.lastGroupConfig==='object'?item.lastGroupConfig:null,groupRules:{together:sanitizePairs(rules.together,ids),apart:sanitizePairs(rules.apart,ids),pins:sanitizePins(rules.pins,ids)},roleCatalog:Array.isArray(item.roleCatalog)&&item.roleCatalog.length?uniqueStrings(item.roleCatalog):defaultRoleCatalog(),topicCatalog:Array.isArray(item.topicCatalog)?uniqueStrings(item.topicCatalog):[],roleHistory:Array.isArray(item.roleHistory)?item.roleHistory.slice(0,HISTORY_LIMITS.role):[],seatingPlan:sanitizeSeatingPlan(item.seatingPlan,ids),toolState:sanitizeToolState(item.toolState)}}
function sanitizeStudent(item){if(!item||typeof item!=='object')return null;const firstName=titleCase(String(item.firstName||'').slice(0,80));const lastName=titleCase(String(item.lastName||'').slice(0,120));if(!firstName&&!lastName)return null;return{id:String(item.id||uid('student')),firstName,lastName,displayName:`${firstName} ${lastName}`.trim(),key:normalizeText(`${firstName} ${lastName}`),present:item.present!==false,archived:!!item.archived,groupLevel:['A','B','C'].includes(item.groupLevel)?item.groupLevel:'B',frontPreference:!!item.frontPreference,createdAt:item.createdAt||nowIso(),updatedAt:item.updatedAt||nowIso()}}
function sanitizeGroup(group,ids){if(!group||typeof group!=='object')return null;const studentIds=Array.isArray(group.studentIds)?group.studentIds.map(String).filter(id=>ids.has(id)):[];const assignments=group.roleAssignments&&typeof group.roleAssignments==='object'?Object.fromEntries(Object.entries(group.roleAssignments).filter(([,studentId])=>ids.has(String(studentId))).map(([role,studentId])=>[String(role).slice(0,80),String(studentId)])):{};return{id:String(group.id||uid('group')),name:String(group.name||'Skupina').slice(0,120),studentIds,locked:!!group.locked,spokespersonId:ids.has(String(group.spokespersonId))?String(group.spokespersonId):null,roleAssignments:assignments,topic:String(group.topic||'').slice(0,300),createdAt:group.createdAt||nowIso()}}
function sanitizePairs(value,ids){if(!Array.isArray(value))return[];const seen=new Set();return value.map(pair=>Array.isArray(pair)?pair.map(String):[]).filter(pair=>pair.length===2&&pair[0]!==pair[1]&&pair.every(id=>ids.has(id))).map(pair=>pair.sort()).filter(pair=>{const key=pair.join('|');if(seen.has(key))return false;seen.add(key);return true}).slice(0,500)}
function sanitizePins(value,ids){if(!value||typeof value!=='object')return{};return Object.fromEntries(Object.entries(value).filter(([id,index])=>ids.has(id)&&Number.isInteger(Number(index))&&Number(index)>=0).slice(0,500).map(([id,index])=>[id,Number(index)]))}
function sanitizeSeatingPlan(value,ids){const plan={...defaultSeatingPlan(),...(value&&typeof value==='object'?value:{})};plan.template=['rows','pairs','islands','u'].includes(plan.template)?plan.template:'rows';plan.rows=Math.max(2,Math.min(10,Number(plan.rows)||4));plan.columns=Math.max(2,Math.min(12,Number(plan.columns)||6));plan.seats=Array.isArray(plan.seats)?plan.seats.slice(0,240).map(seat=>({id:String(seat.id||uid('seat')),row:Number(seat.row||0),column:Number(seat.column||0),island:Number.isFinite(Number(seat.island))?Number(seat.island):null,label:String(seat.label||'').slice(0,30),studentId:ids.has(String(seat.studentId))?String(seat.studentId):null,blocked:!!seat.blocked,locked:!!seat.locked})):[];return plan}
function sanitizeEngagementHistory(value,ids){if(!Array.isArray(value))return[];return value.map(item=>({id:String(item.id||uid('engagement')),studentId:String(item.studentId||''),kind:['answer','presentation','speaker','volunteer','other'].includes(item.kind)?item.kind:'other',label:String(item.label||'').slice(0,200),createdAt:item.createdAt||nowIso()})).filter(item=>ids.has(item.studentId)).slice(0,HISTORY_LIMITS.engagement)}
function sanitizeToolState(value){const source=value&&typeof value==='object'?value:{};return{scores:Array.isArray(source.scores)?source.scores.map(item=>({id:String(item.id||uid('team')),name:String(item.name||'Tým').slice(0,100),score:Number(item.score)||0})).slice(0,20):[],decisionOptions:Array.isArray(source.decisionOptions)?source.decisionOptions.map(value=>String(value).slice(0,200)).filter(Boolean).slice(0,50):[],updatedAt:source.updatedAt||null}}
function uniqueStrings(values){return[...new Set(values.map(value=>String(value).trim()).filter(Boolean))].slice(0,40)}
function saveData({render=true,event='data_change'}={}){
  if(!App.data)App.data=defaultData();
  App.data.updatedAt=nowIso();
  try{
    persistDataSnapshot(App.data);
    App.storageError=null;
  }catch(error){
    const quota=error?.name==='QuotaExceededError'||error?.code===22||error?.code===1014;
    const message=quota?'Místní úložiště je zaplněné. Exportujte zálohu a uvolněte místo odstraněním nepotřebných archivovaných tříd nebo historie.':error.message;
    App.storageError={message,createdAt:nowIso(),quotaExceeded:quota};
    captureError(new Error(message),'save-data');
  }
  App.lastOperation=event;
  if(render)document.dispatchEvent(new CustomEvent('sortio:data-changed',{detail:{event}}));
}
function clearSettings(){try{rawStorage()?.removeItem(SETTINGS_KEY)}catch(error){captureError(error,'clear-settings')}}
function clearAllData(){
  const storage=rawStorage();
  [DATA_KEY,LAST_GOOD_KEY,RECOVERY_KEY,CORRUPT_KEY,...LEGACY_DATA_KEYS].forEach(key=>{try{storage?.removeItem(key)}catch(_){}});
  App.data=defaultData();
  App.recoveryState={storageAvailable:!!storage,recovered:false,source:'cleared'};
  saveData({event:'clear_all_data'});
}
function checksumText(text){let hash=0x811c9dc5;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)}return(hash>>>0).toString(16).padStart(8,'0')}
function buildBackupPayload(data=App.data){const clean=sanitizeData(data);const dataText=JSON.stringify(clean);return{schema:'sortio-backup-v4',appVersion:SORTIO_VERSION,exportedAt:nowIso(),integrity:{algorithm:'fnv1a-32',checksum:checksumText(dataText)},summary:{classes:clean.classes.length,students:clean.classes.reduce((sum,item)=>sum+item.students.length,0)},data:clean}}
function exportBackup(){const payload=buildBackupPayload();downloadText(`SORTIO-zaloha-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2))}
function validateBackupPayload(payload,{allowChecksumMismatch=false}={}){
  if(!payload||typeof payload!=='object'||!['sortio-backup-v1','sortio-backup-v2','sortio-backup-v3','sortio-backup-v4'].includes(payload.schema)||!payload.data)throw new Error('Soubor není platná záloha SORTIO.');
  if(payload.integrity?.checksum){
    const actual=checksumText(JSON.stringify(payload.data));
    if(actual!==payload.integrity.checksum&&!allowChecksumMismatch){
      const error=new Error('Kontrolní součet zálohy nesouhlasí. Obsah se liší od okamžiku exportu.');
      error.code='BACKUP_CHECKSUM_MISMATCH';
      throw error;
    }
  }
  return sanitizeData(payload.data);
}
async function importBackup(file){
  if(!file)throw new Error('Nebyl vybrán žádný soubor.');
  if(file.size>MAX_BACKUP_BYTES)throw new Error('Záloha je příliš velká. Maximální podporovaná velikost je 5 MB.');
  let payload;
  try{payload=JSON.parse(await file.text())}catch(_){throw new Error('Soubor není platný JSON.')}
  let incoming;
  try{incoming=validateBackupPayload(payload)}catch(error){
    if(error.code!=='BACKUP_CHECKSUM_MISMATCH')throw error;
    const proceed=confirm(`${error.message}

Chcete soubor přesto načíst? Tuto možnost použijte jen u vlastní důvěryhodné zálohy.`);
    if(!proceed)return false;
    incoming=validateBackupPayload(payload,{allowChecksumMismatch:true});
  }
  const summary={classes:incoming.classes.length,students:incoming.classes.reduce((sum,item)=>sum+item.students.length,0)};
  if(App.settings.confirmDestructive!==false&&!confirm(`Načíst zálohu s ${summary.classes} třídami a ${summary.students} studenty? Aktuální stav bude možné obnovit tlačítkem „Vrátit stav před importem“.`))return false;
  const storage=safeStorage();
  if(storage&&App.data)storage.setItem(RECOVERY_KEY,JSON.stringify(App.data));
  App.data=incoming;
  saveData({event:'backup_import'});
  return true;
}
function hasRecoverySnapshot(){return!!safeStorage()?.getItem(RECOVERY_KEY)}
function restoreRecoverySnapshot(){const storage=safeStorage();const text=storage?.getItem(RECOVERY_KEY);if(!text)throw new Error('Není uložen stav před importem.');const raw=parseDataText(text,RECOVERY_KEY);App.data=sanitizeData(raw);saveData({event:'backup_restore_pre_import'});storage.removeItem(RECOVERY_KEY);return true}
function storageHealthSnapshot(){const storage=safeStorage();let primaryValid=false,lastGoodValid=false,primaryBytes=0,lastGoodBytes=0;try{const text=storage?.getItem(DATA_KEY)||'';primaryBytes=new Blob([text]).size;primaryValid=!!text&&acceptedDataSchema(JSON.parse(text).schema)}catch(_){}try{const text=storage?.getItem(LAST_GOOD_KEY)||'';lastGoodBytes=new Blob([text]).size;lastGoodValid=!!text&&acceptedDataSchema(JSON.parse(text).schema)}catch(_){}return{available:!!storage,primaryValid,lastGoodValid,primaryBytes,lastGoodBytes,recoveryAvailable:hasRecoverySnapshot(),corruptSnapshotAvailable:!!storage?.getItem(CORRUPT_KEY),saveCount:Number(App.data?.integrity?.saveCount||0),lastSavedAt:App.data?.integrity?.lastSavedAt||null}}
