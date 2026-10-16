// Real client reconciliation + real Apps Script handlers, memory Sheets, fictitious roster.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8'),copy=require('../registro-reconcile.js').copy;
const {session,cloud}=new Function('require','__dirname',read('tests/a1-diagnostic-sessions.test.cjs').split('\ntest(')[0]+'\nreturn {session,cloud};')(require,__dirname);
const setup=new Function('require','__dirname',read('tests/backend-write-auth.test.cjs').split('\nfor (const action')[0]+'\nreturn setup;')(require,__dirname);
function world(){
 const s=setup(),r=cloud();r.version=0;const initial=session(r),ctx=initial.c.ctxBase();
 s.tables.get('ConfigSistema').rows[1][2]=JSON.stringify({bimestres:{III:'abierto'}});
 const roster=initial.roster.map(a=>({...a,nivel:ctx.nivel,codigoEstudiante:'synthetic-code'}));
 s.c.hojaEstudiantes_=()=>({});s.c.leerPadronEstudiantes_=()=>({estudiantes:copy(roster)});
 function device(disk){const f=session(r,disk),c=f.c;f.roster[0].codigoEstudiante='synthetic-code';c.getLoginSession=()=>({role:'admin',token:s.admin});
   c.fetchLecturaNube=async()=>{r.reads++;const data=s.post({action:'loadreg',token:s.admin,nivel:ctx.nivel,bimestre:ctx.bim,grado:ctx.grado,seccion:ctx.seccion,area:ctx.area});return {status:200,text:async()=>JSON.stringify(data)};};
   c.fetch=async(url,opt)=>{r.writes++;const data=s.post(JSON.parse(opt.body));return {status:200,text:async()=>JSON.stringify(data)};};return f;
 }
 const data=()=>s.post({action:'loadreg',token:s.admin,nivel:ctx.nivel}).items[0];
 const fill=(f,n)=>{f.c.competencias().forEach(cp=>f.c.store.finales[f.c.finalKey(cp,'id:synthetic-1')]={nivel:n===15?'A':'B',nota20:n,origen:'numero',ts:1});f.c.saveStore();};
 return {s,r,ctx,roster,device,data,fill};
}
test('PC A confirms A then B; empty PC B automatically recovers only B; old clean PC refreshes, zero uploads on download',async()=>{
 const w=world(),a=w.device();w.fill(a,15);assert.equal(await a.c.subirRegistroNube(),true);
 const old=w.device();assert.equal(await old.c.bajarRegistroNube({automatico:true}),true);
 w.fill(a,12);assert.equal(await a.c.subirRegistroNube(),true);const before=w.r.writes,latest=w.data();assert.ok(latest.payload.meta.academicHistory.length);
 const b=w.device();assert.equal(await b.c.bajarRegistroNube({automatico:true}),true);assert.equal(b.c.store.finales[b.key].nota20,12);assert.equal(await old.c.bajarRegistroNube({automatico:true}),true);assert.equal(old.c.store.finales[old.key].nota20,12);assert.equal(w.r.writes,before);assert.equal(b.c.dirty,false);
 assert.equal(latest.payload.meta.academicHistory[0].originals.finales[a.key].nota20,15);
});
test('manual confirmation archives every original historical key; stale CAS, old client and forged history cannot destroy it',async()=>{
 const w=world(),a=w.device();w.fill(a,15);const raw=copy(a.c.sliceRegistroArea()),legacy=a.key.slice(0,a.key.lastIndexOf('||')+2)+a.roster[0].nombre;raw.finales[legacy]=copy(raw.finales[a.key]);
 const request={action:'savereg',token:w.s.admin,...w.ctx,bimestre:w.ctx.bim,modeloAcademico:1,version:0,payload:raw};const seeded=w.s.post(request);assert.equal(seeded.ok,true);
 assert.equal(await a.c.bajarRegistroNube({automatico:true}),true);assert.equal(a.c.store.finales[legacy],undefined);w.fill(a,12);assert.equal(await a.c.subirRegistroNube(),true);const stored=w.data(),history=stored.payload.meta.academicHistory;
 assert.equal(history[0].originals.finales[legacy].nota20,15);assert.equal(stored.payload.finales[legacy],undefined);
 const before=JSON.stringify(w.s.tables.get('RegistroNotas').rows);assert.equal(w.s.post({...request,identidadAcademica:1}).code,'CONFLICT');assert.equal(w.s.post({...request,version:stored.ts}).code,'IDENTITY_CLIENT');assert.equal(JSON.stringify(w.s.tables.get('RegistroNotas').rows),before);
 const payload=copy(stored.payload);payload.meta.academicHistory=[];payload.finales[a.key].nota20=13;
 const accepted=w.s.post({...request,version:stored.ts,identidadAcademica:1,payload});assert.equal(accepted.ok,true,accepted.error);assert.deepEqual(w.data().payload.meta.academicHistory[0],history[0]);
});
test('contradictory cloud aliases stop automatic recovery and preserve local draft; explicit candidates never choose an empty PC',async()=>{
 const w=world(),a=w.device();w.fill(a,15);const raw=copy(a.c.sliceRegistroArea()),legacy=a.key.slice(0,a.key.lastIndexOf('||')+2)+a.roster[0].nombre;raw.finales[legacy]={nivel:'B',nota20:12,origen:'numero'};
 assert.equal(w.s.post({action:'savereg',token:w.s.admin,...w.ctx,bimestre:w.ctx.bim,modeloAcademico:1,version:0,payload:raw}).ok,true);
 const b=w.device(),before=copy(b.c.store.finales);assert.equal(await b.c.bajarRegistroNube({automatico:true}),false);assert.deepEqual(copy(b.c.store.finales),before);assert.equal(w.r.writes,0);
 b.c.IERegistroReconcile.choose=async cs=>Object.fromEntries(cs.map(c=>[c.path,c.candidates.find(x=>x.value.nota20===12).id]));assert.equal(await b.c.bajarRegistroNube(),true);assert.equal(b.c.store.finales[b.key].nota20,12);assert.equal(w.r.writes,0);assert.ok(b.c.baselineAcademica().basePayload.finales[legacy]);
});
test('backend without Phase 2 capability supports safe reads, never receives the new upload protocol',async()=>{
 const r=cloud(),f=session(r);f.set(15);const get=f.c.fetchLecturaNube;f.c.fetchLecturaNube=async()=>{const response=await get();const data=JSON.parse(await response.text());delete data.identidadAcademica;return {status:200,text:async()=>JSON.stringify(data)};};
 assert.equal(await f.c.subirRegistroNube(),false);assert.equal(r.writes,0);assert.equal(f.c.store.finales[f.key].nota20,15);
});
test('CAS remains mandatory even when a manipulated caller omits modeloAcademico',()=>{const w=world();const out=w.s.post({action:'savereg',token:w.s.admin,...w.ctx,bimestre:w.ctx.bim,identidadAcademica:1,payload:{}});assert.equal(out.ok,false);assert.equal(out.code,'CONFLICT');assert.equal(w.s.tables.get('RegistroNotas').rows.length,1);});
test('history size guard rejects atomically rather than truncating originals or overwriting the row',async()=>{
 const w=world(),a=w.device();w.fill(a,15);assert.equal(await a.c.subirRegistroNube(),true);const row=w.s.tables.get('RegistroNotas').rows[1],p=JSON.parse(row[8]);p.meta.academicHistory=[{version:1,originals:{synthetic:'x'.repeat(49000)}}];row[8]=JSON.stringify(p);
 const before=JSON.stringify(row),writes=w.s.state.writes;const body={action:'savereg',token:w.s.admin,...w.ctx,bimestre:w.ctx.bim,identidadAcademica:1,modeloAcademico:1,version:row[7],payload:copy(p)};body.payload.finales[a.key].nota20=12;
 const out=w.s.post(body);assert.equal(out.ok,false);assert.match(out.error,/límite seguro/);assert.equal(JSON.stringify(row),before);assert.equal(w.s.state.writes,writes);
});
test('missing private bimestre roster cannot use BASE_ACTUAL as identity proof on manual confirmation',async()=>{
 const w=world(),a=w.device();w.fill(a,15);w.s.c.leerPadronEstudiantes_=()=>null;assert.equal(await a.c.subirRegistroNube(),false);assert.equal(a.c.store.finales[a.key].nota20,15);assert.equal(w.s.tables.get('RegistroNotas').rows.length,1);
});
test('manual integral confirmation reuses its verified roster without a second Sheets roster read',async()=>{
 const w=world(),a=w.device();w.fill(a,15);let reads=0;const read=w.s.c.leerPadronEstudiantes_;w.s.c.leerPadronEstudiantes_=(...args)=>{reads++;return read(...args);};assert.equal(await a.c.subirRegistroNube(),true);assert.equal(reads,1);
});
test('historical originals remain private: teacher reads/acknowledgments do not expose archived foreign-context keys',async()=>{
 const w=world(),a=w.device();w.fill(a,15);assert.equal(await a.c.subirRegistroNube(),true);const stored=w.data(),payload=copy(stored.payload);payload.finales[a.key].nota20=12;
 const row=w.s.tables.get('RegistroNotas').rows[1],raw=JSON.parse(row[8]);raw.meta.academicHistory.push({version:1,originals:{finales:{'secundaria||I||5||B||Otra área||Competencia||id:synthetic-foreign':{nivel:'C',nota20:8}}}});row[8]=JSON.stringify(raw);
 const answer=w.s.post({action:'savereg',token:w.s.secondary,...w.ctx,bimestre:w.ctx.bim,identidadAcademica:1,modeloAcademico:1,version:stored.ts,payload});assert.equal(answer.ok,true,answer.error);assert.deepEqual(answer.identityHistory,[]);
 const teacher=w.s.post({action:'loadreg',token:w.s.secondary,nivel:w.ctx.nivel,bimestre:w.ctx.bim,grado:1,seccion:'A',area:w.ctx.area});assert.equal(teacher.ok,true);assert.deepEqual(teacher.items[0].payload.meta.academicHistory,[]);assert.doesNotMatch(JSON.stringify(teacher),/synthetic-foreign/);assert.match(JSON.stringify(w.data().payload.meta.academicHistory),/synthetic-foreign/);
});
