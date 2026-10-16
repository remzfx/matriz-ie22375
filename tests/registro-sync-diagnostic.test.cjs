// Only fictitious classroom/transports; real A1 and identity engines, no live data.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const identity=require('../academic-identity.js'),reconcile=require('../registro-reconcile.js'),model=new Function(fs.readFileSync('registro-academic-model.js','utf8')+'\nreturn registroAcademico_();')(),diagnostic=require('../registro-sync-diagnostic.js');
const copy=reconcile.copy,context={nivel:'secundaria',bim:'III',grado:1,seccion:'A',area:'Educación para el Trabajo (EPT)'},key=Object.values(context).join('||'),comp=model.catalog.secundaria[context.area][0];
function fixture(){
 const roster=Array.from({length:28},(_,i)=>({nivel:'secundaria',grado:1,seccion:'A',idSiagie:'synthetic-'+i,codigoEstudiante:'synthetic-code-'+i,nombre:'PERSONA FICTICIA '+i}));
 const sessions=['2026-10-14','2026-10-16'].map((fecha,i)=>({...context,comp,fecha,capacidad:'Capacidad ficticia '+i})),cloud={sessions,grades:{},finales:{},meta:{}};
 for(const s of sessions)for(const a of roster)cloud.grades[[key,comp,s.capacidad,s.fecha,'id:'+a.idSiagie].join('||')]={nivel:'A',nota20:15};
 const final=i=>[key,comp,'id:'+roster[i].idSiagie].join('||');cloud.finales[final(0)]={nivel:'A',nota20:15};const local=copy(cloud);
 for(let i=0;i<4;i++)local.finales[final(i)]={nivel:'A',nota20:15,origen:'letra'};
 return {context,roster,competencies:[comp],local,baseline:{},remote:{exists:true,version:2,payload:cloud},period:'abierto',connection:{state:'review'},apis:{identity,reconcile,model},final};
}
test('Synthetic 1A EPT III: 2 sessions/56 evidence grades/1 cloud direct; origin explains Promedios conflict, not evidence loss',()=>{
 const f=fixture(),before=JSON.stringify(f),r=diagnostic.analyze(f);assert.equal(r.counts.cloud.sessions,2);assert.equal(r.counts.cloud.grades,56);assert.equal(r.counts.cloud.finales,1);assert.equal(r.counts.local.finales,4);
 assert.equal(r.conflicts.total,1);assert.deepEqual(r.conflicts.byModule,{promedios:1});assert.equal(r.conflicts.causes.origen,1);assert.equal(r.conflicts.fields.origen,1);assert.equal(r.blocks.period,false);assert.equal(r.blocks.synchronization,true);assert.equal(JSON.stringify(f),before);
});
test('Causes separate Calificar, shared attendance and verified historical contradictions without choosing a winner',()=>{
 const f=fixture();f.local=copy(f.remote.payload);f.baseline={version:1,basePayload:copy(f.local)};
 const grade=Object.keys(f.local.grades)[0];f.local.grades[grade]={nivel:'B',nota20:12,origen:'numero'};f.remote.payload.grades[grade]={nivel:'AD',nota20:18,origen:'numero'};
 const attendance='secundaria||III||1||A||2026-10-14||id:synthetic-0';f.local.asistencia={[attendance]:{marca:'P'}};f.remote.payload.asistencia={[attendance]:{marca:'F'}};
 const name=[key,comp,f.roster[0].nombre].join('||');f.remote.payload.finales[name]={nivel:'B',nota20:12,origen:'numero'};
 const r=diagnostic.analyze(f);assert.equal(r.status,'review');assert.ok(r.conflicts.byModule.calificar);assert.ok(r.conflicts.byModule.asistencia);assert.ok(r.conflicts.byModule.identidades);assert.ok(r.conflicts.causes.representaciones_verificadas_sin_vigencia);assert.ok(r.conflicts.causes.numero_exacto);
});
test('Equivalent verified letter references do not conflict; exact numeric alternatives and unverified identities stay distinct',()=>{
 const f=fixture();f.local=copy(f.remote.payload);f.remote.payload.finales[f.final(0)]={nivel:'A',nota20:14,origen:'letra'};const historical=[key,comp,f.roster[0].nombre].join('||');f.remote.payload.finales[historical]={nivel:'A',nota20:15,origen:'letra'};f.local={};
 let r=diagnostic.analyze(f);assert.equal(r.conflicts.total,0);assert.equal(r.pendingEquivalentToCloud,true);
 f.remote.payload.finales[f.final(0)].origen='numero';f.remote.payload.finales[historical].origen='numero';r=diagnostic.analyze(f);assert.equal(r.conflicts.total,1);assert.equal(r.conflicts.causes.numero_exacto,1);
 f.remote.payload.finales[[key,comp,'NOMBRE NO VERIFICADO'].join('||')]={nivel:'A',nota20:15};r=diagnostic.analyze(f);assert.equal(r.identities.unresolvedCloud,1);
});
test('Closed period is separate from synchronization review; unavailable integrity never pretends that the cloud is empty',()=>{
 const f=fixture();f.local=copy(f.remote.payload);f.period='cerrado';f.connection.state='readonly';let r=diagnostic.analyze(f);assert.equal(r.blocks.period,true);assert.equal(r.blocks.synchronization,false);
 f.baseline={version:2,basePayload:copy(f.local)};f.remote={version:3,payload:{},exists:false};r=diagnostic.analyze(f);assert.equal(r.status,'read_rejected');assert.equal(r.code,'READ_MISSING');assert.equal(r.blocks.period,true);
});
function page(options={}){
 const f=fixture(),requests=[],storage=new Map(),store={...copy(f.local),academicSync:{},meta:{[key]:{docente:'DOCENTE PRIVADO'}},studentAliases:{}};storage.set('ie22375_registro_notas_v2','legacy-private');
 const c=vm.createContext({window:null,IEAcademicIdentity:identity,IERegistroReconcile:reconcile,IERegistroAcademico:model,IERegistroConnection:{current:()=>({snapshot:()=>({state:'review',binding:'PRIVATE_TOKEN',validUntil:0})})},getLoginSession:()=>({role:'docente',user:'PRIVATE_USER',token:'PRIVATE_TOKEN'}),ctxBase:()=>context,registroLocal:{matches:()=>true},tokenPadron:'PRIVATE_TOKEN',padronBimestre:'III',store,bdEstudiantes:{secundaria:{estudiantes:f.roster}},competencias:()=>[comp],document:{querySelectorAll:()=>[]},localStorage:{getItem:k=>storage.get(k)||null,setItem(){throw Error('forbidden write');},removeItem(){throw Error('forbidden delete');}},NOTAS_KEY:'fake-notes-only',CLOUD_API_URL:'https://synthetic.invalid',AbortSignal,
  fetch:async(url,o)=>{const b=JSON.parse(o.body);requests.push({url,...b});assert.ok(['loadreg','loadperiodos'].includes(b.action));assert.equal(o.cache,'no-store');assert.equal(url,'https://synthetic.invalid');options.during?.(store,b);return {ok:true,json:async()=>options.failure?{ok:false,code:'SESSION',error:'PRIVATE_SERVER_ERROR'}:b.action==='loadreg'?{ok:true,soportaModeloAcademico:true,identidadAcademica:1,items:[{clave:key,ts:2,payload:copy(f.remote.payload)}]}:{ok:true,periodos:{bimestres:{III:'abierto'}}}};}});
 c.window=c;vm.runInContext(fs.readFileSync('registro-sync-diagnostic.js','utf8'),c);return {c,store,storage,requests};
}
test('Manual page diagnostic issues only allowlisted reads; no mutations/backups, report has no names, IDs, tokens, keys or grades',async()=>{
 const p=page(),before=JSON.stringify(p.store),storage=JSON.stringify([...p.storage]),r=await p.c.IERegistroSyncDiagnostic.runPage();assert.equal(r.status,'review');assert.equal(p.requests.length,2);assert.equal(JSON.stringify(p.store),before);assert.equal(JSON.stringify([...p.storage]),storage);assert.equal(r.legacyLocal,true);
 assert.doesNotMatch(JSON.stringify(r),/PRIVATE|PERSONA|DOCENTE|synthetic-|\|\||Capacidad|Educación/);
});
test('Changed local input during read discards the report; rejected session does not revoke/clear/persist anything',async()=>{
 const p=page({during:s=>{Object.values(s.finales)[0].nivel='C';}}),r=await p.c.IERegistroSyncDiagnostic.runPage();assert.equal(r.code,'CONTEXT_CHANGED');assert.equal(Object.values(p.store.finales)[0].nivel,'C');
 const q=page({failure:true}),before=JSON.stringify(q.store),failure=await q.c.IERegistroSyncDiagnostic.runPage();assert.equal(failure.code,'SESSION');assert.equal(JSON.stringify(q.store),before);assert.doesNotMatch(JSON.stringify(failure),/PRIVATE/);
});
test('Report sanitizes unknown configuration/state and counts fields without exporting additional private field names',()=>{
 const f=fixture();f.period='PRIVATE_PERIOD';f.connection.state='PRIVATE_STATE';f.local=copy(f.remote.payload);f.local.finales[f.final(0)].PRIVATE_FIELD='PRIVATE_VALUE';
 const r=diagnostic.analyze(f);assert.equal(r.period.server,'desconocido');assert.equal(r.period.closed,null);assert.equal(r.connection.state,'desconocido');assert.equal(r.conflicts.fields.campo_adicional,1);assert.doesNotMatch(JSON.stringify(r),/PRIVATE/);
});
test('Only optional diagnosis, tests and report change: approved product/connection/identity/printing sources stay byte-identical',()=>{
 const {execFileSync}=require('node:child_process');for(const file of ['registro.html','registro-recovery-ui.js','registro-connection.js','academic-identity.js','registro-reconcile.js','apps-script/Codigo.js','apps-script/AcademicIdentity.js','sw.js'])assert.equal(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n'),execFileSync('git',['show','96829312848251fdea6cdb787dfe2a75da2b1314:'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n'),file);
});
