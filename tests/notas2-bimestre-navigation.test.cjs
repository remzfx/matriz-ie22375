'use strict';
// Differential navigation only: real roster loader, student cache, UI, academic core
// and connection controller. All clocks, profiles and transports are synthetic.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('registro.html','utf8');
function extract(name){const a=source.search(new RegExp('(?:async )?function '+name+'\\('));return source.slice(a,source.indexOf('\n}',a)+2);}
function fixture({closed=false,latency=4000,uiSource}={}){
 let now=1000000,sequence=0;const jobs=new Map(),metrics=[];
 class Clock extends Date{static now(){return now;}}
 const baseSource=fs.readFileSync('tests/notas2-connection-integration.test.cjs','utf8').split('\ntest(')[0];
 const scopedRequire=name=>name==='./registro-inline-modules.cjs'?{...require(name),readFile:(file,...args)=>file==='registro-notas2-ui.js'&&uiSource?uiSource:require(name).readFile(file,...args)}:name==='node:fs'?{...fs,readFileSync:(file,...args)=>file==='registro-notas2-ui.js'&&uiSource?uiSource:fs.readFileSync(file,...args)}:require(name);
 const f=new Function('require','Date',baseSource+'\nreturn fixture;')(scopedRequire,Clock)(),g=f.g;
 const ctx=g.ctxBase(),session={user:'synthetic',role:'docente',nivel:'secundaria',permisosVersion:1,token:Buffer.from(JSON.stringify({exp:now+3600000})).toString('base64url')+'.synthetic'};
 const storage=new Map(),cache={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 storage.set('ie22375_session_v1',JSON.stringify(session));
 g.setTimeout=(fn,ms)=>{jobs.set(++sequence,{fn,at:now+ms});return sequence;};g.clearTimeout=id=>jobs.delete(id);
 // The existing fixture's connection captures its timer functions at construction.
 // UI scheduling is driven explicitly; no periodic/load simulation is run.
 g.getLoginSession=()=>session;g.tokenPadron=session.token;g.sessionStorage=g.localStorage=cache;g.atob=v=>Buffer.from(v,'base64').toString();
 g.cloudClaveReg=()=>[ctx.nivel,ctx.bim,ctx.grado,ctx.seccion,ctx.area].join('||');g.prefijoReg=()=>g.cloudClaveReg()+'||';
 g.registroConsultaHistorica=()=>closed&&ctx.bim==='I';g.bimestreHabilitado=b=>!(closed&&b==='I');
 g.sincronizarPeriodosNube=async()=>true;g.nivel=ctx.nivel;g.cargandoEstudiantes=false;g.solicitudPadron=0;g.vencimientoCachePadron=null;
 g.store.studentAliases={};g.loadPeriodosAdmin=()=>({bimestres:{I:closed?'cerrado':'abierto',II:'abierto',III:'abierto'}});
 g.sliceRegistroArea=()=>Object.fromEntries(Object.entries(g.store).filter(([k])=>k!=='studentAliases').map(([k,v])=>[k,Array.isArray(v)?v:Object.fromEntries(Object.entries(v||{}).filter(([key])=>key.startsWith(g.prefijoReg())))]));
 g.document.getElementById=(original=>id=>{
  if(['selBim','selGrado','selSeccion'].includes(id)){const prop={selBim:'bim',selGrado:'grado',selSeccion:'seccion'}[id];return {get value(){return ctx[prop];},set value(v){ctx[prop]=prop==='grado'?Number(v):v;}};}
  return original(id);
 })(g.document.getElementById);
 g.document.querySelector=()=>null;g.guardarTodo=()=>true;g.saveStore=()=>{throw Error('Unexpected local write');};g.recordarPadron=()=>{};
 g.renderStudents=()=>{};g.llenarAulasPadron=()=>{};g.actualizarBotonesContextoRegistro=()=>{};
 g.onContexto=()=>g.IERegistroNotas2UI.refresh();g.sincronizarEdicionRegistro=()=>g.IERegistroNotas2UI.refresh();
 let draining=false,readyAt=null;const observe=()=>{if(readyAt===null&&f.api.canEdit())readyAt=now;};
 async function tick(ms){const end=now+ms;for(let turn=0;turn<100;turn++){
  await Promise.resolve();const due=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
  if(!due){now=Math.max(now,end);observe();return;}now=Math.max(now,due[1].at);jobs.delete(due[0]);const result=due[1].fn();if(result?.then)await result;observe();
 }throw Error('Unexpected timer loop');}
 g.fetch=async(_,options)=>{
  const body=JSON.parse(options.body),record={action:body.action,bimestre:body.bimestre||ctx.bim,grado:body.grado||ctx.grado,seccion:body.seccion||ctx.seccion,started:now};metrics.push(record);
  if(body.action==='loadstudents'&&!draining){draining=true;await tick(50);draining=false;}
  now+=latency;record.finished=now;
  let data;
  if(body.action==='academicstate')data={ok:true,academicReset:1,epoch:null,phase:null,contextAuthorization:{schema:1,user:session.user,role:session.role,nivel:session.nivel,permisosVersion:1,issuedAt:now,expiresAt:now+60000,epoch:null,contexts:['I','II','III'].filter(b=>!(closed&&b==='I')).flatMap(b=>[1,2].flatMap(grado=>['A','B'].map(seccion=>['secundaria',b,grado,seccion,ctx.area].join('||'))))}};
  else if(body.action==='loadstudents')data={ok:true,bimestre:body.bimestre,version:'roster-'+body.bimestre,inicializada:true,padronInicializado:true,estudiantes:[{nivel:'secundaria',grado:ctx.grado,seccion:ctx.seccion,idSiagie:'synthetic-'+body.bimestre,nombre:'FICTICIO '+body.bimestre}]};
  else if(body.action==='loadnotas2'){
   const key=[body.nivel,body.bimestre,body.grado,body.seccion,body.area].join('||'),payload=Object.fromEntries(Object.values(g.IERegistroNotas2.fields).flat().map(k=>[k,k==='sessions'?[]:{}]));
   payload.finales[key+'||C1||id:synthetic-'+body.bimestre]={nivel:'A',nota20:15,origen:'letra'};
   data={ok:true,notas2:1,key,exists:true,legacy:false,readonly:closed&&body.bimestre==='I',versions:{calificar:1,promedios:1,asistencia:1},at:{calificar:1,promedios:1,asistencia:1},payload};
  }else throw Error('Unexpected action '+body.action);
  return {ok:true,status:200,text:async()=>JSON.stringify(data),json:async()=>JSON.parse(JSON.stringify(data))};
 };
 vm.runInContext(fs.readFileSync('students.js','utf8'),g);
 g.bdEstudiantes=g.IEStudents.empty();
 for(const name of ['bloquearRegistroMientrasValida','actualizarAvisoPadronContexto','estadoPadron','errorPadronLocal','pintarPadronInmediato','cargarPadronRegistro','cambiarBimestreRegistro'])vm.runInContext(extract(name),g);
 // Alias persistence is outside this navigation change; use a non-writing test capture.
 g.saveStore=()=>{};g.registroSoloLectura=()=>!g.IERegistroNotas2UI.canEdit();g.vigilarCachePadron=()=>{};
 async function visit(bim,grado=1,seccion='A'){
  const start=now,index=metrics.length;readyAt=null;
  if(g.padronBimestre!==bim){ctx.bim=bim;await g.cambiarBimestreRegistro();}
  ctx.grado=grado;ctx.seccion=seccion;g.IERegistroNotas2UI.refresh();await tick(30);
  observe();const reads=metrics.slice(index),result={bim,grado,seccion,ms:now-start,readyMs:readyAt===null?null:readyAt-start,academicstate:reads.filter(r=>r.action==='academicstate').length,loadnotas2:reads.filter(r=>r.action==='loadnotas2').length,loadstudents:reads.filter(r=>r.action==='loadstudents').length,state:f.connection.snapshot().state};
  return result;
 }
 return {f,g,ctx,session,visit,metrics,advance:ms=>now+=ms};
}
const baseline=require('node:child_process').execFileSync('git',['show','e8a9fe82a2b4dec0bb681af40f9818c02c1d4f61:registro-notas2-ui.js'],{encoding:'utf8'});
test('III-I-III-I: cold roster no longer discards a live scope; returning clients download no notes',async()=>{
 const measured=[];
 for(const [label,uiSource]of [['before',baseline],['after',undefined]]){
  const f=fixture({uiSource}),navigation=[];f.g.padronBimestre='';
  for(const bim of ['III','I','III','I'])navigation.push(await f.visit(bim));
  assert.deepEqual(navigation.map(r=>r.loadstudents),[1,1,1,1]);
  assert.deepEqual(navigation.map(r=>r.loadnotas2),[1,1,0,0]);
  assert.deepEqual(navigation.map(r=>r.academicstate),label==='before'?[1,1,0,0]:[1,0,0,0]);
  assert.ok(navigation.slice(2).every(r=>r.readyMs<100));
  assert.equal(f.metrics.some(r=>r.action.startsWith('save')),false);
  assert.equal(f.g.bdEstudiantes.bimestre,'I');assert.equal(f.g.bdEstudiantes.secundaria.estudiantes[0].idSiagie,'synthetic-I');
  assert.equal(f.g.IEStudents.peekRoster('III').secundaria.estudiantes[0].idSiagie,'synthetic-III');
  measured.push({label,navigation});
 }
 console.log(JSON.stringify({syntheticLatencyMs:4000,measured}));
});
for(const latency of [3000,5000])test('prepared returns and classroom changes preserve the original scope with '+latency+'ms reads',async()=>{
 const f=fixture({latency});f.g.padronBimestre='';await f.visit('III');await f.visit('I');
 for(const bim of ['III','I']){
  const first=await f.visit(bim,2,'A'),section=await f.visit(bim,2,'B'),back=await f.visit(bim,1,'A');
  assert.equal(first.academicstate+section.academicstate+back.academicstate,0);
  assert.equal(section.loadstudents+back.loadstudents,0);
  assert.equal(section.loadnotas2,1);assert.equal(back.loadnotas2,0);
  assert.ok(back.readyMs<100);
 }
 assert.equal(f.metrics.filter(r=>r.action==='academicstate').length,1);
 assert.equal(f.metrics.some(r=>r.action.startsWith('save')),false);
});
test('expired scope revalidates on return without downloading an initialized academic client again',async()=>{
 const old=fixture({uiSource:baseline});old.g.padronBimestre='';await old.visit('III');old.advance(60001);
 assert.equal((await old.visit('III')).academicstate,0,'Baseline incorrectly retained the generic 150-second context grant');
 const f=fixture();f.g.padronBimestre='';await f.visit('III');const originalDeadline=f.f.connection.snapshot().validUntil;await f.visit('I');assert.equal(f.f.connection.snapshot().validUntil,originalDeadline);f.advance(60001);
 const result=await f.visit('III');assert.equal(result.academicstate,1);assert.equal(result.loadnotas2,0);assert.equal(result.loadstudents,1);assert.equal(result.state,'connected');
});
test('closed I is excluded from the reusable scope and never becomes editable on repeated visits',async()=>{
 const f=fixture({closed:true});f.g.padronBimestre='';await f.visit('III');
 for(let n=0;n<2;n++){
  const result=await f.visit('I');
  // Closed periods have no shared scope: the cached render and the refreshed
  // roster each retain their existing authenticated check on return.
  assert.equal(result.academicstate,n===0?1:2);assert.equal(result.state,'readonly');assert.equal(f.f.api.canEdit(),false);
  assert.equal(result.loadnotas2,n===0?1:0);await f.visit('III');
 }
 assert.equal(f.metrics.some(r=>r.action.startsWith('save')),false);
});
test('historical comparisons allow only the literal navigation fix and expose authorization mutations',()=>{
 const normalize=require('./notas2-bimestre-navigation-boundary.cjs'),raw=fs.readFileSync('registro-notas2-ui.js','utf8');
 assert.equal(normalize('registro-notas2-ui.js',raw),baseline.replace(/\r\n/g,'\n'));
 for(const [from,to]of [["cargandoEstudiantes&&!authorized()","cargandoEstudiantes"],["lease=lease||contextAuthorization();","lease=null;"],["a.until<=Date.now()","false"]]){
  assert.ok(raw.includes(from));assert.notEqual(normalize('registro-notas2-ui.js',raw.replace(from,to)),normalize('registro-notas2-ui.js',raw));
 }
});
module.exports={fixture};
