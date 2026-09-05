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
