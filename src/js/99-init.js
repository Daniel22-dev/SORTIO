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
