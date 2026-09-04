#!/usr/bin/env node
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

class LocalStorageMock{constructor(){this.values=new Map()}get length(){return this.values.size}key(i){return [...this.values.keys()][i]??null}getItem(k){return this.values.has(String(k))?this.values.get(String(k)):null}setItem(k,v){this.values.set(String(k),String(v))}removeItem(k){this.values.delete(String(k))}clear(){this.values.clear()}}
const storage=new LocalStorageMock();let counter=0;
const pkg=JSON.parse(readFileSync(path.join(process.cwd(),'package.json'),'utf8'));
const version=pkg.version;
const App={settings:{theme:'dark',motion:true,confirmDestructive:false},data:null,ui:{importNameOrder:'first-last'},route:'classes',lastOperation:'garp-canary',lastError:null,storageError:null,recoveryState:null};
const nowIso=()=>new Date(1788436800000+counter++*1000).toISOString();
const titleCase=value=>String(value||'').trim().split(/([\s-]+)/).map(part=>/[\s-]+/.test(part)?part:part.charAt(0).toUpperCase()+part.slice(1).toLowerCase()).join('');
const normalizeText=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const context={console,Map,Set,Math,Date,Object,Array,String,Number,Boolean,Error,JSON,Blob,App,window:{localStorage:storage},document:{dispatchEvent(){},querySelector(){return null},querySelectorAll(){return[]}},CustomEvent:class{constructor(type,options={}){this.type=type;this.detail=options.detail}},nowIso,titleCase,normalizeText,randomInt:max=>max?counter++%max:0,shuffle:v=>[...v],uid:(prefix='id')=>`${prefix}-${++counter}`,captureError:()=>{},recordEvent:()=>{},downloadText:()=>{},confirm:()=>true,navigator:{onLine:true,language:'cs-CZ',platform:'synthetic'},APP_ID:'sortio',SORTIO_VERSION:version,MODULES:[],studioAccessRole:()=> 'synthetic-auditor',suiteSessionContentWriteAllowed:()=>true,assertSuiteSessionContentWriteAllowed:()=>true,setTimeout,clearTimeout};
vm.createContext(context);
for(const file of ['src/js/20-state-storage.js','src/js/25-data-model.js','src/js/45-import-parser.js','src/js/95-diagnostics.js'])vm.runInContext(readFileSync(path.join(process.cwd(),file),'utf8'),context,{filename:file});
const runId=randomUUID().replaceAll('-','').slice(0,16);
const marker=`GARP-STUDENT-CANARY-SORTIO-${version}-${runId}`;
const email=[`garp.student.canary.${runId}`,'example.invalid'].join('@');
App.data=context.loadData();
const parsed=context.parseImport(email);
assert.equal(parsed.rows.length,1);
const student=context.makeStudent(parsed.rows[0].firstName,parsed.rows[0].lastName);
const persistedMarker=marker;
context.createClass({name:marker,schoolYear:'2026/27',students:[student]});
const storedText=[...storage.values.values()].join('\n');
const backupText=JSON.stringify(context.buildBackupPayload());
const diagnosticText=JSON.stringify(context.diagnosticSnapshot());
const lower=x=>String(x).toLowerCase();
const before={storageMarker:lower(storedText).includes(lower(persistedMarker)),storageEmail:lower(storedText).includes(email),backupMarker:lower(backupText).includes(lower(persistedMarker)),backupEmail:lower(backupText).includes(email),diagnosticMarker:lower(diagnosticText).includes(lower(persistedMarker)),diagnosticEmail:lower(diagnosticText).includes(email)};
context.clearAllData();
const afterText=[...storage.values.values()].join('\n');
const after={storageMarker:lower(afterText).includes(lower(persistedMarker)),storageEmail:lower(afterText).includes(email),remainingKeys:[...storage.values.keys()],classCount:JSON.parse(storage.getItem('sortio.data.v5')).classes.length};
const report={schema:'sortio-garp-canary-sweep-v1',version,syntheticOnly:true,marker:persistedMarker,email,before,after,status:'passed'};
if(!before.storageMarker||before.storageEmail||!before.backupMarker||before.backupEmail||before.diagnosticMarker||before.diagnosticEmail||after.storageMarker||after.storageEmail||after.classCount!==0)report.status='failed';
mkdirSync(path.join(process.cwd(),'test-results'),{recursive:true});writeFileSync(path.join(process.cwd(),'test-results','garp-canary-sweep.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(report.status!=='passed')process.exit(1);
