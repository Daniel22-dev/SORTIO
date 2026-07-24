'use strict';
const SORTIO_VERSION='__APP_VERSION__';
const APP_ID='sortio';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const nowIso=()=>new Date().toISOString();
const uid=(prefix='id')=>`${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`;
const App={version:SORTIO_VERSION,route:'overview',lastOperation:'start',lastError:null,startedAt:nowIso(),settings:{theme:'dark',motion:true,confirmDestructive:true},data:null,ui:{importRows:[],importInvalid:[],importNameOrder:'first-last',studentSearch:'',groupMode:'size',smartGroupMode:'random',groupPanel:'build',seatingPanel:'plan',timer:{duration:300,remaining:300,running:false,endsAt:null},stopwatch:{elapsed:0,running:false,startedAt:null,laps:[]},drawMode:'single',drawCount:2,noRepeat:true,quickResult:null,projectionMode:'auto'}};
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
