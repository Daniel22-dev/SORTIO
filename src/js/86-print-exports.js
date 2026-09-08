let sortioPrintExportsPromise=null;
function loadSortioPrintExports(){
  if(globalThis.__SORTIO_PRINT_EXPORTS__)return Promise.resolve(globalThis.__SORTIO_PRINT_EXPORTS__);
  if(sortioPrintExportsPromise)return sortioPrintExportsPromise;
  sortioPrintExportsPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=new URL('./lazy/print-exports.js',location.href).href;
    script.async=true;
    script.dataset.sortioLazy='print-exports';
    script.onload=()=>{const api=globalThis.__SORTIO_PRINT_EXPORTS__;if(api?.printSortioDocument&&api?.downloadSeatingPdf)resolve(api);else reject(new Error('Modul tisku a PDF se nepodařilo inicializovat.'))};
    script.onerror=()=>reject(new Error('Modul tisku a PDF se nepodařilo načíst.'));
    document.head.appendChild(script);
  }).catch(error=>{sortioPrintExportsPromise=null;throw error});
  return sortioPrintExportsPromise;
}
function printSortioDocument(type){return loadSortioPrintExports().then(api=>api.printSortioDocument(type))}
function downloadSeatingPdf(){return loadSortioPrintExports().then(api=>api.downloadSeatingPdf())}
