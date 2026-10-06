const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
function extract(p,name){
  const src=read(p),start=src.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start>=0,name+' must exist');
  const firstLine=src.slice(start).split('\n')[0];
  if(firstLine.trimEnd().endsWith('}'))return firstLine;
  const indent=src.slice(src.lastIndexOf('\n',start-1)+1,start);
  const end=src.indexOf('\n'+indent+'}',start)+('\n'+indent+'}').length;
  assert.ok(end>start);return src.slice(start,end);
}
function fixture(role='admin'){
  const session={role,user:role==='docente'?'synthetic-teacher':role,token:Buffer.from(JSON.stringify({role,exp:Date.now()+12*60*60*1000})).toString('base64url')+'.synthetic-server-signature'};
  const memory=new Map([['ie22375_session_v1',JSON.stringify(session)]]);
  const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
  const calls=[],elements=new Map(),alerts=[];
  function el(id){if(!elements.has(id))elements.set(id,{value:'',style:{},textContent:'',innerHTML:'',classList:{add(){},remove(){}}});return elements.get(id);}
  const c=vm.createContext({window:{},sessionStorage:storage,localStorage:storage,atob,console,Date,performance,
    document:{getElementById:el,querySelectorAll:()=>[],querySelector:sel=>sel==='main'?{inert:false,setAttribute(){},querySelectorAll:()=>[]}:null},alert:v=>alerts.push(v),confirm:()=>true,setTimeout:(fn,ms)=>{if(ms<2000)queueMicrotask(fn);return 0;},clearTimeout(){},
    fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true,version:'synthetic-current',bimestre:JSON.parse(options.body).bimestre || '',inicializada:true,estudiantes:[{nivel:'primaria',grado:1,seccion:'Única',orden:1,nombre:'Synthetic Primary'},{nivel:'secundaria',grado:1,seccion:'A',orden:1,nombre:'Synthetic Secondary'}]})};}
  });
  c.IEAuxPermissions={configurar(){},niveles(){return ['primaria','secundaria']}};
  new vm.Script(read('registro-evaluation.js')).runInContext(c);new vm.Script(read('students.js')).runInContext(c);c.IEStudents=c.window.IEStudents;
  const run=code=>new vm.Script(code).runInContext(c);
  return {c,run,calls,memory,storage,session,elements,alerts};
}
function checkRequest(s,bimestre){
  assert.equal(s.calls.length,1);const {url,options}=s.calls[0];
  assert.match(url,/^https:\/\/script.google.com\//);assert.equal(options.method,'POST');
  assert.equal(options.headers['Content-Type'],'text/plain;charset=utf-8');
  const body=JSON.parse(options.body);assert.equal(body.action,'loadstudents');assert.equal(body.token,s.session.token);
  assert.deepEqual(Object.keys(body).sort(),bimestre?['action','bimestre','token']:['action','token']);if(bimestre)assert.equal(body.bimestre,bimestre);
}
test('Admin real loader consumes the protected backend response',async()=>{
  const s=fixture();s.run('let bdGuardando=false,bdPendiente=false,baseCargada=false;let recibido;function estadoBD(){};function actualizarResumen(){};function aplicarBaseServidor(base){recibido=base;}');
  s.run(extract('admin.html','cargarEstudiantesAdmin'));await s.c.cargarEstudiantesAdmin();checkRequest(s);
  assert.equal(s.run('recibido.primaria.estudiantes[0].nombre'),'Synthetic Primary');
});
for(const file of ['primaria.html','secundaria.html'])test(file+': real matrix loader derives student totals from protected data',async()=>{
  const s=fixture('docente');s.run("let baseOficialEstudiantes=[];let estado={grado:'PRIMERO'};function mostrarToast(){};function syncInputTotalEstudiantes(){};function renderizarAreas(){};function renderizarResumen(){}");
  s.run(extract(file,'estadoEstudiantes'));s.run(extract(file,'cargarBaseOficialCache'));s.run(extract(file,'cargarBaseOficialEstudiantes'));await s.c.cargarBaseOficialEstudiantes();checkRequest(s);
  assert.equal(s.run('baseOficialEstudiantes.length'),1);
  if(file==='primaria.html'){s.run(extract(file,'getTotalEstudiantes'));assert.equal(s.c.getTotalEstudiantes(),1);s.run('estado.grado="SEGUNDO"');assert.equal(s.c.getTotalEstudiantes(),0);}
  else{s.run(extract(file,'normalizarSeccionBD'));s.run(extract(file,'totalEstudiantesDesdeBD'));assert.equal(s.c.totalEstudiantesDesdeBD('1°','A'),1);assert.equal(s.c.totalEstudiantesDesdeBD('2°','B'),0);}
});
for(const file of ['auxiliar.html','photochecks.html'])test(file+': real loader uses protected students instead of the old global roster',async()=>{
  const s=fixture(file==='auxiliar.html'?'auxiliar':'admin');s.run('let BD=null,cargandoEstudiantesAux=false;const auxiliarInicio=performance.now();function medirAuxiliar(){};function pintarBaseAuxiliar(base){BD=base;}function toast(){};function onNivel(){}');
  s.run(extract(file,'ensureBD'));await s.c.ensureBD();checkRequest(s);
  assert.equal(s.run('BD.primaria.estudiantes[0].nombre'),'Synthetic Primary');
});
test('Registro startup uses cached period configuration without waiting for the first cloud refresh',async()=>{
  const s=fixture('docente');
  s.run(`let bdEstudiantes=IEStudents.empty(),cargandoEstudiantes=false,padronBimestre='',solicitudPadron=0,padronVerificadoServidor=false,tokenPadron='',vencimientoCachePadron,nivel,areaActual,sesionActiva,notas,dirty,modoCalif;
    function ctxBase(){return {nivel,bim:document.getElementById('selBim').value}};function recordarPadron(){};function saveStore(){};function toast(){};function bloquearRegistroMientrasValida(){};function pintarPadronInmediato(base,b){bdEstudiantes=base;padronBimestre=b;};
    function nivelPermitido(){return 'primaria'};function loadStore(){};function loadPeriodosAdmin(){return {bimestres:{I:'cerrado',II:'cerrado',III:'abierto',IV:'bloqueado'}}};
    function pintarBimestresRegistro(){document.getElementById('selBim').value='III'};function gradosPermitidos(){return [1]};function aulasPermitidas(){return null};
    function hoyISO(){return '2026-10-04'};function aplicarDocenteSesion(){};function cargarDocentesAdminLocal(){};function refrescarDocentesAdminRegistro(){};function actualizarDocenteResponsable(){};;function onGrado(){};function areas(){return ['Comunicación']};function renderAreas(){};
    function fillComps(){};function syncModoBtns(){};function updateHdr(){};function renderSesiones(){};function renderStudents(){};function fillCaps(){};
    function markClean(){};function aplicarModoAdminRegistro(){};function fixHdrHeight(){};function onContexto(){};let periodFetches=0;
    function sincronizarPeriodosNube(){periodFetches++;return new Promise(()=>{});} `);
  for(const name of ['loadBD','llenarAulasPadron','registroSoloLectura','registroNubeNoVerificada','sincronizarEdicionRegistro','estadoPadron','vigilarCachePadron','bloquearRegistroMientrasValida','pintarPadronInmediato','cargarPadronRegistro','entrarNivel'])s.run(extract('registro.html',name));
  const p=s.c.entrarNivel('primaria');
  await new Promise(r=>setTimeout(r,0));
  assert.equal(s.run('padronBimestre'),'III');
  assert.equal(s.run('periodFetches'),1,'one background refresh should start');
  // Do not await p because the synthetic background refresh intentionally never resolves.
});

test('Registro enters its current flow only after protected students are loaded',async()=>{
  const s=fixture('docente');
  s.run(`let bdEstudiantes=IEStudents.empty(),cargandoEstudiantes=false,padronBimestre='',solicitudPadron=0,padronVerificadoServidor=false,tokenPadron='',vencimientoCachePadron,nivel,areaActual,sesionActiva,notas,dirty,modoCalif;function recordarPadron(){};function saveStore(){};function toast(){};
    function ctxBase(){return {nivel,bim:document.getElementById('selBim').value}};function nivelPermitido(){return 'primaria'};function loadStore(){};function pintarBimestresRegistro(){document.getElementById('selBim').value='III'};function loadPeriodosAdmin(){};
    function gradosPermitidos(){return [1]};function aulasPermitidas(){return null};function hoyISO(){return '2026-10-03'};
    function aplicarDocenteSesion(){};function cargarDocentesAdminLocal(){};function refrescarDocentesAdminRegistro(){};function actualizarDocenteResponsable(){};;function onGrado(){};function areas(){return ['Comunicación']};function renderAreas(){};
    function fillComps(){};function syncModoBtns(){};function updateHdr(){};function renderSesiones(){};function renderStudents(){};
    function fillCaps(){};function markClean(){};function aplicarModoAdminRegistro(){};function fixHdrHeight(){};
    function sincronizarPeriodosNube(){return Promise.resolve()};function onContexto(){};`);
  for(const name of ['loadBD','llenarAulasPadron','registroSoloLectura','registroNubeNoVerificada','sincronizarEdicionRegistro','estadoPadron','vigilarCachePadron','bloquearRegistroMientrasValida','pintarPadronInmediato','cargarPadronRegistro','entrarNivel'])s.run(extract('registro.html',name));
  await s.c.entrarNivel('primaria');await new Promise(r=>setTimeout(r,0));checkRequest(s,'III');
  assert.match(s.elements.get('selGrado').innerHTML,/value="1"/);
  assert.equal(s.c.loadBD().primaria.estudiantes[0].nombre,'Synthetic Primary');
});
test('Cached students are tied to the exact token and never read the legacy school-wide key',async()=>{
  const s=fixture();s.memory.set('ie22375_admin_bd_v1',JSON.stringify({real:false}));
  await s.c.IEStudents.load();assert.equal(s.c.IEStudents.peek().primaria.estudiantes.length,1);
  s.storage.setItem('ie22375_session_v1',JSON.stringify({...s.session,token:Buffer.from(JSON.stringify({exp:Date.now()+600000})).toString('base64url')+'.another-signature'}));
  assert.equal(s.c.IEStudents.peek(),null);
  assert.equal(s.memory.has('ie22375_admin_bd_v1'),true); // Ignore rather than silently delete an old Admin backup.
});
test('Admin edits cannot mutate the authorized cache before server save',async()=>{
  const s=fixture(),base=await s.c.IEStudents.load();base.primaria.estudiantes[0].nombre='Unsaved Synthetic Edit';
  assert.equal(s.c.IEStudents.peek().primaria.estudiantes[0].nombre,'Synthetic Primary');
});
test('Offline fallback persists locally but never outlives the signed token and keeps the same scope',async()=>{
  const s=fixture();await s.c.IEStudents.load();s.c.fetch=async()=>{throw Error('offline');};
  const offline=await s.c.IEStudents.load();assert.equal(offline.offline,true);
  assert.equal(offline.primaria.estudiantes[0].nombre,'Synthetic Primary');
  const cache=JSON.parse(s.memory.get('ie22375_students_session_v1'));const exp=JSON.parse(Buffer.from(s.session.token.split('.')[0],'base64url').toString()).exp;
  assert.ok(cache.until<=exp);assert.ok(cache.until>Date.now()+600000);
  s.c.Date={now:()=>exp+1};
  await assert.rejects(s.c.IEStudents.load(),/Sesión ausente o vencida|conectar/);
  assert.equal(s.c.IEStudents.peek(),null);
});
test('Network failure without a session-bound cache does not load legacy data',async()=>{
  const s=fixture();s.memory.set('ie22375_admin_bd_v1',JSON.stringify({primaria:{estudiantes:[{nombre:'Legacy synthetic'}]}}));s.c.fetch=async()=>{throw Error('offline');};
  await assert.rejects(s.c.IEStudents.load(),/conectar/);assert.equal(s.c.IEStudents.peek(),null);
});
test('Server revocation rejects and clears the cache even when offline fallback previously existed',async()=>{
  const s=fixture();await s.c.IEStudents.load();s.c.fetch=async()=>({ok:true,json:async()=>({ok:false,code:'SESSION',error:'Synthetic revoked token'})});
  await assert.rejects(s.c.IEStudents.load(),/revoked/);assert.equal(s.c.IEStudents.peek(),null);
});
test('Missing/expired token is rejected before a client request',async()=>{
  for(const session of [null,{token:Buffer.from(JSON.stringify({exp:Date.now()-1})).toString('base64url')+'.expired'}]){
    const s=fixture();s.storage.setItem('ie22375_session_v1',JSON.stringify(session));
    await assert.rejects(s.c.IEStudents.load(),/Sesión ausente o vencida/);assert.equal(s.calls.length,0);
  }
});
test('Stage B fails closed if the private base was not initialized in stage A',async()=>{
  const s=fixture();s.c.fetch=async()=>({ok:true,json:async()=>({ok:true,inicializada:false,version:'',estudiantes:[]})});
  await assert.rejects(s.c.IEStudents.load(),/no inicializada/);assert.equal(s.c.IEStudents.peek(),null);
});
test('Session switched during an in-flight request cannot receive/cache the old response',async()=>{
  const s=fixture(),fetch=s.c.fetch;s.c.fetch=async(...args)=>{const result=await fetch(...args);s.storage.removeItem('ie22375_session_v1');return result;};
  await assert.rejects(s.c.IEStudents.load(),/sesión cambió/i);assert.equal(s.c.IEStudents.peek(),null);
});
test('Photochecks keep the current QR payload and render QR locally without exposing names in remote image URLs',()=>{
  const s=fixture();s.run('let qrCalls=[];function QRCode(el,opts){qrCalls.push(opts);}QRCode.CorrectLevel={M:1};');
  for(const name of ['payload','textoHtml','cardHtml','pintar'])s.run(extract('photochecks.html',name));
  s.c.pintar([{nivel:'primaria',grado:1,seccion:'Única',nombre:'Synthetic <Student>'}]);
  assert.equal(s.run('qrCalls[0].text'),'IE22375|primaria|1|Única|Synthetic <Student>');
  assert.match(s.elements.get('sheet').innerHTML,/Synthetic &lt;Student&gt;/);
  assert.doesNotMatch(s.elements.get('sheet').innerHTML,/<img|https:/);
});
test('Production consumers include the shared protected loader; no public base/old fallback survives',()=>{
  assert.equal(fs.existsSync(path.join(root,'bd_oficial_2026.json')),false);
  for(const file of ['admin.html','registro.html','primaria.html','secundaria.html','auxiliar.html','photochecks.html']){
    const src=read(file);assert.match(src,/<script src="students.js"><\/script>/);assert.match(src,file==='registro.html'?/IEStudents\.loadRoster\(/:/IEStudents\.load\(/);
    assert.doesNotMatch(src,/BD_EMP|bd_oficial_2026\.json|ie22375_admin_bd_v1|ie22375_bd_sec_cache_v1/);
  }
  assert.doesNotMatch(read('photochecks.html'),/api\.qrserver\.com|corregirNiveles/);
  new vm.Script(read('students.js'));
});

test('loadRoster keeps bimestre, identifiers and explicit safe fallback; invalid bimesters never request a global base',async()=>{
  const s=fixture();s.c.fetch=async(url,options)=>{
    s.calls.push({url,options});return {ok:true,json:async()=>({ok:true,inicializada:true,version:'v',bimestre:'III',padronInicializado:false,fuentePadron:'actual',estudiantes:[{nivel:'secundaria',grado:4,seccion:'B',nombre:'Synthetic Student',idSiagie:'42',codigoEstudiante:'00042',estadoMatricula:'TRASLADADO'}]})};
  };
  const base=await s.c.IEStudents.loadRoster('III');checkRequest(s,'III');
  assert.equal(s.c.IEStudents.peekRoster('III').secundaria.estudiantes[0].idSiagie,'42');
  assert.equal(s.c.IEStudents.peekRoster('IV'),null);
  assert.equal(base.bimestre,'III');assert.equal(base.padronInicializado,false);assert.equal(base.secundaria.estudiantes[0].idSiagie,'42');
  assert.equal(base.secundaria.estudiantes[0].codigoEstudiante,'00042');
  await assert.rejects(s.c.IEStudents.loadRoster('V'),/inválido/);assert.equal(s.calls.length,1);
  s.c.fetch=async()=>{throw Error('offline');};
  const cached=await s.c.IEStudents.loadRoster('III');assert.equal(cached.offline,true);assert.equal(cached.padronInicializado,false);
  await assert.rejects(s.c.IEStudents.loadRoster('IV'),/conectar/);
});

test('Initial inspection remains manual and can inspect an empty private base without enabling a public fallback',async()=>{
  const s=fixture();s.c.fetch=async()=>({ok:true,json:async()=>({ok:true,inicializada:false,version:'',estudiantes:[]})});
  assert.equal((await s.c.IEStudents.inspect()).inicializada,false);
  await assert.rejects(s.c.IEStudents.load(),/no inicializada/);assert.equal(s.c.IEStudents.peek(),null);
});

test('Persistent authorized roster survives a new page session only for the exact token and bimestre',async()=>{
 const s=fixture('docente');await s.c.IEStudents.loadRoster('III');
 const tabs=new Map([['ie22375_session_v1',JSON.stringify(s.session)]]);
 s.c.sessionStorage={getItem:k=>tabs.get(k)||null,setItem:(k,v)=>tabs.set(k,v),removeItem:k=>tabs.delete(k)};
 s.c.window={};new vm.Script(read('students.js')).runInContext(s.c);s.c.IEStudents=s.c.window.IEStudents;
 assert.equal(s.c.IEStudents.peekRoster('III').primaria.estudiantes.length,1);assert.equal(s.c.IEStudents.peekRoster('IV'),null);
 s.c.sessionStorage.setItem('ie22375_session_v1',JSON.stringify({...s.session,token:Buffer.from(JSON.stringify({exp:Date.now()+600000})).toString('base64url')+'.new'}));
 assert.equal(s.c.IEStudents.peekRoster('III'),null);
});

test('Cache lifetime is capped at 24 hours even when signed token lifetime is longer',async()=>{
 const s=fixture();const now=Date.now();s.c.Date={now:()=>now};
 s.storage.setItem('ie22375_session_v1',JSON.stringify({role:'admin',token:Buffer.from(JSON.stringify({exp:now+48*3600000})).toString('base64url')+'.synthetic'}));
 await s.c.IEStudents.load();assert.equal(JSON.parse(s.memory.get('ie22375_students_session_v1')).until,now+24*3600000);
 s.c.Date={now:()=>now+24*3600000};assert.equal(s.c.IEStudents.peek(),null);
});

test('Untrusted session tokenExp cannot extend cache beyond the signed exp',async()=>{
 const s=fixture();s.storage.setItem('ie22375_session_v1',JSON.stringify({...s.session,tokenExp:Date.now()+48*3600000}));
 await s.c.IEStudents.load();const signed=JSON.parse(Buffer.from(s.session.token.split('.')[0],'base64url').toString()).exp;
 assert.equal(JSON.parse(s.memory.get('ie22375_students_session_v1')).until,signed);
});

test('Explicit denial invalidates outstanding reads of other bimestres; a late success cannot resurrect cache',async()=>{
 const s=fixture('docente');await s.c.IEStudents.load();let release;
 s.c.fetch=async(url,options)=>({ok:true,json:()=>JSON.parse(options.body).bimestre==='III'?new Promise(r=>release=r):Promise.resolve({ok:false,code:'SESSION',error:'Synthetic revoked session'})});
 const old=s.c.IEStudents.loadRoster('III');const rejected=assert.rejects(old,e=>e.code==='SESSION');
 await Promise.resolve();await assert.rejects(s.c.IEStudents.loadRoster('IV'),/revoked/);
 release({ok:true,inicializada:true,bimestre:'III',estudiantes:[]});await rejected;
 assert.equal(s.c.IEStudents.peek(),null);assert.equal(s.c.IEStudents.peekRoster('III'),null);
});

test('A server reply for another bimestre is never cached or treated as verification',async()=>{
 const s=fixture('docente');s.c.fetch=async()=>({ok:true,json:async()=>({ok:true,inicializada:true,bimestre:'IV',estudiantes:[]})});
 await assert.rejects(s.c.IEStudents.loadRoster('III'),/bimestre solicitado/);assert.equal(s.c.IEStudents.peekRoster('III'),null);
});

test('Student write requests are never retried after network failure',async()=>{
 const s=fixture();let count=0;s.c.fetch=async()=>{count++;throw Error('down')};
 await assert.rejects(s.c.IEStudents.save(s.c.IEStudents.empty(),'v'),/conectar/);assert.equal(count,1);
});

test('Authorization removal in another tab invalidates memory cache and pending verification',async()=>{
 const s=fixture();let changed;s.c.window={addEventListener:(name,fn)=>{if(name==='storage')changed=fn}};
 new vm.Script(read('students.js')).runInContext(s.c);s.c.IEStudents=s.c.window.IEStudents;await s.c.IEStudents.load();
 let release;s.c.fetch=async()=>({ok:true,json:()=>new Promise(r=>release=r)});
 const pending=s.c.IEStudents.load();const rejected=assert.rejects(pending,e=>e.code==='SESSION');for(let i=0;i<10;i++)await Promise.resolve();
 changed({key:'ie22375_students_session_v1',newValue:null});
 release({ok:true,inicializada:true,estudiantes:[]});await rejected;assert.equal(s.c.IEStudents.peek(),null);
});


for (const file of ['primaria.html','secundaria.html']) test(file+': reuses Registro PADRON_III without network before slow refresh and changes period safely',async()=>{
  const s=fixture('docente');
  s.run(`let bdEstudiantes=IEStudents.empty(),padronBimestre='',solicitudPadron=0,tokenPadron='',cargandoEstudiantes=false,sesionActiva=null,notas={},padronVerificadoServidor=false;
    function registroSoloLectura(){return true};function guardarTodo(){return true};function bloquearRegistroMientrasValida(){};function recordarPadron(){};function renderStudents(){};
    function pintarPadronInmediato(base,b){bdEstudiantes=base;padronBimestre=b};function estadoPadron(){};function vigilarCachePadron(){};function sincronizarEdicionRegistro(){}`);
  s.run(extract('registro.html','cargarPadronRegistro'));
  assert.equal(await s.c.cargarPadronRegistro('III'),true);checkRequest(s,'III');
  // Reload the shared client as a new page: only persisted session cache remains.
  s.run(read('students.js'));s.c.IEStudents=s.c.window.IEStudents;
  s.run(`let baseOficialEstudiantes=[];let estado={bimestre:'III',areaActual:null};
    function mostrarToast(){};function syncInputTotalEstudiantes(){};function renderizarAreas(){};function renderizarResumen(){};function renderizarCompetencias(){};function renderizarAreaHeader(){}`);
  for(const name of ['estadoEstudiantes','cargarBaseOficialCache','cargarBaseOficialEstudiantes']) s.run(extract(file,name));
  const before=s.calls.length;
  assert.equal(s.c.cargarBaseOficialCache(),true);assert.equal(s.run('baseOficialEstudiantes.length'),1);assert.equal(s.calls.length,before);
  const pending=new Map();
  s.c.fetch=async(url,options)=>{const bim=JSON.parse(options.body).bimestre;return {ok:true,json:()=>new Promise(resolve=>pending.set(bim,resolve))}};
  const third=s.c.cargarBaseOficialEstudiantes();
  assert.equal(s.run('baseOficialEstudiantes.length'),1); // slow server cannot delay local paint
  s.run("estado.bimestre='II'");assert.equal(s.c.cargarBaseOficialCache(),false);
  assert.equal(s.run('baseOficialEstudiantes.length'),0);
  const second=s.c.cargarBaseOficialEstudiantes();
  await new Promise(r=>setTimeout(r,0));
  const level=file==='primaria.html'?'primaria':'secundaria';
  const reply=(bimestre,nombre)=>({ok:true,inicializada:true,bimestre,version:'v-'+bimestre,padronInicializado:true,estudiantes:[{nivel:level,grado:1,seccion:'A',orden:1,nombre}]});
  pending.get('III')(reply('III','Synthetic Old III'));await third;
  assert.equal(s.run('baseOficialEstudiantes.length'),0);
  pending.get('II')(reply('II','Synthetic New II'));await second;
  assert.equal(s.run('baseOficialEstudiantes[0].nombre'),'Synthetic New II');
  assert.match(extract(file,'setBimestre'),/estado.bimestre = val;[\s\S]*cargarBaseOficialCache\(\);[\s\S]*cargarBaseOficialEstudiantes\(\);/);
});
