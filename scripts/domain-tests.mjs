import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');

class LocalStorageMock{
  constructor(){this.values=new Map();this.failWrites=false;this.failKey=null}
  get length(){return this.values.size}
  key(index){return [...this.values.keys()][index]??null}
  getItem(key){return this.values.has(String(key))?this.values.get(String(key)):null}
  setItem(key,value){
    if(this.failWrites||this.failKey===String(key)){const error=new Error('Quota exceeded');error.name='QuotaExceededError';error.code=22;throw error}
    this.values.set(String(key),String(value));
  }
  removeItem(key){this.values.delete(String(key))}
  clear(){this.values.clear()}
}

const storage=new LocalStorageMock();
let counter=0;
const nowIso=()=>new Date(1700000000000+counter++*1000).toISOString();
const titleCase=value=>String(value||'').trim().split(/([\s-]+)/).map(part=>/[\s-]+/.test(part)?part:part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join('');
const normalizeText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const randomInt=max=>max?counter++%max:0;
const shuffle=values=>{
  const out=[...values];
  for(let index=out.length-1;index>0;index--){const swap=randomInt(index+1);[out[index],out[swap]]=[out[swap],out[index]]}
  return out;
};
const App={
  settings:{theme:'dark',motion:true,confirmDestructive:false},
  data:null,
  ui:{groupMode:'size',smartGroupMode:'random'},
  storageError:null,
  recoveryState:null,
  lastOperation:'test',
};
const document={dispatchEvent(){},querySelector(){return null},querySelectorAll(){return[]}};
const context={
  console,Map,Set,Math,Date,Object,Array,String,Number,Boolean,Error,JSON,Blob,
  App,window:{localStorage:storage},document,
  CustomEvent:class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail}},
  nowIso,titleCase,normalizeText,randomInt,shuffle,
  uid:(prefix='id')=>`${prefix}-${++counter}`,
  captureError:()=>{},recordEvent:()=>{},downloadText:()=>{},confirm:()=>true,
  setTimeout,clearTimeout,
};
vm.createContext(context);
for(const file of [
  'src/js/20-state-storage.js',
  'src/js/25-data-model.js',
  'src/js/45-import-parser.js',
  'src/js/65-draw-engine.js',
  'src/js/75-groups-engine.js',
  'src/js/81-seating-engine.js',
]){
  vm.runInContext(readFileSync(join(ROOT,file),'utf8'),context,{filename:file});
}
const evaluate=source=>vm.runInContext(source,context);
const plain=value=>JSON.parse(JSON.stringify(value));
const DATA_KEY=evaluate('DATA_KEY');
const LAST_GOOD_KEY=evaluate('LAST_GOOD_KEY');
const RECOVERY_KEY=evaluate('RECOVERY_KEY');
const CORRUPT_KEY=evaluate('CORRUPT_KEY');

function freshClass(studentCount=12){
  storage.clear();storage.failWrites=false;storage.failKey=null;counter=0;
  App.data=context.defaultData();
  const students=Array.from({length:studentCount},(_,index)=>context.makeStudent(`Jméno${index+1}`,`Příjmení${index+1}`));
  return context.createClass({name:'Testovací třída',schoolYear:'2026/2027',students});
}

// Import a doménové utility používají skutečný produkční parser a enginy.
App.data=context.defaultData();
const parsed=context.parseImport('alex.novak@example.com, bara.svobodova@example.com');
assert.deepEqual(plain(parsed.rows.map(row=>row.key)),['alex novak','bara svobodova']);
assert.equal(context.parseImport('alex.novak@example.com alex.novak@example.com').rows.length,1);
assert.equal(context.parseImport('alex.novak@example.com neplatna-polozka').invalid.length,1);
const reversed=context.parseImport('novak.jan2@example.com',{nameOrder:'last-first'}).rows[0];
assert.equal(reversed.firstName,'Jan');
assert.equal(reversed.lastName,'Novak');
for(const [total,mode,value]of [[26,'size',4],[25,'count',6],[31,'size',5],[3,'size',2]]){
  const lengths=context.groupLengths(total,{mode,value});
  assert.equal(lengths.reduce((sum,item)=>sum+item,0),total);
  assert.ok(Math.max(...lengths)-Math.min(...lengths)<=1);
}
for(const [template,rows,columns,count]of [['rows',4,6,24],['pairs',4,3,24],['islands',5,4,20],['u',4,6,12]]){
  assert.equal(context.createSeatLayout(template,rows,columns).length,count,template);
}

// Jmenovci jsou legitimní, ale vyžadují výslovné potvrzení volající vrstvy.
let namesakeClass=freshClass(1);
const existing=namesakeClass.students[0];
let duplicateError=null;
try{context.addStudent(namesakeClass.id,existing.firstName,existing.lastName)}catch(error){duplicateError=error}
assert.equal(duplicateError?.code,'DUPLICATE_STUDENT_NAME');
assert.doesNotThrow(()=>context.addStudent(namesakeClass.id,existing.firstName,existing.lastName,{allowDuplicate:true}));
const second=namesakeClass.students[1];
assert.throws(()=>context.updateStudent(namesakeClass.id,second.id,{firstName:existing.firstName,lastName:existing.lastName}),error=>error.code==='DUPLICATE_STUDENT_NAME');
assert.doesNotThrow(()=>context.updateStudent(namesakeClass.id,second.id,{firstName:existing.firstName,lastName:existing.lastName},{allowDuplicate:true}));

// Sanitizace přenáší jen povolené top-level klíče.
const sanitized=context.sanitizeData({...context.defaultData(),unknownTopLevel:'nesmí zůstat'});
assert.equal('unknownTopLevel'in sanitized,false);

// Regrese S1: docházka nesmí zničit skupiny, sezení ani rozpracovaný cyklus.
let classItem=freshClass(12);
context.generateGroups({mode:'size',value:4,smartMode:'random'});
context.configureSeating({template:'rows',rows:4,columns:6});
context.assignSeating();
context.resetDrawCycle();
const groupsBefore=classItem.currentGroups.map(group=>[...group.studentIds]);
const seatsBefore=classItem.seatingPlan.seats.filter(seat=>seat.studentId).map(seat=>[seat.id,seat.studentId]);
const deckBefore=[...classItem.drawState.remainingIds];
const absentId=classItem.students[0].id;
context.updateStudent(classItem.id,absentId,{present:false});
assert.deepEqual(plain(classItem.currentGroups.map(group=>group.studentIds)),plain(groupsBefore));
assert.deepEqual(plain(classItem.seatingPlan.seats.filter(seat=>seat.studentId).map(seat=>[seat.id,seat.studentId])),plain(seatsBefore));
assert.equal(classItem.drawState.remainingIds.length,deckBefore.length-1);
assert.ok(!classItem.drawState.remainingIds.includes(absentId));
context.updateStudent(classItem.id,absentId,{present:true});
assert.equal(classItem.drawState.remainingIds.length,deckBefore.length);
assert.ok(classItem.drawState.remainingIds.includes(absentId));

// Již vylosovaný student se po návratu do docházky nesmí v témže cyklu objevit podruhé.
const draw=context.performDraw({mode:'single',count:1,noRepeat:true});
const drawnId=draw.selected[0].id;
context.updateStudent(classItem.id,drawnId,{present:false});
context.updateStudent(classItem.id,drawnId,{present:true});
assert.ok(!classItem.drawState.remainingIds.includes(drawnId));

// Regrese S2: nepřítomný člen uzamčené skupiny nesmí shodit přelosování.
classItem=freshClass(12);
context.generateGroups({mode:'size',value:4,smartMode:'random'});
classItem.currentGroups[0].locked=true;
const lockedAbsentId=classItem.currentGroups[0].studentIds[0];
context.updateStudent(classItem.id,lockedAbsentId,{present:false});
assert.doesNotThrow(()=>context.rerollUnlockedGroups());
assert.equal(classItem.currentGroups.flatMap(group=>group.studentIds).length,11);
assert.ok(!classItem.currentGroups.flatMap(group=>group.studentIds).includes(lockedAbsentId));

// Regrese S3: last-good je skutečně předchozí stav.
storage.clear();storage.failWrites=false;storage.failKey=null;App.data=context.defaultData();
context.saveData({render:false,event:'first'});
const firstSnapshot=storage.getItem(DATA_KEY);
App.data.aliases.test='změna';
context.saveData({render:false,event:'second'});
assert.equal(storage.getItem(LAST_GOOD_KEY),firstSnapshot);
assert.notEqual(storage.getItem(DATA_KEY),storage.getItem(LAST_GOOD_KEY));

// Selže-li zápis bezpečné kopie, primární stav se nesmí přepsat bez možnosti návratu.
const protectedPrimary=storage.getItem(DATA_KEY);
storage.failKey=LAST_GOOD_KEY;
App.data.aliases.test='další změna';
context.saveData({render:false,event:'last-good-write-failure'});
assert.equal(storage.getItem(DATA_KEY),protectedPrimary);
storage.failKey=null;

// Úložiště blokované zásadou prohlížeče se nehlásí jako dostupné.
const workingStorage=context.window.localStorage;
context.window.localStorage={get length(){throw new Error('Storage blocked')}};
assert.equal(context.safeStorage(),null);
context.window.localStorage=workingStorage;

// Regrese S4: plná kvóta nesmí zabránit čtení ani odstranění starých dat.
storage.setItem(DATA_KEY,'stará-data');
storage.setItem(LAST_GOOD_KEY,'stará-záloha');
storage.setItem(RECOVERY_KEY,'stará-obnova');
storage.setItem(CORRUPT_KEY,'starý-poškozený-zápis');
storage.failWrites=true;
assert.equal(context.safeStorage(),storage);
context.clearAllData();
assert.equal(storage.getItem(LAST_GOOD_KEY),null);
assert.equal(storage.getItem(RECOVERY_KEY),null);
assert.equal(storage.getItem(CORRUPT_KEY),null);
assert.equal(App.data.classes.length,0);
assert.equal(App.storageError?.quotaExceeded,true);
storage.failWrites=false;

// Regrese S9: checksum se ověřuje nad daty přesně tak, jak jsou v souboru.
const legacyData={schema:'sortio-data-v4',version:4,selectedClassId:null,classes:[],aliases:{legacy:'Ano'}};
const legacyPayload={schema:'sortio-backup-v1',data:legacyData,integrity:{checksum:context.checksumText(JSON.stringify(legacyData))}};
assert.doesNotThrow(()=>context.validateBackupPayload(legacyPayload));
legacyPayload.data.aliases.legacy='Změněno';
let mismatch=null;
try{context.validateBackupPayload(legacyPayload)}catch(error){mismatch=error}
assert.equal(mismatch?.code,'BACKUP_CHECKSUM_MISMATCH');
assert.doesNotThrow(()=>context.validateBackupPayload(legacyPayload,{allowChecksumMismatch:true}));

console.log('[domain] Produkční parser, skupiny, docházka, losovací cyklus, sezení a odolnost dat prošly.');
