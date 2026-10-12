const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','auxiliar.html'),'utf8');
function fn(name) {
 const start=html.search(new RegExp('(?:async )?function '+name+'\\('));
 assert.ok(start>=0,name+' missing');
 const end=html.indexOf('\n}',start);
 assert.ok(end>start,name+' unterminated');
 return html.slice(start,end+2);
}
const helpers=['norm','parseQR','secEq','todosAlumnos','hallarAlumno','resultadoPruebaQR','onDecoded'];
function fixture(){
 const state={on:false,msg:'',writes:0,onlineWrites:0,audio:0,scannerStart:[],closed:true};
 const elements={
  scanBox:{classList:{
   contains:x=>x==='on'&&state.on,
   add:x=>{if(x==='on')state.on=true},
   remove:x=>{if(x==='on')state.on=false}
  },scrollIntoView(){}},
  scanMsg:{set textContent(v){state.msg=v},get textContent(){return state.msg}}
 };
 const alumno={nombre:'ALEJOS GALLIQUE, GAEL ALEXANDER',nivel:'primaria',grado:1,seccion:'Única'};
 let active=null;
 class Html5Qrcode {
  constructor(id){assert.equal(id,'reader');active=this}
  async start(device,opts,read){state.scannerStart.push(device);this.read=read;this.active=true}
  async stop(){this.active=false}
  clear(){}
  static async getCameras(){return [{id:'front',label:'front camera'},{id:'back',label:'back camera'}]}
 }
 const c=vm.createContext({
  document:{getElementById:id=>elements[id]||{value:''}},window:{isSecureContext:true},
  navigator:{mediaDevices:{getUserMedia(){}}},
  IEAuxPermissions:{niveles:()=>['primaria']},
  BD:{primaria:{estudiantes:[alumno]},secundaria:{estudiantes:[]}},
  Html5Qrcode,Date,console,
  bimestreAsistencia:()=> 'III',asistenciaEscribible:()=>!state.closed,
  prepararAudio(){state.audio++},toast(v){state.msg=v},
  marcarPorQR(v){state.writes++},setRec(){state.writes++},subirUnoNube(){state.onlineWrites++}
 });
 vm.runInContext('let html5Qr=null,lastScanAt=0,lastScanText="",scanSoloLectura=false,scanIntento=0;',c);
 vm.runInContext(helpers.map(fn).join('\n')+'\n'+fn('toggleScan')+'\n'+fn('stopScan'),c);
 return {c,state,elements,alumno,getScanner:()=>active};
}
const qr='IE22375|primaria|1|Única|ALEJOS GALLIQUE, GAEL ALEXANDER';
test('Single scanner opens in read-only when bimestre is closed, recognizes roster but does not mark',async()=>{
 const f=fixture();
 assert.equal(await vm.runInContext('toggleScan()',f.c),true);
 assert.equal(f.state.on,true);
 assert.equal(f.state.scannerStart.length,1);
 assert.equal(f.state.scannerStart[0].facingMode,'environment');
 assert.match(f.state.msg,/Solo lectura por cierre/);
 f.getScanner().read(qr);
 assert.match(f.state.msg,/QR leído: estudiante localizado/);
 assert.match(f.state.msg,/no se guardó ni se subió asistencia/);
 assert.equal(f.state.writes,0);assert.equal(f.state.onlineWrites,0);
 vm.runInContext('stopScan()',f.c);
 assert.equal(f.state.on,false);
});
test('Scanner recognizes an absent synthetic student without modifying local records',async()=>{
 const f=fixture();await vm.runInContext('toggleScan()',f.c);
 f.getScanner().read('IE22375|primaria|1|Única|ESTUDIANTE SINTÉTICO');
 assert.match(f.state.msg,/no figura en el padrón/);
 assert.equal(f.state.writes,0);
});
test('Scanner recognizes a non-school QR without modifying local or cloud records',async()=>{
 const f=fixture();await vm.runInContext('toggleScan()',f.c);
 f.getScanner().read('https://example.org');
 assert.match(f.state.msg,/no pertenece a los photochecks IE 22375/);
 assert.equal(f.state.writes,0);assert.equal(f.state.onlineWrites,0);
});
test('Normal scanner passes decoded code to marking route only when writable',async()=>{
 const f=fixture();f.state.closed=false;
 assert.equal(await vm.runInContext('toggleScan()',f.c),true);
 f.getScanner().read(qr);
 assert.equal(f.state.writes,1);
 assert.equal(f.state.onlineWrites,0);
 vm.runInContext('stopScan()',f.c);
});
test('Scanner opened read-only cannot begin writing when config becomes open mid-session',async()=>{
 const f=fixture();await vm.runInContext('toggleScan()',f.c);
 f.state.closed=false;
 f.getScanner().read(qr);
 assert.equal(f.state.writes,0);
 assert.match(f.state.msg,/Solo lectura/);
});
test('Scanner opened writable switches safely to read-only if bimestre closes',async()=>{
 const f=fixture();f.state.closed=false;
 await vm.runInContext('toggleScan()',f.c);
 f.state.closed=true;f.getScanner().read(qr);
 assert.equal(f.state.writes,0);assert.equal(f.state.onlineWrites,0);
 assert.match(f.state.msg,/Solo lectura/);
});
test('Insecure page and missing reader script do not open the camera',async()=>{
 const a=fixture();a.c.window.isSecureContext=false;
 assert.equal(await vm.runInContext('toggleScan()',a.c),false);
 assert.match(a.state.msg,/HTTPS/);
 assert.equal(a.state.on,false);
 const b=fixture();b.c.Html5Qrcode=undefined;
 assert.equal(await vm.runInContext('toggleScan()',b.c),false);
 assert.match(b.state.msg,/No se cargó el lector QR/);
 assert.equal(b.state.on,false);
});
test('Old decoder callback is ignored after scanner is closed',async()=>{
 const f=fixture();await vm.runInContext('toggleScan()',f.c);
 const cb=f.getScanner().read;
 vm.runInContext('stopScan()',f.c);
 f.state.closed=false;cb(qr);
 assert.equal(f.state.writes,0);assert.equal(f.state.onlineWrites,0);
});
test('Old read-only callback cannot register after a new writable scanner opens',async()=>{
 const f=fixture();await vm.runInContext('toggleScan()',f.c);
 const old=f.getScanner().read;
 vm.runInContext('stopScan()',f.c);
 f.state.closed=false;
 await vm.runInContext('toggleScan()',f.c);
 old(qr);assert.equal(f.state.writes,0);
 f.getScanner().read(qr);assert.equal(f.state.writes,1);
});
test('Camera start error resets UI so user may retry with the same button',async()=>{
 const f=fixture();
 f.c.Html5Qrcode=class{
  constructor(){}
  async start(){throw Error('synthetic camera failure')}
  static async getCameras(){return []}
  clear(){}
 };
 assert.equal(await vm.runInContext('toggleScan()',f.c),false);
 assert.equal(f.state.on,false);
 assert.match(f.state.msg,/No se pudo iniciar la cámara/);
});
test('Real QR marking function records once locally, never invokes automatic cloud upload',()=>{
 const student={nombre:'ALEJOS GALLIQUE, GAEL ALEXANDER',nivel:'primaria',grado:1,seccion:'Única'};
 let record=null,localWrites=0,cloudWrites=0,toastText='',currentLevel='',selectCount=0;
 const elements={scanMsg:{textContent:''},selNivel:{value:'primaria'},selGrado:{value:'1'},selSeccion:{value:'Única'}};
 const ctx=vm.createContext({
  document:{getElementById:id=>elements[id]},
  navigator:{},asistenciaEscribible:()=>true,todosAlumnos:()=>[student],
  hallarAlumno:()=>({al:student}),onNivel(){selectCount++},onGrado(){selectCount++},
  getRec:()=>record||{marca:''},marcaPorHora:()=> 'P',
  setRec:(al,marca,via)=>{localWrites++;record={marca,via};return true;},
  renderLista(){},pitido(){},horaAhora:()=> '08:12',toast:s=>{toastText=s},
  subirUnoNube(){cloudWrites++}
 });
 vm.runInContext(fn('parseQR')+'\n'+fn('marcarPorQR'),ctx);
 vm.runInContext('marcarPorQR("IE22375|primaria|1|Única|ALEJOS GALLIQUE, GAEL ALEXANDER")',ctx);
 assert.equal(localWrites,1);assert.equal(cloudWrites,0);
 assert.equal(record.marca,'P');assert.equal(record.via,'qr');
 assert.match(toastText,/Pendiente de Subir asistencia/);
 vm.runInContext('marcarPorQR("IE22375|primaria|1|Única|ALEJOS GALLIQUE, GAEL ALEXANDER")',ctx);
 assert.equal(localWrites,1,'Rescanning a marked student must not duplicate local state');
 assert.equal(cloudWrites,0);
});
test('Scanner UI has one scan button, no diagnostic button, and explicit separate cloud upload',()=>{
 const form=html.slice(html.indexOf('<main id="vistaAsis"'),html.indexOf('</main>'));
 assert.equal((form.match(/onclick="toggleScan\(\)"/g)||[]).length,1);
 assert.doesNotMatch(form,/onclick="toggleScan\(true\)"|Probar lector QR/);
 assert.match(html.slice(html.indexOf('<footer id="asisResumenDiario"')),/onclick="subirTodoNube\(\)"/);
 assert.match(html,/No se guardó|no se guardó ni se subió asistencia/);
 assert.match(html,/function onDecoded\(text, soloLectura=scanSoloLectura\)/);
 assert.match(html,/facingMode:'environment'/);
 assert.match(html,/if \(code && code\.data\) \{ onDecoded\(code\.data\); return; \}/);
 assert.doesNotMatch(fn('marcarPorQR'),/subirUnoNube\s*\(/);
});
