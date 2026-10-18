'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {modules,source,scripts}=require('./registro-script-fixture.cjs');
const {ui}=require('./registro-connection-fixture.cjs');
const html=source('registro.html'),entries=scripts(html);

for(const file of modules)test(file+' has one synchronous relative entry and no inline duplicate',()=>{
 const selected=entries.filter(s=>s.src===file);assert.equal(selected.length,1);
 assert.doesNotMatch(selected[0].attributes,/\b(?:async|defer|type)\b/);
 assert.ok(selected[0].code.trim());
 assert.equal(entries.filter(s=>!s.src&&s.code.includes(selected[0].code.trim())).length,0);
});

test('parser order preserves owner/connection before core and drafts before recovery; DOM ready remains deferred',()=>{
 const at=file=>entries.findIndex(s=>s.src===file),core=entries.findIndex(s=>!s.src&&s.code.includes('const registroLocal = IERegistroLocalStore.create('));
 assert.ok(at('registro-local-store.js')<at('registro-connection.js'));
 assert.ok(at('registro-connection.js')<core&&core<at('registro-drafts.js'));
 assert.ok(at('registro-drafts.js')<at('registro-recovery-ui.js'));
 const recovery=entries[at('registro-recovery-ui.js')].code;
 assert.match(recovery,/document.addEventListener\('DOMContentLoaded'/);
 assert.ok(entries.filter(s=>s.src==='registro-reconcile.js'||s.src==='registro-academic-model.js').every(s=>/\bdefer\b/.test(s.attributes)));
});

test('external APIs preserve observable persistence, ownership, connection and draft behavior of approved inline code',async()=>{
 const old=execFileSync('git',['show','7c5d003:registro.html'],{encoding:'utf8',maxBuffer:4000000});
 async function trace(codes){
  const c=vm.createContext({IERegistroReconcile:require('../registro-reconcile.js'),setTimeout:()=>0,clearTimeout:()=>{},fetch:()=>{throw Error('Production network forbidden');}});
  for(const code of codes)vm.runInContext(code,c);
  const data=new Map();let session={role:'docente',user:'synthetic-only'};
  const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
  const local=c.IERegistroLocalStore.create(storage,()=>session);local.write('{"finales":{"synthetic":{"nivel":"A"}}}');
  const raw=local.read();session={role:'docente',user:'other-synthetic'};assert.throws(()=>local.write('{}'),/cuenta cambió/);
  const states=[],connection=c.IERegistroConnection.create({binding:()=>'synthetic',authorized:()=>true,verify:async()=>({ok:true,pending:true}),changed:v=>states.push(v.state)});
  await connection.check();const paused=connection.canEdit();await connection.check(true,true);const editable=connection.canEdit();connection.dispose();
  const differences=c.IERegistroDrafts.differences({finales:{synthetic:{nivel:'A'}}},{finales:{synthetic:{nivel:'B'}}});
  return JSON.parse(JSON.stringify({raw,states,paused,editable,differences}));
 }
 const files=modules.slice(0,3),original=files.map(file=>scripts(old).find(s=>!s.src&&s.code.trim()===source(file).trim())?.code);
 assert.ok(original.every(Boolean),'Reviewed inline implementations exist');
 assert.deepEqual(await trace(files.map(file=>entries.find(s=>s.src===file).code)),await trace(original));
});

test('missing mandatory connection dependency never grants editing from a cached authorization',()=>{
 const code=require('./reconcile-fixture.cjs').extract('registroSoloLectura');
 const c=vm.createContext({});vm.runInContext(code,c);
 assert.equal(c.registroSoloLectura(),true);
 c.IERegistroConnection={canEdit:()=>false};assert.equal(c.registroSoloLectura(),true);
});

test('recovery remains strict after adding the dependency guard',()=>{
 const code=entries.find(s=>s.src==='registro-recovery-ui.js').code;
 const probe=code.replace('let service,','__syntheticUndeclaredProbe=1;let service,');
 assert.notEqual(probe,code);
 assert.throws(()=>vm.runInNewContext(probe,{}),/__syntheticUndeclaredProbe is not defined/);
});

for(const missing of modules)test('failed '+missing+' is controlled, never enables editing and preserves every synthetic storage key',()=>{
 const {pageGuard,coreGuard}=require('./registro-script-fixture.cjs');
 const data=new Map([['synthetic-owner-III-2026','{"finales":{"synthetic":"B"},"historial":["A"]}'],
  ['matriz_SEC_IE22375','{"anio":2026,"II":{"synthetic":"A"}}'],['legacy-other-period','{"synthetic":"C"}']]);
 const before=JSON.stringify([...data]),controls=[{disabled:false},{disabled:false}],status={dataset:{}},label={textContent:''};let writes=0,remoteWrites=0;
 const c=vm.createContext({document:{getElementById:id=>id==='registroConnectionStatus'?status:label,querySelectorAll:()=>controls},
  localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>{writes++;data.set(k,v);}},getLoginSession:()=>({role:'docente',user:'synthetic'}),
  setTimeout:()=>0,clearTimeout:()=>{},fetch:()=>{remoteWrites++;throw Error('Remote network forbidden');}});
 vm.runInContext(scripts(pageGuard)[0].code,c);
 for(const file of modules){
  assert.match(entries.find(s=>s.src===file).attributes,/onerror="registroDependenciaFallida\(\)"/);
  if(file===missing)vm.runInContext('registroDependenciaFallida()',c);
  else if(file!=='registro-recovery-ui.js')vm.runInContext(entries.find(s=>s.src===file).code,c);
  if(file==='registro-connection.js'){
   if(['registro-local-store.js','registro-connection.js'].includes(missing))assert.throws(()=>vm.runInContext(coreGuard,c),/Registro pausado/);
   else vm.runInContext(coreGuard,c);
  }
 }
 if(missing!=='registro-recovery-ui.js')vm.runInContext(entries.find(s=>s.src==='registro-recovery-ui.js').code,c);
 vm.runInContext(require('./reconcile-fixture.cjs').extract('registroSoloLectura'),c);
 assert.equal(c.registroSoloLectura(),true);assert.equal(c.IERegistroConnection?.canEdit()||false,false);
 assert.equal(c.IERegistroRecovery,undefined,'adapter never starts partially');
 assert.equal(status.dataset.state,'server');assert.match(label.textContent,/Edición pausada.*notas locales están conservadas/);
 assert.ok(controls.every(c=>c.disabled));assert.equal(writes,0);assert.equal(remoteWrites,0);assert.equal(JSON.stringify([...data]),before);
});

test('2026 III historical records roundtrip unchanged; II matrices and other periods/accounts are untouched',()=>{
 const c=vm.createContext({});vm.runInContext(entries.find(s=>s.src==='registro-local-store.js').code,c);
 const legacy='ie22375_registro_notas_v2',data=new Map(),writes=[];
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>{writes.push(k);data.set(k,v);}};
 const session=()=>({role:'docente',user:'synthetic-owner'}),key='secundaria||III||1||A||Área ficticia||Competencia ficticia||id:synthetic-1';
 const historical={meta:{anio:2026},grades:{[key+'||cap||2026-10-01']:{nota20:15,origen:'numero',ts:1}},
  finales:{[key]:{nivel:'B',nota20:12,origen:'numero',ts:2}},concComp:{[key]:{texto:'Conclusión histórica ficticia'}},
  concArea:{[key]:'Antecedente ficticio'},sessions:[{bim:'III',fecha:'2026-10-01',comp:'Competencia ficticia'}],
  asistencia:{[key]:{marca:'P',ts:3}},asisFechas:{aula:['2026-10-01']},academicSync:{synthetic:{version:4,readBackups:[{local:{finales:{}}}]}}},raw=JSON.stringify(historical);
 const untouched=new Map([[legacy,raw],['matriz_IE22375','{"anio":2026,"II":{"synthetic":"A"}}'],
  ['matriz_SEC_IE22375','{"anio":2026,"II":{"synthetic":"B"}}'],[legacy+':owner:other-synthetic',raw]]);
 for(const [k,v]of untouched)data.set(k,v);
 const ownerKey=c.IERegistroLocalStore.create(storage,session).key;data.set(ownerKey,raw);
 const local=c.IERegistroLocalStore.create(storage,session);
 assert.equal(local.read(),raw);local.write(local.read());
 const reopened=c.IERegistroLocalStore.create(storage,session);assert.equal(reopened.read(),raw);
 for(const [k,v]of untouched)assert.equal(data.get(k),v,k);
 assert.deepEqual(writes,[local.key]);assert.deepEqual(JSON.parse(reopened.read()),historical);
});

test('declared recovery entry verifies then saves locally without academic POST',async()=>{
 const f=ui();assert.equal(await f.api.automatic(),true);assert.equal(f.connection.canEdit(),true);
 f.c.store.finales[f.key]={nota20:18,nivel:'AD',origen:'numero'};f.c.store.concComp[f.key]={texto:'Conclusión sintética conservada'};
 assert.equal(await f.api.local(),true);assert.equal(f.r.writes,0);assert.equal(f.c.store.finales[f.key].nota20,18);
 assert.equal(f.c.store.concComp[f.key].texto,'Conclusión sintética conservada');
 f.connection.dispose();
});

test('declared recovery entry pauses offline without modifying academic data or uploading',async()=>{
 const f=ui();await f.api.automatic();const before=JSON.stringify(f.c.store);f.online(false);f.connection.pause();
 assert.equal(f.connection.canEdit(),false);assert.equal(await f.api.local(),false);assert.equal(await f.api.upload(),false);
 assert.equal(JSON.stringify(f.c.store),before);assert.equal(f.r.writes,0);f.connection.dispose();
});
