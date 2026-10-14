// Allow only the exact approved PR82 context markup/CSS in historical comparisons.
// Runtime tests and visual regressions use raw current source.
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const read=sha=>execFileSync('git',['show',sha+':registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const before=read('c0e7d47b27fdbd9abd138963a93427d797d42971'),approved=read('fb7cd798427227b394764d0713aa716b91e98627');
function context(s){const i=s.indexOf('        <div class="registro-datos-grid">'),j=s.indexOf('        <div class="registro-datos-meta">',i);assert.ok(i>=0&&j>i,'Context block boundaries');return s.slice(i,j);}
const oldContext=context(before),newContext=context(approved);
const rule=s=>s.split('\n').find(l=>l.startsWith('    .registro-datos-grid {'));
const hidden=approved.split('\n').filter(l=>l.includes('/* Ocultar los selectores nativos desde el primer render')||l.startsWith('    .registro-datos-grid #selGrado,')).join('\n')+'\n';
module.exports=s=>{
 s=s.replace(/\r\n/g,'\n');assert.equal(context(s),newContext,'Only approved context structure and events');assert.equal(s.split(newContext).length,2);
 assert.equal(rule(s),rule(approved),'Only approved context grid spacing');assert.equal(s.split(hidden).length,2,'Exactly one approved initial native-select hiding rule');
 assert.equal(s.split(hidden.trimEnd().split('\n').at(-1)).length,2,'Exactly one approved native-select hiding selector');
 return s.replace(newContext,oldContext).replace(rule(approved),rule(before)).replace(hidden,'');
};
