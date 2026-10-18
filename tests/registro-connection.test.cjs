// Fase3: transport/data are fictitious; reuses the actual Phase1/2 A1 and recovery fixture.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {create}=require('../registro-connection.js'),read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),copy=require('../registro-reconcile.js').copy;
function clock(options={}){let now=0,key='A',authorized=true,online=true,reads=0,retained=0;const timers=[],states=[];const c=create({binding:()=>key,timeout:options.timeout,authorized:()=>authorized,online:()=>online,now:()=>now,setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},retain:()=>retained++,verify:async x=>{reads++;return options.verify?options.verify(x):{ok:true};},changed:s=>states.push(s.state)});return {c,timers,states,reads:()=>reads,retained:()=>retained,time:n=>now=n,key:k=>key=k,auth:v=>authorized=v,online:v=>online=v};}
test('Real verification, not online hint, is mandatory; heartbeat and leases are bounded',async()=>{const f=clock();assert.equal(f.c.canEdit(),false);assert.equal(await f.c.check(),true);assert.equal(f.c.canEdit(),true);assert.equal(await f.c.check(),true);assert.equal(f.reads(),1);assert.equal(f.timers.at(-1).ms,120000);f.time(150001);assert.equal(f.c.canEdit(),false);});
test('Offline captures work begun before pause, blocks edits, and online alone cannot reopen',async()=>{const f=clock();await f.c.check();f.online(false);f.c.pause();assert.equal(f.retained(),1);assert.equal(f.c.canEdit(),false);f.online(true);assert.equal(f.c.canEdit(),false);await f.c.check();assert.equal(f.c.canEdit(),true);});
test('Concurrent verifications deduplicate; cutoff invalidates a delayed response before application',async()=>{let finish;const f=clock({verify:({valid})=>new Promise(r=>finish=()=>r({ok:valid()}))});const a=f.c.check(),b=f.c.check();assert.equal(f.reads(),1);f.c.pause();finish();assert.equal(await a,false);assert.equal(await b,false);assert.equal(f.c.canEdit(),false);});
for(const code of ['TIMEOUT','READ_CORRUPT','API_INCOMPATIBLE'])test(code+' never becomes a valid connection',async()=>{const f=clock({verify:()=>({ok:false,code})});assert.equal(await f.c.check(),false);assert.equal(f.c.snapshot().state,'server');assert.equal(f.c.canEdit(),false);});
test('Revoked session is sticky for same token; fresh binding requires another server check',async()=>{let code='SESSION';const f=clock({verify:()=>({ok:code!=='SESSION',code})});await f.c.check();code='';assert.equal(await f.c.check(),false);assert.equal(f.reads(),1);f.key('new-session');assert.equal(await f.c.check(),true);assert.equal(f.reads(),2);});
test('Pending drafts and conflicts require review without fabricating cloud synchronization',async()=>{const f=clock({verify:()=>({ok:true,pending:true})});assert.equal(await f.c.check(),false);assert.equal(f.c.snapshot().state,'review');assert.equal(await f.c.check(true),true);assert.equal(f.c.snapshot().state,'pending');});
const fixture=new Function('require','__dirname',read('tests/registro-recovery-ui.test.cjs').split('\ntest(')[0]+'\nreturn fixture;')(require,__dirname);
function ui(){let online=true;const f=fixture(null,{boot:false,prepare(c){
 vm.runInContext(read('registro-connection.js'),c);const before=c.registroSoloLectura;c.registroSoloLectura=()=>before()||!c.IERegistroConnection.canEdit();c.navigator={get onLine(){return online}};c.IEStudents.peekRoster=()=>({synthetic:true});c.tokenPadron='synthetic-token';
 const originalStorage=c.localStorage,other=new Map();c.PERIODOS_CLOUD_KEY='synthetic-periods';c.localStorage={getItem:k=>k===c.NOTAS_KEY?originalStorage.getItem(k):other.get(k)||null,setItem:(k,v)=>k===c.NOTAS_KEY?originalStorage.setItem(k,v):other.set(k,v)};vm.runInContext(require('./reconcile-fixture.cjs').extract('loadPeriodosAdmin'),c);c.IEStudents.fetchJSON=async()=>({ok:true,periodos:{anio:2026,bimestres:{III:'abierto'}}});vm.runInContext(require('./reconcile-fixture.cjs').extract('sincronizarPeriodosNube'),c);c.sincronizarEdicionRegistro=()=>{};c.pintarRegistroConciliado=()=>{};const el=c.document.getElementById;c.document.getElementById=id=>{const n=el(id);if(!n.dataset)n.dataset={};return n;};
 const payload=c.sliceRegistroArea(),b=c.baselineAcademica();b.version=1;b.basePayload=copy(payload);b.baseline=c.IERegistroAcademico.canonical(payload);c.saveStore();
 }});f.r.payload=copy(f.c.sliceRegistroArea());return {...f,online:v=>online=v,connection:f.c.IERegistroConnection.current()};}
test('A connected can work; offline denies manual grades, local Save and manual Upload with zero remote writes',async()=>{const f=ui();assert.equal(await f.api.automatic(),true);assert.equal(f.connection.canEdit(),true);f.c.aplicarFinalManual(f.c.competencias()[0],'id:synthetic-1','AD');const note=f.c.store.finales[f.key].nota20;f.online(false);f.connection.pause();assert.equal(f.c.aplicarFinalManual(f.c.competencias()[0],'id:synthetic-1','C'),false);assert.equal(await f.api.local(),false);assert.equal(await f.api.upload(),false);assert.equal(f.c.store.finales[f.key].nota20,note);assert.equal(f.r.writes,0);});
test('B manual cloud change while A is offline is adopted only after verified reconnection when A is clean',async()=>{const f=ui();await f.api.automatic();f.online(false);f.connection.pause();f.r.version++;f.r.payload.finales[f.key]={nota20:18,nivel:'AD',origen:'numero'};f.online(true);assert.equal(f.connection.canEdit(),false);assert.equal(await f.api.automatic(),true);assert.equal(f.c.store.finales[f.key].nota20,18);assert.equal(f.c.baselineAcademica().version,f.r.version);assert.equal(f.r.writes,0);});
test('A pending note and descriptive conclusion survive reconnect; cancelled review leaves edit paused',async()=>{const f=ui();await f.api.automatic();f.c.store.finales[f.key]={nota20:18,nivel:'AD',origen:'numero'};f.c.store.concComp[f.key]={texto:'Conclusión pendiente ficticia'};f.c.saveStore();f.online(false);f.connection.pause();f.online(true);assert.equal(await f.api.automatic(),false);assert.equal(f.connection.snapshot().state,'review');assert.equal(f.c.store.finales[f.key].nota20,18);assert.equal(f.c.store.concComp[f.key].texto,'Conclusión pendiente ficticia');f.c.confirm=()=>false;assert.equal(await f.api.resolve(),false);assert.equal(f.connection.canEdit(),false);assert.equal(f.r.writes,0);});
test('True concurrent conflict retains A1/CAS; explicit local review permits editing without uploading',async()=>{const f=ui();await f.api.automatic();f.c.store.finales[f.key]={nota20:18,nivel:'AD',origen:'numero'};f.c.saveStore();f.connection.pause();f.r.version++;f.r.payload.finales[f.key]={nota20:12,nivel:'B',origen:'numero'};assert.equal(await f.api.automatic(),false);f.c.IERegistroReconcile.choose=async cs=>Object.fromEntries(cs.map(x=>[x.path,'local']));assert.equal(await f.api.resolve(),true);assert.equal(f.c.store.finales[f.key].nota20,18);assert.equal(f.r.payload.finales[f.key].nota20,12);assert.equal(f.r.writes,0);});
test('Guardar in phase3 is local, never sends transversal pending data; manual Upload remains separate',async()=>{const f=ui();await f.api.automatic();let writes=0;f.c.IERegistroTransversales={capture(){},current:()=>({dirty:true}),save:()=>{writes++;return true;}};assert.equal(await f.api.local(),true);assert.equal(writes,0);assert.equal(f.r.writes,0);});
for(const fault of ['network','invalid','SESSION'])test('Real protected read '+fault+' leaves local work paused and intact',async()=>{const f=ui();await f.api.automatic();const before=copy(f.c.store.finales);f.connection.pause();f.c.fetchLecturaNube=async()=>{if(fault==='network')throw Error('Synthetic failure');return {status:200,text:async()=>fault==='invalid'?'<html>bad</html>':JSON.stringify({ok:false,code:'SESSION',error:'Expired'})}};assert.equal(await f.api.automatic(),false);assert.equal(f.connection.canEdit(),false);assert.deepEqual(copy(f.c.store.finales),before);assert.equal(f.r.writes,0);});
module.exports={ui};

test('Remote closed period overrides formerly open cache; unavailable period service is not a verification',async()=>{
 const f=ui();await f.api.automatic();f.connection.pause();f.c.IEStudents.fetchJSON=async()=>({ok:true,periodos:{bimestres:{III:'cerrado'}}});assert.equal(await f.api.automatic(),false);assert.equal(f.connection.snapshot().state,'readonly');assert.equal(f.connection.canEdit(),false);
 const g=ui();await g.api.automatic();g.connection.pause();g.c.IEStudents.fetchJSON=async()=>{throw Error('Synthetic period outage');};assert.equal(await g.api.automatic(),false);assert.equal(g.connection.canEdit(),false);assert.equal(g.r.writes,0);
});
test('Heartbeat performs one real read after two minutes rather than renewing a cached lease',async()=>{const f=clock();await f.c.check();f.time(120000);await f.timers.at(-1).fn();assert.equal(f.reads(),2);});

const tutorSource=read('tests/tutor-transversales.test.cjs');const mountAt=tutorSource.indexOf('function mounted('),mountEnd=tutorSource.indexOf("\ntest(",mountAt);
const mounted=new Function('require','__dirname',tutorSource.split('\ntest(')[0]+'\n'+tutorSource.slice(mountAt,mountEnd)+'\nreturn mounted;')(require,__dirname);
test('Tutor verifies its own authorized classroom without writing or replacing a pending decision',async()=>{const m=mounted();await m.controller.ready;let out=await m.controller.verifyConnection({valid:()=>true,review:false});assert.equal(out.ok,true);const field=m.el('transRows').querySelectorAll('select')[0];field.value='A';field.onchange();out=await m.controller.verifyConnection({valid:()=>true,review:false});assert.equal(out.ok,true);assert.equal(out.pending,true);assert.equal(out.conflict,false);m.f.c.confirm=()=>false;assert.equal(m.controller.canLeave(),false);assert.equal(m.server.tables.has('TransversalesConsolidado'),false);m.controller.clear();});
test('Transversal confirmation is refused when connection is paused, before protected POST',async()=>{const m=mounted();await m.controller.ready;m.f.c.window.IERegistroConnection={canEdit:()=>false};await assert.rejects(m.f.c.window.IETransversales.request('savetransversalfinal',{}),{code:'CONNECTION'});assert.equal(m.server.tables.has('TransversalesConsolidado'),false);m.controller.clear();});
test('Previous backend identity protocol cannot reopen academic editing',async()=>{const f=ui();f.c.fetchLecturaNube=async()=>({status:200,text:async()=>JSON.stringify({ok:true,soportaModeloAcademico:true,items:[{clave:f.c.cloudClaveReg(),ts:f.r.version,payload:f.r.payload}]})});assert.equal(await f.api.automatic(),false);assert.equal(f.connection.canEdit(),false);});
test('Phase3 changes only the exact connection hooks; approved academic/backend modules stay byte-identical',()=>{const {execFileSync}=require('node:child_process');const base='112b30450326d1588dbe506e1039606e8aa1d885';assert.equal(require('./phase3-boundary.cjs').html(read('registro.html')),execFileSync('git',['show',base+':registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n'));for(const file of ['apps-script/Codigo.js','apps-script/AcademicIdentity.js','academic-identity.js','registro-reconcile.js','registro-transversales.js','registro-academic-model.js','registro-local-store.js','registro-drafts.js','sw.js'])assert.equal(file==='registro-reconcile.js'?require('./reconciliation-ui-boundary.cjs')(read(file)):read(file).replace(/\r\n/g,'\n'),execFileSync('git',['show',base+':'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n'),file);});

test('Failure retaining an in-progress field blocks reconciliation instead of overwriting it',async()=>{let reads=0;const c=create({binding:()=> 'same-account',authorized:()=>true,setTimeout:()=>0,clearTimeout(){},retain(){throw Error('Synthetic storage failure');},verify:async()=>{reads++;return {ok:true};}});await c.check();c.pause();assert.equal(c.snapshot().retentionFailed,true);assert.equal(await c.check(true),false);assert.equal(reads,1);assert.equal(c.canEdit(),false);});

test('Heartbeat in pending state renews lease without degrading to review when zero conflicts',async()=>{
 let conflict=false;
 const f=clock({verify:()=>({ok:true,pending:true,conflict})});
 assert.equal(await f.c.check(),false);
 assert.equal(f.c.snapshot().state,'review');
 assert.equal(await f.c.check(true),true);
 assert.equal(f.c.snapshot().state,'pending');
 assert.equal(f.c.canEdit(),true);
 f.time(120000);
 assert.equal(await f.c.check(false,true),true);
 assert.equal(f.c.snapshot().state,'pending');
 assert.equal(f.c.canEdit(),true);
 conflict=true;
 f.time(240000);
 assert.equal(await f.c.check(false,true),false);
 assert.equal(f.c.snapshot().state,'review');
 assert.equal(f.c.canEdit(),false);
});

test('UI: Heartbeat while in pending preserves editing lease; remote version conflict degrades to review',async()=>{
 const f=ui();
 await f.api.automatic();
 f.c.store.finales[f.key]={nota20:18,nivel:'AD',origen:'numero'};
 f.c.saveStore();
 f.connection.pause();
 assert.equal(await f.api.automatic(),false);
 assert.equal(f.connection.snapshot().state,'review');
 f.c.confirm=()=>true;
 assert.equal(await f.api.resolve(),true);
 assert.equal(f.connection.snapshot().state,'pending');
 assert.equal(f.connection.canEdit(),true);
 assert.equal(await f.connection.check(false,true),true);
 assert.equal(f.connection.snapshot().state,'pending');
 assert.equal(f.connection.canEdit(),true);
 f.r.version++;
 f.r.payload.finales[f.key]={nota20:11,nivel:'C',origen:'numero'};
 assert.equal(await f.connection.check(false,true),false);
 assert.equal(f.connection.snapshot().state,'review');
 assert.equal(f.connection.canEdit(),false);
});

test('priorPending never bypasses guards: context change, deauth, lease expiry, closed period, network failure, and real conflicts pause editing',async()=>{
 let binding='1A-MAT',authorized=true,verifyResult={ok:true,pending:true,conflict:false};
 const f=clock({verify:async()=>verifyResult});
 f.key(binding);
 f.auth(authorized);
 f.time(0);

 // 1. Inicial con pendientes entra en review; al resolver review entra en pending y canEdit es true
 assert.equal(await f.c.check(),false);
 assert.equal(f.c.snapshot().state,'review');
 assert.equal(await f.c.check(true),true);
 assert.equal(f.c.snapshot().state,'pending');
 assert.equal(f.c.canEdit(),true);

 // 2. Cambio de contexto académico / binding resetea inmediatamente canEdit a false y check exige revisión nueva
 f.key('2B-COM');
 assert.equal(f.c.canEdit(),false);
 assert.equal(await f.c.check(),false);
 assert.equal(f.c.snapshot().state,'review');
 assert.equal(f.c.canEdit(),false);

 // Reautorizar en pending para 2B-COM
 assert.equal(await f.c.check(true),true);
 assert.equal(f.c.snapshot().state,'pending');
 assert.equal(f.c.canEdit(),true);

 // 3. Pérdida de identidad / autorización revoca de inmediato la edición y check no mantiene pending
 f.auth(false);
 assert.equal(f.c.canEdit(),false);
 assert.equal(await f.c.check(),false);
 assert.notEqual(f.c.snapshot().state,'pending');
 assert.equal(f.c.canEdit(),false);
 f.auth(true);

 // Re-entrar en pending
 assert.equal(await f.c.check(true),true);
 assert.equal(f.c.canEdit(),true);

 // 4. Expiración de lease bloquea edición puramente por tiempo transcurrido sin evento de red
 f.time(160000);
 assert.equal(f.c.canEdit(),false);

 // 5. Falla de verificación remota (TIMEOUT / error de servidor) transiciona a server y pausa edición
 verifyResult={ok:false,code:'TIMEOUT'};
 assert.equal(await f.c.check(),false);
 assert.equal(f.c.snapshot().state,'server');
 assert.equal(f.c.canEdit(),false);

 // 6. Cierre administrativo del periodo (CLOSED) entra en readonly y pausa edición
 verifyResult={ok:true,code:'CLOSED'};
 assert.equal(await f.c.check(true),false);
 assert.equal(f.c.snapshot().state,'readonly');
 assert.equal(f.c.canEdit(),false);

 // 7. Conflicto real confirmado (conflict: true) entra en review y pausa edición incluso durante heartbeat
 verifyResult={ok:true,pending:true,conflict:false};
 assert.equal(await f.c.check(true),true);
 assert.equal(f.c.canEdit(),true);
 verifyResult={ok:true,pending:true,conflict:true};
 assert.equal(await f.c.check(false,true),false);
 assert.equal(f.c.snapshot().state,'review');
 assert.equal(f.c.canEdit(),false);
});

test('Scenario 4, 5, 6: Verify timeout transitions away from checking, late response is rejected, and retry ON SAME CONTROLLER starts fresh flight',async()=>{
 let finishVerify,secondExecuted=false,callCount=0;
 const f=clock({
  timeout:100,
  verify:()=>{
   callCount++;
   if(callCount===1)return new Promise(resolve=>{finishVerify=resolve;});
   secondExecuted=true;
   return Promise.resolve({ok:true,pending:false});
  }
 });

 // 4. Promesa verify pendiente alcanza timeout y no queda checking indefinidamente
 const checkPromise=f.c.check();
 assert.equal(f.c.snapshot().state,'checking');
 const toTimer=f.timers.find(t=>t.ms===100);
 assert.ok(toTimer,'Timeout timer was scheduled');
 await toTimer.fn();
 assert.equal(await checkPromise,false);
 assert.equal(f.c.snapshot().state,'server');
 assert.equal(f.c.canEdit(),false);

 // 5 & 6. Reintento efectivo SOBRE EL MISMO CONTROLLER mientras la primera sigue pendiente
 const checkPromise2=f.c.check();
 assert.equal(await checkPromise2,true);
 assert.equal(secondExecuted,true);
 assert.equal(f.c.snapshot().state,'connected');
 assert.equal(f.c.canEdit(),true);

 // 5b. Respuesta tardía de la primera operación colgada no autoriza edición ni modifica estado
 finishVerify({ok:true,pending:true});
 await new Promise(r=>setImmediate(r));
 assert.equal(f.c.snapshot().state,'connected');
 assert.equal(f.c.canEdit(),true);
});

test('Scenario 1, 2: Real renderFinales shows sync pause when open in review, admin closure when period closed, and both maintain controls locked',async()=>{
 const f=ui(),rf=require('./reconcile-fixture.cjs');
 vm.runInContext(rf.extract('cierreAdministrativoDocente'),f.c);
 vm.runInContext(rf.extract('bimCerradoDocente'),f.c);
 vm.runInContext(rf.extract('renderFinales'),f.c);
 f.role('docente');
 f.c.bimestreHabilitado=bim=>bim==='III';
 f.c.document.getElementById('selBim').value='III';

 // Escenario 1: Bimestre abierto + conexión en review -> "Edición pausada por sincronización / conexión"
 f.connection.pause('review');
 f.c.renderFinales();
 const modeInfo=f.c.document.getElementById('finModeInfo');
 assert.doesNotMatch(modeInfo.innerHTML,/Bimestre cerrado por administración/);
 assert.match(modeInfo.innerHTML,/Edición pausada por sincronización \/ conexión/);
 const htmlReview=f.c.document.getElementById('finLista').innerHTML;
 assert.ok(htmlReview.includes('readonly'));
 assert.ok(htmlReview.includes('disabled'));
 assert.equal(f.c.bimCerradoDocente(),true);
 assert.equal(f.c.aplicarFinalManual(f.c.competencias()[0],'id:synthetic-1','AD'),false);

 // Escenario 2: Bimestre cerrado administrativamente ('II') -> "Bimestre cerrado por administración"
 f.c.document.getElementById('selBim').value='II';
 f.c.renderFinales();
 assert.match(modeInfo.innerHTML,/Bimestre cerrado por administración/);
 assert.doesNotMatch(modeInfo.innerHTML,/Edición pausada por sincronización \/ conexión/);
 const htmlClosed=f.c.document.getElementById('finLista').innerHTML;
 assert.ok(htmlClosed.includes('readonly'));
 assert.ok(htmlClosed.includes('disabled'));
 assert.equal(f.c.bimCerradoDocente(),true);
 assert.equal(f.c.aplicarFinalManual(f.c.competencias()[0],'id:synthetic-1','AD'),false);
});

test('Scenario 3: Missing roster shows message, exercises 10 retry timer attempts, stops without infinite loop, and recovers once roster enables',async()=>{
 const f=ui();
 const label=f.c.document.getElementById('registroConnectionText');
 const stateLabel=f.c.document.getElementById('registroSaveState');

 // Simular padrón no disponible
 f.c.IEStudents.peekRoster=()=>null;
 f.api.refresh();
 assert.match(stateLabel.textContent,/Esperando el padrón autorizado/);
 assert.equal(label.textContent,'Esperando padrón autorizado…');

 // Ejercitar los 10 temporizadores de reintento de 1 segundo
 for(let i=0;i<10;i++){
  const retry=f.timers.find(t=>t.ms===1000&&!t.cancelled&&!t.executed);
  assert.ok(retry,`Padron retry attempt ${i+1} exists`);
  retry.executed=true;
  retry.fn();
 }

 // Comprobar que al llegar a 10 intentos no sigue en bucle infinito
 const leftover=f.timers.find(t=>t.ms===1000&&!t.cancelled&&!t.executed);
 assert.equal(leftover,undefined,'No further timers scheduled after 10 attempts');

 // Al habilitarse el padrón posteriormente, refresh(true) limpia intentos y autoriza edición
 f.c.IEStudents.peekRoster=()=>({synthetic:true});
 f.api.refresh(true);
 assert.equal(await f.api.automatic(),true);
 assert.equal(f.connection.snapshot().state,'connected');
 assert.equal(f.connection.canEdit(),true);
});

test('Scenario 7, 8: Review clarity differentiates trusted zero conflicts, confirmed real conflict, and untrusted/mismatched contexts',async()=>{
 const f=ui(),label=f.c.document.getElementById('registroConnectionText'),ses=f.c.getLoginSession()||{};

 // Caso A: Sin resultado confiable (null) -> Mensaje neutral
 f.c.bajarRegistroNube.resultado=null;
 f.connection.pause('review');
 assert.equal(label.textContent,'Revisión de sincronización requerida. Tus cambios locales están conservados.');

 // Caso B: Resultado con clave o token de otro contexto -> Mensaje neutral
 f.c.bajarRegistroNube.resultado={key:'other-key',token:ses.token,estado:'conflicto',conflictos:2};
 f.connection.pause('offline');
 f.connection.pause('review');
 assert.equal(label.textContent,'Revisión de sincronización requerida. Tus cambios locales están conservados.');

 f.c.bajarRegistroNube.resultado={key:f.c.cloudClaveReg(),token:'different-token',estado:'conflicto',conflictos:2};
 f.connection.pause('offline');
 f.connection.pause('review');
 assert.equal(label.textContent,'Revisión de sincronización requerida. Tus cambios locales están conservados.');

 // Caso C: Resultado confiable del contexto actual con 0 conflictos y cambios locales -> Cambios locales pendientes
 f.c.bajarRegistroNube.resultado={key:f.c.cloudClaveReg(),token:ses.token,estado:'pendiente',conflictos:0};
 f.connection.pause('offline');
 f.connection.pause('review');
 assert.equal(label.textContent,'Cambios locales pendientes de revisión. Tus cambios locales están conservados.');

 // Caso D: Resultado confiable del contexto actual con conflicto real confirmado -> Conflicto pendiente
 f.c.bajarRegistroNube.resultado={key:f.c.cloudClaveReg(),token:ses.token,estado:'conflicto',conflictos:2};
 f.connection.pause('offline');
 f.connection.pause('review');
 assert.equal(label.textContent,'Conflicto pendiente — requiere revisión. Tus cambios locales están conservados.');
 assert.equal(f.connection.canEdit(),false);
});
