// Regressions for the approved production diagnosis; synthetic data only.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const studentsFixture=new Function('require','__dirname',read('tests/backend-students.test.cjs').split('\ntest(')[0]+'\nreturn studentsFixture;')(require,__dirname);
function extract(name){
  const src=read('auxiliar.html'),start=src.search(new RegExp('(?:async )?function '+name+'\\('));
  return src.slice(start,src.indexOf('\n}',start)+2);
}
function fixture(nivel){
  const server=studentsFixture(),rows=server.tables.get('ConfigSistema').rows;
  rows.splice(rows.findIndex(r=>r[0]==='AUXILIAR_ACCESOS'),1);
  let version=0;
  const configure=()=>{
    const r=server.post({action:'saveauxiliar',token:server.admin,version,auxiliar:{user:'diagnostic-aux',nombre:'Synthetic Auxiliary',password:'synthetic-pass',niveles:[nivel],activo:true}});
    assert.equal(r.ok,true);version=r.version;
  };
  configure();
  const local=new Map(),localStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
  const stored=new Map(),storage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v),removeItem:k=>stored.delete(k)};
  const elements=new Map(),el=id=>{
    if(!elements.has(id))elements.set(id,{value:id==='inpTipo'?'auxiliar':id==='inpDocUser'?'diagnostic-aux':id==='inpPass'?'synthetic-pass':id==='selNivel'?'primaria':'',checked:false,textContent:id==='studentsStatus'?'Cargando estudiantes…':'',innerHTML:'',classList:{add(){},remove(){},toggle(){}}});
    return elements.get(id);
  };
  const calls=[],context=vm.createContext({window:{},document:{getElementById:el},sessionStorage:storage,localStorage,atob,Date,URL,URLSearchParams,AbortController,performance,setTimeout,clearTimeout,console:{info(){}},
    fetch:async(url,options)=>{
      const body=JSON.parse(options.body);calls.push({url,body});
      const data=server.post(body);return {ok:true,status:200,text:async()=>JSON.stringify(data),json:async()=>data};
    }});
  const run=src=>new vm.Script(src).runInContext(context);
  run([...read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1]);context.mostrarHub=()=>{};
  run(read('students.js'));context.IEStudents=context.window.IEStudents;
  run(read('auxiliar-permissions.js'));context.IEAuxPermissions=context.window.IEAuxPermissions;
  run("let BD=null,cargandoEstudiantesAux=false;const auxiliarInicio=performance.now(),WA_KEY='ie22375_wa_grupos_v1';function toast(){};function onNivel(){}");
  for(const name of ['hoyISO','medirAuxiliar','loadGruposWa','enviarGruposHoy','actualizarGradosGrupos','pintarBaseAuxiliar','retirarSesionAuxiliar','ensureBD'])run(extract(name));
  return {server,configure,context,run,el,stored,local,calls};
}

for(const nivel of ['primaria','secundaria'])test('Fresh '+nivel+' auxiliary login flows through index and loadstudents with the exact signed scope',async()=>{
  const s=fixture(nivel);await s.context.intentarLogin();
  const session=s.context.getSession();assert.ok(session,s.el('loginErr').textContent);assert.deepEqual(Array.from(session.niveles),[nivel]);
  await s.context.ensureBD();const base=s.run('BD');
  assert.ok(base[nivel].estudiantes.length>0);assert.equal(base[nivel==='primaria'?'secundaria':'primaria'].estudiantes.length,0);
  assert.equal(s.el('selNivel').value,nivel);
  const readCall=s.calls.find(c=>c.body.action==='loadstudents');assert.equal(readCall.body.token,session.token);
});

test('Revocation rejects students, removes cached authorization and displays a persistent session error',async()=>{
  const s=fixture('secundaria');await s.context.intentarLogin();await s.context.ensureBD();
  const token=s.context.getSession().token;s.configure();
  await assert.rejects(s.context.ensureBD(),e=>e.code==='DENIED'&&/sesión/i.test(e.message));
  assert.equal(s.server.c.validarToken_(token),null);assert.equal(s.context.IEStudents.peek(),null);
  assert.match(s.el('studentsStatus').textContent,/sesión/i);assert.doesNotMatch(s.el('studentsStatus').textContent,/cargando/i);
  assert.equal(s.context.getSession(),null);
  assert.deepEqual(Array.from(s.context.IEAuxPermissions.niveles()),[]);
  assert.equal(s.el('studentsRelogin').hidden,false);
});

test('Successful auxiliary student loading finishes with a count and no retry',async()=>{
  const s=fixture('secundaria');await s.context.intentarLogin();await s.context.ensureBD();
  assert.ok(s.run('BD.secundaria.estudiantes.length')>0);
  assert.match(s.el('studentsStatus').textContent,/estudiantes cargados/);
  assert.equal(s.el('studentsRetry').hidden,true);
});

for(const failure of ['pending WhatsApp','failed schedule'])test('Students render independently of '+failure,async()=>{
  const s=fixture('secundaria');await s.context.intentarLogin();
  s.context.ensureHorario=failure==='failed schedule'?async()=>{throw Error('synthetic schedule failure')}:async()=>{};
  s.context.bajarGruposWa=failure==='pending WhatsApp'?()=>new Promise(()=>{}):async()=>{};
  let painted=0;s.context.onNivel=()=>{painted++;};s.context.esEnvioMasivo=()=>false;
  s.context.loadBD=()=>s.context.IEStudents.empty();s.context.fijarNiveles=x=>x;s.context.hoyISO=()=> '2026-10-07';
  const html=read('auxiliar.html');
  // Start at the bootstrap preceding pintarYa, not configurar calls inside the loader.
  const bootstrap=html.lastIndexOf('IEAuxPermissions.configurar();',html.indexOf('(function pintarYa()'));
  s.run(html.slice(bootstrap,html.indexOf('</script>',bootstrap)));
  for(let i=0;i<40;i++)await Promise.resolve();
  assert.ok(painted>=2);assert.ok(s.run('BD.secundaria.estudiantes.length')>0);
  assert.match(s.el('studentsStatus').textContent,/estudiantes cargados/);
});

test('An HTTP 404 is a transport failure before login JSON parsing, not a denied account response',async()=>{
  const s=fixture('primaria');let parsed=false;
  s.context.fetch=async()=>({ok:false,status:404,text:async()=>{parsed=true;return '{"ok":false}';}});
  await assert.rejects(s.context.loginBackendUnaVez('auxiliar','diagnostic-aux','synthetic-pass'),e=>e.code==='HTTP'&&e.status===404);
  assert.equal(parsed,false);
  s.context.fetch=async()=>({ok:true,status:200,text:async()=>JSON.stringify({ok:false,error:'Usuario o contraseña incorrectos.'})});
  assert.equal((await s.context.loginBackendUnaVez('auxiliar','diagnostic-aux','wrong')).ok,false);
});

test('Every production Web App endpoint uses the verified deployment ID',()=>{
  const urls=[];
  for(const file of fs.readdirSync(path.join(__dirname,'..')).filter(f=>/\.(?:html|js)$/.test(f)))
    urls.push(...Array.from(read(file).matchAll(/https:\/\/script\.google\.com\/macros\/s\/[^\s"'<>]+/g),m=>m[0]));
  assert.equal(urls.length,9);
  assert.deepEqual([...new Set(urls)],['https://script.google.com/macros/s/AKfycbxI0pfjZfeecboqvwx4YOjcvyGTGVa1smmyyE9kNQCmNgNL3tDXwFlPUL0i1DJ2DwBNIg/exec']);
});

test('Explicit auxiliary revocation preserves pending attendance and removes both session copies',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();await s.context.ensureBD();
  s.local.set('ie22375_session_v1',s.stored.get('ie22375_session_v1'));
  const attendance=JSON.stringify({synthetic:{marca:'P',ts:42}});
  s.local.set('ie22375_asistencia_colegio_v1',attendance);s.configure();
  await assert.rejects(s.context.ensureBD());
  assert.equal(s.local.get('ie22375_asistencia_colegio_v1'),attendance);
  assert.equal(s.local.has('ie22375_session_v1'),false);assert.equal(s.stored.has('ie22375_session_v1'),false);
  assert.equal(s.el('studentsRetry').hidden,true);assert.equal(s.el('studentsRelogin').hidden,false);
});

for(const status of [404,500,503])test('HTTP '+status+' loading failure shows retry and never revokes a valid auxiliary session',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();const token=s.context.getSession().token;
  s.context.setTimeout=(fn,ms)=>{if(ms===1200)queueMicrotask(fn);return 0;};s.context.clearTimeout=()=>{};
  s.context.fetch=async()=>({ok:false,status});
  await assert.rejects(s.context.ensureBD(),e=>e.code==='HTTP');
  assert.equal(s.context.getSession().token,token);assert.equal(s.el('studentsRetry').hidden,false);
  assert.equal(s.el('studentsRelogin').hidden,true);assert.doesNotMatch(s.el('studentsStatus').textContent,/cargando/i);
});

test('Network failure can recover with the retry button without reloading or losing the session',async()=>{
  const s=fixture('secundaria');await s.context.intentarLogin();const network=s.context.fetch;
  s.context.setTimeout=(fn,ms)=>{if(ms===1200)queueMicrotask(fn);return 0;};s.context.clearTimeout=()=>{};
  s.context.fetch=async()=>{throw Error('synthetic network down');};
  await assert.rejects(s.context.ensureBD());assert.match(s.el('studentsStatus').textContent,/reintentar/i);
  assert.equal(s.el('studentsRetry').hidden,false);assert.ok(s.context.getSession());
  s.context.fetch=network;await s.context.ensureBD();
  assert.match(s.el('studentsStatus').textContent,/estudiantes cargados/);assert.equal(s.el('studentsRetry').hidden,true);
});

test('A late rejection for an old token cannot remove a newer login',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();const old=s.context.getSession().token;
  s.configure();await s.context.intentarLogin();const current=s.context.getSession().token;
  assert.notEqual(old,current);assert.equal(s.context.retirarSesionAuxiliar(old),false);
  assert.equal(s.context.getSession().token,current);
});

test('HTTP login diagnostics contain only status, origin, MIME and redirect metadata, never the temporary URL',async()=>{
  const s=fixture('primaria');
  s.context.fetch=async()=>({ok:false,status:404,url:'https://script.googleusercontent.com/macros/echo?user_content_key=synthetic-sensitive',redirected:true,headers:new Headers({'Content-Type':'text/html;charset=utf-8'})});
  let failure;try{await s.context.loginBackendUnaVez('auxiliar','diagnostic-aux','synthetic-pass');}catch(e){failure=e;}
  s.context.registrarFalloLogin(failure);
  const raw=s.stored.get('ie22375_login_error_v1'),data=JSON.parse(raw);
  assert.equal(data.status,404);assert.equal(data.origin,'https://script.googleusercontent.com');
  assert.equal(data.contentType,'text/html');assert.equal(data.redirected,true);
  assert.doesNotMatch(raw,/user_content_key|synthetic-sensitive|synthetic-pass|diagnostic-aux|token/);
});

test('Secondary schedule and WhatsApp reads have bounded deadlines without gating students',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();
  s.run("let HORARIO_CFG={},HORARIO_KEY='synthetic-horario',horarioVerificado=false,horarioPendiente=null,waPendiente=null,waToken='',waActualizado=0;function horarioDefecto(){return {defaults:{}}};function tokenSesionAuxiliar(){return IEStudents.validToken();}");
  for(const name of ['ensureHorario','cargarHorarioAuxiliar','bajarGruposWa','cargarGruposWaAuxiliar'])s.run(extract(name));
  const reads=[];s.context.IEStudents.fetchJSON=async(url,options,timeout)=>{reads.push({url,options,timeout});throw Error('synthetic timeout');};
  await s.context.ensureHorario();await s.context.bajarGruposWa();
  assert.equal(reads.length,2);assert.ok(reads.every(r=>r.timeout===8000));assert.ok(s.context.getSession());
  assert.equal(s.run('horarioVerificado'),false);
});

test('Automatic absences require a verified schedule while manual attendance stays available',async()=>{
  const s=fixture('primaria');await s.context.intentarLogin();
  s.run('let horarioVerificado=false;function ventanasDe(){return [{hasta:"08:00"}]};function hmAMin(){return 480};function minutosAhora(){return 600}');
  s.run(extract('jornadaCerrada'));assert.equal(s.context.jornadaCerrada({nivel:'primaria'}),false);
  s.run('horarioVerificado=true');assert.equal(s.context.jornadaCerrada({nivel:'primaria'}),true);
});

test('Admin still loads students without changing its session or complete school scope',async()=>{
  const s=fixture('primaria');
  s.context.fetch=async(url,options)=>({ok:true,json:async()=>s.server.post(JSON.parse(options.body))});
  const profile={user:'admin',role:'admin',token:s.server.admin,tokenExp:Date.now()+60000,ts:Date.now()};
  s.stored.set('ie22375_session_v1',JSON.stringify(profile));
  await s.context.ensureBD();
  assert.ok(s.run('BD.primaria.estudiantes.length')>0);assert.ok(s.run('BD.secundaria.estudiantes.length')>0);
  assert.equal(s.context.getSession().token,profile.token);assert.equal(s.el('studentsRelogin').hidden,true);
});
