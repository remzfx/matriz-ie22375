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
 const state={on:false,msg:'',scans:[],writes:0,onlineWrites:0,audio:0,scannerStart:[],closed:true};
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
 vm.runInContext('let html5Qr=null,lastScanAt=0,lastScanText="",scanModoPrueba=false,scanIntento=0;',c);
 for(const name of helpers)c[name]=undefined;
 vm.runInContext(helpers.map(fn).join('\n')+'\n'+fn('toggleScan')+'\n'+fn('stopScan'),c);
 return {c,state,elements,alumno,getScanner:()=>active};
}
test('Diagnostic scans an accented photocheck without saving attendance or touching cloud',async()=>{
 const f=fixture();
 assert.equal(await vm.runInContext('toggleScan(true)',f.c),true);
 assert.equal(f.state.on,true);
 assert.equal(f.state.scannerStart.length,1);
 assert.equal(f.state.scannerStart[0].facingMode,'environment');
 assert.match(f.state.msg,/NO se guardará asistencia/);
 const qr='IE22375|primaria|1|Única|ALEJOS GALLIQUE, GAEL ALEXANDER';
 f.getScanner().read(qr);
 assert.match(f.state.msg,/Prueba correcta: QR leído y estudiante localizado/);
 assert.match(f.state.msg,/NO se registró asistencia/);
 assert.equal(f.state.writes,0);assert.equal(f.state.onlineWrites,0);
 vm.runInContext('stopScan()',f.c);
 assert.equal(f.state.on,false);
});
test('A synthetic photocheck absent from roster is recognized but never marks a student',async()=>{
 const f=fixture();await vm.runInContext('toggleScan(true)',f.c);
 f.getScanner().read('IE22375|primaria|1|Única|ESTUDIANTE SINTÉTICO');
 assert.match(f.state.msg,/QR de IE 22375/);
 assert.match(f.state.msg,/no está en el padrón/);
 assert.equal(f.state.writes,0);
});
test('Diagnostic detects generic QR as non-school code without data mutation',async()=>{
 const f=fixture();await vm.runInContext('toggleScan(true)',f.c);
 f.getScanner().read('https://example.org');
 assert.match(f.state.msg,/no es un photocheck IE 22375/);
 assert.equal(f.state.writes,0);
});
test('Normal attendance scan is blocked when closure cannot be verified',async()=>{
 const f=fixture();
 assert.equal(await vm.runInContext('toggleScan()',f.c),false);
 assert.equal(f.state.scannerStart.length,0);
 assert.equal(f.state.on,false);
 assert.match(f.state.msg,/Usa «Probar lector QR»/);
});
test('Normal scanner still passes decoded values to existing attendance route when writable',async()=>{
 const f=fixture();f.state.closed=false;
 assert.equal(await vm.runInContext('toggleScan()',f.c),true);
 const qr='IE22375|primaria|1|Única|ALEJOS GALLIQUE, GAEL ALEXANDER';
 f.getScanner().read(qr);
 assert.equal(f.state.writes,1);
 vm.runInContext('stopScan()',f.c);
});
test('Insecure page and missing QR library do not open the camera',async()=>{
 const a=fixture();a.c.window.isSecureContext=false;
 assert.equal(await vm.runInContext('toggleScan(true)',a.c),false);
 assert.match(a.state.msg,/HTTPS segura/);
 assert.equal(a.state.scannerStart.length,0);
 const b=fixture();b.c.Html5Qrcode=undefined;
 assert.equal(await vm.runInContext('toggleScan(true)',b.c),false);
 assert.match(b.state.msg,/No se cargó el lector QR/);
});
test('Reader UI explicitly distinguishes real scanner from safe diagnostic test',()=>{
 assert.match(html,/onclick="toggleScan\(true\)">Probar lector QR \(sin registrar\)/);
 assert.match(html,/onchange="leerFotoQR\(this\)"/);
 assert.match(html,/if \(code && code\.data\) \{ onDecoded\(code\.data\); return; \}/);
 assert.match(html,/facingMode:'environment'/);
});
