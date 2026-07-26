const SORTIO_OUTPUT_BY_EVENT=Object.freeze({
  class_import:'class-import',
  groups_generate:'grouping',
  groups_reroll:'grouping',
  seating_assign:'seating-plan',
  seating_rotate:'seating-plan',
  roles_assign:'roles'
});
function recordEvent(kind,detail={}){
  const outputKind=SORTIO_OUTPUT_BY_EVENT[kind];
  if(!outputKind)return false;
  try{return window.GHRABTelemetry?.recordOutput({outputKind,attemptedQuantity:1,successfulQuantity:1,failedQuantity:0,outcome:'success',metadata:{route:App.route,...detail}})??false}catch(error){console.warn('SORTIO telemetry unavailable',error);return false}
}
function studioAccessRole(){return window.__GHRAB_STUDIO_ACCESS__?.permit?.role||'teacher'}
