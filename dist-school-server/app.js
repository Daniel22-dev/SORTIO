'use strict';
const SORTIO_VERSION='__APP_VERSION__';
const APP_ID='sortio';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const nowIso=()=>new Date().toISOString();
const uid=(prefix='id')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const App={version:SORTIO_VERSION,route:'overview',lastOperation:'start',lastError:null,startedAt:nowIso(),settings:{theme:'dark',motion:true,confirmDestructive:true},data:null,ui:{importRows:[],importInvalid:[],importNameOrder:'first-last',studentSearch:'',groupMode:'size',smartGroupMode:'random',groupPanel:'build',seatingPanel:'plan',timer:{duration:300,remaining:300,running:false,endsAt:null},stopwatch:{elapsed:0,running:false,startedAt:null,laps:[]},drawMode:'single',drawCount:2,noRepeat:true,quickResult:null,projectionMode:'auto',lessonSpotlightId:null,mediaLibraryTarget:null,mediaLibraryBusy:false,pollSyncHandles:{},printWindows:[]},suiteSession:{lifecycleReady:false,hydrated:false,generationAtHydration:'',writeBlocked:false,cleanupGeneration:'',cleanupPromise:null,unsubscribe:null,lastCompletedGeneration:'',lastFailure:null}};
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
function defaultLessonBoardState(){
  const sceneId='scene-default';
  return{activeSceneId:sceneId,scenes:[{id:sceneId,classId:'',name:'Obecná pracovní plocha',background:{type:'gradient',value:'midnight'},widgets:[]}],updatedAt:null};
}
function defaultData(){return{schema:'sortio-data-v5',version:5,selectedClassId:null,classes:[],aliases:{},lessonBoard:defaultLessonBoardState(),createdAt:nowIso(),updatedAt:nowIso(),integrity:{saveCount:0,lastSavedAt:null}}}
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
    lessonBoard:sanitizeLessonBoard(source.lessonBoard),
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
  return{id:sanitizeIdentifier(item.id,'student'),firstName,lastName,displayName:`${firstName} ${lastName}`.trim(),key:normalizeText(`${firstName} ${lastName}`),present:item.present!==false,archived:!!item.archived,groupLevel:['A','B','C'].includes(item.groupLevel)?item.groupLevel:'B',frontPreference:!!item.frontPreference,soloPreference:!!item.soloPreference,createdAt:item.createdAt||nowIso(),updatedAt:item.updatedAt||nowIso()};
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
  const plan={...defaultSeatingPlan(),...(value&&typeof value==='object'?value:{})};plan.template=['rows','pairs','islands','u','custom'].includes(plan.template)?plan.template:'rows';const minDimension=plan.template==='custom'?1:2;plan.rows=Math.max(minDimension,Math.min(10,Number(plan.rows)||4));plan.columns=Math.max(minDimension,Math.min(plan.template==='custom'?16:12,Number(plan.columns)||6));
  // Starší vlastní plány z 1.1.9 mohou mít souřadnice mimo nový editor 3×7. Při načtení je nezmenšujeme ani nesléváme; limit 3×7 platí až pro nové kreslení.
  plan.seats=Array.isArray(plan.seats)?plan.seats.slice(0,240).map(seat=>({id:sanitizeIdentifier(seat.id,'seat'),row:Number(seat.row||0),column:Number(seat.column||0),island:Number.isFinite(Number(seat.island))?Number(seat.island):null,deskRow:Number.isFinite(Number(seat.deskRow))?Math.max(0,Math.min(9,Number(seat.deskRow))):null,deskColumn:Number.isFinite(Number(seat.deskColumn))?Math.max(0,Math.min(15,Number(seat.deskColumn))):null,deskSlot:Number.isFinite(Number(seat.deskSlot))?Math.max(0,Math.min(1,Number(seat.deskSlot))):null,label:String(seat.label||'').slice(0,30),studentId:sanitizeStudentRef(seat.studentId,ids,studentRefMap),blocked:!!seat.blocked,locked:!!seat.locked})):[];return plan;
}
function sanitizeEngagementHistory(value,ids,studentRefMap=null){
  if(!Array.isArray(value))return[];
  return value.map(item=>({id:sanitizeIdentifier(item?.id,'engagement'),studentId:sanitizeStudentRef(item?.studentId,ids,studentRefMap),kind:['answer','presentation','speaker','volunteer','other'].includes(item?.kind)?item.kind:'other',label:String(item?.label||'').slice(0,200),createdAt:item?.createdAt||nowIso()})).filter(item=>!!item.studentId).slice(0,HISTORY_LIMITS.engagement);
}

function sanitizeLessonBoard(value){
  const source=value&&typeof value==='object'?value:{};
  const rawScenes=Array.isArray(source.scenes)?source.scenes.slice(0,12):[];
  const scenes=rawScenes.map(sanitizeLessonScene).filter(Boolean);
  if(!scenes.length)scenes.push(...defaultLessonBoardState().scenes);
  const activeRaw=String(source.activeSceneId||'');
  const activeSceneId=scenes.some(scene=>scene.id===activeRaw)?activeRaw:scenes[0].id;
  return{activeSceneId,scenes,updatedAt:source.updatedAt||null};
}
function sanitizeLessonScene(value){
  if(!value||typeof value!=='object')return null;
  const id=sanitizeIdentifier(value.id,'scene');
  const widgets=Array.isArray(value.widgets)?value.widgets.slice(0,30).map(sanitizeLessonWidget).filter(Boolean):[];
  const rawClassId=String(value.classId||'');const classId=rawClassId==='__general__'?'__general__':rawClassId?sanitizeIdentifier(rawClassId,'class'):'';return{id,classId,name:String(value.name||'Pracovní plocha').slice(0,80),background:sanitizeLessonBackground(value.background),widgets};
}
function sanitizeLessonBackground(value){
  const source=value&&typeof value==='object'?value:{};
  if(source.type==='image'){
    const url=sanitizeLessonImageUrl(source.url);
    if(url)return{type:'image',url,sourcePage:sanitizeLessonSourceUrl(source.sourcePage),sourceLabel:String(source.sourceLabel||'Wikimedia Commons').slice(0,160),license:String(source.license||'').slice(0,80)};
  }
  if(source.type==='solid')return{type:'solid',value:['slate','paper','forest','sand'].includes(source.value)?source.value:'slate'};
  return{type:'gradient',value:['midnight','aurora','ocean','sunset','violet','clean'].includes(source.value)?source.value:'midnight'};
}
function sanitizeLessonImageUrl(value){
  try{const url=new URL(String(value||''));return url.protocol==='https:'&&url.hostname==='upload.wikimedia.org'?url.href:''}catch(_){return''}
}
function sanitizeLessonSourceUrl(value){
  try{const url=new URL(String(value||''));return url.protocol==='https:'&&['commons.wikimedia.org','www.wikidata.org'].includes(url.hostname)?url.href:''}catch(_){return''}
}
function sanitizeLessonWidget(value){
  if(!value||typeof value!=='object')return null;
  const type=String(value.type||'');
  if(!['timer','visual-timer','stopwatch','clock','traffic','draw','dice','score','text','work','image','event','agenda','poll','qr'].includes(type))return null;
  const pos=n=>Math.max(0,Math.min(100,Number(n)||0));
  const size=(n,min)=>Math.max(min,Math.min(100,Number(n)||min));
  const scale=Math.max(.65,Math.min(2.2,Number(value.scale)||1));return{id:sanitizeIdentifier(value.id,'widget'),type,x:pos(value.x),y:pos(value.y),w:size(value.w,12),h:size(value.h,14),scale,locked:!!value.locked,title:String(value.title||'').slice(0,80),data:sanitizeLessonWidgetData(type,value.data)};
}
function sanitizeLessonWidgetData(type,value){
  const d=value&&typeof value==='object'?value:{};
  const safeSeconds=(v,max=24*3600)=>Math.max(0,Math.min(max,Math.floor(Number(v)||0)));
  if(type==='timer'||type==='visual-timer')return{duration:safeSeconds(d.duration||300),remaining:safeSeconds(d.remaining??d.duration??300),running:!!d.running,endsAt:Number.isFinite(Number(d.endsAt))?Number(d.endsAt):null,sound:['bell','piano','guitar','xylophone','trumpet','drum','none'].includes(d.sound)?d.sound:'bell',showNumbers:d.showNumbers!==false};
  if(type==='stopwatch')return{elapsed:safeSeconds(d.elapsed,7*24*3600),running:!!d.running,startedAt:Number.isFinite(Number(d.startedAt))?Number(d.startedAt):null,laps:Array.isArray(d.laps)?d.laps.slice(0,30).map(v=>safeSeconds(v,7*24*3600)):[]};
  if(type==='clock')return{style:['digital','analog','both'].includes(d.style)?d.style:'both',showSeconds:d.showSeconds!==false};
  if(type==='traffic')return{active:['red','amber','green'].includes(d.active)?d.active:''};
  if(type==='draw')return{tool:['pen','line','rect','ellipse','eraser'].includes(d.tool)?d.tool:'pen',color:/^#[0-9a-f]{6}$/i.test(String(d.color||''))?String(d.color):'#ffffff',width:Math.max(1,Math.min(16,Number(d.width)||4)),paper:['blank','lines','grid'].includes(d.paper)?d.paper:'blank',strokes:Array.isArray(d.strokes)?d.strokes.slice(-120).map(sanitizeLessonStroke).filter(Boolean):[]};
  if(type==='dice')return{count:Math.max(1,Math.min(3,Number(d.count)||1)),sides:[6,12,20].includes(Number(d.sides))?Number(d.sides):6,last:Array.isArray(d.last)?d.last.slice(0,3).map(v=>String(v??'').slice(0,80)).filter(Boolean):[],mode:['dice','d12','d20','coin','number','letters','color','math','custom'].includes(d.mode)?d.mode:'dice',min:Math.max(-999,Math.min(999,Number(d.min)||1)),max:Math.max(-999,Math.min(999,Number(d.max)||100)),custom:Array.isArray(d.custom)?d.custom.slice(0,30).map(v=>String(v).slice(0,80)).filter(Boolean):[]};
  if(type==='score')return{mode:['points','duel','race'].includes(d.mode)?d.mode:'points',goal:Math.max(1,Math.min(999,Number(d.goal)||10)),teams:Array.isArray(d.teams)?d.teams.slice(0,12).map((team,index)=>({id:sanitizeIdentifier(team?.id,'board-team'),name:String(team?.name||`Tým ${index+1}`).slice(0,80),score:Math.max(-999,Math.min(9999,Number(team?.score)||0))})):[]};
  if(type==='text')return{text:String(d.text||'Napište instrukci…').slice(0,2000),size:Math.max(14,Math.min(72,Number(d.size)||28)),align:['left','center','right'].includes(d.align)?d.align:'center'};
  if(type==='work')return{mode:['silent','whisper','pair','group','discussion'].includes(d.mode)?d.mode:'silent'};
  if(type==='image')return{url:sanitizeLessonImageUrl(d.url),sourcePage:sanitizeLessonSourceUrl(d.sourcePage),sourceLabel:String(d.sourceLabel||'Wikimedia Commons').slice(0,160),license:String(d.license||'').slice(0,80),fit:['cover','contain'].includes(d.fit)?d.fit:'cover'};
  if(type==='event')return{title:String(d.title||'Událost').slice(0,120),date:/^\d{4}-\d{2}-\d{2}$/.test(String(d.date||''))?String(d.date):'',schoolDaysOnly:!!d.schoolDaysOnly};
  if(type==='agenda')return{active:Math.max(0,Math.min(19,Number(d.active)||0)),items:Array.isArray(d.items)?d.items.slice(0,20).map(item=>({title:String(item?.title||'Aktivita').slice(0,120),minutes:Math.max(0,Math.min(180,Number(item?.minutes)||0))})):[]};
  if(type==='poll')return{question:String(d.question||'Otázka').slice(0,300),options:Array.isArray(d.options)?d.options.slice(0,5).map((option,index)=>({id:sanitizeIdentifier(option?.id||`opt-${index+1}`,'poll-option'),label:String(option?.label||`Možnost ${index+1}`).slice(0,120),votes:Math.max(0,Math.min(9999,Number(option?.votes)||0))})):[],status:['draft','open','closed'].includes(d.status)?d.status:'draft',showResults:d.showResults!==false,remote:sanitizeLessonPollRemote(d.remote)};
  if(type==='qr')return{url:sanitizeLessonQrUrl(d.url),label:String(d.label||'Odkaz').slice(0,160),qrUrl:sanitizeLessonSelfUrl(d.qrUrl)};
  return{};
}
function sanitizeLessonPollRemote(value){
  const d=value&&typeof value==='object'?value:{};
  return{id:String(d.id||'').replace(/[^A-Za-z0-9._:-]/g,'').slice(0,120),token:String(d.token||'').replace(/[^A-Za-z0-9._:-]/g,'').slice(0,240),voteUrl:sanitizeLessonQrUrl(d.voteUrl),qrUrl:sanitizeLessonSelfUrl(d.qrUrl),syncedAt:String(d.syncedAt||'').slice(0,40)};
}
function sanitizeLessonQrUrl(value){try{const u=new URL(String(value||''));return ['https:','http:'].includes(u.protocol)?u.href:''}catch(_){return''}}
function sanitizeLessonSelfUrl(value){try{const loc=globalThis.location;if(!loc?.href||!loc?.origin)return'';const u=new URL(String(value||''),loc.href);return u.origin===loc.origin?u.href:''}catch(_){return''}}
function sanitizeLessonStroke(value){
  if(!value||typeof value!=='object')return null;
  const points=Array.isArray(value.points)?value.points.slice(0,300).map(p=>({x:Math.max(0,Math.min(1,Number(p?.x)||0)),y:Math.max(0,Math.min(1,Number(p?.y)||0))})):[];
  if(!points.length)return null;
  return{tool:['pen','line','rect','ellipse','eraser'].includes(value.tool)?value.tool:'pen',color:/^#[0-9a-f]{6}$/i.test(String(value.color||''))?String(value.color):'#ffffff',width:Math.max(1,Math.min(16,Number(value.width)||4)),points};
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
function storageHealthSnapshot(){const storage=safeStorage();let primaryPresent=false,lastGoodPresent=false,primaryValid=false,lastGoodValid=false,primaryBytes=0,lastGoodBytes=0;try{const text=storage?.getItem(DATA_KEY)||'';primaryPresent=!!text;primaryBytes=new Blob([text]).size;primaryValid=primaryPresent&&acceptedDataSchema(JSON.parse(text).schema)}catch(_){}try{const text=storage?.getItem(LAST_GOOD_KEY)||'';lastGoodPresent=!!text;lastGoodBytes=new Blob([text]).size;lastGoodValid=lastGoodPresent&&acceptedDataSchema(JSON.parse(text).schema)}catch(_){}return{available:!!storage,primaryPresent,lastGoodPresent,primaryValid,lastGoodValid,primaryBytes,lastGoodBytes,recoveryAvailable:hasRecoverySnapshot(),corruptSnapshotAvailable:!!storage?.getItem(CORRUPT_KEY),saveCount:Number(App.data?.integrity?.saveCount||0),lastSavedAt:App.data?.integrity?.lastSavedAt||null}}

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
function makeStudent(firstName,lastName){firstName=titleCase(firstName);lastName=titleCase(lastName);return sanitizeStudent({id:uid('student'),firstName,lastName,present:true,archived:false,groupLevel:'B',frontPreference:false,soloPreference:false,createdAt:nowIso(),updatedAt:nowIso()})}
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
  if('soloPreference'in patch)student.soloPreference=!!patch.soloPreference;
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
function renderDashboard(){
  const classes=getClasses();
  const selected=getSelectedClass();
  const stats=activeRosterStats(selected);
  const mapping={classCount:classes.length,studentCount:totalStudentCount(),drawCount:drawsToday(),activeClass:selected?.name||'—',activePresent:stats.present,activeTotal:stats.all};
  for(const[id,value]of Object.entries(mapping))$$(`[data-stat="${id}"]`).forEach(node=>node.textContent=value);
  const panel=$('#activeClassPanel');
  if(!panel)return;
  if(!selected){
    panel.innerHTML=`<div><span>ZAČÍNÁME</span><h3>Vytvořte první třídu</h3><p>Zkopírujte seznam školních e-mailů z IS. SORTIO z něj připraví jména ke kontrole.</p></div><button class="primary-button compact" data-action="open-import">Importovat z IS</button>`;
    return;
  }
  panel.replaceChildren();
  const info=document.createElement('div'),eyebrow=document.createElement('span'),heading=document.createElement('h3'),meta=document.createElement('p');
  eyebrow.textContent='AKTIVNÍ TŘÍDA';heading.textContent=selected.name;meta.textContent=`${selected.schoolYear||'Školní rok není uveden'} · ${stats.present} přítomných z ${stats.all}`;info.append(eyebrow,heading,meta);
  const actions=document.createElement('div');actions.className='active-class-actions';
  const label=document.createElement('label');label.className='dashboard-class-picker';const labelText=document.createElement('span');labelText.textContent='Změnit třídu';
  const select=document.createElement('select');select.id='dashboardClassSelect';select.setAttribute('aria-label','Zvolit aktivní třídu');
  for(const item of classes){const option=document.createElement('option');option.value=item.id;option.textContent=item.name;option.selected=item.id===selected.id;select.append(option)}
  label.append(labelText,select);
  const attendance=document.createElement('button');attendance.className='small-button';attendance.dataset.route='classes';attendance.textContent='Docházka';
  const draw=document.createElement('button');draw.className='primary-button compact';draw.dataset.route='draw';draw.textContent='Losovat';
  actions.append(label,attendance,draw);panel.append(info,actions);
}

;
function splitImportTokens(raw=''){const text=String(raw).trim();if(!text)return[];return text.split(/[,;\n\r\t ]+/).map(item=>item.trim()).filter(Boolean)}
function aliasValue(raw){return App.data.aliases[normalizeText(raw).replace(/ /g,'_')]||''}
function applyAlias(raw,fallback){return aliasValue(raw)||fallback}
function cleanImportPart(value=''){return String(value).replace(/\d+$/,'')}
const IMPORT_GIVEN_NAMES=Object.freeze(Object.fromEntries([
  'Adéla','Adriána','Aleš','Anežka','Antonín','Beáta','Běla','Blažena','Bohumír','Bořek','Břetislav','Čestmír','Eliška','František','Jáchym','Jaromír','Jiří','Jonáš','Karolína','Kateřina','Klára','Kristýna','Kryštof','Lukáš','Markéta','Matěj','Mikuláš','Miloš','Natálie','Ondřej','Šárka','Šimon','Štěpán','Tomáš','Václav','Věra','Vít','Vojtěch','Zdeněk','Žaneta','Soňa','Růžena','Radomír','Lubomír','Luděk','Oldřich','Přemysl','Řehoř','Tobiáš','Vendula','Zbyněk','Zdeňka','Zuzana','Dávid','Erik','Nela','Tereza','Veronika','Michaela','Lucie','Marie','Julie','Hana','Petr','Pavel','Josef','Jakub','Jan','Martin','Daniel','David','Filip','Marek','Michal','Roman','Patrik','Samuel','Dominik','Barbora','Lenka','Petra','Monika','Simona','Nikola','Laura','Magdalena','Viktorie','Gabriela','Helena','Ivana','Jitka','Karel','Libor','Radek','Richard','Robin','Sabina','Stanislav','Zuzana'
].map(name=>[normalizeText(name).replace(/ /g,'_'),name])));
function canonicalImportFirstName(raw){const learned=aliasValue(raw);if(learned)return titleCase(learned);const key=normalizeText(raw).replace(/ /g,'_');return IMPORT_GIVEN_NAMES[key]||titleCase(raw)}
function parseImportToken(token,index=0,{nameOrder=App.ui.importNameOrder||'first-last'}={}){const original=String(token).trim();const at=original.indexOf('@');let local=at>=0?original.slice(0,at):original;if(at>=0&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(original))return{valid:false,original,reason:'Neplatný formát e-mailu'};local=local.replace(/\+.*/,'').trim().replace(/^mailto:/i,'');const parts=local.split(/[._]+/).filter(Boolean).map(cleanImportPart).filter(Boolean);if(parts.length<2)return{valid:false,original,reason:'Chybí oddělení jména a příjmení tečkou'};const firstPart=parts.shift();const remaining=parts.join(' ');const rawFirst=nameOrder==='last-first'?remaining:firstPart;const rawLast=nameOrder==='last-first'?firstPart:remaining;const firstName=canonicalImportFirstName(rawFirst);const firstNameAuto=firstName!==titleCase(rawFirst);const lastName=titleCase(applyAlias(rawLast,titleCase(rawLast)));if(!firstName||!lastName)return{valid:false,original,reason:'Jméno nebylo rozpoznáno'};return{valid:true,id:`preview-${index}-${normalizeText(local).replace(/ /g,'-')}`,original,local,rawFirst,rawLast,firstName,lastName,displayName:`${firstName} ${lastName}`,firstNameAuto,key:normalizeText(`${firstName} ${lastName}`),duplicate:false}}
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
function renderSelectedClass(){const root=$('#classWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=`<article class="empty-state premium-empty"><div class="empty-mark">S</div><span>PRVNÍ KROK</span><h2>Vložte skupinu z IS</h2><p>Zkopírujte e-mailové adresy celé skupiny, zkontrolujte rozpoznaná jména a uložte třídu. E-mailové adresy se po potvrzení neuchovávají.</p><div><button class="primary-button" data-action="open-import">Importovat z IS</button><button class="secondary-button" data-action="new-class">Založit ručně</button></div></article>`;return}const stats=activeRosterStats(classItem);const students=classStudents(classItem);root.innerHTML=`<div class="class-workspace-head"><div><span>AKTIVNÍ TŘÍDA</span><h2>${escapeHtml(classItem.name)}</h2><p>${escapeHtml(classItem.schoolYear||'Bez školního roku')} · ${stats.present} přítomných · ${stats.absent} nepřítomných</p></div><div class="workspace-actions"><button class="secondary-button compact" data-action="edit-class">Upravit</button><button class="primary-button compact" data-action="open-import-update">Aktualizovat z IS</button></div></div><div class="attendance-toolbar"><label class="student-search"><span>⌕</span><input id="studentSearch" type="search" placeholder="Hledat studenta" value="${escapeHtml(App.ui.studentSearch)}"></label><div><button class="small-button" data-action="all-present">Všichni přítomni</button><button class="small-button" data-action="all-absent">Všichni nepřítomni</button></div></div><div class="student-table"><div class="student-table-head"><span>Student</span><span>Docházka</span><span></span></div>${students.length?students.map(studentRow).join(''):'<div class="empty-mini wide">Ve třídě zatím nejsou žádní studenti.</div>'}<div class="empty-mini wide" id="studentSearchEmpty" hidden>Hledání neodpovídá žádnému studentovi.</div></div><form class="quick-add" id="quickAddStudent"><div><span>RYCHLÉ PŘIDÁNÍ</span><p>Jméno lze po přidání upravit.</p></div><input name="firstName" autocomplete="off" placeholder="Jméno" required><input name="lastName" autocomplete="off" placeholder="Příjmení" required><button class="small-button" type="submit">Přidat</button></form><div class="class-danger-actions"><button data-action="duplicate-class">Vytvořit kopii</button><button data-action="archive-class">Archivovat třídu</button><button class="danger-text" data-action="delete-class">Smazat třídu</button></div>`}
function studentRow(student){const query=normalizeText(App.ui.studentSearch);const searchName=normalizeText(student.displayName);return`<div class="student-row" data-student-id="${student.id}" data-search-name="${escapeHtml(searchName)}" ${query&&!searchName.includes(query)?'hidden':''}><span class="student-name"><i>${escapeHtml(`${student.firstName[0]||''}${student.lastName[0]||''}`)}</i><b>${escapeHtml(student.displayName)}</b></span><label class="presence-toggle"><input type="checkbox" data-action="toggle-presence" data-id="${student.id}" ${student.present?'checked':''}><span>${student.present?'Přítomen':'Nepřítomen'}</span></label><span class="row-actions"><button title="Upravit jméno" data-action="edit-student" data-id="${student.id}">✎</button><button title="Odebrat ze třídy" data-action="remove-student" data-id="${student.id}">×</button></span></div>`}

function filterStudentRows(value){
  const query=normalizeText(value);
  let visible=0;
  $$('.student-row[data-search-name]', $('#classWorkspace')).forEach(row=>{const show=!query||String(row.dataset.searchName||'').includes(query);row.hidden=!show;if(show)visible++});
  const empty=$('#studentSearchEmpty');
  if(empty)empty.hidden=visible>0||!query;
}
function openClassDialog(mode='new'){const dialog=$('#classDialog');const classItem=getSelectedClass();$('#classDialogTitle').textContent=mode==='edit'?'Upravit třídu':'Nová prázdná třída';$('#classDialogMode').value=mode;$('#classNameInput').value=mode==='edit'?(classItem?.name||''):'';$('#schoolYearInput').value=mode==='edit'?(classItem?.schoolYear||''):suggestSchoolYear();dialog.showModal();setTimeout(()=>$('#classNameInput').focus(),50)}
function suggestSchoolYear(){const date=new Date();const year=date.getFullYear();const start=date.getMonth()>=7?year:year-1;return`${start}/${start+1}`}
function openImportDialog(mode='new'){const dialog=$('#importDialog');const selected=getSelectedClass();App.ui.importRows=[];App.ui.importInvalid=[];$('#importMode').value=mode;$('#importDialogTitle').textContent=mode==='update'?'Aktualizovat třídu z IS':'Importovat novou třídu z IS';$('#importClassName').value=mode==='update'?(selected?.name||''):'';$('#importSchoolYear').value=mode==='update'?(selected?.schoolYear||suggestSchoolYear()):suggestSchoolYear();$('#importReplaceRow').hidden=mode!=='update';$('#replaceRoster').checked=false;$('#importNameOrder').value=App.ui.importNameOrder||'first-last';$('#isPaste').value='';renderImportPreview();dialog.showModal();setTimeout(()=>$('#isPaste').focus(),50)}
function renderImportPreview(){const root=$('#importPreview');if(!root)return;const rows=App.ui.importRows||[];const invalid=App.ui.importInvalid||[];$('#importCount')&&( $('#importCount').textContent=rows.length);root.innerHTML=rows.length?`<div class="import-preview-head"><span>#</span><span>Jméno</span><span>Příjmení</span><span>Stav</span></div>${rows.map((row,index)=>`<div class="import-preview-row" data-preview-id="${row.id}"><span>${index+1}</span><input data-field="firstName" value="${escapeHtml(row.firstName)}" aria-label="Jméno ${index+1}"><input data-field="lastName" value="${escapeHtml(row.lastName)}" aria-label="Příjmení ${index+1}"><span class="import-ok">${row.firstNameAuto?'✓ diakritika':'Rozpoznáno'}</span></div>`).join('')}`:`<div class="import-placeholder"><span>⌁</span><b>Vložte seznam e-mailů</b><p>Podporujeme čárky, středníky, mezery i nové řádky.</p></div>`;const warning=$('#importWarnings');if(warning){warning.hidden=!invalid.length;warning.innerHTML=invalid.length?`<b>${invalid.length} položek vyžaduje pozornost</b>${invalid.slice(0,6).map(item=>`<span>${escapeHtml(item.original)} – ${escapeHtml(item.reason)}</span>`).join('')}`:''}const save=$('#saveImport');if(save)save.disabled=!rows.length}
function bindClassUi(){document.addEventListener('input',event=>{if(event.target.id==='studentSearch'){App.ui.studentSearch=event.target.value;filterStudentRows(event.target.value);return}const preview=event.target.closest('.import-preview-row');if(preview&&event.target.dataset.field){const row=App.ui.importRows.find(item=>item.id===preview.dataset.previewId);if(row){row[event.target.dataset.field]=titleCase(event.target.value);row.displayName=`${row.firstName} ${row.lastName}`.trim();row.key=normalizeText(row.displayName)}}});document.addEventListener('change',event=>{if(event.target.id==='dashboardClassSelect'){setSelectedClass(event.target.value);return}if(event.target.dataset.action==='toggle-presence'){updateStudent(getSelectedClass()?.id,event.target.dataset.id,{present:event.target.checked});recordEvent('attendance_change',{present:event.target.checked})}if(event.target.id==='importNameOrder'){App.ui.importNameOrder=event.target.value;if($('#isPaste')?.value.trim()){const parsed=parseImport($('#isPaste').value,{nameOrder:App.ui.importNameOrder});App.ui.importRows=parsed.rows;App.ui.importInvalid=parsed.invalid;renderImportPreview()}}});document.addEventListener('submit',event=>{if(event.target.id==='quickAddStudent'){event.preventDefault();const data=new FormData(event.target);try{addStudent(getSelectedClass().id,data.get('firstName'),data.get('lastName'));event.target.reset();toast('Student byl přidán.','success')}catch(error){if(error.code==='DUPLICATE_STUDENT_NAME'&&confirm(error.message)){addStudent(getSelectedClass().id,data.get('firstName'),data.get('lastName'),{allowDuplicate:true});event.target.reset();toast('Jmenovec byl přidán.','success')}else if(error.code!=='DUPLICATE_STUDENT_NAME')toast(error.message,'error')}}if(event.target.id==='classForm'){event.preventDefault();const mode=$('#classDialogMode').value;const name=$('#classNameInput').value.trim();const schoolYear=$('#schoolYearInput').value.trim();if(!name)return;if(mode==='edit')updateClassMeta(getSelectedClass().id,{name,schoolYear});else createClass({name,schoolYear,students:[]});$('#classDialog').close();toast(mode==='edit'?'Třída byla upravena.':'Třída byla vytvořena.','success')}});document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;const classItem=getSelectedClass();if(action==='open-import')openImportDialog('new');if(action==='open-import-update')openImportDialog('update');if(action==='new-class')openClassDialog('new');if(action==='edit-class')openClassDialog('edit');if(action==='select-class')setSelectedClass(button.dataset.id);if(action==='restore-class'){archiveClass(button.dataset.id,false);setSelectedClass(button.dataset.id);toast('Třída byla obnovena.','success')}if(action==='all-present')setAllPresence(classItem.id,true);if(action==='all-absent')setAllPresence(classItem.id,false);if(action==='duplicate-class'){duplicateClass(classItem.id);toast('Kopie třídy byla vytvořena.','success')}if(action==='archive-class'){if(!App.settings.confirmDestructive||confirm(`Archivovat třídu ${classItem.name}?`)){archiveClass(classItem.id,true);toast('Třída byla přesunuta do archivu.','success')}}if(action==='delete-class'){if(!App.settings.confirmDestructive||confirm(`Trvale smazat třídu ${classItem.name} včetně historie?`)){deleteClass(classItem.id);toast('Třída byla smazána.','success')}}if(action==='remove-student'){const student=classItem.students.find(item=>item.id===button.dataset.id);if(student&&(!App.settings.confirmDestructive||confirm(`Odebrat ${student.displayName} ze třídy?`)))removeStudent(classItem.id,student.id)}if(action==='edit-student'){const student=classItem.students.find(item=>item.id===button.dataset.id);if(!student)return;const value=prompt('Upravte jméno a příjmení:',student.displayName);if(value?.trim()){const parts=value.trim().split(/\s+/);const patch={firstName:parts.shift(),lastName:parts.join(' ')};try{updateStudent(classItem.id,student.id,patch)}catch(error){if(error.code==='DUPLICATE_STUDENT_NAME'&&confirm(error.message))updateStudent(classItem.id,student.id,patch,{allowDuplicate:true});else if(error.code!=='DUPLICATE_STUDENT_NAME')toast(error.message,'error')}}}if(action==='parse-import'){App.ui.importNameOrder=$('#importNameOrder')?.value||'first-last';const parsed=parseImport($('#isPaste').value,{nameOrder:App.ui.importNameOrder});App.ui.importRows=parsed.rows;App.ui.importInvalid=parsed.invalid;renderImportPreview();toast(`Rozpoznáno ${parsed.rows.length} studentů.`,parsed.rows.length?'success':'error')}if(action==='save-import'){try{const mode=$('#importMode').value;const result=importStudentsToClass({className:$('#importClassName').value,schoolYear:$('#importSchoolYear').value,mode,replace:$('#replaceRoster').checked,rows:App.ui.importRows});App.ui.importRows=[];App.ui.importInvalid=[];$('#isPaste').value='';$('#importDialog').close();toast(mode==='new'?`Třída byla vytvořena (${result.students.length} studentů).`:`Třída byla aktualizována: +${result.added}, archivováno ${result.archived}.`,'success');activateRoute('classes')}catch(error){toast(error.message,'error')}}if(action==='close-dialog')button.closest('dialog')?.close()})}

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
function renderDrawView(){const root=$('#drawWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=noClassMessage('Losování','Nejprve importujte nebo vytvořte třídu.');return}const roster=eligibleStudents(classItem);syncDrawDeck(classItem);const history=classItem.drawHistory.slice(0,8);root.innerHTML=`<div class="draw-layout"><article class="draw-control-panel"><div class="context-label"><span>AKTIVNÍ TŘÍDA</span><b>${escapeHtml(classItem.name)}</b><small>${roster.length} přítomných</small></div><div class="control-block"><label>Způsob výběru</label><div class="segmented wide" id="drawModeSegment"><button data-draw-mode="single" class="${App.ui.drawMode==='single'?'active':''}">Jeden</button><button data-draw-mode="multiple" class="${App.ui.drawMode==='multiple'?'active':''}">Více</button><button data-draw-mode="order" class="${App.ui.drawMode==='order'?'active':''}">Pořadí</button></div></div><div class="control-block" id="drawCountBlock" ${App.ui.drawMode==='multiple'?'':'hidden'}><label for="drawCount">Počet studentů</label><div class="number-stepper"><button type="button" data-action="count-down">−</button><input id="drawCount" type="number" min="2" max="${Math.max(2,roster.length)}" value="${Math.max(2,Math.min(roster.length||2,Number(App.ui.drawCount)||2))}"><button type="button" data-action="count-up">＋</button></div></div><div class="control-block inline-control"><div><label>Bez opakování</label><p>Každý student bude vybrán jednou, než se seznam začne znovu.</p></div><label class="switch"><input id="noRepeat" type="checkbox" ${App.ui.noRepeat!==false?'checked':''}><span></span></label></div><button class="primary-button draw-main-button" data-action="perform-draw">Spustit losování <span>◎</span></button><div class="draw-secondary-actions"><button class="small-button" data-action="undo-draw" ${classItem.drawState.lastDraw?'':'disabled'}>Vrátit poslední</button><button class="small-button" data-action="reset-draw">Začít znovu</button></div></article><article class="draw-stage"><div class="draw-stage-orbit"><i></i><i></i><i></i></div><div class="draw-result" id="drawResult"><span>PŘIPRAVENO</span><h2>Koho vybereme?</h2><p>Výběr probíhá pouze mezi přítomnými studenty.</p></div><div class="draw-stage-footer"><span>Lokální výběr</span><b>Bez odesílání jmen</b></div></article></div><article class="history-panel"><div class="panel-heading"><div><span>POSLEDNÍ VÝBĚRY</span><h3>Historie třídy</h3></div><small>Ukládá se pouze v tomto prohlížeči</small></div><div class="history-list">${history.length?history.map(drawHistoryRow).join(''):'<div class="empty-mini wide">Zatím neproběhlo žádné losování.</div>'}</div></article>`;bindDrawModeLocal()}
function noClassMessage(title,text){return`<article class="empty-state premium-empty"><div class="empty-mark">S</div><span>${escapeHtml(title.toLocaleUpperCase('cs-CZ'))}</span><h2>Chybí aktivní třída</h2><p>${escapeHtml(text)}</p><button class="primary-button" data-route="classes">Přejít do tříd</button></article>`}
function drawHistoryRow(item){return`<div class="history-row"><span>${formatDateTime(item.createdAt)}</span><b>${escapeHtml(item.selectedNames.join(', '))}</b><small>${item.mode==='order'?'Pořadí celé třídy':item.noRepeat?'Bez opakování':'Volná náhoda'}</small></div>`}
function bindDrawModeLocal(){$$('[data-draw-mode]').forEach(button=>button.addEventListener('click',()=>{$$('[data-draw-mode]').forEach(item=>item.classList.remove('active'));button.classList.add('active');$('#drawCountBlock').hidden=button.dataset.drawMode!=='multiple'}))}
function currentDrawMode(){return $('[data-draw-mode].active')?.dataset.drawMode||'single'}
function refreshDrawHistory(){const classItem=getSelectedClass();const root=$('.history-list');if(root)root.innerHTML=classItem?.drawHistory?.length?classItem.drawHistory.slice(0,8).map(drawHistoryRow).join(''):'<div class="empty-mini wide">Zatím neproběhlo žádné losování.</div>'}
function showDrawResult(result){const root=$('#drawResult');if(!root)return;root.classList.remove('revealed');void root.offsetWidth;const names=result.selected.map(item=>item.displayName);const multiSize=names.length<=3?36:names.length<=6?31:names.length<=10?26:22;root.innerHTML=result.selected.length===1?`<span>VYBRÁN/A</span><h2>${escapeHtml(names[0])}</h2>`:`<span>${currentDrawMode()==='order'?'NÁHODNÉ POŘADÍ':'VYBRANÁ SKUPINA'}</span><ol class="draw-multi-names ${names.length>5?'many':''}" style="--draw-name-size:${multiSize}px">${names.map(name=>`<li>${escapeHtml(name)}</li>`).join('')}</ol>`;root.classList.add('revealed');refreshDrawHistory()}
function bindDrawUi(){document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(!['perform-draw','undo-draw','reset-draw','count-up','count-down'].includes(action))return;if(action==='count-up'||action==='count-down'){const input=$('#drawCount');if(!input)return;const delta=action==='count-up'?1:-1;input.value=Math.max(Number(input.min)||1,Math.min(Number(input.max)||99,(Number(input.value)||2)+delta));App.ui.drawCount=Number(input.value);return}if(action==='reset-draw'){resetDrawCycle();renderDrawView();toast('Losování bylo resetováno.','success');return}if(action==='undo-draw'){if(undoLastDraw()){renderDrawView();toast('Poslední výběr byl vrácen.','success')}return}if(action==='perform-draw'){try{button.disabled=true;button.classList.add('loading');const mode=currentDrawMode();const count=mode==='multiple'?Number($('#drawCount')?.value||2):mode==='order'?eligibleStudents().length:1;App.ui.drawMode=mode;App.ui.drawCount=count;App.ui.noRepeat=$('#noRepeat')?.checked!==false;const result=performDraw({mode,count,noRepeat:App.ui.noRepeat});setTimeout(()=>{showDrawResult(result);button.disabled=false;button.classList.remove('loading')},App.settings.motion?620:0)}catch(error){button.disabled=false;button.classList.remove('loading');toast(error.message,'error')}}})}

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
function groupPlanPreviewText(total,mode,value){
  const lengths=groupLengths(total,{mode,value});
  if(!lengths.length)return'Bez přítomných studentů.';
  const sizes=lengths.join(' + ');
  return `Vznikne ${lengths.length} ${lengths.length===1?'skupina':lengths.length<5?'skupiny':'skupin'} · velikosti ${sizes} = ${total} studentů. Zbytek se rozdělí co nejrovnoměrněji.`;
}
function updateGroupPlanPreview(){const node=$('#groupPlanPreview'),input=$('#groupValue');if(!node||!input)return;node.textContent=groupPlanPreviewText(eligibleStudents(getSelectedClass()).length,App.ui.groupMode,Number(input.value)||2)}
function renderGroupBuilder(classItem,roster,groups){const config=classItem.lastGroupConfig||{};const currentValue=App.ui.groupMode==='size'?(config.mode==='size'?config.value:4):(config.mode==='count'?config.value:Math.min(4,Math.max(2,roster.length)));const absentInGroups=groups.reduce((sum,group)=>sum+resolveStudents(group.studentIds,classItem).filter(student=>!student.present||student.archived).length,0);return`<article class="smart-mode-panel"><div><span>LOGIKA ROZDĚLENÍ</span><h3>${SMART_GROUP_MODES[App.ui.smartGroupMode].label}</h3><p>${SMART_GROUP_MODES[App.ui.smartGroupMode].text}</p></div><div class="smart-mode-grid">${Object.entries(SMART_GROUP_MODES).map(([id,item])=>`<button data-smart-mode="${id}" class="${App.ui.smartGroupMode===id?'active':''}"><i>${id==='random'?'⤨':id==='balanced'?'⚖':id==='homogeneous'?'≋':'↻'}</i><b>${item.label}</b></button>`).join('')}</div></article><article class="group-builder"><div class="builder-context"><span>AKTIVNÍ TŘÍDA</span><h3>${escapeHtml(classItem.name)}</h3><p>${roster.length} přítomných · ${groupRuleSummary(classItem)}</p></div><div class="builder-mode"><label>Způsob rozdělení</label><div class="segmented wide" id="groupModeSegment"><button data-group-mode="size" class="${App.ui.groupMode==='size'?'active':''}">Počet ve skupině</button><button data-group-mode="count" class="${App.ui.groupMode==='count'?'active':''}">Počet skupin</button></div></div><div class="builder-value"><label id="groupValueLabel">${App.ui.groupMode==='size'?'Studentů ve skupině':'Počet skupin'}</label><div class="number-stepper"><button type="button" data-action="group-value-down">−</button><input id="groupValue" type="number" min="2" max="${Math.max(2,roster.length)}" value="${currentValue}"><button type="button" data-action="group-value-up">＋</button></div><small class="group-plan-preview" id="groupPlanPreview">${escapeHtml(groupPlanPreviewText(roster.length,App.ui.groupMode,currentValue))}</small></div><button class="primary-button compact" data-action="generate-groups">Vytvořit skupiny <span>◌</span></button></article>${groups.length?`${absentInGroups?`<div class="attendance-group-warning"><div><b>${absentInGroups} ${absentInGroups===1?'nepřítomný člen':absentInGroups<5?'nepřítomní členové':'nepřítomných členů'} ve stávajících skupinách</b><span>Rozdělení bylo zachováno. Můžete je ponechat pro přehled, nebo skupiny přepočítat podle aktuální docházky.</span></div><button class="small-button" data-action="recompute-groups-attendance">Přepočítat podle docházky</button></div>`:''}<div class="group-result-toolbar"><div><span>VÝSLEDEK · ${escapeHtml(SMART_GROUP_MODES[config.smartMode||App.ui.smartGroupMode]?.label||'Náhodně')}</span><h3>${groups.length} skupin</h3></div><div><button class="small-button projection-launch" data-action="project-groups">Promítnout</button><button class="small-button" data-action="reroll-groups">Znovu promíchat</button><button class="small-button" data-route="roles">Role a témata</button><button class="small-button" data-action="all-spokespersons">Vylosovat mluvčí</button><button class="small-button" data-action="copy-groups">Kopírovat</button></div></div><div class="generated-groups">${groups.map(group=>groupCard(group,classItem)).join('')}</div>`:`<article class="empty-groups"><div class="group-preview-visual"><i></i><i></i><i></i><i></i><i></i><i></i></div><span>PŘIPRAVENO K ROZDĚLENÍ</span><h2>Chytré skupiny pod kontrolou</h2><p>Zvolte náhodné, vyvážené, homogenní nebo historicky promíchané rozdělení. Pokud počet studentů nevychází přesně, SORTIO rozdělí zbytek co nejrovnoměrněji.</p></article>`}`}

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
function bindGroupsUi(){document.addEventListener('input',event=>{if(event.target.id==='groupValue')updateGroupPlanPreview()});document.addEventListener('change',event=>{try{if(event.target.dataset.action==='move-student'&&event.target.value){moveStudentBetweenGroups(event.target.dataset.studentId,event.target.dataset.fromId,event.target.value);renderGroupsView()}if(event.target.dataset.action==='rename-group')renameGroup(event.target.closest('[data-group-id]').dataset.groupId,event.target.value);if(event.target.dataset.action==='student-level')updateStudent(getSelectedClass().id,event.target.dataset.id,{groupLevel:event.target.value});if(event.target.dataset.action==='student-pin')setStudentPin(event.target.dataset.id,event.target.value===''?null:Number(event.target.value))}catch(error){toast(error.message,'error');renderGroupsView()}});document.addEventListener('click',async event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='group-panel'){App.ui.groupPanel=button.dataset.panel;renderGroupsView();return}if(action==='add-pair-rule'){try{addPairRule($('#ruleType').value,$('#ruleStudentA').value,$('#ruleStudentB').value);renderGroupsView();toast('Pravidlo bylo přidáno.','success')}catch(error){toast(error.message,'error')}return}if(action==='remove-pair-rule'){removePairRule(button.dataset.type,Number(button.dataset.index));renderGroupsView();return}if(action==='clear-group-rules'){if(!App.settings.confirmDestructive||confirm('Vymazat všechna pravidla skupin?')){clearGroupRules();renderGroupsView()}return}if(!['group-value-down','group-value-up','generate-groups','reroll-groups','recompute-groups-attendance','toggle-group-lock','group-spokesperson','all-spokespersons','copy-groups','project-groups'].includes(action))return;if(action==='group-value-down'||action==='group-value-up'){const input=$('#groupValue');const delta=action==='group-value-up'?1:-1;input.value=Math.max(Number(input.min)||2,Math.min(Number(input.max)||99,(Number(input.value)||2)+delta));updateGroupPlanPreview();return}if(action==='project-groups'){openProjection('groups');return}try{if(action==='generate-groups'){generateGroups({mode:App.ui.groupMode,value:Number($('#groupValue').value),smartMode:App.ui.smartGroupMode});renderGroupsView();toast('Skupiny byly vytvořeny.','success')}if(action==='reroll-groups'){rerollUnlockedGroups();renderGroupsView();toast('Odemčené skupiny byly znovu promíchány.','success')}if(action==='recompute-groups-attendance'){recomputeGroupsForAttendance();renderGroupsView();toast('Skupiny byly přepočítány podle aktuální docházky.','success')}if(action==='toggle-group-lock'){const locked=toggleGroupLock(button.dataset.groupId);renderGroupsView();toast(locked?'Skupina byla uzamčena.':'Skupina byla odemčena.','success')}if(action==='group-spokesperson'){selectSpokesperson(button.dataset.groupId);renderGroupsView()}if(action==='all-spokespersons'){selectAllSpokespersons();renderGroupsView();toast('Mluvčí byli vylosováni.','success')}if(action==='copy-groups'){await navigator.clipboard.writeText(groupsPlainText());toast('Skupiny byly zkopírovány.','success')}}catch(error){toast(error.message,'error')}})}

;
function saveRoleCatalog(raw){const classItem=getSelectedClass();if(!classItem)return[];classItem.roleCatalog=uniqueStrings(String(raw||'').split(/\n|,/));if(!classItem.roleCatalog.length)classItem.roleCatalog=defaultRoleCatalog();for(const group of classItem.currentGroups||[]){for(const role of Object.keys(group.roleAssignments||{}))if(!classItem.roleCatalog.includes(role))delete group.roleAssignments[role]}saveData({event:'role_catalog_save'});return classItem.roleCatalog}
function saveTopicCatalog(raw){const classItem=getSelectedClass();if(!classItem)return[];classItem.topicCatalog=uniqueStrings(String(raw||'').split(/\n/));saveData({event:'topic_catalog_save'});return classItem.topicCatalog}
function roleUseCount(classItem,studentId,role){return(classItem.roleHistory||[]).filter(entry=>entry.studentId===studentId&&entry.role===role).length}
function chooseRoleStudent(classItem,group,role,used){const candidates=group.studentIds.filter(id=>!used.has(id));const pool=candidates.length?candidates:group.studentIds;const ranked=shuffle(pool).map(id=>({id,count:roleUseCount(classItem,id,role),total:(classItem.roleHistory||[]).filter(entry=>entry.studentId===id).length})).sort((a,b)=>a.count-b.count||a.total-b.total);return ranked[0]?.id||null}
function assignRolesToGroup(group,{persistHistory=true}={}){const classItem=getSelectedClass();if(!classItem||!group?.studentIds?.length)return{};const used=new Set();const assignments={};for(const role of classItem.roleCatalog){const studentId=chooseRoleStudent(classItem,group,role,used);if(!studentId)continue;assignments[role]=studentId;used.add(studentId);if(persistHistory)classItem.roleHistory.unshift({id:uid('role'),createdAt:nowIso(),groupId:group.id,studentId,role})}group.roleAssignments=assignments;classItem.roleHistory=classItem.roleHistory.slice(0,HISTORY_LIMITS.role);return assignments}
function assignRolesToAllGroups(){const classItem=getSelectedClass();if(!classItem?.currentGroups?.length)throw new Error('Nejprve vytvořte skupiny.');classItem.currentGroups.forEach(group=>assignRolesToGroup(group));saveData({event:'roles_assign'});recordEvent('roles_assign',{groupCount:classItem.currentGroups.length,roleCount:classItem.roleCatalog.length});return classItem.currentGroups}
function assignTopicsToGroups(){const classItem=getSelectedClass();if(!classItem?.currentGroups?.length)throw new Error('Nejprve vytvořte skupiny.');if(!classItem.topicCatalog.length)throw new Error('Nejprve zadejte alespoň jedno téma nebo úkol.');const topics=shuffle(classItem.topicCatalog);classItem.currentGroups.forEach((group,index)=>group.topic=topics[index%topics.length]);saveData({event:'topics_assign'});recordEvent('topics_assign',{groupCount:classItem.currentGroups.length,topicCount:classItem.topicCatalog.length});return classItem.currentGroups}
function setRoleAssignment(groupId,role,studentId){const classItem=getSelectedClass();const group=classItem?.currentGroups?.find(item=>item.id===groupId);if(!classItem||!group)throw new Error('Skupina už není dostupná.');if(!classItem.roleCatalog.includes(role))throw new Error('Tato role už není v seznamu rolí.');if(studentId&&!group.studentIds.includes(studentId))throw new Error('Vybraný student není členem této skupiny.');group.roleAssignments=group.roleAssignments||{};const previous=group.roleAssignments[role]||'';if(studentId)group.roleAssignments[role]=studentId;else delete group.roleAssignments[role];if(studentId&&studentId!==previous){classItem.roleHistory=classItem.roleHistory||[];classItem.roleHistory.unshift({id:uid('role'),createdAt:nowIso(),groupId:group.id,studentId,role,manual:true});classItem.roleHistory=classItem.roleHistory.slice(0,HISTORY_LIMITS.role)}saveData({event:'role_manual_assign'});recordEvent('role_manual_assign',{groupId,role,assigned:Boolean(studentId)});return group.roleAssignments}
function setGroupTopic(groupId,topic){const classItem=getSelectedClass();const group=classItem?.currentGroups?.find(item=>item.id===groupId);if(!classItem||!group)throw new Error('Skupina už není dostupná.');group.topic=String(topic||'').trim().slice(0,300);saveData({event:'topic_manual_assign'});recordEvent('topic_manual_assign',{groupId,assigned:Boolean(group.topic)});return group.topic}
function clearGroupAssignments(){const classItem=getSelectedClass();if(!classItem)return;classItem.currentGroups.forEach(group=>{group.roleAssignments={};group.topic=''});saveData({event:'assignments_clear'})}
function rotateRoles(){return assignRolesToAllGroups()}

;
function renderRolesView(){const root=$('#rolesWorkspace');if(!root)return;const classItem=getSelectedClass();if(!classItem){root.innerHTML=noClassMessage('Role a úkoly','Nejprve importujte nebo vytvořte třídu.');return}const groups=classItem.currentGroups||[];root.innerHTML=`<div class="roles-layout"><article class="assignment-settings"><div class="assignment-heading"><span>NASTAVENÍ</span><h2>Role a obsah skupin</h2><p>Automatické přidělení je jen zkratka. Konkrétní roli i téma můžete potom u každé skupiny nastavit ručně.</p></div><label>Role ve skupině<textarea id="roleCatalogInput" rows="7" placeholder="Mluvčí\nZapisovatel\nHlídač času">${escapeHtml(classItem.roleCatalog.join('\n'))}</textarea></label><label>Témata nebo úkoly<textarea id="topicCatalogInput" rows="7" placeholder="Téma 1\nTéma 2\nTéma 3">${escapeHtml(classItem.topicCatalog.join('\n'))}</textarea></label><div class="assignment-actions"><button class="small-button" data-action="save-catalogs">Uložit seznamy</button><button class="secondary-button compact" data-action="assign-roles" ${groups.length?'':'disabled'}>Automaticky přidělit role</button><button class="secondary-button compact" data-action="assign-topics" ${groups.length?'':'disabled'}>Automaticky rozdělit témata</button><button class="small-button" data-action="clear-assignments" ${groups.length?'':'disabled'}>Vymazat přidělení</button></div><div class="rotation-note"><span>↻</span><p><b>Spravedlivá rotace:</b> automatika dává přednost studentovi, který danou roli plnil nejméně často. Ruční výběr zůstává vždy na učiteli.</p></div></article><section class="assignment-preview"><div class="assignment-preview-head"><div><span>AKTUÁLNÍ SKUPINY</span><h2>${groups.length?`${groups.length} skupin`:'Zatím bez skupin'}</h2></div>${groups.length?'<div class="assignment-preview-actions"><button class="small-button" data-route="groups">Upravit skupiny</button><button class="small-button projection-launch" data-action="project-groups-from-roles">Promítnout</button></div>':''}</div>${groups.length?`<div class="assignment-group-grid">${groups.map(group=>roleGroupCard(group,classItem)).join('')}</div>`:`<article class="empty-groups compact-empty"><span>NEJPRVE SKUPINY</span><h2>Vytvořte rozdělení třídy</h2><p>Role a témata se přidělují k aktuální sadě skupin.</p><button class="primary-button" data-route="groups">Přejít do skupin</button></article>`}</section></div>`}
function roleGroupCard(group,classItem){
  const members=resolveStudents(group.studentIds,classItem);
  const topicValues=uniqueStrings([group.topic,...classItem.topicCatalog].filter(Boolean));
  const topicOptions=topicValues.map(topic=>`<option value="${escapeHtml(topic)}" ${topic===group.topic?'selected':''}>${escapeHtml(topic)}</option>`).join('');
  return`<article class="role-group-card" data-role-group-id="${group.id}"><header><div><span>${escapeHtml(group.name)}</span><label class="role-topic-picker"><b>Téma / úkol</b><select data-action="manual-topic" data-group-id="${group.id}"><option value="">Bez tématu</option>${topicOptions}</select></label></div><i>${members.length}</i></header><div class="role-list manual-role-list">${classItem.roleCatalog.map(role=>{const assignedId=group.roleAssignments?.[role]||'';return`<label><b>${escapeHtml(role)}</b><select data-action="manual-role" data-group-id="${group.id}" data-role="${escapeHtml(role)}"><option value="">Bez přidělení</option>${members.map(student=>{const absent=!student.present||student.archived;return`<option value="${student.id}" ${student.id===assignedId?'selected':''}>${escapeHtml(student.displayName)}${absent?' · nepřítomen':''}</option>`}).join('')}</select></label>`}).join('')}</div><footer>${members.map(student=>{const absent=!student.present||student.archived;return`<span class="${absent?'absent':''}" title="${escapeHtml(student.displayName)}${absent?' – nepřítomen':''}">${escapeHtml(`${student.firstName[0]||''}${student.lastName[0]||''}`)}</span>`}).join('')}</footer></article>`;
}
function bindRolesUi(){document.addEventListener('change',event=>{const action=event.target.dataset.action;if(!['manual-role','manual-topic'].includes(action))return;try{if(action==='manual-role')setRoleAssignment(event.target.dataset.groupId,event.target.dataset.role,event.target.value);if(action==='manual-topic')setGroupTopic(event.target.dataset.groupId,event.target.value)}catch(error){toast(error.message,'error');renderRolesView()}});document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(action==='project-groups-from-roles'){openProjection('groups');return}if(!['save-catalogs','assign-roles','assign-topics','clear-assignments'].includes(action))return;try{if(action==='save-catalogs'){saveRoleCatalog($('#roleCatalogInput').value);saveTopicCatalog($('#topicCatalogInput').value);toast('Seznamy byly uloženy.','success')}if(action==='assign-roles'){saveRoleCatalog($('#roleCatalogInput').value);assignRolesToAllGroups();toast('Role byly spravedlivě přiděleny.','success')}if(action==='assign-topics'){saveTopicCatalog($('#topicCatalogInput').value);assignTopicsToGroups();toast('Témata byla rozdělena.','success')}if(action==='clear-assignments'){clearGroupAssignments();toast('Přidělení bylo vymazáno.','success')}renderRolesView()}catch(error){toast(error.message,'error')}})}

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
function seatingDeskPosition(seat){
  const hasDesk=Number.isFinite(Number(seat?.deskRow))&&Number.isFinite(Number(seat?.deskColumn));
  return{row:hasDesk?Number(seat.deskRow):Number(seat?.row||0),column:hasDesk?Number(seat.deskColumn):Number(seat?.column||0),slot:hasDesk?Math.max(0,Math.min(1,Number(seat?.deskSlot)||0)):0,legacy:!hasDesk};
}
function seatingDeskGroups(plan){
  const groups=new Map();
  for(const seat of plan?.seats||[]){const pos=seatingDeskPosition(seat),key=`${pos.row}:${pos.column}`;if(!groups.has(key))groups.set(key,{key,row:pos.row,column:pos.column,seats:[]});groups.get(key).seats.push({...seat,__deskSlot:pos.slot})}
  return[...groups.values()].map(group=>({...group,seats:group.seats.sort((a,b)=>(a.__deskSlot||0)-(b.__deskSlot||0))})).sort((a,b)=>a.row-b.row||a.column-b.column);
}
function seatingDeskBounds(plan){
  const desks=seatingDeskGroups(plan);if(!desks.length)return{minRow:0,maxRow:0,minColumn:0,maxColumn:0,rows:0,columns:0};const rows=desks.map(d=>d.row),columns=desks.map(d=>d.column),minRow=Math.min(...rows),maxRow=Math.max(...rows),minColumn=Math.min(...columns),maxColumn=Math.max(...columns);return{minRow,maxRow,minColumn,maxColumn,rows:maxRow-minRow+1,columns:maxColumn-minColumn+1};
}
function seatingDeskCount(seats=[]){return seatingDeskGroups({seats:Array.isArray(seats)?seats:[]}).length}
function seatingCapacity(template='rows',rows=4,columns=6,seats=null){rows=Math.max(template==='custom'?1:2,Math.min(10,Number(rows)||4));columns=Math.max(template==='custom'?1:2,Math.min(template==='custom'?16:12,Number(columns)||6));if(template==='custom'&&Array.isArray(seats))return seats.length;if(template==='u')return columns+Math.max(0,rows-1)*2;if(template==='pairs')return rows*columns*2;return rows*columns}
function seatingCapacityText(template='rows',rows=4,columns=6,seats=null){rows=Math.max(template==='custom'?1:2,Math.min(10,Number(rows)||4));columns=Math.max(template==='custom'?1:2,Math.min(template==='custom'?16:12,Number(columns)||6));if(template==='custom'){const capacity=seatingCapacity(template,rows,columns,seats),hasDeskGeometry=Array.isArray(seats)&&seats.some(seat=>Number.isFinite(Number(seat?.deskRow))&&Number.isFinite(Number(seat?.deskColumn)));if(Array.isArray(seats)&&seats.length&&!hasDeskGeometry)return`${capacity} míst ve starším vlastním tvaru`;const desks=Array.isArray(seats)?seatingDeskCount(seats):Math.ceil(capacity/2);return`${desks} ${desks===1?'lavice':'lavic'} po dvou · celkem ${capacity} míst`;}if(template==='pairs')return`${rows} řady · ${columns} lavic po dvou · celkem ${seatingCapacity(template,rows,columns,seats)} míst`;if(template==='islands')return`${rows} skupinových stolů · ${columns} míst u každého · celkem ${seatingCapacity(template,rows,columns,seats)} míst`;if(template==='u')return`${seatingCapacity(template,rows,columns,seats)} míst v uspořádání do U`;return`${rows} řady · ${columns} míst v řadě · celkem ${seatingCapacity(template,rows,columns,seats)} míst`}
function createSeatLayout(template='rows',rows=4,columns=6){rows=Math.max(2,Math.min(10,Number(rows)||4));columns=Math.max(2,Math.min(12,Number(columns)||6));const seats=[];if(template==='u'){for(let column=0;column<columns;column++)seats.push(makeSeat(0,column,null,`P${column+1}`));for(let row=1;row<rows;row++){seats.push(makeSeat(row,0,null,`L${row}`));seats.push(makeSeat(row,columns-1,null,`R${row}`))}}else if(template==='islands'){for(let island=0;island<rows;island++)for(let place=0;place<columns;place++)seats.push(makeSeat(island,place,island,`${island+1}.${place+1}`))}else{const actualColumns=template==='pairs'?columns*2:columns;for(let row=0;row<rows;row++)for(let column=0;column<actualColumns;column++)seats.push(makeSeat(row,column,template==='pairs'?Math.floor(column/2):null,`${row+1}.${column+1}`))}return seats}
function makeSeat(row,column,island,label){return{id:uid('seat'),row,column,island,label,studentId:null,blocked:false,locked:false}}
function configureSeating({template,rows,columns,preserve=false}={}){const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');const previous=preserve?new Map((classItem.seatingPlan.seats||[]).filter(seat=>seat.studentId).map(seat=>[seat.label,seat])):new Map();const seats=createSeatLayout(template,rows,columns);for(const seat of seats){const old=previous.get(seat.label);if(old){seat.id=old.id||seat.id;seat.studentId=old.studentId;seat.locked=old.locked;seat.blocked=old.blocked}}classItem.seatingPlan={template,rows:Number(rows),columns:Number(columns),seats,updatedAt:nowIso()};saveData({event:'seating_configure'});return classItem.seatingPlan}
function configureSeatingShape(cells,{preserve=true}={}){
  const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');const normalized=[...new Map((Array.isArray(cells)?cells:[]).map(cell=>{const row=Math.max(0,Math.min(6,Number(cell?.row)));const column=Math.max(0,Math.min(2,Number(cell?.column)));return[`${row}:${column}`,{row,column}]})).values()].sort((a,b)=>a.row-b.row||a.column-b.column);if(!normalized.length)throw new Error('Označte alespoň jednu lavici v učebně.');
  const previous=new Map();if(preserve)for(const old of classItem.seatingPlan?.seats||[]){const pos=seatingDeskPosition(old),slot=pos.legacy?0:pos.slot,key=`${pos.row}:${pos.column}:${slot}`;if(!previous.has(key))previous.set(key,old)}
  const seats=[];for(const{row,column}of normalized)for(let slot=0;slot<2;slot++){const seat=makeSeat(row,column*2+slot,null,`${row+1}.${column+1}${slot===0?'A':'B'}`),old=previous.get(`${row}:${column}:${slot}`);seat.deskRow=row;seat.deskColumn=column;seat.deskSlot=slot;if(old){seat.id=old.id||seat.id;seat.studentId=old.studentId||null;seat.locked=!!old.locked&&!!old.studentId;seat.blocked=!!old.blocked;if(seat.blocked){seat.studentId=null;seat.locked=false}}seats.push(seat)}
  const rows=Math.max(...normalized.map(cell=>cell.row))+1,columns=Math.max(...normalized.map(cell=>cell.column))+1;classItem.seatingPlan={template:'custom',rows,columns,seats,updatedAt:nowIso()};saveData({event:'seating_shape_configure'});return classItem.seatingPlan;
}
function seatingAdjacency(a,b,template){if(!a||!b)return false;if(template==='islands')return a.island===b.island;if(template==='pairs'&&a.row===b.row&&a.island===b.island)return true;return Math.abs(a.row-b.row)+Math.abs(a.column-b.column)<=1}
function seatingFrontRank(seat,plan){if(plan.template==='islands')return seat.island;return Number.isFinite(Number(seat?.deskRow))?Number(seat.deskRow):seat.row}
function seatingDeskKey(seat){const pos=seatingDeskPosition(seat);return`${pos.row}:${pos.column}`}
function seatingOccupiedDeskStudents(seats,classItem){const byDesk=new Map();for(const seat of seats||[]){if(!seat.studentId||seat.blocked)continue;const key=seatingDeskKey(seat);if(!byDesk.has(key))byDesk.set(key,[]);const student=classItem.students.find(item=>item.id===seat.studentId);if(student)byDesk.get(key).push(student)}return byDesk}
function countSeatingViolations(classItem,seats){const byStudent=new Map(seats.filter(seat=>seat.studentId).map(seat=>[seat.studentId,seat]));let violations=0;for(const[a,b]of rulePairs('apart',classItem)){if(seatingAdjacency(byStudent.get(a),byStudent.get(b),classItem.seatingPlan.template))violations++}return violations}
function countSoloSeatingViolations(classItem,seats){let violations=0;for(const students of seatingOccupiedDeskStudents(seats,classItem).values())if(students.length>1&&students.some(student=>student.soloPreference))violations++;return violations}
function seatingCandidateScore(seat,student,plan,trialSeats,classItem){
  // Směr je deterministicky od tabule dozadu. Náhodnost rozhoduje až mezi stejně předními místy.
  let score=seatingFrontRank(seat,plan)*1000+randomInt(1000)/1000;
  if(student.frontPreference)score+=seatingFrontRank(seat,plan)*2500;
  return score;
}
function assignSeating(){
  const classItem=getSelectedClass();if(!classItem)throw new Error('Nejprve vyberte třídu.');const plan=classItem.seatingPlan;if(!plan.seats.length)throw new Error('Nejprve nakreslete tvar učebny a použijte jej.');
  const students=eligibleStudents(classItem),studentById=new Map(classItem.students.map(student=>[student.id,student])),fixed=plan.seats.filter(seat=>seat.locked&&seat.studentId&&!seat.blocked&&students.some(student=>student.id===seat.studentId)),fixedIds=new Set(fixed.map(seat=>seat.studentId)),remaining=students.filter(student=>!fixedIds.has(student.id)),usable=plan.seats.filter(seat=>!seat.blocked);
  if(usable.length<students.length)throw new Error(`V učebně je pouze ${usable.length} použitelných míst pro ${students.length} přítomných studentů.`);
  const fixedDeskStudents=seatingOccupiedDeskStudents(fixed,classItem);for(const deskStudents of fixedDeskStudents.values())if(deskStudents.length>1&&deskStudents.some(student=>student.soloPreference))throw new Error('Uzamčené místo porušuje požadavek „má sedět sám“. Uvolněte druhé místo u této lavice nebo zrušte uzamčení.');
  let best=null;
  for(let trial=0;trial<1000;trial++){
    const trialSeats=plan.seats.map(seat=>({...seat,studentId:seat.locked?seat.studentId:null})),reservedDesks=new Set();
    for(const seat of trialSeats){const student=studentById.get(seat.studentId);if(student?.soloPreference)reservedDesks.add(seatingDeskKey(seat))}
    let available=trialSeats.filter(seat=>!seat.blocked&&!seat.locked&&!reservedDesks.has(seatingDeskKey(seat)));let invalid=false;
    const solos=shuffle(remaining.filter(student=>student.soloPreference)).sort((a,b)=>Number(b.frontPreference)-Number(a.frontPreference));
    for(const student of solos){const candidates=available.filter(seat=>!trialSeats.some(other=>other.studentId&&seatingDeskKey(other)===seatingDeskKey(seat)));if(!candidates.length){invalid=true;break}const seat=candidates.map(item=>({item,score:seatingCandidateScore(item,student,plan,trialSeats,classItem)})).sort((a,b)=>a.score-b.score)[0].item;seat.studentId=student.id;const key=seatingDeskKey(seat);reservedDesks.add(key);available=available.filter(item=>seatingDeskKey(item)!==key)}
    if(invalid)continue;
    const others=shuffle(remaining.filter(student=>!student.soloPreference)).sort((a,b)=>Number(b.frontPreference)-Number(a.frontPreference));
    for(const student of others){if(!available.length){invalid=true;break}let bestIndex=0,bestScore=Infinity;for(let i=0;i<available.length;i++){const score=seatingCandidateScore(available[i],student,plan,trialSeats,classItem);if(score<bestScore){bestScore=score;bestIndex=i}}const[seat]=available.splice(bestIndex,1);seat.studentId=student.id}
    if(invalid)continue;
    const violations=countSeatingViolations(classItem,trialSeats),soloViolations=countSoloSeatingViolations(classItem,trialSeats),frontPenalty=trialSeats.reduce((sum,seat)=>{const student=studentById.get(seat.studentId);return sum+(student?.frontPreference?seatingFrontRank(seat,plan):0)},0),rearGapPenalty=seatingRearGapPenalty(classItem,trialSeats),score=soloViolations*1000000+violations*100000+rearGapPenalty*10000+frontPenalty*60+randomInt(1000000)/1000000;
    if(!best||score<best.score)best={score,violations,soloViolations,rearGapPenalty,seats:trialSeats};
    if(!soloViolations&&!violations&&!rearGapPenalty&&frontPenalty===0)break;
  }
  if(!best)throw new Error('Zasedací pořádek se nepodařilo vytvořit. Zkontrolujte kapacitu učebny a požadavky na samostatné sezení.');
  if(best.soloViolations>0)throw new Error('Požadavek „má sedět sám“ nelze při této kapacitě a uzamčených místech splnit.');
  if(best.violations>0)throw new Error('Pravidla „od sebe“ nelze v tomto rozložení splnit. Přidejte místa, změňte rozložení nebo upravte pravidla.');
  plan.seats=best.seats;plan.updatedAt=nowIso();saveData({event:'seating_assign'});recordEvent('seating_assign',{template:plan.template,studentCount:students.length,soloCount:students.filter(student=>student.soloPreference).length,frontCount:students.filter(student=>student.frontPreference).length});return plan
}
function seatingRearGapPenalty(classItem,seats){
  const occupiedRanks=seats.filter(seat=>seat.studentId&&!seat.blocked).map(seat=>seatingFrontRank(seat,classItem.seatingPlan));if(!occupiedRanks.length)return 0;const maxOccupied=Math.max(...occupiedRanks),deskStudents=seatingOccupiedDeskStudents(seats,classItem);let penalty=0;
  for(const seat of seats){if(seat.blocked||seat.studentId||seat.locked)continue;const rank=seatingFrontRank(seat,classItem.seatingPlan);if(rank>=maxOccupied)continue;const desk=deskStudents.get(seatingDeskKey(seat))||[];if(desk.some(student=>student.soloPreference))continue;penalty++}
  return penalty;
}
function setSeatStudent(seatId,studentId){const classItem=getSelectedClass();const plan=classItem?.seatingPlan;const seat=plan?.seats.find(item=>item.id===seatId);if(!seat||seat.blocked||seat.locked)return false;const other=plan.seats.find(item=>item.studentId===studentId&&item.id!==seatId);const previous=seat.studentId;if(other){if(other.locked)return false;other.studentId=previous||null}seat.studentId=studentId||null;seat.blocked=false;plan.updatedAt=nowIso();saveData({event:'seat_student'});return true}
function toggleSeatBlocked(seatId){const seat=getSelectedClass()?.seatingPlan?.seats.find(item=>item.id===seatId);if(!seat)return false;seat.blocked=!seat.blocked;if(seat.blocked){seat.studentId=null;seat.locked=false}saveData({event:'seat_block'});return seat.blocked}
function toggleSeatLock(seatId){const seat=getSelectedClass()?.seatingPlan?.seats.find(item=>item.id===seatId);if(!seat?.studentId)return false;seat.locked=!seat.locked;saveData({event:'seat_lock'});return seat.locked}
function rotateSeating(){const classItem=getSelectedClass();const plan=classItem?.seatingPlan;if(!plan?.seats?.length)return false;const seats=plan.seats.filter(seat=>!seat.blocked&&!seat.locked);const ids=seats.map(seat=>seat.studentId).filter(Boolean);if(ids.length<2)return false;ids.unshift(ids.pop());let index=0;seats.forEach(seat=>{if(seat.studentId)seat.studentId=ids[index++]});plan.updatedAt=nowIso();saveData({event:'seating_rotate'});recordEvent('seating_rotate',{template:plan.template,studentCount:ids.length});return true}
function clearSeatingAssignments(){const plan=getSelectedClass()?.seatingPlan;if(!plan)return;plan.seats.forEach(seat=>{seat.studentId=null;seat.locked=false});saveData({event:'seating_clear'})}

;
let sortioSeatingUiPromise=null,sortioSeatingUiStylePromise=null;
function loadSortioSeatingUiStyles(){if(sortioSeatingUiStylePromise)return sortioSeatingUiStylePromise;const e=document.querySelector('link[data-sortio-lazy-style="seating-ui"]');if(e?.sheet)return Promise.resolve(e);sortioSeatingUiStylePromise=new Promise((r,j)=>{const l=e||document.createElement('link');l.rel='stylesheet';l.href=new URL('./lazy/seating-ui.css',location.href).href;l.dataset.sortioLazyStyle='seating-ui';l.onload=()=>r(l);l.onerror=()=>j(new Error('Styly plánu nelze načíst.'));if(!e)document.head.appendChild(l)}).catch(e=>{sortioSeatingUiStylePromise=null;throw e});return sortioSeatingUiStylePromise}
function loadSortioSeatingUi(){if(globalThis.__SORTIO_SEATING_UI__)return loadSortioSeatingUiStyles().then(()=>{globalThis.__SORTIO_SEATING_UI__.bind?.();return globalThis.__SORTIO_SEATING_UI__});if(sortioSeatingUiPromise)return sortioSeatingUiPromise;sortioSeatingUiPromise=Promise.all([loadSortioSeatingUiStyles(),new Promise((r,j)=>{const s=document.createElement('script');s.src=new URL('./lazy/seating-ui.js',location.href).href;s.async=true;s.dataset.sortioLazy='seating-ui';s.onload=()=>{const a=globalThis.__SORTIO_SEATING_UI__;if(a?.render&&a?.bind){a.bind();r(a)}else j(new Error('Editor nelze spustit.'))};s.onerror=()=>j(new Error('Editor nelze načíst.'));document.head.appendChild(s)})]).then(([,a])=>a).catch(e=>{sortioSeatingUiPromise=null;throw e});return sortioSeatingUiPromise}
function renderSeatingView(){return loadSortioSeatingUi().then(a=>a.render()).catch(e=>{captureError(e,'seating-ui-lazy');toast('Editor zasedacího plánu se nepodařilo načíst.','error')})}
function bindSeatingUi(){}

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
function renderToolsView(){
  const root=$('#toolsWorkspace');if(!root)return;const classItem=getSelectedClass();let classTools='';
  if(classItem){
    const stats=engagementStats(classItem);const coverage=engagementCoverage(classItem);const recent=engagementEntries(classItem).slice(0,10);
    classTools=`<details class="classic-tools-panel"><summary><span>DALŠÍ TŘÍDNÍ NÁSTROJE</span><b>Rychlá náhoda, spravedlivé zapojování a tisk</b></summary><div class="tools-layout compact-tools">
<article class="tool-card quick-card"><header><span>RYCHLÁ NÁHODA</span></header><div class="quick-result" id="quickResult">${escapeHtml(App.ui.quickResult||'Připraveno')}</div><div class="quick-grid"><button data-quick="dice">Kostka D6</button><button data-quick="coin">Mince</button><button data-quick="number">Číslo 1–100</button><button data-action="volunteer-window">Dobrovolník / náhoda</button><button data-action="volunteer-claimed">Dobrovolník je</button></div><label>Možnosti rozhodovače<textarea id="decisionOptions" rows="4" placeholder="Jedna možnost na řádek">${escapeHtml(classItem.toolState.decisionOptions.join('\n'))}</textarea></label><button class="primary-button compact wide-button" data-action="decision-pick">Vylosovat možnost</button></article>
<article class="tool-card engagement-card"><header><span>SPRAVEDLIVÉ ZAPOJOVÁNÍ</span><button data-action="engagement-reset">Vymazat historii</button></header><div class="coverage-ring" style="--coverage:${coverage.percent}"><b>${coverage.percent}%</b><span>${coverage.touched} z ${coverage.total} zapojených</span></div><div class="engagement-pick"><select id="engagementKind">${Object.entries(ENGAGEMENT_KINDS).map(([id,name])=>`<option value="${id}">${name}</option>`).join('')}</select><button class="primary-button compact" data-action="fair-pick">Vybrat nejméně zapojeného</button></div><div class="engagement-table"><div class="engagement-head"><span>Student</span><span>Počet</span><span>Naposledy</span><span></span></div>${stats.slice(0,12).map(item=>`<div><b>${escapeHtml(item.student.displayName)}</b><span>${item.count}</span><small>${item.lastAt?formatDateTime(item.lastAt):'—'}</small><button data-engage-student="${item.student.id}">+1</button></div>`).join('')}</div><div class="recent-engagement">${recent.map(item=>{const student=classItem.students.find(s=>s.id===item.studentId);return`<span>${escapeHtml(student?.displayName||'—')} · ${escapeHtml(ENGAGEMENT_KINDS[item.kind]||item.kind)} <button data-undo-engagement="${item.id}">×</button></span>`}).join('')}</div></article>
<article class="tool-card export-card"><header><span>VÝSTUPY</span></header><p>Vytvořte čistý výstup pro kolegy nebo žáky. Zasedací pořádek se exportuje přímo jako PDF A4 naležato.</p><div class="export-grid"><button data-export="groups">Skupiny a role</button><button data-action="download-seating-pdf">Zasedací pořádek PDF</button><button data-export="engagement">Přehled zapojení</button><button data-export="cards">Kartičky se jmény</button></div></article>
</div></details>`;
  }else{
    classTools=`<div class="class-tools-note"><b>Třídní funkce jsou zatím skryté.</b><span>Výukový panel funguje i bez třídy. Pro spravedlivé zapojování a třídní výstupy nejprve vyberte třídu.</span></div>`;
  }
  root.innerHTML=lessonBoardPanelHtml()+classTools;lessonBoardAfterRender();renderTimerDisplays();ensureToolClock();
}
function persistToolState(classItem,event='tools_update'){classItem.toolState.updatedAt=nowIso();saveData({event})}
function handleToolAction(target){const classItem=getSelectedClass();if(!classItem)return;const action=target.dataset.action;if(target.dataset.timerPreset){const seconds=Number(target.dataset.timerPreset);App.ui.timer={duration:seconds,remaining:seconds,running:false,endsAt:null};renderTimerDisplays();ensureToolClock();return}if(action==='timer-toggle'){const timer=App.ui.timer;if(timer.running){timer.remaining=currentTimerRemaining();timer.running=false;timer.endsAt=null}else{const custom=Math.max(1,Number($('#customTimerMinutes')?.value)||0)*60;if(timer.remaining<=0){timer.duration=custom;timer.remaining=custom}timer.running=true;timer.endsAt=Date.now()+timer.remaining*1000}renderTimerDisplays();ensureToolClock();return}if(action==='timer-reset'){const custom=Math.max(1,Number($('#customTimerMinutes')?.value)||5)*60;App.ui.timer={duration:custom,remaining:custom,running:false,endsAt:null};renderTimerDisplays();ensureToolClock();return}if(action==='stopwatch-toggle'){const sw=App.ui.stopwatch;if(sw.running){sw.elapsed=currentStopwatchElapsed();sw.running=false;sw.startedAt=null}else{sw.running=true;sw.startedAt=Date.now()}renderTimerDisplays();ensureToolClock();return}if(action==='stopwatch-reset'){App.ui.stopwatch={elapsed:0,running:false,startedAt:null,laps:[]};const list=$('#lapList');if(list)list.innerHTML='';renderTimerDisplays();ensureToolClock();return}if(action==='stopwatch-lap'){const value=currentStopwatchElapsed();App.ui.stopwatch.laps=App.ui.stopwatch.laps||[];App.ui.stopwatch.laps.unshift(value);const lap=document.createElement('span');lap.textContent=formatClock(value);$('#lapList')?.prepend(lap);return}if(target.dataset.quick){const type=target.dataset.quick;App.ui.quickResult=type==='dice'?String(randomInt(6)+1):type==='coin'?(randomInt(2)?'Panna':'Orel'):String(randomInt(100)+1);$('#quickResult').textContent=App.ui.quickResult;return}if(action==='volunteer-window'){const token=uid('volunteer');App.ui.volunteerToken=token;let left=5;const node=$('#quickResult');node.textContent=`Dobrovolník? ${left}`;const handle=setInterval(()=>{if(App.ui.volunteerToken!==token){clearInterval(handle);return}left--;if(left>0){if(node.isConnected)node.textContent=`Dobrovolník? ${left}`;return}clearInterval(handle);try{const student=selectFairStudent({kind:'answer'});App.ui.volunteerToken=null;App.ui.quickResult=student.displayName;toast(`Nikdo se nepřihlásil. Vybrán/a: ${student.displayName}`,'success')}catch(error){toast(error.message,'error')}},1000);return}if(action==='volunteer-claimed'){App.ui.volunteerToken=null;App.ui.quickResult='Dobrovolník vybrán';$('#quickResult').textContent=App.ui.quickResult;toast('Dobrovolník dostal prostor.','success');return}if(action==='decision-pick'){const options=$('#decisionOptions').value.split(/\n|,/).map(x=>x.trim()).filter(Boolean);if(!options.length){toast('Vložte alespoň jednu možnost.','error');return}classItem.toolState.decisionOptions=options;App.ui.quickResult=options[randomInt(options.length)];persistToolState(classItem,'decision_pick');renderToolsView();return}if(action==='scores-from-groups'){classItem.toolState.scores=classItem.currentGroups.map(group=>({id:uid('team'),name:group.name,score:0}));persistToolState(classItem,'scores_groups');return}if(action==='score-add-team'){classItem.toolState.scores.push({id:uid('team'),name:`Tým ${classItem.toolState.scores.length+1}`,score:0});persistToolState(classItem,'score_add');return}if(target.dataset.scoreChange){const row=target.closest('[data-team-id]'),team=classItem.toolState.scores.find(item=>item.id===row?.dataset.teamId);if(team){team.score+=Number(target.dataset.scoreChange);persistToolState(classItem,'score_change')}return}if(target.hasAttribute('data-score-delete')){const id=target.closest('[data-team-id]')?.dataset.teamId;classItem.toolState.scores=classItem.toolState.scores.filter(item=>item.id!==id);persistToolState(classItem,'score_delete');return}if(action==='fair-pick'){try{const student=selectFairStudent({kind:$('#engagementKind').value});App.ui.quickResult=student.displayName;toast(`Vybrán/a: ${student.displayName}`,'success');renderToolsView()}catch(error){toast(error.message,'error')}return}if(target.dataset.engageStudent){recordEngagement(target.dataset.engageStudent,$('#engagementKind')?.value||'answer');return}if(target.dataset.undoEngagement){undoEngagement(target.dataset.undoEngagement);return}if(action==='engagement-reset'){if(!App.settings.confirmDestructive||confirm('Vymazat historii zapojování této třídy?'))resetEngagementHistory();return}if(action==='project-tools'){openProjection('lesson');return}if(target.dataset.export){printSortioDocument(target.dataset.export).catch(error=>toast(error.message,'error'));return}}
function bindToolsUi(){document.addEventListener('click',event=>{const target=event.target.closest('[data-action],[data-timer-preset],[data-quick],[data-score-change],[data-score-delete],[data-engage-student],[data-undo-engagement],[data-export]');if(!target||!target.closest('#toolsWorkspace'))return;handleToolAction(target)});document.addEventListener('change',event=>{if(event.target.matches('[data-score-name]')){const classItem=getSelectedClass();const team=classItem?.toolState.scores.find(item=>item.id===event.target.closest('[data-team-id]')?.dataset.teamId);if(team){team.name=event.target.value.trim()||team.name;persistToolState(classItem,'score_rename')}}})}

;
function projectionModeForCurrent(){const requested=App.ui.projectionMode;if(requested&&requested!=='auto')return requested==='tools'?'lesson':requested;if(App.route==='tools')return'lesson';if(['groups','seating','draw'].includes(App.route))return App.route;return getSelectedClass()?.currentGroups?.length?'groups':'lesson'}
function projectionGroups(classItem){if(!classItem?.currentGroups?.length)return'<div class="projection-empty"><b>Skupiny zatím nejsou vytvořené.</b><span>Vraťte se do modulu Skupiny.</span></div>';return`<div class="projection-groups" data-group-count="${classItem.currentGroups.length}">${classItem.currentGroups.map(group=>`<article><header>${group.topic?`<span class="projection-topic">${escapeHtml(group.topic)}</span>`:''}<h3>${escapeHtml(group.name)}</h3></header><ul>${resolveStudents(group.studentIds,classItem).map(student=>`<li class="${student.id===group.spokespersonId?'speaker':''}">${escapeHtml(student.displayName)}${student.id===group.spokespersonId?'<small>mluvčí</small>':''}</li>`).join('')}</ul>${Object.keys(group.roleAssignments||{}).length?`<footer>${Object.entries(group.roleAssignments).map(([role,id])=>`<span><b>${escapeHtml(role)}</b>${escapeHtml(classItem.students.find(s=>s.id===id)?.displayName||'—')}</span>`).join('')}</footer>`:''}</article>`).join('')}</div>`}
function projectionSeating(classItem){const plan=classItem?.seatingPlan,seats=plan?.seats||[];if(!seats.some(seat=>seat.studentId))return'<div class="projection-empty"><b>Zasedací pořádek zatím není vytvořený.</b><span>Vraťte se do modulu Zasedací plán.</span></div>';if(plan?.template==='custom'){const desks=seatingDeskGroups(plan),bounds=seatingDeskBounds(plan);return`<div class="projection-board">TABULE · PŘEDNÍ ČÁST</div><div class="projection-desk-shell"><div class="projection-desks" style="--projection-desk-columns:${Math.max(1,bounds.columns)};--projection-desk-rows:${Math.max(1,bounds.rows)}">${desks.map(desk=>`<section class="projection-desk" style="grid-row:${desk.row-bounds.minRow+1};grid-column:${desk.column-bounds.minColumn+1}"><small>Lavice ${desk.row+1}.${desk.column+1}</small><div>${desk.seats.map(seat=>`<span class="${seat.blocked?'blocked':seat.studentId?'occupied':'free'}">${seat.blocked?'—':escapeHtml(classItem.students.find(s=>s.id===seat.studentId)?.displayName||'VOLNÉ MÍSTO')}</span>`).join('')}</div></section>`).join('')}</div></div>`}const columns=Math.max(...seats.map(seat=>seat.column),0)+1;return`<div class="projection-board">TABULE · PŘEDNÍ ČÁST</div><div class="projection-seats" style="--projection-columns:${columns}">${seats.map(seat=>`<div class="${seat.blocked?'blocked':seat.studentId?'occupied':'free'}" style="grid-row:${seat.row+1};grid-column:${seat.column+1}">${seat.blocked?'—':escapeHtml(classItem.students.find(s=>s.id===seat.studentId)?.displayName||'VOLNÉ MÍSTO')}</div>`).join('')}</div>`}
function projectionDraw(classItem){const last=classItem?.drawState?.lastDraw||classItem?.drawHistory?.[0];if(!last)return'<div class="projection-empty"><b>Zatím neproběhlo žádné losování.</b></div>';const count=last.selectedNames.length;const nameSize=count<=3?72:count<=6?56:count<=10?44:34;return`<div class="projection-draw ${count>1?'multiple':''}"><span>VYLOSOVÁNO</span><h2 style="font-size:${nameSize}px">${last.selectedNames.map(escapeHtml).join('<br>')}</h2></div>`}
function renderProjection(){const dialog=$('#projectionDialog'),content=$('#projectionContent'),title=$('#projectionTitle');if(!dialog||!content)return;const classItem=getSelectedClass();const mode=projectionModeForCurrent();const names={groups:'Skupiny',seating:'Zasedací pořádek',draw:'Losování',lesson:'Výukový panel'};title.textContent=`${mode==='lesson'?lessonBoardScene().name:(classItem?.name||'SORTIO')} · ${names[mode]||'Projekce'}`;content.dataset.mode=mode;content.innerHTML=mode==='lesson'?lessonBoardProjectionHtml():mode==='groups'?projectionGroups(classItem):mode==='seating'?projectionSeating(classItem):projectionDraw(classItem);renderTimerDisplays();if(mode==='lesson')lessonBoardAfterRender()}
function openProjection(mode='auto'){App.ui.projectionMode=mode==='tools'?'lesson':mode;const select=$('#projectionMode');if(select)select.value=App.ui.projectionMode;renderProjection();const dialog=$('#projectionDialog');if(dialog&&!dialog.open)dialog.showModal();recordEvent('projection_open',{mode:projectionModeForCurrent()})}
function closeProjection(){const dialog=$('#projectionDialog');if(document.fullscreenElement?.closest?.('#projectionDialog'))document.exitFullscreen().catch(()=>{});if(dialog?.open)dialog.close()}
function bindProjection(){$('#projectionBtn')?.addEventListener('click',()=>openProjection('auto'));$('#projectionMode')?.addEventListener('change',event=>{App.ui.projectionMode=event.target.value;renderProjection()});document.addEventListener('click',event=>{if(event.target.closest('[data-action="close-projection"]'))closeProjection();if(event.target.closest('[data-action="projection-fullscreen"]')){$('#projectionDialog .projection-shell')?.requestFullscreen?.().catch(()=>toast('Celou obrazovku se nepodařilo aktivovat.','error'))}});document.addEventListener('sortio:data-changed',()=>{if($('#projectionDialog')?.open)renderProjection()})}

;
let sortioPrintExportsPromise=null;
function loadSortioPrintExports(){
  if(globalThis.__SORTIO_PRINT_EXPORTS__)return Promise.resolve(globalThis.__SORTIO_PRINT_EXPORTS__);
  if(sortioPrintExportsPromise)return sortioPrintExportsPromise;
  sortioPrintExportsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL('./lazy/print-exports.js',location.href).href;
    script.async=true;
    script.dataset.sortioLazy='print-exports';
    script.onload=()=>{const api=globalThis.__SORTIO_PRINT_EXPORTS__;if(api?.printSortioDocument&&api?.downloadSeatingPdf)resolve(api);else reject(new Error('Modul tisku a PDF se nepodařilo inicializovat.'))};
    script.onerror=()=>reject(new Error('Modul tisku a PDF se nepodařilo načíst.'));
    document.head.appendChild(script);
  }).catch(error=>{sortioPrintExportsPromise=null;throw error});
  return sortioPrintExportsPromise;
}
function printSortioDocument(type){return loadSortioPrintExports().then(api=>api.printSortioDocument(type))}
function downloadSeatingPdf(){return loadSortioPrintExports().then(api=>api.downloadSeatingPdf())}

;
const LESSON_WIDGET_CATALOG=Object.freeze([
  {type:'timer',icon:'⏱',label:'Timer'},
  {type:'visual-timer',icon:'◔',label:'Visual timer'},
  {type:'stopwatch',icon:'⌱',label:'Stopky'},
  {type:'clock',icon:'◷',label:'Hodiny'},
  {type:'traffic',icon:'●',label:'Semafor'},
  {type:'draw',icon:'✎',label:'Tabule'},
  {type:'dice',icon:'⚄',label:'Kostky'},
  {type:'score',icon:'★',label:'Skóre'},
  {type:'text',icon:'T',label:'Text'},
  {type:'work',icon:'◎',label:'Režim práce'},
  {type:'image',icon:'▧',label:'Obrázek'},
  {type:'agenda',icon:'☷',label:'Agenda'},
  {type:'poll',icon:'▥',label:'Hlasování'},
  {type:'qr',icon:'⌗',label:'QR odkaz'},
]);
const LESSON_BACKGROUND_PRESETS=Object.freeze([
  {type:'gradient',value:'midnight',name:'Půlnoc'},
  {type:'gradient',value:'aurora',name:'Aurora'},
  {type:'gradient',value:'ocean',name:'Oceán'},
  {type:'gradient',value:'sunset',name:'Západ slunce'},
  {type:'gradient',value:'violet',name:'Fialová'},
  {type:'gradient',value:'clean',name:'Světlá'},
  {type:'solid',value:'slate',name:'Břidlice'},
  {type:'solid',value:'paper',name:'Papír'},
  {type:'solid',value:'forest',name:'Les'},
  {type:'solid',value:'sand',name:'Písek'},
]);
const LESSON_SOUND_OPTIONS=Object.freeze([
  ['bell','Školní zvonek'],
  ['piano','Jemné trojité cinknutí'],
  ['guitar','Krátká melodie'],
  ['xylophone','Čtyři cinknutí'],
  ['trumpet','Výrazný signál'],
  ['drum','Bubínek'],
  ['none','Bez zvuku'],
]);
let lessonBoardTicker=null;
let lessonAudioContext=null;
let lessonPointerState=null;
let lessonDrawState=null;
let lessonVisualDialState=null;

function lessonBoardState(){if(!App.data.lessonBoard)App.data.lessonBoard=defaultLessonBoardState();return App.data.lessonBoard}
function lessonBoardScopeKey(){return getSelectedClass()?.id||'__general__'}
function lessonBoardScopeName(){return getSelectedClass()?.name||'Obecná pracovní plocha'}
function lessonBoardEnsureScopeScene(){
  const board=lessonBoardState(),scopeKey=lessonBoardScopeKey();
  let scene=board.scenes.find(item=>item.classId===scopeKey);
  if(!scene){
    const legacy=board.scenes.find(item=>!item.classId);
    if(legacy){scene=legacy;scene.classId=scopeKey}
    else{const id=uid('scene');scene={id,classId:scopeKey,name:lessonBoardScopeName(),background:{type:'gradient',value:'midnight'},widgets:[]};board.scenes.push(scene)}
  }
  scene.name=lessonBoardScopeName();board.activeSceneId=scene.id;return scene;
}
function lessonBoardScene(){return lessonBoardEnsureScopeScene()}
function lessonBoardWidget(id){return lessonBoardScene()?.widgets.find(widget=>widget.id===id)||null}
function lessonBoardWidgetLabel(type){return LESSON_WIDGET_CATALOG.find(item=>item.type===type)?.label||(type==='event'?'Událost':'Widget')}
function lessonBoardFullscreenRoot(){const root=$('#toolsWorkspace');return document.fullscreenElement===root?root:null}
function lessonBoardFullscreenStudio(){return lessonBoardFullscreenRoot()?.querySelector('.lesson-board-studio')||null}
function lessonBoardRefreshView(){renderToolsView();return true}
function lessonBoardPersist(event='lesson_board_update',{render=true}={}){const board=lessonBoardState();board.updatedAt=nowIso();saveData({event,render})}
function lessonBoardSceneBackgroundStyle(){return''}
function lessonBoardSceneBackgroundClass(scene){const bg=scene?.background||{};return`board-bg-${bg.type||'gradient'}-${bg.value||'midnight'}`}
function lessonBoardBackgroundImage(scene){const bg=scene?.background||{},url=bg.type==='image'?sanitizeLessonImageUrl(bg.url):'';return url?`<img class="lesson-board-background-backdrop" src="${escapeHtml(url)}" alt="" aria-hidden="true"><img class="lesson-board-background-image" src="${escapeHtml(url)}" alt="" aria-hidden="true">`:''}
function lessonBoardBackgroundCredit(scene){const bg=scene?.background||{};if(bg.type!=='image'||!bg.sourcePage)return'';const label=String(bg.sourceLabel||'Wikimedia Commons'),license=String(bg.license||'');return`<a class="board-background-credit" href="${escapeHtml(bg.sourcePage)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}${license?` · ${escapeHtml(license)}`:''}</a>`}
function lessonBoardDefaultData(type){
  const future=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  if(type==='timer')return{duration:300,remaining:300,running:false,endsAt:null,sound:'bell',showNumbers:true};
  if(type==='visual-timer')return{duration:600,remaining:600,running:false,endsAt:null,sound:'bell',showNumbers:true};
  if(type==='stopwatch')return{elapsed:0,running:false,startedAt:null,laps:[]};
  if(type==='clock')return{style:'both',showSeconds:true};
  if(type==='traffic')return{active:''};
  if(type==='draw')return{tool:'pen',color:'#ffffff',width:4,paper:'blank',strokes:[]};
  if(type==='dice')return{count:1,sides:6,last:[],mode:'dice',min:1,max:100,custom:['Popiš','Porovnej','Vysvětli','Zeptej se']};
  if(type==='score')return{mode:'points',goal:10,teams:[]};
  if(type==='text')return{text:'Napište instrukci…',size:28,align:'center'};
  if(type==='work')return{mode:'silent'};
  if(type==='image')return{url:'',sourcePage:'',sourceLabel:'Wikimedia Commons',license:'',fit:'contain'};
  if(type==='event')return{title:'Událost',date:future,schoolDaysOnly:false};
  if(type==='agenda')return{active:0,items:[{title:'Warm-up',minutes:5},{title:'Hlavní aktivita',minutes:25},{title:'Závěr',minutes:10}]};
  if(type==='poll')return{question:'Co si myslíte?',options:[{id:uid('poll-option'),label:'A',votes:0},{id:uid('poll-option'),label:'B',votes:0}],status:'draft',showResults:true,remote:{id:'',token:'',voteUrl:'',qrUrl:'',syncedAt:''}};
  if(type==='qr')return{url:'https://',label:'Odkaz pro studenty',qrUrl:''};
  return{};
}
function lessonBoardDefaultSize(type){
  const map={timer:[34,40],'visual-timer':[34,52],stopwatch:[31,36],clock:[31,40],traffic:[24,58],draw:[45,48],dice:[35,44],score:[46,49],text:[40,30],work:[31,36],image:[38,42],agenda:[42,50],poll:[44,48],qr:[32,42]};
  return map[type]||[30,34];
}
function lessonBoardNextPosition(type){const scene=lessonBoardScene();const[w,h]=lessonBoardDefaultSize(type),index=scene.widgets.length;return{x:3+(index%3)*7,y:4+(index%4)*6,w,h}}
function lessonBoardAddWidget(type){if(!LESSON_WIDGET_CATALOG.some(item=>item.type===type))return;if(type==='image'){openMediaLibrary('widget');return}const scene=lessonBoardScene(),pos=lessonBoardNextPosition(type);scene.widgets.push({id:uid('widget'),type,...pos,scale:1,locked:false,title:lessonBoardWidgetLabel(type),data:lessonBoardDefaultData(type)});lessonBoardPersist('lesson_widget_add')}
function lessonBoardAddImageWidget(image){const scene=lessonBoardScene(),pos=lessonBoardNextPosition('image');scene.widgets.push({id:uid('widget'),type:'image',...pos,scale:1,locked:false,title:'Obrázek',data:{url:image.url,sourcePage:image.sourcePage||'',sourceLabel:image.sourceLabel||'Wikimedia Commons',license:image.license||'',fit:'contain'}});lessonBoardPersist('lesson_image_add')}
function lessonBoardDuplicateWidget(id){const scene=lessonBoardScene(),source=scene.widgets.find(widget=>widget.id===id);if(!source)return;const copy=JSON.parse(JSON.stringify(source));copy.id=uid('widget');copy.x=Math.min(88,source.x+3);copy.y=Math.min(86,source.y+3);copy.locked=false;scene.widgets.push(copy);lessonBoardPersist('lesson_widget_duplicate')}
function lessonBoardDeleteWidget(id){const scene=lessonBoardScene();scene.widgets=scene.widgets.filter(widget=>widget.id!==id);if(App.ui.lessonSpotlightId===id)App.ui.lessonSpotlightId=null;lessonBoardPersist('lesson_widget_delete')}
function lessonBoardCurrentTimer(widget){const data=widget.data;if(data.running&&data.endsAt)return Math.max(0,Math.ceil((Number(data.endsAt)-Date.now())/1000));return Math.max(0,Number(data.remaining)||0)}
function lessonBoardCurrentStopwatch(widget){const data=widget.data;return data.running&&data.startedAt?Math.max(0,(Number(data.elapsed)||0)+Math.floor((Date.now()-Number(data.startedAt))/1000)):Math.max(0,Number(data.elapsed)||0)}
function lessonBoardEnsureAudio(){try{const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return null;if(!lessonAudioContext)lessonAudioContext=new AudioCtx();if(lessonAudioContext.state==='suspended')void lessonAudioContext.resume();return lessonAudioContext}catch(_){return null}}
function lessonBoardTone(ctx,{freq=440,start=0,duration=.35,type='sine',gain=.13,endFreq=null}){const now=ctx.currentTime,osc=ctx.createOscillator(),amp=ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(freq,now+start);if(endFreq)osc.frequency.exponentialRampToValueAtTime(endFreq,now+start+duration);amp.gain.setValueAtTime(.0001,now+start);amp.gain.exponentialRampToValueAtTime(gain,now+start+.018);amp.gain.exponentialRampToValueAtTime(.0001,now+start+duration);osc.connect(amp).connect(ctx.destination);osc.start(now+start);osc.stop(now+start+duration+.04)}
function lessonBoardPlaySound(kind='bell'){
  if(kind==='none')return;const ctx=lessonBoardEnsureAudio();if(!ctx)return;
  if(kind==='bell'){[[660,0,1.15,.11],[990,0,1.05,.07],[1320,0,.85,.04]].forEach(([freq,start,duration,gain])=>lessonBoardTone(ctx,{freq,start,duration,gain,type:'sine'}));return}
  if(kind==='piano'){[[523,0,.55],[659,.06,.55],[784,.12,.7]].forEach(([freq,start,duration])=>lessonBoardTone(ctx,{freq,start,duration,gain:.09,type:'triangle'}));return}
  if(kind==='guitar'){[[392,0,.45],[523,.12,.45],[659,.24,.55]].forEach(([freq,start,duration])=>lessonBoardTone(ctx,{freq,start,duration,gain:.075,type:'sawtooth',endFreq:freq*.985}));return}
  if(kind==='xylophone'){[[784,0,.18],[988,.18,.18],[1175,.36,.22],[1568,.56,.38]].forEach(([freq,start,duration])=>lessonBoardTone(ctx,{freq,start,duration,gain:.11,type:'sine'}));return}
  if(kind==='trumpet'){[[523,0,.25],[659,.22,.25],[784,.44,.55]].forEach(([freq,start,duration])=>lessonBoardTone(ctx,{freq,start,duration,gain:.07,type:'square'}));return}
  if(kind==='drum'){lessonBoardTone(ctx,{freq:150,start:0,duration:.25,gain:.16,type:'sine',endFreq:48});lessonBoardTone(ctx,{freq:110,start:.28,duration:.34,gain:.13,type:'sine',endFreq:42});return}
  lessonBoardPlaySound('bell');
}
function lessonBoardSoundSelect(d,field='sound'){return`<select data-board-field="${field}" aria-label="Zvuk">${LESSON_SOUND_OPTIONS.map(([value,label])=>`<option value="${value}" ${d[field]===value?'selected':''}>${escapeHtml(label)}</option>`).join('')}</select>`}
function lessonBoardFormatTime(seconds){return formatClock(Math.max(0,Number(seconds)||0))}
function lessonBoardTimerParts(seconds){const value=Math.max(0,Math.min(5999,Math.floor(Number(seconds)||0)));return{minutes:Math.floor(value/60),seconds:value%60}}
function lessonBoardWorkMeta(mode){return({silent:['🤫','Samostatně a potichu'],whisper:['🫢','Pracujte šeptem'],pair:['👥','Práce ve dvojici'],group:['👨‍👩‍👧‍👦','Skupinová práce'],discussion:['💬','Společná diskuse']})[mode]||['◎','Pracovní režim']}
function lessonBoardDaysUntil(date,schoolDaysOnly=false){if(!date)return null;const end=new Date(`${date}T23:59:59`);if(Number.isNaN(end.getTime()))return null;const start=new Date();start.setHours(0,0,0,0);if(end<start)return 0;if(!schoolDaysOnly)return Math.ceil((end-start)/86400000);let days=0,cursor=new Date(start);while(cursor<end){cursor.setDate(cursor.getDate()+1);const d=cursor.getDay();if(d!==0&&d!==6)days++;if(days>3660)break}return days}
function lessonBoardWidgetStyle(widget){const scale=Math.max(.65,Math.min(2.2,Number(widget.scale)||1));return`left:${widget.x}%;top:${widget.y}%;width:${widget.w}%;height:${widget.h}%;--content-scale:${scale}`}
function lessonBoardAnalogClock(){return'<div class="analog-clock" data-board-analog><i class="hand hour"></i><i class="hand minute"></i><i class="hand second"></i><i class="clock-dot"></i></div>'}
function lessonBoardQrMarkup(data){if(data.qrUrl)return`<img class="board-qr-image" src="${escapeHtml(data.qrUrl)}" alt="QR kód pro hlasování">`;return'<div class="qr-placeholder"><b>QR</b><span>aktivuje školní server</span></div>'}
function lessonBoardDrawSvg(widget){const strokes=widget.data.strokes||[];return`<svg class="draw-surface paper-${escapeHtml(widget.data.paper||'blank')}" viewBox="0 0 1000 600" preserveAspectRatio="none" data-draw-surface="${widget.id}" role="img" aria-label="Kreslicí plocha">${strokes.map(lessonBoardStrokeSvg).join('')}</svg>`}
function lessonBoardStrokeSvg(stroke){const pts=stroke.points||[];if(!pts.length)return'';const x=p=>Math.round(p.x*1000),y=p=>Math.round(p.y*600),color=escapeHtml(stroke.color||'#fff'),width=Math.max(1,Number(stroke.width)||4)*2;if(stroke.tool==='line'&&pts.length>1)return`<line x1="${x(pts[0])}" y1="${y(pts[0])}" x2="${x(pts.at(-1))}" y2="${y(pts.at(-1))}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;if((stroke.tool==='rect'||stroke.tool==='ellipse')&&pts.length>1){const a=pts[0],b=pts.at(-1),left=Math.min(x(a),x(b)),top=Math.min(y(a),y(b)),w=Math.abs(x(a)-x(b)),h=Math.abs(y(a)-y(b));return stroke.tool==='rect'?`<rect x="${left}" y="${top}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${width}"/>`:`<ellipse cx="${left+w/2}" cy="${top+h/2}" rx="${w/2}" ry="${h/2}" fill="none" stroke="${color}" stroke-width="${width}"/>`}const path=pts.map((p,index)=>`${index?'L':'M'}${x(p)} ${y(p)}`).join(' ');return`<path d="${path}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`}
function lessonBoardD6(value){const face=Math.max(1,Math.min(6,Number(value)||1)),map={1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};return`<span class="real-die d6" aria-label="Kostka ${face}">${Array.from({length:9},(_,index)=>`<i class="${map[face].includes(index+1)?'pip':''}"></i>`).join('')}</span>`}
function lessonBoardDiceVisual(value,mode){const safe=escapeHtml(String(value??''));if(mode==='dice')return lessonBoardD6(value);if(mode==='d12'||mode==='d20')return`<span class="real-die poly ${mode}"><b>${safe||'1'}</b></span>`;if(mode==='coin'){const heads=value==='Panna';return`<span class="real-coin ${heads?'heads':'tails'}"><b>${heads?'P':'O'}</b><small>${heads?'PANNA':'OREL'}</small></span>`}if(mode==='color'){const cls=({'Červená':'red','Modrá':'blue','Zelená':'green','Žlutá':'yellow','Fialová':'violet','Oranžová':'orange'})[value]||'blue';return`<span class="real-token color ${cls}"><b>●</b><small>${safe}</small></span>`}return`<span class="real-token"><b>${safe||'?'}</b></span>`}
function lessonBoardDiceVisuals(widget){const d=widget.data||{},mode=d.mode||'dice',placeholder=mode==='coin'?'Orel':mode==='letters'?'A':mode==='color'?'Modrá':mode==='math'?'+':mode==='custom'?(d.custom?.[0]||'?'):'1',values=(d.last||[]).length?d.last:Array.from({length:Math.max(1,Number(d.count)||1)},()=>placeholder),rolling=App.ui.lessonDiceRollingId===widget.id;return`<div class="dice-stage ${rolling?'rolling':''}">${values.map(value=>lessonBoardDiceVisual(value,mode)).join('')}</div>`}
function lessonBoardTimerEditor(widget,{projection=false}={}){const d=widget.data||{},remaining=lessonBoardCurrentTimer(widget),parts=lessonBoardTimerParts(remaining);if(projection)return`<div class="board-time projection-time" data-board-timer="${widget.id}">${lessonBoardFormatTime(remaining)}</div>`;return`<div class="classroom-timer"><div class="timer-stepper"><div class="timer-unit"><button data-board-timer-unit="minutes" data-board-timer-delta="1" aria-label="Přidat minutu">＋</button><b data-board-timer-minutes="${widget.id}">${String(parts.minutes).padStart(2,'0')}</b><button data-board-timer-unit="minutes" data-board-timer-delta="-1" aria-label="Odebrat minutu">−</button></div><span class="timer-colon">:</span><div class="timer-unit"><button data-board-timer-unit="seconds" data-board-timer-delta="1" aria-label="Přidat sekundu">＋</button><b data-board-timer-seconds="${widget.id}">${String(parts.seconds).padStart(2,'0')}</b><button data-board-timer-unit="seconds" data-board-timer-delta="-1" aria-label="Odebrat sekundu">−</button></div></div><div class="timer-bottom"><button class="board-primary timer-start-compact" data-board-action="timer-toggle">${d.running?'Pauza':'Spustit'}</button><button class="timer-reset-round" data-board-action="timer-reset" title="Reset">↻</button>${lessonBoardSoundSelect(d)}<button data-board-action="sound-preview" title="Přehrát zvuk">♪</button></div></div>`}
function lessonBoardVisualTimer(widget,{projection=false}={}){const d=widget.data||{},remaining=lessonBoardCurrentTimer(widget),ratio=Math.max(0,Math.min(1,remaining/3600)),angle=Math.max(0,Math.min(360,remaining/10));return`<div class="visual-timer-dial" data-visual-dial="${widget.id}" style="--remaining:${ratio};--dial-angle:${angle}deg"><div class="visual-timer-inner">${d.showNumbers===false?'':`<b data-board-timer="${widget.id}">${lessonBoardFormatTime(remaining)}</b>`}<small>60 min</small></div><i class="visual-dial-handle" aria-hidden="true"></i></div>${projection?'':`<div class="visual-timer-actions"><button class="board-primary timer-start-compact" data-board-action="timer-toggle">${d.running?'Pauza':'Spustit'}</button><button class="timer-reset-round" data-board-action="timer-reset" title="Reset">↻</button>${lessonBoardSoundSelect(d)}<button data-board-action="sound-preview" title="Přehrát zvuk">♪</button><label><input type="checkbox" data-board-field="showNumbers" ${d.showNumbers!==false?'checked':''}> čas</label></div>`}`}
function lessonBoardWidgetBody(widget,{projection=false}={}){
  const d=widget.data||{};
  if(widget.type==='timer')return lessonBoardTimerEditor(widget,{projection});
  if(widget.type==='visual-timer')return lessonBoardVisualTimer(widget,{projection});
  if(widget.type==='stopwatch'){const laps=(d.laps||[]).length?`<div class="board-laps">${d.laps.slice(0,6).map((lap,index)=>`<span>${index+1}. ${lessonBoardFormatTime(lap)}</span>`).join('')}</div>`:'';return`<div class="board-time small" data-board-stopwatch="${widget.id}">${lessonBoardFormatTime(lessonBoardCurrentStopwatch(widget))}</div>${projection?'':`<div class="timer-nudges compact"><button class="board-primary timer-action-large" data-board-action="stopwatch-toggle">${d.running?'Pauza':'Start'}</button><button data-board-action="stopwatch-lap">Mezičas</button><button data-board-action="stopwatch-reset">Reset</button></div>${laps}`}`}
  if(widget.type==='clock'){const analog=d.style!=='digital'?lessonBoardAnalogClock():'',digital=d.style!=='analog'?'<div class="digital-clock" data-board-clock></div>':'';return`<div class="clock-combo">${analog}${digital}</div>${projection?'':`<div class="timer-settings"><select data-board-field="style"><option value="both" ${d.style==='both'?'selected':''}>Analogové + digitální</option><option value="digital" ${d.style==='digital'?'selected':''}>Digitální</option><option value="analog" ${d.style==='analog'?'selected':''}>Analogové</option></select></div>`}`}
  if(widget.type==='traffic')return`<div class="traffic-housing" role="group" aria-label="Semafor"><button class="traffic-bulb red ${d.active==='red'?'active':''}" data-board-traffic="red" aria-label="Červená"></button><button class="traffic-bulb amber ${d.active==='amber'?'active':''}" data-board-traffic="amber" aria-label="Žlutá"></button><button class="traffic-bulb green ${d.active==='green'?'active':''}" data-board-traffic="green" aria-label="Zelená"></button></div>`;
  if(widget.type==='draw')return`${projection?lessonBoardDrawSvg(widget):`<div class="draw-toolbar"><select data-board-field="tool"><option value="pen" ${d.tool==='pen'?'selected':''}>Pero</option><option value="line" ${d.tool==='line'?'selected':''}>Čára</option><option value="rect" ${d.tool==='rect'?'selected':''}>Obdélník</option><option value="ellipse" ${d.tool==='ellipse'?'selected':''}>Elipsa</option><option value="eraser" ${d.tool==='eraser'?'selected':''}>Guma</option></select><input type="color" data-board-field="color" value="${escapeHtml(d.color||'#ffffff')}" aria-label="Barva"><input type="range" min="1" max="16" value="${Number(d.width)||4}" data-board-field="width" aria-label="Tloušťka"><select data-board-field="paper"><option value="blank" ${d.paper==='blank'?'selected':''}>Čistá</option><option value="lines" ${d.paper==='lines'?'selected':''}>Linky</option><option value="grid" ${d.paper==='grid'?'selected':''}>Čtverečky</option></select><button data-board-action="draw-undo">↶</button><button data-board-action="draw-clear">Smazat</button></div>${lessonBoardDrawSvg(widget)}`}`;
  if(widget.type==='dice'){return`${lessonBoardDiceVisuals(widget)}${projection?'':`<div class="dice-controls"><select data-board-field="mode"><option value="dice" ${d.mode==='dice'?'selected':''}>Kostka D6</option><option value="d12" ${d.mode==='d12'?'selected':''}>Kostka D12</option><option value="d20" ${d.mode==='d20'?'selected':''}>Kostka D20</option><option value="coin" ${d.mode==='coin'?'selected':''}>Mince</option><option value="number" ${d.mode==='number'?'selected':''}>Čísla</option><option value="letters" ${d.mode==='letters'?'selected':''}>Písmena</option><option value="color" ${d.mode==='color'?'selected':''}>Barvy</option><option value="math" ${d.mode==='math'?'selected':''}>Matematické znaky</option><option value="custom" ${d.mode==='custom'?'selected':''}>Vlastní text</option></select><select data-board-field="count"><option value="1" ${d.count===1?'selected':''}>1×</option><option value="2" ${d.count===2?'selected':''}>2×</option><option value="3" ${d.count===3?'selected':''}>3×</option></select><button class="board-primary dice-roll-big" data-board-action="dice-roll">Hodit</button></div>${d.mode==='number'?`<div class="dice-range"><label>Od <input type="number" min="-999" max="999" value="${d.min??1}" data-board-field="min"></label><label>Do <input type="number" min="-999" max="999" value="${d.max??100}" data-board-field="max"></label></div>`:''}${d.mode==='custom'?`<textarea rows="3" data-board-field="customText" placeholder="Jedna možnost na řádek">${escapeHtml((d.custom||[]).join('\n'))}</textarea>`:''}`}`}
  if(widget.type==='score'){const teams=d.teams||[],max=Math.max(d.goal||10,...teams.map(t=>t.score),1);return`<div class="board-score-list">${teams.length?teams.map(team=>`<div class="board-score-row" data-board-team="${team.id}"><div><b>${escapeHtml(team.name)}</b>${d.mode==='race'?`<span class="race-track"><i style="width:${Math.max(0,Math.min(100,team.score/max*100))}%"></i></span>`:''}</div><strong>${team.score}</strong>${projection?'':`<button data-board-score="-1">−</button><button data-board-score="1">＋</button><button data-board-score="5">+5</button>`}</div>`).join(''):'<div class="board-empty">Přidejte týmy nebo načtěte aktuální skupiny.</div>'}</div>${projection?'':`<div class="score-actions"><button data-board-action="score-load-groups">Načíst skupiny</button><button data-board-action="score-add-team">+ tým</button><select data-board-field="mode"><option value="points" ${d.mode==='points'?'selected':''}>Body</option><option value="duel" ${d.mode==='duel'?'selected':''}>Duel</option><option value="race" ${d.mode==='race'?'selected':''}>Závod</option></select><label>Cíl <input type="number" min="1" max="999" value="${d.goal||10}" data-board-field="goal"></label></div>`}`}
  if(widget.type==='text')return`<div class="board-text-content" style="font-size:${d.size||28}px;text-align:${escapeHtml(d.align||'center')}">${escapeHtml(d.text||'').replace(/\n/g,'<br>')}</div>${projection?'':`<div class="text-editor"><textarea rows="3" data-board-field="text">${escapeHtml(d.text||'')}</textarea><input type="range" min="14" max="72" value="${d.size||28}" data-board-field="size"><select data-board-field="align"><option value="left" ${d.align==='left'?'selected':''}>Vlevo</option><option value="center" ${d.align==='center'?'selected':''}>Střed</option><option value="right" ${d.align==='right'?'selected':''}>Vpravo</option></select></div>`}`;
  if(widget.type==='work'){const[icon,label]=lessonBoardWorkMeta(d.mode);return`<div class="work-mode"><b>${icon}</b><span>${escapeHtml(label)}</span></div>${projection?'':`<div class="work-buttons">${['silent','whisper','pair','group','discussion'].map(mode=>{const meta=lessonBoardWorkMeta(mode);return`<button data-board-work="${mode}" class="${d.mode===mode?'active':''}">${meta[0]} ${escapeHtml(meta[1])}</button>`}).join('')}</div>`}`}
  if(widget.type==='image')return d.url?`<div class="board-image-wrap"><img src="${escapeHtml(d.url)}" alt="${escapeHtml(d.sourceLabel||'Obrázek z Wikimedia Commons')}" style="object-fit:${escapeHtml(d.fit||'contain')}" referrerpolicy="no-referrer"><div class="image-load-error" hidden>Obrázek se nepodařilo načíst.</div>${d.sourcePage?`<a href="${escapeHtml(d.sourcePage)}" target="_blank" rel="noopener noreferrer" class="image-credit">${escapeHtml(d.license||'Wikimedia Commons')}</a>`:''}</div>${projection?'':`<div class="image-actions"><button data-board-action="image-change">Jiný obrázek</button><select data-board-field="fit"><option value="cover" ${d.fit==='cover'?'selected':''}>Vyplnit</option><option value="contain" ${d.fit==='contain'?'selected':''}>Celý</option></select></div>`}`:`<div class="board-empty"><b>Vyberte obrázek z knihovny</b>${projection?'':'<button data-board-action="image-change">Otevřít knihovnu</button>'}</div>`;
  if(widget.type==='event'){const days=lessonBoardDaysUntil(d.date,d.schoolDaysOnly);return`<div class="event-count"><strong>${days===null?'—':days}</strong><span>${d.schoolDaysOnly?'školních dnů':'dnů'}</span><b>${escapeHtml(d.title||'Událost')}</b><small>${escapeHtml(d.date||'')}</small></div>`}
  if(widget.type==='agenda'){const items=d.items||[];if(projection)return`<div class="agenda-list">${items.map((item,index)=>`<button data-board-agenda="${index}" class="${index===d.active?'active':''}"><i>${index<d.active?'✓':index+1}</i><span>${escapeHtml(item.title)}</span><b>${item.minutes?`${item.minutes} min`:''}</b></button>`).join('')}</div>`;return`<div class="agenda-list editable">${items.map((item,index)=>`<div class="agenda-edit-row ${index===d.active?'active':''}"><button class="agenda-index" data-board-agenda="${index}" title="Označit jako aktuální">${index<d.active?'✓':index+1}</button><input data-board-agenda-title="${index}" value="${escapeHtml(item.title)}" maxlength="120" aria-label="Název bodu ${index+1}"><label><input type="number" min="0" max="180" data-board-agenda-minutes="${index}" value="${Number(item.minutes)||0}"> min</label><button data-board-action="agenda-remove" data-index="${index}" title="Odstranit bod">×</button></div>`).join('')}</div><div class="agenda-actions"><button data-board-action="agenda-prev">←</button><button class="board-primary" data-board-action="agenda-next">Další</button><button data-board-action="agenda-add">+ bod</button></div>`}
  if(widget.type==='poll'){const options=d.options||[],total=options.reduce((sum,o)=>sum+o.votes,0);return`<div class="poll-question">${escapeHtml(d.question||'Otázka')}</div><div class="poll-options">${options.map(option=>{const pct=total?Math.round(option.votes/total*100):0;return`<button data-board-poll-option="${option.id}" ${projection||d.status==='closed'?'disabled':''}><span>${escapeHtml(option.label)}</span>${d.showResults?`<i style="width:${pct}%"></i><b>${option.votes} · ${pct}%</b>`:''}</button>`}).join('')}</div><div class="poll-meta"><span>${total} hlasů</span>${d.remote?.voteUrl?'<strong>QR hlasování aktivní</strong>':d.status==='open'?'<strong>Hlasování na plátně</strong>':''}</div>${d.remote?.qrUrl?`<div class="poll-qr">${lessonBoardQrMarkup(d.remote)}</div>`:''}${projection?'':`<div class="poll-actions"><button data-board-action="poll-edit">Upravit</button><button class="board-primary" data-board-action="poll-toggle">${d.status==='open'?'Ukončit':'Spustit na plátně'}</button><button data-board-action="poll-live">QR hlasování</button><button data-board-action="poll-reset">Vynulovat</button><label><input type="checkbox" data-board-field="showResults" ${d.showResults?'checked':''}> výsledky</label></div>`}`}
  if(widget.type==='qr')return`<div class="generic-qr">${d.qrUrl?lessonBoardQrMarkup(d):`<div class="qr-placeholder"><b>QR</b><span>${escapeHtml(d.label||'Odkaz')}</span></div>`}<small>${escapeHtml(d.url||'')}</small></div>${projection?'':`<div class="qr-edit"><input data-board-field="url" value="${escapeHtml(d.url||'')}" placeholder="https://…"><input data-board-field="label" value="${escapeHtml(d.label||'')}"><button data-board-action="qr-generate">Vygenerovat QR</button></div>`}`;
  return'<div class="board-empty">Widget</div>';
}
function lessonBoardWidgetHtml(widget,{projection=false}={}){const spotlight=App.ui.lessonSpotlightId===widget.id,hidden=App.ui.lessonSpotlightId&&!spotlight,scale=Math.round((Number(widget.scale)||1)*100);return`<article class="lesson-widget type-${widget.type} ${widget.locked?'locked':''} ${spotlight?'spotlight':''} ${hidden?'spotlight-hidden':''}" data-widget-id="${widget.id}" style="${lessonBoardWidgetStyle(widget)}"><header class="lesson-widget-chrome" data-board-drag><span>${escapeHtml(widget.title||lessonBoardWidgetLabel(widget.type))}</span>${projection?'':`<div class="widget-chrome-actions"><button data-board-action="widget-scale-down" title="Zmenšit obsah (${scale} %)">A−</button><button data-board-action="widget-scale-up" title="Zvětšit obsah (${scale} %)">A＋</button><button data-board-action="widget-lock" title="${widget.locked?'Odemknout':'Zamknout'}">${widget.locked?'🔒':'🔓'}</button><button data-board-action="widget-spotlight" title="Spotlight">◉</button><button data-board-action="widget-duplicate" title="Duplikovat">⧉</button><button data-board-action="widget-delete" title="Odstranit">×</button></div>`}</header><div class="lesson-widget-body"><div class="lesson-widget-scale">${lessonBoardWidgetBody(widget,{projection})}</div></div>${projection||widget.locked?'':'<button class="widget-content-scale-handle" data-board-scale-resize aria-label="Tažením změnit velikost obsahu" title="Velikost obsahu">↔</button><button class="widget-resize-handle" data-board-resize aria-label="Změnit velikost karty" title="Velikost karty">↘</button>'}</article>`}
function lessonBoardToolbar(){return`<div class="lesson-widget-bar">${LESSON_WIDGET_CATALOG.map(item=>`<button data-board-add="${item.type}" title="Přidat ${escapeHtml(item.label)}"><i>${item.icon}</i><span>${escapeHtml(item.label)}</span></button>`).join('')}<button data-board-action="background-library" title="Změnit pozadí"><i>▨</i><span>Pozadí</span></button></div>`}
function lessonBoardPanelHtml(){const scene=lessonBoardScene(),classItem=getSelectedClass(),scope=classItem?`Třída ${escapeHtml(classItem.name)}`:'Bez vybrané třídy';return`<section class="lesson-board-studio"><header class="lesson-board-head"><div><span>VÝUKOVÝ PANEL · ${scope}</span><h2>Pracovní plocha</h2><p>Karta má použitelnou výchozí velikost. Pravým dolním rohem měníte kartu; A− / A＋ mění jen hlavní obsah uvnitř, ne ovládací tlačítka.</p></div><div class="scene-actions"><button data-board-action="board-fullscreen">⛶ Celá plocha</button><button data-board-action="board-clear">Vyčistit panel</button><button class="primary-button compact" data-board-action="project-board">Promítnout</button></div></header><div class="scene-name-row"><div class="workspace-label"><b>${scope}</b><span>${classItem?'Plocha se automaticky přepíná s aktivní třídou.':'Po výběru třídy se otevře její vlastní pracovní plocha.'}</span></div><div class="background-mini">${LESSON_BACKGROUND_PRESETS.slice(0,6).map(bg=>`<button data-board-background="${bg.type}:${bg.value}" class="background-swatch board-bg-${bg.type}-${bg.value} ${scene.background?.type===bg.type&&scene.background?.value===bg.value?'active':''}" title="${escapeHtml(bg.name)}"></button>`).join('')}<button data-board-action="background-library" class="image-bg-button">Obrázky</button></div></div><div class="lesson-board-frame"><div class="lesson-board ${lessonBoardSceneBackgroundClass(scene)}" style="${lessonBoardSceneBackgroundStyle(scene)}" data-lesson-board>${lessonBoardBackgroundImage(scene)}${scene.widgets.length?scene.widgets.map(widget=>lessonBoardWidgetHtml(widget)).join(''):'<div class="lesson-board-empty"><b>Přidejte první nástroj</b><span>Timer, tabule, semafor, kostky, obrázky, hlasování…</span></div>'}${lessonBoardBackgroundCredit(scene)}</div></div>${lessonBoardToolbar()}<div class="lesson-board-note"><span>Obrázek pozadí se zobrazuje celý bez ořezu; jemně rozostřená výplň zakryje případné okraje.</span><span>QR hlasování se aktivuje po připojení školního serveru.</span></div></section>`}
function lessonBoardProjectionHtml(){const scene=lessonBoardScene();return`<div class="projection-lesson-board ${lessonBoardSceneBackgroundClass(scene)}" style="${lessonBoardSceneBackgroundStyle(scene)}">${lessonBoardBackgroundImage(scene)}${scene.widgets.map(widget=>lessonBoardWidgetHtml(widget,{projection:true})).join('')}${lessonBoardBackgroundCredit(scene)}</div>`}
function lessonBoardAfterRender(){lessonBoardUpdateClockDom();lessonBoardUpdateTimerDom();lessonBoardEnsureTicker();lessonBoardWireDrawSurfaces();lessonBoardWireImageErrors()}
function lessonBoardEnsureTicker(){if(lessonBoardTicker)return;lessonBoardTicker=setInterval(lessonBoardTick,250)}
function lessonBoardFindAnyWidget(id){return lessonBoardState().scenes.flatMap(scene=>scene.widgets).find(widget=>widget.id===id)||null}
function lessonBoardUpdateTimerDom(){const board=lessonBoardState();$$('[data-board-timer]').forEach(node=>{const widget=board.scenes.flatMap(scene=>scene.widgets).find(w=>w.id===node.dataset.boardTimer);if(widget)node.textContent=lessonBoardFormatTime(lessonBoardCurrentTimer(widget))});$$('[data-board-timer-minutes]').forEach(node=>{const widget=lessonBoardFindAnyWidget(node.dataset.boardTimerMinutes);if(widget)node.textContent=String(lessonBoardTimerParts(lessonBoardCurrentTimer(widget)).minutes).padStart(2,'0')});$$('[data-board-timer-seconds]').forEach(node=>{const widget=lessonBoardFindAnyWidget(node.dataset.boardTimerSeconds);if(widget)node.textContent=String(lessonBoardTimerParts(lessonBoardCurrentTimer(widget)).seconds).padStart(2,'0')});$$('[data-board-stopwatch]').forEach(node=>{const widget=lessonBoardFindAnyWidget(node.dataset.boardStopwatch);if(widget)node.textContent=lessonBoardFormatTime(lessonBoardCurrentStopwatch(widget))});$$('[data-visual-dial]').forEach(node=>{const widget=lessonBoardFindAnyWidget(node.dataset.visualDial);if(widget){const remaining=lessonBoardCurrentTimer(widget);node.style.setProperty('--remaining',Math.max(0,Math.min(1,remaining/3600)));node.style.setProperty('--dial-angle',`${Math.max(0,Math.min(360,remaining/10))}deg`)}})}
function lessonBoardTick(){if(!App.data)return;let changed=false;const board=lessonBoardState(),now=Date.now();for(const scene of board.scenes)for(const widget of scene.widgets){if((widget.type==='timer'||widget.type==='visual-timer')&&widget.data.running&&widget.data.endsAt&&now>=widget.data.endsAt){widget.data.running=false;widget.data.remaining=0;widget.data.endsAt=null;changed=true;lessonBoardPlaySound(widget.data.sound);toast(`${widget.title||'Časovač'}: čas vypršel.`,'success')}}if(changed)lessonBoardPersist('lesson_timer_complete');else{lessonBoardUpdateTimerDom();lessonBoardUpdateClockDom()}}
function lessonBoardUpdateClockDom(){const date=new Date();$$('[data-board-clock]').forEach(node=>{const article=node.closest('[data-widget-id]'),widget=article?lessonBoardFindAnyWidget(article.dataset.widgetId):null;node.textContent=new Intl.DateTimeFormat('cs-CZ',{hour:'2-digit',minute:'2-digit',second:widget?.data?.showSeconds===false?undefined:'2-digit'}).format(date)});$$('[data-board-analog]').forEach(clock=>{const sec=date.getSeconds(),min=date.getMinutes()+sec/60,hour=(date.getHours()%12)+min/60,h=clock.querySelector('.hour'),m=clock.querySelector('.minute'),s=clock.querySelector('.second');if(h)h.style.transform=`rotate(${hour*30}deg)`;if(m)m.style.transform=`rotate(${min*6}deg)`;if(s)s.style.transform=`rotate(${sec*6}deg)`})}
function lessonBoardUpdateField(widget,field,target){const d=widget.data;if(field==='showNumbers'||field==='schoolDaysOnly'||field==='showResults')d[field]=target.checked;else if(['duration','remaining','elapsed','goal','size','width','count','sides','active','min','max'].includes(field))d[field]=Number(target.value)||0;else if(field==='customText')d.custom=target.value.split(/\n/).map(v=>v.trim()).filter(Boolean).slice(0,30);else d[field]=target.value;lessonBoardPersist('lesson_widget_field')}
async function lessonBoardToggleFullscreen(){const root=$('#toolsWorkspace');if(!root)return;try{if(document.fullscreenElement===root)await document.exitFullscreen();else{if(document.fullscreenElement)await document.exitFullscreen();await root.requestFullscreen()}recordEvent('lesson_board_fullscreen',{active:document.fullscreenElement===root})}catch(error){captureError(error,'lesson-board-fullscreen');toast('Celou pracovní plochu se nepodařilo otevřít.','error')}}
function lessonBoardClearOverlay(){return $('#lessonBoardClearConfirm')}
function lessonBoardShowClearConfirm(){const root=$('#toolsWorkspace');if(!root)return false;lessonBoardClearOverlay()?.remove();const overlay=document.createElement('div');overlay.id='lessonBoardClearConfirm';overlay.className='lesson-clear-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','lessonBoardClearTitle');const card=document.createElement('div');card.className='lesson-clear-card';const eyebrow=document.createElement('span');eyebrow.textContent='VYČISTIT PANEL';const title=document.createElement('h3');title.id='lessonBoardClearTitle';title.textContent='Opravdu vyčistit pracovní plochu?';const copy=document.createElement('p');copy.textContent='Odstraní se všechny nástroje a karty. Zvolené pozadí zůstane zachováno.';const actions=document.createElement('div');const cancel=document.createElement('button');cancel.type='button';cancel.dataset.boardClearCancel='1';cancel.textContent='Zrušit';const confirmButton=document.createElement('button');confirmButton.type='button';confirmButton.className='danger-confirm';confirmButton.dataset.boardClearConfirm='1';confirmButton.textContent='Vyčistit panel';actions.append(cancel,confirmButton);card.append(eyebrow,title,copy,actions);overlay.append(card);root.append(overlay);requestAnimationFrame(()=>cancel.focus());return true}
function lessonBoardHideClearConfirm(){lessonBoardClearOverlay()?.remove()}
function lessonBoardPerformClear(){const scene=lessonBoardScene();scene.widgets=[];App.ui.lessonSpotlightId=null;lessonBoardHideClearConfirm();lessonBoardPersist('lesson_board_clear');toast('Pracovní plocha byla vyčištěna.','success')}
function lessonBoardAdjustScale(widget,delta){widget.scale=Math.max(.65,Math.min(2.2,Math.round(((Number(widget.scale)||1)+delta)*20)/20));lessonBoardPersist('lesson_widget_scale')}
function lessonBoardHandleAction(target,widget){const action=target.dataset.boardAction;if(!action)return false;if(action==='project-board'){openProjection('lesson');return true}if(action==='background-library'){openMediaLibrary('background');return true}if(action==='board-fullscreen'){void lessonBoardToggleFullscreen();return true}if(action==='board-clear'){const scene=lessonBoardScene();if(!scene.widgets.length){toast('Panel je už prázdný.','info');return true}if(App.settings.confirmDestructive===false)lessonBoardPerformClear();else lessonBoardShowClearConfirm();return true}if(!widget)return false;const d=widget.data;if(action==='widget-scale-down'){lessonBoardAdjustScale(widget,-.1);return true}if(action==='widget-scale-up'){lessonBoardAdjustScale(widget,.1);return true}if(action==='widget-lock'){widget.locked=!widget.locked;lessonBoardPersist('lesson_widget_lock');return true}if(action==='widget-spotlight'){App.ui.lessonSpotlightId=App.ui.lessonSpotlightId===widget.id?null:widget.id;lessonBoardRefreshView();return true}if(action==='widget-duplicate'){lessonBoardDuplicateWidget(widget.id);return true}if(action==='widget-delete'){lessonBoardDeleteWidget(widget.id);return true}if(action==='timer-toggle'){lessonBoardEnsureAudio();if(d.running){d.remaining=lessonBoardCurrentTimer(widget);d.running=false;d.endsAt=null}else{if((d.remaining||0)<=0)d.remaining=d.duration||300;d.running=true;d.endsAt=Date.now()+d.remaining*1000}lessonBoardPersist('lesson_timer_toggle');return true}if(action==='timer-reset'){d.running=false;d.endsAt=null;d.remaining=d.duration||(widget.type==='visual-timer'?600:300);lessonBoardPersist('lesson_timer_reset');return true}if(action==='sound-preview'){lessonBoardPlaySound(d.sound||'bell');return true}if(action==='stopwatch-toggle'){if(d.running){d.elapsed=lessonBoardCurrentStopwatch(widget);d.running=false;d.startedAt=null}else{d.running=true;d.startedAt=Date.now()}lessonBoardPersist('lesson_stopwatch_toggle');return true}if(action==='stopwatch-lap'){d.laps=d.laps||[];d.laps.unshift(lessonBoardCurrentStopwatch(widget));d.laps=d.laps.slice(0,30);lessonBoardPersist('lesson_stopwatch_lap');return true}if(action==='stopwatch-reset'){d.elapsed=0;d.running=false;d.startedAt=null;d.laps=[];lessonBoardPersist('lesson_stopwatch_reset');return true}if(action==='dice-roll'){App.ui.lessonDiceRollingId=widget.id;lessonBoardRollDice(widget);lessonBoardPersist('lesson_dice_roll');setTimeout(()=>{if(App.ui.lessonDiceRollingId===widget.id)App.ui.lessonDiceRollingId=null},900);return true}if(action==='score-load-groups'){const classItem=getSelectedClass();if(!classItem?.currentGroups?.length){toast('Nejprve vytvořte skupiny.','info');return true}d.teams=classItem.currentGroups.map(group=>({id:uid('board-team'),name:group.name,score:0}));lessonBoardPersist('lesson_score_groups');return true}if(action==='score-add-team'){d.teams=d.teams||[];d.teams.push({id:uid('board-team'),name:`Tým ${d.teams.length+1}`,score:0});lessonBoardPersist('lesson_score_add');return true}if(action==='draw-undo'){d.strokes=(d.strokes||[]).slice(0,-1);lessonBoardPersist('lesson_draw_undo');return true}if(action==='draw-clear'){if(!App.settings.confirmDestructive||confirm('Smazat obsah této tabule?')){d.strokes=[];lessonBoardPersist('lesson_draw_clear')}return true}if(action==='image-change'){openMediaLibrary('replace-widget',widget.id);return true}if(action==='agenda-prev'){d.active=Math.max(0,(d.active||0)-1);lessonBoardPersist('lesson_agenda_prev');return true}if(action==='agenda-next'){d.active=Math.min(Math.max(0,(d.items||[]).length-1),(d.active||0)+1);lessonBoardPersist('lesson_agenda_next');return true}if(action==='agenda-add'){d.items=d.items||[];if(d.items.length>=20){toast('Agenda může mít nejvýše 20 bodů.','info');return true}d.items.push({title:'Nový bod',minutes:5});d.active=d.items.length-1;lessonBoardPersist('lesson_agenda_add');return true}if(action==='agenda-remove'){const index=Math.max(0,Math.min((d.items||[]).length-1,Number(target.dataset.index)||0));d.items=(d.items||[]).filter((_,i)=>i!==index);d.active=Math.min(d.active||0,Math.max(0,d.items.length-1));lessonBoardPersist('lesson_agenda_remove');return true}if(action==='agenda-edit'){lessonBoardEditAgenda(widget);return true}if(action==='poll-edit'){lessonBoardEditPoll(widget);return true}if(action==='poll-toggle'){if(d.status==='open'){d.status='closed';livePollStopSchedule(widget.id);if(d.remote?.id)void livePollClose(widget)}else{d.remote={id:'',token:'',voteUrl:'',qrUrl:'',syncedAt:''};d.status='open'}lessonBoardPersist('lesson_poll_toggle');return true}if(action==='poll-reset'){(d.options||[]).forEach(option=>option.votes=0);lessonBoardPersist('lesson_poll_reset');return true}if(action==='poll-live'){void livePollStart(widget);return true}if(action==='qr-generate'){void livePollGenerateGenericQr(widget);return true}return false}
function lessonBoardRollDice(widget){const d=widget.data,mode=d.mode||'dice',count=Math.max(1,Math.min(3,Number(d.count)||1));if(mode==='coin'){d.last=Array.from({length:count},()=>randomInt(2)?'Panna':'Orel');return}if(mode==='letters'){d.last=Array.from({length:count},()=>String.fromCharCode(65+randomInt(26)));return}if(mode==='number'){const min=Math.min(Number(d.min)||1,Number(d.max)||100),max=Math.max(Number(d.min)||1,Number(d.max)||100);d.last=Array.from({length:count},()=>String(min+randomInt(max-min+1)));return}if(mode==='color'){const values=['Červená','Modrá','Zelená','Žlutá','Fialová','Oranžová'];d.last=Array.from({length:count},()=>values[randomInt(values.length)]);return}if(mode==='math'){const values=['+','−','×','÷','='];d.last=Array.from({length:count},()=>values[randomInt(values.length)]);return}if(mode==='custom'){const values=d.custom||[];d.last=Array.from({length:count},()=>values.length?values[randomInt(values.length)]:'—');return}const sides=mode==='d12'?12:mode==='d20'?20:6;d.sides=sides;d.last=Array.from({length:count},()=>String(randomInt(sides)+1))}
function lessonBoardEditAgenda(widget){const field=$(`[data-widget-id="${widget.id}"] [data-board-agenda-title]`);field?.focus()}
function lessonBoardEditPoll(widget){const question=prompt('Otázka hlasování',widget.data.question||'');if(question===null)return;const options=prompt('Možnosti – jedna na řádek',(widget.data.options||[]).map(option=>option.label).join('\n'));if(options===null)return;widget.data.question=question.trim().slice(0,300)||'Otázka';widget.data.options=options.split(/\n/).map(v=>v.trim()).filter(Boolean).slice(0,5).map(label=>({id:uid('poll-option'),label,votes:0}));if(widget.data.options.length<2){toast('Hlasování potřebuje alespoň dvě možnosti.','error');return}widget.data.status='draft';widget.data.remote={id:'',token:'',voteUrl:'',qrUrl:'',syncedAt:''};lessonBoardPersist('lesson_poll_edit')}
function lessonBoardAdjustTimerUnit(widget,unit,delta){const amount=unit==='minutes'?60:1,current=lessonBoardCurrentTimer(widget),next=Math.max(0,Math.min(5999,current+(Number(delta)||0)*amount));widget.data.running=false;widget.data.endsAt=null;widget.data.remaining=next;widget.data.duration=Math.max(1,next);lessonBoardPersist('lesson_timer_adjust')}
function lessonBoardHandleClick(event){const target=event.target.closest('[data-board-add],[data-board-action],[data-board-background],[data-board-timer-unit],[data-board-traffic],[data-board-work],[data-board-score],[data-board-agenda],[data-board-poll-option],[data-board-clear-confirm],[data-board-clear-cancel]');if(!target||!target.closest('#toolsWorkspace'))return;if(target.dataset.boardClearCancel!==undefined){lessonBoardHideClearConfirm();return}if(target.dataset.boardClearConfirm!==undefined){lessonBoardPerformClear();return}const article=target.closest('[data-widget-id]'),widget=article?lessonBoardWidget(article.dataset.widgetId):null;if(target.dataset.boardAdd){lessonBoardAddWidget(target.dataset.boardAdd);return}if(target.dataset.boardBackground){const[type,value]=target.dataset.boardBackground.split(':');lessonBoardScene().background={type,value};lessonBoardPersist('lesson_background_preset');return}if(lessonBoardHandleAction(target,widget))return;if(!widget)return;if(target.dataset.boardTimerUnit){lessonBoardAdjustTimerUnit(widget,target.dataset.boardTimerUnit,target.dataset.boardTimerDelta);return}if(target.dataset.boardTraffic){widget.data.active=widget.data.active===target.dataset.boardTraffic?'':target.dataset.boardTraffic;lessonBoardPersist('lesson_traffic');return}if(target.dataset.boardWork){widget.data.mode=target.dataset.boardWork;lessonBoardPersist('lesson_work_mode');return}if(target.dataset.boardScore){const row=target.closest('[data-board-team]'),team=widget.data.teams?.find(item=>item.id===row?.dataset.boardTeam);if(team){team.score=Math.max(-999,Math.min(9999,team.score+Number(target.dataset.boardScore)));lessonBoardPersist('lesson_score_change')}return}if(target.dataset.boardAgenda!==undefined){widget.data.active=Math.max(0,Math.min((widget.data.items||[]).length-1,Number(target.dataset.boardAgenda)||0));lessonBoardPersist('lesson_agenda_select');return}if(target.dataset.boardPollOption){if(widget.data.status!=='open')return;const option=widget.data.options?.find(item=>item.id===target.dataset.boardPollOption);if(option){option.votes++;lessonBoardPersist('lesson_poll_vote')}}}
function lessonBoardHandleChange(event){const target=event.target;if(!target.closest('#toolsWorkspace'))return;const article=target.closest('[data-widget-id]'),widget=article?lessonBoardWidget(article.dataset.widgetId):null;if(widget&&target.dataset.boardAgendaTitle!==undefined){const index=Number(target.dataset.boardAgendaTitle),item=widget.data.items?.[index];if(item){item.title=String(target.value||'').trim().slice(0,120)||`Bod ${index+1}`;lessonBoardPersist('lesson_agenda_inline',{render:false})}return}if(widget&&target.dataset.boardAgendaMinutes!==undefined){const index=Number(target.dataset.boardAgendaMinutes),item=widget.data.items?.[index];if(item){item.minutes=Math.max(0,Math.min(180,Number(target.value)||0));lessonBoardPersist('lesson_agenda_inline',{render:false})}return}if(target.matches('[data-board-field]')&&widget)lessonBoardUpdateField(widget,target.dataset.boardField,target)}
function lessonBoardPointerDown(event){const scaleResize=event.target.closest('[data-board-scale-resize]'),resize=event.target.closest('[data-board-resize]'),drag=event.target.closest('[data-board-drag]');if(!scaleResize&&!resize&&!drag)return;const article=event.target.closest('[data-widget-id]');if(!article||!article.closest('#toolsWorkspace'))return;const widget=lessonBoardWidget(article.dataset.widgetId);if(!widget||widget.locked)return;if(drag&&event.target.closest('button,input,select,textarea'))return;const board=article.closest('[data-lesson-board]');if(!board)return;const rect=board.getBoundingClientRect();lessonPointerState={kind:scaleResize?'scale':resize?'resize':'drag',pointerId:event.pointerId,widget,startX:event.clientX,startY:event.clientY,origin:{x:widget.x,y:widget.y,w:widget.w,h:widget.h,scale:Number(widget.scale)||1},rect,article};article.setPointerCapture?.(event.pointerId);event.preventDefault()}
function lessonBoardPointerMove(event){if(!lessonPointerState||event.pointerId!==lessonPointerState.pointerId)return;const s=lessonPointerState,dx=(event.clientX-s.startX)/s.rect.width*100,dy=(event.clientY-s.startY)/s.rect.height*100;if(s.kind==='drag'){s.widget.x=Math.max(0,Math.min(100-s.widget.w,s.origin.x+dx));s.widget.y=Math.max(0,Math.min(100-s.widget.h,s.origin.y+dy));s.article.style.cssText=lessonBoardWidgetStyle(s.widget)}else if(s.kind==='resize'){s.widget.w=Math.max(12,Math.min(100-s.widget.x,s.origin.w+dx));s.widget.h=Math.max(14,Math.min(100-s.widget.y,s.origin.h+dy));s.article.style.cssText=lessonBoardWidgetStyle(s.widget)}else{const delta=(event.clientX-s.startX)/Math.max(160,s.rect.width)*2.6;s.widget.scale=Math.max(.65,Math.min(2.2,Math.round((s.origin.scale+delta)*20)/20));s.article.style.setProperty('--content-scale',String(s.widget.scale))}}
function lessonBoardPointerUp(event){if(!lessonPointerState||event.pointerId!==lessonPointerState.pointerId)return;const kind=lessonPointerState.kind;lessonPointerState.article.releasePointerCapture?.(event.pointerId);lessonPointerState=null;lessonBoardPersist(kind==='scale'?'lesson_widget_scale':'lesson_widget_layout',{render:false})}
function lessonBoardContentWheel(event){if(!event.ctrlKey)return;const body=event.target.closest('.lesson-widget-body');if(!body||!body.closest('#toolsWorkspace')||event.target.closest('input,textarea,select'))return;const article=body.closest('[data-widget-id]'),widget=article?lessonBoardWidget(article.dataset.widgetId):null;if(!widget)return;event.preventDefault();widget.scale=Math.max(.65,Math.min(2.2,Math.round(((Number(widget.scale)||1)+(event.deltaY<0?.1:-.1))*20)/20));article.style.setProperty('--content-scale',String(widget.scale));lessonBoardPersist('lesson_widget_scale',{render:false})}
function lessonBoardVisualDialMinutes(event,node){const rect=node.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2,dx=event.clientX-cx,dy=event.clientY-cy,angle=(Math.atan2(dy,dx)*180/Math.PI+90+360)%360,raw=Math.round(angle/6);return raw===0?60:Math.max(1,Math.min(60,raw))}
function lessonBoardVisualDialSet(widget,node,event){const minutes=lessonBoardVisualDialMinutes(event,node);widget.data.running=false;widget.data.endsAt=null;widget.data.duration=minutes*60;widget.data.remaining=minutes*60;node.style.setProperty('--remaining',String(minutes/60));node.style.setProperty('--dial-angle',`${minutes*6}deg`);const text=node.querySelector('[data-board-timer]');if(text)text.textContent=lessonBoardFormatTime(minutes*60)}
function lessonBoardVisualPointerDown(event){const node=event.target.closest('[data-visual-dial]');if(!node||!node.closest('#toolsWorkspace')||event.target.closest('button'))return;const widget=lessonBoardWidget(node.dataset.visualDial);if(!widget)return;lessonVisualDialState={pointerId:event.pointerId,node,widget};node.setPointerCapture?.(event.pointerId);lessonBoardVisualDialSet(widget,node,event);event.preventDefault()}
function lessonBoardVisualPointerMove(event){if(!lessonVisualDialState||event.pointerId!==lessonVisualDialState.pointerId)return;lessonBoardVisualDialSet(lessonVisualDialState.widget,lessonVisualDialState.node,event)}
function lessonBoardVisualPointerUp(event){if(!lessonVisualDialState||event.pointerId!==lessonVisualDialState.pointerId)return;lessonVisualDialState.node.releasePointerCapture?.(event.pointerId);lessonVisualDialState=null;lessonBoardPersist('lesson_visual_timer_set')}
function lessonBoardWireDrawSurfaces(){/* Delegované pointer handlery pracují přímo nad SVG. */}
function lessonBoardDrawPointerDown(event){const svg=event.target.closest('[data-draw-surface]');if(!svg||!svg.closest('#toolsWorkspace'))return;const widget=lessonBoardWidget(svg.dataset.drawSurface);if(!widget)return;if(widget.data.tool==='eraser'){lessonBoardEraseNearest(widget,event,svg);return}const p=lessonBoardDrawPoint(event,svg),stroke={tool:widget.data.tool,color:widget.data.color,width:widget.data.width,points:[p]};widget.data.strokes=widget.data.strokes||[];widget.data.strokes.push(stroke);lessonDrawState={pointerId:event.pointerId,widget,svg,stroke};svg.setPointerCapture?.(event.pointerId);event.preventDefault()}
function lessonBoardDrawPointerMove(event){if(!lessonDrawState||event.pointerId!==lessonDrawState.pointerId)return;const{widget,svg,stroke}=lessonDrawState,p=lessonBoardDrawPoint(event,svg);if(stroke.tool==='pen')stroke.points.push(p);else stroke.points=[stroke.points[0],p];lessonBoardRenderDrawSurface(svg,widget)}
function lessonBoardRenderDrawSurface(svg,widget){const ns='http://www.w3.org/2000/svg',fragment=document.createDocumentFragment();for(const stroke of widget.data.strokes||[]){const pts=stroke.points||[];if(!pts.length)continue;const x=p=>Math.round(p.x*1000),y=p=>Math.round(p.y*600),color=/^#[0-9a-f]{6}$/i.test(String(stroke.color||''))?String(stroke.color):'#ffffff',width=Math.max(1,Number(stroke.width)||4)*2;let el;if(stroke.tool==='line'&&pts.length>1){el=document.createElementNS(ns,'line');for(const[k,v]of Object.entries({x1:x(pts[0]),y1:y(pts[0]),x2:x(pts.at(-1)),y2:y(pts.at(-1))}))el.setAttribute(k,String(v));el.setAttribute('stroke-linecap','round')}else if((stroke.tool==='rect'||stroke.tool==='ellipse')&&pts.length>1){const a=pts[0],b=pts.at(-1),left=Math.min(x(a),x(b)),top=Math.min(y(a),y(b)),w=Math.abs(x(a)-x(b)),h=Math.abs(y(a)-y(b));el=document.createElementNS(ns,stroke.tool==='rect'?'rect':'ellipse');if(stroke.tool==='rect'){for(const[k,v]of Object.entries({x:left,y:top,width:w,height:h}))el.setAttribute(k,String(v))}else{for(const[k,v]of Object.entries({cx:left+w/2,cy:top+h/2,rx:w/2,ry:h/2}))el.setAttribute(k,String(v))}el.setAttribute('fill','none')}else{el=document.createElementNS(ns,'path');el.setAttribute('d',pts.map((point,index)=>`${index?'L':'M'}${x(point)} ${y(point)}`).join(' '));el.setAttribute('fill','none');el.setAttribute('stroke-linecap','round');el.setAttribute('stroke-linejoin','round')}el.setAttribute('stroke',color);el.setAttribute('stroke-width',String(width));fragment.append(el)}svg.replaceChildren(fragment)}
function lessonBoardDrawPointerUp(event){if(!lessonDrawState||event.pointerId!==lessonDrawState.pointerId)return;lessonDrawState.svg.releasePointerCapture?.(event.pointerId);lessonDrawState=null;lessonBoardPersist('lesson_draw_stroke',{render:false})}
function lessonBoardDrawPoint(event,svg){const r=svg.getBoundingClientRect();return{x:Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))}}
function lessonBoardEraseNearest(widget,event,svg){const p=lessonBoardDrawPoint(event,svg),strokes=widget.data.strokes||[];if(!strokes.length)return;let best=-1,dist=Infinity;strokes.forEach((stroke,index)=>{stroke.points.forEach(pt=>{const d=(pt.x-p.x)**2+(pt.y-p.y)**2;if(d<dist){dist=d;best=index}})});if(best>=0&&dist<.02){strokes.splice(best,1);lessonBoardPersist('lesson_draw_erase')}}
function lessonBoardWireImageErrors(){$$('.board-image-wrap img,.lesson-board-background-image,.lesson-board-background-backdrop').forEach(image=>{if(image.dataset.errorBound)return;image.dataset.errorBound='1';image.addEventListener('error',()=>{image.hidden=true;const fallback=image.parentElement?.querySelector('.image-load-error');if(fallback)fallback.hidden=false},{once:true})})}
function bindLessonBoard(){document.addEventListener('click',lessonBoardHandleClick);document.addEventListener('change',lessonBoardHandleChange);document.addEventListener('input',event=>{const target=event.target;if(!target.closest('#toolsWorkspace'))return;const article=target.closest('[data-widget-id]'),widget=article?lessonBoardWidget(article.dataset.widgetId):null;if(widget&&target.matches('[data-board-field="text"],[data-board-field="size"],[data-board-field="align"]'))lessonBoardUpdateField(widget,target.dataset.boardField,target)});document.addEventListener('pointerdown',lessonBoardPointerDown);document.addEventListener('pointermove',lessonBoardPointerMove);document.addEventListener('pointerup',lessonBoardPointerUp);document.addEventListener('pointercancel',lessonBoardPointerUp);document.addEventListener('pointerdown',lessonBoardVisualPointerDown);document.addEventListener('pointermove',lessonBoardVisualPointerMove);document.addEventListener('pointerup',lessonBoardVisualPointerUp);document.addEventListener('pointercancel',lessonBoardVisualPointerUp);document.addEventListener('pointerdown',lessonBoardDrawPointerDown);document.addEventListener('pointermove',lessonBoardDrawPointerMove);document.addEventListener('pointerup',lessonBoardDrawPointerUp);document.addEventListener('pointercancel',lessonBoardDrawPointerUp);document.addEventListener('wheel',lessonBoardContentWheel,{passive:false})}

;
let sortioMediaLibraryPromise=null;
function loadSortioMediaLibrary(){
  if(globalThis.__SORTIO_MEDIA_LIBRARY__){globalThis.__SORTIO_MEDIA_LIBRARY__.bind?.();return Promise.resolve(globalThis.__SORTIO_MEDIA_LIBRARY__)}
  if(sortioMediaLibraryPromise)return sortioMediaLibraryPromise;
  sortioMediaLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('./lazy/media-library.js',location.href).href;script.async=true;script.dataset.sortioLazy='media-library';
    script.onload=()=>{const api=globalThis.__SORTIO_MEDIA_LIBRARY__;if(api?.open&&api?.bind){api.bind();resolve(api)}else reject(new Error('Knihovnu obrázků se nepodařilo inicializovat.'))};
    script.onerror=()=>reject(new Error('Knihovnu obrázků se nepodařilo načíst.'));document.head.appendChild(script);
  }).catch(error=>{sortioMediaLibraryPromise=null;throw error});
  return sortioMediaLibraryPromise;
}
function openMediaLibrary(target='background',widgetId=''){return loadSortioMediaLibrary().then(api=>api.open(target,widgetId)).catch(error=>{captureError(error,'media-library-lazy');toast('Knihovnu obrázků se nepodařilo načíst.','error')})}
function bindMediaLibrary(){}

;
const LIVE_POLL_SCHEMA='sortio-live-poll-v1';
const LIVE_POLL_REFRESH_MS=1800;

function livePollDeployment(){return globalThis.__GHRAB_DEPLOYMENT_CONFIG__||{}}
function livePollApiBase(){
  const config=livePollDeployment();const raw=String(config.apiBaseUrl||'').trim();if(!raw)return null;
  try{return new URL(raw,globalThis.location?.href||'http://localhost/')}catch(_){return null}
}
function livePollEndpoint(path){const base=livePollApiBase();if(!base)return null;try{return new URL(String(path||'').replace(/^\/+/,''),base).href}catch(_){return null}}
function livePollServerAvailable(){return !!livePollApiBase()}
async function livePollJson(url,options={}){
  const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
  if(!response.ok)throw new Error(`SORTIO live API ${response.status}`);
  return response.json();
}
function livePollValidateRemote(json){
  const id=String(json?.id||'').replace(/[^A-Za-z0-9._:-]/g,'').slice(0,120);
  const token=String(json?.teacherToken||json?.token||'').replace(/[^A-Za-z0-9._:-]/g,'').slice(0,240);
  const voteUrl=sanitizeLessonQrUrl(json?.voteUrl);
  const qrUrl=sanitizeLessonSelfUrl(json?.qrUrl);
  if(!id||!token||!voteUrl||!qrUrl)throw new Error('Neúplná odpověď live poll API.');
  return{id,token,voteUrl,qrUrl,syncedAt:nowIso()};
}
async function livePollStart(widget){
  if(!widget||widget.type!=='poll')return;
  if((widget.data.options||[]).length<2){toast('Hlasování potřebuje alespoň dvě možnosti.','error');return}
  const endpoint=livePollEndpoint('sortio/polls');
  if(!endpoint){
    widget.data.status='open';lessonBoardPersist('lesson_poll_local_open');
    toast('Hlasování na plátně je spuštěné. QR hlasování bude dostupné po připojení školního serveru.','info');return;
  }
  try{
    const appBase=String(livePollDeployment().appBaseUrl||'/apps/sortio/');
    const json=await livePollJson(endpoint,{method:'POST',body:JSON.stringify({schema:LIVE_POLL_SCHEMA,question:widget.data.question,options:(widget.data.options||[]).map(option=>({id:option.id,label:option.label})),anonymous:true,expiresInMinutes:60,voterPath:`${appBase.replace(/\/$/,'')}/poll/`})});
    widget.data.remote=livePollValidateRemote(json);widget.data.status='open';(widget.data.options||[]).forEach(option=>option.votes=0);
    lessonBoardPersist('lesson_poll_live_start');livePollSchedule(widget.id);toast('QR hlasování je spuštěné. Výsledky se budou obnovovat živě.','success');
  }catch(error){captureError(error,'live-poll-start');toast('QR hlasování se nepodařilo spustit. Hlasování na plátně zůstává dostupné.','error')}
}
function livePollStopSchedule(widgetId){const handle=App.ui.pollSyncHandles?.[widgetId];if(handle)clearInterval(handle);if(App.ui.pollSyncHandles)delete App.ui.pollSyncHandles[widgetId]}
async function livePollClose(widget){
  const remote=widget?.data?.remote;if(!remote?.id||!remote?.token)return;
  livePollStopSchedule(widget.id);const endpoint=livePollEndpoint(`sortio/polls/${encodeURIComponent(remote.id)}/close?token=${encodeURIComponent(remote.token)}`);if(!endpoint)return;
  try{await livePollJson(endpoint,{method:'POST'});widget.data.status='closed';lessonBoardPersist('lesson_poll_live_close',{render:false});livePollUpdateVisibleResults(widget)}catch(error){captureError(error,'live-poll-close')}
}
function livePollSchedule(widgetId){
  livePollStopSchedule(widgetId);if(!App.ui.pollSyncHandles)App.ui.pollSyncHandles={};
  App.ui.pollSyncHandles[widgetId]=setInterval(()=>{const widget=lessonBoardState().scenes.flatMap(scene=>scene.widgets).find(item=>item.id===widgetId);if(!widget||widget.type!=='poll'||widget.data.status!=='open'||!widget.data.remote?.id){livePollStopSchedule(widgetId);return}void livePollRefresh(widget)},LIVE_POLL_REFRESH_MS);
  const widget=lessonBoardState().scenes.flatMap(scene=>scene.widgets).find(item=>item.id===widgetId);if(widget)void livePollRefresh(widget);
}
async function livePollRefresh(widget){
  const remote=widget?.data?.remote;if(!remote?.id||!remote?.token)return;
  const endpoint=livePollEndpoint(`sortio/polls/${encodeURIComponent(remote.id)}/results?token=${encodeURIComponent(remote.token)}`);if(!endpoint)return;
  try{
    const json=await livePollJson(endpoint);const counts=new Map((json?.options||[]).map(option=>[String(option.id),Math.max(0,Number(option.votes)||0)]));
    for(const option of widget.data.options||[])if(counts.has(option.id))option.votes=counts.get(option.id);
    if(['open','closed'].includes(json?.status))widget.data.status=json.status;widget.data.remote.syncedAt=nowIso();
    lessonBoardPersist('lesson_poll_live_sync',{render:false});livePollUpdateVisibleResults(widget);
    if(widget.data.status!=='open')livePollStopSchedule(widget.id);
  }catch(error){captureError(error,'live-poll-refresh')}
}
function livePollUpdateVisibleResults(widget){
  const options=widget.data.options||[],total=options.reduce((sum,option)=>sum+(Number(option.votes)||0),0);
  $$(`[data-widget-id="${CSS.escape(widget.id)}"]`).forEach(article=>{const projection=!!article.closest('#projectionModal');for(const option of options){const button=article.querySelector(`[data-board-poll-option="${CSS.escape(option.id)}"]`);if(!button)continue;const pct=total?Math.round((Number(option.votes)||0)/total*100):0,bar=button.querySelector('i'),count=button.querySelector('b');if(bar)bar.style.width=`${pct}%`;if(count)count.textContent=`${Number(option.votes)||0} · ${pct}%`;button.disabled=projection||widget.data.status==='closed'}const meta=article.querySelector('.poll-meta span');if(meta)meta.textContent=`${total} hlasů`;const state=article.querySelector('.poll-meta strong');if(state)state.textContent=widget.data.remote?.voteUrl?'QR hlasování aktivní':widget.data.status==='open'?'Hlasování na plátně':'';const toggle=article.querySelector('[data-board-action="poll-toggle"]');if(toggle)toggle.textContent=widget.data.status==='open'?'Ukončit':'Spustit na plátně'});
}
async function livePollGenerateGenericQr(widget){
  if(!widget||widget.type!=='qr')return;const url=sanitizeLessonQrUrl(widget.data.url);if(!url){toast('Nejprve vložte platný odkaz.','error');return}
  const endpoint=livePollEndpoint('sortio/qr');if(!endpoint){toast('QR generátor bude dostupný po připojení školního serveru.','info');return}
  try{const json=await livePollJson(endpoint,{method:'POST',body:JSON.stringify({schema:'sortio-qr-v1',url,label:widget.data.label||'Odkaz'})});widget.data.qrUrl=sanitizeLessonSelfUrl(json?.qrUrl);if(!widget.data.qrUrl)throw new Error('Chybí QR URL');lessonBoardPersist('lesson_qr_generate')}catch(error){captureError(error,'qr-generate');toast('QR kód se nepodařilo vygenerovat.','error')}
}
function bindLivePoll(){
  for(const widget of lessonBoardState().scenes.flatMap(scene=>scene.widgets))if(widget.type==='poll'&&widget.data.status==='open'&&widget.data.remote?.id)livePollSchedule(widget.id);
  addEventListener('beforeunload',()=>{Object.keys(App.ui.pollSyncHandles||{}).forEach(livePollStopSchedule)},{once:true});
}

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
let sp;function loadSortioProduction(){const g=globalThis.__SORTIO_PRODUCTION_TOOLS__;if(g)return Promise.resolve(g);if(sp)return sp;return sp=new Promise((ok,no)=>{const s=document.createElement('script');s.src=new URL('./lazy/production-tools.js',location.href).href;s.onload=()=>globalThis.__SORTIO_PRODUCTION_TOOLS__?ok(globalThis.__SORTIO_PRODUCTION_TOOLS__):no(Error('Diagnostika.'));s.onerror=()=>no(Error('Diagnostika.'));document.head.appendChild(s)}).catch(e=>{sp=null;throw e})}function bindProductionTools(){void loadSortioProduction().then(x=>x.bind()).catch(e=>captureError(e,'production-tools-lazy'))}function renderProductionHealth(){return loadSortioProduction().then(x=>x.health())}function runProductionChecks(){return loadSortioProduction().then(x=>x.run())}

;
const KEYBOARD_ROUTES=['overview','classes','draw','groups','roles','seating','tools','settings','about'];
function isTypingTarget(target){return target?.matches?.('input,textarea,select,[contenteditable="true"]')}
function showKeyboardHelp(){const dialog=$('#keyboardDialog');if(dialog&&!dialog.open)dialog.showModal()}
function bindKeyboardShortcuts(){document.addEventListener('keydown',event=>{if(event.key==='Escape'){const dialog=$$('dialog[open]').at(-1);if(dialog){event.preventDefault();dialog.close();return}}if(isTypingTarget(event.target))return;if(event.key==='?'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();showKeyboardHelp();return}if(event.altKey&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&/^[1-9]$/.test(event.key)){const route=KEYBOARD_ROUTES[Number(event.key)-1];if(route){event.preventDefault();activateRoute(route)}}if(event.altKey&&event.key.toLocaleLowerCase('cs-CZ')==='p'){event.preventDefault();openProjection()}if(event.altKey&&event.key.toLocaleLowerCase('cs-CZ')==='i'){event.preventDefault();document.querySelector('[data-action="open-import"]')?.click()}});$('#keyboardHelpBtn')?.addEventListener('click',showKeyboardHelp);$('#keyboardDialog [data-action="close-dialog"]')?.addEventListener('click',()=>$('#keyboardDialog')?.close());$$('dialog').forEach(dialog=>dialog.addEventListener('close',()=>document.querySelector(`[aria-controls="${dialog.id}"]`)?.focus?.()))}

;
function updateRuntimeHealth(){document.documentElement.dataset.online=navigator.onLine?'true':'false';const health=storageHealthSnapshot(),invalidPrimary=health.primaryPresent&&!health.primaryValid,invalidLastGood=health.lastGoodPresent&&!health.lastGoodValid,status=!health.available?'bad':invalidPrimary||invalidLastGood||!!App.storageError?'warn':'good';document.documentElement.dataset.storage=health.available?'available':'blocked';document.documentElement.dataset.appHealth=status;const pill=$('#releasePill');if(pill){pill.title=status==='good'?'Stav aplikace: připraveno k provozu':status==='warn'?'Stav aplikace: vyžaduje pozornost':'Stav aplikace: úložiště není dostupné';pill.setAttribute('aria-label',pill.title)}}
function bindRuntimeHealth(){updateRuntimeHealth();window.addEventListener('online',()=>{updateRuntimeHealth();toast('Připojení k internetu bylo obnoveno.','success')});window.addEventListener('offline',()=>{updateRuntimeHealth();toast('SORTIO pokračuje v offline režimu.','info')});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')updateRuntimeHealth()})}
function productionReadiness(){const health=storageHealthSnapshot(),invalidPrimary=health.primaryPresent&&!health.primaryValid,invalidLastGood=health.lastGoodPresent&&!health.lastGoodValid;return{ready:health.available&&!invalidPrimary&&!invalidLastGood,online:navigator.onLine,storage:health,version:SORTIO_VERSION}}

;

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
  bindNavigation();bindSettings();bindClassUi();bindDrawUi();bindGroupsUi();bindRolesUi();bindSeatingUi();bindLessonBoard();bindMediaLibrary();bindToolsUi();bindProjection();bindLivePoll();bindProductionTools();bindKeyboardShortcuts();bindRuntimeHealth();bindPwaInstall();bindCrossTabStorageSync();
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

