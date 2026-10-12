const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','photochecks.html'),'utf8');
const vendor=fs.readFileSync(path.join(__dirname,'..','vendor/qrcodejs.min.js'),'utf8');
function fn(name) {
 const token=(['ensureBD','cambiarBimestrePhotochecks'].includes(name)?'async ':'')+'function '+name+'(';
 const start=html.indexOf(token);
 assert.ok(start>=0,'Not found '+name);
 const end=html.indexOf('\n}',start);
 assert.ok(end>start,'Invalid function '+name);
 return html.slice(start,end+2);
}
const names=['bimestrePhotochecks','habilitarPhotochecks','limpiarCarnets','cambiarBimestrePhotochecks',
 'ensureBD','payload','onNivel','onGrado','textoHtml','cardHtml','pintar','generar','generarNivel','imprimirPhotochecks'];
const functions=names.map(fn).join('\n');
function mockFixture() {
 const elems=new Map(),calls=[],encoded=[],logs=[];
 let selected='III',printCount=0;
 const el=id=>{
  if(!elems.has(id))elems.set(id,{value:'',disabled:false,innerHTML:'',textContent:'',
   querySelector(){return {nodeName:'CANVAS'}}});
  return elems.get(id);
 };
 el('selBimestre').value=selected;el('selNivel').value='secundaria';
 let roster=null,reject=null,token='synthetic-token';
 const synthetic=(nivel,n)=>{
  return Array.from({length:n},(_,i)=>({nivel,grado:1,seccion:nivel==='primaria'?'Única':'A',
   nombre:'Synthetic '+nivel+' '+String(i).padStart(3,'0'),estadoMatricula:'DEFINITIVA',
   orden:i,idSiagie:nivel+i}));
 };
 const data=(primary=146,secondary=257)=>({
  primaria:{estudiantes:synthetic('primaria',primary)},
  secundaria:{estudiantes:synthetic('secundaria',secondary)},
  bimestre:'III',padronInicializado:true,fuentePadron:'bimestre',offline:false
 });
 const ie={
  empty:()=>({primaria:{estudiantes:[]},secundaria:{estudiantes:[]}}),
  validToken:()=>token,
  loadRoster:async bim=>{
   calls.push(bim);
   if(reject)throw reject;
   return roster||data();
  },
  load(){throw Error('Unauthorized fallback to BASE_ACTUAL');}
 };
 function QRCode(node,options){
  if(!options.text.startsWith('IE22375|'))throw Error('Wrong QR payload');
  encoded.push(options);
 }
 QRCode.CorrectLevel={M:'M'};
 const context=vm.createContext({document:{getElementById:el},IEStudents:ie,QRCode,
  window:{print(){printCount++}},Date,String,Set,Number,Map,console,
  alert:msg=>logs.push(msg)});
 vm.runInContext('let BD=IEStudents.empty(),padronVerificado=false,photocheckSerial=0,carnetsListos=false;\n'+functions,context);
 return {el,context,ie,data,setRoster:r=>roster=r,setReject:e=>reject=e,
  setToken:t=>token=t,calls,encoded,logs,printCount:()=>printCount,
  run:code=>vm.runInContext(code,context)};
}
test('Photocheck loads exactly PADRON_III, not BASE_ACTUAL or a hardcoded total',async()=>{
 const s=mockFixture(),ok=await s.run('ensureBD()');
 assert.equal(ok,true);
 assert.deepEqual(s.calls,['III']);
 assert.match(s.el('lblBD').textContent,/Padrón oficial III confirmado/);
 assert.match(s.el('lblBD').textContent,/Primaria 146/);
 assert.match(s.el('lblBD').textContent,/Secundaria 257/);
 assert.equal(s.el('btnGenerar').disabled,false);
 assert.equal(s.el('btnImprimir').disabled,true);
 assert.equal(s.run('BD.primaria.estudiantes.length'),146);
 assert.equal(s.run('BD.secundaria.estudiantes.length'),257);
});
test('Official counts come from the response, never fabricated or copied from previous bimestre',async()=>{
 const s=mockFixture();s.setRoster(s.data(4,7));
 assert.equal(await s.run('ensureBD()'),true);
 assert.match(s.el('lblBD').textContent,/Primaria 4 · Secundaria 7/);
});
test('Unverified/legacy general roster must never produce photochecks',async()=>{
 for (const unverified of [
  {bimestre:'III',padronInicializado:false,fuentePadron:'actual'},
  {bimestre:'III',padronInicializado:true,fuentePadron:'actual'},
  {bimestre:'II',padronInicializado:true,fuentePadron:'bimestre'},
  {bimestre:'III',padronInicializado:true,fuentePadron:'bimestre',offline:true}
 ]) {
  const s=mockFixture(),fake={...s.data(3,6),...unverified};s.setRoster(fake);
  assert.equal(await s.run('ensureBD()'),false,JSON.stringify(unverified));
  assert.equal(s.run('generarNivel()'),false);
  assert.equal(s.el('btnGenerar').disabled,true);
  assert.equal(s.el('btnImprimir').disabled,true);
  assert.equal(s.encoded.length,0);
  assert.match(s.el('lblBD').textContent,/No se pudo confirmar/);
 }
});
test('Failed network preserves no stale roster and cannot print',async()=>{
 const s=mockFixture();assert.equal(await s.run('ensureBD()'),true);
 s.setReject(Error('Synthetic network unavailable'));
 assert.equal(await s.run('ensureBD()'),false);
 assert.equal(s.run('BD.secundaria.estudiantes.length'),0);
 assert.equal(s.run('imprimirPhotochecks()'),false);assert.equal(s.printCount(),0);
 assert.equal(s.el('btnGenerarNivel').disabled,true);
});
test('Change bimestre reloads the matching roster only and invalidates old photochecks',async()=>{
 const s=mockFixture();assert.equal(await s.run('ensureBD()'),true);
 s.el('selBimestre').value='IV';
 assert.equal(await s.run('cambiarBimestrePhotochecks()'),false);
 assert.deepEqual(s.calls,['III','IV']);
 assert.equal(s.el('btnGenerar').disabled,true);
 assert.equal(s.el('btnImprimir').disabled,true);
 assert.equal(s.el('sheet').innerHTML,'');
});
test('School-specific QR payload remains compatible with Auxiliar reader',async()=>{
 const s=mockFixture(),base=s.data(2,3);
 s.setRoster(base);assert.equal(await s.run('ensureBD()'),true);
 assert.equal(s.run('generarNivel()'),true);
 assert.equal(s.encoded.length,3);
 const first=base.secundaria.estudiantes[0];
 assert.equal(s.encoded[0].text,'IE22375|secundaria|1|A|'+first.nombre);
 assert.equal(s.encoded[0].width,192);
 assert.equal(s.el('btnImprimir').disabled,false);
 assert.equal(s.run('imprimirPhotochecks()'),true);
 assert.equal(s.printCount(),1);
 assert.match(s.el('sheet').innerHTML,/I\.E\. N\.° 22375/);
 assert.match(s.el('sheet').innerHTML,/CREDENCIAL DE INGRESO/);
});
test('No QR library, no blank printable cards; no false success',async()=>{
 const s=mockFixture();s.setRoster(s.data(1,2));
 await s.run('ensureBD()');
 s.context.QRCode=undefined;
 assert.equal(s.run('generarNivel()'),false);
 assert.equal(s.el('btnImprimir').disabled,true);
 assert.match(s.el('lblN').textContent,/Generador QR no disponible/);
});
test('Local QR library and print stylesheet are included with attribution',()=>{
 assert.match(html,/src="vendor\/qrcodejs\.min\.js"/);
 assert.doesNotMatch(html,/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs/);
 assert.match(vendor,/QRCode/);
 const license=fs.readFileSync(path.join(__dirname,'..','vendor/qrcodejs-LICENSE.txt'),'utf8');
 assert.match(license,/MIT License/);
 assert.match(html,/@page\s*\{\s*size:A4/);
 assert.match(html,/@media print/);
 assert.match(html,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(html,/Imprimir \/ Guardar PDF/);
});

test('Carnet and independent preview both use the real 192px school crest from the repository',()=>{
 const img=fs.readFileSync(path.join(__dirname,'..','icon-192.png'));
 assert.equal(img.subarray(0,8).toString('hex'),'89504e470d0a1a0a','Official logo must be a valid PNG asset');
 assert.equal(img.readUInt32BE(16),192);
 assert.equal(img.readUInt32BE(20),192);
 const preview=fs.readFileSync(path.join(__dirname,'..','preview-photochecks-pr75.html'),'utf8');
 for(const html of [fs.readFileSync(path.join(__dirname,'..','photochecks.html'),'utf8'),preview]){
  assert.match(html,/<img class="badge-emblem" src="icon-192\.png" alt="Insignia oficial de la I\.E\. 22375"/);
  assert.match(html,/\.badge-emblem \{ width:14mm; height:14mm; /);
  assert.doesNotMatch(html,/<div class="badge-emblem"[^>]*>22375/,'Do not regress to the placeholder badge');
 }
});
