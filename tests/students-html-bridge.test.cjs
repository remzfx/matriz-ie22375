const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const {bridgeFixture,backend}=new Function('require','__dirname',read('tests/login-html-bridge.test.cjs').split('\ntest(')[0]+'\nreturn {bridgeFixture,backend};')(require,__dirname);
const {fixture,extract}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('\ntest(')[0]+'\nreturn {fixture,extract};')(require,__dirname);
function setup(role='admin',ready=true) {
  const server=backend();server.c.Date=Date;
  const s=bridgeFixture(server,'students'),f=fixture(role);
  f.session.token=server.token(role==='docente'?'test-primary':role,role);
  f.storage.setItem('ie22375_session_v1',JSON.stringify(f.session));
  f.c.window.IELoginBridge={create:(api,mode)=>{assert.equal(mode,'students');return s.api;}};
  f.run(read('students.js'));f.c.IEStudents=f.c.window.IEStudents;
  if(ready)s.start();
  return {s,f,server};
}
for(const role of ['admin','docente','auxiliar'])test(role+' reads through real students RPC with exact token and existing role filtering',async()=>{
  const {s,f,server}=setup(role);
  const actual=await f.c.IEStudents.load(),expected=server.load(f.session.token);
  assert.equal(s.rpc.length,1);assert.equal(s.rpc[0].token,f.session.token);assert.equal(f.calls.length,0);
  assert.deepEqual(clone(actual.primaria.estudiantes),expected.estudiantes.filter(a=>a.nivel==='primaria'));
  assert.deepEqual(clone(actual.secundaria.estudiantes),expected.estudiantes.filter(a=>a.nivel==='secundaria'));
  assert.equal(actual.version,expected.version);assert.equal(actual.inicializada,true);
});
test('Auxiliar RPC honors restricted levels from current administrative configuration',async()=>{
  const {s,f,server}=setup('auxiliar');
  server.tables.get('ConfigSistema').rows.find(r=>r[0]==='AUXILIAR_ACCESOS')[2]=JSON.stringify([{user:'auxiliar',nombre:'Synthetic Auxiliary',niveles:['primaria'],activo:true}]);
  const base=await f.c.IEStudents.load();assert.equal(base.secundaria.estudiantes.length,0);assert.equal(base.primaria.estudiantes.length,3);assert.equal(s.rpc.length,1);
});
test('concurrent calls share one protected bridge read and bimestre remains scoped',async()=>{
  const {s,f}=setup();s.block();
  const a=f.c.IEStudents.loadRoster('III'),b=f.c.IEStudents.loadRoster('III');assert.equal(a,b);
  assert.equal(s.rpc.length,1);assert.equal(s.rpc[0].bimestre,'III');assert.equal(f.calls.length,0);
  s.resolve({ok:true,inicializada:true,version:'synthetic-roster',bimestre:'III',estudiantes:[]});await a;
  assert.equal(f.c.IEStudents.peekRoster('III').version,'synthetic-roster');assert.equal(f.c.IEStudents.peekRoster('II'),null);
});
test('bridge waits for handshake then sends only one read; unavailable bridge uses existing fetch',async()=>{
  for(const available of [true,false]) {
    const {s,f}=setup('admin',false);const task=f.c.IEStudents.load();assert.equal(f.calls.length,0);
    if(available)s.start();else s.unavailable();await task;
    assert.equal(s.rpc.length,available?1:0);assert.equal(f.calls.length,available?0:1);
  }
});
test('different bimestres can read concurrently and out-of-order RPC results stay in their own cache scope',async()=>{
  const {s,f}=setup();s.block();
  const a=f.c.IEStudents.loadRoster('III'),b=f.c.IEStudents.loadRoster('IV');assert.equal(s.rpc.length,2);
  s.resolveRpc(1,{ok:true,inicializada:true,bimestre:'IV',version:'synthetic-IV',estudiantes:[]});await b;
  s.resolveRpc(0,{ok:true,inicializada:true,bimestre:'III',version:'synthetic-III',estudiantes:[]});await a;
  assert.equal(f.c.IEStudents.peekRoster('III').version,'synthetic-III');assert.equal(f.c.IEStudents.peekRoster('IV').version,'synthetic-IV');assert.equal(f.calls.length,0);
});
test('token change during handshake stops the protected RPC before sending the stale token',async()=>{
  const {s,f,server}=setup('admin',false);const task=f.c.IEStudents.load();
  f.storage.setItem('ie22375_session_v1',JSON.stringify({...f.session,token:server.token('test-primary','docente')}));s.start();
  await assert.rejects(task,e=>e.code==='SESSION');assert.equal(s.rpc.length,0);assert.equal(f.calls.length,0);
});
test('students handshake uses the same strict origin/source/nonce checks and rejects a login message',async()=>{
  const {s,f}=setup('admin',false);
  for(const event of [{source:s.child,origin:'https://evil.example',data:s.msg('ready')},{source:{parent:null},origin:'https://n-synthetic-0lu-script.googleusercontent.com',data:s.msg('ready')},{source:s.child,origin:'https://n-synthetic-0lu-script.googleusercontent.com',data:s.msg('ready',{nonce:'0'.repeat(32)})}])s.receiveParent(event);
  assert.equal(s.api.ready(),false);s.start();
  s.receiveChild({source:s.parent,origin:'https://matriz.biblioteca360.com',data:s.msg('login',{id:1,body:{tipo:'admin',usuario:'admin',password:'synthetic-login-value'}})});
  assert.equal(s.rpc.length,0);await f.c.IEStudents.load();assert.equal(s.rpc.length,1);
});
test('unresponsive handshake reaches the existing 12-second boundary then falls back',async()=>{
  const {s,f}=setup('admin',false);const task=f.c.IEStudents.load();
  const timer=[...s.timers.values()][0];assert.equal(timer.ms,12000);timer.fn();await task;
  assert.equal(s.rpc.length,0);assert.equal(f.calls.length,1);
});
test('token change during bridge read discards the old response and does not cache it',async()=>{
  const {s,f,server}=setup();s.block();const task=f.c.IEStudents.load();
  f.storage.setItem('ie22375_session_v1',JSON.stringify({...f.session,token:server.token('test-primary','docente')}));
  s.resolve({ok:true,inicializada:true,version:'obsolete',estudiantes:[]});
  await assert.rejects(task,e=>e.code==='SESSION');assert.equal(f.c.IEStudents.peek(),null);
});
test('revoked token clears cached students and Admin does not retain its old counts',async()=>{
  const {s,f,server}=setup('docente');await f.c.IEStudents.load();assert.ok(f.c.IEStudents.peek());
  server.tables.get('DocentesAcceso').rows[1][1]=2000;server.cacheEntries.clear();
  await assert.rejects(f.c.IEStudents.load(),e=>e.code==='DENIED');assert.equal(f.c.IEStudents.peek(),null);assert.equal(f.memory.has('ie22375_students_session_v1'),false);
  assert.equal(s.rpc.length,2);assert.equal(f.calls.length,0);
});
for(const failure of ['rpc404','timeout'])test('transient '+failure+' preserves authorized exact-token cache without duplicate fetch',async()=>{
  const {s,f}=setup();await f.c.IEStudents.load();s.block();const task=f.c.IEStudents.load();
  if(failure==='rpc404')s.fail();else [...s.timers.values()][0].fn();
  const base=await task;assert.equal(base.offline,true);assert.ok(f.c.IEStudents.peek());assert.equal(s.rpc.length,2);assert.equal(f.calls.length,0);
});
test('after a students RPC timeout the verified handshake remains usable and the next read recovers without fetch',async()=>{
  const {s,f}=setup();await f.c.IEStudents.load();s.block();const task=f.c.IEStudents.load();
  [...s.timers.values()][0].fn();assert.equal((await task).offline,true);assert.equal(s.api.ready(),true);
  const next=f.c.IEStudents.load();assert.equal(s.rpc.length,3);
  s.resolveRpc(1,{ok:true,inicializada:true,version:'late-expired',estudiantes:[]});
  s.resolveRpc(2,{ok:true,inicializada:true,version:'recovered',estudiantes:[]});
  assert.equal((await next).version,'recovered');assert.equal(f.c.IEStudents.peek().version,'recovered');assert.equal(f.calls.length,0);
});
test('students/token never enter URL or CacheStorage and RPC cannot be used to write',async()=>{
  const {s,f,server}=setup();await f.c.IEStudents.load();
  assert.deepEqual([...new URL(s.frame.src).searchParams.keys()].sort(),['bridge','nonce','parentOrigin']);
  assert.doesNotMatch(s.frame.src,/token|Synthetic|estudiantes/);assert.equal(new URL(s.frame.src).searchParams.get('bridge'),'students-v1');
  assert.doesNotMatch(read('login-bridge.js')+server.c.loginBridgeFrame_.toString(),/CacheStorage|caches\./);
  const writes=server.state.writes;
  const result=server.c.studentsBridgeCargar({token:f.session.token,action:'restorestudents',base:{primaria:{estudiantes:[]}}});
  assert.equal(result.ok,true);assert.equal(result.estudiantes.length,7);assert.equal(server.state.writes,writes);
  assert.doesNotMatch(server.c.studentsBridgeCargar.toString(),/body\.action|body\.base/);
});
function admin(f) {
  f.run(`let estado=IEStudents.empty(),baseCargada=false,baseInicializada=false,baseVersion='',bdPendiente=false,bdGuardando=false;
    function estadoBD(message){document.getElementById('bdEstado').textContent=message;}
    function estudiantesDe(nivel){return estado[nivel].estudiantes;}function loadDocentes(){return [];}function fillFiltros(){};function renderTabla(){}`);
  for(const name of ['actualizarResumen','aplicarBaseServidor','cargarEstudiantesAdmin'])f.run(extract('admin.html',name));
}
test('Admin shows unknown counts during slow load, then a real 415-student response updates summaries',async()=>{
  const {s,f,server}=setup();admin(f);s.block();f.c.actualizarResumen();const task=f.c.cargarEstudiantesAdmin();
  assert.match(f.elements.get('statAlumnos').textContent,/— alumnos.*verificando/);assert.doesNotMatch(f.elements.get('resumenRapido').innerHTML,/\(0\)/);
  const estudiantes=Array.from({length:415},(_,i)=>({nivel:i<200?'primaria':'secundaria',grado:1,seccion:i<200?'Única':'A',orden:i+1,nombre:'Synthetic '+i}));
  const saved=server.post({action:'savestudents',token:f.session.token,version:server.load(f.session.token).version,base:{primaria:{estudiantes:estudiantes.filter(a=>a.nivel==='primaria')},secundaria:{estudiantes:estudiantes.filter(a=>a.nivel==='secundaria')}}});
  assert.equal(saved.ok,true);
  const response=server.c.studentsBridgeCargar({token:f.session.token});assert.equal(response.estudiantes.length,415);s.resolve(response);await task;
  assert.equal(f.elements.get('statAlumnos').textContent,'415 alumnos (200 prim. / 215 sec.)');
  assert.match(f.elements.get('resumenRapido').innerHTML,/Primaria<\/b> \(200\)/);assert.match(f.elements.get('resumenRapido').innerHTML,/Secundaria<\/b> \(215\)/);
});
test('Admin failure without cache states unavailable; only a confirmed initialized empty base shows zero',async()=>{
  const {s,f}=setup();admin(f);s.block();const task=f.c.cargarEstudiantesAdmin();s.fail();await task;
  assert.match(f.elements.get('bdEstado').textContent,/No se pudo cargar la base/);assert.doesNotMatch(f.elements.get('statAlumnos').textContent,/0 alumnos/);
  s.resolve({ok:true,inicializada:false,estudiantes:[]});f.c.aplicarBaseServidor({inicializada:false,primaria:{estudiantes:[]},secundaria:{estudiantes:[]}});assert.doesNotMatch(f.elements.get('statAlumnos').textContent,/0 alumnos/);
  f.c.aplicarBaseServidor({inicializada:true,primaria:{estudiantes:[]},secundaria:{estudiantes:[]}});assert.match(f.elements.get('statAlumnos').textContent,/^0 alumnos/);
});
test('Admin paints authorized cache immediately and withdraws it if RPC rejects the session',async()=>{
  const {s,f}=setup();await f.c.IEStudents.load();admin(f);s.block();const task=f.c.cargarEstudiantesAdmin();
  assert.match(f.elements.get('statAlumnos').textContent,/^7 alumnos/);s.resolve({ok:false,code:'SESSION',error:'Sesión revocada.'});await task;
  assert.equal(f.c.IEStudents.peek(),null);assert.doesNotMatch(f.elements.get('statAlumnos').textContent,/7 alumnos|0 alumnos/);
  assert.match(f.elements.get('bdEstado').textContent,/No se pudo cargar la base/);
});
test('all protected student consumers load bridge before students.js, with safe offline JS support',()=>{
  for(const file of ['admin.html','registro.html','primaria.html','secundaria.html','auxiliar.html','photochecks.html','index.html']) {
    const source=read(file);assert.ok(source.indexOf('src="login-bridge.js"')<source.indexOf('src="students.js"'),file);
  }
  assert.match(read('sw.js'),/'\.\/login-bridge.js'/);assert.match(read('sw.js'),/CACHE_PREFIX \+ 'v10'/);
});
test('students loaded in head waits for body before creating the hidden iframe',()=>{
  const f=fixture();let initialize,count=0;
  f.c.document.addEventListener=(type,fn)=>{assert.equal(type,'DOMContentLoaded');initialize=fn;};
  f.c.window.IELoginBridge={create:()=>{assert.ok(f.c.document.body);count++;return {ready:()=>true};}};
  f.run(read('students.js'));assert.equal(count,0);f.c.document.body={};initialize();assert.equal(count,1);
});
