let sortioCentralGroupsPromise=null;
let sortioCentralGroupsLoaderBound=false;
const SORTIO_CENTRAL_GROUP_ACTIONS=new Set(['central-link','central-update','central-unlink','central-migrate','central-preview','central-apply']);
function loadSortioCentralGroups(){
  if(globalThis.__SORTIO_CENTRAL_GROUPS__){globalThis.__SORTIO_CENTRAL_GROUPS__.bind?.();return Promise.resolve(globalThis.__SORTIO_CENTRAL_GROUPS__)}
  if(sortioCentralGroupsPromise)return sortioCentralGroupsPromise;
  sortioCentralGroupsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL('./lazy/central-groups.js',location.href).href;
    script.async=true;script.dataset.sortioLazy='central-groups';
    script.onload=()=>{const api=globalThis.__SORTIO_CENTRAL_GROUPS__;if(api?.bind){api.bind();resolve(api)}else reject(new Error('Napojení Moje skupiny se nepodařilo inicializovat.'))};
    script.onerror=()=>reject(new Error('Napojení Moje skupiny se nepodařilo načíst.'));
    document.head.appendChild(script);
  }).catch(error=>{sortioCentralGroupsPromise=null;throw error});
  return sortioCentralGroupsPromise;
}
function renderCentralGroupStatus(classItem){
  if(!classItem)return'';
  if(classItem.sourceGroupId){const synced=classItem.lastSyncedAt?formatDateTime(classItem.lastSyncedAt):'zatím neproběhla';return`<section class="central-sync-card linked"><div><span>MOJE SKUPINY · NAPOJENO</span><h3>${escapeHtml(classItem.name)}</h3><p>Centrální revize <b>${Number(classItem.lastSyncedRevision)||'—'}</b> · poslední synchronizace ${escapeHtml(synced)}. Docházka, losování, role, pravidla, zasedací pořádek a historie zůstávají pouze v SORTIO.</p></div><div><button class="small-button" data-action="central-update">Aktualizovat ze Studia</button><button class="small-button ghost" data-action="central-unlink">Odpojit</button></div></section>`}
  return`<section class="central-sync-card"><div><span>MOJE SKUPINY · VOLITELNÉ NAPOJENÍ</span><h3>Centrální členství bez e-mailů</h3><p>Napojte tuto lokální třídu na kanonickou skupinu v AI Studiu. Ruční import z IS zůstává jako fallback.</p></div><div><button class="small-button" data-action="central-link">Načíst z Moje skupiny</button>${classStudents(classItem).length?'<button class="small-button ghost" data-action="central-migrate">Přenést tuto třídu do Studia</button>':''}</div></section>`;
}
function bindCentralGroupsUi(){
  if(sortioCentralGroupsLoaderBound)return;sortioCentralGroupsLoaderBound=true;
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-action]');if(!button||!SORTIO_CENTRAL_GROUP_ACTIONS.has(button.dataset.action)||globalThis.__SORTIO_CENTRAL_GROUPS__)return;
    event.preventDefault();
    void loadSortioCentralGroups().then(()=>button.click()).catch(error=>{captureError(error,'central-groups-lazy');toast('Napojení Moje skupiny se nepodařilo načíst. Ruční import z IS zůstává dostupný.','error')});
  });
}
