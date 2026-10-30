'use strict';
// Actual DOM, students, reset transport, N2 and connection. Fictitious profiles; every external request blocked.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{extract}=require('./registro-visual-demo.cjs');
const base=execFileSync('git',['show','6cb0d5f:registro.html'],{encoding:'utf8',maxBuffer:4000000}),read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),script=s=>'<script>'+s.replace(/<\/script/gi,'<\\/script')+'</script>';
const helpers=new Function('require',read('tests/notas2-prefetch-integral-browser.cjs').split('\nasync function run(){')[0]+'\nreturn {html,navigate};')(require);
const scope=new Function('require',read('tests/notas2-session-authorization-browser.cjs').split('\nasync function run(){')[0]+'\nreturn {html,navigate:helpers.navigate};')(require);
function html(before=false,navigation=false){
 let h=(navigation?scope.html('secundaria',3):helpers.html('secundaria')).replace(/\r\n/g,'\n').replace('window.holdFirst=true;','window.holdFirst=false;');
 if(!navigation)h=h.replace("window.testPeriods={I:'abierto',II:'cerrado',III:'abierto',IV:'bloqueado'};","window.testPeriods={I:'cerrado',II:'cerrado',III:'abierto',IV:'bloqueado'};");
 h=h.replace('window.scopeDelay??3500','window.scopeDelay??50');
 const ui=script(read('registro-notas2-ui.js'));assert.ok(h.includes(ui));
 const setup=`window.phaseOffset=0;const phaseClock=Date.now;Date.now=()=>phaseClock()+phaseOffset;window.phaseDelay=0;window.phaseTrace=[];window.phaseActive=0;window.phasePeak=0;
 const fetchPhase=window.fetch;window.fetch=async(u,o)=>{const b=JSON.parse(o.body),start=performance.now(),entry={action:b.action,bim:b.bimestre||null,start};phaseTrace.push(entry);phaseActive++;phasePeak=Math.max(phasePeak,phaseActive);try{
 if(phaseDelay&&['loadreg','loadstudents'].includes(b.action))await new Promise((resolve,reject)=>{const t=setTimeout(resolve,phaseDelay);o.signal?.addEventListener('abort',()=>{clearTimeout(t);reject(new DOMException('Aborted','AbortError'));},{once:true});});return await fetchPhase(u,o);
 }finally{entry.ms=performance.now()-start;phaseActive--;}};
 ${navigation?'':"const q=IERegistroNotas2Prefetch.create;IERegistroNotas2Prefetch.create=o=>{const x=q(o);x.hold('comparison-latency');return x;};"}
 ${before?'async '+extract(base,'cargarComparativoBim'):''}
 window.comparisonProjectionMs=0;window.comparisonRenderMs=0;
 for(const name of ['comparativoNotaAnterior','comparativoAlumnoAnterior']){const original=window[name];window[name]=function(){const start=performance.now();try{return original.apply(this,arguments);}finally{comparisonProjectionMs+=performance.now()-start;}};}
 const comparisonRender=renderComparativoBim;renderComparativoBim=function(){const start=performance.now();try{return comparisonRender.apply(this,arguments);}finally{comparisonRenderMs+=performance.now()-start;}};`;
 const reset=script(read('academic-reset-client.js'));assert.equal(h.split(reset).length,2);return h.replace(reset,()=>script(setup)+reset);
}
async function run(){const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true}),results=[];
 try{
 for(const width of (process.env.IE_PHASE_NAV_ONLY?[]:[1366,390]))for(const delay of (process.env.IE_PHASE_RENDER_ONLY?[3000]:[3000,5000,10000]))for(const before of (process.env.IE_PHASE_RENDER_BASELINE?[true]:process.env.IE_PHASE_RENDER_ONLY||delay===10000?[false]:[true,false])){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let external=0;page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html(before)}):(external++,r.abort()));await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&document.querySelector('#finLista table'));
  const r=await page.evaluate(async delay=>{const snapshot=JSON.stringify(store),n=phaseTrace.length;phaseDelay=delay;phasePeak=0;comparisonProjectionMs=0;comparisonRenderMs=0;comparativoBimActivo=true;comparativoBimContexto=cloudClaveReg();comparativoBimToken=fixtureSession.token;const start=performance.now();await cargarComparativoBim();return {ms:performance.now()-start,projectionMs:comparisonProjectionMs,renderMs:comparisonRenderMs,phases:phaseTrace.slice(n),peak:phasePeak,periods:Object.keys(comparativoBimDatos).length,preserved:JSON.stringify(store)===snapshot,spinner:!document.getElementById('comparativoBimStatus').hidden,writes:phaseTrace.filter(e=>e.action==='savenotas2').length};},delay);
  assert.equal(r.preserved,true);assert.equal(r.writes,0);assert.equal(r.spinner,false);if(delay===10000)assert.equal(r.periods,0,'Existing historical timeout must remain enforced');else{assert.equal(r.periods,2);assert.equal(r.phases.filter(e=>e.action==='loadreg').length,2);}
  assert.deepEqual(errors,[]);assert.equal(external,0);results.push({width,delay,before,...r});console.log(JSON.stringify(results.at(-1)));await context.close();
 }
 for(const width of (process.env.IE_PHASE_RENDER_ONLY?[]:[1366,390])){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html(false,true)}):r.abort());await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios')&&IERegistroNotas2UI.prefetchStatus().completed===integralContexts.length-1&&!IERegistroNotas2UI.prefetchStatus().pending,null,{timeout:20000});
  const A=await page.evaluate(()=>ctxBase()),routes=[];const snapshot=await page.evaluate(()=>{window.originalPrefix=cloudClaveReg()+'||';window.originalNotes=()=>JSON.stringify(Object.fromEntries(['grades','finales','concComp','capsSel'].map(f=>[f,Object.fromEntries(Object.entries(store[f]||{}).filter(([k])=>k.startsWith(originalPrefix)))])));return originalNotes();});
  for(const grado of [4,5,3]){const n=await page.evaluate(()=>phaseTrace.length),start=Date.now();await helpers.navigate(page,{...A,grado});const actions=await page.evaluate(n=>phaseTrace.slice(n).map(t=>t.action),n);assert.equal(actions.filter(a=>['loadnotas2','academicstate'].includes(a)).length,0);assert.equal(await page.locator('.registro-read-spinner:visible').count(),0);routes.push({grado,ms:Date.now()-start,actions});}
  assert.equal(await page.evaluate(()=>originalNotes()),snapshot);
  await page.evaluate(()=>{phaseOffset=151000;scopeDelay=1000;});
  const n=await page.evaluate(()=>phaseTrace.length);const task=helpers.navigate(page,{...A,grado:4});await page.waitForFunction(()=>IERegistroNotas2UI.readStatus().pending);
  assert.match(await page.locator('#finContextStatus').innerText(),/^Verificando acceso…/);assert.doesNotMatch(await page.locator('#finContextStatus').innerText(),/sincronizando información/);await task;
  const expired=await page.evaluate(n=>phaseTrace.slice(n).map(t=>t.action),n);assert.equal(expired.filter(a=>a==='academicstate').length,1);assert.equal(expired.filter(a=>a==='loadnotas2').length,0);
  await page.locator('#finLista .fin-nota').first().fill('17');await page.locator('#finLista .fin-nota').first().press('Tab');const pending=await page.evaluate(()=>JSON.stringify(store));
  await page.evaluate(()=>{scopeDenied=true;window.revoked=IERegistroConnection.current().check(false,true);});assert.equal(await page.evaluate(()=>revoked),false);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.canEdit()),false);assert.equal(await page.evaluate(()=>JSON.stringify(store)),pending);assert.equal(await page.locator('.registro-read-spinner:visible').count(),0);assert.equal(await page.evaluate(()=>phaseTrace.filter(e=>e.action==='savenotas2').length),0);assert.deepEqual(errors,[]);
  results.push({width,routes,expired,revocationProtected:true,writes:0});console.log(JSON.stringify(results.at(-1)));await context.close();
 }
 const report={passed:results.length,failed:0,synthetic:true,results};if(process.env.IE_COMPARISON_PHASE_OUTPUT)fs.writeFileSync(process.env.IE_COMPARISON_PHASE_OUTPUT,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:results.length,failed:0}));
 }finally{await browser.close();}}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
