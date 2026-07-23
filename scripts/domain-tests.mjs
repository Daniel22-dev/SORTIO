import assert from 'node:assert/strict';
function splitImportTokens(raw=''){const text=String(raw).trim();if(!text)return[];return text.split(/[,;\n\r\t ]+/).map(item=>item.trim()).filter(Boolean)}
function parseToken(token){const original=String(token).trim();const at=original.indexOf('@');let local=at>=0?original.slice(0,at):original;if(at>=0&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(original))return{valid:false};local=local.replace(/\+.*/,'').trim().replace(/^mailto:/i,'');const parts=local.split(/[._]+/).filter(Boolean);if(parts.length<2)return{valid:false};const first=parts.shift(),last=parts.join(' ');return{valid:true,key:`${first} ${last}`.toLowerCase()}}
function parse(raw){const seen=new Set(),rows=[],invalid=[];for(const token of splitImportTokens(raw)){const result=parseToken(token);if(!result.valid||seen.has(result.key)){invalid.push(token);continue}seen.add(result.key);rows.push(result.key)}return{rows,invalid}}
function groupLengths(total,{mode='size',value=4}={}){if(total<=0)return[];value=Math.max(2,Number(value)||2);const count=mode==='count'?Math.min(total,value):Math.ceil(total/value);const base=Math.floor(total/count);const extra=total%count;return Array.from({length:count},(_,i)=>base+(i<extra?1:0))}
function components(ids,pairs){const parent=new Map(ids.map(id=>[id,id]));const find=id=>parent.get(id)===id?id:(parent.set(id,find(parent.get(id))),parent.get(id));for(const[a,b]of pairs){const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra)}const out=new Map();for(const id of ids){const root=find(id);if(!out.has(root))out.set(root,[]);out.get(root).push(id)}return[...out.values()]}
function createSeatLayout(template,rows,columns){if(template==='u')return columns+2*(rows-1);if(template==='pairs')return rows*columns*2;return rows*columns}
function adjacent(a,b,template){if(template==='islands')return a.island===b.island;if(template==='pairs'&&a.row===b.row&&a.island===b.island)return true;return Math.abs(a.row-b.row)+Math.abs(a.column-b.column)<=1}
function chooseLeastUsed(candidates,history,role){return [...candidates].sort((a,b)=>history.filter(x=>x.studentId===a&&x.role===role).length-history.filter(x=>x.studentId===b&&x.role===role).length)[0]}
assert.deepEqual(parse('alex.novak@example.com, bara.svobodova@example.com').rows,['alex novak','bara svobodova']);
assert.equal(parse('alex.novak@example.com alex.novak@example.com').rows.length,1);
assert.equal(parse('alex.novak@example.com neplatna-polozka').invalid.length,1);
for(const [total,mode,value] of [[26,'size',4],[25,'count',6],[31,'size',5],[3,'size',2]]){const lengths=groupLengths(total,{mode,value});assert.equal(lengths.reduce((a,b)=>a+b,0),total);assert.ok(Math.max(...lengths)-Math.min(...lengths)<=1)}
assert.deepEqual(components(['a','b','c','d'],[['a','b'],['b','c']]).sort((a,b)=>a.length-b.length),[['d'],['a','b','c']]);
assert.equal(createSeatLayout('rows',4,6),24);assert.equal(createSeatLayout('pairs',4,3),24);assert.equal(createSeatLayout('islands',5,4),20);assert.equal(createSeatLayout('u',4,6),12);
assert.equal(adjacent({row:0,column:0},{row:0,column:1},'rows'),true);assert.equal(adjacent({row:0,column:0,island:1},{row:4,column:5,island:1},'islands'),true);
assert.equal(chooseLeastUsed(['a','b'],[{studentId:'a',role:'Mluvčí'}],'Mluvčí'),'b');
console.log('[domain] Import, rovnoměrné velikosti, komponenty pravidla „spolu“, rotace rolí a geometrie učebny prošly.');
