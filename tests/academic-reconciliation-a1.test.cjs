const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const api=require('../registro-reconcile.js'),fixture=require('./reconcile-fixture.cjs');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),copy=api.copy;
const modelTests=read('tests/registro-academic-model.test.cjs');
const ui=new Function('require','__dirname',modelTests.split("\nfor(const level")[0]+'\nreturn ui;')(require,__dirname);
const backend=new Function('require','__dirname',read('tests/backend-write-auth.test.cjs').split('\nfor (const action')[0]+'\nreturn setup;')(require,__dirname);
const K='secundaria||III||1||A||Comunicación||Competencia||id:1';
const n=(value,ts=1)=>({nota20:value,nivel:value>=14?'A':value>=11?'B':'C',origen:'numero',ts});
function p(field,value,key=K){return {[field]:{[key]:value}};}
for(const field of ['grades','finales','concComp','concArea','asistencia','capsSel']){
 test('A1 '+field+': independent changes merge without timestamps or mutations',()=>{
  const b=p(field,{valor:'base',ts:900}),l=copy(b),r=copy(b);l[field][K+'L']={valor:'local',ts:1};r[field][K+'R']={valor:'remote',ts:10000};
  const before=JSON.stringify([b,l,r]),plan=api.plan(b,l,r),out=plan.resolve();assert.equal(plan.conflicts.length,0);assert.deepEqual(out[field][K+'L'],l[field][K+'L']);assert.deepEqual(out[field][K+'R'],r[field][K+'R']);assert.equal(JSON.stringify([b,l,r]),before);
 });
 test('A1 '+field+': same datum requires explicit choice despite clock skew',()=>{
  const b=p(field,{valor:'base'}),l=p(field,{valor:'local',ts:1}),r=p(field,{valor:'remote',ts:99999});const plan=api.plan(b,l,r);assert.equal(plan.conflicts.length,1);assert.throws(()=>plan.resolve(),/sin resolver/);
  const c=plan.conflicts[0];assert.equal(plan.resolve({[c.path]:'local'})[field][K].valor,'local');assert.equal(plan.resolve({[c.path]:'remote'})[field][K].valor,'remote');
 });
 test('A1 '+field+': deletion versus unchanged base survives; deletion versus edit conflicts',()=>{
  const b=p(field,n(15)),l=p(field,{borrado:true,ts:1}),r=copy(b);assert.equal(api.plan(b,l,r).resolve()[field][K].borrado,true);
  r[field][K]=n(18,999);assert.equal(api.plan(b,l,r).conflicts.length,1);
  assert.equal(api.plan(b,{},b).resolve()[field][K],undefined);
 });
}
test('A1 unknown historical base never infers causal history from timestamps',()=>{
 const plan=api.plan(null,p('finales',n(15,999)),p('finales',n(12,1)));assert.equal(plan.conflicts.length,1);assert.equal(plan.conflicts[0].unknownBase,true);
 assert.equal(api.plan(null,p('finales',n(15)),{}).conflicts.length,0);
});
test('A1 unchanged timestamps and derived letter references do not create conflicts',()=>{
 const b=p('finales',{nivel:'A',nota20:15,origen:'letra',ts:1}),l=p('finales',{nivel:'A',nota20:16,origen:'letra',ts:2});assert.equal(api.plan(b,l,b).conflicts.length,0);assert.ok(api.equal(b,l));
 assert.equal(api.equal(b,p('finales',n(15))),false);assert.equal(api.equal(p('finales',n(14)),p('finales',n(15))),false);
});
test('A1 worked-state deactivation and concurrent evidence edit require explicit choice',()=>{
 const key=K.slice(0,K.lastIndexOf('||')),b={...p('grades',n(15)),competenciasEstado:{[key]:{trabajada:true}}},l=copy(b),r=copy(b);l.competenciasEstado[key]={trabajada:false};r.grades[K]=n(18);
 const plan=api.plan(b,l,r);assert.equal(plan.conflicts.length,1);assert.match(plan.conflicts[0].reason,/desactivada/);const out=plan.resolve({[plan.conflicts[0].path]:'remote'});assert.equal(out.competenciasEstado[key].trabajada,true);assert.equal(out.grades[K].nota20,18);
});
test('A1 sessions and attendance dates merge as sets; empty date context is retained',()=>{
 const session={nivel:'secundaria',bim:'III',grado:1,seccion:'A',area:'Comunicación',comp:'C',capacidad:'Cap',fecha:'2026-10-12'},aula='secundaria||III||1||A';
 const b={sessions:[session],asisFechas:{[aula]:[]}},l=copy(b),r=copy(b);l.sessions.push({...session,fecha:'2026-10-13'});r.sessions.push({...session,fecha:'2026-10-14'});l.asisFechas[aula]=['2026-10-13'];r.asisFechas[aula]=['2026-10-14'];
 const out=api.plan(b,l,r).resolve();assert.equal(out.sessions.length,3);assert.deepEqual(out.asisFechas[aula].sort(),['2026-10-13','2026-10-14']);assert.deepEqual(api.plan(b,b,b).resolve().asisFechas[aula],[]);
 assert.throws(()=>api.plan(null,{sessions:[session,{...session,other:'contradiction'}]},{}),/duplicadas/);
});
test('A1 deleted session versus edited evidence requires a joint choice and never creates orphan notes',()=>{
 const session={nivel:'secundaria',bim:'III',grado:1,seccion:'A',area:'Comunicación',comp:'Competencia',capacidad:'Cap',fecha:'2026-10-12'},key=Object.values(session).join('||')+'||id:1',b={sessions:[session],grades:{[key]:n(15)}},l={sessions:[],grades:{}},r=copy(b);r.grades[key]=n(18);
 const plan=api.plan(b,l,r);assert.equal(plan.conflicts.length,1);const c=plan.conflicts[0],local=plan.resolve({[c.path]:'local'}),remote=plan.resolve({[c.path]:'remote'});assert.equal(local.sessions.length,0);assert.equal(local.grades[key],undefined);assert.equal(remote.sessions.length,1);assert.equal(remote.grades[key].nota20,18);
});
test('A1 deleted attendance date versus new mark requires a joint choice and retains dates when marks prevail',()=>{
 const aula='secundaria||III||1||A',date='2026-10-12',key=aula+'||'+date+'||id:1',b={asisFechas:{[aula]:[date]},asistencia:{}},l={asisFechas:{[aula]:[]},asistencia:{}},r=copy(b);r.asistencia[key]={marca:'P',ts:1};const plan=api.plan(b,l,r);assert.equal(plan.conflicts.length,1);const c=plan.conflicts[0],out=plan.resolve({[c.path]:'remote'});assert.deepEqual(out.asisFechas[aula],[date]);assert.equal(out.asistencia[key].marca,'P');
});
function identityApi(){const c=vm.createContext({});c.window=c;vm.runInContext(read('student-identity.js'),c);vm.runInContext(read('registro-reconcile.js'),c);return c;}
test('A1 stable IDs and old names cannot silently double-count the same student',()=>{
 const c=identityApi(),prefix=K.slice(0,K.lastIndexOf('||')+2),l=p('finales',n(15),prefix+'id:1'),r=p('finales',n(12),prefix+'Alumno Sintético');const groups=c.IERegistroReconcile.identityConflicts(l,r,[{idSiagie:'1',nombre:'Alumno Sintético'}],c.IEStudentIdentity);assert.equal(groups.length,1);
 const plan=api.plan(null,l,r,groups);assert.equal(plan.conflicts.length,1);const out=plan.resolve({[plan.conflicts[0].path]:'remote'});assert.equal(out.finales[prefix+'id:1'],undefined);assert.equal(out.finales[prefix+'Alumno Sintético'].nota20,12);
});
test('A1 homonyms and duplicate official codes are never assigned to an arbitrary identity',()=>{
 const c=identityApi(),prefix=K.slice(0,K.lastIndexOf('||')+2),l=p('grades',n(15),prefix+'id:1');
 for(const [tail,roster] of [['Igual',[{idSiagie:'1',nombre:'Igual'},{idSiagie:'2',nombre:'Igual'}]],['cod:7',[{idSiagie:'1',codigoEstudiante:'7'},{idSiagie:'2',codigoEstudiante:'7'}]]])assert.equal(c.IERegistroReconcile.identityConflicts(l,p('grades',n(12),prefix+tail),roster,c.IEStudentIdentity).length,0);
});
test('A1 historical aliases union without discarding renamed students',()=>{
 const out=api.plan(null,{meta:{studentAliases:{'id:1':['Anterior']}}},{meta:{studentAliases:{'id:1':['Actual']}}}).resolve();assert.deepEqual(out.meta.studentAliases['id:1'],['Anterior','Actual']);
});
test('A1 unsupported historical payload fields are not implicitly deleted by the current form',()=>{
 const remote={legacySyntheticBlock:{texto:'Preserved compatibility'},registroVersion:123},out=api.plan(remote,{},remote).resolve();assert.deepEqual(out.legacySyntheticBlock,remote.legacySyntheticBlock);assert.equal(out.registroVersion,undefined);
});
function client(){
 const f=ui(),c=f.c;let token='synthetic-token';c.getLoginSession=()=>({role:'admin',token});c.CLOUD_API_URL='https://synthetic.invalid';c.IERegistroTransversales=undefined;
 c.renderStudents=c.renderFinales=c.renderAvance=c.renderSesiones=c.renderAsistencia=()=>{};c.informeSiagie=()=>({ok:true});
 c.store.asistencia={};c.store.asisFechas={};c.store.asisFechasEstado={};c.store.academicSync={};c.estudiantes=()=>[];
 let disk,remote={version:1,payload:{}},writes=0,reads=0;const messages=[];c.NOTAS_KEY='synthetic-a1';c.localStorage={getItem:()=>disk?JSON.stringify(disk):null,setItem:(_,raw)=>disk=JSON.parse(raw)};c.toast=m=>messages.push(m);c.saveStore=()=>disk=copy(c.store);
 c.fetchLecturaNube=async()=>{reads++;return {text:async()=>JSON.stringify({ok:true,soportaModeloAcademico:true,identidadAcademica:1,items:[{clave:c.cloudClaveReg(),ts:remote.version,payload:remote.payload}]})}};
 c.fetch=async(url,opt)=>{writes++;const body=JSON.parse(opt.body);assert.equal(body.version,remote.version);remote={version:remote.version+1,payload:copy(body.payload)};remote.payload.meta={...(remote.payload.meta||{}),academicHistory:[]};return {status:200,text:async()=>JSON.stringify({ok:true,version:remote.version,identityHistory:[]})}};
 const b=c.baselineAcademica();b.version=1;b.basePayload=copy(c.sliceRegistroArea());b.baseline=c.IERegistroAcademico.canonical(b.basePayload);remote.payload=copy(b.basePayload);
 const choose=[];c.IERegistroReconcile.choose=async(conflicts)=>{choose.push(copy(conflicts));assert.equal(conflicts.length,0,'Unexpected unresolved conflict');return {};};
 for(const name of ['subirRegistroNube','bajarRegistroNube','recuperarBorradorAcademico'])vm.runInContext(fixture.extract(name),c);
 return {...f,c,b,choose,messages,setToken:v=>token=v,setRemote:v=>remote={...v,version:Math.max(remote.version+1,v.version)},remote:()=>remote,writes:()=>writes,reads:()=>reads,disk:()=>disk};
}
function setLocal(f,cp=f.comps[0],value=15){f.grade(cp,value);}
test('A1 actual client download merges disjoint data and preserves pending local edits',async()=>{
 const f=client();setLocal(f);const remote=copy(f.remote());remote.payload.finales[f.key(f.comps[1])]=n(18);f.setRemote(remote);assert.equal(await f.c.bajarRegistroNube(),true,JSON.stringify(f.messages));assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,15);assert.equal(f.c.store.finales[f.key(f.comps[1])].nota20,18);assert.equal(f.c.dirty,true);assert.equal(f.writes(),0);
});
test('A1 upload retains local values before acknowledgment then applies merged remote values',async()=>{
 const f=client();setLocal(f);const remote=copy(f.remote());remote.payload.finales[f.key(f.comps[1])]=n(18);f.setRemote(remote);const send=f.c.fetch;
 f.c.fetch=async(...args)=>{assert.equal(f.c.store.finales[f.key(f.comps[1])],undefined);assert.equal(f.disk().finales[f.key(f.comps[0])].nota20,15);return send(...args)};
 assert.equal(await f.c.subirRegistroNube(),true);assert.equal(f.writes(),1);assert.equal(f.c.store.finales[f.key(f.comps[1])].nota20,18);assert.equal(f.c.dirty,false);assert.equal(f.b.recovery.local.finales[f.key(f.comps[0])].nota20,15);
});
test('A1 cancellation leaves notes/base intact and never POSTs',async()=>{
 const f=client();setLocal(f);const remote=copy(f.remote());remote.payload.finales[f.key(f.comps[0])]=n(18);f.setRemote(remote);f.c.IERegistroReconcile.choose=async cs=>{assert.equal(cs.length,1);return null};
 const notes=copy(f.c.store.finales),base=copy(f.b.basePayload);assert.equal(await f.c.subirRegistroNube(),false);assert.deepEqual(copy(f.c.store.finales),notes);assert.deepEqual(copy(f.b.basePayload),base);assert.equal(f.writes(),0);
});
test('A1 genuine conflict explicit choice uploads selected value and keeps pre-choice recovery',async()=>{
 const f=client();setLocal(f);const remote=copy(f.remote());remote.payload.finales[f.key(f.comps[0])]=n(18);f.setRemote(remote);f.c.IERegistroReconcile.choose=async cs=>Object.fromEntries(cs.map(c=>[c.path,'remote']));
 assert.equal(await f.c.subirRegistroNube(),true);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,18);assert.equal(f.writes(),0);assert.equal(f.b.recovery.local.finales[f.key(f.comps[0])].nota20,15);
});
test('A1 failed CAS retains causal base, remote additions and local notes on next explicit attempt',async()=>{
 const f=client();setLocal(f);const remote=copy(f.remote());remote.payload.finales[f.key(f.comps[1])]=n(18);f.setRemote(remote);const send=f.c.fetch;let rejected=0;
 f.c.fetch=async()=>{rejected++;const next=copy(f.remote());next.version++;next.payload.finales[f.key(f.comps[2])]=n(16);f.setRemote(next);return {status:200,text:async()=>JSON.stringify({ok:false,code:'CONFLICT'})}};
 assert.equal(await f.c.subirRegistroNube(),false);assert.equal(rejected,1);assert.equal(f.b.basePayload.finales[f.key(f.comps[1])],undefined);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,15);
 f.c.fetch=send;assert.equal(await f.c.subirRegistroNube(),true);assert.equal(f.writes(),1);assert.equal(f.remote().payload.finales[f.key(f.comps[1])].nota20,18);assert.equal(f.remote().payload.finales[f.key(f.comps[2])].nota20,16);
});
test('A1 lost acknowledgment is confirmed by protected read, never repeated automatically',async()=>{
 const f=client();setLocal(f);const send=f.c.fetch;f.c.fetch=async(...args)=>{await send(...args);throw Error('Response lost')};assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.writes(),1);assert.ok(f.b.attempt);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,15);
 f.c.fetch=send;assert.equal(await f.c.subirRegistroNube(),true);assert.equal(f.writes(),1);assert.equal(f.b.attempt,undefined);assert.equal(f.c.dirty,false);
});
test('A1 edits made after a lost acknowledgment survive subsequent reconciliation',async()=>{
 const f=client();setLocal(f);const send=f.c.fetch;f.c.fetch=async(...args)=>{await send(...args);throw Error('Response lost')};await f.c.subirRegistroNube();setLocal(f,f.comps[0],18);f.c.fetch=send;assert.equal(await f.c.subirRegistroNube(),true);assert.equal(f.remote().payload.finales[f.key(f.comps[0])].nota20,18);assert.equal(f.writes(),2);
});
test('A1 edits while upload responds remain local/pending and are not rerendered away',async()=>{
 const f=client();setLocal(f);const send=f.c.fetch;let painted=0;f.c.pintarRegistroConciliado=()=>painted++;f.c.fetch=async(...args)=>{const res=await send(...args);setLocal(f,f.comps[0],18);return res};assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.remote().payload.finales[f.key(f.comps[0])].nota20,15);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,18);assert.equal(f.c.dirty,true);assert.equal(painted,0);
});
test('A1 numeric input not yet blurred during request is captured and never overwritten on acknowledgment',async()=>{
 const f=client();setLocal(f);const send=f.c.fetch;let inputPending=false;f.c.guardarTodo=()=>{if(inputPending){setLocal(f,f.comps[0],18);inputPending=false;}return true};f.c.fetch=async(...args)=>{const res=await send(...args);inputPending=true;return res};assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,18);assert.equal(f.remote().payload.finales[f.key(f.comps[0])].nota20,15);assert.equal(f.c.dirty,true);
});
test('A1 numeric input changed during read causes a safe stop before POST',async()=>{
 const f=client();setLocal(f);let pending=false;f.c.guardarTodo=()=>{if(pending){setLocal(f,f.comps[0],18);pending=false;}return true};const read=f.c.fetchLecturaNube;f.c.fetchLecturaNube=async(...args)=>{const out=await read(...args);pending=true;return out};assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.writes(),0);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,18);
});
test('A1 metadata and special keys remain inert JSON without changing prototypes',()=>{
 const value=JSON.parse('{"meta":{"__proto__":{"synthetic":true}},"grades":{"__proto__":{"valor":"inert"}}}'),out=api.plan(null,value,{}).resolve();assert.equal(out.meta.__proto__.synthetic,true);assert.equal(out.grades.__proto__.valor,'inert');assert.equal({}.synthetic,undefined);
});
for(const kind of ['token','context','local-edit'])test('A1 delayed read discards '+kind+' switch without POST or data overwrite',async()=>{
 const f=client();setLocal(f);const originalKey=f.key(f.comps[0]),read=f.c.fetchLecturaNube;f.c.fetchLecturaNube=async(...args)=>{const out=await read(...args);if(kind==='token')f.setToken('different');if(kind==='context')f.c.areaActual='Comunicación';if(kind==='local-edit')setLocal(f,f.comps[0],18);return out};assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.writes(),0);assert.equal(f.c.store.finales[originalKey].nota20,kind==='local-edit'?18:15);
});
test('A1 double click serializes a single protected read and write',async()=>{
 const f=client();setLocal(f);let release;const wait=new Promise(r=>release=r),read=f.c.fetchLecturaNube;f.c.fetchLecturaNube=async(...args)=>{await wait;return read(...args)};const a=f.c.subirRegistroNube(),b=f.c.subirRegistroNube();release();assert.equal(await a,true);assert.equal(await b,true);assert.equal(f.reads(),1);assert.equal(f.writes(),1);
});
test('A1 unavailable storage stops POST and preserves original local notes',async()=>{
 const f=client();setLocal(f);f.c.saveStore=()=>{throw Error('Quota')};assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.writes(),0);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,15);
});
test('A1 old backend, duplicate records and malformed versions fail closed',async()=>{
 for(const mode of ['old','duplicates','bad-version']){const f=client();setLocal(f);f.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify({ok:true,soportaModeloAcademico:mode!=='old',items:mode==='duplicates'?[{clave:f.c.cloudClaveReg()},{clave:f.c.cloudClaveReg()}]:[{clave:f.c.cloudClaveReg(),ts:'invalid'}]})});assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.writes(),0);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,15);}
});
test('A1 backup restores context only, retains unrelated records, and never sends data',async()=>{
 const f=client();setLocal(f);const remote=copy(f.remote());remote.payload.finales[f.key(f.comps[0])]=n(18);f.setRemote(remote);f.c.IERegistroReconcile.choose=async cs=>Object.fromEntries(cs.map(c=>[c.path,'remote']));await f.c.bajarRegistroNube();f.c.store.finales['other-context']=n(20);
 assert.equal(f.c.recuperarBorradorAcademico(),true);assert.equal(f.c.store.finales[f.key(f.comps[0])].nota20,15);assert.equal(f.c.store.finales['other-context'].nota20,20);assert.equal(f.c.dirty,true);assert.equal(f.writes(),0);
});
test('A1 readonly and closed contexts cannot restore backup or upload',async()=>{
 for(const gate of ['registroSoloLectura','bimCerradoDocente']){const f=client();setLocal(f);f.c[gate]=()=>true;f.c.guardarTodo=()=>false;assert.equal(await f.c.subirRegistroNube(),undefined);assert.equal(f.c.recuperarBorradorAcademico(),false);assert.equal(f.writes(),0);}
});
test('A1 UI and backend retain main B/C Primary and C Secondary conclusions policy',()=>{
 const f=ui('primaria');f.grade(f.comps[0],12);assert.equal(f.c.validarConclusionesOficial(f.c.ctxBase(),f.c.estudiantes(),[]).length,1);const s=backend();assert.equal(s.c.registroAcademico_().requiresConclusion('primaria','B'),true);
 const {execFileSync}=require('node:child_process');for(const file of ['apps-script/Codigo.js','registro-academic-model.js'])assert.equal((file==='apps-script/Codigo.js'?require('./registro-phase1-snapshot.cjs').backend(read(file)):read(file)).replace(/\r\n/g,'\n'),execFileSync('git',['show','2806f4d19afdfc7f5e9967c1a4e04b138088eed0:'+file],{encoding:'utf8'}).replace(/\r\n/g,'\n'));
});
test('A1 synthetic backend CAS rejects concurrent and stale writes without touching historical rows',()=>{
 const s=backend(),ctx={nivel:'secundaria',bimestre:'I',grado:1,seccion:'A',area:'Matemática'},cp=s.c.registroAcademico_().catalog.secundaria[ctx.area][0],key=['secundaria','I',1,'A',ctx.area,cp,'id:1'].join('||'),req={action:'savereg',token:s.secondary,...ctx,modeloAcademico:1,version:0,payload:p('finales',n(15),key)};
 const first=s.post(req);assert.equal(first.ok,true,first.error);req.version=first.version;req.payload.finales[key]=n(18);const second=s.post(req);assert.equal(second.ok,true);const rows=JSON.stringify(s.tables.get('RegistroNotas').rows);req.payload.finales[key]=n(12);assert.equal(s.post(req).code,'CONFLICT');assert.equal(JSON.stringify(s.tables.get('RegistroNotas').rows),rows);assert.equal(s.state.held,false);
});
test('A1 synthetic Comunicación 1A III: 90 grades preserved, genuine conflict resolved, deletion/evidence/conclusions retained',()=>{
 const s=backend();s.docentes[1].asignaciones['Comunicación']=['1|A'];s.docentes[1].areas.push('Comunicación');s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({anio:2026,bimestres:{III:'abierto'}});
 const ctx={nivel:'secundaria',bimestre:'III',grado:1,seccion:'A',area:'Comunicación'},catalog=s.c.registroAcademico_().catalog.secundaria[ctx.area],prefix='secundaria||III||1||A||Comunicación||',base={finales:{},grades:{},concComp:{},concArea:{},sessions:[],meta:{studentAliases:{}}};
 for(let student=1;student<=30;student++)for(const comp of catalog)base.finales[prefix+comp+'||id:synthetic-'+student]=n(15);
 assert.equal(Object.keys(base.finales).length,90);const req={action:'savereg',token:s.token('test-secondary'),...ctx,modeloAcademico:1,version:0,payload:base};const first=s.post(req);assert.equal(first.ok,true,first.error);
 const local=copy(base),remote=copy(base),keys=Object.keys(base.finales);local.finales[keys[0]]=n(8,1);local.concComp[keys[0]]={texto:'Conclusión específica sintética',ts:1};remote.finales[keys[0]]=n(18,999999);remote.finales[keys[1]]=n(16);local.grades[prefix+'Evidence||id:synthetic-1']=n(12);local.concArea[prefix+'id:synthetic-1']={texto:'Historial conservado'};local.finales[keys[2]]={borrado:true,ts:1};
 const next=s.post({...req,version:first.version,payload:remote});assert.equal(next.ok,true,next.error);const plan=api.plan(base,local,remote);assert.equal(plan.conflicts.length,1);const merged=plan.resolve({[plan.conflicts[0].path]:'local'});
 const out=s.post({...req,version:next.version,payload:merged});assert.equal(out.ok,true,out.error);const saved=s.post({action:'loadreg',token:req.token,nivel:'secundaria',bimestre:'III',grado:1,seccion:'A',area:'Comunicación'}).items[0].payload;
 assert.equal(Object.keys(saved.finales).length,90);assert.equal(saved.finales[keys[0]].nota20,8);assert.equal(saved.finales[keys[1]].nota20,16);assert.equal(saved.finales[keys[2]].borrado,true);assert.equal(saved.concComp[keys[0]].texto,'Conclusión específica sintética');assert.equal(saved.grades[prefix+'Evidence||id:synthetic-1'].nota20,12);assert.equal(saved.concArea[prefix+'id:synthetic-1'].texto,'Historial conservado');
});
function wired(){
 const f=client(),s=backend(),c=f.c;s.docentes[1].asignaciones['Comunicación']=['1|A'];s.docentes[1].areas.push('Comunicación');s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({anio:2026,bimestres:{III:'abierto'}});s.c.Utilities.getUuid=()=> 'synthetic-only-uuid';
 const roster=Array.from({length:30},(_,i)=>({nivel:'secundaria',grado:1,seccion:'A',orden:i+1,nombre:'Alumno ficticio '+(i+1),idSiagie:'synthetic-'+(i+1),codigoEstudiante:'s-'+(i+1),estadoMatricula:'DEFINITIVA'}));s.c.escribirVersionEstudiantes_(s.c.hojaEstudiantes_(),roster,['BASE_ACTUAL','PADRON_III']);
 Object.assign(c,{nivel:'secundaria',bim:'III',grado:1,seccion:'A',areaActual:'Comunicación'});c.cloudClaveReg=()=>[c.nivel,c.bim,c.grado,c.seccion,c.areaActual].join('||');c.prefijoReg=()=>c.cloudClaveReg()+'||';c.asisCtxKey=()=>[c.nivel,c.bim,c.grado,c.seccion].join('||');c.estudiantes=()=>roster;c.competencias=()=>s.c.registroAcademico_().catalog.secundaria['Comunicación'];const signed=s.token('test-secondary');c.getLoginSession=()=>({role:'docente',token:signed});
 const base=c.sliceRegistroArea();for(const cp of c.competencias())for(const al of roster)base.finales[c.finalKey(cp,c.studentKey(al))]=n(15);
 const req={action:'savereg',token:c.getLoginSession().token,nivel:c.nivel,bimestre:c.bim,grado:c.grado,seccion:c.seccion,area:c.areaActual,modeloAcademico:1,envioIntegral:true,version:0,payload:base};const seeded=s.post(req);assert.equal(seeded.ok,true,seeded.error);
 c.aplicarRegistroConciliado(base);const b=c.baselineAcademica();b.version=seeded.version;b.basePayload=copy(base);b.baseline=c.IERegistroAcademico.canonical(base);let writes=0;
 c.fetchLecturaNube=async url=>{const params=new URLSearchParams(url.slice(url.indexOf('?')+1));const body=Object.fromEntries(params);body.token=c.getLoginSession().token;return {text:async()=>JSON.stringify(s.post(body))}};
 c.fetch=async(url,opt)=>{writes++;const out=s.post(JSON.parse(opt.body));return {status:200,text:async()=>JSON.stringify(out)}};return {f,s,c,b,base,req,roster,writes:()=>writes};
}
test('A1 real client + simulated Sheets: Comunicación 1A III reconciles and integral server validation succeeds',async()=>{
 const w=wired(),keys=Object.keys(w.base.finales),remote=copy(w.base);w.c.store.finales[keys[0]]=n(8);w.c.store.concComp[keys[0]]={texto:'Conclusión específica ficticia'};remote.finales[keys[0]]=n(18);remote.finales[keys[1]]=n(16);const update=w.s.post({...w.req,version:w.b.version,payload:remote});assert.equal(update.ok,true,update.error);
 w.c.IERegistroReconcile.choose=async cs=>{assert.equal(cs.length,1);return {[cs[0].path]:'local'}};assert.equal(await w.c.subirRegistroNube(),true,w.f.messages.at(-1));assert.equal(w.writes(),1);const stored=w.s.post({action:'loadreg',token:w.req.token,nivel:'secundaria'}).items[0].payload;
 assert.equal(Object.keys(stored.finales).length,90);assert.equal(stored.finales[keys[0]].nota20,8);assert.equal(stored.finales[keys[1]].nota20,16);assert.equal(stored.concComp[keys[0]].texto,'Conclusión específica ficticia');assert.equal(w.c.dirty,false);
});
for(const reject of ['closed','revoked','unauthorized'])test('A1 simulated server '+reject+' retains every local grade and prevents persisted overwrite',async()=>{
 const w=wired(),key=Object.keys(w.base.finales)[0];w.c.store.finales[key]=n(18);const before=JSON.stringify(w.s.tables.get('RegistroNotas').rows);
 if(reject==='closed')w.s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({anio:2026,bimestres:{III:'cerrado'}});
 if(reject==='revoked')w.s.tables.get('DocentesAcceso').rows[1][1]=2000;
 if(reject==='unauthorized'){w.s.docentes[1].asignaciones={'Matemática':['1|A']};w.s.docentes[1].areas=['Matemática'];w.s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(w.s.docentes);}
 if(reject!=='closed'){w.s.state.held=true;w.s.c.CacheService.getScriptCache().remove('IE22375_DOCENTE_ACCESOS_V1');w.s.state.held=false;}assert.equal(await w.c.subirRegistroNube(),false);assert.equal(w.c.store.finales[key].nota20,18);assert.equal(JSON.stringify(w.s.tables.get('RegistroNotas').rows),before);assert.equal(w.s.state.held,false);
});
function dialog(count=1){
 const c=vm.createContext({}),events={};let watch,current=true;c.window=c;c.setInterval=f=>(watch=f,1);c.clearInterval=()=>watch=null;
 const d={activeElement:null,addEventListener:(k,f)=>events[k]=f,removeEventListener:k=>delete events[k]};
 class Node{constructor(tag){this.tag=tag;this.children=[];this.style={};this.attrs={};this.disabled=false;}setAttribute(k,v){this.attrs[k]=v;}appendChild(n){this.children.push(n);return n;}remove(){d.body.children=d.body.children.filter(n=>n!==this);}focus(){d.activeElement=this;}querySelectorAll(){return this.children.flatMap(n=>['input','button','summary'].includes(n.tag)?[n,...n.querySelectorAll()]:n.querySelectorAll());}}
 d.createElement=t=>new Node(t);d.body=new Node('body');c.document=d;vm.runInContext(read('registro-reconcile.js'),c);const conflicts=Array.from({length:count},(_,i)=>({path:JSON.stringify(['finales','id:synthetic'+(i||'')]),local:{nivel:'A',text:'<synthetic-tag>'},remote:{nivel:'B'}}));
 const pending=c.IERegistroReconcile.choose(conflicts,()=>current);const root=d.body.children[0],panel=root.children[0],nodes=panel.querySelectorAll(),radios=nodes.filter(x=>x.tag==='input'),buttons=nodes.filter(x=>x.tag==='button');
 return {c,d,events,root,panel,content:panel.children[1],footer:panel.children[2],radios,apply:buttons[1],cancel:buttons[0],pending,stale:()=>{current=false;watch()},path:conflicts[0].path};
}
test('A1 explicit conflict dialog has no implicit winner and renders data as text, not HTML',async()=>{
 const f=dialog();assert.equal(f.root.attrs['role'],'dialog');assert.equal(f.root.attrs['aria-modal'],'true');assert.equal(f.apply.disabled,true);const pre=f.content.children.find(x=>x.tag==='fieldset').children[1].children[0].children[1].children[1];assert.match(pre.textContent,/<synthetic-tag>/);assert.equal(pre.innerHTML,undefined);
 f.radios[0].onchange();assert.equal(f.apply.disabled,false);f.apply.onclick();assert.equal((await f.pending)[f.path],'local');assert.equal(f.d.body.children.length,0);
});
test('A1 conflict cancel and Escape never resolve or send a selected value',async()=>{
 for(const escape of [false,true]){const f=dialog();f.radios[1].onchange();if(escape)f.events.keydown({key:'Escape',preventDefault(){}});else f.cancel.onclick();assert.equal(await f.pending,null);assert.equal(f.d.body.children.length,0);}
});
test('A1 conflict dialog cancels on context/token/revision change',async()=>{const f=dialog();f.stale();assert.equal(await f.pending,null);});
test('A1 conflict dialog traps keyboard focus within choices and actions',async()=>{
 const f=dialog();let prevented=0;f.apply.disabled=false;f.apply.focus();f.events.keydown({key:'Tab',shiftKey:false,preventDefault(){prevented++}});assert.equal(f.d.activeElement,f.radios[0]);f.events.keydown({key:'Tab',shiftKey:true,preventDefault(){prevented++}});assert.equal(f.d.activeElement,f.apply);assert.equal(prevented,2);f.cancel.onclick();await f.pending;
});
test('A1 worker precaches required reconcile module and cleans prior version without changing private exclusions',()=>{
 const sw=read('sw.js');assert.match(sw,/CACHE_PREFIX \+ 'v29'/);assert.match(sw,/'\.\/registro-reconcile\.js'/);assert.match(read('registro.html'),/<script src="registro-reconcile.js" defer><\/script>/);assert.ok(read('registro.html').indexOf('registro-reconcile.js')<read('registro.html').indexOf('registro-academic-model.js'));
});
const AULA='secundaria||III||1||A',DATE='2026-10-12',MARK=AULA+'||'+DATE+'||id:1';
function attendance(marca,ts=1){return {asistencia:{[MARK]:{marca,hora:'08:00',ts}},asisFechas:{[AULA]:[DATE]},asisFechasEstado:{[AULA+'||'+DATE]:{borrado:false,ts}}};}
for(const field of ['asistencia','asisFechasEstado'])test('A1 shared '+field+' cannot trust unchanged area base over newer classroom data',()=>{
 const l=attendance('P',900),r=attendance('F',1),b=copy(l);if(field==='asisFechasEstado')r.asisFechasEstado[AULA+'||'+DATE]={borrado:false,revision:'remote'};
 const plan=api.plan(b,l,r,[],{sharedAttendance:true});assert.ok(plan.conflicts.some(c=>JSON.parse(c.path)[0]===field));assert.throws(()=>plan.resolve(),/sin resolver/);
 const out=plan.resolve(Object.fromEntries(plan.conflicts.map(c=>[c.path,'local'])));assert.deepEqual(copy(out[field]),l[field]);
});
test('A1 shared absence in another area never removes classroom marks or dates',()=>{
 const local=attendance('P'),out=api.plan(local,local,{},[],{sharedAttendance:true}).resolve();assert.deepEqual(copy(out.asistencia),local.asistencia);assert.deepEqual(out.asisFechas[AULA],[DATE]);assert.deepEqual(copy(out.asisFechasEstado),local.asisFechasEstado);
});
for(const side of ['local','remote'])test('A1 shared deleted date versus active marks requires coherent '+side+' choice',()=>{
 const local=attendance('P',999),remote=attendance('F',1);remote.asisFechas[AULA]=[];remote.asisFechasEstado[AULA+'||'+DATE]={borrado:true,ts:1};remote.asistencia[MARK]={borrado:true,ts:1};
 const plan=api.plan(local,local,remote,[],{sharedAttendance:true});assert.equal(plan.conflicts.length,1);const out=plan.resolve({[plan.conflicts[0].path]:side});assert.deepEqual(out.asisFechas[AULA],side==='local'?[DATE]:[]);assert.equal(out.asistencia[MARK].borrado,side==='remote'?true:undefined);
});
for(const action of ['bajarRegistroNube','subirRegistroNube'])test('A1 actual '+action+' cancels stale other-area attendance without mutating draft/base',async()=>{
 const f=client(),a=f.c.asisCtxKey(),date=DATE,key=a+'||'+date+'||id:1';f.c.store.asistencia[key]={marca:'P',ts:900};f.c.store.asisFechas[a]=[date];f.c.store.asisFechasEstado[a+'||'+date]={borrado:false,ts:900};f.b.basePayload=copy(f.c.sliceRegistroArea());const remote=copy(f.remote());remote.payload=copy(f.b.basePayload);remote.payload.asistencia[key]={marca:'F',ts:1};f.setRemote(remote);
 f.c.IERegistroReconcile.choose=async cs=>{assert.ok(cs.some(c=>JSON.parse(c.path)[0]==='asistencia'));return null};const before=copy(f.c.store);assert.equal(await f.c[action](),false);assert.deepEqual(copy(f.c.store),before);assert.equal(f.writes(),0);
});
test('A1 actual download retains shared attendance changed in another area and other classroom',async()=>{
 const f=client(),a=f.c.asisCtxKey(),key=a+'||'+DATE+'||id:1';f.c.store.asistencia[key]={marca:'P',ts:900};f.c.store.asisFechas[a]=[DATE];f.b.basePayload=copy(f.c.sliceRegistroArea());const remote=copy(f.remote());remote.payload=copy(f.b.basePayload);remote.payload.asistencia[key]={marca:'F',ts:1};f.setRemote(remote);f.c.store.asistencia['other-classroom']={marca:'T'};
 f.c.IERegistroReconcile.choose=async cs=>Object.fromEntries(cs.map(c=>[c.path,'local']));assert.equal(await f.c.bajarRegistroNube(),true);assert.equal(f.c.store.asistencia[key].marca,'P');assert.equal(f.c.store.asistencia['other-classroom'].marca,'T');assert.deepEqual(copy(f.c.store.asisFechas[a]),[DATE]);
});
test('A1 backup recovery preserves all current shared attendance fields',()=>{
 const f=client(),a=f.c.asisCtxKey();f.b.recovery={local:copy(f.c.sliceRegistroArea())};f.c.store.asistencia[a+'||'+DATE+'||id:1']={marca:'T',ts:900};f.c.store.asisFechas[a]=[DATE];f.c.store.asisFechasEstado[a+'||'+DATE]={borrado:false,ts:900};const before=copy(f.c.store);assert.equal(f.c.recuperarBorradorAcademico(),true);for(const field of ['asistencia','asisFechas','asisFechasEstado'])assert.deepEqual(copy(f.c.store[field]),before[field]);assert.equal(f.writes(),0);
});
test('A1 shared changes while server responds remain pending, never replaced',async()=>{
 const f=client(),a=f.c.asisCtxKey(),key=a+'||'+DATE+'||id:1';setLocal(f);const send=f.c.fetch;f.c.fetch=async(...args)=>{const response=await send(...args);f.c.store.asistencia[key]={marca:'P',ts:900};f.c.store.asisFechas[a]=[DATE];return response};assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.c.store.asistencia[key].marca,'P');assert.deepEqual(copy(f.c.store.asisFechas[a]),[DATE]);assert.equal(f.c.dirty,true);
});
test('A1 conflict labels show student, competence, data type and readable alternatives',()=>{
 const view=api.conflictView({path:JSON.stringify(['finales',K]),local:n(15),remote:n(8)},{roster:[{nombre:'Alumno ficticio Ñ',orden:7,idSiagie:'1'}]});assert.match(view.title,/Calificación directa/);assert.match(view.title,/Alumno ficticio Ñ · Orden 7 · ID 1/);assert.match(view.title,/Competencia/);assert.doesNotMatch(view.title,/\|\|/);assert.match(view.local,/Nota: 15/);assert.match(view.remote,/Nota: 8/);
});
test('A1 homonymous students remain distinct through official identity and order',()=>{
 const roster=[{nombre:'Nombre ficticio',orden:1,idSiagie:'1'},{nombre:'Nombre ficticio',orden:2,idSiagie:'2'}];const a=api.conflictView({path:JSON.stringify(['finales',K])},{roster}),b=api.conflictView({path:JSON.stringify(['finales',K.replace('id:1','id:2')])},{roster});assert.notEqual(a.title,b.title);assert.match(a.title,/ID 1/);assert.match(b.title,/ID 2/);
});
test('A1 conflict UI retains exact technical identification in collapsed safe details',async()=>{
 const f=dialog(),field=f.content.children.find(x=>x.tag==='fieldset'),details=field.children.find(x=>x.tag==='details');assert.equal(details.open,undefined);assert.match(details.children[1].textContent,/id:synthetic/);assert.equal(details.children[1].innerHTML,undefined);assert.match(field.children[1].children[0].children[1].children[0].textContent,/Este dispositivo/);assert.match(field.children[1].children[1].children[1].children[0].textContent,/Nube/);f.cancel.onclick();assert.equal(await f.pending,null);
});

test('A1 modal exposes the concrete reason before technical details without preselecting or writing',async()=>{
 const f=dialog(),field=f.content.children.find(x=>x.tag==='fieldset'),reason=field.children.find(x=>x.className==='academic-conflict-explanation');
 assert.ok(reason);assert.match(reason.textContent,/Se requiere revisión por diferencias/);assert.equal(reason.innerHTML,undefined);assert.equal(f.apply.disabled,true);f.cancel.onclick();assert.equal(await f.pending,null);
});
test('A1 switching to another area with an older copy never silently reverts shared attendance',async()=>{
 const f=client(),a=f.c.asisCtxKey(),key=a+'||'+DATE+'||id:1';f.c.cloudClaveReg=()=>[f.c.nivel,f.c.bim,f.c.grado,f.c.seccion,f.c.areaActual].join('||');f.c.prefijoReg=()=>f.c.cloudClaveReg()+'||';f.c.store.asistencia[key]={marca:'P',ts:900};f.c.store.asisFechas[a]=[DATE];f.c.areaActual='Comunicación';const b=f.c.baselineAcademica();b.basePayload=copy(f.c.sliceRegistroArea());b.version=1;const remote={version:1,payload:copy(b.basePayload)};remote.payload.asistencia[key]={marca:'F',ts:1};f.setRemote(remote);f.c.IERegistroReconcile.choose=async cs=>{assert.equal(cs.length,1);return {[cs[0].path]:'local'}};
 assert.equal(await f.c.bajarRegistroNube(),true);assert.equal(f.c.store.asistencia[key].marca,'P');assert.deepEqual(copy(f.c.store.asisFechas[a]),[DATE]);assert.equal(f.writes(),0);
});
test('A1 canceling backup recovery preserves shared dates, marks and academic draft',()=>{
 const f=client();setLocal(f);f.b.recovery={local:copy(f.c.sliceRegistroArea())};Object.assign(f.c.store,attendance('P'));const before=copy(f.c.store);f.c.confirm=()=>false;assert.equal(f.c.recuperarBorradorAcademico(),false);assert.deepEqual(copy(f.c.store),before);assert.equal(f.writes(),0);
});
test('A1 readable conclusion and attendance conflicts retain exact values and dates',()=>{
 const roster=[{nombre:'Estudiante ficticio',orden:1,idSiagie:'1'}],c=api.conflictView({path:JSON.stringify(['concComp',K]),local:{texto:'Texto sintético <visible>'},remote:{texto:'Otro texto'}},{roster});assert.match(c.title,/Conclusión de competencia/);assert.equal(c.local,'Texto: Texto sintético <visible>');const a=api.conflictView({path:JSON.stringify(['asistencia',MARK]),local:{marca:'P',hora:'08:00'},remote:{marca:'F',hora:''}},{roster});assert.match(a.title,/Estudiante ficticio/);assert.match(a.title,/2026-10-12/);assert.match(a.local,/Marca: P · Hora: 08:00/);
});
test('A1 compact dialog separates header, scroll content and always-visible footer',async()=>{
 const f=dialog(12),css=f.root.children.find(n=>n.tag==='style').textContent;assert.equal(f.content.className,'academic-conflict-content');assert.equal(f.footer.className,'academic-conflict-footer');assert.equal(f.content.children.length,12);assert.deepEqual(f.footer.children,[f.cancel,f.apply]);assert.match(css,/\.academic-conflict-panel\{[^}]*display:flex;flex-direction:column[^}]*overflow:hidden/);assert.match(css,/\.academic-conflict-content\{[^}]*min-height:0;overflow-y:auto;overflow-x:hidden/);assert.match(css,/\.academic-conflict-footer\{flex-shrink:0/);assert.match(css,/max-height:90vh;max-height:90dvh/);f.cancel.onclick();assert.equal(await f.pending,null);
});
test('A1 conflict cards align labeled radios and values without preformatted primary typography',async()=>{
 const f=dialog(),card=f.content.children[0],options=card.children[1];assert.equal(card.className,'academic-conflict-card');assert.equal(card.children[0].tag,'legend');assert.equal(options.className,'academic-conflict-options');for(const [i,row] of options.children.entries()){assert.equal(row.tag,'label');assert.equal(row.className,'academic-conflict-option');assert.equal(row.children[0],f.radios[i]);assert.equal(row.children[1].children[0].textContent,i?'Nube':'Este dispositivo');assert.equal(row.children[1].children[1].className,'academic-conflict-value');assert.equal(row.children[1].children[1].tag,'div');}f.cancel.onclick();await f.pending;
});
test('A1 desktop options use equal columns and mobile 390px stacks without clipping names or values',async()=>{
 const f=dialog(),css=f.root.children.find(n=>n.tag==='style').textContent;assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);assert.match(css,/@media\(max-width:600px\)\{\.academic-conflict-options\{grid-template-columns:minmax\(0,1fr\)/);assert.match(css,/\.academic-conflict-card legend\{[^}]*max-width:100%[^}]*white-space:normal;overflow-wrap:anywhere/);assert.match(css,/\.academic-conflict-value\{[^}]*overflow-wrap:anywhere/);assert.match(css,/\.academic-conflict-dialog,\.academic-conflict-dialog \*\{box-sizing:border-box/);f.cancel.onclick();await f.pending;
});
test('A1 dialog controls retain visible focus and touch sizes with scoped styles',async()=>{
 const f=dialog(),css=f.root.children.find(n=>n.tag==='style').textContent;assert.match(css,/font-family:ui-sans-serif,system-ui/);assert.match(css,/\.academic-conflict-footer button\{min-height:44px/);assert.match(css,/\.academic-conflict-option\{[^}]*min-height:44px/);assert.match(css,/button:focus-visible[^}]*input:focus-visible[^}]*summary:focus-visible\{outline:2px solid/);assert.match(css,/button:disabled\{opacity:\.5/);assert.equal(f.apply.disabled,true);f.cancel.onclick();await f.pending;
});
test('A1 footer apply remains disabled until every compact card has an explicit choice',async()=>{
 const f=dialog(3);f.radios[0].onchange();assert.equal(f.apply.disabled,true);f.radios[3].onchange();assert.equal(f.apply.disabled,true);f.radios[4].onchange();assert.equal(f.apply.disabled,false);f.apply.onclick();const choices=await f.pending;assert.equal(Object.keys(choices).length,3);assert.deepEqual(Object.values(choices),['local','remote','local']);
});
test('A1 compact dialog keyboard includes technical disclosures and cancel closes with no choices applied',async()=>{
 const f=dialog();assert.ok(f.panel.querySelectorAll().some(n=>n.tag==='summary'));assert.equal(f.d.activeElement,f.cancel);f.radios[0].onchange();f.events.keydown({key:'Escape',preventDefault(){}});assert.equal(await f.pending,null);assert.equal(f.d.body.children.length,0);
});
test('A1 visual revision leaves reconciliation and human data interpretation exactly unchanged',()=>{
 const {execFileSync}=require('node:child_process'),before=execFileSync('git',['show','2846e16e3231defc9988267ad2bd162873d0bc23:registro-reconcile.js'],{encoding:'utf8'}),current=require('./a1-causal-snapshot.cjs')('registro-reconcile.js',read('registro-reconcile.js'));assert.equal(current.split('  function choose(')[0].replace(/\r\n/g,'\n'),before.split('  function choose(')[0].replace(/\r\n/g,'\n'));
});
test('A1 Shift Tab from the first selected remote radio stays inside compact dialog',async()=>{
 const f=dialog();f.radios[1].checked=true;f.radios[1].onchange();f.radios[1].focus();let prevented=false;f.events.keydown({key:'Tab',shiftKey:true,preventDefault(){prevented=true}});assert.equal(prevented,true);assert.equal(f.d.activeElement,f.apply);f.events.keydown({key:'Tab',shiftKey:false,preventDefault(){}});assert.equal(f.d.activeElement,f.radios[1]);f.cancel.onclick();assert.equal(await f.pending,null);
});
