let sortioSeatingUiPromise=null;
function loadSortioSeatingUi(){
  if(globalThis.__SORTIO_SEATING_UI__){globalThis.__SORTIO_SEATING_UI__.bind?.();return Promise.resolve(globalThis.__SORTIO_SEATING_UI__)}
  if(sortioSeatingUiPromise)return sortioSeatingUiPromise;
  sortioSeatingUiPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('./lazy/seating-ui.js',location.href).href;script.async=true;script.dataset.sortioLazy='seating-ui';
    script.onload=()=>{const api=globalThis.__SORTIO_SEATING_UI__;if(api?.render&&api?.bind){api.bind();resolve(api)}else reject(new Error('Editor zasedacího plánu se nepodařilo inicializovat.'))};
    script.onerror=()=>reject(new Error('Editor zasedacího plánu se nepodařilo načíst.'));document.head.appendChild(script);
  }).catch(error=>{sortioSeatingUiPromise=null;throw error});
  return sortioSeatingUiPromise;
}
function renderSeatingView(){return loadSortioSeatingUi().then(api=>api.render()).catch(error=>{captureError(error,'seating-ui-lazy');toast('Editor zasedacího plánu se nepodařilo načíst.','error')})}
function bindSeatingUi(){}
