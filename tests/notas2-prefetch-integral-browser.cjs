'use strict';
// Production Registro/core/coordinator/connection/students/reset transport; synthetic backend and fresh browser profiles.
const fs=require('node:fs'),assert=require('node:assert/strict'),{fixture}=require('./notas2-prefetch-browser.cjs');
const read=f=>fs.readFileSync(f,'utf8'),script=s=>'<script>'+s.replace(/<\/script/gi,'<\\/script')+'</script>';
function html(level){
 const setup=`window.integralRequests=[];window.integralRelease=null;window.holdFirst=true;window.notesActive=0;window.maxNotesActive=0;window.integrationDB={};window.testPeriods={I:'abierto',II:'cerrado',III:'abierto',IV:'bloqueado'};
 fixtureSession.grados=Array.from({length:nivel==='primaria'?6:5},(_,i)=>i+1);fixtureSession.token=btoa(JSON.stringify({exp:Date.now()+3600000}))+'.synthetic-only';fixtureSession.tokenExp=Date.now()+3600000;
 const classrooms=fixtureSession.grados.flatMap(grado=>nivel==='primaria'?[{grado,seccion:'Única'}]:[{grado,seccion:'A'},{grado,seccion:'B'}]);
 fixtureSession.asignaciones={'Matemática':classrooms.map(c=>c.grado+'|'+c.seccion),'Comunicación':classrooms.filter(c=>nivel==='primaria'||c.seccion==='A').map(c=>c.grado+'|'+c.seccion)};fixtureSession.areas=Object.keys(fixtureSession.asignaciones);fixtureSession.aulas=fixtureSession.asignaciones['Matemática'];sessionStorage.setItem('ie22375_session_v1',JSON.stringify(fixtureSession));
 fixtureRoster=classrooms.flatMap(c=>Array.from({length:30},(_,i)=>({nivel,grado:c.grado,seccion:c.seccion,idSiagie:'synth-'+c.grado+'-'+c.seccion+'-'+i,codigoEstudiante:'SYN'+c.grado+c.seccion+i,nombre:'ESTUDIANTE FICTICIO APELLIDOS COMPLETOS '+c.grado+' '+c.seccion+' '+i,orden:i+1})));
 bdEstudiantes={primaria:{estudiantes:[]},secundaria:{estudiantes:[]},version:'roster-III',bimestre:'III',inicializada:true,padronInicializado:true};bdEstudiantes[nivel].estudiantes=fixtureRoster;padronBimestre='III';tokenPadron=fixtureSession.token;padronVerificadoServidor=true;
 sessionStorage.setItem('ie22375_students_session_v1',JSON.stringify({token:fixtureSession.token,scope:'students:III',until:Date.now()+3600000,base:bdEstudiantes}));
 localStorage.setItem('ie22375_periodos_cloud_v1',JSON.stringify({anio:2026,bimestres:testPeriods}));document.getElementById('selBim').innerHTML=['I','II','III','IV'].map(b=>'<option>'+b+'</option>').join('');document.getElementById('selBim').value='III';document.getElementById('selGrado').innerHTML=fixtureSession.grados.map(g=>'<option>'+g+'</option>').join('');document.getElementById('selGrado').value='1';document.getElementById('selSeccion').innerHTML='<option>'+(nivel==='primaria'?'Única':'A')+'</option>';areaActual='Matemática';contextoActivoRegistro=null;
 window.integralContexts=[];
 for(const bim of ['I','II','III','IV'])for(const [area,aulas]of Object.entries(fixtureSession.asignaciones))for(const a of aulas){
  const [grade,section]=a.split('|'),c={nivel,bim,grado:Number(grade),seccion:section,area},k=[nivel,bim,grade,section,area].join('||'),p=Object.fromEntries(Object.values(IERegistroNotas2.fields).flat().map(f=>[f,f==='sessions'?[]:{}]));
  for(const cp of IERegistroAcademico.catalog[nivel][area])for(const al of fixtureRoster.filter(al=>al.grado===c.grado&&al.seccion===c.seccion)){const f=k+'||'+cp+'||'+studentKey(al);p.finales[f]={nivel:al.orden===2?'C':'A',nota20:al.orden===2?8:15,origen:'numero',ts:1};if(al.orden===2)p.concComp[f]={texto:'Conclusión ficticia confirmada',ts:1};}
  const student=fixtureRoster.find(al=>al.grado===c.grado&&al.seccion===c.seccion);p.asistencia[[nivel,bim,grade,section,'2026-10-01',studentKey(student)].join('||')]={marca:'P',ts:1};
  integrationDB[k]={payload:p,versions:{calificar:1,promedios:1,asistencia:1},at:{calificar:1,promedios:1,asistencia:1}};if(testPeriods[bim]==='abierto')integralContexts.push(c);
 }
 onContexto({localOnly:true,forzar:true});setModoCalif('num');
 window.fetch=async(url,options)=>{
  const body=options?.body?JSON.parse(options.body):Object.fromEntries(new URL(url).searchParams);integralRequests.push(body);const reply=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  if(body.action==='academicstate')return reply({ok:true,academicReset:1,epoch:null,phase:null});
  if(body.action==='loadperiodos')return reply({ok:true,periodos:{anio:2026,bimestres:testPeriods}});
  if(body.action==='loadstudents'&&window.integralMissingRoster&&body.bimestre==='I')return reply({ok:false,code:'ROSTER_MISSING'});
  if(body.action==='loadstudents')return reply({ok:true,version:'roster-'+body.bimestre,bimestre:body.bimestre,inicializada:true,padronInicializado:true,estudiantes:fixtureRoster,fuentePadron:'fixture'});
  if(body.action==='loadtplstatus')return reply({ok:true,exists:false});
  const k=[body.nivel,body.bimestre,body.grado,body.seccion,body.area].join('||'),db=integrationDB[k];if(!db)throw Error('Unexpected fixture context '+body.action+' '+k);
  if(body.action==='loadreg')return reply({ok:true,soportaModeloAcademico:true,items:[{clave:k,nivel:body.nivel,bimestre:body.bimestre,grado:body.grado,seccion:body.seccion,area:body.area,payload:db.payload,ts:1}]});
  if(body.action==='savenotas2'){if(body.version!==db.versions[body.panel])return reply({ok:false,code:'CONFLICT'});Object.assign(db.payload,JSON.parse(JSON.stringify(body.payload)));db.versions[body.panel]++;db.at[body.panel]=2;}
  if(body.action==='loadnotas2'){notesActive++;maxNotesActive=Math.max(maxNotesActive,notesActive);if(holdFirst&&k!==[nivel,'III',1,nivel==='primaria'?'Única':'A','Matemática'].join('||'))await new Promise(resolve=>integralRelease=()=>{holdFirst=false;resolve();});notesActive--;}
  return reply({ok:true,notas2:1,key:k,exists:true,legacy:false,readonly:testPeriods[body.bimestre]!=='abierto',...db,...(body.panel?{panel:body.panel}:{})});
 };
 `;
 let h=fixture(level).replace(script(read('academic-reset-client.js')),'');const ui=script(read('registro-notas2-ui.js'));
 h=h.replace(ui,script(setup)+script(read('students.js'))+script(read('academic-reset-client.js'))+ui);return h;
}
async function navigate(page,c){
 await page.evaluate(async c=>{
  if(document.getElementById('selBim').value!==c.bim){document.getElementById('selBim').value=c.bim;await cambiarBimestreRegistro();}
  if(Number(document.getElementById('selGrado').value)!==c.grado){document.getElementById('selGrado').value=String(c.grado);onGrado();}
  if(document.getElementById('selSeccion').value!==c.seccion){document.getElementById('selSeccion').value=c.seccion;onContexto();}
  if(areaActual!==c.area)setArea(c.area);IERegistroNotas2UI.refresh();
 },c);
 await page.waitForFunction(c=>cloudClaveReg()===[c.nivel,c.bim,c.grado,c.seccion,c.area].join('||')&&IERegistroNotas2UI.canEdit('promedios'),c,{timeout:12000});
}
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});const results=[];
 try{for(const level of ['primaria','secundaria'])for(const width of (process.env.IE_INTEGRAL_SINGLE? [1366]:[1366,390])){if(process.env.IE_INTEGRAL_SINGLE&&level!=='primaria')continue;
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let cancel=false;page.on('pageerror',e=>errors.push(e.stack||e.message));page.on('dialog',d=>cancel?d.dismiss():d.accept());
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html(level)}):r.abort());await page.goto('https://fixture.invalid/');
  await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&typeof integralRelease==='function',null,{timeout:12000});
  const input=page.locator('#finLista .fin-nota').first();await input.fill('17');await input.press('Tab');await page.waitForFunction(()=>Object.values(store.finales).some(v=>v.nota20===17));
  await page.locator('#finLista .academic-conclusion').first().fill('Conclusión integral pendiente');await page.waitForFunction(()=>Object.values(store.concComp).some(v=>v.texto==='Conclusión integral pendiente'));await input.fill('18');await input.focus();
  const cdp=await context.newCDPSession(page),heapBefore=await cdp.send('Runtime.getHeapUsage');
  await page.evaluate(()=>{window.visibleNode=document.querySelector('#finLista .fin-nota');window.visibleBefore=JSON.stringify(store);window.assistanceBefore=JSON.stringify(store.asistencia);window.diskBefore=registroLocal.read();integralRelease();});
  await page.waitForFunction(()=>IERegistroNotas2UI.prefetchStatus().completed===integralContexts.length-1&&!IERegistroNotas2UI.prefetchStatus().pending,null,{timeout:60000});
  assert.equal(await input.inputValue(),'18');assert.equal(await page.evaluate(()=>document.activeElement===visibleNode&&document.querySelector('#finLista .fin-nota')===visibleNode&&JSON.stringify(store)===visibleBefore&&registroLocal.read()===diskBefore),true);
  const before=await page.evaluate(()=>({total:integralContexts.length,status:IERegistroNotas2UI.prefetchStatus(),reads:integralRequests.filter(b=>b.action==='loadnotas2').length,auth:integralRequests.filter(b=>b.action==='academicstate').length,maxNotesActive,studentsReads:integralRequests.filter(b=>b.action==='loadstudents').length}));
  const heapAfter=await cdp.send('Runtime.getHeapUsage');assert.equal(before.reads,before.total);assert.equal(before.maxNotesActive,1);assert.equal(await page.evaluate(()=>integralRequests.filter(b=>b.action==='savenotas2').length),0);
  const original=await page.evaluate(()=>ctxBase()),contexts=await page.evaluate(()=>integralContexts),grades=Array.from({length:level==='primaria'?6:5},(_,i)=>i+1);
  for(const grado of grades)await navigate(page,contexts.find(c=>c.bim==='III'&&c.area==='Matemática'&&c.grado===grado));
  if(level==='secundaria')await navigate(page,contexts.find(c=>c.bim==='III'&&c.grado===5&&c.seccion==='B'));
  await navigate(page,contexts.find(c=>c.bim==='I'&&c.area==='Matemática'&&c.grado===grades.at(-1)));
  await navigate(page,original);assert.equal(await input.inputValue(),'18');assert.equal(await page.locator('#finLista .academic-conclusion').first().inputValue(),'Conclusión integral pendiente');
  const communication={...original,area:'Comunicación'};await navigate(page,communication);assert.equal(await page.evaluate(()=>JSON.stringify(store.asistencia)===assistanceBefore),true);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.current().status().panels.asistencia.version),null);
  assert.equal(await page.evaluate(()=>integralRequests.filter(b=>b.action==='loadnotas2').length),before.reads,'All selected academic contexts reuse their reserved payload');
  const hits=await page.evaluate(()=>IERegistroNotas2UI.prefetchStatus().cacheHits);assert.ok(hits>=grades.length);
  const checkingAttendance=await page.evaluate(()=>{showPanel('as');IERegistroNotas2UI.refresh();return {state:document.getElementById('hdrSyncIndicator').dataset.state,disabled:document.querySelector('[onclick=\"IERegistroNotas2UI.process()\"]').disabled};});assert.equal(checkingAttendance.state,'checking');assert.equal(checkingAttendance.disabled,true);await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('asistencia'));assert.equal(await page.evaluate(()=>IERegistroNotas2UI.current().status().panels.asistencia.version),1);
  await page.evaluate(()=>showPanel('fin'));
  const beforeClosed=await page.evaluate(()=>integralRequests.filter(b=>b.action==='loadnotas2'&&b.bimestre==='II').length);await page.evaluate(async()=>{document.getElementById('selBim').value='II';await cambiarBimestreRegistro();});await page.waitForFunction(()=>registroHistoricoActual?.c.bim==='II');assert.equal(await page.evaluate(()=>IERegistroNotas2UI.canEdit('promedios')),false);assert.equal(await page.evaluate(()=>integralRequests.filter(b=>b.action==='loadnotas2'&&b.bimestre==='II').length),beforeClosed);await navigate(page,communication);
  await input.fill('14');await page.evaluate(()=>integrationDB[cloudClaveReg()].versions.promedios++);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.save()),false);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.current().status().state),'conflict');
  cancel=true;assert.equal(await page.evaluate(()=>IERegistroNotas2UI.download()),false);assert.equal(await input.inputValue(),'14');
  const stats=await page.evaluate(()=>IERegistroNotas2UI.prefetchStatus());assert.deepEqual(errors,[]);assert.ok(stats.peakBytes<=stats.limits.maxBytes);assert.equal(await page.evaluate(()=>integralRequests.filter(b=>b.action==='savenotas2').length),1);
  results.push({level,width,enumerated:before.total,prepared:before.status.completed,initialAcademicReads:before.reads,rosterReads:before.studentsReads,authenticatedChecks:before.auth,peakReceiptBytes:before.status.peakBytes,rosterBytes:before.status.rosterRetainedBytes,peakTotalBytes:before.status.peakTotalBytes,heapUsedBefore:heapBefore.usedSize,heapUsedAfter:heapAfter.usedSize,avoidedForegroundReads:hits,backgroundConcurrency:before.maxNotesActive,automaticWrites:0});await context.close();
 }
 const isolated=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),failedPage=await isolated.newPage();failedPage.on('dialog',d=>d.accept());
 const ui=script(read('registro-notas2-ui.js')),markup=html('primaria').replace(ui,script('window.integralMissingRoster=true;')+ui);
 await failedPage.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:markup}):r.abort());await failedPage.goto('https://fixture.invalid/');
 await failedPage.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&typeof integralRelease==='function');await failedPage.locator('#finLista .fin-nota').first().fill('17');await failedPage.evaluate(()=>integralRelease());
 await failedPage.waitForFunction(()=>IERegistroNotas2UI.prefetchStatus().completed===11&&!IERegistroNotas2UI.prefetchStatus().pending,null,{timeout:30000});
 assert.equal(await failedPage.evaluate(()=>!!IEStudents.peekRoster('III')&&!registroSoloLectura()&&IERegistroNotas2UI.canEdit('promedios')),true);assert.equal(await failedPage.locator('#finLista .fin-nota').first().inputValue(),'17');
 assert.deepEqual(await failedPage.evaluate(()=>IERegistroNotas2UI.prefetchStatus().rosterUnavailable),[{bimestre:'I',code:'ROSTER_MISSING'}]);assert.equal(await failedPage.evaluate(()=>integralRequests.filter(b=>b.action==='savenotas2').length),0);
 results.push({scenario:'missing-background-roster',enumerated:12,prepared:11,visibleRosterIntact:true,automaticWrites:0});await isolated.close();
 console.log(JSON.stringify({passed:results.length,failed:0,transport:'synthetic',externalNetwork:'blocked',results}));}finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
