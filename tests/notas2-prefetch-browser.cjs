'use strict';
// Real Registro DOM, core, connection, read-only transport and coordinator. No external network.
const fs=require('node:fs'),assert=require('node:assert/strict'),{html}=require('./notas2-browser.cjs');
const read=f=>fs.readFileSync(f,'utf8'),script=s=>'<script>'+s.replace(/<\/script/gi,'<\\/script')+'</script>';
function fixture(level){
 const primary=level==='primaria',a={nivel:level,bim:'III',grado:3,seccion:primary?'Única':'B',area:'Matemática'},b={...a,grado:4,seccion:primary?'Única':'A'};
 const setup=`window.fixtureA=${JSON.stringify(a)};window.fixtureB=${JSON.stringify(b)};window.prefetchRequests=[];window.releaseB=null;window.mockDB={};window.denied=false;window.cancelRecovery=false;
 fixtureSession.grados=[3,4];fixtureSession.permisosVersion=1;fixtureSession.areas=['Matemática'];fixtureSession.aulas=[fixtureA.grado+'|'+fixtureA.seccion,fixtureB.grado+'|'+fixtureB.seccion];fixtureSession.asignaciones={'Matemática':fixtureSession.aulas};
 sessionStorage.setItem('ie22375_session_v1',JSON.stringify(fixtureSession));
 window.fixtureRoster=[fixtureA,fixtureB].flatMap(c=>Array.from({length:3},(_,i)=>({idSiagie:'synthetic-'+c.grado+'-'+i,codigoEstudiante:'SYN'+c.grado+i,nombre:'ESTUDIANTE FICTICIO '+c.grado+' '+i,nivel:c.nivel,grado:c.grado,seccion:c.seccion,orden:i+1})));
 bdEstudiantes[nivel]={estudiantes:fixtureRoster};padronBimestre='III';padronVerificadoServidor=true;tokenPadron=fixtureSession.token;areaActual='Matemática';
 document.getElementById('selBim').innerHTML='<option>III</option>';document.getElementById('selGrado').innerHTML='<option>3</option><option>4</option>';document.getElementById('selSeccion').innerHTML='<option>'+fixtureA.seccion+'</option>';document.getElementById('selGrado').value='3';
 for(const c of [fixtureA,fixtureB]){const k=[c.nivel,c.bim,c.grado,c.seccion,c.area].join('||'),p=Object.fromEntries(Object.values(IERegistroNotas2.fields).flat().map(f=>[f,f==='sessions'?[]:{}]));for(const al of fixtureRoster.filter(x=>x.grado===c.grado))p.finales[k+'||'+competencias()[0]+'||'+studentKey(al)]={nivel:c.grado===3?'A':'B',nota20:c.grado===3?15:12,origen:'numero',ts:1};mockDB[k]={payload:p,versions:{calificar:1,promedios:1,asistencia:1},at:{calificar:1,promedios:1,asistencia:1}};}
 const ka=[fixtureA.nivel,fixtureA.bim,fixtureA.grado,fixtureA.seccion,fixtureA.area].join('||'),student=fixtureRoster.filter(al=>al.grado===3)[1],fk=ka+'||'+competencias()[0]+'||'+studentKey(student);mockDB[ka].payload.finales[fk]={nivel:'C',nota20:8,origen:'numero',ts:1};mockDB[ka].payload.concComp[fk]={texto:'Conclusión original ficticia',ts:1};const aula=ka.split('||').slice(0,4).join('||');mockDB[ka].payload.asistencia[aula+'||2026-10-01||'+studentKey(student)]={marca:'P',ts:1};
 onContexto({localOnly:true,forzar:true});setModoCalif('num');
 window.fetch=async(_url,options)=>{const body=JSON.parse(options.body);prefetchRequests.push(body);const reply=data=>({ok:true,status:200,text:async()=>JSON.stringify(data),json:async()=>JSON.parse(JSON.stringify(data))});
 if(denied)return reply({ok:false,code:'SESSION'});if(body.action==='academicstate')return reply({ok:true,academicReset:1,epoch:null,phase:null});
 const k=[body.nivel,body.bimestre,body.grado,body.seccion,body.area].join('||'),db=mockDB[k];if(!db)throw Error('Unexpected synthetic context '+k);
 if(body.action==='savenotas2'){if(body.version!==db.versions[body.panel])return reply({ok:false,code:'CONFLICT'});Object.assign(db.payload,JSON.parse(JSON.stringify(body.payload)));db.versions[body.panel]++;db.at[body.panel]=2;}
 if(body.action==='loadnotas2'&&body.grado===4&&!window.bReleased)await new Promise(resolve=>window.releaseB=()=>{window.bReleased=true;resolve();});
 return reply({ok:true,notas2:1,key:k,exists:true,legacy:false,readonly:false,...db,...(body.panel?{panel:body.panel}:{})});};
 `;
 const current=script(read('registro-notas2-ui.js'));
 return html(level).replace(current,script(setup)+script(read('academic-identity.js'))+script(read('academic-reset.js'))+script(read('academic-reset-client.js'))+script(read('registro-notas2-prefetch.js'))+current);
}
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});let passed=0;const metrics=[];
 try{for(const level of ['primaria','secundaria'])for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let cancelRecovery=false;page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>cancelRecovery?d.dismiss():d.accept());
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:fixture(level)}):r.abort());await page.goto('https://fixture.invalid/');
  try{await page.waitForFunction(()=>IERegistroNotas2UI?.canEdit('promedios')&&typeof releaseB==='function',null,{timeout:10000});}catch(e){console.error({errors,debug:await page.evaluate(()=>({ctx:ctxBase(),state:IERegistroNotas2UI?.current()?.status(),connection:IERegistroConnection.current().snapshot(),prefetch:IERegistroNotas2UI?.prefetchStatus(),requests:prefetchRequests.map(b=>({action:b.action,grado:b.grado,seccion:b.seccion})),dialogs:fixtureDialogs}))});throw e;}
  const input=page.locator('#finLista .fin-nota').first();await input.fill('17');await input.press('Tab');await page.waitForFunction(()=>Object.values(store.finales).some(v=>v.nota20===17));await page.locator('#finLista .academic-conclusion').first().fill('Conclusión local ficticia pendiente');await page.waitForFunction(()=>Object.values(store.concComp).some(v=>v.texto==='Conclusión local ficticia pendiente'));await input.focus();
  await page.evaluate(()=>{window.aNode=document.querySelector('#finLista .fin-nota');window.aBefore=JSON.stringify(store);window.diskBefore=registroLocal.read();window.attendanceBefore=JSON.stringify(store.asistencia);});
  await page.evaluate(()=>releaseB());await page.waitForFunction(()=>!IERegistroNotas2UI.prefetchStatus().pending);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.prefetchStatus().reserved),true,'B must be validated and reserved');
  assert.equal(await input.inputValue(),'17');assert.equal(await page.evaluate(()=>document.activeElement===aNode&&document.querySelector('#finLista .fin-nota')===aNode),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(store)===aBefore&&registroLocal.read()===diskBefore),true);
  const retained=await page.evaluate(()=>IERegistroNotas2UI.prefetchStatus().retainedBytes);assert.ok(retained>0);
  await page.evaluate(()=>{document.getElementById('selGrado').value='4';onGrado();IERegistroNotas2UI.refresh();});
  await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&ctxBase().grado===4);assert.equal(await input.inputValue(),'12');
  assert.equal(await page.evaluate(()=>prefetchRequests.filter(b=>b.action==='loadnotas2'&&b.grado===4).length),1,'B uses its reserved payload after fresh foreground authorization');
  assert.equal(await page.evaluate(()=>prefetchRequests.filter(b=>b.action==='savenotas2').length),0);
  await page.evaluate(()=>{document.getElementById('selGrado').value='3';onGrado();IERegistroNotas2UI.refresh();});await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&ctxBase().grado===3);assert.equal(await input.inputValue(),'17');assert.equal(await page.locator('#finLista .academic-conclusion').first().inputValue(),'Conclusión local ficticia pendiente');assert.equal(await page.evaluate(()=>JSON.stringify(store.asistencia)===attendanceBefore),true);
  await page.evaluate(()=>{document.getElementById('selGrado').value='4';onGrado();IERegistroNotas2UI.refresh();});await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&ctxBase().grado===4);
  await input.fill('14');await page.evaluate(()=>{const k=cloudClaveReg();mockDB[k].versions.promedios++;});assert.equal(await page.evaluate(()=>IERegistroNotas2UI.save()),false);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.current().status().state),'conflict');assert.equal(await input.inputValue(),'14');
  cancelRecovery=true;assert.equal(await page.evaluate(()=>IERegistroNotas2UI.download()),false);assert.equal(await input.inputValue(),'14');
  const counts=await page.evaluate(()=>({academicReads:prefetchRequests.filter(b=>b.action==='loadnotas2').length,authenticatedChecks:prefetchRequests.filter(b=>b.action==='academicstate').length,explicitWriteAttempts:prefetchRequests.filter(b=>b.action==='savenotas2').length,background:IERegistroNotas2UI.prefetchStatus()}));
  metrics.push({level,width,retainedBytes:retained,...counts});assert.deepEqual(errors,[]);await context.close();passed++;
 }
 for(const interruption of ['revocation','offline']){
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:fixture('secundaria')}):r.abort());await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&typeof releaseB==='function');
  const input=page.locator('#finLista .fin-nota').first();await input.fill('17');
  if(interruption==='revocation'){
   await page.evaluate(()=>{denied=true;releaseB();});await page.waitForFunction(()=>IERegistroConnection.current().snapshot().state==='session');assert.equal(await page.evaluate(()=>IERegistroNotas2UI.canEdit('promedios')),false);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.save()),false);assert.equal(await input.inputValue(),'17');
  }else{
   await page.evaluate(()=>{window.dispatchEvent(new Event('offline'));releaseB();});await page.waitForFunction(()=>IERegistroConnection.current().snapshot().state==='offline');assert.equal(await input.inputValue(),'17');assert.equal(await page.evaluate(()=>IERegistroNotas2UI.prefetchStatus().reserved),false);
   await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&IERegistroNotas2UI.prefetchStatus().reserved);assert.equal(await input.inputValue(),'17');
  }
  assert.equal(await page.evaluate(()=>prefetchRequests.filter(b=>b.action==='savenotas2').length),0);assert.deepEqual(errors,[]);metrics.push({interruption,retainedDraft:17,automaticWrites:0});await context.close();passed++;
 }
 console.log(JSON.stringify({passed,failed:0,transport:'synthetic',externalNetwork:'blocked',metrics}));}finally{await browser.close();}
}
module.exports={fixture,run};if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
