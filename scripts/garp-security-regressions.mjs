#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('.');
const failures=[];
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const json=(p)=>JSON.parse(read(p));
const expect=(ok,msg)=>{if(!ok)failures.push(msg)};
const pkg=json('package.json');
expect(pkg.version==='1.0.13','package version není 1.0.13');
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
const config=read('src/access/deployment-config.js');
expect(config.includes('environmentId: "configuration-unavailable"'),'fallback nemá configuration-unavailable');
expect(config.includes('authMode: "disabled"'),'fallback nezakazuje auth');
expect(config.includes('strategy: "fail-closed"'),'fallback není fail-closed');
expect(!config.includes('github-pages-fallback')&&!config.includes('p0-fallback'),'zůstal fail-open GitHub fallback');
for(const page of ['src/index.template.html','src/manual/index.html','src/tests/index.html']){
 const text=read(page);
 expect(text.includes('permitAllowsApp'),`${page}: chybí ověření permitu`);
 expect(text.includes('ghrab:app-access-granted'),`${page}: chybí zachycení permitu z centrální brány`);
}
const sw=read('src/sw.js');
const core=(sw.match(/const CORE\s*=\s*\[([\s\S]*?)\];/)||[])[1]||'';
expect(!/config\/deployment(?:\.[^"']+)?\.json/.test(core),'service worker precache obsahuje deployment konfiguraci');
expect(/\^config\\\/deployment/.test(sw),'service worker nemá deployment JSON mezi runtime-only cestami');
for(const dirent of fs.readdirSync(path.join(root,'.github/workflows'))){
 if(!dirent.endsWith('.yml')&&!dirent.endsWith('.yaml'))continue;
 const text=read(`.github/workflows/${dirent}`);
 for(const m of text.matchAll(/uses:\s*([^@\s]+)@([^\s#]+)/g)){
  expect(/^[0-9a-f]{40}$/i.test(m[2]),`${dirent}: ${m[1]} není připnuto na 40znakový SHA (${m[2]})`);
 }
}
if(failures.length){console.error(JSON.stringify({schema:'garp-sortio-security-regressions-v1',status:'failed',failures},null,2));process.exit(1)}
console.log(JSON.stringify({schema:'garp-sortio-security-regressions-v1',status:'passed',version:pkg.version,checks:['fail-closed deployment','permit-before-unlock','signed config age/version','service-worker runtime configuration exclusion','school-server no local provider keys','GitHub Actions SHA pins']},null,2));
