import assert from 'node:assert/strict';
function fairPick(stats){const min=Math.min(...stats.map(x=>x.count));return stats.filter(x=>x.count===min)}
function coverage(counts){const touched=counts.filter(x=>x>0).length;return{touched,total:counts.length,percent:counts.length?Math.round(touched/counts.length*100):0}}
function timerRemaining(endsAt,now){return Math.max(0,Math.ceil((endsAt-now)/1000))}
assert.deepEqual(fairPick([{id:'a',count:2},{id:'b',count:0},{id:'c',count:0}]).map(x=>x.id),['b','c']);
assert.deepEqual(coverage([1,0,2,1]),{touched:3,total:4,percent:75});
assert.equal(timerRemaining(61000,1000),60);assert.equal(timerRemaining(1000,2000),0);
const privateProjectionKeys=['groupLevel','frontPreference','groupRules','pins'];
const projectionSource=await import('node:fs/promises').then(fs=>fs.readFile(new URL('../src/js/85-projection.js',import.meta.url),'utf8'));
for(const key of privateProjectionKeys)assert.equal(projectionSource.includes(key),false,`Projekce nesmí používat ${key}`);
console.log('[package4] Spravedlivý výběr, pokrytí, časovač a oddělení projekčního režimu prošly.');
