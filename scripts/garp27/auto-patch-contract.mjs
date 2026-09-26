#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','..');
const deploy=fs.readFileSync(path.join(ROOT,'.github/workflows/deploy.yml'),'utf8'),builder=fs.readFileSync(path.join(ROOT,'scripts/build-ai-studio-dispatch.mjs'),'utf8'),release=fs.readFileSync(path.join(ROOT,'scripts/create-pages-release-identity.mjs'),'utf8');
const checks=[
  ['release-integrity',/release-integrity\.json/.test(deploy)],
  ['app-updated',/app-updated/.test(builder)],
  ['live-pass',/live\.status/.test(builder)],
  ['verified-before-dispatch',deploy.indexOf('Verify the live release')>=0&&deploy.indexOf('Dispatch app-updated')>deploy.indexOf('Verify the live release')],
  ['garp27-profile',/garpProfile:\s*'GARP-2\.7'/.test(release)]
];
const failed=checks.filter(x=>!x[1]).length;
console.log(JSON.stringify({classification:'GARP27_AUTO_PATCH_CONTRACT',status:failed?'FAIL':'PASS',liveAutoPatchClaim:false,results:checks.map(([id,pass])=>({id,pass}))},null,2));
process.exit(failed?1:0);
