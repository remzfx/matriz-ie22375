const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const {setup}=new Function('require','__dirname',read('tests/backend-remaining-writes.test.cjs').split('const allowed =')[0]+'\nreturn {setup};')(require,__dirname);
const {extract}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('function fixture')[0]+'\nreturn {extract};')(require,__dirname);
function backend(){
 const s=setup(),stamp=Date.now()-10000;
 // Synthetic bimonthly enrollment and an independently open attendance period:
 // CAS tests exercise concurrency, not the roster/configuration persistence tested elsewhere.
 s.c.obtenerAsistenciaPeriodos_=()=>({anio:2026,configurada:true,ts:1,bimestres:{I:'cerrado',II:'cerrado',III:'abierto',IV:'bloqueado'}});
 s.c.hojaEstudiantes_=()=>({});
 s.c.leerPadronEstudiantes_=()=>({estudiantes:[
  {nivel:'primaria',grado:1,seccion:'Única',nombre:'Synthetic Student',idSiagie:'PRIMARY'},
  {nivel:'primaria',grado:1,seccion:'Única',nombre:'Synthetic Other',idSiagie:'OTHER'}
 ]});
 const item=extra=>{
  const nombre=extra?.nombre||'Synthetic Student';
  const idEstudiante=nombre==='Synthetic Other'?'siagie:OTHER':'siagie:PRIMARY';
  return {anio:2026,bimestre:'III',idEstudiante,fecha:'2026-10-11',nivel:'primaria',
   grado:1,seccion:'Única',nombre,marca:'P',hora:'08:00',via:'manual',motivo:'',ts:stamp,...extra};
 };
 const save=items=>s.post({action:'saveasis',token:s.admin,items});
 const load=()=>JSON.parse(s.c.doGet({parameter:{action:'loadasis',token:s.admin,anio:2026,bimestre:'III'}}).text);
 const loadLegacy=()=>JSON.parse(s.c.doGet({parameter:{action:'loadasis',token:s.admin}}).text);
 return {...s,item,save,load,loadLegacy,stamp};
}
for(const [fresh,stale] of [['P','F'],['F','P']])test('Server CAS keeps newer '+fresh+' over older '+stale+' even with a forged newer clock',()=>{
 const s=backend(),first=s.save([s.item({marca:stale})]);assert.equal(first.ok,true);
 const version=first.resultados[0].version;
 const next=s.save([s.item({marca:fresh,ts:s.stamp+100,versionBase:version})]);assert.equal(next.ok,true);
 const late=s.save([s.item({marca:stale,ts:s.stamp+999,versionBase:version})]);assert.equal(late.code,'CONFLICT');
 assert.equal(s.load().items[0].marca,fresh);assert.equal(s.tables.get('AsistenciaIngreso').rows.length,2);assert.equal(s.state.held,false);
});
for(const phase of ['read','write'])for(const initial of [false,true])test('Lock interleaving at '+phase+' serializes '+(initial?'updates':'two insertions')+' of one key',()=>{
 const s=backend();let version='';if(initial)version=s.save([s.item({marca:'F'})]).resultados[0].version;
 if(!s.tables.has('AsistenciaIngreso'))s.c.asegurarAsis_();
 const sh=s.tables.get('AsistenciaIngreso'),original=sh.getRange;let blocked,once=false;
 if(phase==='read' && !initial){const last=sh.getLastRow;sh.getLastRow=()=>{if(!once){once=true;assert.equal(s.state.held,true);blocked=s.save([s.item({marca:'J',ts:s.stamp+2})]);assert.equal(blocked.ok,false);}return last();};}
 sh.getRange=function(...args){const range=original.apply(this,args),name=phase==='read'?'getValues':'setValues',fn=range[name];
  if(fn)range[name]=function(...values){
   if(!once && args[0]>=2){once=true;assert.equal(s.state.held,true);blocked=s.save([s.item({marca:'J',ts:s.stamp+2,versionBase:version})]);assert.equal(blocked.ok,false);}
   return fn.apply(this,values);
  };return range;};
 // The waiting peer cannot acquire the mocked lock. Real waitLock blocks until release.
 const winner=s.save([s.item({marca:'P',ts:s.stamp+1,versionBase:version})]);assert.equal(winner.ok,true);assert.ok(once);
 const peer=s.save([s.item({marca:'J',ts:s.stamp+2,versionBase:version})]);assert.equal(peer.code,'CONFLICT');
 assert.equal(s.tables.get('AsistenciaIngreso').rows.length,2);assert.equal(s.load().items[0].marca,'P');assert.equal(s.state.held,false);
});
test('Identical replay is recognized without writes or version/timestamp changes',()=>{
 const s=backend(),input=s.item(),first=s.save([input]),writes=s.state.writes;
 const repeat=s.save([{...input,ts:Date.now()+999999999}]);assert.equal(repeat.ok,true);assert.equal(repeat.repetidos,1);assert.equal(repeat.guardados,0);
 assert.equal(repeat.resultados[0].version,first.resultados[0].version);assert.equal(s.state.writes,writes);assert.equal(s.load().items[0].ts,input.ts);
});
test('Equal timestamps with different contents conflict even with the current version',()=>{
 const s=backend(),first=s.save([s.item()]);const r=s.save([s.item({marca:'F',versionBase:first.resultados[0].version})]);
 assert.equal(r.resultados[0].motivo,'CLOCK_OR_STALE');assert.equal(s.load().items[0].marca,'P');
});
for(const ts of [undefined,null,'',-1,0,1.5,'bad',true,{},'0x12',Date.now()+600001])test('Missing/invalid/skewed timestamp cannot overwrite a versioned mark: '+JSON.stringify(ts),()=>{
 const s=backend(),first=s.save([s.item()]);const r=s.save([s.item({marca:'F',ts,versionBase:first.resultados[0].version})]);
 assert.equal(r.ok,false);assert.equal(s.load().items[0].marca,'P');
});
test('Untimestamped legacy creation keeps zero, not a manufactured current timestamp',()=>{
 const s=backend(),r=s.save([s.item({ts:undefined})]);assert.equal(r.ok,true);assert.equal(s.load().items[0].ts,0);
});
test('Historical row gets a stable read-only version and requires it before modification',()=>{
 const s=backend(),it=s.item(),key=s.c.itemAsistenciaAutorizado_(it).clave;
 s.c.asegurarAsis_().appendRow([key,it.fecha,it.nivel,it.grado,it.seccion,it.nombre,'P',it.hora,it.via,it.ts,it.motivo]);
 const before=clone(s.tables.get('AsistenciaIngreso').rows),version=s.loadLegacy().items[0].version;assert.equal(s.loadLegacy().items[0].version,version);assert.deepEqual(s.tables.get('AsistenciaIngreso').rows,before);
 assert.equal(s.save([s.item({marca:'F',ts:it.ts+100})]).code,'CONFLICT');
 assert.equal(s.save([s.item({marca:'F',ts:it.ts+100,versionBase:version})]).ok,true);assert.equal(s.tables.get('AsistenciaIngreso').rows.length,2);
});
test('Mixed authorized batch reports accepted and conflicted keys without claiming total success',()=>{
 const s=backend();s.save([s.item()]);const other=s.item({nombre:'Synthetic Other',marca:'T'});
 const r=s.save([s.item({marca:'F',ts:s.stamp+1}),other]);assert.equal(r.ok,false);assert.equal(r.guardados,1);assert.equal(r.conflictos,1);
 assert.deepEqual(r.resultados.map(x=>x.estado),['conflicto','aceptada']);assert.equal(s.load().items.length,2);
});
test('Unauthorized mixed levels reject before acquiring lock or mutating Sheets',()=>{
 const s=backend(),token=s.token('auxiliar','auxiliar',{niveles:['primaria']}),writes=s.state.writes;
 // Persist matching real server account scope; browser flags cannot expand it.
 const config=s.tables.get('ConfigSistema').rows.find(r=>r[0]==='AUXILIAR_ACCESOS');const accounts=JSON.parse(config[2]);accounts[0].niveles=['primaria'];config[2]=JSON.stringify(accounts);
 const r=s.post({action:'saveasis',token,items:[s.item(),s.item({nivel:'secundaria',seccion:'A'})]});assert.equal(r.ok,false);assert.equal(s.state.writes,writes);assert.equal(s.tables.has('AsistenciaIngreso'),false);assert.equal(r.resultados,undefined);
});
test('Duplicate incoming keys reject the entire batch; historical duplicates are never deleted',()=>{
 const s=backend();assert.equal(s.save([s.item(),s.item({marca:'F'})]).code,'INVALID_BATCH');assert.equal(s.tables.has('AsistenciaIngreso'),false);
 s.save([s.item()]);const sh=s.tables.get('AsistenciaIngreso');sh.rows.push([...sh.rows[1]]);const rows=clone(sh.rows);
 const r=s.save([s.item({marca:'F'})]);assert.equal(r.resultados[0].motivo,'DUPLICATE_KEY');assert.deepEqual(sh.rows,rows);
});
test('Authorization revoked while waiting for lock is checked again before writing',()=>{
 const s=backend(),token=s.token('auxiliar','auxiliar',{niveles:['primaria','secundaria']});const lock=s.c.LockService.getScriptLock();
 s.c.LockService.getScriptLock=()=>({...lock,waitLock(){lock.waitLock();const row=s.tables.get('ConfigSistema').rows.find(r=>r[0]==='AUXILIAR_ACCESOS');row[1]++;}});
 const r=s.post({action:'saveasis',token,items:[s.item()]});assert.equal(r.code,'SESSION');assert.equal(s.tables.has('AsistenciaIngreso'),false);assert.equal(s.state.held,false);
});
test('Automatic absence with no known version cannot replace a confirmed present mark',()=>{
 const s=backend();s.save([s.item()]);const r=s.save([s.item({marca:'F',via:'auto-falta',ts:Date.now()})]);assert.equal(r.code,'CONFLICT');assert.equal(s.load().items[0].marca,'P');
});

function client(){
 const memory=new Map(),messages=[],writes=[],reads=[],els=new Map(),key='2026||III||2026-10-11||primaria||1||Única||siagie:PRIMARY';let token='synthetic-token';
 const el=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',hidden:false});return els.get(id);};el('selNivel').value='primaria';el('inpFecha').value='2026-10-11';el('selBimestre').value='III';
 const c=vm.createContext({Date,Map,URLSearchParams,document:{getElementById:el},IEAuxPermissions:{permite:n=>n==='primaria'},tokenSesionAuxiliar:()=>token,
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},toast:m=>messages.push(m),confirm:()=>false,renderLista(){},completarFaltasAlSubir:()=>0,
 asisKey:()=>key,horaAhora:()=> '08:00',hoyISO:()=> '2026-10-11',fetchLecturaNube:async url=>{reads.push(url);return {text:async()=>JSON.stringify({ok:true,protocoloAsistencia:2,items:[]})};},
 fetch:async(url,opts)=>{const b=JSON.parse(opts.body);writes.push(b);return {text:async()=>JSON.stringify({ok:true,protocoloAsistencia:2,resultados:b.items.map(it=>({clave:it.clave,estado:'aceptada',version:'asis1:synthetic-1'}))})};}});
 const run=s=>vm.runInContext(s,c);run("const ASIS_KEY='synthetic-asis',CLOUD_API_URL='https://synthetic.invalid';function anioAsistencia(){return 2026};function bimestreAsistencia(){return 'III'};function asistenciaEscribible(){return true};async function verificarCierreAsistencia(){return true}");
 for(const n of ['loadAsis','saveAsis','getRec','setRec','recToItem','firmaMarcaAsistencia','pendienteMarcaAsistencia','prepararSubidaAsistencia','rechazarSesionAsistencia','confirmarSubidaAsistencia','combinarBajadaAsistencia','resolverSubidaAsistencia','subirUnoNube','subirTodoNube','bajarNube'])run(extract('auxiliar.html',n));
 const rec={marca:'P',hora:'08:00',via:'manual',ts:Date.now()-10000,motivo:'',nombre:'Synthetic Student'},al={nivel:'primaria',nombre:'Synthetic Student'};
 c.saveAsis({[key]:rec});return {c,run,memory,messages,writes,reads,key,rec,al,el,changeToken:t=>token=t};
}
test('Legacy backend preflight blocks writes rather than claiming new guarantees',async()=>{
 const f=client();f.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify({ok:true,items:[]})});const before=f.memory.get('synthetic-asis');
 await f.c.subirTodoNube();await f.c.subirUnoNube(f.al);assert.equal(f.writes.length,0);assert.equal(f.memory.get('synthetic-asis'),before);assert.match(f.messages.at(-1),/Backend anterior/);
});
for(const method of ['subirTodoNube','subirUnoNube'])test(method+': network failure preserves local pending marks without retry',async()=>{
 const f=client(),before=f.memory.get('synthetic-asis');f.c.fetch=async()=>{f.writes.push(true);throw Error('Synthetic network');};await f.c[method](f.al);
 assert.equal(f.writes.length,1);assert.equal(f.memory.get('synthetic-asis'),before);assert.match(f.messages.at(-1),/conservan/);
});
test('Verified receipt preserves a local edit made while upload is in flight',async()=>{
 const f=client();let resolve;f.c.fetch=()=>new Promise(r=>resolve=r);const task=f.c.subirTodoNube();await new Promise(r=>setImmediate(r));
 f.c.setRec(f.al,'J','manual','Synthetic justification');resolve({text:async()=>JSON.stringify({ok:true,protocoloAsistencia:2,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:one'}]})});await task;
 const rec=f.c.loadAsis()[f.key];assert.equal(rec.marca,'J');assert.equal(rec.motivo,'Synthetic justification');assert.equal(rec.versionServidor,'asis1:one');assert.equal(f.c.pendienteMarcaAsistencia(rec),true);
});
test('Partial results confirm only matched receipts; conflicts and missing receipts remain pending',()=>{
 const f=client(),all=f.c.loadAsis(),other=f.key+' Other';all[other]={...f.rec,marca:'F'};f.c.saveAsis(all);const items=Object.entries(all).map(([k,r])=>f.c.recToItem(k,r));
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:2,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:one'},{clave:other,estado:'conflicto'}]},items,'synthetic-token');
 assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[f.key]),false);assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[other]),true);assert.match(f.messages.at(-1),/1 conflictos/);
});
test('Download after conflict retains raw local edits and captures remote version for explicit review',()=>{
 const f=client();const remote={...f.c.recToItem(f.key,{...f.rec,marca:'F'}),version:'asis1:remote'};
 f.c.combinarBajadaAsistencia({protocoloAsistencia:2,items:[remote]});const rec=f.c.loadAsis()[f.key];assert.equal(rec.marca,'P');assert.equal(rec.ts,f.rec.ts);assert.equal(rec.remoto.marca,'F');assert.equal(rec.versionServidor,undefined);
 const items=[f.c.recToItem(f.key,rec)];f.c.resolverSubidaAsistencia(items);assert.equal(items[0].versionBase,'');
 f.c.confirm=()=>true;f.c.resolverSubidaAsistencia(items);assert.equal(items[0].versionBase,'asis1:remote');assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[f.key]),true);
});
test('Late download cannot undo a receipt/version established after the request started',()=>{
 const f=client(),snapshot=clone(f.c.loadAsis()),it=f.c.recToItem(f.key,f.rec);
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:2,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:new'}]},[it],'synthetic-token');
 f.c.combinarBajadaAsistencia({protocoloAsistencia:2,items:[{...it,marca:'F',version:'asis1:old'}]},snapshot);
 assert.equal(f.c.loadAsis()[f.key].marca,'P');assert.equal(f.c.loadAsis()[f.key].versionServidor,'asis1:new');
});
test('Old backend reply and changed session cannot confirm or remove local assistance',()=>{
 const f=client(),it=f.c.recToItem(f.key,f.rec),before=f.memory.get('synthetic-asis');
 f.c.confirmarSubidaAsistencia({ok:true,guardados:1},[it],'synthetic-token');assert.equal(f.memory.get('synthetic-asis'),before);
 f.changeToken('new-token');f.c.confirmarSubidaAsistencia({protocoloAsistencia:2,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:one'}]},[it],'synthetic-token');assert.equal(f.memory.get('synthetic-asis'),before);
});
test('Legacy string marks and missing timestamps remain representable without invented clocks',()=>{
 const f=client(),it=f.c.recToItem(f.key,'P');assert.equal(it.marca,'P');assert.equal(it.ts,undefined);assert.equal(it.versionBase,'');
});
test('Revoked preflight session retires authorization but leaves assistance unchanged',async()=>{
 const f=client(),before=f.memory.get('synthetic-asis');let retired=0;f.c.retirarSesionAuxiliar=()=>{retired++;return true;};
 f.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify({ok:false,code:'SESSION',error:'Synthetic revoked session'})});await f.c.subirTodoNube();
 assert.equal(retired,1);assert.equal(f.writes.length,0);assert.equal(f.memory.get('synthetic-asis'),before);assert.equal(f.el('studentsRelogin').hidden,false);
});
test('Academic attendance is unchanged; Auxiliar preserves approved base styles beyond compact form and statistics',()=>{
 const original=file=>execFileSync('git',['show','d3fee52033c2c0b7244d00d52e9a5ae0799ed30f:'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 assert.equal(read('registro.html').replace(/\r\n/g,'\n'),original('registro.html'));
 const old=original('auxiliar.html'),now=read('auxiliar.html').replace(/\r\n/g,'\n');
 const estilos=html=>[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]);
 const limpiado=estilos(now).map(css=>css
  .replace('select, input[type=date], input[type=month], input[type=search]', 'select, input[type=date], input[type=search]')
  .replace(/    \/\* Formulario compacto[\s\S]*?(?=    #scanBox \{)/,'')
  .replace(/    \.asis-kpi[\s\S]*?(?=    #reader \{)/,''));
 assert.deepEqual(limpiado,estilos(old),'Los estilos originales fuera del módulo estadístico no deben cambiar');
});


test('Explicit conflict resolution can be confirmed without changing mark, hour or justification',()=>{
 const f=client(),remote={...f.c.recToItem(f.key,f.rec),marca:'F',version:'asis1:remote'};
 f.c.combinarBajadaAsistencia({protocoloAsistencia:2,items:[remote]});f.c.confirm=()=>true;
 const items=[f.c.recToItem(f.key,f.c.loadAsis()[f.key])];f.c.resolverSubidaAsistencia(items);
 const rec=f.c.loadAsis()[f.key];assert.equal(rec.marca,f.rec.marca);assert.equal(rec.hora,f.rec.hora);assert.equal(rec.motivo,f.rec.motivo);assert.ok(rec.ts>=f.rec.ts);
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:2,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:resolved'}]},items,'synthetic-token');
 assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[f.key]),false);assert.equal(f.c.loadAsis()[f.key].remoto,undefined);
});

test('A late upload receipt cannot roll back a newer confirmed version',()=>{
 const f=client(),it=f.c.recToItem(f.key,f.rec);
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:2,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:new'}]},[it],'synthetic-token');
 const before=f.memory.get('synthetic-asis');
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:2,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:old'}]},[it],'synthetic-token');assert.equal(f.memory.get('synthetic-asis'),before);
});

test('Protected upload and download integrate with server CAS using only synthetic records',async()=>{
 const f=client(),s=backend();
 f.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify(s.load())});
 f.c.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);return {text:async()=>JSON.stringify(s.save(body.items))};};
 await f.c.subirTodoNube();assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[f.key]),false);assert.equal(s.load().items.length,1);
 const second=client();second.c.saveAsis({});second.c.combinarBajadaAsistencia(s.load());
 assert.equal(second.c.loadAsis()[f.key].marca,'P');assert.equal(second.c.loadAsis()[f.key].hora,'08:00');assert.equal(second.c.pendienteMarcaAsistencia(second.c.loadAsis()[f.key]),false);
 second.c.setRec(second.al,'J','manual','Synthetic reason');const item=second.c.recToItem(f.key,second.c.loadAsis()[f.key]);
 const receipt=s.save([item]);assert.equal(receipt.ok,true);second.c.confirmarSubidaAsistencia(receipt,[item],'synthetic-token');
 const stale=f.c.recToItem(f.key,{...f.c.loadAsis()[f.key],marca:'F',ts:Date.now()+1});assert.equal(s.save([stale]).code,'CONFLICT');
 f.c.combinarBajadaAsistencia(s.load());assert.equal(f.c.loadAsis()[f.key].marca,'J');assert.equal(f.c.loadAsis()[f.key].motivo,'Synthetic reason');
});


test('Authenticated assistance protocol probe is lightweight and never opens attendance sheet',()=>{
 const s=backend();
 assert.equal(s.tables.has('AsistenciaIngreso'),false);
 const response=s.post({action:'asisprotocol',token:s.admin});
 assert.equal(response.ok,true);
 assert.equal(response.protocoloAsistencia,2);
 assert.equal(s.tables.has('AsistenciaIngreso'),false);
 const unauth=s.post({action:'asisprotocol',token:'synthetic-invalid'});
 assert.equal(unauth.ok,false);assert.equal(unauth.code,'SESSION');
 assert.equal(s.tables.has('AsistenciaIngreso'),false);
});

test('QR uploads verify only a lightweight protocol, reusing a bounded success cache',async()=>{
 const f=client();
 await f.c.subirUnoNube(f.al);
 f.c.setRec(f.al,'F','manual','');
 await f.c.subirUnoNube(f.al);
 f.c.setRec(f.al,'P','manual','');
 await f.c.subirUnoNube(f.al);
 assert.equal(f.writes.length,3);
 assert.equal(f.reads.length,1);
 assert.ok(f.reads.every(url=>url.includes('action=asisprotocol')));
 assert.ok(f.reads.every(url=>!url.includes('loadasis')));
});

test('Concurrent protocol checks share a single in-flight request',async()=>{
 const f=client();let resolve,consultas=0;
 f.c.fetchLecturaNube=()=>{consultas++;return new Promise(r=>resolve=r);};
 const a=f.c.prepararSubidaAsistencia(),b=f.c.prepararSubidaAsistencia();
 assert.equal(consultas,1);
 resolve({text:async()=>JSON.stringify({ok:true,protocoloAsistencia:2})});
 assert.equal(await a,true);assert.equal(await b,true);
 assert.equal(f.c.prepararSubidaAsistencia.estado.token,'synthetic-token');
 assert.equal(await f.c.prepararSubidaAsistencia(),true);
 assert.equal(consultas,1);
});

test('A new or revoked session cannot reuse a previously successful capability probe',async()=>{
 const f=client();
 await f.c.prepararSubidaAsistencia();assert.equal(f.reads.length,1);
 f.changeToken('synthetic-new-token');
 f.c.fetchLecturaNube=async url=>{f.reads.push(url);return {text:async()=>JSON.stringify({ok:false,code:'SESSION',error:'revoked'})};};
 f.c.retirarSesionAuxiliar=()=>true;
 assert.equal(await f.c.prepararSubidaAsistencia(),false);
 assert.equal(f.reads.length,2);
 assert.equal(f.c.prepararSubidaAsistencia.estado,null);
});

test('Mass upload sends only unconfirmed marks and never resends a confirmed mark',async()=>{
 const f=client();
 await f.c.subirTodoNube();assert.equal(f.writes.length,1);
 assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[f.key]),false);
 await f.c.subirTodoNube();assert.equal(f.writes.length,1);
 assert.match(f.messages.at(-1),/no hay marcas pendientes/);
 f.c.setRec(f.al,'F','manual','');
 await f.c.subirTodoNube();assert.equal(f.writes.length,2);
 assert.equal(f.writes[1].items.length,1);
 assert.equal(f.writes[1].items[0].marca,'F');
});

test('Legacy local string marks are retained but not uploaded without a verified student identity',async()=>{
 const f=client();f.c.saveAsis({[f.key]:'P'});
 await f.c.subirTodoNube();
 assert.equal(f.writes.length,0);
 assert.equal(f.c.loadAsis()[f.key],'P');
});

test('Per-student conflict confirmation shows exact student/date/class and both marks',()=>{
 const f=client(),remote={...f.c.recToItem(f.key,f.rec),marca:'F',version:'asis1:remote'};
 f.c.combinarBajadaAsistencia({protocoloAsistencia:2,items:[remote]});
 let prompt;
 f.c.confirm=m=>{prompt=m;return true;};
 const items=[f.c.recToItem(f.key,f.c.loadAsis()[f.key])];
 const accepted=f.c.resolverSubidaAsistencia(items);
 assert.equal(accepted.length,1);
 assert.match(prompt,/Synthetic Student/);
 assert.match(prompt,/2026-10-11/);
 assert.match(prompt,/primaria.*1.*Única/);
 assert.match(prompt,/Marca en este dispositivo: P/);
 assert.match(prompt,/Marca en la nube: F/);
 assert.equal(accepted[0].versionBase,'asis1:remote');
 assert.equal(f.c.loadAsis()[f.key].marca,'P');
});

test('Cancellation retains a conflicting local edit and never sends it to the cloud',async()=>{
 const f=client(),remote={...f.c.recToItem(f.key,f.rec),marca:'F',version:'asis1:remote'};
 f.c.combinarBajadaAsistencia({protocoloAsistencia:2,items:[remote]});
 const before=f.memory.get('synthetic-asis');
 let dialogs=0;f.c.confirm=()=>{dialogs++;return false;};
 await f.c.subirTodoNube();
 assert.equal(dialogs,1);assert.equal(f.writes.length,0);
 assert.equal(f.memory.get('synthetic-asis'),before);
 assert.match(f.messages.at(-1),/no se envi/);
});


test('Sheets automatic Date coercion is prevented by text-formatting the exact row',()=>{
 const s=backend(),sh=s.c.asegurarAsis_(),getRange=sh.getRange.bind(sh),formatted=new Set();
 // Simulate auto-parsing only when cell format was not explicitly set to text.
 sh.getRange=function(r,c,nr,nc){
  const range=getRange(r,c,nr,nc),format=range.setNumberFormat;
  range.setNumberFormat=function(pattern){if(pattern==='@')formatted.add(r+':'+c);return format.call(this,pattern);};
  if(r>=2 && c===1 && nc===15){
   const original=range.setValues;
   range.setValues=function(values){
    const typed=values.map(raw=>{
     const row=[...raw];
     if(!formatted.has(r+':2'))row[1]=new Date(String(raw[1])+'T00:00:00-05:00');
     if(!formatted.has(r+':8'))row[7]=new Date('1899-12-30T'+String(raw[7])+':00-05:00');
     return row;
    });
    return original.call(this,typed);
   };
  }
  return range;
 };
 const initial=s.item({marca:'P',hora:'08:00'}),first=s.save([initial]);
 assert.equal(first.ok,true);
 assert.equal(sh.rows[1][1],initial.fecha,'date must remain ISO text');
 assert.equal(sh.rows[1][7],initial.hora,'hour must remain HH:mm text');
 const loaded=s.load().items[0];
 assert.equal(loaded.fecha,initial.fecha);assert.equal(loaded.hora,initial.hora);
 assert.equal(loaded.version,first.resultados[0].version,'read version must match the server receipt');
 const next=s.save([s.item({marca:'T',hora:'08:15',ts:s.stamp+1000,versionBase:first.resultados[0].version})]);
 assert.equal(next.ok,true,JSON.stringify(next));assert.equal(next.guardados,1);
 assert.equal(s.load().items[0].marca,'T');assert.equal(s.load().items[0].hora,'08:15');
 assert.equal(s.load().items[0].version,next.resultados[0].version);
 const late=s.save([s.item({marca:'F',hora:'08:30',ts:s.stamp+2000,versionBase:first.resultados[0].version})]);
 assert.equal(late.code,'CONFLICT');assert.equal(late.resultados[0].motivo,'VERSION_CONFLICT');
 assert.equal(s.load().items[0].marca,'T');assert.equal(sh.rows.length,2);
});

test('loadasis filters historic Sheets Date cells using the spreadsheet timezone without modifying rows',()=>{
 const s=backend(),sh=s.c.asegurarAsis_();
 const append=(name,fecha,cellenFecha)=>{
  const it=s.item({fecha,nombre:name}),key=s.c.itemAsistenciaAutorizado_(it).clave;
  sh.appendRow([key,cellenFecha,it.nivel,it.grado,it.seccion,it.nombre,'P',it.hora,it.via,it.ts,it.motivo]);
 };
 // 01:30 UTC of October 12 is still October 11 in the sheet timezone America/Lima.
 const legacyDate=new Date('2026-10-12T01:30:00Z');
 append('Legacy Date Row','2026-10-11',legacyDate);
 append('Text Date Row','2026-10-11','2026-10-11');
 append('Other Day Row','2026-10-12',new Date('2026-10-12T17:00:00Z'));
 const writes=s.state.writes;
 const load=(fecha)=>JSON.parse(s.c.doGet({parameter:{
  action:'loadasis',token:s.admin,...(fecha===undefined?{}:{fecha})
 }}).text);
 const oct11=load('2026-10-11');
 assert.equal(oct11.ok,true);
 assert.deepEqual(oct11.items.map(x=>x.nombre).sort(),['Legacy Date Row','Text Date Row']);
 assert.equal(oct11.items[0].fecha,'2026-10-11');
 assert.match(oct11.items[0].version,/^asis1:/);
 assert.equal(load('2026-10-11').items.find(x=>x.nombre==='Legacy Date Row').version,
  oct11.items.find(x=>x.nombre==='Legacy Date Row').version);
 assert.deepEqual(load('2026-10-12').items.map(x=>x.nombre),['Other Day Row']);
 assert.equal(load('2026-10-13').items.length,0);
 assert.equal(load().items.length,3,'unfiltered reading includes old and new rows');
 assert.equal(s.state.writes,writes,'all date queries must remain read-only');
 assert.equal(sh.rows[1][1],legacyDate,'historical Date cells must not be migrated or rewritten');
});

test('Legacy archive is read-only, scoped to date and level, and never mixes with bimonthly records',()=>{
 const s=backend(),sh=s.c.asegurarAsis_();
 sh.appendRow(['2026-10-11||primaria||1||Única||Old Student','2026-10-11','primaria','1','Única','Old Student','F','08:30','manual',1,'']);
 const fresh=s.save([s.item({marca:'P'})]);
 assert.equal(fresh.ok,true,JSON.stringify(fresh));
 const rows=clone(sh.rows),writes=s.state.writes;
 const read=p=>JSON.parse(s.c.doGet({parameter:{action:'loadasis',token:s.admin,...p}}).text);
 const old=read({historico:'1',nivel:'primaria',fecha:'2026-10-11'});
 assert.equal(old.ok,true);assert.equal(old.historicoAnterior,true);
 assert.deepEqual(old.items.map(x=>x.nombre),['Old Student']);
 assert.equal(old.items[0].bimestre,'');assert.equal(old.items[0].idEstudiante,'');
 assert.deepEqual(read({anio:'2026',bimestre:'III',fecha:'2026-10-11',nivel:'primaria'}).items.map(x=>x.nombre),['Synthetic Student']);
 assert.equal(read({historico:'1',fecha:'2026-10-11'}).code,'INVALID_PERIOD');
 assert.equal(read({historico:'1',nivel:'primaria'}).code,'INVALID_PERIOD');
 assert.equal(read({historico:'1',nivel:'primaria',fecha:'2026-10-11',anio:'2026',bimestre:'III'}).code,'INVALID_PERIOD');
 assert.equal(read({historico:'1',nivel:'secundaria',fecha:'2026-10-11'}).items.length,0);
 assert.deepEqual(sh.rows,rows,'historical archive reads must not alter rows');
 assert.equal(s.state.writes,writes,'archive reads must not write data');
});

test('Bulk upload sends only the selected date and keeps other dates pending',async()=>{
 const f=client(),day2=f.key.replace('2026-10-11','2026-10-12');
 const all=f.c.loadAsis();all[day2]={...f.rec,marca:'T',nombre:'Synthetic Student',ts:f.rec.ts+1};
 f.c.saveAsis(all);
 await f.c.subirTodoNube();
 assert.equal(f.writes.length,1);
 assert.deepEqual(f.writes[0].items.map(it=>it.fecha),['2026-10-11']);
 assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[day2]),true,'Other day must remain pending');
 f.el('inpFecha').value='2026-10-12';
 await f.c.subirTodoNube();
 assert.equal(f.writes.length,2);
 assert.deepEqual(f.writes[1].items.map(it=>it.fecha),['2026-10-12']);
});
test('Bulk upload never creates absent marks without a deliberate manual mark',async()=>{
 const f=client();let generated=0;
 f.c.completarFaltasAlSubir=()=>{generated++;throw Error('Automatic absences must never occur on upload')};
 await f.c.subirTodoNube();
 assert.equal(generated,0);
 assert.equal(f.writes.length,1);
 assert.deepEqual(f.writes[0].items.map(x=>x.marca),['P']);
});
