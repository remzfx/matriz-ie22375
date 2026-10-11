const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const {setup}=new Function('require','__dirname',read('tests/backend-remaining-writes.test.cjs').split('const allowed =')[0]+'\nreturn {setup};')(require,__dirname);
const {extract}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('function fixture')[0]+'\nreturn {extract};')(require,__dirname);
function backend(){
 const s=setup(),stamp=Date.now()-10000;
 const item=extra=>({fecha:'2026-10-11',nivel:'primaria',grado:1,seccion:'Única',nombre:'Synthetic Student',marca:'P',hora:'08:00',via:'manual',motivo:'',ts:stamp,...extra});
 const save=items=>s.post({action:'saveasis',token:s.admin,items});
 const load=()=>JSON.parse(s.c.doGet({parameter:{action:'loadasis',token:s.admin}}).text);
 return {...s,item,save,load,stamp};
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
 const before=clone(s.tables.get('AsistenciaIngreso').rows),version=s.load().items[0].version;assert.equal(s.load().items[0].version,version);assert.deepEqual(s.tables.get('AsistenciaIngreso').rows,before);
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
 const memory=new Map(),messages=[],writes=[],reads=[],els=new Map(),key='2026-10-11||primaria||1||Única||Synthetic Student';let token='synthetic-token';
 const el=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',hidden:false});return els.get(id);};el('selNivel').value='primaria';el('inpFecha').value='2026-10-11';
 const c=vm.createContext({Date,Map,URLSearchParams,document:{getElementById:el},IEAuxPermissions:{permite:n=>n==='primaria'},tokenSesionAuxiliar:()=>token,
 localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},toast:m=>messages.push(m),confirm:()=>false,renderLista(){},completarFaltasAlSubir:()=>0,
 asisKey:()=>key,horaAhora:()=> '08:00',hoyISO:()=> '2026-10-11',fetchLecturaNube:async url=>{reads.push(url);return {text:async()=>JSON.stringify({ok:true,protocoloAsistencia:1,items:[]})};},
 fetch:async(url,opts)=>{const b=JSON.parse(opts.body);writes.push(b);return {text:async()=>JSON.stringify({ok:true,protocoloAsistencia:1,resultados:b.items.map(it=>({clave:it.clave,estado:'aceptada',version:'asis1:synthetic-1'}))})};}});
 const run=s=>vm.runInContext(s,c);run("const ASIS_KEY='synthetic-asis',CLOUD_API_URL='https://synthetic.invalid';");
 for(const n of ['loadAsis','saveAsis','getRec','setRec','recToItem','firmaMarcaAsistencia','pendienteMarcaAsistencia','prepararSubidaAsistencia','rechazarSesionAsistencia','confirmarSubidaAsistencia','combinarBajadaAsistencia','resolverSubidaAsistencia','subirUnoNube','subirTodoNube','bajarNube'])run(extract('auxiliar.html',n));
 const rec={marca:'P',hora:'08:00',via:'manual',ts:Date.now()-10000,motivo:''},al={nivel:'primaria'};
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
 f.c.setRec(f.al,'J','manual','Synthetic justification');resolve({text:async()=>JSON.stringify({ok:true,protocoloAsistencia:1,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:one'}]})});await task;
 const rec=f.c.loadAsis()[f.key];assert.equal(rec.marca,'J');assert.equal(rec.motivo,'Synthetic justification');assert.equal(rec.versionServidor,'asis1:one');assert.equal(f.c.pendienteMarcaAsistencia(rec),true);
});
test('Partial results confirm only matched receipts; conflicts and missing receipts remain pending',()=>{
 const f=client(),all=f.c.loadAsis(),other=f.key+' Other';all[other]={...f.rec,marca:'F'};f.c.saveAsis(all);const items=Object.entries(all).map(([k,r])=>f.c.recToItem(k,r));
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:1,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:one'},{clave:other,estado:'conflicto'}]},items,'synthetic-token');
 assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[f.key]),false);assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[other]),true);assert.match(f.messages.at(-1),/1 conflictos/);
});
test('Download after conflict retains raw local edits and captures remote version for explicit review',()=>{
 const f=client();const remote={...f.c.recToItem(f.key,{...f.rec,marca:'F'}),version:'asis1:remote'};
 f.c.combinarBajadaAsistencia({protocoloAsistencia:1,items:[remote]});const rec=f.c.loadAsis()[f.key];assert.equal(rec.marca,'P');assert.equal(rec.ts,f.rec.ts);assert.equal(rec.remoto.marca,'F');assert.equal(rec.versionServidor,undefined);
 const items=[f.c.recToItem(f.key,rec)];f.c.resolverSubidaAsistencia(items);assert.equal(items[0].versionBase,'');
 f.c.confirm=()=>true;f.c.resolverSubidaAsistencia(items);assert.equal(items[0].versionBase,'asis1:remote');assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[f.key]),true);
});
test('Late download cannot undo a receipt/version established after the request started',()=>{
 const f=client(),snapshot=clone(f.c.loadAsis()),it=f.c.recToItem(f.key,f.rec);
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:1,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:new'}]},[it],'synthetic-token');
 f.c.combinarBajadaAsistencia({protocoloAsistencia:1,items:[{...it,marca:'F',version:'asis1:old'}]},snapshot);
 assert.equal(f.c.loadAsis()[f.key].marca,'P');assert.equal(f.c.loadAsis()[f.key].versionServidor,'asis1:new');
});
test('Old backend reply and changed session cannot confirm or remove local assistance',()=>{
 const f=client(),it=f.c.recToItem(f.key,f.rec),before=f.memory.get('synthetic-asis');
 f.c.confirmarSubidaAsistencia({ok:true,guardados:1},[it],'synthetic-token');assert.equal(f.memory.get('synthetic-asis'),before);
 f.changeToken('new-token');f.c.confirmarSubidaAsistencia({protocoloAsistencia:1,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:one'}]},[it],'synthetic-token');assert.equal(f.memory.get('synthetic-asis'),before);
});
test('Legacy string marks and missing timestamps remain representable without invented clocks',()=>{
 const f=client(),it=f.c.recToItem(f.key,'P');assert.equal(it.marca,'P');assert.equal(it.ts,undefined);assert.equal(it.versionBase,'');
});
test('Revoked preflight session retires authorization but leaves assistance unchanged',async()=>{
 const f=client(),before=f.memory.get('synthetic-asis');let retired=0;f.c.retirarSesionAuxiliar=()=>{retired++;return true;};
 f.c.fetchLecturaNube=async()=>({text:async()=>JSON.stringify({ok:false,code:'SESSION',error:'Synthetic revoked session'})});await f.c.subirTodoNube();
 assert.equal(retired,1);assert.equal(f.writes.length,0);assert.equal(f.memory.get('synthetic-asis'),before);assert.equal(f.el('studentsRelogin').hidden,false);
});
test('Academic attendance and Auxiliar styles remain byte-identical to main after PR73',()=>{
 const original=file=>execFileSync('git',['show','d3fee52033c2c0b7244d00d52e9a5ae0799ed30f:'+file],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 assert.equal(read('registro.html').replace(/\r\n/g,'\n'),original('registro.html'));
 const old=original('auxiliar.html'),now=read('auxiliar.html').replace(/\r\n/g,'\n');assert.deepEqual([...now.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]),[...old.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]));
});


test('Explicit conflict resolution can be confirmed without changing mark, hour or justification',()=>{
 const f=client(),remote={...f.c.recToItem(f.key,f.rec),marca:'F',version:'asis1:remote'};
 f.c.combinarBajadaAsistencia({protocoloAsistencia:1,items:[remote]});f.c.confirm=()=>true;
 const items=[f.c.recToItem(f.key,f.c.loadAsis()[f.key])];f.c.resolverSubidaAsistencia(items);
 const rec=f.c.loadAsis()[f.key];assert.equal(rec.marca,f.rec.marca);assert.equal(rec.hora,f.rec.hora);assert.equal(rec.motivo,f.rec.motivo);assert.ok(rec.ts>=f.rec.ts);
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:1,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:resolved'}]},items,'synthetic-token');
 assert.equal(f.c.pendienteMarcaAsistencia(f.c.loadAsis()[f.key]),false);assert.equal(f.c.loadAsis()[f.key].remoto,undefined);
});

test('A late upload receipt cannot roll back a newer confirmed version',()=>{
 const f=client(),it=f.c.recToItem(f.key,f.rec);
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:1,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:new'}]},[it],'synthetic-token');
 const before=f.memory.get('synthetic-asis');
 f.c.confirmarSubidaAsistencia({protocoloAsistencia:1,resultados:[{clave:f.key,estado:'aceptada',version:'asis1:old'}]},[it],'synthetic-token');assert.equal(f.memory.get('synthetic-asis'),before);
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
