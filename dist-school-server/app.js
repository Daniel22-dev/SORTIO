'use strict';
const SORTIO_VERSION='__APP_VERSION__';
const APP_ID='sortio';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const nowIso=()=>new Date().toISOString();
const uid=(prefix='id')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const App={version:SORTIO_VERSION,route:'overview',lastOperation:'start',lastError:null,startedAt:nowIso(),settings:{theme:'dark',motion:true,confirmDestructive:true},data:null,ui:{importRows:[],importInvalid:[],importNameOrder:'first-last',studentSearch:'',groupMode:'size',smartGroupMode:'random',groupPanel:'build',seatingPanel:'plan',timer:{duration:300,remaining:300,running:false,endsAt:null},stopwatch:{elapsed:0,running:false,startedAt:null,laps:[]},drawMode:'single',drawCount:2,noRepeat:true,quickResult:null,projectionMode:'auto',printWindows:[]},suiteSession:{lifecycleReady:false,hydrated:false,generationAtHydration:'',writeBlocked:false,cleanupGeneration:'',cleanupPromise:null,unsubscribe:null,lastCompletedGeneration:'',lastFailure:null}};
window.SORTIO=App;
function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]))}
function normalizeText(value=''){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs-CZ').replace(/[^a-z0-9]+/g,' ').trim()}
function titleCase(value=''){return String(value).trim().split(/([\s-]+)/).map(part=>/[\s-]+/.test(part)?part:part.charAt(0).toLocaleUpperCase('cs-CZ')+part.slice(1).toLocaleLowerCase('cs-CZ')).join('')}
function toast(message,type='info'){const region=$('#toastRegion');if(!region)return;const node=document.createElement('div');node.className=`toast ${type}`;node.textContent=message;region.appendChild(node);setTimeout(()=>node.remove(),3600)}
function captureError(error,context='runtime'){App.lastOperation=context;App.lastError=error instanceof Error?error:new Error(String(error));console.error(`[SORTIO/${context}]`,error);toast('Něco se nepodařilo. Podrobnosti jsou v diagnostice.','error')}
function randomInt(max){if(!Number.isInteger(max)||max<=0)return 0;if(globalThis.crypto?.getRandomValues){const limit=Math.floor(0x100000000/max)*max;const buffer=new Uint32Array(1);do{crypto.getRandomValues(buffer)}while(buffer[0]>=limit);return buffer[0]%max}return Math.floor(Math.random()*max)}
function shuffle(values){const out=[...values];for(let i=out.length-1;i>0;i--){const j=randomInt(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}
function formatDateTime(value){try{return new Intl.DateTimeFormat('cs-CZ',{dateStyle:'short',timeStyle:'short'}).format(new Date(value))}catch(_){return ''}}
function downloadText(filename,text,type='application/json'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),500)}
window.addEventListener('error',event=>captureError(event.error||event.message,'window-error'));
window.addEventListener('unhandledrejection',event=>captureError(event.reason,'unhandled-rejection'));

;
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
function parseDataText(text,key){if(!text)return null;try{return JSON.parse(text)}catch(error){if(key===DATA_KEY&&suiteSessionContentWriteAllowed({triggerCleanup:true})){try{safeStorage()?.setItem(CORRUPT_KEY,text)}catch(_){}}throw error}}
function acceptedDataSchema(schema){return['sortio-data-v2','sortio-data-v3','sortio-data-v4','sortio-data-v5'].includes(schema)}
function persistDataSnapshot(data,{updateIntegrity=true,allowExternalChange=false}={}){
  assertSuiteSessionContentWriteAllowed();
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
  assertSuiteSessionContentWriteAllowed();
  const storage=safeStorage();
  if(storage&&App.data)storage.setItem(RECOVERY_KEY,JSON.stringify(App.data));
  App.data=incoming;
  saveData({event:'backup_import'});
  return true;
}
function hasRecoverySnapshot(){return!!safeStorage()?.getItem(RECOVERY_KEY)}
function restoreRecoverySnapshot(){assertSuiteSessionContentWriteAllowed();const storage=safeStorage();const text=storage?.getItem(RECOVERY_KEY);if(!text)throw new Error('Není uložen stav před importem.');const raw=parseDataText(text,RECOVERY_KEY);App.data=sanitizeData(raw,{repairDuplicateIdentifiers:true});saveData({event:'backup_restore_pre_import'});storage.removeItem(RECOVERY_KEY);return true}
function storageHealthSnapshot(){const storage=safeStorage();let primaryValid=false,lastGoodValid=false,primaryBytes=0,lastGoodBytes=0;try{const text=storage?.getItem(DATA_KEY)||'';primaryBytes=new Blob([text]).size;primaryValid=!!text&&acceptedDataSchema(JSON.parse(text).schema)}catch(_){}try{const text=storage?.getItem(LAST_GOOD_KEY)||'';lastGoodBytes=new Blob([text]).size;lastGoodValid=!!text&&acceptedDataSchema(JSON.parse(text).schema)}catch(_){}return{available:!!storage,primaryValid,lastGoodValid,primaryBytes,lastGoodBytes,recoveryAvailable:hasRecoverySnapshot(),corruptSnapshotAvailable:!!storage?.getItem(CORRUPT_KEY),saveCount:Number(App.data?.integrity?.saveCount||0),lastSavedAt:App.data?.integrity?.lastSavedAt||null}}

;
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

;
function getClasses({includeArchived=false}={}){return App.data.classes.filter(item=>includeArchived||!item.archived)}
function getSelectedClass(){return App.data.classes.find(item=>item.id===App.data.selectedClassId)||null}
function setSelectedClass(classId){if(!App.data.classes.some(item=>item.id===classId))return false;App.data.selectedClassId=classId;saveData({event:'class_select'});recordEvent('class_select');return true}
function classStudents(classItem=getSelectedClass(),{presentOnly=false,includeArchived=false}={}){if(!classItem)return[];return classItem.students.filter(student=>(includeArchived||!student.archived)&&(!presentOnly||student.present))}
function rosterSignature(classItem=getSelectedClass()){return classStudents(classItem,{presentOnly:true}).map(item=>item.id).sort().join('|')}
function resetClassDraw(classItem=getSelectedClass()){if(!classItem)return;classItem.drawState={remainingIds:[],cycle:Number(classItem.drawState?.cycle||0),lastDraw:null}}
function touchClass(classItem,{rosterChanged=false,attendanceChanged=false}={}){
  classItem.updatedAt=nowIso();
  if(rosterChanged){
    resetClassDraw(classItem);
    classItem.currentGroups=[];
    classItem.seatingPlan.seats=classItem.seatingPlan.seats.map(seat=>({...seat,studentId:null,locked:false}));
    return;
  }
  if(attendanceChanged)syncDrawDeck(classItem);
}
function makeStudent(firstName,lastName){firstName=titleCase(firstName);lastName=titleCase(lastName);return sanitizeStudent({id:uid('student'),firstName,lastName,present:true,archived:false,groupLevel:'B',frontPreference:false,createdAt:nowIso(),updatedAt:nowIso()})}
function createClass({name,schoolYear='',students=[]}){const classItem=sanitizeClass({id:uid('class'),name:String(name||'Nová třída').trim(),schoolYear:String(schoolYear||'').trim(),students,createdAt:nowIso(),updatedAt:nowIso()});App.data.classes.unshift(classItem);App.data.selectedClassId=classItem.id;saveData({event:'class_create'});recordEvent('class_create',{studentCount:classItem.students.length});return classItem}
function updateClassMeta(classId,{name,schoolYear}){const item=App.data.classes.find(entry=>entry.id===classId);if(!item)return false;if(name?.trim())item.name=name.trim();if(schoolYear!==undefined)item.schoolYear=String(schoolYear).trim();touchClass(item);saveData({event:'class_update'});return true}
function duplicateClass(classId){const source=App.data.classes.find(item=>item.id===classId);if(!source)return null;const copy=createClass({name:`${source.name} – kopie`,schoolYear:source.schoolYear,students:source.students.filter(s=>!s.archived).map(s=>sanitizeStudent({...s,id:uid('student'),createdAt:nowIso(),updatedAt:nowIso()}))});copy.roleCatalog=[...source.roleCatalog];copy.topicCatalog=[...source.topicCatalog];saveData({event:'class_duplicate'});return copy}
function archiveClass(classId,archived=true){const item=App.data.classes.find(entry=>entry.id===classId);if(!item)return false;item.archived=archived;touchClass(item);if(archived&&App.data.selectedClassId===classId)App.data.selectedClassId=getClasses().find(entry=>entry.id!==classId)?.id||null;saveData({event:archived?'class_archive':'class_restore'});return true}
function deleteClass(classId){const index=App.data.classes.findIndex(item=>item.id===classId);if(index<0)return false;App.data.classes.splice(index,1);if(App.data.selectedClassId===classId)App.data.selectedClassId=getClasses().find(Boolean)?.id||null;saveData({event:'class_delete'});recordEvent('class_delete');return true}
function duplicateNameError(message){const error=new Error(message);error.code='DUPLICATE_STUDENT_NAME';return error}
function addStudent(classId,firstName,lastName,{allowDuplicate=false}={}){const item=App.data.classes.find(entry=>entry.id===classId);if(!item)return null;const student=makeStudent(firstName,lastName);if(!student)return null;if(!allowDuplicate&&item.students.some(entry=>!entry.archived&&entry.key===student.key))throw duplicateNameError('Student se stejným jménem už ve třídě je. Přidat jej přesto?');item.students.push(student);touchClass(item,{rosterChanged:true});saveData({event:'student_add'});return student}
function updateStudent(classId,studentId,patch={}, {allowDuplicate=false}={}){
  const classItem=App.data.classes.find(entry=>entry.id===classId);
  const student=classItem?.students.find(entry=>entry.id===studentId);
  if(!student)return false;
  const rosterChanged=['firstName','lastName','archived'].some(key=>key in patch);
  const attendanceChanged='present'in patch;
  const nextFirst='firstName'in patch?titleCase(patch.firstName):student.firstName;
  const nextLast='lastName'in patch?titleCase(patch.lastName):student.lastName;
  const nextKey=normalizeText(`${nextFirst} ${nextLast}`);
  if(!allowDuplicate&&rosterChanged&&!('archived'in patch&&patch.archived)&&classItem.students.some(entry=>entry.id!==studentId&&!entry.archived&&entry.key===nextKey))throw duplicateNameError('Jiný student se stejným jménem už ve třídě je. Uložit přesto?');
  if('firstName'in patch)student.firstName=nextFirst;
  if('lastName'in patch)student.lastName=nextLast;
  if('present'in patch)student.present=!!patch.present;
  if('archived'in patch)student.archived=!!patch.archived;
  if('groupLevel'in patch&&['A','B','C'].includes(patch.groupLevel))student.groupLevel=patch.groupLevel;
  if('frontPreference'in patch)student.frontPreference=!!patch.frontPreference;
  student.displayName=`${student.firstName} ${student.lastName}`.trim();
  student.key=normalizeText(student.displayName);
  student.updatedAt=nowIso();
  touchClass(classItem,{rosterChanged,attendanceChanged});
  saveData({event:'student_update'});
  return true;
}
function removeStudent(classId,studentId){const classItem=App.data.classes.find(entry=>entry.id===classId);if(classItem){classItem.groupRules.together=classItem.groupRules.together.filter(pair=>!pair.includes(studentId));classItem.groupRules.apart=classItem.groupRules.apart.filter(pair=>!pair.includes(studentId));delete classItem.groupRules.pins[studentId]}return updateStudent(classId,studentId,{archived:true,present:false})}
function setAllPresence(classId,present){
  const classItem=App.data.classes.find(entry=>entry.id===classId);
  if(!classItem)return;
  const changedAt=nowIso();
  classItem.students.filter(s=>!s.archived).forEach(student=>{student.present=present;student.updatedAt=changedAt});
  touchClass(classItem,{attendanceChanged:true});
  saveData({event:'attendance_all'});
  recordEvent('attendance_change',{present});
}

;
const ROUTES=new Set(['overview','classes','draw','groups','roles','seating','tools','settings','about']);
function activateRoute(route,{save=true,scroll=true}={}){if(!ROUTES.has(route))route='overview';App.route=route;$$('.view').forEach(view=>view.classList.toggle('active',view.dataset.view===route));$$('[data-route]').forEach(item=>{const active=item.dataset.route===route;if(item.classList.contains('nav-item'))item.classList.toggle('active',active);item.setAttribute('aria-current',active?'page':'false')});if(save&&history.replaceState){try{history.replaceState(null,'',`#${route}`)}catch(_){/* Vykreslení nesmí zablokovat nedostupná History API. */}}if(save)saveSettings();if(scroll)window.scrollTo({top:0,behavior:App.settings.motion?'smooth':'auto'});renderRoute(route);refreshAccessibilityLabels();recordEvent('navigation',{route})}
function renderRoute(route){if(route==='overview')renderDashboard();if(route==='classes')renderClassesView();if(route==='draw')renderDrawView();if(route==='groups')renderGroupsView();if(route==='roles')renderRolesView();if(route==='seating')renderSeatingView();if(route==='tools')renderToolsView();if(route==='settings')renderSettingsDataSummary()}
function bindNavigation(){document.addEventListener('click',event=>{const target=event.target.closest('[data-route]');if(!target)return;event.preventDefault();activateRoute(target.dataset.route)});window.addEventListener('hashchange',()=>activateRoute(location.hash.slice(1),{save:false}))}

;
function activeRosterStats(classItem=getSelectedClass()){const all=classStudents(classItem);const present=all.filter(s=>s.present);return{all:all.length,present:present.length,absent:all.length-present.length}}
function totalStudentCount(){return getClasses().reduce((sum,item)=>sum+classStudents(item).length,0)}
function localDateKey(value=new Date()){const date=value instanceof Date?value:new Date(value);if(Number.isNaN(date.getTime()))return'';const year=date.getFullYear();const month=String(date.getMonth()+1).padStart(2,'0');const day=String(date.getDate()).padStart(2,'0');return`${year}-${month}-${day}`}
function drawsToday(){const day=localDateKey();return getClasses({includeArchived:true}).reduce((sum,item)=>sum+item.drawHistory.filter(entry=>localDateKey(entry.createdAt)===day).length,0)}
function ensureSelectedClass(){if(getSelectedClass())return getSelectedClass();const first=getClasses()[0]||null;if(first){App.data.selectedClassId=first.id;saveData({render:false,event:'class_auto_select'})}return first}

;
function renderDashboard(){const classes=getClasses();const selected=getSelectedClass();const stats=activeRosterStats(selected);const mapping={classCount:classes.length,studentCount:totalStudentCount(),drawCount:drawsToday(),activeClass:selected?.name||'—',activePresent:stats.present,activeTotal:stats.all};for(const[id,value]of Object.entries(mapping)){$$(`[data-stat="${id}"]`).forEach(node=>node.textContent=value)}const panel=$('#activeClassPanel');if(panel){panel.innerHTML=selected?`<div><span>AKTIVNÍ TŘÍDA</span><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.schoolYear||'Školní rok není uveden')} · ${stats.present} přítomných z ${stats.all}</p></div><div class="active-class-actions"><button class="small-button" data-route="classes">Docházka</button><button class="primary-button compact" data-route="draw">Losovat</button></div>`:`<div><span>ZAČÍNÁME</span><h3>Vytvořte první třídu</h3><p>Zkopírujte seznam školních e-mailů z IS. SORTIO z něj připraví jména ke kontrole.</p></div><button class="primary-button compact" data-action="open-import">Importovat z IS</button>`}}

;
function splitImportTokens(raw=''){const text=String(raw).trim();if(!text)return[];return text.split(/[,;\n\r\t ]+/).map(item=>item.trim()).filter(Boolean)}
function aliasValue(raw){return App.data.aliases[normalizeText(raw).replace(/ /g,'_')]||''}
function applyAlias(raw,fallback){return aliasValue(raw)||fallback}
function cleanImportPart(value=''){return String(value).replace(/\d+$/,'')}
function parseImportToken(token,index=0,{nameOrder=App.ui.importNameOrder||'first-last'}={}){const original=String(token).trim();const at=original.indexOf('@');let local=at>=0?original.slice(0,at):original;if(at>=0&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(original))return{valid:false,original,reason:'Neplatný formát e-mailu'};local=local.replace(/\+.*/,'').trim().replace(/^mailto:/i,'');const parts=local.split(/[._]+/).filter(Boolean).map(cleanImportPart).filter(Boolean);if(parts.length<2)return{valid:false,original,reason:'Chybí oddělení jména a příjmení tečkou'};const firstPart=parts.shift();const remaining=parts.join(' ');const rawFirst=nameOrder==='last-first'?remaining:firstPart;const rawLast=nameOrder==='last-first'?firstPart:remaining;const firstName=titleCase(applyAlias(rawFirst,titleCase(rawFirst)));const lastName=titleCase(applyAlias(rawLast,titleCase(rawLast)));if(!firstName||!lastName)return{valid:false,original,reason:'Jméno nebylo rozpoznáno'};return{valid:true,id:`preview-${index}-${normalizeText(local).replace(/ /g,'-')}`,original,local,rawFirst,rawLast,firstName,lastName,displayName:`${firstName} ${lastName}`,key:normalizeText(`${firstName} ${lastName}`),duplicate:false}}
function parseImport(raw,options={}){const tokens=splitImportTokens(raw);const rows=[];const invalid=[];const seen=new Set();tokens.forEach((token,index)=>{const result=parseImportToken(token,index,options);if(!result.valid){invalid.push(result);return}const sourceKey=normalizeText(result.local);if(seen.has(sourceKey)){result.duplicate=true;invalid.push({...result,valid:false,reason:'Duplicitní položka v importu'});return}seen.add(sourceKey);rows.push(result)});return{rows,invalid,total:tokens.length}}
function rememberImportAliases(rows){for(const row of rows){const firstKey=normalizeText(row.rawFirst).replace(/ /g,'_');const lastKey=normalizeText(row.rawLast).replace(/ /g,'_');if(firstKey&&row.firstName!==titleCase(row.rawFirst))App.data.aliases[firstKey]=row.firstName;if(lastKey&&row.lastName!==titleCase(row.rawLast))App.data.aliases[lastKey]=row.lastName}}
function importStudentsToClass({className,schoolYear,mode='new',replace=false,rows=[]}){const clean=[];const seen=new Set();for(const row of rows){const student=makeStudent(row.firstName,row.lastName);const sourceKey=normalizeText(row.local||`${row.firstName} ${row.lastName}`);if(!student||seen.has(sourceKey))continue;seen.add(sourceKey);clean.push(student)}if(!clean.length)throw new Error('Import neobsahuje žádné platné studenty.');rememberImportAliases(rows);if(mode==='new'){const classItem=createClass({name:className||'Nová třída',schoolYear,students:clean});recordEvent('class_import',{mode:'new',studentCount:clean.length});return classItem}const target=getSelectedClass();if(!target)throw new Error('Nejprve vyberte třídu, kterou chcete aktualizovat.');const existingByKey=new Map(target.students.map(s=>[s.key,s]));const incomingKeys=new Set(clean.map(s=>s.key));let added=0;let restored=0;for(const student of clean){const existing=existingByKey.get(student.key);if(existing){if(existing.archived)restored++;existing.present=true;existing.archived=false;existing.updatedAt=nowIso()}else{target.students.push(student);added++}}let archived=0;if(replace){for(const student of target.students){if(!student.archived&&!incomingKeys.has(student.key)){student.archived=true;student.present=false;student.updatedAt=nowIso();archived++}}}if(className?.trim())target.name=className.trim();if(schoolYear!==undefined)target.schoolYear=String(schoolYear).trim();touchClass(target,{rosterChanged:true});saveData({event:'class_import_update'});recordEvent('class_import',{mode:'update',added,archived,studentCount:clean.length});return{classItem:target,added,archived,restored}}

;
const MODULES=[
{id:'core',name:'Jádro aplikace',status:'ready',package:'Balíček 1'},
{id:'storage',name:'Lokální datová vrstva',status:'ready',package:'Balíček 1'},
{id:'classes',name:'Třídy a import z IS',status:'ready',package:'Balíček 2'},
{id:'draw',name:'Losování',status:'ready',package:'Balíček 2'},
{id:'groups',name:'Chytré skupiny a pravidla',status:'ready',package:'Balíček 3'},
{id:'roles',name:'Role, témata a úkoly',status:'ready',package:'Balíček 3'},
{id:'seating',name:'Zasedací pořádek',status:'ready',package:'Balíček 3'},
{id:'projection',name:'Bezpečný projekční režim',status:'ready',package:'Balíček 4'},
{id:'tools',name:'Třídní nástroje',status:'ready',package:'Balíček 4'},
{id:'history',name:'Spravedlivé zapojování',status:'ready',package:'Balíček 4'},
{id:'exports',name:'PDF a tisk',status:'ready',package:'Balíček 4'},
{id:'resilience',name:'Odolnost dat a bezpečné zálohy',status:'ready',package:'Balíček 5'},
{id:'diagnostics',name:'Produkční diagnostika',status:'ready',package:'Balíček 5'},
{id:'accessibility',name:'Přístupnost a klávesové ovládání',status:'ready',package:'Balíček 5'},
{id:'qa',name:'Interní testovací centrum',status:'ready',package:'Balíček 5'}
];
function renderRoadmap(){const root=$('#roadmapGrid');if(!root)return;root.innerHTML=MODULES.map(item=>`<article class="roadmap-card ${item.status}"><span>${item.package}</span><h3>${item.name}</h3><small>${item.status==='ready'?'Aktivní':'Další etapa'}</small></article>`).join('')}

;
function renderClassesView(){renderClassRail();renderSelectedClass();renderImportPreview()}
function renderClassRail(){const root=$('#classRail');if(!root)return;const active=getClasses();const archived=getClasses({includeArchived:true}).filter(item=>item.archived);root.innerHTML=`<div class="class-rail-heading"><div><span>MOJE TŘÍDY</span><b>${active.length}</b></div><button class="round-action" data-action="new-class" title="Nová prázdná třída">＋</button></div><div class="class-list">${active.length?active.map(classRailCard).join(''):'<div class="empty-mini">Zatím zde není žádná třída.</div>'}</div>${archived.length?`<details class="archive-list"><summary>Archivované (${archived.length})</summary>${archived.map(item=>`<button data-action="restore-class" data-id="${item.id}"><span>${escapeHtml(item.name)}</span><small>Obnovit</small></button>`).join('')}</details>`:''}`}
function classRailCard(item){const stats=activeRosterStats(item);return`<button class="class-rail-card ${item.id===App.data.selectedClassId?'active':''}" data-action="select-class" data-id="${item.id}"><span class="class-avatar">${escapeHtml(item.name.slice(0,2).toLocaleUpperCase('cs-CZ'))}</span><span><b>${escapeHtml(item.name)}</b><small>${stats.present}/${stats.all} přítomných</small></span><i>›</i></button>`}
function renderSelectedClass(){const root=$('#classWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=`<article class="empty-state premium-empty"><div class="empty-mark">S</div><span>PRVNÍ KROK</span><h2>Vložte skupinu z IS</h2><p>Zkopírujte e-mailové adresy celé skupiny, zkontrolujte rozpoznaná jména a uložte třídu. E-mailové adresy se po potvrzení neuchovávají.</p><div><button class="primary-button" data-action="open-import">Importovat z IS</button><button class="secondary-button" data-action="new-class">Založit ručně</button></div></article>`;return}const stats=activeRosterStats(classItem);const query=normalizeText(App.ui.studentSearch);const students=classStudents(classItem).filter(student=>!query||normalizeText(student.displayName).includes(query));root.innerHTML=`<div class="class-workspace-head"><div><span>AKTIVNÍ TŘÍDA</span><h2>${escapeHtml(classItem.name)}</h2><p>${escapeHtml(classItem.schoolYear||'Bez školního roku')} · ${stats.present} přítomných · ${stats.absent} nepřítomných</p></div><div class="workspace-actions"><button class="secondary-button compact" data-action="edit-class">Upravit</button><button class="primary-button compact" data-action="open-import-update">Aktualizovat z IS</button></div></div><div class="attendance-toolbar"><label class="student-search"><span>⌕</span><input id="studentSearch" type="search" placeholder="Hledat studenta" value="${escapeHtml(App.ui.studentSearch)}"></label><div><button class="small-button" data-action="all-present">Všichni přítomni</button><button class="small-button" data-action="all-absent">Všichni nepřítomni</button></div></div><div class="student-table"><div class="student-table-head"><span>Student</span><span>Docházka</span><span></span></div>${students.length?students.map(studentRow).join(''):'<div class="empty-mini wide">Hledání neodpovídá žádnému studentovi.</div>'}</div><form class="quick-add" id="quickAddStudent"><div><span>RYCHLÉ PŘIDÁNÍ</span><p>Jméno lze po přidání upravit.</p></div><input name="firstName" autocomplete="off" placeholder="Jméno" required><input name="lastName" autocomplete="off" placeholder="Příjmení" required><button class="small-button" type="submit">Přidat</button></form><div class="class-danger-actions"><button data-action="duplicate-class">Vytvořit kopii</button><button data-action="archive-class">Archivovat třídu</button><button class="danger-text" data-action="delete-class">Smazat třídu</button></div>`}
function studentRow(student){return`<div class="student-row" data-student-id="${student.id}"><span class="student-name"><i>${escapeHtml(`${student.firstName[0]||''}${student.lastName[0]||''}`)}</i><b>${escapeHtml(student.displayName)}</b></span><label class="presence-toggle"><input type="checkbox" data-action="toggle-presence" data-id="${student.id}" ${student.present?'checked':''}><span>${student.present?'Přítomen':'Nepřítomen'}</span></label><span class="row-actions"><button title="Upravit jméno" data-action="edit-student" data-id="${student.id}">✎</button><button title="Odebrat ze třídy" data-action="remove-student" data-id="${student.id}">×</button></span></div>`}
function openClassDialog(mode='new'){const dialog=$('#classDialog');const classItem=getSelectedClass();$('#classDialogTitle').textContent=mode==='edit'?'Upravit třídu':'Nová prázdná třída';$('#classDialogMode').value=mode;$('#classNameInput').value=mode==='edit'?(classItem?.name||''):'';$('#schoolYearInput').value=mode==='edit'?(classItem?.schoolYear||''):suggestSchoolYear();dialog.showModal();setTimeout(()=>$('#classNameInput').focus(),50)}
function suggestSchoolYear(){const date=new Date();const year=date.getFullYear();const start=date.getMonth()>=7?year:year-1;return`${start}/${start+1}`}
function openImportDialog(mode='new'){const dialog=$('#importDialog');const selected=getSelectedClass();App.ui.importRows=[];App.ui.importInvalid=[];$('#importMode').value=mode;$('#importDialogTitle').textContent=mode==='update'?'Aktualizovat třídu z IS':'Importovat novou třídu z IS';$('#importClassName').value=mode==='update'?(selected?.name||''):'';$('#importSchoolYear').value=mode==='update'?(selected?.schoolYear||suggestSchoolYear()):suggestSchoolYear();$('#importReplaceRow').hidden=mode!=='update';$('#replaceRoster').checked=false;$('#importNameOrder').value=App.ui.importNameOrder||'first-last';$('#isPaste').value='';renderImportPreview();dialog.showModal();setTimeout(()=>$('#isPaste').focus(),50)}
function renderImportPreview(){const root=$('#importPreview');if(!root)return;const rows=App.ui.importRows||[];const invalid=App.ui.importInvalid||[];$('#importCount')&&( $('#importCount').textContent=rows.length);root.innerHTML=rows.length?`<div class="import-preview-head"><span>#</span><span>Jméno</span><span>Příjmení</span><span>Stav</span></div>${rows.map((row,index)=>`<div class="import-preview-row" data-preview-id="${row.id}"><span>${index+1}</span><input data-field="firstName" value="${escapeHtml(row.firstName)}" aria-label="Jméno ${index+1}"><input data-field="lastName" value="${escapeHtml(row.lastName)}" aria-label="Příjmení ${index+1}"><span class="import-ok">Rozpoznáno</span></div>`).join('')}`:`<div class="import-placeholder"><span>⌁</span><b>Vložte seznam e-mailů</b><p>Podporujeme čárky, středníky, mezery i nové řádky.</p></div>`;const warning=$('#importWarnings');if(warning){warning.hidden=!invalid.length;warning.innerHTML=invalid.length?`<b>${invalid.length} položek vyžaduje pozornost</b>${invalid.slice(0,6).map(item=>`<span>${escapeHtml(item.original)} – ${escapeHtml(item.reason)}</span>`).join('')}`:''}const save=$('#saveImport');if(save)save.disabled=!rows.length}
function bindClassUi(){document.addEventListener('input',event=>{if(event.target.id==='studentSearch'){App.ui.studentSearch=event.target.value;renderSelectedClass()}const preview=event.target.closest('.import-preview-row');if(preview&&event.target.dataset.field){const row=App.ui.importRows.find(item=>item.id===preview.dataset.previewId);if(row){row[event.target.dataset.field]=titleCase(event.target.value);row.displayName=`${row.firstName} ${row.lastName}`.trim();row.key=normalizeText(row.displayName)}}});document.addEventListener('change',event=>{if(event.target.dataset.action==='toggle-presence'){updateStudent(getSelectedClass()?.id,event.target.dataset.id,{present:event.target.checked});recordEvent('attendance_change',{present:event.target.checked})}if(event.target.id==='importNameOrder'){App.ui.importNameOrder=event.target.value;if($('#isPaste')?.value.trim()){const parsed=parseImport($('#isPaste').value,{nameOrder:App.ui.importNameOrder});App.ui.importRows=parsed.rows;App.ui.importInvalid=parsed.invalid;renderImportPreview()}}});document.addEventListener('submit',event=>{if(event.target.id==='quickAddStudent'){event.preventDefault();const data=new FormData(event.target);try{addStudent(getSelectedClass().id,data.get('firstName'),data.get('lastName'));event.target.reset();toast('Student byl přidán.','success')}catch(error){if(error.code==='DUPLICATE_STUDENT_NAME'&&confirm(error.message)){addStudent(getSelectedClass().id,data.get('firstName'),data.get('lastName'),{allowDuplicate:true});event.target.reset();toast('Jmenovec byl přidán.','success')}else if(error.code!=='DUPLICATE_STUDENT_NAME')toast(error.message,'error')}}if(event.target.id==='classForm'){event.preventDefault();const mode=$('#classDialogMode').value;const name=$('#classNameInput').value.trim();const schoolYear=$('#schoolYearInput').value.trim();if(!name)return;if(mode==='edit')updateClassMeta(getSelectedClass().id,{name,schoolYear});else createClass({name,schoolYear,students:[]});$('#classDialog').close();toast(mode==='edit'?'Třída byla upravena.':'Třída byla vytvořena.','success')}});document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;const classItem=getSelectedClass();if(action==='open-import')openImportDialog('new');if(action==='open-import-update')openImportDialog('update');if(action==='new-class')openClassDialog('new');if(action==='edit-class')openClassDialog('edit');if(action==='select-class')setSelectedClass(button.dataset.id);if(action==='restore-class'){archiveClass(button.dataset.id,false);setSelectedClass(button.dataset.id);toast('Třída byla obnovena.','success')}if(action==='all-present')setAllPresence(classItem.id,true);if(action==='all-absent')setAllPresence(classItem.id,false);if(action==='duplicate-class'){duplicateClass(classItem.id);toast('Kopie třídy byla vytvořena.','success')}if(action==='archive-class'){if(!App.settings.confirmDestructive||confirm(`Archivovat třídu ${classItem.name}?`)){archiveClass(classItem.id,true);toast('Třída byla přesunuta do archivu.','success')}}if(action==='delete-class'){if(!App.settings.confirmDestructive||confirm(`Trvale smazat třídu ${classItem.name} včetně historie?`)){deleteClass(classItem.id);toast('Třída byla smazána.','success')}}if(action==='remove-student'){const student=classItem.students.find(item=>item.id===button.dataset.id);if(student&&(!App.settings.confirmDestructive||confirm(`Odebrat ${student.displayName} ze třídy?`)))removeStudent(classItem.id,student.id)}if(action==='edit-student'){const student=classItem.students.find(item=>item.id===button.dataset.id);if(!student)return;const value=prompt('Upravte jméno a příjmení:',student.displayName);if(value?.trim()){const parts=value.trim().split(/\s+/);const patch={firstName:parts.shift(),lastName:parts.join(' ')};try{updateStudent(classItem.id,student.id,patch)}catch(error){if(error.code==='DUPLICATE_STUDENT_NAME'&&confirm(error.message))updateStudent(classItem.id,student.id,patch,{allowDuplicate:true});else if(error.code!=='DUPLICATE_STUDENT_NAME')toast(error.message,'error')}}}if(action==='parse-import'){App.ui.importNameOrder=$('#importNameOrder')?.value||'first-last';const parsed=parseImport($('#isPaste').value,{nameOrder:App.ui.importNameOrder});App.ui.importRows=parsed.rows;App.ui.importInvalid=parsed.invalid;renderImportPreview();toast(`Rozpoznáno ${parsed.rows.length} studentů.`,parsed.rows.length?'success':'error')}if(action==='save-import'){try{const mode=$('#importMode').value;const result=importStudentsToClass({className:$('#importClassName').value,schoolYear:$('#importSchoolYear').value,mode,replace:$('#replaceRoster').checked,rows:App.ui.importRows});App.ui.importRows=[];App.ui.importInvalid=[];$('#isPaste').value='';$('#importDialog').close();toast(mode==='new'?`Třída byla vytvořena (${result.students.length} studentů).`:`Třída byla aktualizována: +${result.added}, archivováno ${result.archived}.`,'success');activateRoute('classes')}catch(error){toast(error.message,'error')}}if(action==='close-dialog')button.closest('dialog')?.close()})}

;
function renderSettingsDataSummary(){const classes=getClasses({includeArchived:true});const active=getClasses();const students=classes.reduce((sum,item)=>sum+classStudents(item,{includeArchived:true}).length,0);const draws=classes.reduce((sum,item)=>sum+item.drawHistory.length,0);const groups=classes.reduce((sum,item)=>sum+item.groupHistory.length,0);const roles=classes.reduce((sum,item)=>sum+item.roleHistory.length,0);const seating=classes.filter(item=>item.seatingPlan?.seats?.some(seat=>seat.studentId)).length;const engagement=classes.reduce((sum,item)=>sum+(item.engagementHistory?.length||0),0);const values={storedClasses:active.length,archivedClasses:classes.length-active.length,storedStudents:students,storedDraws:draws,storedGroups:groups,storedRoles:roles,storedSeating:seating,storedEngagement:engagement};for(const[id,value]of Object.entries(values)){const node=$(`[data-data-stat="${id}"]`);if(node)node.textContent=value}const confirmInput=$('#confirmSetting');if(confirmInput)confirmInput.checked=App.settings.confirmDestructive!==false}
function bindSettings(){
  const themeSegment=$('#themeSegment');
  themeSegment?.addEventListener('click',event=>{
    const button=event.target.closest('[data-value]');
    if(!button)return;
    App.settings.theme=button.dataset.value;
    applyTheme();
    saveSettings();
  });
  $('#motionSetting')?.addEventListener('change',event=>{
    App.settings.motion=event.target.checked;
    applyMotion();
    saveSettings();
  });
  $('#confirmSetting')?.addEventListener('change',event=>{
    App.settings.confirmDestructive=event.target.checked;
    saveSettings();
  });
  $('#themeToggle')?.addEventListener('click',()=>{
    const order=['dark','light','system'];
    App.settings.theme=order[(order.indexOf(App.settings.theme)+1)%order.length];
    applyTheme();
    saveSettings();
    toast(`Motiv: ${App.settings.theme==='dark'?'tmavý':App.settings.theme==='light'?'světlý':'podle systému'}`,'success');
    recordEvent('setting_change',{setting:'theme',value:App.settings.theme});
  });
  $('#motionToggle')?.addEventListener('click',()=>{
    App.settings.motion=!App.settings.motion;
    applyMotion();
    saveSettings();
    recordEvent('setting_change',{setting:'motion',value:App.settings.motion});
  });
  $('#fullscreenBtn')?.addEventListener('click',async()=>{
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      recordEvent('fullscreen',{active:!!document.fullscreenElement});
    }catch(error){captureError(error,'fullscreen');toast('Celou obrazovku se nepodařilo aktivovat. Použijte F11.','error')}
  });
  $('#exportBackup')?.addEventListener('click',exportBackup);
  $('#backupFile')?.addEventListener('change',async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try{const imported=await importBackup(file);if(imported)toast('Záloha byla načtena.','success')}
    catch(error){toast(error.message,'error')}
    event.target.value='';
  });
  $('#clearAllData')?.addEventListener('click',()=>{
    if(!App.settings.confirmDestructive||confirm('Opravdu vymazat všechny třídy, historii, pravidla, role, skóre a zasedací plány?')){
      clearAllData();toast('Všechna lokální data byla vymazána.','success');
    }
  });
  $('#resetSettings')?.addEventListener('click',()=>{
    clearSettings();
    App.settings={theme:'dark',motion:true,confirmDestructive:true};
    applyTheme();applyMotion();renderSettingsDataSummary();
    toast('Preference byly obnoveny.','success');
  });
}
function applyTheme(){const preferred=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.dataset.theme=App.settings.theme==='system'?preferred:App.settings.theme;$$('#themeSegment button').forEach(button=>button.classList.toggle('active',button.dataset.value===App.settings.theme))}
function applyMotion(){
  document.documentElement.dataset.motion=App.settings.motion?'on':'off';
  const input=$('#motionSetting');
  if(input)input.checked=App.settings.motion;
  $('#motionToggle')?.classList.toggle('active',App.settings.motion);
}

;
function eligibleStudents(classItem=getSelectedClass()){return classStudents(classItem,{presentOnly:true})}
function syncDrawDeck(classItem=getSelectedClass()){
  if(!classItem)return[];
  const eligible=eligibleStudents(classItem);
  const eligibleIds=new Set(eligible.map(item=>item.id));
  const remaining=[];
  const seen=new Set();
  for(const id of classItem.drawState.remainingIds||[]){
    if(eligibleIds.has(id)&&!seen.has(id)){remaining.push(id);seen.add(id);}
  }
  if(Number(classItem.drawState.cycle||0)>0){
    const drawnThisCycle=new Set((classItem.drawHistory||[])
      .filter(item=>item.noRepeat&&Number(item.cycle||0)===Number(classItem.drawState.cycle||0))
      .flatMap(item=>item.selectedIds||[]));
    const newlyEligible=eligible.map(item=>item.id).filter(id=>!seen.has(id)&&!drawnThisCycle.has(id));
    remaining.push(...shuffle(newlyEligible));
  }
  classItem.drawState.remainingIds=remaining;
  return remaining;
}
function resetDrawCycle(classItem=getSelectedClass(),{persist=true}={}){if(!classItem)return;classItem.drawState.remainingIds=shuffle(eligibleStudents(classItem).map(item=>item.id));classItem.drawState.cycle=Number(classItem.drawState.cycle||0)+1;classItem.drawState.lastDraw=null;touchClass(classItem);if(persist)saveData({render:false,event:'draw_cycle_reset'});return classItem.drawState.remainingIds}
function resolveStudents(ids,classItem=getSelectedClass()){const map=new Map(classItem?.students.map(item=>[item.id,item])||[]);return ids.map(id=>map.get(id)).filter(Boolean)}
function performDraw({mode='single',count=1,noRepeat=true}={}){const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');const eligible=eligibleStudents(classItem);if(!eligible.length)throw new Error('Ve třídě není žádný přítomný student.');let selected=[];let exhausted=false;if(mode==='order'){selected=shuffle(eligible);if(noRepeat){classItem.drawState.remainingIds=[];exhausted=true}}else if(noRepeat){syncDrawDeck(classItem);if(!classItem.drawState.remainingIds.length)resetDrawCycle(classItem,{persist:false});count=Math.max(1,Math.min(Number(count)||1,classItem.drawState.remainingIds.length));const chosenIds=classItem.drawState.remainingIds.splice(0,count);selected=resolveStudents(chosenIds,classItem);exhausted=classItem.drawState.remainingIds.length===0}else{selected=shuffle(eligible).slice(0,Math.max(1,Math.min(Number(count)||1,eligible.length)))}const record={id:uid('draw'),createdAt:nowIso(),mode,count:selected.length,noRepeat,cycle:classItem.drawState.cycle||0,selectedIds:selected.map(item=>item.id),selectedNames:selected.map(item=>item.displayName)};classItem.drawState.lastDraw=record;classItem.drawHistory.unshift(record);classItem.drawHistory=classItem.drawHistory.slice(0,HISTORY_LIMITS.draw);touchClass(classItem);saveData({render:false,event:'draw_perform'});recordEvent('draw',{mode,count:selected.length,noRepeat,exhausted});return{selected,record,remaining:classItem.drawState.remainingIds.length,exhausted}}
function undoLastDraw(){const classItem=getSelectedClass();const last=classItem?.drawState?.lastDraw;if(!classItem||!last)return false;if(last.noRepeat){const eligibleIds=new Set(eligibleStudents(classItem).map(item=>item.id));const restore=last.selectedIds.filter(id=>eligibleIds.has(id)&&!classItem.drawState.remainingIds.includes(id));classItem.drawState.remainingIds=[...restore,...classItem.drawState.remainingIds]}classItem.drawHistory=classItem.drawHistory.filter(item=>item.id!==last.id);classItem.drawState.lastDraw=null;touchClass(classItem);saveData({render:false,event:'draw_undo'});recordEvent('draw_undo',{count:last.selectedIds.length});return true}

;
function renderDrawView(){const root=$('#drawWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=noClassMessage('Losování','Nejprve importujte nebo vytvořte třídu.');return}const roster=eligibleStudents(classItem);syncDrawDeck(classItem);const history=classItem.drawHistory.slice(0,8);const deckValue=classItem.drawState.cycle?classItem.drawState.remainingIds.length:roster.length;root.innerHTML=`<div class="draw-layout"><article class="draw-control-panel"><div class="context-label"><span>AKTIVNÍ TŘÍDA</span><b>${escapeHtml(classItem.name)}</b><small>${roster.length} přítomných</small></div><div class="control-block"><label>Způsob výběru</label><div class="segmented wide" id="drawModeSegment"><button data-draw-mode="single" class="${App.ui.drawMode==='single'?'active':''}">Jeden</button><button data-draw-mode="multiple" class="${App.ui.drawMode==='multiple'?'active':''}">Více</button><button data-draw-mode="order" class="${App.ui.drawMode==='order'?'active':''}">Pořadí</button></div></div><div class="control-block" id="drawCountBlock" ${App.ui.drawMode==='multiple'?'':'hidden'}><label for="drawCount">Počet studentů</label><div class="number-stepper"><button type="button" data-action="count-down">−</button><input id="drawCount" type="number" min="2" max="${Math.max(2,roster.length)}" value="${Math.max(2,Math.min(roster.length||2,Number(App.ui.drawCount)||2))}"><button type="button" data-action="count-up">＋</button></div></div><div class="control-block inline-control"><div><label>Bez opakování</label><p>Nový cyklus začne, až se balíček vyčerpá.</p></div><label class="switch"><input id="noRepeat" type="checkbox" ${App.ui.noRepeat!==false?'checked':''}><span></span></label></div><div class="deck-meter"><div><span>ZBÝVÁ V CYKLU</span><b id="deckRemaining">${deckValue}</b></div><div class="meter"><i style="width:${roster.length?Math.round((deckValue/roster.length)*100):0}%"></i></div><small>Cyklus ${classItem.drawState.cycle||1}</small></div><button class="primary-button draw-main-button" data-action="perform-draw">Spustit losování <span>◎</span></button><div class="draw-secondary-actions"><button class="small-button" data-action="undo-draw" ${classItem.drawState.lastDraw?'':'disabled'}>Vrátit poslední</button><button class="small-button" data-action="reset-draw">Nový cyklus</button></div></article><article class="draw-stage"><div class="draw-stage-orbit"><i></i><i></i><i></i></div><div class="draw-result" id="drawResult"><span>PŘIPRAVENO</span><h2>Koho vybereme?</h2><p>Výběr probíhá pouze mezi přítomnými studenty.</p></div><div class="draw-stage-footer"><span>Lokální výběr</span><b>Bez odesílání jmen</b></div></article></div><article class="history-panel"><div class="panel-heading"><div><span>POSLEDNÍ VÝBĚRY</span><h3>Historie třídy</h3></div><small>Ukládá se pouze v tomto prohlížeči</small></div><div class="history-list">${history.length?history.map(drawHistoryRow).join(''):'<div class="empty-mini wide">Zatím neproběhlo žádné losování.</div>'}</div></article>`;bindDrawModeLocal()}
function noClassMessage(title,text){return`<article class="empty-state premium-empty"><div class="empty-mark">S</div><span>${escapeHtml(title.toLocaleUpperCase('cs-CZ'))}</span><h2>Chybí aktivní třída</h2><p>${escapeHtml(text)}</p><button class="primary-button" data-route="classes">Přejít do tříd</button></article>`}
function drawHistoryRow(item){return`<div class="history-row"><span>${formatDateTime(item.createdAt)}</span><b>${escapeHtml(item.selectedNames.join(', '))}</b><small>${item.mode==='order'?'Pořadí celé třídy':item.noRepeat?'Bez opakování':'Volná náhoda'}</small></div>`}
function bindDrawModeLocal(){$$('[data-draw-mode]').forEach(button=>button.addEventListener('click',()=>{$$('[data-draw-mode]').forEach(item=>item.classList.remove('active'));button.classList.add('active');$('#drawCountBlock').hidden=button.dataset.drawMode!=='multiple'}))}
function currentDrawMode(){return $('[data-draw-mode].active')?.dataset.drawMode||'single'}
function refreshDrawHistory(){const classItem=getSelectedClass();const root=$('.history-list');if(root)root.innerHTML=classItem?.drawHistory?.length?classItem.drawHistory.slice(0,8).map(drawHistoryRow).join(''):'<div class="empty-mini wide">Zatím neproběhlo žádné losování.</div>'}
function showDrawResult(result){const root=$('#drawResult');if(!root)return;root.classList.remove('revealed');void root.offsetWidth;const names=result.selected.map(item=>item.displayName);root.innerHTML=result.selected.length===1?`<span>VYBRÁN/A</span><h2>${escapeHtml(names[0])}</h2><p>${result.exhausted?'Cyklus je dokončen. Příští losování otevře nový.':`V cyklu zbývá ${result.remaining} studentů.`}</p>`:`<span>${currentDrawMode()==='order'?'NÁHODNÉ POŘADÍ':'VYBRANÁ SKUPINA'}</span><ol>${names.map(name=>`<li>${escapeHtml(name)}</li>`).join('')}</ol><p>${result.exhausted?'Cyklus je dokončen.':`V cyklu zbývá ${result.remaining} studentů.`}</p>`;root.classList.add('revealed');refreshDrawHistory()}
function bindDrawUi(){document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(!['perform-draw','undo-draw','reset-draw','count-up','count-down'].includes(action))return;if(action==='count-up'||action==='count-down'){const input=$('#drawCount');if(!input)return;const delta=action==='count-up'?1:-1;input.value=Math.max(Number(input.min)||1,Math.min(Number(input.max)||99,(Number(input.value)||2)+delta));App.ui.drawCount=Number(input.value);return}if(action==='reset-draw'){resetDrawCycle();renderDrawView();toast('Byl zahájen nový cyklus losování.','success');return}if(action==='undo-draw'){if(undoLastDraw()){renderDrawView();toast('Poslední výběr byl vrácen do cyklu.','success')}return}if(action==='perform-draw'){try{button.disabled=true;button.classList.add('loading');const mode=currentDrawMode();const count=mode==='multiple'?Number($('#drawCount')?.value||2):mode==='order'?eligibleStudents().length:1;App.ui.drawMode=mode;App.ui.drawCount=count;App.ui.noRepeat=$('#noRepeat')?.checked!==false;const result=performDraw({mode,count,noRepeat:App.ui.noRepeat});setTimeout(()=>{showDrawResult(result);button.disabled=false;button.classList.remove('loading');const remaining=$('#deckRemaining');if(remaining)remaining.textContent=result.remaining;},App.settings.motion?620:0)}catch(error){button.disabled=false;button.classList.remove('loading');toast(error.message,'error')}}})}

;
function refreshAccessibilityLabels(){$$('button:not([aria-label])').forEach(button=>{const label=button.getAttribute('title')||button.textContent.trim();if(label)button.setAttribute('aria-label',label)});$$('dialog').forEach(dialog=>{dialog.setAttribute('aria-modal','true');const heading=dialog.querySelector('h1,h2,h3');if(heading){if(!heading.id)heading.id=`${dialog.id||uid('dialog')}-title`;dialog.setAttribute('aria-labelledby',heading.id)}})}
function enhanceAccessibility(){refreshAccessibilityLabels();const reduced=matchMedia('(prefers-reduced-motion: reduce)');if(reduced.matches&&!safeStorage()?.getItem(SETTINGS_KEY)){App.settings.motion=false;applyMotion()}reduced.addEventListener?.('change',event=>{if(event.matches){App.settings.motion=false;applyMotion()}})}

;
function groupLengths(total,{mode='size',value=4}={}){if(total<=0)return[];value=Math.max(2,Number(value)||2);const count=mode==='count'?Math.min(total,value):Math.ceil(total/value);const base=Math.floor(total/count);const extra=total%count;return Array.from({length:count},(_,index)=>base+(index<extra?1:0))}
const LEVEL_VALUE={A:3,B:2,C:1};
function pairKey(a,b){return[a,b].sort().join('|')}
function rulePairs(type,classItem=getSelectedClass()){return classItem?.groupRules?.[type]||[]}
function addPairRule(type,firstId,secondId){const classItem=getSelectedClass();if(!classItem||!['together','apart'].includes(type)||!firstId||!secondId||firstId===secondId)throw new Error('Vyberte dva různé studenty.');const opposite=type==='together'?'apart':'together';const key=pairKey(firstId,secondId);if(rulePairs(opposite,classItem).some(pair=>pairKey(...pair)===key))throw new Error('Stejná dvojice už má opačné pravidlo.');if(!rulePairs(type,classItem).some(pair=>pairKey(...pair)===key))classItem.groupRules[type].push([firstId,secondId]);saveData({event:`rule_${type}_add`});return true}
function removePairRule(type,index){const classItem=getSelectedClass();if(!classItem?.groupRules?.[type]?.[index])return false;classItem.groupRules[type].splice(index,1);saveData({event:`rule_${type}_remove`});return true}
function setStudentPin(studentId,groupIndex){const classItem=getSelectedClass();if(!classItem)return false;if(groupIndex===''||groupIndex===null||groupIndex===undefined)delete classItem.groupRules.pins[studentId];else classItem.groupRules.pins[studentId]=Math.max(0,Number(groupIndex)||0);saveData({event:'rule_pin'});return true}
function clearGroupRules(){const classItem=getSelectedClass();if(!classItem)return;classItem.groupRules={together:[],apart:[],pins:{}};saveData({event:'rules_clear'})}
function buildComponents(students,togetherPairs){const parent=new Map(students.map(student=>[student.id,student.id]));const find=id=>{let root=id;while(parent.get(root)!==root)root=parent.get(root);while(parent.get(id)!==id){const next=parent.get(id);parent.set(id,root);id=next}return root};const union=(a,b)=>{if(!parent.has(a)||!parent.has(b))return;const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra)};togetherPairs.forEach(([a,b])=>union(a,b));const groups=new Map();for(const student of students){const root=find(student.id);if(!groups.has(root))groups.set(root,[]);groups.get(root).push(student)}return[...groups.values()]}
function previousPairCounts(classItem){const counts=new Map();for(const set of classItem.groupHistory||[]){for(const group of set.groups||[]){const ids=Array.isArray(group.studentIds)?group.studentIds:[];for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const key=pairKey(ids[i],ids[j]);counts.set(key,(counts.get(key)||0)+1)}}}return counts}
function validateGroupConfiguration(classItem,students,lengths){const activeIds=new Set(students.map(item=>item.id));const components=buildComponents(students,rulePairs('together',classItem).filter(pair=>pair.every(id=>activeIds.has(id))));const apart=new Set(rulePairs('apart',classItem).filter(pair=>pair.every(id=>activeIds.has(id))).map(pair=>pairKey(...pair)));for(const component of components){if(component.length>Math.max(...lengths))return`Skupina studentů spojených pravidlem „spolu“ má ${component.length} členů, ale největší cílová skupina má ${Math.max(...lengths)}.`;for(let i=0;i<component.length;i++)for(let j=i+1;j<component.length;j++)if(apart.has(pairKey(component[i].id,component[j].id)))return`Studenti ${component[i].displayName} a ${component[j].displayName} mají současně pravidlo „spolu“ i „od sebe“.`;const pins=[...new Set(component.map(student=>classItem.groupRules.pins[student.id]).filter(Number.isInteger))];if(pins.length>1)return`Studenti spojení pravidlem „spolu“ jsou připnuti do různých skupin.`;if(pins.some(index=>index>=lengths.length))return`Připnutí odkazuje na skupinu, která při tomto rozdělení neexistuje.`}return null}
function partitionScore(groups,smartMode,historyCounts){
  let score=0;
  for(const group of groups){
    const members=group.students;
    if(!members.length)continue;
    const values=members.map(item=>LEVEL_VALUE[item.groupLevel]||2);
    const avg=values.reduce((a,b)=>a+b,0)/values.length;
    if(smartMode==='balanced')score+=Math.abs(avg-2)*22;
    if(smartMode==='homogeneous'){
      const variance=values.reduce((sum,value)=>sum+(value-avg)**2,0)/values.length;
      score+=variance*30;
    }
    if(smartMode==='history'){
      for(let i=0;i<members.length;i++)for(let j=i+1;j<members.length;j++)score+=(historyCounts.get(pairKey(members[i].id,members[j].id))||0)*15;
    }
    score+=randomInt(1000000)/1000000*.15;
  }
  return score;
}
function solveSmartPartition(classItem,students,lengths,smartMode='random',{lockedGroups=[]}={}){const activeIds=new Set(students.map(item=>item.id));const together=rulePairs('together',classItem).filter(pair=>pair.every(id=>activeIds.has(id)));const apartSet=new Set(rulePairs('apart',classItem).filter(pair=>pair.every(id=>activeIds.has(id))).map(pair=>pairKey(...pair)));const issue=validateGroupConfiguration(classItem,students,lengths);if(issue)throw new Error(issue);const components=buildComponents(students,together);const componentOf=new Map();components.forEach((component,index)=>component.forEach(student=>componentOf.set(student.id,index)));const lockedByComponent=new Map();
lockedGroups.forEach((group,index)=>{
  if(!group)return;
  group.studentIds.forEach(id=>{
    const componentIndex=componentOf.get(id);
    if(componentIndex===undefined)return;
    lockedByComponent.set(componentIndex,index);
  });
});
for(const [componentIndex,groupIndex]of lockedByComponent){
  const component=components[componentIndex];
  const locked=lockedGroups[groupIndex];
  if(!component||!locked)continue;
  if(component.some(student=>!locked.studentIds.includes(student.id)))throw new Error('Uzamčená skupina odděluje studenty, kteří mají být spolu. Odemkněte ji.');
}
const historyCounts=previousPairCounts(classItem);let best=null;const maxTrials=Math.min(700,Math.max(160,students.length*18));for(let trial=0;trial<maxTrials;trial++){const groups=lengths.map((capacity,index)=>({index,capacity,students:[],locked:false}));let invalid=false;for(let index=0;index<lockedGroups.length;index++){const locked=lockedGroups[index];if(!locked)continue;groups[index].students=resolveStudents(locked.studentIds,classItem);groups[index].locked=true;if(groups[index].students.length>groups[index].capacity){invalid=true;break}}if(invalid)continue;const usedComponents=new Set(lockedByComponent.keys());let pending=components.map((component,index)=>({component,index,size:component.length,level:component.reduce((sum,s)=>sum+(LEVEL_VALUE[s.groupLevel]||2),0)/component.length,degree:rulePairs('apart',classItem).filter(pair=>pair.some(id=>component.some(s=>s.id===id))).length,pin:[...new Set(component.map(student=>classItem.groupRules.pins[student.id]).filter(Number.isInteger))][0]})).filter(item=>!usedComponents.has(item.index));pending=shuffle(pending).sort((a,b)=>(Number.isInteger(b.pin)-Number.isInteger(a.pin))||b.size-a.size||b.degree-a.degree||(smartMode==='homogeneous'?b.level-a.level:0));for(const item of pending){const choices=groups.filter(group=>!group.locked&&group.students.length+item.size<=group.capacity&&(item.pin===undefined||item.pin===group.index)&&item.component.every(student=>group.students.every(member=>!apartSet.has(pairKey(student.id,member.id)))));if(!choices.length){invalid=true;break}const ranked=choices.map(group=>{let local=randomInt(1000000)/1000000*4;const projected=[...group.students,...item.component];const values=projected.map(student=>LEVEL_VALUE[student.groupLevel]||2);const avg=values.reduce((a,b)=>a+b,0)/values.length;if(smartMode==='balanced')local+=Math.abs(avg-2)*30;if(smartMode==='homogeneous'&&group.students.length){const currentAvg=group.students.reduce((sum,s)=>sum+(LEVEL_VALUE[s.groupLevel]||2),0)/group.students.length;local+=Math.abs(currentAvg-item.level)*28}if(smartMode==='history')for(const student of item.component)for(const member of group.students)local+=(historyCounts.get(pairKey(student.id,member.id))||0)*20;local+=(group.students.length/group.capacity)*3;return{group,local}}).sort((a,b)=>a.local-b.local);ranked[0].group.students.push(...item.component)}if(invalid||groups.some(group=>group.students.length!==group.capacity))continue;const score=partitionScore(groups,smartMode,historyCounts);if(!best||score<best.score)best={score,groups}}if(!best)throw new Error('Zadaná pravidla nelze při zvoleném počtu skupin splnit. Zkuste změnit velikost skupin nebo odebrat některé omezení.');return best.groups.map((group,index)=>({id:lockedGroups[index]?.id||uid('group'),name:lockedGroups[index]?.name||`Skupina ${index+1}`,studentIds:group.students.map(student=>student.id),locked:!!lockedGroups[index]?.locked,spokespersonId:lockedGroups[index]?.spokespersonId||null,roleAssignments:lockedGroups[index]?.roleAssignments||{},topic:lockedGroups[index]?.topic||'',createdAt:lockedGroups[index]?.createdAt||nowIso()}))}
function generateGroups({mode='size',value=4,smartMode=App.ui.smartGroupMode||'random'}={}){const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');const students=eligibleStudents(classItem);if(students.length<2)throw new Error('Pro tvorbu skupin jsou potřeba alespoň dva přítomní studenti.');const lengths=groupLengths(students.length,{mode,value});const groups=solveSmartPartition(classItem,students,lengths,smartMode);classItem.currentGroups=groups;classItem.lastGroupConfig={mode,value,smartMode};classItem.groupHistory.unshift({id:uid('groupset'),createdAt:nowIso(),mode,value,smartMode,groups:groups.map(group=>({name:group.name,studentIds:[...group.studentIds],studentNames:resolveStudents(group.studentIds,classItem).map(item=>item.displayName)}))});classItem.groupHistory=classItem.groupHistory.slice(0,HISTORY_LIMITS.group);touchClass(classItem);saveData({event:'groups_generate'});recordEvent('groups_generate',{mode,value,smartMode,groupCount:groups.length,studentCount:students.length});return groups}
function rerollUnlockedGroups(){
  const classItem=getSelectedClass();
  if(!classItem?.currentGroups?.length)throw new Error('Nejprve vytvořte skupiny.');
  const unlockedIndexes=classItem.currentGroups.map((group,index)=>group.locked?null:index).filter(index=>index!==null);
  if(!unlockedIndexes.length)throw new Error('Všechny skupiny jsou uzamčené.');
  const present=eligibleStudents(classItem);
  const presentIds=new Set(present.map(student=>student.id));
  const lockedGroups=classItem.currentGroups.map(group=>group.locked?{...group,studentIds:group.studentIds.filter(id=>presentIds.has(id))}:null);
  const lockedCount=lockedGroups.reduce((sum,group)=>sum+(group?group.studentIds.length:0),0);
  const free=present.length-lockedCount;
  if(free<0)throw new Error('Uzamčené skupiny obsahují více studentů, než je přítomno.');
  const base=Math.floor(free/unlockedIndexes.length);
  const extra=free%unlockedIndexes.length;
  const lengths=classItem.currentGroups.map((group,index)=>lockedGroups[index]?lockedGroups[index].studentIds.length:0);
  unlockedIndexes.forEach((groupIndex,index)=>{lengths[groupIndex]=base+(index<extra?1:0)});
  const config=classItem.lastGroupConfig||{smartMode:App.ui.smartGroupMode||'random'};
  classItem.currentGroups=solveSmartPartition(classItem,present,lengths,config.smartMode,{lockedGroups});
  touchClass(classItem);
  saveData({event:'groups_reroll'});
  recordEvent('groups_reroll',{unlocked:unlockedIndexes.length,smartMode:config.smartMode});
  return classItem.currentGroups;
}
function recomputeGroupsForAttendance(){
  const classItem=getSelectedClass();
  if(!classItem?.currentGroups?.length)throw new Error('Nejprve vytvořte skupiny.');
  const config=classItem.lastGroupConfig||{mode:'count',value:classItem.currentGroups.length,smartMode:App.ui.smartGroupMode||'random'};
  return generateGroups(config);
}
function toggleGroupLock(groupId){const group=getSelectedClass()?.currentGroups.find(item=>item.id===groupId);if(!group)return false;group.locked=!group.locked;saveData({event:'group_lock'});return group.locked}
function renameGroup(groupId,name){const group=getSelectedClass()?.currentGroups.find(item=>item.id===groupId);if(!group)return false;group.name=String(name||'').trim()||group.name;saveData({event:'group_rename'});return true}
function moveStudentBetweenGroups(studentId,fromId,toId){const classItem=getSelectedClass();const groups=classItem?.currentGroups||[];const from=groups.find(item=>item.id===fromId);const to=groups.find(item=>item.id===toId);if(!from||!to||from===to)return false;const together=rulePairs('together',classItem).filter(pair=>pair.includes(studentId)).flatMap(pair=>pair.filter(id=>id!==studentId));if(together.some(id=>from.studentIds.includes(id)))throw new Error('Studenta nelze přesunout samotného, protože má pravidlo „spolu“.');if(rulePairs('apart',classItem).some(pair=>pair.includes(studentId)&&to.studentIds.includes(pair.find(id=>id!==studentId))))throw new Error('Přesun by porušil pravidlo „od sebe“.');const index=from.studentIds.indexOf(studentId);if(index<0)return false;from.studentIds.splice(index,1);to.studentIds.push(studentId);if(from.spokespersonId===studentId)from.spokespersonId=null;for(const [role,id]of Object.entries(from.roleAssignments||{}))if(id===studentId)delete from.roleAssignments[role];saveData({event:'group_move'});return true}
function selectSpokesperson(groupId,{persist=true}={}){const group=getSelectedClass()?.currentGroups.find(item=>item.id===groupId);if(!group?.studentIds.length)return null;const candidates=group.studentIds.filter(id=>id!==group.spokespersonId);group.spokespersonId=(candidates.length?candidates:group.studentIds)[randomInt((candidates.length?candidates:group.studentIds).length)];if(persist){saveData({render:false,event:'group_spokesperson'});recordEvent('group_spokesperson')}return group.spokespersonId}
function selectAllSpokespersons(){const groups=getSelectedClass()?.currentGroups||[];groups.forEach(group=>selectSpokesperson(group.id,{persist:false}));saveData({render:false,event:'group_spokespersons_all'});recordEvent('group_spokespersons_all',{groupCount:groups.length})}
function groupsPlainText(){const classItem=getSelectedClass();if(!classItem?.currentGroups?.length)return'';return`${classItem.name}\n${classItem.currentGroups.map(group=>{const names=resolveStudents(group.studentIds,classItem).map(item=>item.displayName);const speaker=classItem.students.find(item=>item.id===group.spokespersonId)?.displayName;const roles=Object.entries(group.roleAssignments||{}).map(([role,id])=>`${role}: ${classItem.students.find(item=>item.id===id)?.displayName||'—'}`).join(', ');return`${group.name}${group.topic?` · ${group.topic}`:''}${speaker?` (mluvčí: ${speaker})`:''}${roles?`\nRole: ${roles}`:''}\n- ${names.join('\n- ')}`}).join('\n\n')}`}

;
const SMART_GROUP_MODES={random:{label:'Náhodně',text:'Čisté promíchání při zachování zadaných pravidel.'},balanced:{label:'Vyváženě',text:'Rozloží interní úrovně A, B a C co nejrovnoměrněji.'},homogeneous:{label:'Podobné úrovně',text:'Vytvoří skupiny studentů s podobnou interní úrovní.'},history:{label:'Nové kombinace',text:'Omezuje dvojice, které už spolu pracovaly.'}};
function renderGroupsView(){
  const root=$('#groupsWorkspace');
  if(!root)return;
  const classItem=getSelectedClass();
  if(!classItem){root.innerHTML=noClassMessage('Skupiny','Nejprve importujte nebo vytvořte třídu.');return;}
  const roster=eligibleStudents(classItem);
  const groups=classItem.currentGroups||[];
  const rulesCount=classItem.groupRules.together.length+classItem.groupRules.apart.length+Object.keys(classItem.groupRules.pins).length;
  root.innerHTML=`<div class="group-panel-tabs"><button data-action="group-panel" data-panel="build" class="${App.ui.groupPanel==='build'?'active':''}">Tvorba skupin</button><button data-action="group-panel" data-panel="rules" class="${App.ui.groupPanel==='rules'?'active':''}">Pravidla a profily <b>${rulesCount}</b></button></div>${App.ui.groupPanel==='rules'?renderGroupRulesPanel(classItem,roster):renderGroupBuilder(classItem,roster,groups)}`;
  bindGroupModeLocal();
}
function renderGroupBuilder(classItem,roster,groups){const config=classItem.lastGroupConfig||{};const currentValue=App.ui.groupMode==='size'?(config.mode==='size'?config.value:4):(config.mode==='count'?config.value:Math.min(4,Math.max(2,roster.length)));const absentInGroups=groups.reduce((sum,group)=>sum+resolveStudents(group.studentIds,classItem).filter(student=>!student.present||student.archived).length,0);return`<article class="smart-mode-panel"><div><span>LOGIKA ROZDĚLENÍ</span><h3>${SMART_GROUP_MODES[App.ui.smartGroupMode].label}</h3><p>${SMART_GROUP_MODES[App.ui.smartGroupMode].text}</p></div><div class="smart-mode-grid">${Object.entries(SMART_GROUP_MODES).map(([id,item])=>`<button data-smart-mode="${id}" class="${App.ui.smartGroupMode===id?'active':''}"><i>${id==='random'?'⤨':id==='balanced'?'⚖':id==='homogeneous'?'≋':'↻'}</i><b>${item.label}</b></button>`).join('')}</div></article><article class="group-builder"><div class="builder-context"><span>AKTIVNÍ TŘÍDA</span><h3>${escapeHtml(classItem.name)}</h3><p>${roster.length} přítomných · ${groupRuleSummary(classItem)}</p></div><div class="builder-mode"><label>Způsob rozdělení</label><div class="segmented wide" id="groupModeSegment"><button data-group-mode="size" class="${App.ui.groupMode==='size'?'active':''}">Počet ve skupině</button><button data-group-mode="count" class="${App.ui.groupMode==='count'?'active':''}">Počet skupin</button></div></div><div class="builder-value"><label id="groupValueLabel">${App.ui.groupMode==='size'?'Studentů ve skupině':'Počet skupin'}</label><div class="number-stepper"><button type="button" data-action="group-value-down">−</button><input id="groupValue" type="number" min="2" max="${Math.max(2,roster.length)}" value="${currentValue}"><button type="button" data-action="group-value-up">＋</button></div></div><button class="primary-button compact" data-action="generate-groups">Vytvořit skupiny <span>◌</span></button></article>${groups.length?`${absentInGroups?`<div class="attendance-group-warning"><div><b>${absentInGroups} ${absentInGroups===1?'nepřítomný člen':absentInGroups<5?'nepřítomní členové':'nepřítomných členů'} ve stávajících skupinách</b><span>Rozdělení bylo zachováno. Můžete je ponechat pro přehled, nebo skupiny přepočítat podle aktuální docházky.</span></div><button class="small-button" data-action="recompute-groups-attendance">Přepočítat podle docházky</button></div>`:''}<div class="group-result-toolbar"><div><span>VÝSLEDEK · ${escapeHtml(SMART_GROUP_MODES[config.smartMode||App.ui.smartGroupMode]?.label||'Náhodně')}</span><h3>${groups.length} skupin</h3></div><div><button class="small-button" data-route="roles">Role a témata</button><button class="small-button" data-action="all-spokespersons">Vylosovat mluvčí</button><button class="small-button" data-action="reroll-groups">Přelosovat odemčené</button><button class="small-button" data-action="copy-groups">Kopírovat</button></div></div><div class="generated-groups">${groups.map(group=>groupCard(group,classItem)).join('')}</div>`:`<article class="empty-groups"><div class="group-preview-visual"><i></i><i></i><i></i><i></i><i></i><i></i></div><span>PŘIPRAVENO K ROZDĚLENÍ</span><h2>Chytré skupiny pod kontrolou</h2><p>Zvolte náhodné, vyvážené, homogenní nebo historicky promíchané rozdělení. Všechna pravidla „spolu“ a „od sebe“ jsou tvrdá a SORTIO je nikdy potichu neignoruje.</p></article>`}`}
function groupRuleSummary(classItem){const together=classItem.groupRules.together.length,apart=classItem.groupRules.apart.length,pins=Object.keys(classItem.groupRules.pins).length;if(!together&&!apart&&!pins)return'bez omezení';return`${together} spolu · ${apart} od sebe · ${pins} připnutí`}
function renderGroupRulesPanel(classItem,roster){const maxGroups=Math.min(12,Math.max(2,roster.length));return`<div class="rules-layout"><section class="profile-panel"><div class="assignment-heading"><span>NEVEŘEJNÉ PROFILY</span><h2>Podklady pro chytré skupiny</h2><p>Úroveň A/B/C vidí pouze učitel. Na projektoru ani v kopírovaném výstupu se nezobrazuje.</p></div><div class="profile-table"><div class="profile-head"><span>Student</span><span>Úroveň</span><span>Připnout</span></div>${roster.map(student=>`<div class="profile-row"><b>${escapeHtml(student.displayName)}</b><select data-action="student-level" data-id="${student.id}" aria-label="Interní úroveň"><option value="A" ${student.groupLevel==='A'?'selected':''}>A · vyšší</option><option value="B" ${student.groupLevel==='B'?'selected':''}>B · standard</option><option value="C" ${student.groupLevel==='C'?'selected':''}>C · podpora</option></select><select data-action="student-pin" data-id="${student.id}" aria-label="Připnout ke skupině"><option value="">Bez připnutí</option>${Array.from({length:maxGroups},(_,index)=>`<option value="${index}" ${classItem.groupRules.pins[student.id]===index?'selected':''}>Skupina ${index+1}</option>`).join('')}</select></div>`).join('')}</div></section><section class="pair-rules-panel"><div class="assignment-heading"><span>VZTAHOVÁ PRAVIDLA</span><h2>Kdo spolu ano – a kdo ne</h2><p>Pravidla jsou závazná. Pokud je nelze splnit, SORTIO vysvětlí problém a skupiny nevytvoří.</p></div><div class="pair-rule-form"><select id="ruleStudentA"><option value="">První student</option>${roster.map(student=>`<option value="${student.id}">${escapeHtml(student.displayName)}</option>`).join('')}</select><select id="ruleType"><option value="apart">Mají být od sebe</option><option value="together">Mají být spolu</option></select><select id="ruleStudentB"><option value="">Druhý student</option>${roster.map(student=>`<option value="${student.id}">${escapeHtml(student.displayName)}</option>`).join('')}</select><button class="primary-button compact" data-action="add-pair-rule">Přidat pravidlo</button></div><div class="rule-lists"><article><header><span>OD SEBE</span><b>${classItem.groupRules.apart.length}</b></header>${renderPairRules(classItem,'apart')}</article><article><header><span>SPOLU</span><b>${classItem.groupRules.together.length}</b></header>${renderPairRules(classItem,'together')}</article></div><button class="small-button danger" data-action="clear-group-rules">Vymazat všechna pravidla</button></section></div>`}
function renderPairRules(classItem,type){const rules=classItem.groupRules[type];if(!rules.length)return'<div class="empty-mini">Žádná pravidla.</div>';return rules.map((pair,index)=>{const names=pair.map(id=>classItem.students.find(student=>student.id===id)?.displayName||'Neznámý student');return`<div class="rule-chip"><span>${escapeHtml(names[0])}<i>${type==='apart'?'≠':'＋'}</i>${escapeHtml(names[1])}</span><button data-action="remove-pair-rule" data-type="${type}" data-index="${index}">×</button></div>`}).join('')}
function groupCard(group,classItem){
  const members=resolveStudents(group.studentIds,classItem);
  const spokesperson=classItem.students.find(item=>item.id===group.spokespersonId);
  const levels=members.reduce((map,student)=>(map[student.groupLevel]=(map[student.groupLevel]||0)+1,map),{});
  const roles=Object.entries(group.roleAssignments||{});
  return`<article class="generated-group ${group.locked?'locked':''}" data-group-id="${group.id}"><header><input class="group-name-input" value="${escapeHtml(group.name)}" data-action="rename-group" aria-label="Název skupiny"><button data-action="toggle-group-lock" data-group-id="${group.id}" title="${group.locked?'Odemknout':'Uzamknout'} skupinu">${group.locked?'▣':'▢'}</button></header>${group.topic?`<div class="group-topic">${escapeHtml(group.topic)}</div>`:''}<div class="group-members">${members.length?members.map(student=>{const absent=!student.present||student.archived;return`<div class="group-member ${spokesperson?.id===student.id?'spokesperson':''} ${absent?'absent':''}"><span>${escapeHtml(student.displayName)}</span>${absent?'<b class="absence-badge">nepřítomen</b>':spokesperson?.id===student.id?'<b>mluvčí</b>':''}<select data-action="move-student" data-student-id="${student.id}" data-from-id="${group.id}" aria-label="Přesunout studenta"><option value="">Přesunout…</option>${classItem.currentGroups.filter(item=>item.id!==group.id).map(item=>`<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('')}</select></div>`}).join(''):'<div class="empty-mini">Prázdná skupina</div>'}</div>${roles.length?`<div class="group-role-summary">${roles.slice(0,4).map(([role,id])=>{const student=classItem.students.find(item=>item.id===id);return`<span class="${student&&!student.present?'absent':''}"><b>${escapeHtml(role)}</b>${escapeHtml(student?.displayName||'—')}${student&&!student.present?' · nepřítomen':''}</span>`}).join('')}</div>`:''}<footer><span>${members.length} ${members.length===1?'student':members.length<5?'studenti':'studentů'} · A${levels.A||0}/B${levels.B||0}/C${levels.C||0}</span><button data-action="group-spokesperson" data-group-id="${group.id}">${spokesperson?'Změnit mluvčí':'Vylosovat mluvčí'}</button></footer></article>`;
}
function bindGroupModeLocal(){$$('[data-group-mode]').forEach(button=>button.addEventListener('click',()=>{App.ui.groupMode=button.dataset.groupMode;renderGroupsView()}));$$('[data-smart-mode]').forEach(button=>button.addEventListener('click',()=>{App.ui.smartGroupMode=button.dataset.smartMode;renderGroupsView()}))}
function bindGroupsUi(){document.addEventListener('change',event=>{try{if(event.target.dataset.action==='move-student'&&event.target.value){moveStudentBetweenGroups(event.target.dataset.studentId,event.target.dataset.fromId,event.target.value);renderGroupsView()}if(event.target.dataset.action==='rename-group')renameGroup(event.target.closest('[data-group-id]').dataset.groupId,event.target.value);if(event.target.dataset.action==='student-level')updateStudent(getSelectedClass().id,event.target.dataset.id,{groupLevel:event.target.value});if(event.target.dataset.action==='student-pin')setStudentPin(event.target.dataset.id,event.target.value===''?null:Number(event.target.value))}catch(error){toast(error.message,'error');renderGroupsView()}});document.addEventListener('click',async event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='group-panel'){App.ui.groupPanel=button.dataset.panel;renderGroupsView();return}if(action==='add-pair-rule'){try{addPairRule($('#ruleType').value,$('#ruleStudentA').value,$('#ruleStudentB').value);renderGroupsView();toast('Pravidlo bylo přidáno.','success')}catch(error){toast(error.message,'error')}return}if(action==='remove-pair-rule'){removePairRule(button.dataset.type,Number(button.dataset.index));renderGroupsView();return}if(action==='clear-group-rules'){if(!App.settings.confirmDestructive||confirm('Vymazat všechna pravidla skupin?')){clearGroupRules();renderGroupsView()}return}if(!['group-value-down','group-value-up','generate-groups','reroll-groups','recompute-groups-attendance','toggle-group-lock','group-spokesperson','all-spokespersons','copy-groups'].includes(action))return;if(action==='group-value-down'||action==='group-value-up'){const input=$('#groupValue');const delta=action==='group-value-up'?1:-1;input.value=Math.max(Number(input.min)||2,Math.min(Number(input.max)||99,(Number(input.value)||2)+delta));return}try{if(action==='generate-groups'){generateGroups({mode:App.ui.groupMode,value:Number($('#groupValue').value),smartMode:App.ui.smartGroupMode});renderGroupsView();toast('Skupiny byly vytvořeny.','success')}if(action==='reroll-groups'){rerollUnlockedGroups();renderGroupsView();toast('Odemčené skupiny byly přelosovány.','success')}if(action==='recompute-groups-attendance'){recomputeGroupsForAttendance();renderGroupsView();toast('Skupiny byly přepočítány podle aktuální docházky.','success')}if(action==='toggle-group-lock'){const locked=toggleGroupLock(button.dataset.groupId);renderGroupsView();toast(locked?'Skupina byla uzamčena.':'Skupina byla odemčena.','success')}if(action==='group-spokesperson'){selectSpokesperson(button.dataset.groupId);renderGroupsView()}if(action==='all-spokespersons'){selectAllSpokespersons();renderGroupsView();toast('Mluvčí byli vylosováni.','success')}if(action==='copy-groups'){await navigator.clipboard.writeText(groupsPlainText());toast('Skupiny byly zkopírovány.','success')}}catch(error){toast(error.message,'error')}})}

;
function saveRoleCatalog(raw){const classItem=getSelectedClass();if(!classItem)return[];classItem.roleCatalog=uniqueStrings(String(raw||'').split(/\n|,/));if(!classItem.roleCatalog.length)classItem.roleCatalog=defaultRoleCatalog();for(const group of classItem.currentGroups||[]){for(const role of Object.keys(group.roleAssignments||{}))if(!classItem.roleCatalog.includes(role))delete group.roleAssignments[role]}saveData({event:'role_catalog_save'});return classItem.roleCatalog}
function saveTopicCatalog(raw){const classItem=getSelectedClass();if(!classItem)return[];classItem.topicCatalog=uniqueStrings(String(raw||'').split(/\n/));saveData({event:'topic_catalog_save'});return classItem.topicCatalog}
function roleUseCount(classItem,studentId,role){return(classItem.roleHistory||[]).filter(entry=>entry.studentId===studentId&&entry.role===role).length}
function chooseRoleStudent(classItem,group,role,used){const candidates=group.studentIds.filter(id=>!used.has(id));const pool=candidates.length?candidates:group.studentIds;const ranked=shuffle(pool).map(id=>({id,count:roleUseCount(classItem,id,role),total:(classItem.roleHistory||[]).filter(entry=>entry.studentId===id).length})).sort((a,b)=>a.count-b.count||a.total-b.total);return ranked[0]?.id||null}
function assignRolesToGroup(group,{persistHistory=true}={}){const classItem=getSelectedClass();if(!classItem||!group?.studentIds?.length)return{};const used=new Set();const assignments={};for(const role of classItem.roleCatalog){const studentId=chooseRoleStudent(classItem,group,role,used);if(!studentId)continue;assignments[role]=studentId;used.add(studentId);if(persistHistory)classItem.roleHistory.unshift({id:uid('role'),createdAt:nowIso(),groupId:group.id,studentId,role})}group.roleAssignments=assignments;classItem.roleHistory=classItem.roleHistory.slice(0,HISTORY_LIMITS.role);return assignments}
function assignRolesToAllGroups(){const classItem=getSelectedClass();if(!classItem?.currentGroups?.length)throw new Error('Nejprve vytvořte skupiny.');classItem.currentGroups.forEach(group=>assignRolesToGroup(group));saveData({event:'roles_assign'});recordEvent('roles_assign',{groupCount:classItem.currentGroups.length,roleCount:classItem.roleCatalog.length});return classItem.currentGroups}
function assignTopicsToGroups(){const classItem=getSelectedClass();if(!classItem?.currentGroups?.length)throw new Error('Nejprve vytvořte skupiny.');if(!classItem.topicCatalog.length)throw new Error('Nejprve zadejte alespoň jedno téma nebo úkol.');const topics=shuffle(classItem.topicCatalog);classItem.currentGroups.forEach((group,index)=>group.topic=topics[index%topics.length]);saveData({event:'topics_assign'});recordEvent('topics_assign',{groupCount:classItem.currentGroups.length,topicCount:classItem.topicCatalog.length});return classItem.currentGroups}
function clearGroupAssignments(){const classItem=getSelectedClass();if(!classItem)return;classItem.currentGroups.forEach(group=>{group.roleAssignments={};group.topic=''});saveData({event:'assignments_clear'})}
function rotateRoles(){return assignRolesToAllGroups()}

;
function renderRolesView(){const root=$('#rolesWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=noClassMessage('Role a úkoly','Nejprve importujte nebo vytvořte třídu.');return}const groups=classItem.currentGroups||[];root.innerHTML=`<div class="roles-layout"><article class="assignment-settings"><div class="assignment-heading"><span>NASTAVENÍ</span><h2>Role a obsah skupin</h2><p>Každou položku napište na samostatný řádek. SORTIO při přidělování rolí zohledňuje předchozí použití.</p></div><label>Role ve skupině<textarea id="roleCatalogInput" rows="7" placeholder="Mluvčí\nZapisovatel\nHlídač času">${escapeHtml(classItem.roleCatalog.join('\n'))}</textarea></label><label>Témata nebo úkoly<textarea id="topicCatalogInput" rows="7" placeholder="Téma 1\nTéma 2\nTéma 3">${escapeHtml(classItem.topicCatalog.join('\n'))}</textarea></label><div class="assignment-actions"><button class="small-button" data-action="save-catalogs">Uložit seznamy</button><button class="primary-button compact" data-action="assign-roles" ${groups.length?'':'disabled'}>Přidělit role</button><button class="secondary-button compact" data-action="assign-topics" ${groups.length?'':'disabled'}>Rozdělit témata</button><button class="small-button" data-action="clear-assignments" ${groups.length?'':'disabled'}>Vymazat přidělení</button></div><div class="rotation-note"><span>↻</span><p><b>Spravedlivá rotace:</b> přednost dostane student, který danou roli plnil nejméně často.</p></div></article><section class="assignment-preview"><div class="assignment-preview-head"><div><span>AKTUÁLNÍ SKUPINY</span><h2>${groups.length?`${groups.length} skupin`:'Zatím bez skupin'}</h2></div>${groups.length?'<button class="small-button" data-route="groups">Upravit skupiny</button>':''}</div>${groups.length?`<div class="assignment-group-grid">${groups.map(group=>roleGroupCard(group,classItem)).join('')}</div>`:`<article class="empty-groups compact-empty"><span>NEJPRVE SKUPINY</span><h2>Vytvořte rozdělení třídy</h2><p>Role a témata se přidělují k aktuální sadě skupin.</p><button class="primary-button" data-route="groups">Přejít do skupin</button></article>`}</section></div>`}
function roleGroupCard(group,classItem){
  const members=resolveStudents(group.studentIds,classItem);
  return`<article class="role-group-card"><header><div><span>${escapeHtml(group.name)}</span><h3>${escapeHtml(group.topic||'Bez přiděleného tématu')}</h3></div><i>${members.length}</i></header><div class="role-list">${classItem.roleCatalog.map(role=>{const student=classItem.students.find(item=>item.id===group.roleAssignments?.[role]);const absent=student&&(!student.present||student.archived);return`<div class="${absent?'absent':''}"><b>${escapeHtml(role)}</b><span>${escapeHtml(student?.displayName||'—')}${absent?' · nepřítomen':''}</span></div>`}).join('')}</div><footer>${members.map(student=>{const absent=!student.present||student.archived;return`<span class="${absent?'absent':''}" title="${escapeHtml(student.displayName)}${absent?' – nepřítomen':''}">${escapeHtml(`${student.firstName[0]||''}${student.lastName[0]||''}`)}</span>`}).join('')}</footer></article>`;
}
function bindRolesUi(){document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(!['save-catalogs','assign-roles','assign-topics','clear-assignments'].includes(action))return;try{if(action==='save-catalogs'){saveRoleCatalog($('#roleCatalogInput').value);saveTopicCatalog($('#topicCatalogInput').value);toast('Seznamy byly uloženy.','success')}if(action==='assign-roles'){saveRoleCatalog($('#roleCatalogInput').value);assignRolesToAllGroups();toast('Role byly spravedlivě přiděleny.','success')}if(action==='assign-topics'){saveTopicCatalog($('#topicCatalogInput').value);assignTopicsToGroups();toast('Témata byla rozdělena.','success')}if(action==='clear-assignments'){clearGroupAssignments();toast('Přidělení bylo vymazáno.','success')}renderRolesView()}catch(error){toast(error.message,'error')}})}

;
let deferredInstall=null;
function refreshPwaInstallUi(){
  const card=$('#installPwaCard');
  if(card)card.hidden=!deferredInstall;
}
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstall=event;
  refreshPwaInstallUi();
});
window.addEventListener('appinstalled',()=>{
  deferredInstall=null;
  refreshPwaInstallUi();
  toast('SORTIO bylo nainstalováno.','success');
});
async function installPwa(){
  if(!deferredInstall)return false;
  const prompt=deferredInstall;
  prompt.prompt();
  const choice=await prompt.userChoice;
  deferredInstall=null;
  refreshPwaInstallUi();
  return choice?.outcome==='accepted';
}
function bindPwaInstall(){
  $('#installPwaButton')?.addEventListener('click',async()=>{
    try{
      const installed=await installPwa();
      if(!installed)toast('Instalace nebyla dokončena.','info');
    }catch(error){captureError(error,'pwa-install');toast('Instalaci se nepodařilo spustit.','error')}
  });
  refreshPwaInstallUi();
}
function registerServiceWorker(){
  if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(error=>captureError(error,'service-worker'));
}

;
function createSeatLayout(template='rows',rows=4,columns=6){rows=Math.max(2,Math.min(10,Number(rows)||4));columns=Math.max(2,Math.min(12,Number(columns)||6));const seats=[];if(template==='u'){for(let column=0;column<columns;column++)seats.push(makeSeat(0,column,null,`P${column+1}`));for(let row=1;row<rows;row++){seats.push(makeSeat(row,0,null,`L${row}`));seats.push(makeSeat(row,columns-1,null,`R${row}`))}}else if(template==='islands'){for(let island=0;island<rows;island++)for(let place=0;place<columns;place++)seats.push(makeSeat(island,place,island,`${island+1}.${place+1}`))}else{const actualColumns=template==='pairs'?columns*2:columns;for(let row=0;row<rows;row++)for(let column=0;column<actualColumns;column++)seats.push(makeSeat(row,column,template==='pairs'?Math.floor(column/2):null,`${row+1}.${column+1}`))}return seats}
function makeSeat(row,column,island,label){return{id:uid('seat'),row,column,island,label,studentId:null,blocked:false,locked:false}}
function configureSeating({template,rows,columns,preserve=false}={}){const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');const previous=preserve?new Map((classItem.seatingPlan.seats||[]).filter(seat=>seat.studentId).map(seat=>[seat.label,seat])):new Map();const seats=createSeatLayout(template,rows,columns);for(const seat of seats){const old=previous.get(seat.label);if(old){seat.studentId=old.studentId;seat.locked=old.locked;seat.blocked=old.blocked}}classItem.seatingPlan={template,rows:Number(rows),columns:Number(columns),seats,updatedAt:nowIso()};saveData({event:'seating_configure'});return classItem.seatingPlan}
function seatingAdjacency(a,b,template){if(!a||!b)return false;if(template==='islands')return a.island===b.island;if(template==='pairs'&&a.row===b.row&&a.island===b.island)return true;return Math.abs(a.row-b.row)+Math.abs(a.column-b.column)<=1}
function seatingFrontRank(seat,plan){if(plan.template==='islands')return seat.island;return seat.row}
function countSeatingViolations(classItem,seats){const byStudent=new Map(seats.filter(seat=>seat.studentId).map(seat=>[seat.studentId,seat]));let violations=0;for(const [a,b]of rulePairs('apart',classItem)){if(seatingAdjacency(byStudent.get(a),byStudent.get(b),classItem.seatingPlan.template))violations++}return violations}
function assignSeating(){const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');let plan=classItem.seatingPlan;if(!plan.seats.length){configureSeating(plan);plan=classItem.seatingPlan}const students=eligibleStudents(classItem);const studentById=new Map(classItem.students.map(student=>[student.id,student]));const fixed=plan.seats.filter(seat=>seat.locked&&seat.studentId&&!seat.blocked&&students.some(student=>student.id===seat.studentId));const fixedIds=new Set(fixed.map(seat=>seat.studentId));const openSeats=plan.seats.filter(seat=>!seat.blocked&&!seat.locked);const remaining=students.filter(student=>!fixedIds.has(student.id));if(fixed.length+openSeats.length<students.length)throw new Error(`V učebně je pouze ${fixed.length+openSeats.length} použitelných míst pro ${students.length} přítomných studentů.`);let best=null;for(let trial=0;trial<500;trial++){const trialSeats=plan.seats.map(seat=>({...seat,studentId:seat.locked?seat.studentId:null}));const available=shuffle(trialSeats.filter(seat=>!seat.blocked&&!seat.locked));const ordered=shuffle(remaining).sort((a,b)=>Number(b.frontPreference)-Number(a.frontPreference));for(const student of ordered){let index=0;if(student.frontPreference){let bestRank=Infinity;for(let i=0;i<available.length;i++){const rank=seatingFrontRank(available[i],plan)+randomInt(1000000)/1000000*.45;if(rank<bestRank){bestRank=rank;index=i}}}const [seat]=available.splice(index,1);seat.studentId=student.id}const violations=countSeatingViolations(classItem,trialSeats);const frontPenalty=trialSeats.reduce((sum,seat)=>{const student=studentById.get(seat.studentId);return sum+(student?.frontPreference?seatingFrontRank(seat,plan):0)},0);const score=violations*1000+frontPenalty+randomInt(1000000)/1000000;if(!best||score<best.score)best={score,violations,seats:trialSeats};if(violations===0&&frontPenalty===0){best={score,violations,seats:trialSeats};break}}if(!best)throw new Error('Zasedací pořádek se nepodařilo vytvořit.');if(best.violations>0)throw new Error('Pravidla „od sebe“ nelze v tomto rozložení splnit. Přidejte místa, změňte rozložení nebo upravte pravidla.');plan.seats=best.seats;plan.updatedAt=nowIso();saveData({event:'seating_assign'});recordEvent('seating_assign',{template:plan.template,studentCount:students.length});return plan}
function setSeatStudent(seatId,studentId){const classItem=getSelectedClass();const plan=classItem?.seatingPlan;const seat=plan?.seats.find(item=>item.id===seatId);if(!seat)return false;const other=plan.seats.find(item=>item.studentId===studentId&&item.id!==seatId);const previous=seat.studentId;if(other)other.studentId=previous||null;seat.studentId=studentId||null;seat.blocked=false;plan.updatedAt=nowIso();saveData({event:'seat_student'});return true}
function toggleSeatBlocked(seatId){const seat=getSelectedClass()?.seatingPlan?.seats.find(item=>item.id===seatId);if(!seat)return false;seat.blocked=!seat.blocked;if(seat.blocked){seat.studentId=null;seat.locked=false}saveData({event:'seat_block'});return seat.blocked}
function toggleSeatLock(seatId){const seat=getSelectedClass()?.seatingPlan?.seats.find(item=>item.id===seatId);if(!seat?.studentId)return false;seat.locked=!seat.locked;saveData({event:'seat_lock'});return seat.locked}
function rotateSeating(){const classItem=getSelectedClass();const plan=classItem?.seatingPlan;if(!plan?.seats?.length)return false;const seats=plan.seats.filter(seat=>!seat.blocked&&!seat.locked);const ids=seats.map(seat=>seat.studentId).filter(Boolean);if(ids.length<2)return false;ids.unshift(ids.pop());let index=0;seats.forEach(seat=>{if(seat.studentId)seat.studentId=ids[index++]});plan.updatedAt=nowIso();saveData({event:'seating_rotate'});recordEvent('seating_rotate',{template:plan.template,studentCount:ids.length});return true}
function clearSeatingAssignments(){const plan=getSelectedClass()?.seatingPlan;if(!plan)return;plan.seats.forEach(seat=>{seat.studentId=null;seat.locked=false});saveData({event:'seating_clear'})}

;
function renderSeatingView(){const root=$('#seatingWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=noClassMessage('Zasedací pořádek','Nejprve importujte nebo vytvořte třídu.');return}const plan=classItem.seatingPlan;const students=classStudents(classItem);const available=plan.seats.filter(seat=>!seat.blocked).length;root.innerHTML=`<div class="seating-layout"><aside class="seating-controls"><div class="assignment-heading"><span>UČEBNA</span><h2>Nastavení prostoru</h2><p>Čelní strana třídy je v náhledu vždy nahoře.</p></div><label>Rozložení<select id="seatingTemplate"><option value="rows" ${plan.template==='rows'?'selected':''}>Klasické řady</option><option value="pairs" ${plan.template==='pairs'?'selected':''}>Dvojice lavic</option><option value="islands" ${plan.template==='islands'?'selected':''}>Ostrůvky</option><option value="u" ${plan.template==='u'?'selected':''}>Uspořádání do U</option></select></label><div class="seating-dimensions"><label><span id="seatRowsLabel">${plan.template==='islands'?'Počet ostrůvků':'Počet řad'}</span><input id="seatingRows" type="number" min="2" max="10" value="${plan.rows}"></label><label><span id="seatColumnsLabel">${plan.template==='pairs'?'Dvojic v řadě':plan.template==='islands'?'Míst v ostrůvku':'Míst v řadě'}</span><input id="seatingColumns" type="number" min="2" max="12" value="${plan.columns}"></label></div><button class="small-button wide-button" data-action="apply-seating-layout">Použít rozložení</button><div class="seating-stats"><div><b>${students.filter(s=>s.present).length}</b><span>přítomných</span></div><div><b>${available}</b><span>použitelných míst</span></div><div><b>${plan.seats.filter(s=>s.locked).length}</b><span>uzamčeno</span></div></div><div class="seating-action-stack"><button class="primary-button compact" data-action="assign-seating">Rozsadit třídu</button><button class="secondary-button compact" data-action="rotate-seating">Rotovat místa</button><button class="small-button" data-action="clear-seating">Vymazat obsazení</button></div><div class="front-preference-list"><span>POTŘEBUJE SEDĚT VPŘEDU</span>${students.map(student=>`<label><input type="checkbox" data-action="front-preference" data-id="${student.id}" ${student.frontPreference?'checked':''}><span>${escapeHtml(student.displayName)}</span></label>`).join('')}</div><div class="rotation-note"><span>↔</span><p>Pravidla <b>„od sebe“</b> ze skupin se použijí také při rozsazení sousedních míst.</p></div></aside><section class="seating-stage"><div class="board"><span>TABULE · PŘEDNÍ ČÁST</span></div>${plan.seats.length?renderSeatMap(plan,classItem):`<article class="empty-groups compact-empty"><span>PRÁZDNÁ UČEBNA</span><h2>Nastavte rozložení</h2><p>Vyberte typ učebny a počet míst.</p><button class="primary-button" data-action="apply-seating-layout">Vytvořit učebnu</button></article>`}<div class="seating-legend"><span><i class="seat-dot occupied"></i>obsazeno</span><span><i class="seat-dot locked"></i>uzamčeno</span><span><i class="seat-dot blocked"></i>mimo provoz</span></div></section></div>`;bindSeatingTemplateLocal()}
function renderSeatMap(plan,classItem){if(plan.template==='islands'){const islands=[...new Set(plan.seats.map(seat=>seat.island))];return`<div class="seat-map islands-map">${islands.map(island=>`<div class="seat-island"><b>Ostrůvek ${island+1}</b><div>${plan.seats.filter(seat=>seat.island===island).map(seat=>seatControl(seat,classItem)).join('')}</div></div>`).join('')}</div>`}return`<div class="seat-map template-${plan.template}" style="--seat-columns:${plan.template==='pairs'?plan.columns*2:plan.columns}">${plan.seats.map(seat=>seatControl(seat,classItem)).join('')}</div>`}
function seatControl(seat,classItem){const student=classItem.students.find(item=>item.id===seat.studentId);const options=classStudents(classItem,{presentOnly:true}).map(item=>`<option value="${item.id}" ${item.id===seat.studentId?'selected':''}>${escapeHtml(item.displayName)}</option>`).join('');return`<article class="seat ${seat.blocked?'blocked':''} ${seat.locked?'locked':''} ${student&&!student.present?'absent':''}" data-seat-id="${seat.id}" style="--seat-row:${seat.row+1};--seat-column:${seat.column+1}"><header><span>${escapeHtml(seat.label)}</span><button data-action="toggle-seat-lock" data-id="${seat.id}" title="Uzamknout místo">${seat.locked?'▣':'▢'}</button></header><div><b>${escapeHtml(student?.displayName||'Volné místo')}${student&&!student.present?' · nepřítomen':''}</b><small>${student?.frontPreference?'preferuje přední část':seat.blocked?'místo je vypnuté':'kliknutím přiřaďte'}</small></div><select data-action="seat-student" data-id="${seat.id}" ${seat.blocked?'disabled':''}><option value="">Volné místo</option>${options}</select><button class="seat-block-button" data-action="toggle-seat-block" data-id="${seat.id}">${seat.blocked?'Zapnout místo':'Mimo provoz'}</button></article>`}
function bindSeatingTemplateLocal(){const select=$('#seatingTemplate');if(!select)return;select.addEventListener('change',()=>{const template=select.value;$('#seatRowsLabel').textContent=template==='islands'?'Počet ostrůvků':'Počet řad';$('#seatColumnsLabel').textContent=template==='pairs'?'Dvojic v řadě':template==='islands'?'Míst v ostrůvku':'Míst v řadě'})}
function bindSeatingUi(){document.addEventListener('change',event=>{const action=event.target.dataset.action;if(action==='front-preference')updateStudent(getSelectedClass().id,event.target.dataset.id,{frontPreference:event.target.checked});if(action==='seat-student'){setSeatStudent(event.target.dataset.id,event.target.value);renderSeatingView()}});document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(!['apply-seating-layout','assign-seating','rotate-seating','clear-seating','toggle-seat-block','toggle-seat-lock'].includes(action))return;try{if(action==='apply-seating-layout')configureSeating({template:$('#seatingTemplate')?.value||'rows',rows:Number($('#seatingRows')?.value||4),columns:Number($('#seatingColumns')?.value||6)});if(action==='assign-seating'){assignSeating();toast('Zasedací pořádek byl vytvořen.','success')}if(action==='rotate-seating'){if(!rotateSeating())throw new Error('Pro rotaci nejsou alespoň dva obsazení studenti.');toast('Místa byla rotována.','success')}if(action==='clear-seating')clearSeatingAssignments();if(action==='toggle-seat-block')toggleSeatBlocked(button.dataset.id);if(action==='toggle-seat-lock'){if(!toggleSeatLock(button.dataset.id))throw new Error('Uzamknout lze pouze obsazené místo.')}renderSeatingView()}catch(error){toast(error.message,'error')}})}

;
const ENGAGEMENT_KINDS={answer:'Odpověď',presentation:'Prezentace',speaker:'Mluvčí',volunteer:'Dobrovolník',other:'Jiné zapojení'};
function engagementEntries(classItem=getSelectedClass()){return Array.isArray(classItem?.engagementHistory)?classItem.engagementHistory:[]}
function engagementStats(classItem=getSelectedClass(),kind='all'){const students=classStudents(classItem);const entries=engagementEntries(classItem).filter(item=>kind==='all'||item.kind===kind);const byId=new Map(students.map(student=>[student.id,{student,count:0,lastAt:null}]));for(const entry of entries){const stat=byId.get(entry.studentId);if(!stat)continue;stat.count++;if(!stat.lastAt||entry.createdAt>stat.lastAt)stat.lastAt=entry.createdAt}return[...byId.values()].sort((a,b)=>a.count-b.count||String(a.lastAt||'').localeCompare(String(b.lastAt||''))||a.student.displayName.localeCompare(b.student.displayName,'cs'))}
function recordEngagement(studentId,kind='answer',label=''){const classItem=getSelectedClass();const student=classItem?.students.find(item=>item.id===studentId);if(!student)throw new Error('Studenta se nepodařilo najít.');const entry={id:uid('engagement'),studentId,kind:ENGAGEMENT_KINDS[kind]?kind:'other',label:String(label||'').trim(),createdAt:nowIso()};classItem.engagementHistory.unshift(entry);classItem.engagementHistory=classItem.engagementHistory.slice(0,HISTORY_LIMITS.engagement);touchClass(classItem);saveData({event:'engagement_record'});recordEvent('engagement_record',{kind:entry.kind});return entry}
function undoEngagement(entryId){const classItem=getSelectedClass();if(!classItem)return false;const before=classItem.engagementHistory.length;classItem.engagementHistory=classItem.engagementHistory.filter(item=>item.id!==entryId);if(classItem.engagementHistory.length===before)return false;saveData({event:'engagement_undo'});return true}
function selectFairStudent({kind='answer',mode='least-used'}={}){const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');const presentIds=new Set(classStudents(classItem,{presentOnly:true}).map(item=>item.id));const stats=engagementStats(classItem,kind).filter(item=>presentIds.has(item.student.id));if(!stats.length)throw new Error('Ve třídě není žádný přítomný student.');let pool=stats;if(mode==='least-used'){const min=Math.min(...stats.map(item=>item.count));pool=stats.filter(item=>item.count===min)}else if(mode==='oldest'){const oldest=[...stats].sort((a,b)=>String(a.lastAt||'').localeCompare(String(b.lastAt||'')))[0]?.lastAt;pool=stats.filter(item=>item.lastAt===oldest)}const selected=pool[randomInt(pool.length)].student;recordEngagement(selected.id,kind,'Spravedlivý výběr');return selected}
function engagementCoverage(classItem=getSelectedClass(),kind='all'){const stats=engagementStats(classItem,kind);const touched=stats.filter(item=>item.count>0).length;return{touched,total:stats.length,percent:stats.length?Math.round(touched/stats.length*100):0}}
function resetEngagementHistory(classItem=getSelectedClass()){if(!classItem)return;classItem.engagementHistory=[];saveData({event:'engagement_reset'})}

;
let sortioClockHandle=null;
function formatClock(seconds){seconds=Math.max(0,Math.floor(Number(seconds)||0));const h=Math.floor(seconds/3600),m=Math.floor((seconds%3600)/60),s=seconds%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
function currentTimerRemaining(){const timer=App.ui.timer;if(timer.running&&timer.endsAt)return Math.max(0,Math.ceil((timer.endsAt-Date.now())/1000));return timer.remaining}
function currentStopwatchElapsed(){const sw=App.ui.stopwatch;return sw.running?sw.elapsed+Math.floor((Date.now()-sw.startedAt)/1000):sw.elapsed}
function toolClockActive(){return!!(App.ui.timer.running||App.ui.stopwatch.running)}
function stopToolClockIfIdle(){if(sortioClockHandle&&!toolClockActive()){clearInterval(sortioClockHandle);sortioClockHandle=null}}
function ensureToolClock(){
  if(!toolClockActive()){stopToolClockIfIdle();return}
  if(sortioClockHandle)return;
  sortioClockHandle=setInterval(()=>{
    const timer=App.ui.timer;
    if(timer.running){
      timer.remaining=currentTimerRemaining();
      if(timer.remaining<=0){timer.running=false;timer.endsAt=null;timer.remaining=0;toast('Čas vypršel.','success');recordEvent('timer_complete')}
    }
    renderTimerDisplays();
    stopToolClockIfIdle();
  },250);
}
function renderTimerDisplays(){$$('[data-timer-display]').forEach(node=>node.textContent=formatClock(currentTimerRemaining()));$$('[data-stopwatch-display]').forEach(node=>node.textContent=formatClock(currentStopwatchElapsed()));const timerBtn=$('[data-action="timer-toggle"]');if(timerBtn)timerBtn.textContent=App.ui.timer.running?'Pozastavit':'Spustit';const swBtn=$('[data-action="stopwatch-toggle"]');if(swBtn)swBtn.textContent=App.ui.stopwatch.running?'Pozastavit':'Spustit'}
function scoreRows(classItem){return classItem.toolState.scores}
function renderToolsView(){const root=$('#toolsWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=noClassMessage('Třídní nástroje','Nejprve vytvořte nebo vyberte třídu.');return}const stats=engagementStats(classItem);const coverage=engagementCoverage(classItem);const recent=engagementEntries(classItem).slice(0,10);const scores=scoreRows(classItem);root.innerHTML=`<div class="tools-layout">
<article class="tool-card timer-card"><header><span>ČASOVAČ</span><button data-action="project-tools">Promítnout</button></header><div class="clock-display" data-timer-display>${formatClock(currentTimerRemaining())}</div><div class="preset-row">${[60,180,300,600,900].map(value=>`<button data-timer-preset="${value}">${value<60?value:value/60+' min'}</button>`).join('')}</div><div class="tool-actions"><button class="primary-button compact" data-action="timer-toggle">${App.ui.timer.running?'Pozastavit':'Spustit'}</button><button class="small-button" data-action="timer-reset">Reset</button><label>Vlastní minuty<input id="customTimerMinutes" type="number" min="1" max="180" value="5"></label></div></article>
<article class="tool-card stopwatch-card"><header><span>STOPKY</span></header><div class="clock-display small" data-stopwatch-display>${formatClock(currentStopwatchElapsed())}</div><div class="tool-actions"><button class="primary-button compact" data-action="stopwatch-toggle">${App.ui.stopwatch.running?'Pozastavit':'Spustit'}</button><button class="small-button" data-action="stopwatch-lap">Mezičas</button><button class="small-button" data-action="stopwatch-reset">Reset</button></div><div class="lap-list" id="lapList">${(App.ui.stopwatch.laps||[]).map(value=>`<span>${formatClock(value)}</span>`).join('')}</div></article>
<article class="tool-card quick-card"><header><span>RYCHLÁ NÁHODA</span></header><div class="quick-result" id="quickResult">${escapeHtml(App.ui.quickResult||'Připraveno')}</div><div class="quick-grid"><button data-quick="dice">Kostka D6</button><button data-quick="coin">Mince</button><button data-quick="number">Číslo 1–100</button><button data-action="volunteer-window">Dobrovolník / náhoda</button><button data-action="volunteer-claimed">Dobrovolník je</button></div><label>Možnosti rozhodovače<textarea id="decisionOptions" rows="4" placeholder="Jedna možnost na řádek">${escapeHtml(classItem.toolState.decisionOptions.join('\n'))}</textarea></label><button class="primary-button compact wide-button" data-action="decision-pick">Vylosovat možnost</button></article>
<article class="tool-card score-card"><header><span>TÝMOVÉ SKÓRE</span><div><button data-action="scores-from-groups">Načíst skupiny</button><button data-action="score-add-team">+ Tým</button></div></header><div class="score-list">${scores.length?scores.map(team=>`<div class="score-row" data-team-id="${team.id}"><input value="${escapeHtml(team.name)}" data-score-name><button data-score-change="-1">−</button><strong>${team.score}</strong><button data-score-change="1">＋</button><button class="danger-icon" data-score-delete>×</button></div>`).join(''):'<div class="empty-mini wide">Přidejte týmy nebo načtěte aktuální skupiny.</div>'}</div></article>
<article class="tool-card engagement-card"><header><span>SPRAVEDLIVÉ ZAPOJOVÁNÍ</span><button data-action="engagement-reset">Vymazat historii</button></header><div class="coverage-ring" style="--coverage:${coverage.percent}"><b>${coverage.percent}%</b><span>${coverage.touched} z ${coverage.total} zapojených</span></div><div class="engagement-pick"><select id="engagementKind">${Object.entries(ENGAGEMENT_KINDS).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select><button class="primary-button compact" data-action="fair-pick">Vybrat nejméně zapojeného</button></div><div class="engagement-table"><div class="engagement-head"><span>Student</span><span>Počet</span><span>Naposledy</span><span></span></div>${stats.slice(0,12).map(item=>`<div><b>${escapeHtml(item.student.displayName)}</b><span>${item.count}</span><small>${item.lastAt?formatDateTime(item.lastAt):'—'}</small><button data-engage-student="${item.student.id}">+1</button></div>`).join('')}</div><div class="recent-engagement">${recent.map(item=>{const student=classItem.students.find(s=>s.id===item.studentId);return`<span>${escapeHtml(student?.displayName||'—')} · ${escapeHtml(ENGAGEMENT_KINDS[item.kind]||item.kind)} <button data-undo-engagement="${item.id}">×</button></span>`}).join('')}</div></article>
<article class="tool-card export-card"><header><span>TISK A PDF</span></header><p>Vytvořte čistý výstup pro kolegy nebo žáky. Pro PDF zvolte v tiskovém dialogu „Uložit jako PDF“.</p><div class="export-grid"><button data-export="groups">Skupiny a role</button><button data-export="seating">Zasedací pořádek</button><button data-export="engagement">Přehled zapojení</button><button data-export="cards">Kartičky se jmény</button></div></article>
</div>`;renderTimerDisplays();ensureToolClock()}
function persistToolState(classItem,event='tools_update'){classItem.toolState.updatedAt=nowIso();saveData({event})}
function handleToolAction(target){const classItem=getSelectedClass();if(!classItem)return;const action=target.dataset.action;if(target.dataset.timerPreset){const seconds=Number(target.dataset.timerPreset);App.ui.timer={duration:seconds,remaining:seconds,running:false,endsAt:null};renderTimerDisplays();ensureToolClock();return}if(action==='timer-toggle'){const timer=App.ui.timer;if(timer.running){timer.remaining=currentTimerRemaining();timer.running=false;timer.endsAt=null}else{const custom=Math.max(1,Number($('#customTimerMinutes')?.value)||0)*60;if(timer.remaining<=0){timer.duration=custom;timer.remaining=custom}timer.running=true;timer.endsAt=Date.now()+timer.remaining*1000}renderTimerDisplays();ensureToolClock();return}if(action==='timer-reset'){const custom=Math.max(1,Number($('#customTimerMinutes')?.value)||5)*60;App.ui.timer={duration:custom,remaining:custom,running:false,endsAt:null};renderTimerDisplays();ensureToolClock();return}if(action==='stopwatch-toggle'){const sw=App.ui.stopwatch;if(sw.running){sw.elapsed=currentStopwatchElapsed();sw.running=false;sw.startedAt=null}else{sw.running=true;sw.startedAt=Date.now()}renderTimerDisplays();ensureToolClock();return}if(action==='stopwatch-reset'){App.ui.stopwatch={elapsed:0,running:false,startedAt:null,laps:[]};const list=$('#lapList');if(list)list.innerHTML='';renderTimerDisplays();ensureToolClock();return}if(action==='stopwatch-lap'){const value=currentStopwatchElapsed();App.ui.stopwatch.laps=App.ui.stopwatch.laps||[];App.ui.stopwatch.laps.unshift(value);const lap=document.createElement('span');lap.textContent=formatClock(value);$('#lapList')?.prepend(lap);return}if(target.dataset.quick){const type=target.dataset.quick;App.ui.quickResult=type==='dice'?String(randomInt(6)+1):type==='coin'?(randomInt(2)?'Panna':'Orel'):String(randomInt(100)+1);$('#quickResult').textContent=App.ui.quickResult;return}if(action==='volunteer-window'){const token=uid('volunteer');App.ui.volunteerToken=token;let left=5;const node=$('#quickResult');node.textContent=`Dobrovolník? ${left}`;const handle=setInterval(()=>{if(App.ui.volunteerToken!==token){clearInterval(handle);return}left--;if(left>0){if(node.isConnected)node.textContent=`Dobrovolník? ${left}`;return}clearInterval(handle);try{const student=selectFairStudent({kind:'answer'});App.ui.volunteerToken=null;App.ui.quickResult=student.displayName;toast(`Nikdo se nepřihlásil. Vybrán/a: ${student.displayName}`,'success')}catch(error){toast(error.message,'error')}},1000);return}if(action==='volunteer-claimed'){App.ui.volunteerToken=null;App.ui.quickResult='Dobrovolník vybrán';$('#quickResult').textContent=App.ui.quickResult;toast('Dobrovolník dostal prostor.','success');return}if(action==='decision-pick'){const options=$('#decisionOptions').value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);if(!options.length){toast('Vložte alespoň jednu možnost.','error');return}classItem.toolState.decisionOptions=options;App.ui.quickResult=options[randomInt(options.length)];persistToolState(classItem,'decision_pick');renderToolsView();return}if(action==='scores-from-groups'){classItem.toolState.scores=classItem.currentGroups.map(group=>({id:uid('team'),name:group.name,score:0}));persistToolState(classItem,'scores_groups');return}if(action==='score-add-team'){classItem.toolState.scores.push({id:uid('team'),name:`Tým ${classItem.toolState.scores.length+1}`,score:0});persistToolState(classItem,'score_add');return}if(target.dataset.scoreChange){const row=target.closest('[data-team-id]'),team=classItem.toolState.scores.find(item=>item.id===row?.dataset.teamId);if(team){team.score+=Number(target.dataset.scoreChange);persistToolState(classItem,'score_change')}return}if(target.hasAttribute('data-score-delete')){const id=target.closest('[data-team-id]')?.dataset.teamId;classItem.toolState.scores=classItem.toolState.scores.filter(item=>item.id!==id);persistToolState(classItem,'score_delete');return}if(action==='fair-pick'){try{const student=selectFairStudent({kind:$('#engagementKind').value});App.ui.quickResult=student.displayName;toast(`Vybrán/a: ${student.displayName}`,'success');renderToolsView()}catch(error){toast(error.message,'error')}return}if(target.dataset.engageStudent){recordEngagement(target.dataset.engageStudent,$('#engagementKind')?.value||'answer');return}if(target.dataset.undoEngagement){undoEngagement(target.dataset.undoEngagement);return}if(action==='engagement-reset'){if(!App.settings.confirmDestructive||confirm('Vymazat historii zapojování této třídy?'))resetEngagementHistory();return}if(action==='project-tools'){openProjection('tools');return}if(target.dataset.export){printSortioDocument(target.dataset.export);return}}
function bindToolsUi(){document.addEventListener('click',event=>{const target=event.target.closest('[data-action],[data-timer-preset],[data-quick],[data-score-change],[data-score-delete],[data-engage-student],[data-undo-engagement],[data-export]');if(!target||!target.closest('#toolsWorkspace'))return;handleToolAction(target)});document.addEventListener('change',event=>{if(event.target.matches('[data-score-name]')){const classItem=getSelectedClass();const team=classItem?.toolState.scores.find(item=>item.id===event.target.closest('[data-team-id]')?.dataset.teamId);if(team){team.name=event.target.value.trim()||team.name;persistToolState(classItem,'score_rename')}}})}

;
function projectionModeForCurrent(){if(App.ui.projectionMode&&App.ui.projectionMode!=='auto')return App.ui.projectionMode;if(['groups','seating','draw','tools'].includes(App.route))return App.route;return getSelectedClass()?.currentGroups?.length?'groups':'tools'}
function projectionGroups(classItem){if(!classItem?.currentGroups?.length)return'<div class="projection-empty"><b>Skupiny zatím nejsou vytvořené.</b><span>Vraťte se do modulu Skupiny.</span></div>';return`<div class="projection-groups">${classItem.currentGroups.map(group=>`<article><header><span>${escapeHtml(group.topic||'')}</span><h3>${escapeHtml(group.name)}</h3></header><ul>${resolveStudents(group.studentIds,classItem).map(student=>`<li class="${student.id===group.spokespersonId?'speaker':''}">${escapeHtml(student.displayName)}${student.id===group.spokespersonId?'<small>mluvčí</small>':''}</li>`).join('')}</ul>${Object.keys(group.roleAssignments||{}).length?`<footer>${Object.entries(group.roleAssignments).map(([role,id])=>`<span><b>${escapeHtml(role)}</b>${escapeHtml(classItem.students.find(s=>s.id===id)?.displayName||'—')}</span>`).join('')}</footer>`:''}</article>`).join('')}</div>`}
function projectionSeating(classItem){const seats=classItem?.seatingPlan?.seats||[];if(!seats.some(seat=>seat.studentId))return'<div class="projection-empty"><b>Zasedací pořádek zatím není vytvořený.</b><span>Vraťte se do modulu Místa.</span></div>';const columns=Math.max(...seats.map(seat=>seat.column),0)+1;return`<div class="projection-board">TABULE</div><div class="projection-seats" style="--projection-columns:${columns}">${seats.map(seat=>`<div class="${seat.blocked?'blocked':''}" style="grid-row:${seat.row+1};grid-column:${seat.column+1}">${seat.blocked?'—':escapeHtml(classItem.students.find(s=>s.id===seat.studentId)?.displayName||'Volné místo')}</div>`).join('')}</div>`}
function projectionDraw(classItem){const last=classItem?.drawState?.lastDraw||classItem?.drawHistory?.[0];if(!last)return'<div class="projection-empty"><b>Zatím neproběhlo žádné losování.</b></div>';return`<div class="projection-draw"><span>VYLOSOVÁNO</span><h2>${last.selectedNames.map(escapeHtml).join('<br>')}</h2><p>${last.mode==='order'?'Pořadí celé třídy':last.noRepeat?'Výběr bez opakování':'Volná náhoda'}</p></div>`}
function projectionTools(classItem){const scores=classItem?.toolState?.scores||[];return`<div class="projection-tools"><article><span>ČASOVAČ</span><b data-timer-display>${formatClock(currentTimerRemaining())}</b></article><article><span>STOPKY</span><b data-stopwatch-display>${formatClock(currentStopwatchElapsed())}</b></article>${scores.length?`<section><h3>Týmové skóre</h3>${scores.sort((a,b)=>b.score-a.score).map(team=>`<div><span>${escapeHtml(team.name)}</span><b>${team.score}</b></div>`).join('')}</section>`:''}</div>`}
function renderProjection(){const dialog=$('#projectionDialog'),content=$('#projectionContent'),title=$('#projectionTitle');if(!dialog||!content)return;const classItem=getSelectedClass();const mode=projectionModeForCurrent();const names={groups:'Skupiny',seating:'Zasedací pořádek',draw:'Losování',tools:'Třídní nástroje'};title.textContent=`${classItem?.name||'SORTIO'} · ${names[mode]||'Projekce'}`;content.dataset.mode=mode;content.innerHTML=mode==='groups'?projectionGroups(classItem):mode==='seating'?projectionSeating(classItem):mode==='draw'?projectionDraw(classItem):projectionTools(classItem);renderTimerDisplays()}
function openProjection(mode='auto'){App.ui.projectionMode=mode;const select=$('#projectionMode');if(select)select.value=mode;renderProjection();const dialog=$('#projectionDialog');if(dialog&&!dialog.open)dialog.showModal();recordEvent('projection_open',{mode:projectionModeForCurrent()})}
function closeProjection(){const dialog=$('#projectionDialog');if(document.fullscreenElement?.closest?.('#projectionDialog'))document.exitFullscreen().catch(()=>{});if(dialog?.open)dialog.close()}
function bindProjection(){$('#projectionBtn')?.addEventListener('click',()=>openProjection('auto'));$('#projectionMode')?.addEventListener('change',event=>{App.ui.projectionMode=event.target.value;renderProjection()});document.addEventListener('click',event=>{if(event.target.closest('[data-action="close-projection"]'))closeProjection();if(event.target.closest('[data-action="projection-fullscreen"]')){$('#projectionDialog .projection-shell')?.requestFullscreen?.().catch(()=>toast('Celou obrazovku se nepodařilo aktivovat.','error'))}});document.addEventListener('sortio:data-changed',()=>{if($('#projectionDialog')?.open)renderProjection()})}

;
function printDocumentShell(title,body){const classItem=getSelectedClass();const html=`<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:13mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;margin:0}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #172033;padding-bottom:10px;margin-bottom:18px}header h1{font-size:22px;margin:0 0 5px}header p{margin:0;font-size:11px;color:#5b6575}header b{font-size:11px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{break-inside:avoid;border:1px solid #cbd2dc;border-radius:10px;padding:12px}.card h2{font-size:15px;margin:0 0 8px}.card ul{padding-left:18px;margin:0}.card li{margin:5px 0;font-size:11px}.meta{font-size:9px;color:#6c7480}.roles{margin-top:8px;border-top:1px solid #e0e4ea;padding-top:7px;font-size:9px}.seat-grid{display:grid;gap:7px}.seat{min-height:48px;border:1px solid #bfc7d2;border-radius:7px;display:grid;place-items:center;text-align:center;padding:5px;font-size:9px}.seat.blocked{border-style:dashed;color:#9aa1aa}.board{width:65%;margin:0 auto 18px;padding:6px;border:2px solid #172033;text-align:center;font-size:9px;font-weight:bold}.stats{width:100%;border-collapse:collapse}.stats th,.stats td{border-bottom:1px solid #d7dce3;padding:7px;text-align:left;font-size:10px}.name-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}.name-card{height:70px;border:1px dashed #8c96a5;display:grid;place-items:center;text-align:center;font-size:14px;font-weight:bold;break-inside:avoid}footer{margin-top:18px;border-top:1px solid #d4d8df;padding-top:8px;font-size:8px;color:#6b7480}@media print{button{display:none}}</style></head><body onload="window.print()"><header><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(classItem?.name||'SORTIO')} · ${escapeHtml(classItem?.schoolYear||'')}</p></div><b>${new Intl.DateTimeFormat('cs-CZ',{dateStyle:'long'}).format(new Date())}</b></header>${body}<footer>SORTIO · Autor a vývojový garant Daniel Baláž · Školní projekt Gymnázia, Ostrava-Hrabůvka</footer></body></html>`;const win=window.open('','_blank');if(!win){toast('Prohlížeč zablokoval tiskové okno. Povolte vyskakovací okna.','error');return}win.document.write(html);win.document.close();App.ui.printWindows=(App.ui.printWindows||[]).filter(item=>item&&!item.closed);App.ui.printWindows.push(win);recordEvent('print_export',{title})}
function printSortioDocument(type){const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');if(type==='groups'){if(!classItem.currentGroups.length)throw new Error('Nejprve vytvořte skupiny.');const body=`<div class="grid">${classItem.currentGroups.map(group=>`<section class="card"><h2>${escapeHtml(group.name)} ${group.topic?`· ${escapeHtml(group.topic)}`:''}</h2><ul>${resolveStudents(group.studentIds,classItem).map(student=>`<li>${escapeHtml(student.displayName)}${student.id===group.spokespersonId?' – mluvčí':''}</li>`).join('')}</ul>${Object.keys(group.roleAssignments||{}).length?`<div class="roles">${Object.entries(group.roleAssignments).map(([role,id])=>`<b>${escapeHtml(role)}:</b> ${escapeHtml(classItem.students.find(s=>s.id===id)?.displayName||'—')}`).join('<br>')}</div>`:''}</section>`).join('')}</div>`;printDocumentShell('Skupiny, role a témata',body);return}if(type==='seating'){const seats=classItem.seatingPlan.seats;const columns=Math.max(...seats.map(s=>s.column),0)+1;const body=`<div class="board">TABULE</div><div class="seat-grid" style="grid-template-columns:repeat(${columns},1fr)">${seats.map(seat=>`<div class="seat ${seat.blocked?'blocked':''}" style="grid-row:${seat.row+1};grid-column:${seat.column+1}">${seat.blocked?'Nepoužívá se':escapeHtml(classItem.students.find(s=>s.id===seat.studentId)?.displayName||'Volné')}</div>`).join('')}</div>`;printDocumentShell('Zasedací pořádek',body);return}if(type==='engagement'){const rows=engagementStats(classItem).map(item=>`<tr><td>${escapeHtml(item.student.displayName)}</td><td>${item.count}</td><td>${item.lastAt?formatDateTime(item.lastAt):'—'}</td></tr>`).join('');printDocumentShell('Přehled zapojení',`<table class="stats"><thead><tr><th>Student</th><th>Počet zapojení</th><th>Naposledy</th></tr></thead><tbody>${rows}</tbody></table>`);return}if(type==='cards'){printDocumentShell('Kartičky se jmény',`<div class="name-cards">${classStudents(classItem).map(student=>`<div class="name-card">${escapeHtml(student.displayName)}</div>`).join('')}</div>`);return}}

;
const SORTIO_OUTPUT_BY_EVENT=Object.freeze({
  class_import:'class-import',
  groups_generate:'grouping',
  groups_reroll:'grouping',
  seating_assign:'seating-plan',
  seating_rotate:'seating-plan',
  roles_assign:'roles'
});
function recordEvent(kind,detail={}){
  const outputKind=SORTIO_OUTPUT_BY_EVENT[kind];
  if(!outputKind)return false;
  try{return window.GHRABTelemetry?.recordOutput({outputKind,attemptedQuantity:1,successfulQuantity:1,failedQuantity:0,outcome:'success',metadata:{route:App.route,...detail}})??false}catch(error){console.warn('SORTIO telemetry unavailable',error);return false}
}
function studioAccessRole(){return window.__GHRAB_STUDIO_ACCESS__?.permit?.role||'teacher'}

;
const DEMO_STUDENTS=[['Anna','Nováková'],['Adam','Svoboda'],['Barbora','Dvořáková'],['Cyril','Procházka'],['Daniela','Černá'],['David','Kučera'],['Eliška','Veselá'],['Filip','Horák'],['Gabriela','Němcová'],['Hynek','Marek'],['Ivana','Pokorná'],['Jakub','Král'],['Karolína','Benešová'],['Lukáš','Fiala'],['Marie','Sedláčková'],['Matěj','Růžička'],['Nela','Hájková'],['Ondřej','Jelínek'],['Petra','Konečná'],['Radek','Urban'],['Sára','Bláhová'],['Tomáš','Navrátil'],['Viktorie','Malá'],['Zdeněk','Kříž']];
function createDemoClass(){const existing=App.data.classes.find(item=>item.demo&&!item.archived);if(existing){setSelectedClass(existing.id);toast('Ukázková třída už je připravena.','info');return existing}const students=DEMO_STUDENTS.map(([first,last],index)=>sanitizeStudent({id:uid('demo-student'),firstName:first,lastName:last,present:index!==7,groupLevel:['A','B','C'][index%3],frontPreference:index===2||index===11,createdAt:nowIso(),updatedAt:nowIso()}));const item=createClass({name:'Ukázková třída 2.A',schoolYear:'2026/2027',students});item.demo=true;item.topicCatalog=['Obnovitelné zdroje','Městská doprava','Umělá inteligence','Ochrana vody','Mediální gramotnost','Budoucnost školy'];item.groupRules.apart=[[students[0].id,students[1].id]];item.groupRules.together=[[students[4].id,students[5].id]];saveData({event:'demo_class_create'});toast('Anonymní ukázková třída byla vytvořena.','success');return item}
function productionCheck(id,label,fn){const start=performance.now();try{const value=fn();return Promise.resolve(value).then(detail=>({id,label,state:'pass',detail:String(detail||'Prošlo.'),durationMs:Math.round((performance.now()-start)*10)/10})).catch(error=>({id,label,state:'fail',detail:error.message,durationMs:Math.round((performance.now()-start)*10)/10}))}catch(error){return Promise.resolve({id,label,state:'fail',detail:error.message,durationMs:Math.round((performance.now()-start)*10)/10})}}
async function runProductionChecks(){const checks=[];checks.push(await productionCheck('storage','Lokální úložiště',()=>{const storage=safeStorage();if(!storage)throw new Error('Úložiště není dostupné.');storage.setItem('__sortio_prod_test__','ok');if(storage.getItem('__sortio_prod_test__')!=='ok')throw new Error('Zápis a čtení selhalo.');storage.removeItem('__sortio_prod_test__');return'Zápis a čtení funguje.'}));checks.push(await productionCheck('schema','Datový model v5',()=>App.data?.schema==='sortio-data-v5'&&App.data?.version===5?'Schéma v5 je aktivní.':Promise.reject(new Error('Schéma v5 není aktivní.'))));checks.push(await productionCheck('backup','Záloha a kontrolní součet',()=>{const payload=buildBackupPayload();validateBackupPayload(payload);return`Ověřeno ${payload.summary.classes} tříd a ${payload.summary.students} studentů.`}));checks.push(await productionCheck('import','Import z IS',()=>{const parsed=parseImport('anna.novakova@example.com; petr.svoboda@example.com, anna.novakova@example.com');if(parsed.rows.length!==2||parsed.invalid.length!==1)throw new Error('Parser nevrátil očekávaný výsledek.');return'Oddělovače a duplicity jsou správně rozpoznány.'}));checks.push(await productionCheck('groups','Výkon skupin pro 120 studentů',()=>{const students=Array.from({length:120},(_,index)=>sanitizeStudent({id:`perf-${index}`,firstName:`Student${index+1}`,lastName:'Testovací',groupLevel:['A','B','C'][index%3]}));const mock={students,groupRules:{together:[],apart:[],pins:{}},groupHistory:[]};const groups=solveSmartPartition(mock,students,groupLengths(students.length,{mode:'size',value:4}),'balanced');if(groups.length!==30||groups.some(group=>group.studentIds.length!==4))throw new Error('Rozdělení 120 studentů není správné.');return'120 studentů bylo rozděleno do 30 skupin.'}));checks.push(await productionCheck('seating','Geometrie učebny',()=>{const rows=createSeatLayout('rows',10,12),pairs=createSeatLayout('pairs',5,6),u=createSeatLayout('u',6,8);if(rows.length!==120||pairs.length!==60||u.length!==18)throw new Error('Počet míst neodpovídá rozložení.');return'Řady, dvojice a U mají správnou geometrii.'}));checks.push(await productionCheck('privacy','Soukromí diagnostiky',()=>{const text=JSON.stringify(diagnosticSnapshot());const knownName=getClasses({includeArchived:true}).flatMap(item=>item.students).find(Boolean)?.displayName;if(text.includes('@')||(knownName&&text.includes(knownName)))throw new Error('Diagnostika obsahuje osobní údaj.');return'Diagnostika neobsahuje jména ani e-mailové adresy.'}));checks.push(await productionCheck('pwa','PWA a offline podpora',()=>('serviceWorker'in navigator&&document.querySelector('link[rel="manifest"]'))?'Manifest a Service Worker jsou dostupné.':Promise.reject(new Error('PWA podpora není úplná.'))));App.productionChecks={createdAt:nowIso(),checks};renderProductionChecks();return checks}
function renderProductionHealth(){const root=$('#productionHealth');if(!root)return;const health=storageHealthSnapshot();const status=health.available&&health.primaryValid&&health.lastGoodValid?'good':health.available?'warn':'bad';root.innerHTML=`<div class="health-head"><div><span>STAV DATOVÉHO TREZORU</span><h3>${status==='good'?'Připraveno k provozu':status==='warn'?'Vyžaduje pozornost':'Úložiště není dostupné'}</h3></div><i class="health-dot ${status}"></i></div><div class="health-grid"><span><b>${health.primaryValid?'✓':'!'}</b> Primární data</span><span><b>${health.lastGoodValid?'✓':'!'}</b> Bezpečná kopie</span><span><b>${health.recoveryAvailable?'✓':'—'}</b> Stav před importem</span><span><b>${health.saveCount}</b> Bezpečných zápisů</span></div><small>${health.lastSavedAt?`Poslední zápis: ${formatDateTime(health.lastSavedAt)} · ${Math.ceil(health.primaryBytes/1024)} kB`:'Data zatím nebyla uložena.'}</small>${App.recoveryState?.message?`<p class="recovery-notice">${escapeHtml(App.recoveryState.message)}</p>`:''}`;const restore=$('#restoreRecovery');if(restore)restore.disabled=!health.recoveryAvailable}
function renderProductionChecks(){const root=$('#productionCheckResults');if(!root)return;const checks=App.productionChecks?.checks||[];root.innerHTML=checks.length?checks.map(item=>`<div class="production-check ${item.state}"><i>${item.state==='pass'?'✓':'!'}</i><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.detail)} · ${item.durationMs} ms</small></span></div>`).join(''):'<div class="production-check pending"><i>·</i><span><b>Kontrola ještě nebyla spuštěna</b><small>Ověří data, zálohu, import, výkon, soukromí a PWA.</small></span></div>'}
function diagnosticReport(){return{...diagnosticSnapshot(),schema:'sortio-production-diagnostic-v1',storage:storageHealthSnapshot(),checks:App.productionChecks||null,environment:{language:navigator.language,platform:navigator.platform,viewport:{width:innerWidth,height:innerHeight},standalone:matchMedia('(display-mode: standalone)').matches}}}
function downloadDiagnostic(){downloadText(`SORTIO-diagnostika-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(diagnosticReport(),null,2))}
async function copyDiagnostic(){const text=JSON.stringify(diagnosticReport(),null,2);try{await navigator.clipboard.writeText(text);toast('Diagnostika byla zkopírována.','success')}catch(_){downloadText('SORTIO-diagnostika.json',text);toast('Kopírování nebylo dostupné, diagnostika byla stažena.','info')}}
function bindProductionTools(){$('#createDemoClass')?.addEventListener('click',()=>{createDemoClass();activateRoute('classes')});$('#runProductionChecks')?.addEventListener('click',async event=>{event.currentTarget.disabled=true;event.currentTarget.textContent='Kontroluji…';await runProductionChecks();event.currentTarget.disabled=false;event.currentTarget.textContent='Spustit kontrolu'});$('#downloadDiagnostic')?.addEventListener('click',downloadDiagnostic);$('#copyDiagnostic')?.addEventListener('click',copyDiagnostic);$('#restoreRecovery')?.addEventListener('click',()=>{try{if(App.settings.confirmDestructive!==false&&!confirm('Vrátit data do stavu před posledním importem zálohy?'))return;restoreRecoverySnapshot();toast('Předchozí stav byl obnoven.','success')}catch(error){toast(error.message,'error')}});renderProductionHealth();renderProductionChecks()}

;
const KEYBOARD_ROUTES=['overview','classes','draw','groups','roles','seating','tools','settings','about'];
function isTypingTarget(target){return target?.matches?.('input,textarea,select,[contenteditable="true"]')}
function showKeyboardHelp(){const dialog=$('#keyboardDialog');if(dialog&&!dialog.open)dialog.showModal()}
function bindKeyboardShortcuts(){document.addEventListener('keydown',event=>{if(event.key==='Escape'){const dialog=$$('dialog[open]').at(-1);if(dialog){event.preventDefault();dialog.close();return}}if(isTypingTarget(event.target))return;if(event.key==='?'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();showKeyboardHelp();return}if(event.altKey&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&/^[1-9]$/.test(event.key)){const route=KEYBOARD_ROUTES[Number(event.key)-1];if(route){event.preventDefault();activateRoute(route)}}if(event.altKey&&event.key.toLocaleLowerCase('cs-CZ')==='p'){event.preventDefault();openProjection()}if(event.altKey&&event.key.toLocaleLowerCase('cs-CZ')==='i'){event.preventDefault();document.querySelector('[data-action="open-import"]')?.click()}});$('#keyboardHelpBtn')?.addEventListener('click',showKeyboardHelp);$('#keyboardDialog [data-action="close-dialog"]')?.addEventListener('click',()=>$('#keyboardDialog')?.close());$$('dialog').forEach(dialog=>dialog.addEventListener('close',()=>document.querySelector(`[aria-controls="${dialog.id}"]`)?.focus?.()))}

;
function updateRuntimeHealth(){document.documentElement.dataset.online=navigator.onLine?'true':'false';const health=storageHealthSnapshot();document.documentElement.dataset.storage=health.available?'available':'blocked'}
function bindRuntimeHealth(){updateRuntimeHealth();window.addEventListener('online',()=>{updateRuntimeHealth();toast('Připojení k internetu bylo obnoveno.','success')});window.addEventListener('offline',()=>{updateRuntimeHealth();toast('SORTIO pokračuje v offline režimu.','info')});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')updateRuntimeHealth()})}
function productionReadiness(){const health=storageHealthSnapshot();return{ready:health.available&&health.primaryValid&&health.lastGoodValid,online:navigator.onLine,storage:health,version:SORTIO_VERSION}}

;
function sanitizeDiagnosticMessage(value=''){let text=String(value||'');for(const classItem of getClasses({includeArchived:true}))for(const student of classItem.students||[])if(student.displayName)text=text.split(student.displayName).join('[STUDENT]');return text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[EMAIL]').slice(0,500)}
function diagnosticSnapshot(){const classes=getClasses({includeArchived:true});return{schema:'sortio-diagnostic-v5',appId:APP_ID,version:SORTIO_VERSION,createdAt:nowIso(),role:studioAccessRole(),route:App.route,online:navigator.onLine,storageAvailable:!!safeStorage(),serviceWorker:'serviceWorker'in navigator,motion:App.settings.motion,theme:App.settings.theme,moduleCount:MODULES.length,classCount:classes.length,studentCount:classes.reduce((sum,item)=>sum+classStudents(item,{includeArchived:true}).length,0),ruleCount:classes.reduce((sum,item)=>sum+item.groupRules.together.length+item.groupRules.apart.length+Object.keys(item.groupRules.pins).length,0),roleAssignmentCount:classes.reduce((sum,item)=>sum+item.roleHistory.length,0),seatingPlanCount:classes.filter(item=>item.seatingPlan.seats.length).length,engagementCount:classes.reduce((sum,item)=>sum+(item.engagementHistory?.length||0),0),scoreboardCount:classes.filter(item=>item.toolState?.scores?.length).length,lastOperation:App.lastOperation,lastError:App.lastError?{name:App.lastError.name,message:sanitizeDiagnosticMessage(App.lastError.message)}:null,storageError:App.storageError?{message:sanitizeDiagnosticMessage(App.storageError.message),createdAt:App.storageError.createdAt}:null,recovery:{recovered:!!App.recoveryState?.recovered,source:App.recoveryState?.source||null},privacy:{studentNamesStoredLocally:true,emailDataStored:false,externalDataTransfer:false,externalStudentDataTransfer:false,telemetryContainsPersonalData:false,diagnosticContainsStudentNames:false}}}
window.SORTIO_DIAGNOSTICS={snapshot:diagnosticSnapshot,report:()=>typeof diagnosticReport==='function'?diagnosticReport():diagnosticSnapshot(),runChecks:()=>typeof runProductionChecks==='function'?runProductionChecks():[]};

;
function transientControlKey(control,index){
  return[
    control.tagName,
    control.id||'',
    control.getAttribute('name')||'',
    control.dataset.action||'',
    control.dataset.id||'',
    control.dataset.groupId||'',
    control.dataset.studentId||'',
    control.closest('[data-team-id]')?.dataset.teamId||'',
    index,
  ].join('|');
}
function captureTransientViewState(){
  const root=$(`[data-view="${App.route}"]`);
  if(!root)return null;
  const controls=[...root.querySelectorAll('input,textarea,select')].filter(control=>control.type!=='file');
  const active=document.activeElement;
  return{
    route:App.route,
    rootScrollTop:root.scrollTop,
    controls:controls.map((control,index)=>({
      key:transientControlKey(control,index),
      value:control.value,
      checked:control.checked,
      scrollTop:control.scrollTop,
      selectionStart:typeof control.selectionStart==='number'?control.selectionStart:null,
      selectionEnd:typeof control.selectionEnd==='number'?control.selectionEnd:null,
      active:control===active,
    })),
  };
}
function restoreTransientViewState(snapshot){
  if(!snapshot||snapshot.route!==App.route)return;
  const root=$(`[data-view="${App.route}"]`);
  if(!root)return;
  const controls=[...root.querySelectorAll('input,textarea,select')].filter(control=>control.type!=='file');
  const byKey=new Map(controls.map((control,index)=>[transientControlKey(control,index),control]));
  for(const saved of snapshot.controls){
    const control=byKey.get(saved.key);
    if(!control)continue;
    if(control.type==='checkbox'||control.type==='radio')control.checked=saved.checked;
    else control.value=saved.value;
    control.scrollTop=saved.scrollTop||0;
    if(saved.active){
      control.focus({preventScroll:true});
      if(saved.selectionStart!==null&&typeof control.setSelectionRange==='function'){
        try{control.setSelectionRange(saved.selectionStart,saved.selectionEnd)}catch(_){}
      }
    }
  }
  root.scrollTop=snapshot.rootScrollTop||0;
}
function renderActiveDataView(){
  renderDashboard();
  if(App.route==='classes')renderClassesView();
  if(App.route==='draw')renderDrawView();
  if(App.route==='groups')renderGroupsView();
  if(App.route==='roles')renderRolesView();
  if(App.route==='seating')renderSeatingView();
  if(App.route==='tools')renderToolsView();
  if(App.route==='settings'){renderSettingsDataSummary();renderProductionHealth()}
  refreshAccessibilityLabels();
}
function bindCrossTabStorageSync(){
  window.addEventListener('storage',event=>{
    const canonical=suiteCanonicalStorageKey(DATA_KEY);
    if(event.key!==canonical&&event.key!==DATA_KEY)return;
    if(!suiteSessionContentWriteAllowed({triggerCleanup:true}))return;
    try{
      App.data=loadData();
      App.storageError={message:'Data byla aktualizována v jiné kartě.',createdAt:nowIso(),quotaExceeded:false,conflict:true};
      document.dispatchEvent(new CustomEvent('sortio:data-changed',{detail:{event:'storage_external_change'}}));
      toast('Data byla změněna v jiné kartě. SORTIO načetlo novější stav.','info');
    }catch(error){captureError(error,'storage-external-sync')}
  });
}
async function init(){
  if(!(await prepareSuiteSessionLifecycle())){document.documentElement.dataset.appReady='suite-session-blocked';return}
  App.settings={...App.settings,...loadSettings()};
  App.data=loadData();
  applyTheme();applyMotion();
  bindNavigation();bindSettings();bindClassUi();bindDrawUi();bindGroupsUi();bindRolesUi();bindSeatingUi();bindToolsUi();bindProjection();bindProductionTools();bindKeyboardShortcuts();bindRuntimeHealth();bindPwaInstall();bindCrossTabStorageSync();
  renderRoadmap();enhanceAccessibility();registerServiceWorker();
  document.addEventListener('sortio:data-changed',()=>{
    const transient=captureTransientViewState();
    ensureSelectedClass();
    renderActiveDataView();
    restoreTransientViewState(transient);
  });
  const initial=ROUTES.has(location.hash.slice(1))?location.hash.slice(1):(App.settings.lastRoute||'overview');
  activateRoute(initial,{save:false,scroll:false});
  window.scrollTo(0,0);
  document.documentElement.dataset.appReady='true';
  App.suiteSession.hydrated=true;
  App.lastOperation='ready';
  recordEvent('app_open',{version:SORTIO_VERSION});
  console.info(`SORTIO ${SORTIO_VERSION} připraveno · ${MODULES.length} modulů`);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{void init()},{once:true});else void init();

