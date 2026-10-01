(()=>{
const CENTRAL_GROUPS_CONSUMER_ID='sortio';
const CENTRAL_GROUPS_SERVICE_SCHEMA='ghrab-groups-service-v1';
const CENTRAL_ROSTER_PROJECTION_CONTRACT='ghrab-roster-projection-v1';
const CENTRAL_TEACHING_GROUP_SCHEMA='ghrab-teaching-group-v1';
const CENTRAL_GROUP_ID_RE=/^grp_[A-Za-z0-9-]{12,}$/;
const CENTRAL_MEMBER_ID_RE=/^mem_[A-Za-z0-9-]{12,}$/;
let CENTRAL_GROUPS_SERVICE_PROMISE=null;
let CENTRAL_GROUPS_UNSUBSCRIBE=null;

function centralGroupsError(code,message){const error=new Error(message||code);error.code=code;return error}
function centralGroupsStudioBaseUrl(){
  const configured=globalThis.__GHRAB_DEPLOYMENT_CONFIG__?.studioBaseUrl||globalThis.__GHRAB_STUDIO_URL__||'/AI-Studio-GHRAB/';
  const url=new URL(String(configured),globalThis.location?.href||'http://localhost/');
  if(globalThis.location?.origin&&url.origin!==globalThis.location.origin)throw centralGroupsError('CENTRAL_GROUPS_CROSS_ORIGIN','Moje skupiny jsou dostupné jen ze stejného školního původu.');
  return url;
}
function centralGroupsServiceCompatible(service){
  return !!service&&service.schema===CENTRAL_GROUPS_SERVICE_SCHEMA&&Number(service.contractVersion)>=1&&
    ['listGroupMetadata','getRosterProjection','getRevision','subscribe','createGroup','importRoster','parseRoster'].every(name=>typeof service[name]==='function');
}
async function resolveCentralGroupsService({force=false}={}){
  if(force)CENTRAL_GROUPS_SERVICE_PROMISE=null;
  if(CENTRAL_GROUPS_SERVICE_PROMISE)return CENTRAL_GROUPS_SERVICE_PROMISE;
  CENTRAL_GROUPS_SERVICE_PROMISE=(async()=>{
    const existing=globalThis.GHRAB_GROUPS;
    if(centralGroupsServiceCompatible(existing))return existing;
    const base=centralGroupsStudioBaseUrl();
    const moduleUrl=new URL('groups/group-service.js',base);
    let module;
    try{module=await import(moduleUrl.href)}catch(error){throw centralGroupsError('CENTRAL_GROUPS_UNAVAILABLE','Centrální službu Moje skupiny se nepodařilo načíst. Ruční import z IS zůstává dostupný.')}
    const service=typeof module.createGroupsService==='function'?module.createGroupsService():null;
    if(!centralGroupsServiceCompatible(service))throw centralGroupsError('CENTRAL_GROUPS_CONTRACT_OLD','AI Studio má starší kontrakt Moje skupiny. Pro bezpečné napojení SORTIO je potřeba metadata-only consumer API.');
    return service;
  })().catch(error=>{CENTRAL_GROUPS_SERVICE_PROMISE=null;throw error});
  return CENTRAL_GROUPS_SERVICE_PROMISE;
}
function centralObjectHasForbiddenRosterKey(value){
  if(!value||typeof value!=='object')return false;
  if(Object.prototype.hasOwnProperty.call(value,'schoolEmail'))return true;
  if(Array.isArray(value))return value.some(centralObjectHasForbiddenRosterKey);
  return Object.values(value).some(centralObjectHasForbiddenRosterKey);
}
function validateCentralGroupMetadata(group){
  if(!group||typeof group!=='object')throw centralGroupsError('CENTRAL_GROUP_INVALID','Centrální skupina má neplatný formát.');
  if(group.schema!==CENTRAL_TEACHING_GROUP_SCHEMA||!CENTRAL_GROUP_ID_RE.test(String(group.groupId||''))||!Number.isInteger(group.revision)||group.revision<1)throw centralGroupsError('CENTRAL_GROUP_INVALID','Centrální skupina má neplatný identifikátor nebo revizi.');
  if(!['active','archived'].includes(group.status))throw centralGroupsError('CENTRAL_GROUP_INVALID','Centrální skupina má neplatný stav.');
  if(typeof group.displayName!=='string'||!group.displayName.trim()||group.displayName.length>160)throw centralGroupsError('CENTRAL_GROUP_INVALID','Centrální skupina má neplatný název.');
  if(Object.prototype.hasOwnProperty.call(group,'members')||centralObjectHasForbiddenRosterKey(group))throw centralGroupsError('CENTRAL_GROUP_OVEREXPOSED','Centrální seznam skupin obsahuje data, která SORTIO nesmí převzít.');
  return group;
}
function validateCentralGroupList(groups){
  if(!Array.isArray(groups)||groups.length>200)throw centralGroupsError('CENTRAL_GROUP_LIST_INVALID','Seznam centrálních skupin má neplatný formát.');
  const seen=new Set();
  return groups.map(group=>{validateCentralGroupMetadata(group);if(seen.has(group.groupId))throw centralGroupsError('CENTRAL_GROUP_LIST_INVALID','Seznam centrálních skupin obsahuje duplicitní identifikátor.');seen.add(group.groupId);return group});
}
function validateCentralMemberName(value){
  const name=String(value||'').replace(/\s+/g,' ').trim();
  if(!name||name.length>120||/[<>\u0000-\u001f\u007f]/.test(name))throw centralGroupsError('CENTRAL_ROSTER_INVALID','Centrální roster obsahuje neplatné zobrazované jméno.');
  return name;
}
function validateCentralProjection(projection,expectedGroupId=null){
  if(!projection||typeof projection!=='object'||projection.contract!==CENTRAL_ROSTER_PROJECTION_CONTRACT||projection.consumerAppId!==CENTRAL_GROUPS_CONSUMER_ID)throw centralGroupsError('CENTRAL_ROSTER_INVALID','Centrální roster má neplatný kontrakt.');
  if(centralObjectHasForbiddenRosterKey(projection))throw centralGroupsError('CENTRAL_ROSTER_OVEREXPOSED','Centrální roster obsahuje e-mailové údaje, které SORTIO nesmí převzít.');
  const group=projection.group;
  if(!group||group.schema!==CENTRAL_TEACHING_GROUP_SCHEMA||!CENTRAL_GROUP_ID_RE.test(String(group.groupId||''))||!Number.isInteger(group.revision)||group.revision<1||!['active','archived'].includes(group.status))throw centralGroupsError('CENTRAL_ROSTER_INVALID','Centrální roster má neplatná metadata skupiny.');
  if(expectedGroupId&&group.groupId!==expectedGroupId)throw centralGroupsError('CENTRAL_ROSTER_GROUP_MISMATCH','Centrální služba vrátila jinou skupinu.');
  const members=Array.isArray(projection.members)?projection.members:[];
  if(members.length>500)throw centralGroupsError('CENTRAL_ROSTER_INVALID','Centrální roster překračuje podporovaný limit.');
  const seen=new Set();
  for(const member of members){
    if(!member||!CENTRAL_MEMBER_ID_RE.test(String(member.memberId||''))||seen.has(member.memberId)||!['active','archived'].includes(member.status))throw centralGroupsError('CENTRAL_ROSTER_INVALID','Centrální roster obsahuje neplatný nebo duplicitní záznam.');
    validateCentralMemberName(member.name);seen.add(member.memberId);
  }
  return projection;
}
function splitCentralDisplayName(name){
  const parts=validateCentralMemberName(name).split(/\s+/);
  return{firstName:parts.shift()||'',lastName:parts.join(' ')};
}
function centralMappedStudent(classItem,memberId){return classItem?.students?.find(student=>student.canonicalMemberId===memberId)||null}
function centralGroupLinkedClasses(groupId,{excludeClassId=null}={}){return(App.data?.classes||[]).filter(item=>item.id!==excludeClassId&&item.sourceGroupId===groupId)}
function buildCentralSyncPreview(classItem,projection){
  validateCentralProjection(projection);
  const localStudents=classItem?.students||[];
  const mapping=new Map();const duplicateMappings=[];
  for(const student of localStudents){if(!student.canonicalMemberId)continue;if(mapping.has(student.canonicalMemberId))duplicateMappings.push(student.canonicalMemberId);else mapping.set(student.canonicalMemberId,student)}
  const usedLocalIds=new Set();
  const unmappedByName=new Map();
  for(const student of localStudents){if(student.canonicalMemberId)continue;const key=normalizeText(student.displayName);if(!unmappedByName.has(key))unmappedByName.set(key,[]);unmappedByName.get(key).push(student)}
  const plan={groupId:projection.group.groupId,revision:projection.group.revision,groupStatus:projection.group.status,added:[],linked:[],renamed:[],restored:[],archived:[],missing:[],unchanged:[],ignoredArchived:[],conflicts:duplicateMappings.map(memberId=>({type:'duplicate-mapping',memberId})),localOnly:[]};
  const centralIds=new Set(projection.members.map(member=>member.memberId));
  for(const member of projection.members){
    const local=mapping.get(member.memberId);
    if(local){
      usedLocalIds.add(local.id);
      if(normalizeText(local.displayName)!==normalizeText(member.name)||local.displayName!==member.name)plan.renamed.push({memberId:member.memberId,studentId:local.id,name:member.name});
      if(member.status==='archived'&&!local.archived)plan.archived.push({memberId:member.memberId,studentId:local.id,name:member.name});
      else if(member.status==='active'&&local.archived)plan.restored.push({memberId:member.memberId,studentId:local.id,name:member.name});
      else plan.unchanged.push({memberId:member.memberId,studentId:local.id,name:member.name,status:member.status});
      continue;
    }
    if(member.status==='archived'){plan.ignoredArchived.push({memberId:member.memberId,name:member.name});continue}
    const candidates=(unmappedByName.get(normalizeText(member.name))||[]).filter(student=>!usedLocalIds.has(student.id));
    if(candidates.length===1){const localMatch=candidates[0];usedLocalIds.add(localMatch.id);plan.linked.push({memberId:member.memberId,studentId:localMatch.id,name:member.name,wasArchived:!!localMatch.archived});continue}
    if(candidates.length>1){plan.conflicts.push({type:'ambiguous-name',memberId:member.memberId,name:member.name,count:candidates.length});continue}
    plan.added.push({memberId:member.memberId,name:member.name});
  }
  for(const student of localStudents){
    if(usedLocalIds.has(student.id))continue;
    if(student.canonicalMemberId&&!centralIds.has(student.canonicalMemberId)){plan.missing.push({memberId:student.canonicalMemberId,studentId:student.id,name:student.displayName});continue}
    if(!student.canonicalMemberId&&!student.archived)plan.localOnly.push({studentId:student.id,name:student.displayName});
  }
  plan.hasChanges=!!(plan.added.length||plan.linked.length||plan.renamed.length||plan.restored.length||plan.archived.length||plan.missing.length||plan.localOnly.length);
  return plan;
}
function applyCentralMemberName(student,name){const split=splitCentralDisplayName(name);student.firstName=titleCase(split.firstName);student.lastName=titleCase(split.lastName);student.displayName=`${student.firstName} ${student.lastName}`.trim();student.key=normalizeText(student.displayName);student.updatedAt=nowIso()}
function createStudentFromCentralMember(member){const split=splitCentralDisplayName(member.name);const student=makeStudent(split.firstName,split.lastName);if(!student)throw centralGroupsError('CENTRAL_ROSTER_INVALID','Centrální člen nemá použitelné jméno.');student.canonicalMemberId=member.memberId;return student}
function applyCentralSyncProjection(classItem,projection,plan=buildCentralSyncPreview(classItem,projection)){
  validateCentralProjection(projection,classItem?.sourceGroupId||projection.group.groupId);
  if(plan.conflicts.length)throw centralGroupsError('CENTRAL_SYNC_CONFLICT','Synchronizaci nelze potvrdit, dokud nejsou vyřešeny konflikty jmen nebo mapování.');
  const byMemberId=new Map((classItem.students||[]).filter(student=>student.canonicalMemberId).map(student=>[student.canonicalMemberId,student]));
  const byStudentId=new Map((classItem.students||[]).map(student=>[student.id,student]));
  const linkedByMember=new Map(plan.linked.map(item=>[item.memberId,item.studentId]));
  const centralIds=new Set(projection.members.map(member=>member.memberId));
  for(const member of projection.members){
    let student=byMemberId.get(member.memberId);
    if(!student&&linkedByMember.has(member.memberId)){student=byStudentId.get(linkedByMember.get(member.memberId));if(student)student.canonicalMemberId=member.memberId}
    if(!student&&member.status==='active'){student=createStudentFromCentralMember(member);classItem.students.push(student);byStudentId.set(student.id,student)}
    if(!student)continue;
    applyCentralMemberName(student,member.name);
    student.canonicalMemberId=member.memberId;
    if(member.status==='archived'){student.archived=true;student.present=false}else if(student.archived){student.archived=false}
  }
  for(const student of classItem.students){
    const mappedMissing=student.canonicalMemberId&&!centralIds.has(student.canonicalMemberId);
    const localOnly=plan.localOnly.some(item=>item.studentId===student.id);
    if(mappedMissing||localOnly){student.archived=true;student.present=false;student.updatedAt=nowIso()}
  }
  classItem.sourceGroupId=projection.group.groupId;
  classItem.lastSyncedRevision=projection.group.revision;
  classItem.lastSyncedAt=nowIso();
  classItem.name=String(projection.group.displayName||classItem.name).slice(0,160);
  classItem.schoolYear=String(projection.group.schoolYear||classItem.schoolYear||'').slice(0,40);
  classItem.updatedAt=nowIso();
  if(typeof syncDrawDeck==='function')syncDrawDeck(classItem);
  return classItem;
}
function unlinkCentralGroup(classItem=getSelectedClass()){
  if(!classItem)return false;
  classItem.sourceGroupId=null;classItem.lastSyncedRevision=null;classItem.lastSyncedAt=null;
  for(const student of classItem.students)student.canonicalMemberId=null;
  classItem.updatedAt=nowIso();saveData({event:'central_group_unlink'});return true;
}
function centralSyncCounts(plan){return{added:plan.added.length,linked:plan.linked.length,renamed:plan.renamed.length,restored:plan.restored.length,archived:plan.archived.length+plan.missing.length+plan.localOnly.length,conflicts:plan.conflicts.length}}
function renderCentralGroupOptions(groups,selected=''){return groups.map(group=>`<option value="${escapeHtml(group.groupId)}" ${group.groupId===selected?'selected':''}>${escapeHtml(group.displayName)} · rev. ${group.revision}${group.status==='archived'?' · archivována':''}</option>`).join('')}
function renderCentralSyncPreview(plan,projection){
  const root=$('#centralGroupPreview');const apply=$('#applyCentralGroup');if(!root||!apply)return;
  if(!plan||!projection){root.innerHTML='<div class="central-preview-placeholder">Vyberte skupinu a načtěte náhled změn.</div>';apply.disabled=true;return}
  const counts=centralSyncCounts(plan);const rows=[];
  const add=(items,label,kind)=>items.slice(0,12).forEach(item=>rows.push(`<div class="central-diff-row ${kind}"><b>${escapeHtml(label)}</b><span>${escapeHtml(item.name||'Technický konflikt')}</span></div>`));
  add(plan.added,'Přidat','positive');add(plan.linked,'Napojit existujícího','info');add(plan.renamed,'Přejmenovat','info');add(plan.restored,'Obnovit','positive');add(plan.archived,'Archivovat','warning');add(plan.missing,'Archivovat chybějící','warning');add(plan.localOnly,'Archivovat lokálního','warning');add(plan.conflicts,'Konflikt','danger');
  const hidden=Math.max(0,plan.added.length+plan.linked.length+plan.renamed.length+plan.restored.length+plan.archived.length+plan.missing.length+plan.localOnly.length+plan.conflicts.length-rows.length);
  root.innerHTML=`<div class="central-preview-summary"><span>Revize <b>${projection.group.revision}</b></span><span>Aktivní ${projection.members.filter(m=>m.status==='active').length}</span><span>Archivovaní ${projection.members.filter(m=>m.status==='archived').length}</span></div>${projection.group.status==='archived'?'<div class="central-sync-warning">Centrální skupina je archivována. SORTIO ji nepřepíše ani nesmaže; lze ji pouze načíst jako zmrazený zdroj nebo odpojit.</div>':''}${rows.length?`<div class="central-diff-list">${rows.join('')}${hidden?`<small>… a dalších ${hidden} změn</small>`:''}</div>`:'<div class="central-preview-ok">Členství se od poslední synchronizace nezměnilo.</div>'}${counts.conflicts?'<div class="central-sync-warning danger">Konflikt je nutné vyřešit v lokální třídě (typicky duplicitní stejné jméno), než půjde synchronizaci potvrdit.</div>':''}`;
  apply.disabled=counts.conflicts>0;
}
async function loadCentralGroupMetadata({selectedGroupId=null}={}){
  const service=await resolveCentralGroupsService();
  const groups=validateCentralGroupList(service.listGroupMetadata(CENTRAL_GROUPS_CONSUMER_ID,{status:'all'}));
  App.ui.centralGroups.groups=groups;
  const select=$('#centralGroupSelect');if(select){select.innerHTML=groups.length?renderCentralGroupOptions(groups,selectedGroupId):'<option value="">Žádná skupina není dostupná</option>';select.disabled=!groups.length}
  return{service,groups};
}
async function fetchCentralProjection(groupId){const service=await resolveCentralGroupsService();let projection;try{projection=service.getRosterProjection(groupId,CENTRAL_GROUPS_CONSUMER_ID)}catch(error){if(String(error?.message||'').includes('GROUP_NOT_FOUND'))throw centralGroupsError('CENTRAL_GROUP_NOT_FOUND','Centrální skupina už neexistuje nebo není dostupná. Lokální data SORTIO zůstala beze změny.');throw error}return validateCentralProjection(projection,groupId)}
async function previewSelectedCentralGroup(){
  const groupId=$('#centralGroupSelect')?.value;const classItem=getSelectedClass();if(!groupId)throw centralGroupsError('CENTRAL_GROUP_REQUIRED','Vyberte skupinu.');
  const linkedElsewhere=centralGroupLinkedClasses(groupId,{excludeClassId:classItem?.id||null});if(linkedElsewhere.length)throw centralGroupsError('CENTRAL_GROUP_ALREADY_LINKED','Tato centrální skupina je už napojena na jinou lokální třídu SORTIO. Nejprve ji tam odpojte.');
  const projection=await fetchCentralProjection(groupId);const plan=buildCentralSyncPreview(classItem,projection);App.ui.centralGroups.preview={projection,plan,classId:classItem?.id||null};renderCentralSyncPreview(plan,projection);return{projection,plan};
}
async function openCentralGroupsDialog({groupId=null}={}){
  const dialog=$('#centralGroupsDialog');if(!dialog)return;
  App.ui.centralGroups.preview=null;$('#centralGroupPreview').innerHTML='<div class="central-preview-placeholder">Načítám bezpečný seznam skupin…</div>';$('#applyCentralGroup').disabled=true;$('#centralGroupServiceState').textContent='Připojuji oficiální group service…';dialog.showModal();
  try{const selected=groupId||getSelectedClass()?.sourceGroupId||null;const{groups}=await loadCentralGroupMetadata({selectedGroupId:selected});$('#centralGroupServiceState').textContent=groups.length?'Dostupné skupiny načteny bez e-mailových adres.':'V AI Studiu zatím není žádná skupina.';if(groups.length){if(selected&&groups.some(g=>g.groupId===selected))$('#centralGroupSelect').value=selected;await previewSelectedCentralGroup()}}catch(error){$('#centralGroupServiceState').textContent=error.message;$('#centralGroupPreview').innerHTML='<div class="central-sync-warning danger">Centrální služba není bezpečně dostupná. Použijte zatím ruční import z IS.</div>';App.ui.centralGroups.error=error.code||'CENTRAL_GROUPS_UNAVAILABLE'}
}
async function applySelectedCentralGroup(){
  let preview=App.ui.centralGroups.preview;
  if(!preview){await previewSelectedCentralGroup();preview=App.ui.centralGroups.preview;}
  const currentClass=getSelectedClass();
  if(!preview||preview.classId!==(currentClass?.id||null)){await previewSelectedCentralGroup();throw centralGroupsError('CENTRAL_SYNC_CONTEXT_CHANGED','Výběr třídy se změnil. Náhled byl obnoven; zkontrolujte jej a potvrďte znovu.');}
  const fresh=await fetchCentralProjection(preview.projection.group.groupId);if(fresh.group.revision!==preview.projection.group.revision){const plan=buildCentralSyncPreview(currentClass,fresh);App.ui.centralGroups.preview={projection:fresh,plan,classId:currentClass?.id||null};renderCentralSyncPreview(plan,fresh);throw centralGroupsError('CENTRAL_SYNC_STALE','Centrální skupina se mezitím změnila. Náhled byl obnoven; zkontrolujte jej a potvrďte znovu.');}
  if(fresh.group.status==='archived'&&!currentClass?.sourceGroupId)throw centralGroupsError('CENTRAL_GROUP_ARCHIVED','Archivovanou centrální skupinu nelze nově napojit. Obnovte ji nejprve v AI Studiu.');
  let target=currentClass;
  if(!target)target=createClass({name:fresh.group.displayName,schoolYear:fresh.group.schoolYear,students:[]});
  if(target.sourceGroupId&&target.sourceGroupId!==fresh.group.groupId)throw centralGroupsError('CENTRAL_GROUP_RELINK_BLOCKED','Třída je už napojena na jinou centrální skupinu. Nejprve ji odpojte.');
  if(centralGroupLinkedClasses(fresh.group.groupId,{excludeClassId:target.id}).length)throw centralGroupsError('CENTRAL_GROUP_ALREADY_LINKED','Tato centrální skupina je už napojena na jinou lokální třídu SORTIO.');
  const plan=buildCentralSyncPreview(target,fresh);applyCentralSyncProjection(target,fresh,plan);saveData({event:'central_group_sync'});App.ui.centralGroups.preview=null;$('#centralGroupsDialog')?.close();const counts=centralSyncCounts(plan);toast(`Synchronizováno: +${counts.added}, napojeno ${counts.linked}, archivováno ${counts.archived}.`,'success');activateRoute('classes');return target;
}
async function migrateSelectedClassToCentral(){
  const classItem=getSelectedClass();if(!classItem)throw centralGroupsError('CLASS_REQUIRED','Nejprve vyberte třídu.');if(classItem.sourceGroupId)throw centralGroupsError('CENTRAL_GROUP_RELINK_BLOCKED','Třída už je na Moje skupiny napojena.');
  const active=classStudents(classItem);if(!active.length)throw centralGroupsError('CLASS_EMPTY','Prázdnou třídu není co migrovat.');
  const nameKeys=new Map();for(const student of active){const key=normalizeText(student.displayName);nameKeys.set(key,(nameKeys.get(key)||0)+1)}if([...nameKeys.values()].some(count=>count>1))throw centralGroupsError('MIGRATION_AMBIGUOUS_NAMES','Třída obsahuje více studentů se stejným jménem. Před migrací je rozlište, aby šlo vytvořit stabilní mapování.');
  if(!confirm(`Vytvořit v AI Studiu novou skupinu „${classItem.name}“ a jednorázově do ní přenést ${active.length} jmen? E-maily ani provozní data SORTIO se nepřenášejí.`))return false;
  const service=await resolveCentralGroupsService();const rawText=active.map(student=>student.displayName).join('\n');const parsed=service.parseRoster(rawText);if(!parsed||parsed.entries?.length!==active.length||parsed.invalid?.length)throw centralGroupsError('MIGRATION_PARSE_FAILED','Centrální parser nedokázal bezpečně převést všechna jména. Migrace nebyla spuštěna.');
  const created=service.createGroup({displayName:classItem.name,schoolYear:classItem.schoolYear||suggestSchoolYear()});
  let imported;try{imported=service.importRoster({groupId:created.groupId,rawText,replace:true,expectedRevision:created.revision})}catch(error){throw centralGroupsError('MIGRATION_IMPORT_FAILED','Skupina byla v AI Studiu vytvořena, ale seznam se nepodařilo dokončit. Otevřete Moje skupiny a zkontrolujte novou prázdnou skupinu.');}
  const projection=validateCentralProjection(service.getRosterProjection(created.groupId,CENTRAL_GROUPS_CONSUMER_ID),created.groupId);const plan=buildCentralSyncPreview(classItem,projection);if(plan.conflicts.length)throw centralGroupsError('MIGRATION_MAPPING_FAILED','Skupina vznikla, ale automatické mapování na lokální studenty má konflikt. Lokální data nebyla přepsána.');applyCentralSyncProjection(classItem,projection,plan);saveData({event:'central_group_migrate'});toast(`Třída byla bezpečně přenesena do Moje skupiny (revize ${imported.group.revision}).`,'success');return true;
}
function bindCentralGroupsUi(){
  document.addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(!button)return;const action=button.dataset.action;if(!['central-link','central-update','central-unlink','central-migrate','central-preview','central-apply'].includes(action))return;event.preventDefault();void(async()=>{try{if(action==='central-link')await openCentralGroupsDialog();if(action==='central-update')await openCentralGroupsDialog({groupId:getSelectedClass()?.sourceGroupId||null});if(action==='central-unlink'){const item=getSelectedClass();if(item&&confirm('Odpojit třídu od Moje skupiny? Lokální studenti, historie a nastavení zůstanou zachovány.')){unlinkCentralGroup(item);toast('Třída nyní funguje pouze lokálně.','success')}}if(action==='central-migrate')await migrateSelectedClassToCentral();if(action==='central-preview')await previewSelectedCentralGroup();if(action==='central-apply')await applySelectedCentralGroup()}catch(error){toast(error.message||'Operace Moje skupiny se nepodařila.','error');if(error.code==='CENTRAL_SYNC_STALE')return;captureError(error,'central-groups')}})()});
  document.addEventListener('change',event=>{if(event.target.id==='centralGroupSelect')void previewSelectedCentralGroup().catch(error=>{toast(error.message,'error')})});
  void resolveCentralGroupsService().then(service=>{if(CENTRAL_GROUPS_UNSUBSCRIBE)return;CENTRAL_GROUPS_UNSUBSCRIBE=service.subscribe(detail=>{const item=getSelectedClass();if(!item?.sourceGroupId||detail.groupId&&detail.groupId!==item.sourceGroupId)return;if(Number.isInteger(detail.revision)&&Number(item.lastSyncedRevision||0)>=detail.revision)return;toast('Napojená skupina v AI Studiu se změnila. Aktualizujte ji v sekci Třídy.','info')})}).catch(()=>{});
}

let centralGroupsLazyBound=false;
const centralGroupsOriginalBind=bindCentralGroupsUi;
bindCentralGroupsUi=function(){if(centralGroupsLazyBound)return;centralGroupsLazyBound=true;return centralGroupsOriginalBind()};
globalThis.__SORTIO_CENTRAL_GROUPS__=Object.freeze({bind:bindCentralGroupsUi});
})();
