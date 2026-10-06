const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const fixture=new Function('require','__dirname',read('tests/auxiliar-production-diagnostic.test.cjs').split('\nfor(const nivel')[0]+'\nreturn fixture;')(require,__dirname);
const extract=name=>{const s=read('auxiliar.html'),a=s.search(new RegExp('(?:async )?function '+name+'\\('));return s.slice(a,s.indexOf('\n}',a)+2);};
const flush=async()=>{for(let i=0;i<70;i++)await Promise.resolve();};

test('Auxiliary paints the exact authorized cache before a slow read and later refreshes it',async()=>{
  const s=fixture('secundaria');await s.context.intentarLogin();await s.context.ensureBD();
  let release;s.context.fetch=()=>new Promise(r=>{release=r});
  const task=s.context.ensureBD();
  assert.ok(s.run('BD.secundaria.estudiantes.length')>0);
  assert.match(s.el('studentsStatus').textContent,/datos locales.*verificando/);
  await flush();release({ok:true,json:async()=>({ok:true,inicializada:true,version:'new',estudiantes:[{nivel:'secundaria',grado:2,seccion:'B',nombre:'Synthetic new'}]})});
  await task;
  assert.equal(s.run('BD.secundaria.estudiantes[0].grado'),2);
  assert.equal(s.context.IEStudents.peek().version,'new');assert.match(s.el('studentsStatus').textContent,/Datos actualizados/);
  assert.ok(JSON.parse(s.stored.get('ie22375_aux_timing_v1')).cachePaintMs>=0);
  assert.doesNotMatch(s.stored.get('ie22375_aux_timing_v1'),/token|Synthetic|password/);
});

test('Concurrent first access to Auxiliary shares one student request',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();
  const a=s.context.IEStudents.load(),b=s.context.IEStudents.load();await Promise.all([a,b]);
  assert.equal(s.calls.filter(c=>c.body.action==='loadstudents').length,1);
});

test('Auxiliary with a failed background read preserves the cached list and session',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();await s.context.ensureBD();
  const token=s.context.getSession().token;
  s.context.setTimeout=(fn,ms)=>{if(ms===1200)queueMicrotask(fn);return 0};s.context.clearTimeout=()=>{};
  s.context.fetch=async()=>{throw Error('synthetic down');};await s.context.ensureBD();
  assert.ok(s.run('BD.primaria.estudiantes.length')>0);assert.equal(s.context.getSession().token,token);
  assert.match(s.el('studentsStatus').textContent,/sin conexión/);assert.equal(s.el('studentsRetry').hidden,false);
});

test('A new auxiliary token never paints the previous token cache',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();await s.context.ensureBD();
  s.configure();await s.context.intentarLogin();assert.equal(s.context.IEStudents.peek(),null);
  s.context.IEStudents.load=()=>new Promise(()=>{});
  s.context.ensureBD();
  assert.equal(s.run('BD.primaria.estudiantes.length'),0);assert.equal(s.el('lista').innerHTML,'');
});

for(const nivel of ['primaria','secundaria'])test(nivel+' mass-send grades and classrooms come from the authorized student base, without WA links',async()=>{
  const s=fixture(nivel);await s.context.intentarLogin();await s.context.ensureBD();
  const list=s.run('BD')[nivel].estudiantes,grados=[...new Set(list.map(a=>Number(a.grado)))];
  for(const g of grados)assert.ok(s.el('selGradoGrupos').innerHTML.includes('value="'+g+'"'));
  assert.match(s.el('waCola').innerHTML,/Grupo de WhatsApp no configurado/);
  const other=nivel==='primaria'?'secundaria':'primaria';
  s.el('selNivelGrupos').value=other;s.context.actualizarGradosGrupos();assert.equal(s.el('waCola').innerHTML,'');
});

test('Mass-send uses the actual 5th secondary single section and lists an unconfigured classroom',async()=>{
  const s=fixture('secundaria');await s.context.intentarLogin();await s.context.ensureBD();
  s.run("BD.secundaria.estudiantes=[{nivel:'secundaria',grado:5,seccion:'Única',nombre:'Synthetic Single'}]");
  s.context.actualizarGradosGrupos();assert.match(s.el('waCola').innerHTML,/5° Única/);
  assert.doesNotMatch(s.el('waCola').innerHTML,/5° A|5° B/);
});

test('Switching views only renders shared memory and never requests students or WhatsApp',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();await s.context.ensureBD();
  s.run(extract('verMenu'));const count=s.calls.length;
  s.context.verMenu('grupos');s.context.verMenu('asis');s.context.verMenu('grupos');
  assert.equal(s.calls.length,count);
});

test('WhatsApp and schedule concurrent reads deduplicate and WA refresh is throttled after success',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();
  s.run("let HORARIO_CFG={},horarioVerificado=false,horarioPendiente=null,waPendiente=null,waToken='',waActualizado=0;const HORARIO_KEY='synthetic-schedule';function horarioDefecto(){return {defaults:{}}}");
  for(const name of ['ensureHorario','cargarHorarioAuxiliar','bajarGruposWa','cargarGruposWaAuxiliar','tokenSesionAuxiliar'])s.run(extract(name));
  let reads=0,resolve;s.context.IEStudents.fetchJSON=()=>{reads++;return new Promise(r=>{resolve=r});};
  const a=s.context.bajarGruposWa(),b=s.context.bajarGruposWa();assert.equal(a,b);assert.equal(reads,1);
  resolve({ok:true,grupos:[]});await a;await s.context.bajarGruposWa();assert.equal(reads,1);
  const c=s.context.ensureHorario(),d=s.context.ensureHorario();assert.equal(c,d);assert.equal(reads,2);
  resolve({defaults:{}});await c;
});

// Distinct JS realms simulate a real document navigation. The SW owns the in-flight request.
function bridge(server) {
  const handlers={},waits=[],requests=[];let release;
  const scope='https://synthetic.example/school/';
  const workerContext=vm.createContext({URL,Request,Response,Headers,Map,Set,Promise,AbortController,atob,Date,
    setTimeout:(fn,ms)=>{const t=setTimeout(fn,ms);t.unref();return t},clearTimeout,
    self:{registration:{scope},addEventListener:(type,fn)=>{handlers[type]=fn}},
    fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return new Promise(r=>{release=()=>r(new Response(JSON.stringify(server.post(JSON.parse(options.body))),{headers:{'Content-Type':'application/json'}}));});}
  });
  vm.runInContext(read('sw.js'),workerContext);
  class Channel {
    constructor(){
      this.port1={close(){}};this.port2={close(){}};
      this.port1.postMessage=data=>queueMicrotask(()=>{if(this.port2.onmessage)this.port2.onmessage({data})});
      this.port2.postMessage=data=>queueMicrotask(()=>{if(this.port1.onmessage)this.port1.onmessage({data})});
    }
  }
  const controller={postMessage:(data,ports)=>handlers.message({data,ports,source:{url:scope+'index.html'},waitUntil:p=>waits.push(p)})};
  return {controller,Channel,requests,release:()=>release(),context:workerContext,handlers,waits,scope};
}

test('Post-login preload and a new Auxiliary document share one actual server request across navigation',async()=>{
  const s=fixture('secundaria'),w=bridge(s.server);
  s.context.navigator={serviceWorker:{controller:w.controller}};s.context.MessageChannel=w.Channel;
  let hub=0;s.context.mostrarHub=()=>{hub++};await s.context.intentarLogin();assert.equal(hub,1);
  await flush();assert.equal(w.requests.length,1);
  const next=vm.createContext({window:{},navigator:{serviceWorker:{controller:w.controller}},MessageChannel:w.Channel,
    document:{getElementById:()=>null},sessionStorage:s.context.sessionStorage,localStorage:s.context.localStorage,atob,Date,setTimeout,clearTimeout});
  vm.runInContext(read('students.js'),next);
  const task=next.window.IEStudents.load();await flush();assert.equal(w.requests.length,1);
  w.release();const base=await task;await Promise.all(w.waits);
  assert.ok(base.secundaria.estudiantes.length>0);assert.equal(base.primaria.estudiantes.length,0);
  assert.equal(w.requests[0].action,'loadstudents');
});

test('Without a capable worker login never starts an abandoned preload or blocks the hub',async()=>{
  const s=fixture('primaria');let shown=0;s.context.mostrarHub=()=>shown++;
  await s.context.intentarLogin();await flush();assert.equal(shown,1);
  assert.equal(s.calls.filter(c=>c.body.action==='loadstudents').length,0);
  await s.context.ensureBD();assert.equal(s.calls.filter(c=>c.body.action==='loadstudents').length,1);
});

test('Read bridge rejects expired tokens and cannot send a write action or broaden scope',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();const w=bridge(s.server),answers=[];
  const expired=Buffer.from(JSON.stringify({role:'auxiliar',exp:Date.now()-1})).toString('base64url')+'.synthetic';
  w.handlers.message({data:{type:'IE_STUDENTS_READ_V1',token:expired,action:'saveasis',nivel:'secundaria'},ports:[{postMessage:v=>answers.push(v)}],source:{url:w.scope+'auxiliar.html'},waitUntil:p=>w.waits.push(p)});
  assert.equal(answers[0].error.code,'SESSION');assert.equal(w.requests.length,0);
  w.handlers.message({data:{type:'IE_STUDENTS_READ_V1',token:s.context.getSession().token,action:'saveasis',nivel:'secundaria'},ports:[{postMessage:v=>answers.push(v)}],source:{url:w.scope+'auxiliar.html'},waitUntil:p=>w.waits.push(p)});
  await flush();w.release();await Promise.all(w.waits);
  assert.deepEqual(Object.keys(w.requests[0]).sort(),['action','token']);assert.equal(w.requests[0].action,'loadstudents');
  assert.ok(answers.at(-1).response.estudiantes.every(a=>a.nivel==='primaria'));
});

test('Read bridge delivers an explicit revocation; preload cannot authorize a revoked token',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();await s.context.ensureBD();
  const w=bridge(s.server);s.context.navigator={serviceWorker:{controller:w.controller}};s.context.MessageChannel=w.Channel;
  s.configure();const read=s.context.ensureBD(),reject=assert.rejects(read,e=>e.authorizationRejected);
  await flush();w.release();await reject;
  assert.equal(s.context.getSession(),null);assert.equal(s.context.IEStudents.peek(),null);
});

test('Completed preload seeds cache, but subsequent verification always obtains a new server response',async()=>{
  const s=fixture('secundaria');await s.context.intentarLogin();const w=bridge(s.server);
  s.context.navigator={serviceWorker:{controller:w.controller}};s.context.MessageChannel=w.Channel;
  const preload=s.context.IEStudents.preload();await flush();w.release();await preload;
  assert.equal(w.requests.length,1);
  assert.ok(s.context.IEStudents.peek());
  const fresh=s.context.IEStudents.load();await flush();assert.equal(w.requests.length,2);w.release();await fresh;
});

test('Service Worker read bridge rejects clients outside its scope',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();const w=bridge(s.server),answers=[];
  w.handlers.message({data:{type:'IE_STUDENTS_READ_V1',token:s.context.getSession().token},ports:[{postMessage:v=>answers.push(v)}],source:{url:'https://other.example/index.html'},waitUntil:p=>w.waits.push(p)});
  assert.equal(w.requests.length,0);assert.equal(answers.length,0);
});

test('Auxiliary login performs one ConfigSistema data read, without duplicate config work',()=>{
  const s=fixture('primaria');s.server.state.reads.length=0;
  const result=s.server.post({action:'login',tipo:'auxiliar',usuario:'diagnostic-aux',password:'synthetic-pass'});
  assert.equal(result.ok,true);
  assert.equal(s.server.state.reads.filter(r=>r.name==='ConfigSistema').length,1);
});

test('A completed preload cannot mask a later configuration revocation',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();const w=bridge(s.server);
  s.context.navigator={serviceWorker:{controller:w.controller}};s.context.MessageChannel=w.Channel;
  const pre=s.context.IEStudents.preload();await flush();w.release();await pre;s.configure();
  const task=s.context.ensureBD(),rejected=assert.rejects(task,e=>e.authorizationRejected);
  await flush();assert.equal(w.requests.length,2);w.release();await rejected;
  assert.equal(s.context.getSession(),null);assert.equal(s.context.IEStudents.peek(),null);
});

test('Hub preload denial removes its matching session but leaves pending attendance',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();
  const pending=JSON.stringify({synthetic:{marca:'T'}});s.local.set('ie22375_asistencia_colegio_v1',pending);
  s.context.IEStudents.preload=async()=>{throw {code:'DENIED',authorizationRejected:true}};
  s.context.precargarAuxiliar();await flush();
  assert.equal(s.context.getSession(),null);assert.equal(s.local.get('ie22375_asistencia_colegio_v1'),pending);
});
