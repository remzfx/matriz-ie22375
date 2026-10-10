const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const source=read('tests/transversales.test.cjs');
const {fixture,client}=new Function('require','__dirname',source.split('\ntest(')[0]+'\nreturn {fixture,client};')(require,__dirname);
function element(tag){
 const e={tagName:tag,children:[],style:{},dataset:{},attributes:{},value:'',textContent:'',disabled:false,
  setAttribute(k,v){this.attributes[k]=v;},appendChild(x){x.parentElement=this;this.children.push(x);return x;},
  insertBefore(x,before){x.parentElement=this;this.children.splice(this.children.indexOf(before),0,x);},replaceChildren(){this.children=[];},
  querySelectorAll(tag){return this.children.flatMap(c=>[...(c.tagName===tag?[c]:[]),...c.querySelectorAll(tag)]);}};return e;
}
function view({level='A',conclusion='',role='math',saved=true,complete=true,recordOverride}={}){
 const s=fixture();if(complete)s.complete();if(saved)assert.equal(s.final('math',level,'Synthetic justification',undefined,conclusion).ok,true);
 const f=client(role==='admin'?'admin':'docente'),requests=[];f.c.document.createElement=element;
 f.c.window.IEStudents.fetchJSON=async(url,opts)=>{const {action,token,...body}=JSON.parse(opts.body);requests.push({action,...clone(body)});return clone(s.route(action,role,body));};
 f.run(read('conclusion-suggestions.js'));f.run(read('transversales-client.js'));
 const box=element('div'),data=clone(s.load(role));if(recordOverride!==undefined)data.resultados[s.id].tic.final=clone(recordOverride);const api=f.c.window.IETransversales.editor(box,data,s.ctx,true);
 const rows=()=>box.querySelectorAll('tbody')[0].querySelectorAll('tr');
 const cell=()=>rows()[0].querySelectorAll('td').at(-1);
 const finalControl=()=>rows()[0].querySelectorAll('select').find(x=>x.attributes['aria-label']==='Calificación final o aporte');
 const field=()=>cell().querySelectorAll('textarea')[0];
 const setLevel=value=>{const el=finalControl();el.value=value;el.onchange();};
 const save=()=>box.querySelectorAll('button').find(b=>b.textContent==='Guardar decisión del Tutor').onclick();
 const process=()=>box.querySelectorAll('button').find(b=>b.dataset.process);
 return {s,f,box,data,api,requests,cell,field,setLevel,save,process};
}
for(const level of ['A','B','AD'])test('Tutor FINAL '+level+' renders only No requerida in conclusion column',()=>{
 const v=view({level,conclusion:'Retained historical C text'});
 assert.equal(v.cell().querySelectorAll('p')[0].textContent,'No requerida');
 for(const tag of ['textarea','select','input','label'])assert.equal(v.cell().querySelectorAll(tag).length,0);
 assert.equal(v.api.dirty(),false);assert.equal(v.requests.length,0);
});
test('Tutor C shows required conclusion, quick choices and existing suggestions with max 2000',()=>{
 const v=view({level:'C',conclusion:'Saved C conclusion'});assert.equal(v.field().value,'Saved C conclusion');assert.equal(v.field().maxLength,2000);assert.equal(v.field().disabled,false);
 assert.equal(v.cell().querySelectorAll('label')[0].textContent,'Conclusión descriptiva · Obligatoria');
 const choices=v.cell().querySelectorAll('select')[0].querySelectorAll('option').map(o=>o.textContent);
 assert.ok(choices.includes('No asistió.'));assert.ok(choices.includes('No logró el propósito propuesto.'));assert.ok(choices.includes('No presenta evidencia para evaluar la competencia.'));
 assert.ok(choices.some(x=>x.includes('Necesita acompañamiento')));assert.ok(choices.includes('Escribir tu propia conclusión'));
});
test('Unsaved C text survives switching to A and returns on C without writes',async()=>{
 const v=view({saved:false});v.setLevel('C');v.field().value='Unsaved draft C';v.field().oninput();v.setLevel('A');
 assert.equal(v.field(),undefined);assert.equal(v.cell().querySelectorAll('p')[0].textContent,'No requerida');assert.equal(v.api.dirty(),true);assert.equal(v.requests.length,0);
 v.setLevel('C');assert.equal(v.field().value,'Unsaved draft C');assert.equal(v.requests.length,0);
 v.setLevel('A');await v.save();assert.equal(v.requests[0].action,'savetransversalfinal');assert.equal(v.requests[0].finales[v.s.id].tic.conclusion,'Unsaved draft C');
 assert.equal(v.s.load('math').resultados[v.s.id].tic.final.conclusion,'Unsaved draft C');
});
test('Saved C conclusion survives explicit A save, reloading and returning to C',async()=>{
 const v=view({level:'C',conclusion:'Persistent C text'});v.setLevel('A');assert.equal(v.field(),undefined);
 assert.equal(v.s.load('math').resultados[v.s.id].tic.final.conclusion,'Persistent C text');await v.save();
 const stored=v.s.load('math').resultados[v.s.id].tic.final;assert.equal(stored.nivel,'A');assert.equal(stored.conclusion,'Persistent C text');
 const reloaded=element('div');v.f.c.window.IETransversales.editor(reloaded,clone(v.s.load('math')),v.s.ctx,true);
 const grade=reloaded.querySelectorAll('select').find(e=>e.attributes['aria-label']==='Calificación final o aporte');grade.value='C';grade.onchange();
 assert.equal(reloaded.querySelectorAll('textarea').find(e=>e.placeholder==='Conclusión descriptiva').value,'Persistent C text');
 v.setLevel('C');assert.equal(v.field().value,'Persistent C text');
});
test('Saved C without conclusion keeps official send disabled and handler cannot write',async()=>{
 const v=view({level:'C'}),writes=v.s.state.writes;assert.equal(v.process().disabled,true);await v.process().onclick();
 assert.equal(v.requests.length,0);assert.equal(v.s.state.writes,writes);
});
for(const level of ['A','B','AD'])test('Complete saved '+level+' permits official send without conclusion',async()=>{
 const v=view({level});assert.equal(v.process().disabled,false);await v.process().onclick();
 assert.equal(v.requests.length,1);assert.equal(v.requests[0].action,'procesartransversales');assert.equal(v.s.load('math').exportable,true);
});
for(const level of ['A','B','AD','C'])test('Admin '+level+' is readonly and displays official conclusion only for C',()=>{
 const v=view({level,conclusion:'Official C text',role:'admin'});assert.equal(v.box.querySelectorAll('textarea').length,0);assert.equal(v.cell().querySelectorAll('select').length,0);
 assert.equal(v.cell().querySelectorAll('p').length,level==='C'?1:0);if(level==='C')assert.equal(v.cell().querySelectorAll('p')[0].textContent,'Conclusión del Tutor: Official C text');
 assert.equal(v.requests.length,0);assert.equal(v.api.dirty(),false);
});
test('Presentation changes and tabs do not persist data or generate snapshots',()=>{
 const v=view({level:'C',conclusion:'Kept text'}),before=JSON.stringify(v.s.tables.get('TransversalesProcesado')?.rows||[]),writes=v.s.state.writes;
 v.box.querySelectorAll('button').find(b=>b.dataset.mode==='num').onclick();v.box.querySelectorAll('button').find(b=>b.dataset.mode==='letra').onclick();
 for(const cp of ['autonomia','tic'])v.box.querySelectorAll('button').find(b=>b.dataset.competence===cp).onclick();
 assert.equal(v.field().value,'Kept text');assert.equal(v.api.dirty(),false);assert.equal(v.requests.length,0);assert.equal(v.s.state.writes,writes);assert.equal(JSON.stringify(v.s.tables.get('TransversalesProcesado')?.rows||[]),before);
});
test('Closed C retains text in a disabled editor and cannot write',()=>{
 const v=view({level:'C',conclusion:'Closed retained text'}),box=element('div'),data=clone(v.s.load('math'));data.abierto=false;
 v.f.c.window.IETransversales.editor(box,data,v.s.ctx,true);const field=box.querySelectorAll('textarea').find(e=>e.placeholder==='Conclusión descriptiva');
 assert.equal(field.value,'Closed retained text');assert.equal(field.disabled,true);assert.equal(v.requests.length,0);
});
for(const record of [null,{nivel:''},{nivel:'INVALID'}])test('Tutor without valid FINAL shows pending and cannot send: '+JSON.stringify(record),async()=>{
 const v=view({saved:false,recordOverride:record});assert.equal(v.cell().querySelectorAll('p')[0].textContent,'Pendiente de definir');
 assert.equal(v.cell().querySelectorAll('textarea').length,0);assert.equal(v.cell().querySelectorAll('select').length,0);
 assert.equal(v.api.dirty(),false);assert.equal(v.process().disabled,true);await v.process().onclick();assert.equal(v.requests.length,0);
});
for(const record of [null,{nivel:''},{nivel:'INVALID'}])test('Admin without valid FINAL stays readonly: '+JSON.stringify(record),()=>{
 const v=view({saved:false,role:'admin',recordOverride:record}),row=v.box.querySelectorAll('tbody')[0].querySelectorAll('tr')[0];
 assert.ok(row.querySelectorAll('p').some(p=>p.textContent==='Pendiente'));assert.equal(v.box.querySelectorAll('textarea').length,0);
 assert.equal(v.cell().querySelectorAll('select').length,0);assert.equal(v.api.dirty(),false);assert.equal(v.requests.length,0);
});
for(const level of ['A','B','AD'])test('Draft conclusion survives C to '+level+' and back to C',()=>{
 const v=view({saved:false});v.setLevel('C');v.field().value='Preserved draft text';v.field().oninput();v.setLevel(level);
 assert.equal(v.cell().querySelectorAll('p')[0].textContent,'No requerida');assert.equal(v.field(),undefined);
 v.setLevel('C');assert.equal(v.field().value,'Preserved draft text');assert.equal(v.requests.length,0);
});
