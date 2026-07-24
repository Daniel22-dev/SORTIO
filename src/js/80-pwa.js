let deferredInstall=null;
function refreshPwaInstallUi(){
  const card=$('#installPwaCard');
  if(card)card.hidden=!deferredInstall;
}
window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();
  deferredInstall=event;
  refreshPwaInstallUi();
});
window.addEventListener('appinstalled',()=>{
  deferredInstall=null;
  refreshPwaInstallUi();
  toast('SORTIO bylo nainstalováno.','success');
});
async function installPwa(){
  if(!deferredInstall)return false;
  const prompt=deferredInstall;
  prompt.prompt();
  const choice=await prompt.userChoice;
  deferredInstall=null;
  refreshPwaInstallUi();
  return choice?.outcome==='accepted';
}
function bindPwaInstall(){
  $('#installPwaButton')?.addEventListener('click',async()=>{
    try{
      const installed=await installPwa();
      if(!installed)toast('Instalace nebyla dokončena.','info');
    }catch(error){captureError(error,'pwa-install');toast('Instalaci se nepodařilo spustit.','error')}
  });
  refreshPwaInstallUi();
}
function registerServiceWorker(){
  if('serviceWorker'in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(error=>captureError(error,'service-worker'));
}
