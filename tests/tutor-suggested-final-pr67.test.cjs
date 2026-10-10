const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ux=read('tests/tutor-conclusion-ux-pr67.test.cjs');
const {view,element}=new Function('require','__dirname',ux.split('\nfor(const level')[0]+'\nreturn {view,element};')(require,__dirname);
const ts=read('tests/tutor-transversales.test.cjs');
const {mounted}=new Function('require','__dirname',ts.split('\ntest(')[0]+'\n'+ts.slice(ts.indexOf('function mounted('),ts.indexOf("test('Embedded Tutor"))+'\nreturn {mounted};')(require,__dirname);
function setup(suggestion='A',opts={}){
 const v=view({saved:false,...opts});v.data.resultados[v.s.id].tic.resumen.sugerencia=suggestion;
 const box=element('div'),api=v.f.c.window.IETransversales.editor(box,v.data,v.s.ctx,true);
 const apply=()=>box.querySelectorAll('button').find(b=>b.textContent==='Aplicar sugeridos a Final');
 const grade=()=>box.querySelectorAll('select').find(e=>e.attributes['aria-label']==='Calificación final o aporte');
 return {...v,box,api,apply,grade};
}
for(const bim of ['III','IV'])test('Initial open '+bim+' precedes first classroom request and manual history remains selected',async()=>{
 const calls=[];const m=mounted(async body=>{calls.push(body);if(body.action==='loadtransversalesaulas')return {ok:true,aulas:['2|A'],periodos:{bimestres:{I:'cerrado',II:'cerrado',III:bim==='III'?'abierto':'bloqueado',IV:bim==='IV'?'abierto':'bloqueado'}}};return {ok:false,error:'Synthetic closed view'};});
 await m.controller.ready;assert.equal(calls[1].bimestre,bim);m.el('transBim').value='I';await m.el('transBim').onchange();assert.equal(calls.at(-1).bimestre,'I');assert.equal(m.el('transBim').value,'I');
});
test('No open period selects I without fabricating editing permission',async()=>{
 const calls=[];const m=mounted(async body=>{calls.push(body);if(body.action==='loadtransversalesaulas')return {ok:true,aulas:['2|A'],periodos:{bimestres:{I:'cerrado',II:'cerrado',III:'bloqueado',IV:'bloqueado'}}};const data=m.server.load('math');data.abierto=false;return data;});await m.controller.ready;assert.equal(calls[1].bimestre,'I');assert.match(m.el('transStatus').textContent,/Solo lectura/);assert.equal(m.el('transRows').querySelectorAll('button').find(b=>b.textContent==='Aplicar sugeridos a Final').disabled,true);
});
test('Canonical EPT short header preserves complete tooltip',()=>{const v=view({saved:false});v.data.areas=['Educación para el Trabajo (EPT)'];const box=element('div');v.f.c.window.IETransversales.editor(box,v.data,v.s.ctx,true);const h=box.querySelectorAll('th').find(h=>h.textContent==='EPT');assert.equal(h.title,'Educación para el Trabajo (EPT)');});
for(const level of ['AD','A','B','C'])test('Apply '+level+' only to pending active competence as draft, without writes or snapshots',()=>{
 const v=setup(level),before=v.s.state.writes;v.apply().onclick();assert.equal(v.grade().value,level);assert.equal(v.api.dirty(),true);assert.equal(v.requests.length,0);assert.equal(v.s.state.writes,before);assert.equal(v.data.resultados[v.s.id].tic.final,null);
 v.box.querySelectorAll('button').find(b=>b.dataset.competence==='autonomia').onclick();assert.equal(v.grade().value,'');v.box.querySelectorAll('button').find(b=>b.dataset.competence==='tic').onclick();assert.equal(v.grade().value,level);
 if(level==='C'){const field=v.box.querySelectorAll('textarea').find(e=>e.placeholder==='Conclusión descriptiva');assert.equal(field.value,'');assert.equal(field.maxLength,2000);}assert.equal(v.box.querySelectorAll('button').find(b=>b.dataset.process).disabled,true);
});
for(const level of ['AD','A','B','C'])test('Apply preserves existing Tutor '+level+' decision',()=>{const v=setup('A',{saved:true,level});v.apply().onclick();assert.equal(v.grade().value,level);assert.equal(v.api.dirty(),false);assert.equal(v.requests.length,0);});
for(const suggestion of [null,'','INVALID'])test('No valid suggestion leaves Final pending: '+suggestion,()=>{const v=setup(suggestion);v.apply().onclick();assert.equal(v.grade().value,'');assert.equal(v.api.dirty(),false);assert.equal(v.requests.length,0);});
test('Tie without suggestion remains manual',()=>{const v=setup(null);v.data.resultados[v.s.id].tic.resumen.empate=true;v.apply().onclick();assert.equal(v.grade().value,'');assert.ok(v.box.querySelectorAll('summary').some(e=>e.textContent==='Justificación · Obligatoria'));});
test('Dispersion retains mandatory justification after apply',()=>{const v=setup('A');v.data.resultados[v.s.id].tic.resumen.dispersion=true;v.apply().onclick();assert.ok(v.box.querySelectorAll('summary').some(e=>e.textContent==='Justificación · Obligatoria'));});
test('Manual exception survives repeated apply and remains justified',()=>{const v=setup('B');v.apply().onclick();const grade=v.grade();grade.value='A';grade.onchange();v.apply().onclick();assert.equal(v.grade().value,'A');assert.ok(v.box.querySelectorAll('summary').some(e=>e.textContent==='Justificación · Obligatoria'));assert.equal(v.requests.length,0);});
test('Pending draft conclusion and justification survive applying C',()=>{const v=setup('C',{recordOverride:{nivel:'',conclusion:'Retained text',justificacion:'Retained reason'}});v.apply().onclick();assert.equal(v.box.querySelectorAll('textarea').find(e=>e.placeholder==='Conclusión descriptiva').value,'Retained text');assert.equal(v.box.querySelectorAll('textarea').find(e=>e.placeholder==='Justificación de la decisión del Tutor').value,'Retained reason');});
test('Apply, explicit save and official send are separate actions',async()=>{const v=setup('A');v.apply().onclick();assert.equal(v.requests.length,0);await v.box.querySelectorAll('button').find(b=>b.textContent==='Guardar decisión del Tutor').onclick();assert.equal(v.requests.length,1);assert.equal(v.requests[0].action,'savetransversalfinal');assert.equal(v.requests[0].finales[v.s.id].tic.nivel,'A');assert.equal(v.requests[0].finales[v.s.id].autonomia,undefined);assert.equal(v.s.load('math').exportable,false);});
test('Admin has no mass edit button',()=>{const v=setup('A',{role:'admin'});assert.equal(v.apply(),undefined);});
test('Session change blocks applying suggestions',()=>{const v=setup('A');v.f.c.window.IEStudents.validToken=()=> 'changed';v.apply().onclick();assert.equal(v.api.dirty(),false);assert.equal(v.requests.length,0);});
