// A1 causal regressions use fictitious records, memory storage and no network.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),api=require('../registro-reconcile.js'),fixture=require('./reconcile-fixture.cjs'),copy=api.copy;
const ui=new Function('require','__dirname',read('tests/registro-academic-model.test.cjs').split('\nfor(const level')[0]+'\nreturn ui;')(require,__dirname);
function cloud(){return {version:1,payload:{},reads:0,writes:0};}
function session(remote,disk={raw:null},role='admin'){
 const f=ui(),c=f.c,roster=[{idSiagie:'synthetic-1',nombre:'Estudiante Ficticio Uno',grado:1,seccion:'A'}];vm.runInContext(read('student-identity.js'),c);
 c.grado=1;c.bim='III';c.ctxBase=()=>({nivel:c.nivel,bim:c.bim,grado:c.grado,seccion:c.seccion,area:c.areaActual});c.cloudClaveReg=()=>Object.values(c.ctxBase()).join('||');c.asisCtxKey=()=>['secundaria',c.bim,c.grado,c.seccion].join('||');
 c.CLOUD_API_URL='https://synthetic.invalid';c.estudiantes=()=>roster;c.getLoginSession=()=>({role,token:'synthetic-token'});c.IERegistroTransversales=undefined;c.informeSiagie=()=>({ok:true});c.pintarRegistroConciliado=()=>{};
 c.NOTAS_KEY='synthetic-memory-only';c.localStorage={getItem:()=>disk.raw,setItem:(k,v)=>disk.raw=v};
 for(const n of ['loadStore','saveStore','subirRegistroNube','bajarRegistroNube','recuperarBorradorAcademico'])vm.runInContext(fixture.extract(n),c);
 if(disk.raw)c.loadStore();else c.store.academicSync={};
 c.fetchLecturaNube=async()=>{remote.reads++;return {status:200,text:async()=>JSON.stringify({ok:true,soportaModeloAcademico:true,identidadAcademica:1,items:[{clave:c.cloudClaveReg(),ts:remote.version,payload:copy(remote.payload)}]})};};
 c.fetch=async(url,opt)=>{const body=JSON.parse(opt.body);remote.writes++;if(body.version!==remote.version)return {status:200,text:async()=>JSON.stringify({ok:false,code:'CONFLICT'})};remote.version++;remote.payload=copy(body.payload);remote.payload.meta={...(remote.payload.meta||{}),academicHistory:[]};return {status:200,text:async()=>JSON.stringify({ok:true,version:remote.version,identityHistory:[]})};};
 const choices=[];c.IERegistroReconcile.choose=async cs=>{choices.push(copy(cs));return cs.length?null:{};};
 const key=c.finalKey(f.comps[0],'id:synthetic-1'),set=(n)=>{c.baselineAcademica();c.store.finales[key]={nota20:n,nivel:c.numToLetter(n),origen:'numero',ts:10};c.saveStore();};
 return {c,disk,choices,key,set,roster,reopen:()=>session(remote,disk,role)};
}
test('A: teacher upload, Admin download, both reopen and download without conflicts or additional POST',async()=>{
 const r=cloud(),teacher=session(r,undefined,'docente');teacher.set(15);assert.equal(await teacher.c.subirRegistroNube(),true);const admin=session(r);assert.equal(await admin.c.bajarRegistroNube(),true);
 for(const previous of [teacher,admin]){const next=previous.reopen();assert.equal(next.c.baselineAcademica().version,r.version);assert.deepEqual(copy(next.c.baselineAcademica().basePayload),r.payload);assert.equal(await next.c.bajarRegistroNube(),true);assert.equal(next.c.store.finales[next.key].nota20,15);assert.equal(next.choices.at(-1).length,0);}assert.equal(r.writes,1);
});
test('B: reopened pending local grade survives remote additions, not merely a conservation message',async()=>{
 const r=cloud(),f=session(r);f.set(15);await f.c.subirRegistroNube();f.set(18);r.payload.concComp[f.key]={texto:'Conclusión ficticia remota',ts:20};r.version++;const next=f.reopen();assert.equal(await next.c.bajarRegistroNube(),true);assert.equal(next.c.store.finales[next.key].nota20,18);assert.equal(next.c.store.concComp[next.key].texto,'Conclusión ficticia remota');assert.equal(next.c.dirty,true);assert.equal(r.payload.finales[next.key].nota20,15);assert.equal(r.writes,1);
});
test('C/F: true conflict cancellation and reopen preserve local, remote and causal base',async()=>{
 const r=cloud(),f=session(r);f.set(15);await f.c.subirRegistroNube();f.set(18);r.payload.finales[f.key].nota20=12;r.payload.finales[f.key].nivel='B';r.version++;const before=copy(f.c.store);assert.equal(await f.c.bajarRegistroNube(),false);assert.deepEqual(copy(f.c.store),before);const next=f.reopen();assert.equal(await next.c.bajarRegistroNube(),false);assert.equal(next.c.store.finales[next.key].nota20,18);assert.equal(r.payload.finales[next.key].nota20,12);assert.equal(next.c.baselineAcademica().basePayload.finales[next.key].nota20,15);assert.equal(r.writes,1);
});
test('F: explicit reconciliation retains recovery across reopen; recovery writes memory only',async()=>{
 const r=cloud(),f=session(r);f.set(15);await f.c.subirRegistroNube();f.set(18);r.payload.finales[f.key].nota20=12;r.payload.finales[f.key].nivel='B';r.version++;f.c.IERegistroReconcile.choose=async cs=>Object.fromEntries(cs.map(x=>[x.path,'remote']));assert.equal(await f.c.bajarRegistroNube(),true);const next=f.reopen();assert.equal(next.c.store.finales[next.key].nota20,12);assert.equal(next.c.recuperarBorradorAcademico(),true);assert.equal(next.c.store.finales[next.key].nota20,18);assert.equal(next.c.baselineAcademica().recovery.local.finales[next.key].nota20,12);assert.equal(r.writes,1);
});
test('D: identical historical contradictions still require review after reopen; no arbitrary ID priority',async()=>{
 const r=cloud(),f=session(r);f.set(15);const old=f.key.slice(0,f.key.lastIndexOf('||')+2)+f.roster[0].nombre;f.c.store.finales[old]={nivel:'C',origen:'letra',nota20:8,ts:1};r.payload=copy(f.c.sliceRegistroArea());const b=f.c.baselineAcademica();b.version=r.version;b.basePayload=copy(r.payload);b.baseline=f.c.IERegistroAcademico.canonical(r.payload);f.c.saveStore();
 for(const current of [f,f.reopen()]){const before=copy(current.c.store.finales);assert.equal(await current.c.bajarRegistroNube(),false);assert.equal(current.choices.at(-1).length,1);assert.deepEqual(copy(current.c.store.finales),before);}assert.equal(r.writes,0);
});

test('Diagnostic D: historical untagged reference differs from tagged letter; distinct exact numbers remain distinct',()=>{
 assert.equal(api.equal({nivel:'B',nota20:12},{nivel:'B',nota20:12,origen:'letra'}),false);assert.equal(api.equal({nivel:'B',nota20:12,origen:'letra'},{nivel:'B',nota20:13,origen:'letra'}),true);assert.equal(api.equal({nivel:'B',nota20:12,origen:'numero'},{nivel:'B',nota20:13,origen:'numero'}),false);
});
test('D: empty PC never silently selects one contradictory historical grade',async()=>{
 const r=cloud(),source=session(r);source.set(15);const old=source.key.slice(0,source.key.lastIndexOf('||')+2)+source.roster[0].nombre;source.c.store.finales[old]={nivel:'C',nota20:8,origen:'letra'};r.payload=copy(source.c.sliceRegistroArea());const fresh=session(r);
 assert.equal(await fresh.c.bajarRegistroNube(),false);assert.equal(fresh.choices.at(-1).length,1);assert.equal(fresh.c.store.finales[fresh.key],undefined);assert.equal(r.writes,0);
});

test('C: both devices preserve their competing exact numbers and demand explicit resolution',async()=>{
 const r=cloud(),a=session(r);a.set(15);await a.c.subirRegistroNube();const b=session(r);await b.c.bajarRegistroNube();a.set(18);b.set(12);assert.equal(await a.c.subirRegistroNube(),true);assert.equal(await b.c.bajarRegistroNube(),false);assert.equal(b.c.store.finales[b.key].nota20,12);assert.equal(r.payload.finales[a.key].nota20,18);assert.equal(b.choices.at(-1).length,1);assert.equal(r.writes,2);
});
test('E: slice and reconciliation leave unrelated student, section, area, bimestre and competence untouched',async()=>{
 const r=cloud(),f=session(r);f.set(15);await f.c.subirRegistroNube();const keys=[f.key.replace('id:synthetic-1','id:synthetic-2'),f.key.replace('||A||','||B||'),f.key.replace('||III||','||II||'),f.key.replace('Matemática','Comunicación'),f.key.replace(f.c.competencias()[0],'Competencia ficticia distinta')];keys.forEach(k=>f.c.store.finales[k]={nota20:18,nivel:'AD'});f.c.saveStore();assert.equal(await f.c.bajarRegistroNube(),true);keys.forEach(k=>assert.equal(f.c.store.finales[k].nota20,18));assert.equal(f.c.store.finales[f.key].nota20,15);assert.equal(r.writes,1);
});
test('G: concurrent cloud edit after preparation rejects stale upload and preserves both grades',async()=>{
 const r=cloud(),f=session(r);f.set(15);await f.c.subirRegistroNube();f.set(18);const send=f.c.fetch;f.c.fetch=async(...args)=>{r.version++;r.payload.finales[f.key].nota20=12;r.payload.finales[f.key].nivel='B';return send(...args);};assert.equal(await f.c.subirRegistroNube(),false);assert.equal(f.c.store.finales[f.key].nota20,18);assert.equal(r.payload.finales[f.key].nota20,12);assert.equal(f.c.baselineAcademica().basePayload.finales[f.key].nota20,15);
});
function historical(field='finales'){
 const prefix='secundaria||III||1||A||Matemática||Competencia ficticia||',id=prefix+'id:synthetic-1',old=prefix+'Estudiante Ficticio Uno';
 const base={[field]:{[id]:{nivel:'A',nota20:15,origen:'numero'},[old]:{nivel:'C',nota20:8,origen:'letra'}}};
 return {field,id,old,base,groups:[[JSON.stringify([field,id]),JSON.stringify([field,old])]]};
}
for(const field of ['grades','finales','concComp'])for(const side of ['local','remote'])test('Causal group '+field+': unilateral '+side+' change preserves historical routes and source snapshots',()=>{
 const f=historical(field);if(field==='concComp')f.base[field]={[f.id]:{texto:'Conclusión ficticia actual'},[f.old]:{texto:'Conclusión ficticia histórica'}};
 const local=copy(f.base),remote=copy(f.base),changed=side==='local'?local:remote;changed[field][f.id]=field==='concComp'?{texto:'Conclusión ficticia nueva',ts:1}:{nota20:18,nivel:'AD',origen:'numero',ts:1};const before=JSON.stringify([f.base,local,remote]),plan=api.plan(f.base,local,remote,f.groups);assert.equal(plan.conflicts.length,0);assert.deepEqual(copy(plan.resolve()[field]),changed[field]);assert.equal(JSON.stringify([f.base,local,remote]),before);
});
for(const side of ['local','remote'])test('Causal group: unilateral tombstone and physical deletion on '+side+' do not resurrect historical values',()=>{
 for(const tombstone of [false,true]){const f=historical(),l=copy(f.base),r=copy(f.base),changed=side==='local'?l:r;if(tombstone)changed.finales[f.id]={borrado:true,ts:1};else delete changed.finales[f.id];const plan=api.plan(f.base,l,r,f.groups);assert.equal(plan.conflicts.length,0);assert.deepEqual(copy(plan.resolve().finales),changed.finales);assert.deepEqual(plan.resolve().finales[f.old],f.base.finales[f.old]);}
});
test('Causal group: bilateral edits across ID/alias demand a whole-set choice and retain both candidates',()=>{
 const f=historical(),l=copy(f.base),r=copy(f.base);l.finales[f.id]={nivel:'AD',nota20:18,origen:'numero',ts:1};r.finales[f.old]={nivel:'B',nota20:12,origen:'numero',ts:9999};const plan=api.plan(f.base,l,r,f.groups);assert.equal(plan.conflicts.length,1);assert.throws(()=>plan.resolve(),/sin resolver/);const conflict=plan.conflicts[0];assert.deepEqual(copy(plan.resolve({[conflict.path]:'local'}).finales),l.finales);assert.deepEqual(copy(plan.resolve({[conflict.path]:'remote'}).finales),r.finales);
});
test('Causal group: deletion versus concurrent historical edit never silently drops the competing evidence',()=>{
 for(const tombstone of [false,true]){const f=historical(),l=copy(f.base),r=copy(f.base);if(tombstone)l.finales[f.id]={borrado:true};else delete l.finales[f.id];r.finales[f.old]={nivel:'B',nota20:12,origen:'numero'};const plan=api.plan(f.base,l,r,f.groups);assert.equal(plan.conflicts.length,1);const conflict=plan.conflicts[0];assert.deepEqual(copy(plan.resolve({[conflict.path]:'local'}).finales),l.finales);assert.deepEqual(copy(plan.resolve({[conflict.path]:'remote'}).finales),r.finales);}
});
test('Causal group: exact numbers in the same achievement band remain conflicting decisions',()=>{
 const f=historical(),l=copy(f.base),r=copy(f.base);f.base.finales[f.id]={nivel:'B',nota20:11,origen:'numero'};l.finales[f.id]={nivel:'B',nota20:12,origen:'numero'};r.finales[f.id]={nivel:'B',nota20:13,origen:'numero'};const plan=api.plan(f.base,l,r,f.groups);assert.equal(plan.conflicts.length,1);const c=plan.conflicts[0];assert.equal(plan.resolve({[c.path]:'local'}).finales[f.id].nota20,12);assert.equal(plan.resolve({[c.path]:'remote'}).finales[f.id].nota20,13);
});
test('Causal group: unknown base does not imply a unilateral edit between different representations',()=>{
 const f=historical(),l={finales:{[f.id]:f.base.finales[f.id]}},r={finales:{[f.old]:f.base.finales[f.old]}};assert.equal(api.plan(null,l,r,f.groups).conflicts.length,1);
});
test('Causal group: ambiguous names stay separate and are never assigned to an arbitrary ID',()=>{
 const f=session(cloud()),prefix=f.key.slice(0,f.key.lastIndexOf('||')+2),l={finales:{[f.key]:{nivel:'A',nota20:15}}},r={finales:{[prefix+'Igual Ficticio']:{nivel:'C',nota20:8}}},roster=[{idSiagie:'synthetic-1',nombre:'Igual Ficticio'},{idSiagie:'synthetic-2',nombre:'Igual Ficticio'}];const groups=f.c.IERegistroReconcile.identityConflicts(l,r,roster,f.c.IEStudentIdentity);assert.equal(groups.length,0);const out=api.plan(null,l,r,groups).resolve();assert.deepEqual(copy(out.finales),{...l.finales,...r.finales});assert.equal(f.c.IEStudentIdentity.leer(r.finales,f.key,roster[0],{},false),undefined);
});
test('Permission denial on protected download preserves pending grades and sends no academic POST',async()=>{
 const r=cloud(),f=session(r);f.set(18);const before=copy(f.c.store);f.c.fetchLecturaNube=async()=>({status:403,text:async()=>JSON.stringify({ok:false,code:'SESSION',error:'Sesión ficticia revocada'})});assert.equal(await f.c.bajarRegistroNube(),false);assert.deepEqual(copy(f.c.store),before);assert.equal(r.writes,0);
});
test('Unilateral pending ID edit with a historical alias survives download and reopening without POST',async()=>{
 const r=cloud(),f=session(r);f.set(15);const old=f.key.slice(0,f.key.lastIndexOf('||')+2)+f.roster[0].nombre;f.c.store.finales[old]={nivel:'C',nota20:8,origen:'letra'};r.payload=copy(f.c.sliceRegistroArea());const baseline=f.c.baselineAcademica();baseline.version=r.version;baseline.basePayload=copy(r.payload);baseline.baseline=f.c.IERegistroAcademico.canonical(r.payload);f.c.saveStore();f.set(18);const next=f.reopen();assert.equal(await next.c.bajarRegistroNube(),true);assert.equal(next.choices.at(-1).length,0);assert.equal(next.c.store.finales[next.key].nota20,18);assert.equal(next.c.store.finales[old],undefined);assert.equal(next.c.baselineAcademica().basePayload.finales[old].nivel,'C');assert.equal(next.c.dirty,true);assert.equal(r.payload.finales[next.key].nota20,15);assert.equal(r.writes,0);
});
