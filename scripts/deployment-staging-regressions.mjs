import fs from 'node:fs';
import path from 'node:path';
const roots=['dist-deployment','dist-school-server'];
const checks=[];
function check(name,ok,detail=''){checks.push({name,ok:Boolean(ok),detail}); if(!ok) console.error(`FAIL ${name}${detail?`: ${detail}`:''}`);}
for(const root of roots){
  check(`${root}:exists`,fs.existsSync(root));
  check(`${root}:no-tests-dir`,!fs.existsSync(path.join(root,'tests')));
  const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
  check(`${root}:no-tests-link`,!/href=["']\.\/tests\//i.test(index));
  check(`${root}:no-deployment-markers`,!index.includes('SORTIO_INTERNAL_TEST_CENTER_START')&&!index.includes('SORTIO_INTERNAL_TEST_CENTER_END'));
  const manual=fs.readFileSync(path.join(root,'manual','index.html'),'utf8');
  check(`${root}:manual-no-production-tests-route`,!manual.includes('Adresa /tests/ musí skončit bez selhání.'));
}
const failed=checks.filter(x=>!x.ok);
console.log(JSON.stringify({schema:'sortio-deployment-staging-regressions-v1',version:'1.1.21',status:failed.length?'failed':'passed',checks},null,2));
if(failed.length)process.exit(1);
