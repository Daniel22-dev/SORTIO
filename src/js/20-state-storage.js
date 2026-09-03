const SETTINGS_KEY='sortio.settings.v2';
const DATA_KEY='sortio.data.v5';
const LAST_GOOD_KEY='sortio.data.v5.last-good';
const RECOVERY_KEY='sortio.data.v5.pre-import';
const CORRUPT_KEY='sortio.data.v5.corrupt';
const LEGACY_DATA_KEYS=['sortio.data.v4','sortio.data.v3','sortio.data.v2'];
const MAX_BACKUP_BYTES=5*1024*1024;
let LAST_PERSISTED_TEXT;
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
function persistDataSnapshot(data,{updateIntegrity=true,allowExternalChange=false}={}){
  const storage=safeStorage();
  if(!storage)return false;
  const previous=storage.getItem(DATA_KEY);
  if(!allowExternalChange&&LAST_PERSISTED_TEXT!==undefined&&previous!==LAST_PERSISTED_TEXT){
    const error=new Error('Data byla mezitím změněna v jiné kartě. Novější stav nebyl přepsán.');
    error.code='STORAGE_CONFLICT';
    throw error;
  }
  if(updateIntegrity){
    data.integrity={...(data.integrity||{}),saveCount:Number(data.integrity?.saveCount||0)+1,lastSavedAt:nowIso()};
  }
  const text=JSON.stringify(data);
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
  LAST_PERSISTED_TEXT=text;
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
    const primaryText=storage.getItem(DATA_KEY);
    LAST_PERSISTED_TEXT=primaryText;
    raw=parseDataText(primaryText,DATA_KEY);
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
  const data=sanitizeData(raw,{repairDuplicateIdentifiers:true});
  try{
    persistDataSnapshot(data,{updateIntegrity:false});
    LEGACY_DATA_KEYS.forEach(key=>storage.removeItem(key));
  }catch(error){
    captureError(error,'data-migration-save');
  }
  if(!App.recoveryState)App.recoveryState={storageAvailable:true,recovered:false,source};
  return data;
}
const SAFE_IDENTIFIER_RE=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
function sanitizeIdentifier(value,prefix='id'){
  const raw=String(value??'').trim();
  if(!raw)return uid(prefix);
  if(SAFE_IDENTIFIER_RE.test(raw))return raw;
  const reversed=Array.from(raw).reverse().join('');
  return`${prefix}-${checksumText(raw)}-${checksumText(reversed)}`;
}
function uniqueIdentifier(value,prefix,used){
  const base=sanitizeIdentifier(value,prefix);
  if(!used.has(base)){used.add(base);return base}
  for(let counter=2;;counter++){
    const suffix=`-${counter}`;
    const candidate=`${base.slice(0,Math.max(1,80-suffix.length))}${suffix}`;
    if(!used.has(candidate)){used.add(candidate);return candidate}
  }
}
function uniquifyRecordIds(records,prefix){
  const used=new Set();
  for(const record of records||[])if(record&&typeof record==='object')record.id=uniqueIdentifier(record.id,prefix,used);
  return records;
}
function sanitizeStudentRef(value,ids,refMap=null){
  const raw=String(value??'').trim();if(!raw)return null;
  const mapped=refMap?.get(raw);if(mapped&&ids.has(mapped))return mapped;
  const id=sanitizeIdentifier(raw,'student');return ids.has(id)?id:null;
}
function sanitizeData(raw,{repairDuplicateIdentifiers=false}={}){
  const defaults=defaultData();
  const source=raw&&typeof raw==='object'?raw:{};
  const rawClasses=Array.isArray(source.classes)?source.classes.slice(0,200):[];
  const classes=[];const usedClassIds=new Set();const classRefMap=new Map();
  for(const item of rawClasses){
    const classItem=sanitizeClass(item,{repairDuplicateIdentifiers});
    if(!classItem)continue;
    if(repairDuplicateIdentifiers){
      classItem.id=uniqueIdentifier(classItem.id,'class',usedClassIds);
      const rawId=String(item?.id??'').trim();if(rawId&&!classRefMap.has(rawId))classRefMap.set(rawId,classItem.id);
    }
    classes.push(classItem);
  }
  const rawSelectedClassId=String(source.selectedClassId??'').trim();
  const selectedClassId=rawSelectedClassId?(repairDuplicateIdentifiers&&classRefMap.has(rawSelectedClassId)?classRefMap.get(rawSelectedClassId):sanitizeIdentifier(rawSelectedClassId,'class')):null;
  const data={
    schema:'sortio-data-v5',version:5,selectedClassId,classes,
    aliases:source.aliases&&typeof source.aliases==='object'?Object.fromEntries(Object.entries(source.aliases).slice(0,500).map(([key,value])=>[String(key).slice(0,100),String(value).slice(0,100)])):{},
    createdAt:source.createdAt||defaults.createdAt,updatedAt:source.updatedAt||defaults.updatedAt,
    integrity:{saveCount:Math.max(0,Number(source.integrity?.saveCount)||0),lastSavedAt:source.integrity?.lastSavedAt||source.updatedAt||null},
  };
  if(!data.classes.some(item=>item.id===data.selectedClassId))data.selectedClassId=data.classes.find(item=>!item.archived)?.id||data.classes[0]?.id||null;
  return data;
}
function sanitizeClass(item,{repairDuplicateIdentifiers=false}={}){
  if(!item||typeof item!=='object')return null;
  const students=[];const studentIdsUsed=new Set();const studentRefMap=new Map();
  const rawStudents=Array.isArray(item.students)?item.students.slice(0,500):[];
  for(const rawStudent of rawStudents){
    const student=sanitizeStudent(rawStudent);if(!student)continue;
    if(repairDuplicateIdentifiers){
      student.id=uniqueIdentifier(student.id,'student',studentIdsUsed);
      const rawId=String(rawStudent?.id??'').trim();if(rawId&&!studentRefMap.has(rawId))studentRefMap.set(rawId,student.id);
    }
    students.push(student);
  }
  const ids=new Set(students.map(student=>student.id));
  const rules=item.groupRules&&typeof item.groupRules==='object'?item.groupRules:{};
  const currentGroups=[];const groupIdsUsed=new Set();const groupRefMap=new Map();
  for(const rawGroup of Array.isArray(item.currentGroups)?item.currentGroups:[]){
    const group=sanitizeGroup(rawGroup,ids,studentRefMap);if(!group)continue;
    if(repairDuplicateIdentifiers){
      group.id=uniqueIdentifier(group.id,'group',groupIdsUsed);
      const rawId=String(rawGroup?.id??'').trim();if(rawId&&!groupRefMap.has(rawId))groupRefMap.set(rawId,group.id);
    }
    currentGroups.push(group);
  }
  const drawState={remainingIds:Array.isArray(item.drawState?.remainingIds)?item.drawState.remainingIds.map(value=>sanitizeStudentRef(value,ids,studentRefMap)).filter(Boolean):[],cycle:Math.max(0,Number(item.drawState?.cycle)||0),lastDraw:sanitizeDrawRecord(item.drawState?.lastDraw,ids,studentRefMap)};
  const drawHistory=Array.isArray(item.drawHistory)?item.drawHistory.map(value=>sanitizeDrawRecord(value,ids,studentRefMap)).filter(Boolean).slice(0,HISTORY_LIMITS.draw):[];
  const engagementHistory=sanitizeEngagementHistory(item.engagementHistory,ids,studentRefMap);
  const groupHistory=sanitizeGroupHistory(item.groupHistory,ids,studentRefMap);
  const roleHistory=sanitizeRoleHistory(item.roleHistory,ids,studentRefMap,groupRefMap);
  const seatingPlan=sanitizeSeatingPlan(item.seatingPlan,ids,studentRefMap);
  const toolState=sanitizeToolState(item.toolState);
  if(repairDuplicateIdentifiers){
    if(drawState.lastDraw)uniquifyRecordIds([drawState.lastDraw],'draw');
    uniquifyRecordIds(drawHistory,'draw');
    uniquifyRecordIds(engagementHistory,'engagement');
    uniquifyRecordIds(groupHistory,'groupset');
    uniquifyRecordIds(roleHistory,'role');
    uniquifyRecordIds(seatingPlan.seats,'seat');
    uniquifyRecordIds(toolState.scores,'team');
  }
  return{
    id:sanitizeIdentifier(item.id,'class'),name:String(item.name||'Třída bez názvu').slice(0,160),schoolYear:String(item.schoolYear||'').slice(0,40),archived:!!item.archived,demo:!!item.demo,createdAt:item.createdAt||nowIso(),updatedAt:item.updatedAt||nowIso(),students,
    drawState,drawHistory,engagementHistory,currentGroups,groupHistory,
    lastGroupConfig:sanitizeGroupConfig(item.lastGroupConfig),
    groupRules:{together:sanitizePairs(rules.together,ids,studentRefMap),apart:sanitizePairs(rules.apart,ids,studentRefMap),pins:sanitizePins(rules.pins,ids,studentRefMap)},
    roleCatalog:Array.isArray(item.roleCatalog)&&item.roleCatalog.length?uniqueStrings(item.roleCatalog):defaultRoleCatalog(),topicCatalog:Array.isArray(item.topicCatalog)?uniqueStrings(item.topicCatalog):[],
    roleHistory,seatingPlan,toolState,
  };
}
function sanitizeStudent(item){
  if(!item||typeof item!=='object')return null;
  const firstName=titleCase(String(item.firstName||'').slice(0,80));const lastName=titleCase(String(item.lastName||'').slice(0,120));if(!firstName&&!lastName)return null;
  return{id:sanitizeIdentifier(item.id,'student'),firstName,lastName,displayName:`${firstName} ${lastName}`.trim(),key:normalizeText(`${firstName} ${lastName}`),present:item.present!==false,archived:!!item.archived,groupLevel:['A','B','C'].includes(item.groupLevel)?item.groupLevel:'B',frontPreference:!!item.frontPreference,createdAt:item.createdAt||nowIso(),updatedAt:item.updatedAt||nowIso()};
}
function sanitizeGroup(group,ids,studentRefMap=null){
  if(!group||typeof group!=='object')return null;
  const studentIds=Array.isArray(group.studentIds)?group.studentIds.map(value=>sanitizeStudentRef(value,ids,studentRefMap)).filter(Boolean):[];
  const assignments=group.roleAssignments&&typeof group.roleAssignments==='object'?Object.fromEntries(Object.entries(group.roleAssignments).map(([role,studentId])=>[String(role).slice(0,80),sanitizeStudentRef(studentId,ids,studentRefMap)]).filter(([,studentId])=>!!studentId)):{};
  return{id:sanitizeIdentifier(group.id,'group'),name:String(group.name||'Skupina').slice(0,120),studentIds,locked:!!group.locked,spokespersonId:sanitizeStudentRef(group.spokespersonId,ids,studentRefMap),roleAssignments:assignments,topic:String(group.topic||'').slice(0,300),createdAt:group.createdAt||nowIso()};
}
function sanitizePairs(value,ids,studentRefMap=null){
  if(!Array.isArray(value))return[];const seen=new Set();
  return value.map(pair=>Array.isArray(pair)?pair.map(id=>sanitizeStudentRef(id,ids,studentRefMap)).filter(Boolean):[]).filter(pair=>pair.length===2&&pair[0]!==pair[1]).map(pair=>pair.sort()).filter(pair=>{const key=pair.join('|');if(seen.has(key))return false;seen.add(key);return true}).slice(0,500);
}
function sanitizePins(value,ids,studentRefMap=null){
  if(!value||typeof value!=='object')return{};
  return Object.fromEntries(Object.entries(value).map(([id,index])=>[sanitizeStudentRef(id,ids,studentRefMap),index]).filter(([id,index])=>!!id&&Number.isInteger(Number(index))&&Number(index)>=0).slice(0,500).map(([id,index])=>[id,Number(index)]));
}
function sanitizeSeatingPlan(value,ids,studentRefMap=null){
  const plan={...defaultSeatingPlan(),...(value&&typeof value==='object'?value:{})};plan.template=['rows','pairs','islands','u'].includes(plan.template)?plan.template:'rows';plan.rows=Math.max(2,Math.min(10,Number(plan.rows)||4));plan.columns=Math.max(2,Math.min(12,Number(plan.columns)||6));
  plan.seats=Array.isArray(plan.seats)?plan.seats.slice(0,240).map(seat=>({id:sanitizeIdentifier(seat.id,'seat'),row:Number(seat.row||0),column:Number(seat.column||0),island:Number.isFinite(Number(seat.island))?Number(seat.island):null,label:String(seat.label||'').slice(0,30),studentId:sanitizeStudentRef(seat.studentId,ids,studentRefMap),blocked:!!seat.blocked,locked:!!seat.locked})):[];return plan;
}
function sanitizeEngagementHistory(value,ids,studentRefMap=null){
  if(!Array.isArray(value))return[];
  return value.map(item=>({id:sanitizeIdentifier(item?.id,'engagement'),studentId:sanitizeStudentRef(item?.studentId,ids,studentRefMap),kind:['answer','presentation','speaker','volunteer','other'].includes(item?.kind)?item.kind:'other',label:String(item?.label||'').slice(0,200),createdAt:item?.createdAt||nowIso()})).filter(item=>!!item.studentId).slice(0,HISTORY_LIMITS.engagement);
}
function sanitizeToolState(value){
  const source=value&&typeof value==='object'?value:{};
  return{scores:Array.isArray(source.scores)?source.scores.map(item=>({id:sanitizeIdentifier(item?.id,'team'),name:String(item?.name||'Tým').slice(0,100),score:Number(item?.score)||0})).slice(0,20):[],decisionOptions:Array.isArray(source.decisionOptions)?source.decisionOptions.map(value=>String(value).slice(0,200)).filter(Boolean).slice(0,50):[],updatedAt:source.updatedAt||null};
}
function sanitizeDrawRecord(item,ids,studentRefMap=null){
  if(!item||typeof item!=='object')return null;
  const selectedIds=Array.isArray(item.selectedIds)?item.selectedIds.map(value=>sanitizeStudentRef(value,ids,studentRefMap)).filter(Boolean):[];
  const selectedNames=Array.isArray(item.selectedNames)?item.selectedNames.map(value=>String(value).slice(0,200)).slice(0,500):[];
  return{id:sanitizeIdentifier(item.id,'draw'),createdAt:item.createdAt||nowIso(),mode:['single','multiple','order'].includes(item.mode)?item.mode:'single',count:Math.max(0,Math.min(500,Number(item.count)||selectedIds.length)),noRepeat:item.noRepeat!==false,cycle:Math.max(0,Number(item.cycle)||0),selectedIds,selectedNames};
}
function sanitizeGroupHistory(value,ids,studentRefMap=null){
  if(!Array.isArray(value))return[];
  return value.map(set=>{if(!set||typeof set!=='object')return null;return{id:sanitizeIdentifier(set.id,'groupset'),createdAt:set.createdAt||nowIso(),mode:['size','count'].includes(set.mode)?set.mode:'size',value:Math.max(1,Number(set.value)||1),smartMode:['random','balanced','homogeneous','history'].includes(set.smartMode)?set.smartMode:'random',groups:Array.isArray(set.groups)?set.groups.slice(0,100).map(group=>({name:String(group?.name||'Skupina').slice(0,120),studentIds:Array.isArray(group?.studentIds)?group.studentIds.map(id=>sanitizeStudentRef(id,ids,studentRefMap)).filter(Boolean):[],studentNames:Array.isArray(group?.studentNames)?group.studentNames.map(name=>String(name).slice(0,200)).slice(0,500):[]})):[]};}).filter(Boolean).slice(0,HISTORY_LIMITS.group);
}
function sanitizeGroupConfig(value){if(!value||typeof value!=='object')return null;return{mode:['size','count'].includes(value.mode)?value.mode:'size',value:Math.max(1,Number(value.value)||1),smartMode:['random','balanced','homogeneous','history'].includes(value.smartMode)?value.smartMode:'random'}}
function sanitizeRoleHistory(value,ids,studentRefMap=null,groupRefMap=null){
  if(!Array.isArray(value))return[];
  return value.map(item=>{if(!item||typeof item!=='object')return null;const studentId=sanitizeStudentRef(item.studentId,ids,studentRefMap);if(!studentId)return null;const rawGroupId=String(item.groupId??'').trim();const groupId=groupRefMap?.get(rawGroupId)||sanitizeIdentifier(rawGroupId,'group');return{id:sanitizeIdentifier(item.id,'role'),createdAt:item.createdAt||nowIso(),groupId,studentId,role:String(item.role||'').slice(0,80)};}).filter(Boolean).slice(0,HISTORY_LIMITS.role);
}
function uniqueStrings(values){return[...new Set(values.map(value=>String(value).trim()).filter(Boolean))].slice(0,40)}
function saveData({render=true,event='data_change'}={}){
  if(!App.data)App.data=defaultData();
  App.data.updatedAt=nowIso();
  try{
    persistDataSnapshot(App.data);
    App.storageError=null;
  }catch(error){
    const quota=error?.name==='QuotaExceededError'||error?.code===22||error?.code===1014;
    const conflict=error?.code==='STORAGE_CONFLICT';
    const message=quota?'Místní úložiště je zaplněné. Exportujte zálohu a uvolněte místo odstraněním nepotřebných archivovaných tříd nebo historie.':error.message;
    App.storageError={message,createdAt:nowIso(),quotaExceeded:quota,conflict};
    if(conflict){
      try{App.data=loadData()}catch(_){}
      if(typeof toast==='function')toast('Data se změnila v jiné kartě. SORTIO načetlo novější stav a zastaralý zápis odmítlo.','info');
    }
    captureError(new Error(message),'save-data');
  }
  App.lastOperation=event;
  if(render)document.dispatchEvent(new CustomEvent('sortio:data-changed',{detail:{event}}));
}
function clearSettings(){try{rawStorage()?.removeItem(SETTINGS_KEY)}catch(error){captureError(error,'clear-settings')}}
function clearAllData(){
  const storage=rawStorage();
  [DATA_KEY,LAST_GOOD_KEY,RECOVERY_KEY,CORRUPT_KEY,...LEGACY_DATA_KEYS].forEach(key=>{try{storage?.removeItem(key)}catch(_){}});
  LAST_PERSISTED_TEXT=null;
  App.data=defaultData();
  App.recoveryState={storageAvailable:!!storage,recovered:false,source:'cleared'};
  saveData({event:'clear_all_data'});
}
function checksumText(text){let hash=0x811c9dc5;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,0x01000193)}return(hash>>>0).toString(16).padStart(8,'0')}
function buildBackupPayload(data=App.data){const clean=sanitizeData(data);const dataText=JSON.stringify(clean);return{schema:'sortio-backup-v4',appVersion:SORTIO_VERSION,exportedAt:nowIso(),integrity:{algorithm:'fnv1a-32',checksum:checksumText(dataText)},summary:{classes:clean.classes.length,students:clean.classes.reduce((sum,item)=>sum+item.students.length,0)},data:clean}}
async function exportBackup(){const payload=buildBackupPayload();if(window.GHRABArtifact?.download)return window.GHRABArtifact.download({appId:'sortio',appVersion:SORTIO_VERSION,artifactType:'sortio-backup',sensitivity:'restricted',contentManifest:[{kind:'backup',schema:payload.schema,containsStudentNames:true}],payload,filename:`SORTIO-zaloha-${new Date().toISOString().slice(0,10)}.ghrab.json`});downloadText(`SORTIO-zaloha-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2));return null}
function validateUniqueBackupIdentifiers(data){
  const ensureUnique=(values,label)=>{const seen=new Set();for(const value of values){const id=String(value??'');if(!id)continue;if(seen.has(id)){const error=new Error(`Záloha obsahuje duplicitní interní identifikátor (${label}).`);error.code='BACKUP_DUPLICATE_IDENTIFIER';throw error}seen.add(id)}};
  ensureUnique((data.classes||[]).map(item=>item.id),'třída');
  for(const classItem of data.classes||[]){
    ensureUnique((classItem.students||[]).map(item=>item.id),'student');
    ensureUnique((classItem.currentGroups||[]).map(item=>item.id),'skupina');
    ensureUnique((classItem.seatingPlan?.seats||[]).map(item=>item.id),'místo');
    ensureUnique((classItem.engagementHistory||[]).map(item=>item.id),'aktivita');
    ensureUnique((classItem.toolState?.scores||[]).map(item=>item.id),'tým');
    ensureUnique((classItem.drawHistory||[]).map(item=>item.id),'losování');
    ensureUnique((classItem.groupHistory||[]).map(item=>item.id),'historie skupin');
    ensureUnique((classItem.roleHistory||[]).map(item=>item.id),'historie rolí');
  }
  return data;
}
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
  return validateUniqueBackupIdentifiers(sanitizeData(payload.data));
}
async function importBackup(file){
  if(!file)throw new Error('Nebyl vybrán žádný soubor.');
  if(file.size>MAX_BACKUP_BYTES)throw new Error('Záloha je příliš velká. Maximální podporovaná velikost je 5 MB.');
  let payload;
  try{const raw=await file.text();payload=window.GHRABArtifact?.unwrapMaybe?(await window.GHRABArtifact.unwrapMaybe(raw,{allowLegacy:true,expectedAppId:'sortio',verifyChecksum:true})).payload:JSON.parse(raw)}catch(_){throw new Error('Soubor není platný nebo má poškozený kontrolní součet.')}
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
function restoreRecoverySnapshot(){const storage=safeStorage();const text=storage?.getItem(RECOVERY_KEY);if(!text)throw new Error('Není uložen stav před importem.');const raw=parseDataText(text,RECOVERY_KEY);App.data=sanitizeData(raw,{repairDuplicateIdentifiers:true});saveData({event:'backup_restore_pre_import'});storage.removeItem(RECOVERY_KEY);return true}
function storageHealthSnapshot(){const storage=safeStorage();let primaryValid=false,lastGoodValid=false,primaryBytes=0,lastGoodBytes=0;try{const text=storage?.getItem(DATA_KEY)||'';primaryBytes=new Blob([text]).size;primaryValid=!!text&&acceptedDataSchema(JSON.parse(text).schema)}catch(_){}try{const text=storage?.getItem(LAST_GOOD_KEY)||'';lastGoodBytes=new Blob([text]).size;lastGoodValid=!!text&&acceptedDataSchema(JSON.parse(text).schema)}catch(_){}return{available:!!storage,primaryValid,lastGoodValid,primaryBytes,lastGoodBytes,recoveryAvailable:hasRecoverySnapshot(),corruptSnapshotAvailable:!!storage?.getItem(CORRUPT_KEY),saveCount:Number(App.data?.integrity?.saveCount||0),lastSavedAt:App.data?.integrity?.lastSavedAt||null}}
