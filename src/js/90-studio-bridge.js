function recordEvent(kind,detail={}){try{window.GHRABTelemetry?.recordOutput({outputKind:`sortio-${kind}`,attemptedQuantity:1,successfulQuantity:1,failedQuantity:0,outcome:'success',metadata:{route:App.route,...detail}})}catch(error){console.warn('SORTIO telemetry unavailable',error)}}
function studioAccessRole(){return window.__GHRAB_STUDIO_ACCESS__?.permit?.role||'teacher'}
