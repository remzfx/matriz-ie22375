// Diagnostic counterexamples use fictitious records, memory storage and no network.
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
 c.fetchLecturaNube=async()=>{remote.reads++;return {status:200,text:async()=>JSON.stringify({ok:true,soportaModeloAcademico:true,items:[{clave:c.cloudClaveReg(),ts:remote.version,payload:copy(remote.payload)}]})};};
 c.fetch=async(url,opt)=>{const body=JSON.parse(opt.body);remote.writes++;if(body.version!==remote.version)return {status:200,text:async()=>JSON.stringify({ok:false,code:'CONFLICT'})};remote.version++;remote.payload=copy(body.payload);return {status:200,text:async()=>JSON.stringify({ok:true,version:remote.version})};};
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
test('Diagnostic D: identical payload/base with divergent historical alias produces recurring conflict after reopen',async()=>{
 const r=cloud(),f=session(r);f.set(15);const old=f.key.slice(0,f.key.lastIndexOf('||')+2)+'Estudiante Ficticio Uno';f.c.store.finales[old]={nivel:'C',origen:'letra',nota20:8,ts:1};r.payload=copy(f.c.sliceRegistroArea());const b=f.c.baselineAcademica();b.version=r.version;b.basePayload=copy(r.payload);b.baseline=f.c.IERegistroAcademico.canonical(r.payload);f.c.saveStore();
 for(const current of [f,f.reopen()]){assert.equal(api.signature(current.c.sliceRegistroArea()),api.signature(r.payload));const before=copy(current.c.store.finales);assert.equal(await current.c.bajarRegistroNube(),false);assert.equal(current.choices.at(-1).length,1);assert.match(current.choices.at(-1)[0].reason,/representaciones históricas/);assert.deepEqual(copy(current.c.store.finales),before);const identity=current.c.IEStudentIdentity;assert.equal(identity.leer(current.c.store.finales,current.key,current.roster[0],{}).nota20,15);}assert.equal(r.writes,0);
});
test('Diagnostic D: historical untagged reference differs from tagged letter; distinct exact numbers remain distinct',()=>{
 assert.equal(api.equal({nivel:'B',nota20:12},{nivel:'B',nota20:12,origen:'letra'}),false);assert.equal(api.equal({nivel:'B',nota20:12,origen:'letra'},{nivel:'B',nota20:13,origen:'letra'}),true);assert.equal(api.equal({nivel:'B',nota20:12,origen:'numero'},{nivel:'B',nota20:13,origen:'numero'}),false);
});
test('Diagnostic D: selecting identical historical sets cannot clear the recurring conflict',async()=>{
 const r=cloud(),f=session(r);f.set(15);const old=f.key.slice(0,f.key.lastIndexOf('||')+2)+f.roster[0].nombre;f.c.store.finales[old]={nivel:'C',nota20:8,origen:'letra'};r.payload=copy(f.c.sliceRegistroArea());f.c.IERegistroReconcile.choose=async cs=>Object.fromEntries(cs.map(x=>[x.path,'remote']));assert.equal(await f.c.bajarRegistroNube(),true);const next=f.reopen();assert.equal(await next.c.bajarRegistroNube(),false);assert.equal(next.choices.at(-1).length,1);assert.equal(next.c.store.finales[next.key].nota20,15);assert.equal(next.c.store.finales[old].nivel,'C');assert.equal(r.writes,0);
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
