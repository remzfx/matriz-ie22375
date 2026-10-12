const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','preview-lector-qr-iphone-pr75.html'),'utf8');
const api='https://script.google.com/macros/s/AKfycbxvWf_eODGES6nCJiIw9sKW8tLux8V8z2nY0vlyshzZR8vDLi5UmGTJHTLBV1wQJHV1Ng/exec';
const prod='AKfycbxI0pfjZfeecboqvwx4YOjcvyGTGVa1smmyyE9kNQCmNgNL3tDXwFlPUL0i1DJ2DwBNIg';

function fixture(){
 const nodes=new Map();
 const el=id=>{
  if(!nodes.has(id))nodes.set(id,{textContent:'',className:'',disabled:false,files:[],value:'',innerHTML:'',style:{}});
  return nodes.get(id);
 };
 const ctx=vm.createContext({
  window:{isSecureContext:true,addEventListener(){},location:{origin:'https://raw.githack.com'}},
  document:{getElementById:el,head:{appendChild(){}}},
  navigator:{mediaDevices:{getUserMedia(){}}},
  Date,Promise,console
 });
 const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.equal(scripts.length,1,'Page must have one own JS bundle');
 vm.runInContext(scripts[0][1],ctx);
 return {ctx,el};
}
test('iPhone preview is standalone HTTPS and never points to production',()=>{
 assert.match(html,/<meta name="referrer" content="no-referrer">/);
 assert.match(html,/<script src="vendor\/qrcodejs\.min\.js" defer>/);
 assert.match(html,/html5-qrcode@2\.3\.8\/html5-qrcode\.min\.js/);
 assert.match(html,/icon-192\.png/);
 assert.match(html,/facingMode:'environment'/);
 assert.match(html,/>Escanear QR<\/button>/);
 assert.match(html,/btn\.textContent='Detener cámara'/);
 assert.ok(html.includes(api+'?action=ping'),'Only explicit read-only ping to test endpoint');
 assert.ok(!html.includes(prod),'Production Apps Script ID must never be in preview');
 assert.doesNotMatch(html,/\b(?:fetch|XMLHttpRequest|sendBeacon|localStorage|sessionStorage)\s*(?:\(|\.)/,'No network mutations or stored tokens');
 assert.doesNotMatch(html,/\b(?:saveasis|savereg|setRec|subirTodoNube|subirUnoNube|guardarAsistenciaIngreso_)\b/,'No mutation pathways');
 assert.doesNotMatch(html,/name="(?:pass|password|token)"/i);
});
test('QR analysis recognizes official payload and matches synthetic student without network',()=>{
 const f=fixture();
 const ok=vm.runInContext('analizarQR(qrFicticio)',f.ctx);
 assert.equal(ok,true);
 assert.match(f.el('scan-status').textContent,/Coincide con el estudiante ficticio/);
 assert.match(f.el('scan-status').textContent,/SIN REGISTRAR NI ENVIAR ASISTENCIA/);
 assert.equal(f.el('scan-status').className,'result ok');
});
test('QR analysis supports real accented student but never requests a real roster',()=>{
 const f=fixture();
 const ok=vm.runInContext('analizarQR("IE22375|primaria|1|Única|ÁNGELA MARÍA NIÑA PEÑA")',f.ctx);
 assert.equal(ok,true);
 assert.match(f.el('scan-status').textContent,/Formato institucional reconocido/);
 assert.doesNotMatch(f.el('scan-status').textContent,/ÁNGELA|PEÑA/,'Do not display real student PII');
});
test('Bad QR payloads are rejected without calling production or reading student records',()=>{
 const f=fixture();
 for(const text of ['https://example.com','IE22375|primaria|6|A','IE22375|secundaria|6|A|FICTICIO','IE22375|primaria|1||NOMBRE']){
  const result=vm.runInContext('analizarQR('+JSON.stringify(text)+')',f.ctx);
  assert.equal(result,false);
  assert.equal(f.el('scan-status').className,'result fail');
 }
});
test('Secure context is required for camera, and no API credentials are requested',async()=>{
 const f=fixture();
 f.ctx.window.isSecureContext=false;
 await vm.runInContext('toggleScan()',f.ctx);
 assert.match(f.el('scan-status').textContent,/HTTPS/);
 assert.equal(f.el('scan-toggle').textContent,'');
});
