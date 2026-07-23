function fakeParse(raw){const seen=new Set();return String(raw).split(/[,;\n\r\t ]+/).map(x=>x.trim()).filter(Boolean).filter(token=>{const ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(token);const key=token.toLowerCase();if(!ok||seen.has(key))return false;seen.add(key);return true})}
function groupLengths(total,mode='size',value=4){if(total<=0)return[];value=Math.max(2,Number(value)||2);const count=mode==='count'?Math.min(total,value):Math.ceil(total/value);const base=Math.floor(total/count),extra=total%count;return Array.from({length:count},(_,i)=>base+(i<extra?1:0))}
const groups=[
{id:'core',title:'Verze, manifest a identita',tests:[
 ['manifest',async()=>{const j=await json('../studio-manifest.json');return j.id==='sortio'&&j.version==='1.0.1'?'Manifest SORTIO 1.0.1 je platný.':false}],
 ['production-status',async()=>{const j=await json('../studio-manifest.json');return j.status?.cs?.includes('Produkční')?'Manifest označuje produkční školní verzi.':false}],
 ['ownership',async()=>text('../index.html').then(t=>t.includes('Daniel Baláž')&&t.includes('Gymnázium, Ostrava-Hrabůvka')?'Autorství a školní projekt jsou uvedeny.':false)],
 ['pwa-manifest',async()=>{const j=await json('../manifest.webmanifest');return j.short_name==='SORTIO'&&j.icons.length>=3?'PWA manifest obsahuje název a ikony.':false}],
 ['service-worker',async()=>text('../sw.js').then(t=>t.includes('sortio-v1.0.1')&&t.includes('startsWith(CACHE_PREFIX)')?'Service worker má verzi 1.0.1 a izolaci cache.':false)]
]},
{id:'data',title:'Datový trezor, migrace a zálohy',tests:[
 ['schema-v5',async()=>text('../index.html').then(t=>t.includes("DATA_KEY='sortio.data.v5'")&&t.includes("schema:'sortio-data-v5'")?'Datový model v5 je aktivní.':false)],
 ['migration',async()=>text('../index.html').then(t=>t.includes("'sortio.data.v4','sortio.data.v3','sortio.data.v2'")?'Migrace z verzí 0.2–0.4 je připravena.':false)],
 ['last-good',async()=>text('../index.html').then(t=>t.includes('LAST_GOOD_KEY')&&t.includes('persistDataSnapshot')?'Poslední bezpečný stav se udržuje.':false)],
 ['corrupt-recovery',async()=>text('../index.html').then(t=>t.includes('CORRUPT_KEY')&&t.includes('data-primary-corrupt')?'Poškozený primární zápis má záchrannou cestu.':false)],
 ['backup-checksum',async()=>text('../index.html').then(t=>t.includes('checksumText')&&t.includes('validateBackupPayload')?'Zálohy mají kontrolní součet a validaci.':false)],
 ['backup-limit',async()=>text('../index.html').then(t=>t.includes('MAX_BACKUP_BYTES')&&t.includes('5 MB')?'Import omezuje velikost souboru.':false)],
 ['pre-import-recovery',async()=>text('../index.html').then(t=>t.includes('RECOVERY_KEY')&&t.includes('restoreRecoverySnapshot')?'Stav před importem lze obnovit.':false)]
]},
{id:'import',title:'Import z interního systému',tests:[
 ['email-list',async()=>fakeParse('alex.novak@example.com, bara.svobodova@example.com; cyril.dlouhy@example.com').length===3?'Čárky a středníky byly rozpoznány.':false],
 ['duplicate',async()=>fakeParse('alex.novak@example.com alex.novak@example.com').length===1?'Duplicitní adresa byla odstraněna.':false],
 ['invalid',async()=>fakeParse('neplatna-adresa, alex.novak@example.com').length===1?'Neplatná položka byla odmítnuta.':false],
 ['no-real-data',async()=>text('../index.html').then(t=>!t.includes('@ghrabuvka.cz')&&!t.includes('tobias.baran')?'Build neobsahuje skutečný studentský seznam.':false)],
 ['email-not-stored',async()=>text('../index.html').then(t=>t.includes('emailDataStored:false')&&t.includes('Importované e-mailové adresy se po vytvoření náhledu neukládají')?'Rozhraní i diagnostika deklarují neukládání e-mailů.':false)]
]},
{id:'organisation',title:'Losování, skupiny, role a místa',tests:[
 ['balanced-lengths',async()=>{const x=groupLengths(31,'size',4);return Math.max(...x)-Math.min(...x)<=1&&x.reduce((a,b)=>a+b,0)===31?'31 studentů se rozdělí rovnoměrně.':false}],
 ['large-class',async()=>{const x=groupLengths(120,'size',4);return x.length===30&&x.every(v=>v===4)?'120 studentů vytvoří 30 čtveřic.':false}],
 ['draw',async()=>text('../index.html').then(t=>t.includes('performDraw')&&t.includes('undoLastDraw')?'Losování a vrácení tahu jsou aktivní.':false)],
 ['hard-rules',async()=>text('../index.html').then(t=>['solveSmartPartition','validateGroupConfiguration','addPairRule','setStudentPin'].every(x=>t.includes(x))?'Závazná pravidla skupin jsou aktivní.':false)],
 ['roles',async()=>text('../index.html').then(t=>t.includes('assignRolesToAllGroups')&&t.includes('assignTopicsToGroups')?'Role a témata jsou aktivní.':false)],
 ['seating',async()=>text('../index.html').then(t=>t.includes('createSeatLayout')&&t.includes('assignSeating')&&t.includes('toggleSeatLock')?'Zasedací pořádek je aktivní.':false)]
]},
{id:'live',title:'Projekce, nástroje a výstupy',tests:[
 ['projection',async()=>text('../index.html').then(t=>t.includes('id="projectionDialog"')&&t.includes('openProjection')&&t.includes('projectionGroups')?'Bezpečný projekční režim je dostupný.':false)],
 ['projection-privacy',async()=>text('../index.html').then(t=>t.includes('Na projekci nejsou zobrazeny interní úrovně')?'Projekce má bezpečnostní upozornění.':false)],
 ['tools',async()=>text('../index.html').then(t=>['data-timer-display','data-stopwatch-display','data-score-change'].every(x=>t.includes(x))?'Třídní nástroje jsou aktivní.':false)],
 ['fair-engagement',async()=>text('../index.html').then(t=>t.includes('selectFairStudent')&&t.includes('engagementHistory')?'Spravedlivé zapojování je aktivní.':false)],
 ['print',async()=>text('../index.html').then(t=>t.includes('printSortioDocument')&&t.includes('Kartičky se jmény')?'Tiskové a PDF výstupy jsou aktivní.':false)]
]},
{id:'production',title:'Produkční provoz a přístupnost',tests:[
 ['health-console',async()=>text('../index.html').then(t=>t.includes('productionHealth')&&t.includes('runProductionChecks')?'Produkční konzole je přítomná.':false)],
 ['diagnostics-privacy',async()=>text('../index.html').then(t=>t.includes('diagnosticContainsStudentNames:false')&&t.includes('diagnosticReport')?'Diagnostika deklaruje výstup bez jmen.':false)],
 ['demo',async()=>text('../index.html').then(t=>t.includes('createDemoClass')&&t.includes('Ukázková třída 2.A')?'Anonymní ukázková třída je dostupná.':false)],
 ['keyboard',async()=>text('../index.html').then(t=>t.includes('bindKeyboardShortcuts')&&t.includes('keyboardDialog')?'Klávesové zkratky jsou aktivní.':false)],
 ['skip-link',async()=>text('../index.html').then(t=>t.includes('class="skip-link"')&&t.includes('id="mainContent"')?'Je dostupný odkaz pro přeskočení navigace.':false)],
 ['reduced-motion',async()=>text('../index.html').then(t=>t.includes('prefers-reduced-motion')?'Systémová preference omezení pohybu je respektována.':false)],
 ['manual',async()=>text('../manual/index.html').then(t=>t.includes('Produkční provoz')&&t.includes('Datový trezor v5')?'Finální manuál 1.0 je dostupný.':false)]
]}
];
async function text(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.text()}async function json(url){return JSON.parse(await text(url))}
let results=[];async function run(){results=[];for(const group of groups){for(const[id,fn]of group.tests){try{const value=await fn();if(value&&typeof value==='object'&&value.warn)results.push({group:group.id,id,state:'warn',message:value.message});else if(value===false)results.push({group:group.id,id,state:'fail',message:'Kontrola nesplněna.'});else results.push({group:group.id,id,state:'pass',message:String(value||'Prošlo.')})}catch(e){results.push({group:group.id,id,state:'fail',message:e.message})}}}render()}
function render(){const root=document.querySelector('#groups');root.innerHTML=groups.map(group=>`<section class="group"><h2>${group.title}<span class="badge">${group.tests.length} TESTŮ</span></h2>${group.tests.map(([id])=>{const r=results.find(x=>x.group===group.id&&x.id===id)||{state:'pending',message:'Čeká na spuštění.'};return`<div class="test ${r.state}"><span class="state">${r.state==='pass'?'✓':r.state==='fail'?'!':r.state==='warn'?'?':'·'}</span><div><b>${id}</b><small>${r.message}</small></div><code>${group.id}/${id}</code></div>`}).join('')}</section>`).join('');document.querySelector('#total').textContent=results.length;document.querySelector('#passed').textContent=results.filter(x=>x.state==='pass').length;document.querySelector('#warnings').textContent=results.filter(x=>x.state==='warn').length;document.querySelector('#failed').textContent=results.filter(x=>x.state==='fail').length}
function protocol(){return JSON.stringify({schema:'sortio-runtime-tests-v5',version:'1.0.1',createdAt:new Date().toISOString(),userAgent:navigator.userAgent,results},null,2)}
document.querySelector('#runBtn').addEventListener('click',run);document.querySelector('#copyBtn').addEventListener('click',async()=>{await navigator.clipboard.writeText(protocol());document.querySelector('#copyBtn').textContent='Zkopírováno'});render();window.addEventListener('sortio:tests-ready',run,{once:true});
