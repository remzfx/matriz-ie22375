'use strict';
// Real Registro DOM/controller/core/queue. Only transport, latency and fictitious records are synthetic.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const helpers=new Function('require',fs.readFileSync('tests/notas2-prefetch-integral-browser.cjs','utf8').split('async function run(){')[0]+'\nreturn {html,navigate};')(require);
const script=s=>'<script>'+s.replace(/<\/script/gi,'<\\/script')+'</script>';
function html(delay){
 let h=helpers.html('secundaria').replace(/\r\n/g,'\n').replace('window.holdFirst=true;','window.holdFirst=false;').replace("window.testPeriods={I:'abierto',II:'cerrado',III:'abierto',IV:'bloqueado'};","window.testPeriods={I:'cerrado',II:'cerrado',III:'abierto',IV:'bloqueado'};");
 const ui=script(fs.readFileSync('registro-notas2-ui.js','utf8').replace(/\r\n/g,'\n'));
 assert.ok(h.includes(ui),'Actual adapter must be instrumented');
 const auth="if(body.action==='academicstate')return reply({ok:true,academicReset:1,epoch:null,phase:null});";
 assert.ok(h.includes(auth));h=h.replaceAll(auth,"if(body.action==='academicstate'){const issuedAt=Date.now();return reply({ok:true,academicReset:1,epoch:null,phase:null,...(body.contextAuthorization===1?{contextAuthorization:{schema:1,user:fixtureSession.user,role:fixtureSession.role,nivel:fixtureSession.nivel,permisosVersion:fixtureSession.permisosVersion,issuedAt,expiresAt:issuedAt+150000,epoch:null,contexts:integralContexts.map(c=>[c.nivel,c.bim,c.grado,c.seccion.toUpperCase(),c.area].join('||'))}}:{})});}");
 const setup=`window.readDelay=${delay};window.readAction='loadnotas2';window.readFailure='';window.readCalls=[];
 const q=IERegistroNotas2Prefetch.create;IERegistroNotas2Prefetch.create=o=>{const x=q(o);x.hold('feedback-test');window.feedbackQueue=x;return x;};
 const transport=window.fetch;window.fetch=async(u,o)=>{const b=JSON.parse(o.body);readCalls.push(b.action);if(b.action===readAction){await new Promise((resolve,reject)=>{const t=setTimeout(resolve,readDelay);o.signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'));},{once:true});});if(readFailure==='NETWORK')throw Error('Synthetic offline');if(readFailure==='SESSION')return new Response(JSON.stringify({ok:false,code:'SESSION'}));}return transport(u,o);};`;
 return h.replace(ui,()=>script(setup)+ui);
}
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true}),results=[],out=process.env.IE_READ_OUTPUT;
 if(out)fs.mkdirSync(out,{recursive:true});
 try{for(const width of [1366,390])for(const delay of [3000,5000,10000]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let external=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html(delay)}):(external++,r.abort()));
  const start=Date.now();await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>document.querySelector('#finContextLoading .registro-read-spinner'));
  assert.match(await page.locator('#finContextLoading').innerText(),/Cargando calificaciones de 1.º A/);
  assert.equal(await page.locator('#finContextLoading').getAttribute('aria-live'),'polite');
  if(out&&delay===3000)await page.screenshot({path:path.join(out,'carga-'+width+'.png'),fullPage:true});
  await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&document.querySelector('#finLista table'),null,{timeout:18000});
  const initialMs=Date.now()-start;assert.equal(await page.locator('#finContextLoading .registro-read-spinner').count(),0);
  // A confirmed same-context verification must neither hide the table nor start a spinner.
  await page.evaluate(()=>{readAction='academicstate';readDelay=100;});await page.evaluate(()=>IERegistroConnection.current().check());assert.equal(await page.locator('.registro-read-spinner:visible').count(),0);
  // Cold history: main table remains visible; reopening cached I/II has no animation or requests.
  await page.evaluate(()=>{readAction='loadreg';readDelay=100;alternarComparativoBim();});await page.waitForFunction(()=>document.querySelector('#comparativoBimStatus .registro-read-spinner'));
  assert.equal(await page.locator('#finLista table').count(),1);if(out&&delay===3000)await page.screenshot({path:path.join(out,'comparativo-'+width+'.png'),fullPage:true});
  await page.waitForFunction(()=>Object.keys(comparativoBimDatos).length===2&&document.getElementById('comparativoBimStatus').hidden);
  const warm=await page.evaluate(()=>{alternarComparativoBim();const n=readCalls.length;alternarComparativoBim();return {reads:readCalls.length-n,hidden:document.getElementById('comparativoBimStatus').hidden};});assert.deepEqual(warm,{reads:0,hidden:true});
  // Saving retains its own real pending-operation modal.
  const field=page.locator('#finLista .fin-nota').first();await field.fill('17');await field.press('Tab');
  await page.evaluate(()=>{readAction='savenotas2';readDelay=100;window.saveTask=IERegistroNotas2UI.save();});await page.waitForFunction(()=>IEAcademicSaveFeedback.busy());assert.equal(await page.locator('.registro-read-spinner:visible').count(),0);assert.equal(await page.evaluate(()=>saveTask),true);
  // Explicit recovery is a compact notice and must stop on completion or failure.
  await page.evaluate(()=>{readAction='loadnotas2';readDelay=100;window.recoveryTask=IERegistroNotas2UI.download();});await page.waitForFunction(()=>document.querySelector('#finContextStatus .registro-read-spinner'));assert.equal(await page.locator('#finLista table').count(),1);await page.evaluate(()=>recoveryTask);assert.equal(await page.locator('.registro-read-spinner:visible').count(),0);
  let prepared=null;
  if(delay===3000){
   await page.evaluate(()=>{readDelay=0;feedbackQueue.release('feedback-test');IERegistroNotas2UI.refresh();});
   await page.waitForFunction(()=>IERegistroNotas2UI.prefetchStatus().completed===integralContexts.length-1&&!IERegistroNotas2UI.prefetchStatus().pending,null,{timeout:20000});
   const before=await page.evaluate(()=>readCalls.length),start=Date.now();
   await helpers.navigate(page,{nivel:'secundaria',bim:'III',grado:2,seccion:'B',area:'Matemática'});
   const actions=await page.evaluate(n=>readCalls.slice(n),before);prepared={ms:Date.now()-start,actions,academicReads:actions.filter(a=>['loadnotas2','academicstate','loadstudents','loadreg'].includes(a)).length};assert.equal(prepared.academicReads,0);assert.equal(await page.locator('.registro-read-spinner:visible').count(),0);
  }
  assert.deepEqual(errors,[]);assert.equal(external,0);const writes=await page.evaluate(()=>readCalls.filter(a=>a==='savenotas2').length);assert.equal(writes,1);
  results.push({width,delay,initialMs,prepared,warmComparativeRequests:0,explicitWrites:writes,errors,external});await context.close();
 }
 // Fresh profiles for terminal states and late responses, including reduced motion.
 for(const mode of ['NETWORK','SESSION','timeout','switch','reduced-motion']){
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block',reducedMotion:mode==='reduced-motion'?'reduce':'no-preference'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let body=html(mode==='timeout'?21000:300);body=body.replace("window.readFailure='';",'window.readFailure='+JSON.stringify(['NETWORK','SESSION'].includes(mode)?mode:'')+';');
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body}):r.abort());await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>document.querySelector('.registro-read-spinner'));
  if(mode==='reduced-motion')assert.equal(await page.locator('.registro-read-spinner').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  if(mode==='switch')await page.evaluate(()=>{document.getElementById('selGrado').value='3';onGrado();IERegistroNotas2UI.refresh();});
  await page.waitForFunction(()=>!IERegistroNotas2UI.readStatus().pending&&!(document.querySelector('.registro-read-spinner')?.checkVisibility()),null,{timeout:23000});
  if(['NETWORK','SESSION','timeout'].includes(mode))assert.equal(await page.evaluate(()=>IERegistroNotas2UI.canEdit()),false);
  if(mode==='switch')assert.equal(await page.evaluate(()=>ctxBase().grado),3);
  assert.equal(await page.evaluate(()=>readCalls.filter(a=>a==='savenotas2').length),0);assert.deepEqual(errors,[]);results.push({mode,automaticWrites:0,pageErrors:0});await context.close();
 }
 const report={passed:results.length,failed:0,syntheticTransport:true,results};if(out)fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
