'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const helper=new Function('require',fs.readFileSync('tests/notas2-session-authorization-browser.cjs','utf8').split('\nasync function run(){')[0]+'\nreturn {html};')(require);
function html(){return helper.html('secundaria',4).replace("[{grado,seccion:'A'}]","[{grado,seccion:'A'},{grado,seccion:'B'}]").replace('window.holdFirst=true;','window.holdFirst=false;').replace('window.scopeDelay??3500','window.scopeDelay??0');}
async function run(){const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});try{for(const width of [1366,390]){const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});let external=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html()}):(external++,r.abort()));await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>IERegistroNotas2UI.canEdit(),null,{timeout:15000});
 await page.evaluate(()=>{estadoPadron('Fallo anterior del servidor en A',true,'remote');onGrado();document.getElementById('selSeccion').value='B';onContexto();IERegistroNotas2UI.refresh();});
 await page.waitForFunction(()=>ctxBase().seccion==='B'&&IERegistroNotas2UI.canEdit(),null,{timeout:15000}).catch(async e=>{console.error(await page.evaluate(()=>({context:ctxBase(),connection:IERegistroConnection.current().snapshot(),state:IERegistroNotas2UI.current()?.status(),status:document.getElementById('studentsStatus').textContent,reads:integralRequests.map(x=>({action:x.action,seccion:x.seccion}))})));throw e;});
 assert.equal(await page.locator('#hdrSyncIndicator .sync-label').innerText(),'Conectado');
 assert.equal(await page.locator('#studentsStatus').textContent(),'');
 await page.evaluate(async()=>{
 window.testOriginalSet=Storage.prototype.setItem;
 Storage.prototype.setItem=function(k,v){if(k===registroLocal.key)throw new DOMException('Synthetic','QuotaExceededError');return testOriginalSet.call(this,k,v);};
 store.asistencia['synthetic-pending-draft']={marca:'T',ts:1};window.testDraft=JSON.stringify(store.asistencia);
 await cargarPadronRegistro('III');
 document.getElementById('selSeccion').value='A';onContexto();IERegistroNotas2UI.refresh();
 });
 await page.waitForFunction(()=>ctxBase().seccion==='A'&&IERegistroNotas2UI.canEdit(),null,{timeout:15000});
 assert.equal(await page.locator('#hdrSyncIndicator .sync-label').innerText(),'Error local');
 assert.match(await page.locator('#studentsStatus').textContent(),/persistencia local.*pendiente de verificación/);
 await page.evaluate(()=>{Storage.prototype.setItem=testOriginalSet;return cargarPadronRegistro('III');});
 await page.waitForFunction(()=>IERegistroNotas2UI.canEdit()&&!document.getElementById('studentsStatus').dataset.persistenceError,null,{timeout:15000});
 assert.equal(await page.locator('#hdrSyncIndicator .sync-label').innerText(),'Conectado');
 assert.equal(await page.evaluate(()=>JSON.stringify(store.asistencia)===testDraft),true);assert.equal(external,0);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>integralRequests.filter(r=>r.action.startsWith('save')).length),0);console.log(JSON.stringify({width,passed:true,external,writes:0}));await page.close();}}finally{await browser.close();}}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
