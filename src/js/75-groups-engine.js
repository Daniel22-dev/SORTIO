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
