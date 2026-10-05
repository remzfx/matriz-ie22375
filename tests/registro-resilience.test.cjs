const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
function extract(name){const s=read('registro.html'),a=s.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(a>=0,name);const line=s.slice(a).split('\n')[0];if(line.endsWith('}'))return line;return s.slice(a,s.indexOf('\n}',a)+2);}
function fixture(){
 let now=Date.now(),id=0;const timers=new Map();
 const timer=(fn,ms)=>{const key=++id;timers.set(key,{fn,when:now+ms});return key;};
 const tick=async ms=>{const end=now+ms;for(let turn=0;turn<1000;turn++){
   for(let i=0;i<20;i++)await Promise.resolve();
   const due=[...timers].filter(([,t])=>t.when<=end).sort((a,b)=>a[1].when-b[1].when)[0];
   if(!due){now=end;return;}now=due[1].when;timers.delete(due[0]);due[1].fn();
 }throw Error('timer runaway');};
 const token=Buffer.from(JSON.stringify({role:'docente',exp:now+3600000})).toString('base64url')+'.synthetic';
 const values=new Map([['ie22375_session_v1',JSON.stringify({role:'docente',token,tokenExp:now+3600000})]]),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const els=new Map(),element=id=>{if(!els.has(id)){const classes=new Set();els.set(id,{value:id==='selBim'?'III':id==='selGrado'?'4':id==='selSeccion'?'B':'',innerHTML:'',textContent:'',disabled:false,hidden:false,classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k)}});}return els.get(id);};
 const writes=[element('save')],cloud=[element('upload')],main={inert:false,setAttribute(){},querySelectorAll:sel=>sel.includes('data-reg-cloud')?cloud:sel.includes('data-reg-write')?writes:[]};
 const calls=[],alerts=[],c=vm.createContext({window:{},Date:class extends Date{static now(){return now;}},AbortController,atob,setTimeout:timer,clearTimeout:key=>timers.delete(key),sessionStorage:storage,localStorage:storage,document:{getElementById:element,querySelectorAll:sel=>main.querySelectorAll(sel),querySelector:()=>main},alert:m=>alerts.push(m),console});
 const response=(name='Synthetic Verified',bimestre='III')=>({ok:true,inicializada:true,version:'v',bimestre,padronInicializado:true,estudiantes:[{nivel:'secundaria',grado:4,seccion:'B',idSiagie:'42',nombre:name}]});
 c.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>response()};};
 new vm.Script(read('students.js')).runInContext(c);c.IEStudents=c.window.IEStudents;
 const run=code=>new vm.Script(code).runInContext(c);
 run(`let nivel='secundaria',bdEstudiantes=IEStudents.empty(),cargandoEstudiantes=false,padronBimestre='',solicitudPadron=0,padronVerificadoServidor=false,tokenPadron='',vencimientoCachePadron,sesionActiva=null,notas={},areaActual='Matemática',store={meta:{}},renders=0;
 function recordarPadron(){};function saveStore(){};function renderStudents(){renders++;};function llenarAulasPadron(){};
 function ctxBase(){return {nivel,bim:document.getElementById('selBim').value,grado:4,seccion:'B',area:areaActual}};
 function getLoginSession(){return IEStudents.session()};function loadPeriodosAdmin(){return {bimestres:{III:'abierto'}}};
 function areas(){return ['Matemática','Comunicación']};function renderAreas(){};function fillComps(){};function actualizarDocenteResponsable(){};
 function fillCaps(){};function loadCapsElegidas(){};function renderChipsCaps(){};function markClean(){};function updateHdr(){};
 function renderSesiones(){renders++};function renderFinales(){};function renderAvance(){};function renderAsistencia(){};
 function consultarEstadoSiagie(){};function recolectarPantalla(){};function guardarMeta(){};function saveCapsElegidas(){};`);
 for(const name of ['registroSoloLectura','registroNubeNoVerificada','sincronizarEdicionRegistro','estadoPadron','bloquearRegistroMientrasValida','pintarPadronInmediato','vigilarCachePadron','cargarPadronRegistro','cambiarBimestreRegistro','reintentarPadronRegistro','onContexto','guardarTodo'])run(extract(name));
 return {c,run,main,writes,cloud,element,tick,calls,alerts,response,storage,timers};
}
test('Fast server verifies the exact roster/session and enables writing without inert',async()=>{
 const s=fixture();assert.equal(await s.c.cargarPadronRegistro('III'),true);assert.equal(s.c.registroSoloLectura(),false);assert.equal(s.main.inert,false);assert.ok(s.writes.every(x=>!x.disabled));
 assert.equal(JSON.parse(s.calls[0].options.body).action,'loadstudents');assert.equal(s.calls[0].options.method,'POST');assert.equal(s.alerts.length,0);
});
test('Slow server shows authorized cache immediately and allows local work while cloud upload stays blocked',async()=>{
 const s=fixture();await s.c.IEStudents.loadRoster('III');let release;s.c.fetch=async()=>({ok:true,json:()=>new Promise(r=>release=r)});
 const task=s.c.cargarPadronRegistro('III');await s.tick(0);
 assert.equal(s.run('bdEstudiantes.secundaria.estudiantes.length'),1);assert.equal(s.main.inert,false);assert.ok(s.writes.every(x=>!x.disabled));assert.ok(s.cloud.every(x=>x.disabled));
 s.run("areaActual='Comunicación'");s.c.onContexto();assert.equal(s.run('areaActual'),'Comunicación');assert.ok(s.run('renders')>1);assert.notEqual(s.c.guardarTodo(),false);
 release(s.response('Synthetic Fresh'));await task;assert.equal(s.run('bdEstudiantes.secundaria.estudiantes[0].nombre'),'Synthetic Fresh');assert.equal(s.c.registroSoloLectura(),false);
});
test('Transient first failure retries automatically on the same canonical POST route',async()=>{
 const s=fixture();let count=0;s.c.fetch=async(url,options)=>{s.calls.push({url,options});if(++count===1)throw Error('transient');return {ok:true,json:async()=>s.response()};};
 const task=s.c.cargarPadronRegistro('III');await s.tick(1200);assert.equal(await task,true);assert.equal(count,2);assert.equal(s.c.registroSoloLectura(),false);
 assert.ok(s.calls.every(x=>x.options.method==='POST'&&JSON.parse(x.options.body).action==='loadstudents'));
});
test('Cached roster plus server outage remains locally editable; later retry replaces cache without page reload',async()=>{
 const s=fixture();await s.c.IEStudents.loadRoster('III');s.c.fetch=async()=>{throw Error('down');};
 const task=s.c.cargarPadronRegistro('III');await s.tick(1200);assert.equal(await task,true);
 assert.equal(s.run('cargandoEstudiantes'),false);assert.equal(s.main.inert,false);assert.equal(s.c.registroSoloLectura(),false);assert.equal(s.c.registroNubeNoVerificada(),true);assert.equal(s.element('retryRoster').hidden,false);
 s.c.fetch=async()=>({ok:true,json:async()=>s.response('Synthetic Recovery')});await s.c.reintentarPadronRegistro();
 assert.equal(s.run('bdEstudiantes.secundaria.estudiantes[0].nombre'),'Synthetic Recovery');assert.equal(s.c.registroSoloLectura(),false);assert.equal(s.element('retryRoster').hidden,true);
});
test('Fetch/body that never resolve have bounded attempts and a recoverable retry state',async()=>{
 const s=fixture();s.c.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})});
 const task=s.c.cargarPadronRegistro('III');await s.tick(25200);assert.equal(await task,false);
 assert.equal(s.run('cargandoEstudiantes'),false);assert.equal(s.element('retryRoster').hidden,false);assert.equal(s.c.guardarTodo(),false);assert.equal(s.alerts.length,0);
});
test('Authorization rejection withdraws cached data instead of treating it as a network outage',async()=>{
 const s=fixture();await s.c.IEStudents.loadRoster('III');s.c.fetch=async()=>({ok:true,json:async()=>({ok:false,error:'Synthetic revoked session'})});
 assert.equal(await s.c.cargarPadronRegistro('III'),false);assert.equal(s.run('bdEstudiantes.secundaria.estudiantes.length'),0);assert.equal(s.c.IEStudents.peekRoster('III'),null);assert.equal(s.c.registroSoloLectura(),true);
});
test('Late request for a previous bimestre cannot overwrite the active roster or its verification',async()=>{
 const s=fixture();const release={};s.c.fetch=async(url,options)=>({ok:true,json:()=>new Promise(r=>release[JSON.parse(options.body).bimestre]=r)});
 const old=s.c.cargarPadronRegistro('III');await s.tick(0);s.element('selBim').value='IV';const current=s.c.cargarPadronRegistro('IV');await s.tick(0);
 release.IV(s.response('Synthetic IV','IV'));await current;release.III(s.response('Synthetic III','III'));await old;
 assert.equal(s.run('padronBimestre'),'IV');assert.equal(s.run('bdEstudiantes.secundaria.estudiantes[0].nombre'),'Synthetic IV');assert.equal(s.c.registroSoloLectura(),false);
});
test('API incompatibility allows only local work; cloud upload remains blocked and retry stays available',async()=>{
 const s=fixture();await s.c.IEStudents.loadRoster('III');s.c.fetch=async()=>({ok:true,json:async()=>({ok:false,error:'Acción no válida'})});
 const task=s.c.cargarPadronRegistro('III');await s.tick(1200);await task;assert.equal(s.c.registroSoloLectura(),false);assert.equal(s.c.registroNubeNoVerificada(),true);assert.equal(s.main.inert,false);assert.equal(s.element('retryRoster').hidden,false);
});
test('Changing the token immediately disables write guards even after a successful verification',async()=>{
 const s=fixture();await s.c.cargarPadronRegistro('III');s.storage.removeItem('ie22375_session_v1');assert.equal(s.c.guardarTodo(),false);assert.equal(s.c.registroSoloLectura(),true);
});

test('Concurrent reads of the same token/bimestre share a single server verification',async()=>{
 const s=fixture();let release;s.c.fetch=async(url,options)=>{s.calls.push({url,options});return {ok:true,json:()=>new Promise(r=>release=r)};};
 const a=s.c.IEStudents.loadRoster('III'),b=s.c.IEStudents.loadRoster('III');await s.tick(0);assert.equal(s.calls.length,1);
 release(s.response());await Promise.all([a,b]);
});

test('Expired local-first cache is withdrawn and local writes become blocked',async()=>{
 const s=fixture();await s.c.IEStudents.loadRoster('III');s.c.fetch=async()=>{throw Error('down');};
 const task=s.c.cargarPadronRegistro('III');await s.tick(1200);await task;await s.tick(610000);
 assert.equal(s.run('bdEstudiantes.secundaria.estudiantes.length'),0);assert.equal(s.c.guardarTodo(),false);assert.equal(s.element('retryRoster').hidden,false);
});

test('Local-first mode allows Calificar, Promedios, Resumen and Asistencia tabs plus local save',async()=>{
 const s=fixture();await s.c.IEStudents.loadRoster('III');s.c.fetch=async()=>{throw Error('down');};
 const task=s.c.cargarPadronRegistro('III');await s.tick(1200);await task;
 s.run('function esVistaAdmin(){return false}');s.run(extract('showPanel'));
 for(const [tab,panel] of [['cal','panelCalificar'],['fin','panelFinales'],['av','panelAvance'],['as','panelAsistencia']]){
   s.c.showPanel(tab);assert.equal(s.element(panel).classList.contains('on'),true);assert.equal(s.main.inert,false);assert.notEqual(s.c.guardarTodo(),false);
 }
});

test('Login body timeout stays inside the original attempt budget instead of hanging after headers',async()=>{
 const s=fixture(),source=read('index.html');
 const name='leerRespuestaLoginConTiempo',a=source.indexOf('async function '+name+'('),b=source.indexOf('\n}',a)+2;
 s.run("function errorLogin(code,message){return Object.assign(new Error(message),{code});}");s.run(source.slice(a,b));
 const request=s.c.leerRespuestaLoginConTiempo({text:()=>new Promise(()=>{})},300);
 const rejected=assert.rejects(request,e=>e.code==='TIMEOUT');await s.tick(300);await rejected;
 assert.match(source,/18000 - \(performance.now\(\) - t0\)/);
});
