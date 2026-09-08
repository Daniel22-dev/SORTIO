let sortioMediaLibraryPromise=null;
function loadSortioMediaLibrary(){
  if(globalThis.__SORTIO_MEDIA_LIBRARY__){globalThis.__SORTIO_MEDIA_LIBRARY__.bind?.();return Promise.resolve(globalThis.__SORTIO_MEDIA_LIBRARY__)}
  if(sortioMediaLibraryPromise)return sortioMediaLibraryPromise;
  sortioMediaLibraryPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=new URL('./lazy/media-library.js',location.href).href;script.async=true;script.dataset.sortioLazy='media-library';
    script.onload=()=>{const api=globalThis.__SORTIO_MEDIA_LIBRARY__;if(api?.open&&api?.bind){api.bind();resolve(api)}else reject(new Error('Knihovnu obrázků se nepodařilo inicializovat.'))};
    script.onerror=()=>reject(new Error('Knihovnu obrázků se nepodařilo načíst.'));document.head.appendChild(script);
  }).catch(error=>{sortioMediaLibraryPromise=null;throw error});
  return sortioMediaLibraryPromise;
}
function openMediaLibrary(target='background',widgetId=''){return loadSortioMediaLibrary().then(api=>api.open(target,widgetId)).catch(error=>{captureError(error,'media-library-lazy');toast('Knihovnu obrázků se nepodařilo načíst.','error')})}
function bindMediaLibrary(){}
