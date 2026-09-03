#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('.');
const failures=[];
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const json=(p)=>JSON.parse(read(p));
const expect=(ok,msg)=>{if(!ok)failures.push(msg)};
const pkg=json('package.json');
expect(pkg.version==='1.0.16','package version není 1.0.16');
const dep=json('src/config/deployment.json');
expect(dep.sharedAccessVersion==='access-p1-20260824175535Z-k_wtm7Zj','produkční sharedAccessVersion není synchronizována');
expect(dep.authMode==='signed-permit','produkční authMode není signed-permit');
expect(dep.access?.maxOfflineAgeHours===24,'produkční offline LKG limit není 24 h');
expect(dep.access?.maxSignedBundleAgeDays===30,'produkční signed bundle limit není 30 dní');
expect(dep.access?.failClosedWhenStale===true,'produkční stale konfigurace není fail-closed');
const school=json('src/config/deployment.school-server.json');
expect(school.sharedAccessVersion===dep.sharedAccessVersion,'school-server sharedAccessVersion driftuje');
expect(school.authMode==='server-session','school-server authMode není server-session');
expect(school.features?.allowLocalProviderKeys===false,'school-server dovoluje lokální provider klíče');
expect(school.access?.maxOfflineAgeHours===0&&school.access?.maxSignedBundleAgeDays===0,'school-server nesmí používat offline signed-bundle fallback');
const deploymentProfiles=fs.readdirSync(path.join(root,'src/config')).filter(name=>name.startsWith('deployment')&&name.endsWith('.json'));
for(const name of deploymentProfiles){
 const profile=json(`src/config/${name}`);
 expect(profile.aiTransport==='not-applicable',`${name}: SORTIO nesmí distribuovat aktivní AI transport (${profile.aiTransport})`);
 expect(profile.features?.allowLocalProviderKeys===false,`${name}: lokální provider klíče musí být zakázány`);
}
expect(!fs.existsSync(path.join(root,'src/config/deployment.school-server-p0.json')),'zůstal obsolete school-server-p0 profil');
const config=read('src/access/deployment-config.js');
expect(config.includes('environmentId: "configuration-unavailable"'),'fallback nemá configuration-unavailable');
expect(config.includes('authMode: "disabled"'),'fallback nezakazuje auth');
expect(config.includes('strategy: "fail-closed"'),'fallback není fail-closed');
expect(!config.includes('github-pages-fallback')&&!config.includes('p0-fallback'),'zůstal fail-open GitHub fallback');
const storageSource=read('src/js/20-state-storage.js');
expect(storageSource.includes('validateUniqueBackupIdentifiers'),'importní hranice nekontroluje unikátnost interních ID');
expect(storageSource.includes('BACKUP_DUPLICATE_IDENTIFIER'),'chybí fail-closed chyba pro duplicitní interní ID');
expect(storageSource.includes('sanitizeData(raw,{repairDuplicateIdentifiers:true})'),'loadData neopravuje kolize interních ID na persistentní cestě');
expect(storageSource.includes('uniqueIdentifier'),'chybí deterministická deduplikace interních ID');
const testScript=String(pkg.scripts?.test||'');
const p5ciScript=String(pkg.scripts?.['qa:p5:ci']||'');
for(const required of ['test:garp-hostile-render','test:garp-canary']){
 expect(testScript.includes(required),`npm test nespouští ${required}`);
 expect(p5ciScript.includes(required),`qa:p5:ci nespouští ${required}`);
}
const hostileHarness=read('scripts/garp-hostile-render.mjs');
expect(hostileHarness.includes('function hasPageTarget')&&hostileHarness.includes('waitJson(`http://127.0.0.1:${debugPort}/json`,hasPageTarget)'), 'hostile-render harness nečeká na vznik page CDP targetu');
const initSource=read('src/js/99-init.js');
expect(initSource.includes("addEventListener('storage'"),'chybí cross-tab storage listener');
expect(initSource.includes('event.key!==DATA_KEY'),'cross-tab listener neomezuje změny na primární DATA_KEY');
expect(initSource.includes('App.data=loadData()'),'cross-tab listener po změně nenačítá aktuální stav');
for(const page of ['src/index.template.html','src/manual/index.html','src/tests/index.html']){
 const text=read(page);
 expect(text.includes('permitAllowsApp'),`${page}: chybí ověření permitu`);
 expect(text.includes('ghrab:app-access-granted'),`${page}: chybí zachycení permitu z centrální brány`);
 expect(text.includes('__STATIC_CSP__'),`${page}: chybí build-time CSP token`);
 expect(text.includes('frameContextIsAllowed'),`${page}: chybí same-origin frame guard`);
}
const sw=read('src/sw.js');
const core=(sw.match(/const CORE\s*=\s*\[([\s\S]*?)\];/)||[])[1]||'';
expect(!/config\/deployment(?:\.[^"']+)?\.json/.test(core),'service worker precache obsahuje deployment konfiguraci');
expect(/\^config\\\/deployment/.test(sw),'service worker nemá deployment JSON mezi runtime-only cestami');
const securityHeaders=json('src/config/security-headers.json');
const template=read('src/index.template.html');
expect(template.includes('content="__STATIC_CSP__"'),'index template nepoužívá build-time CSP token');
expect(template.includes('frameContextIsAllowed'),'index template nemá same-origin frame guard');
expect(!/frame-ancestors/i.test(securityHeaders.staticProfile?.contentSecurityPolicy||''),'meta CSP nesmí předstírat podporu frame-ancestors');
if(fs.existsSync(path.join(root,'dist/index.html'))){
 const distHtml=read('dist/index.html');
 const escaped=securityHeaders.staticProfile.contentSecurityPolicy.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 expect(new RegExp(`http-equiv=["']Content-Security-Policy["'][^>]*content=["']${escaped}["']`,'i').test(distHtml),'dist/index.html nevynucuje CSP ze security-headers.json');
 expect(!distHtml.includes('__STATIC_CSP__'),'dist obsahuje nevyplněný CSP token');
 for(const page of ['dist/manual/index.html','dist/tests/index.html']){
  const pageText=read(page);
  expect(new RegExp(`http-equiv=["']Content-Security-Policy["'][^>]*content=["']${escaped}["']`,'i').test(pageText),`${page}: nevynucuje CSP ze security-headers.json`);
  expect(!pageText.includes('__STATIC_CSP__'),`${page}: zůstal nevyplněný CSP token`);
  expect(pageText.includes('frameContextIsAllowed'),`${page}: chybí frame guard`);
 }
 expect(!fs.existsSync(path.join(root,'dist/config/deployment.school-server-p0.json')),'dist obsahuje obsolete school-server-p0 profil');
}
for(const dirent of fs.readdirSync(path.join(root,'.github/workflows'))){
 if(!dirent.endsWith('.yml')&&!dirent.endsWith('.yaml'))continue;
 const text=read(`.github/workflows/${dirent}`);
 for(const m of text.matchAll(/uses:\s*([^@\s]+)@([^\s#]+)/g)){
  expect(/^[0-9a-f]{40}$/i.test(m[2]),`${dirent}: ${m[1]} není připnuto na 40znakový SHA (${m[2]})`);
 }
}
if(failures.length){console.error(JSON.stringify({schema:'garp-sortio-security-regressions-v1',status:'failed',failures},null,2));process.exit(1)}
console.log(JSON.stringify({schema:'garp-sortio-security-regressions-v1',status:'passed',version:pkg.version,checks:['fail-closed deployment','permit-before-unlock','signed config age/version','service-worker runtime configuration exclusion','all deployment profiles no AI/local provider keys','effective CSP/frame guard','cross-tab storage reload','duplicate import ID rejection','persistent ID collision repair','automated hostile-render/canary gates','hostile-render CDP target readiness','GitHub Actions SHA pins']},null,2));
