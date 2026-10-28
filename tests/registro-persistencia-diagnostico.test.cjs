'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../registro.html'),'utf8');
const start=html.indexOf('function pintarPadronInmediato('),source=html.slice(start,html.indexOf('\n}',start)+2);
function fixture(failure,error,historic=false){
 const calls=[],logs=[],memory={grades:{synthetic:{nivel:'A'}},conclusiones:{synthetic:'Texto ficticio'},asistencia:{synthetic:'P'}};
 const c=vm.createContext({padronBimestre:'II',nivel:'secundaria',bdEstudiantes:null,store:memory,
  ctxBase:()=>({bim:'III'}),registroSoloLectura:()=>false,registroConsultaHistorica:()=>historic,
  guardarTodo:()=>{throw Error('Unexpected save');},console:{warn:(...args)=>logs.push(args)},
  recordarPadron:()=>{calls.push('recordarPadron');if(failure==='recordarPadron')throw error;},
  saveStore:()=>{calls.push('saveStore');if(failure==='saveStore')throw error;},
  llenarAulasPadron:()=>calls.push('aulas'),onContexto:()=>calls.push('contexto'),sincronizarEdicionRegistro:()=>calls.push('edicion'),
  fetch:()=>{throw Error('Network prohibited');}});
 const startHelper=html.indexOf('function errorPadronLocal(');vm.runInContext(html.slice(startHelper,html.indexOf('\n}',startHelper)+2),c);vm.runInContext(source,c);return {c,calls,logs,memory};
}
for(const operation of ['recordarPadron','saveStore'])test(operation+' failure identifies only safe metadata and preserves memory/stop semantics',()=>{
 const e=Object.assign(new Error('PRIVATE synthetic token/storage/student'),{name:'QuotaExceededError',code:22});
 const s=fixture(operation,e),before=JSON.stringify(s.memory),base={synthetic:true};
 assert.throws(()=>s.c.pintarPadronInmediato(base,'III',true),err=>{
  assert.equal(err.code,'LOCAL_STORAGE');assert.equal(err.retryable,true);assert.equal(err.operacion,operation);
  assert.match(err.message,new RegExp(operation));assert.doesNotMatch(err.message,/PRIVATE|libera almacenamiento/);return true;
 });
 assert.deepEqual(s.calls,operation==='recordarPadron'?['recordarPadron']:['recordarPadron','saveStore']);
 assert.equal(JSON.stringify(s.memory),before);assert.equal(s.c.bdEstudiantes,base);
 assert.deepEqual(JSON.parse(JSON.stringify(s.logs)),[['registro.persistencia',{operacion:operation,tipo:'QuotaExceededError',codigo:22}]]);
});
test('unknown exception fields and throwing getters cannot leak data or replace the controlled warning',()=>{
 for(const e of [{name:'PRIVATE',code:'PRIVATE',message:'PRIVATE'},Object.defineProperty({},'name',{get(){throw Error('PRIVATE');}}),null]){
  const s=fixture('saveStore',e);assert.throws(()=>s.c.pintarPadronInmediato({},'III',false),{code:'LOCAL_STORAGE'});
  assert.deepEqual(JSON.parse(JSON.stringify(s.logs)),[['registro.persistencia',{operacion:'saveStore',tipo:'UnknownError',codigo:'UNKNOWN'}]]);
 }
});
test('successful route preserves operation order, rendering and academic data without diagnostics',()=>{
 const s=fixture(),before=JSON.stringify(s.memory);s.c.pintarPadronInmediato({},'III',true);
 assert.deepEqual(s.calls,['recordarPadron','saveStore','aulas','contexto','edicion']);assert.deepEqual(s.logs,[]);assert.equal(JSON.stringify(s.memory),before);
});
test('historical consultation still skips both persistence operations',()=>{
 const s=fixture(null,null,true);s.c.pintarPadronInmediato({},'III',false);
 assert.deepEqual(s.calls,['aulas','contexto','edicion']);assert.deepEqual(s.logs,[]);
});
test('historical comparison normalizes only the exact reviewed diagnostic block',()=>{
 const normalize=(file,s)=>require('./academic-save-modal-boundary.cjs')(file,require('./roster-persistence-boundary.cjs')(file,s));
 const reviewed=normalize('registro.html',source);
 assert.match(reviewed,/No se pudo conservar el padrón local/);
 const mutated=source.replace('try { recordarPadron(base);','try { recordarPadron({});');
 assert.match(normalize('registro.html',mutated),/recordarPadron\(\{\}\)/);
 assert.notEqual(normalize('registro.html',mutated),reviewed);
});
