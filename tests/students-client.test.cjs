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
  const c=vm.createContext({window:{},sessionStorage:storage,localStorage:storage,atob,console,Date,
    document:{getElementById:el},alert:v=>alerts.push(v),confirm:()=>true,setTimeout:()=>0,
    fetch:async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({ok:true,version:'synthetic-current',inicializada:true,estudiantes:[{nivel:'primaria',grado:1,seccion:'Única',orden:1,nombre:'Synthetic Primary'},{nivel:'secundaria',grado:1,seccion:'A',orden:1,nombre:'Synthetic Secondary'}]})};}
  });
  new vm.Script(read('students.js')).runInContext(c);c.IEStudents=c.window.IEStudents;
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
  const s=fixture();s.run('let bdGuardando=false,bdPendiente=false,baseCargada=false;let recibido;function estadoBD(){};function aplicarBaseServidor(base){recibido=base;}');
  s.run(extract('admin.html','cargarEstudiantesAdmin'));await s.c.cargarEstudiantesAdmin();checkRequest(s);
  assert.equal(s.run('recibido.primaria.estudiantes[0].nombre'),'Synthetic Primary');
});
for(const file of ['primaria.html','secundaria.html'])test(file+': real matrix loader derives student totals from protected data',async()=>{
  const s=fixture('docente');s.run("let baseOficialEstudiantes=[];let estado={grado:'PRIMERO'};function mostrarToast(){};function syncInputTotalEstudiantes(){};function renderizarAreas(){};function renderizarResumen(){}");
  s.run(extract(file,'cargarBaseOficialEstudiantes'));await s.c.cargarBaseOficialEstudiantes();checkRequest(s);
  assert.equal(s.run('baseOficialEstudiantes.length'),1);
  if(file==='primaria.html'){s.run(extract(file,'getTotalEstudiantes'));assert.equal(s.c.getTotalEstudiantes(),1);s.run('estado.grado="SEGUNDO"');assert.equal(s.c.getTotalEstudiantes(),0);}
  else{s.run(extract(file,'normalizarSeccionBD'));s.run(extract(file,'totalEstudiantesDesdeBD'));assert.equal(s.c.totalEstudiantesDesdeBD('1°','A'),1);assert.equal(s.c.totalEstudiantesDesdeBD('2°','B'),0);}
});
for(const file of ['auxiliar.html','photochecks.html'])test(file+': real loader uses protected students instead of the old global roster',async()=>{
  const s=fixture(file==='auxiliar.html'?'auxiliar':'admin');s.run('let BD=null;function toast(){}');
  s.run(extract(file,'ensureBD'));await s.c.ensureBD();checkRequest(s);
  assert.equal(s.run('BD.primaria.estudiantes[0].nombre'),'Synthetic Primary');
});
test('Registro enters its current flow only after protected students are loaded',async()=>{
  const s=fixture('docente');
  s.run(`let bdEstudiantes=IEStudents.empty(),cargandoEstudiantes=false,padronBimestre='',solicitudPadron=0,nivel,areaActual,sesionActiva,notas,dirty,modoCalif;function recordarPadron(){};function saveStore(){};function toast(){};
    function nivelPermitido(){return 'primaria'};function loadStore(){};function pintarBimestresRegistro(){document.getElementById('selBim').value='III'};function loadPeriodosAdmin(){};
    function gradosPermitidos(){return [1]};function aulasPermitidas(){return null};function hoyISO(){return '2026-10-03'};
    function aplicarDocenteSesion(){};function onGrado(){};function areas(){return ['Comunicación']};function renderAreas(){};
    function fillComps(){};function syncModoBtns(){};function updateHdr(){};function renderSesiones(){};function renderStudents(){};
    function fillCaps(){};function markClean(){};function aplicarModoAdminRegistro(){};function fixHdrHeight(){};
    function sincronizarPeriodosNube(){return Promise.resolve()};function onContexto(){};`);
  for(const name of ['loadBD','llenarAulasPadron','cargarPadronRegistro','entrarNivel'])s.run(extract('registro.html',name));
  await s.c.entrarNivel('primaria');checkRequest(s,'III');
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
test('Offline fallback expires after ten minutes and keeps the same scope',async()=>{
  const s=fixture();await s.c.IEStudents.load();s.c.fetch=async()=>{throw Error('offline');};
  const offline=await s.c.IEStudents.load();assert.equal(offline.offline,true);
  assert.equal(offline.primaria.estudiantes[0].nombre,'Synthetic Primary');
  const cache=JSON.parse(s.memory.get('ie22375_students_session_v1'));assert.ok(cache.until<=Date.now()+600000);
  s.c.Date={now:()=>Date.now()+600001};
  await assert.rejects(s.c.IEStudents.load(),/conectar/);
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
