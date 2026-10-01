import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const loader=fs.readFileSync(path.join(root,'src/js/46-central-groups.js'),'utf8');
const wrappedSource=fs.readFileSync(path.join(root,'src/lazy/central-groups.js'),'utf8');
const source=wrappedSource.replace(/^\(\(\)=>\{\n?/, '').replace(/\n\}\)\(\);\s*$/, '');
assert.ok(!source.includes('ghrab.ai-studio.groups.v1')&&!loader.includes('ghrab.ai-studio.groups.v1'),'SORTIO nesmí znát raw storage key AI Studia');
assert.ok(!/localStorage\s*[.(\[]/.test(source+loader),'SORTIO central sync nesmí číst localStorage');
assert.ok(source.includes('listGroupMetadata'),'consumer používá metadata-only seznam');
assert.ok(loader.includes('./lazy/central-groups.js'),'consumer sync je načítán on-demand mimo kritický bundle');
assert.ok(source.includes("getRosterProjection(groupId,CENTRAL_GROUPS_CONSUMER_ID)"),'roster používá oficiální consumer projection');

let localCounter=0;
const context={
  console,URL,globalThis:null,window:null,document:{addEventListener(){}},
  location:{href:'https://school.example/SORTIO/',origin:'https://school.example'},
  App:{data:{classes:[]},ui:{centralGroups:{groups:[],preview:null,error:null}}},
  normalizeText(value=''){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()},
  titleCase(value=''){return String(value).trim().split(/([\s-]+)/).map(part=>/[\s-]+/.test(part)?part:part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join('')},
  nowIso(){return'2026-10-01T04:30:00.000Z'},
  makeStudent(firstName,lastName){localCounter++;const displayName=`${firstName} ${lastName}`.trim();return{id:`student-${localCounter}`,canonicalMemberId:null,firstName,lastName,displayName,key:String(displayName).toLowerCase(),present:true,archived:false,groupLevel:'B',frontPreference:false,soloPreference:false,createdAt:'2026-09-01T00:00:00.000Z',updatedAt:'2026-09-01T00:00:00.000Z'}},
  syncDrawDeck(classItem){const active=new Set(classItem.students.filter(s=>!s.archived&&s.present).map(s=>s.id));classItem.drawState.remainingIds=classItem.drawState.remainingIds.filter(id=>active.has(id));return classItem.drawState.remainingIds},
  classStudents(classItem){return(classItem?.students||[]).filter(s=>!s.archived)},
  escapeHtml(v=''){return String(v)},formatDateTime(){return''},toast(){},captureError(){},saveData(){},getSelectedClass(){return null},suggestSchoolYear(){return'2026/27'},confirm(){return true},activateRoute(){},createClass(){throw new Error('not used')},$(){return null},
};
context.globalThis=context;context.window=context;
vm.createContext(context);
vm.runInContext(source+'\n;globalThis.__centralTest={validateCentralProjection,validateCentralGroupList,buildCentralSyncPreview,applyCentralSyncProjection,centralGroupLinkedClasses};',context,{filename:'46-central-groups.js'});
const api=context.__centralTest;

const gid='grp_000000000001';
const m1='mem_000000000001',m2='mem_000000000002',m3='mem_000000000003',m4='mem_000000000004';
function projection(revision,members,status='active'){return{contract:'ghrab-roster-projection-v1',consumerAppId:'sortio',group:{schema:'ghrab-teaching-group-v1',groupId:gid,revision,displayName:'3A4 · AJ',schoolYear:'2026/27',subject:'AJ',grade:'3',status,updatedAt:'2026-10-01T04:20:00.000Z'},members}}
function student(id,name,extra={}){const parts=name.split(' ');return{id,canonicalMemberId:null,firstName:parts.shift(),lastName:parts.join(' '),displayName:name,key:name.toLowerCase(),present:true,archived:false,groupLevel:'B',frontPreference:false,soloPreference:false,createdAt:'2026-09-01T00:00:00.000Z',updatedAt:'2026-09-01T00:00:00.000Z',...extra}}
function classroom(){return{id:'class-1',name:'3A4 local',schoolYear:'2026/27',students:[student('s1','Alice Novak',{groupLevel:'A',frontPreference:true}),student('s2','Boris Svoboda',{soloPreference:true})],sourceGroupId:null,lastSyncedRevision:null,lastSyncedAt:null,drawState:{remainingIds:['s1','s2'],cycle:3,lastDraw:{id:'draw-last'}},drawHistory:[{id:'draw-1',selectedIds:['s1']}],engagementHistory:[{id:'eng-1',studentId:'s1'}],currentGroups:[{id:'group-local',studentIds:['s1','s2'],locked:true}],groupHistory:[{id:'groupset-1',groups:[{studentIds:['s1','s2']}]}],lastGroupConfig:{mode:'size',value:2,smartMode:'random'},groupRules:{together:[['s1','s2']],apart:[],pins:{s1:0}},roleCatalog:['Mluvčí'],topicCatalog:['Téma'],roleHistory:[{id:'role-1',studentId:'s1',role:'Mluvčí'}],seatingPlan:{template:'rows',rows:2,columns:2,seats:[{id:'seat-1',studentId:'s2',locked:true,blocked:false}],updatedAt:'2026-09-20T00:00:00.000Z'},toolState:{scores:[{id:'team-1',name:'A',score:2}],decisionOptions:['X'],updatedAt:'2026-09-20T00:00:00.000Z'}}}

const c=classroom();
const p5=projection(5,[{memberId:m1,name:'Alice Novak',status:'active'},{memberId:m2,name:'Boris Svoboda',status:'active'},{memberId:m3,name:'Carla Vesela',status:'active'}]);
const plan5=api.buildCentralSyncPreview(c,p5);
assert.equal(plan5.linked.length,2);assert.equal(plan5.added.length,1);assert.equal(plan5.conflicts.length,0);
const operationalBefore={drawHistory:structuredClone(c.drawHistory),engagementHistory:structuredClone(c.engagementHistory),currentGroups:structuredClone(c.currentGroups),groupHistory:structuredClone(c.groupHistory),groupRules:structuredClone(c.groupRules),roleHistory:structuredClone(c.roleHistory),seatingPlan:structuredClone(c.seatingPlan),toolState:structuredClone(c.toolState)};
api.applyCentralSyncProjection(c,p5,plan5);
assert.equal(c.sourceGroupId,gid);assert.equal(c.lastSyncedRevision,5);assert.equal(c.students.length,3);
assert.equal(c.students.find(s=>s.id==='s1').canonicalMemberId,m1);assert.equal(c.students.find(s=>s.id==='s2').canonicalMemberId,m2);
for(const [key,value] of Object.entries(operationalBefore))assert.deepEqual(c[key],value,`${key} musí sync zachovat`);
assert.equal(c.students.find(s=>s.id==='s1').groupLevel,'A');assert.equal(c.students.find(s=>s.id==='s1').frontPreference,true);assert.equal(c.students.find(s=>s.id==='s2').soloPreference,true);

const alice=c.students.find(s=>s.canonicalMemberId===m1);alice.present=false;
const p6=projection(6,[{memberId:m1,name:'Alice Novotna',status:'active'},{memberId:m2,name:'Boris Svoboda',status:'archived'},{memberId:m3,name:'Carla Vesela',status:'active'},{memberId:m4,name:'David Kral',status:'active'}]);
const plan6=api.buildCentralSyncPreview(c,p6);assert.equal(plan6.renamed.length,1);assert.equal(plan6.archived.length,1);assert.equal(plan6.added.length,1);
api.applyCentralSyncProjection(c,p6,plan6);assert.equal(c.lastSyncedRevision,6);assert.equal(alice.displayName,'Alice Novotna');assert.equal(alice.present,false);
const boris=c.students.find(s=>s.canonicalMemberId===m2);assert.equal(boris.archived,true);assert.equal(boris.present,false);assert.deepEqual(c.groupRules,operationalBefore.groupRules);assert.deepEqual(c.seatingPlan,operationalBefore.seatingPlan);

const p7=projection(7,[{memberId:m1,name:'Alice Novotna',status:'active'},{memberId:m2,name:'Boris Svoboda',status:'active'},{memberId:m3,name:'Carla Vesela',status:'active'},{memberId:m4,name:'David Kral',status:'active'}]);
const plan7=api.buildCentralSyncPreview(c,p7);assert.equal(plan7.restored.length,1);api.applyCentralSyncProjection(c,p7,plan7);assert.equal(boris.archived,false);assert.equal(boris.present,false);

assert.throws(()=>api.validateCentralProjection({...p7,members:[{memberId:m1,name:'Alice',status:'active',schoolEmail:'alice@example.edu'}]},gid),/e-mailové údaje/i);
assert.throws(()=>api.validateCentralProjection(projection(8,[{memberId:m1,name:'<img src=x onerror=alert(1)>',status:'active'}]),gid),/neplatné zobrazované jméno/i);
assert.throws(()=>api.validateCentralGroupList([{...p7.group,members:[]}]),/data, která SORTIO nesmí převzít/i);

const ambiguous=classroom();ambiguous.students.push(student('s3','Alice Novak'));
const ambPlan=api.buildCentralSyncPreview(ambiguous,p5);assert.ok(ambPlan.conflicts.some(x=>x.type==='ambiguous-name'));
assert.throws(()=>api.applyCentralSyncProjection(ambiguous,p5,ambPlan),/konflikty/i);

const hardMissing=classroom();hardMissing.students[0].canonicalMemberId=m1;hardMissing.sourceGroupId=gid;hardMissing.lastSyncedRevision=5;
const missingPlan=api.buildCentralSyncPreview(hardMissing,projection(6,[{memberId:m2,name:'Boris Svoboda',status:'active'}]));assert.equal(missingPlan.missing.length,1);api.applyCentralSyncProjection(hardMissing,projection(6,[{memberId:m2,name:'Boris Svoboda',status:'active'}]),missingPlan);assert.equal(hardMissing.students[0].archived,true);assert.equal(hardMissing.drawHistory.length,1);

const many=Array.from({length:500},(_,i)=>({memberId:`mem_${String(i+1).padStart(12,'0')}`,name:`Student ${i+1}`,status:'active'}));
assert.equal(api.validateCentralProjection(projection(9,many),gid).members.length,500);
assert.throws(()=>api.validateCentralProjection(projection(9,[...many,{memberId:'mem_999999999999',name:'Overflow',status:'active'}]),gid),/limit/i);

context.App.data.classes=[{id:'a',sourceGroupId:gid},{id:'b',sourceGroupId:gid},{id:'c',sourceGroupId:null}];
assert.equal(api.centralGroupLinkedClasses(gid,{excludeClassId:'a'}).length,1);

console.log(JSON.stringify({schema:'sortio-central-groups-regressions-v1',checks:32,status:'passed'},null,2));
