'use strict';
// Real DOM and production controller/core/adapter; all transport is fictitious and external requests are aborted.
const assert=require('node:assert/strict'),fs=require('node:fs'),{html}=require('./notas2-browser.cjs');
async function run(){const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});let checks=0;
try{for(const level of ['primaria','secundaria'])for(const width of [1366,390]){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const source=html(level)+'<script>'+fs.readFileSync('registro-sync-diagnostic-ui.js','utf8').replace(/<\/script/gi,'<\\/script')+'</script>';
 await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:source}):r.abort());
 await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>window.IERegistroNotas2UI?.canEdit('promedios'));await page.evaluate(()=>showPanel('fin'));
 assert.equal(await page.locator('#modalSiagie').evaluate(el=>getComputedStyle(el).display),'none');
 await page.evaluate(()=>IERegistroConnection.current().check(false,true));assert.equal(await page.evaluate(()=>IERegistroNotas2UI.canEdit('promedios')),true);
 assert.equal(await page.evaluate(()=>fixtureRemote.reads),1);
 await page.evaluate(()=>{const key=finalKey(competencias()[0],studentKey(estudiantes()[0]));store.finales[key]={nivel:'A',nota20:15,origen:'letra'};store.concComp[key]={texto:'Conclusión ficticia preservada'};document.dispatchEvent(new Event('input',{bubbles:true}));});
 const draft=await page.evaluate(()=>JSON.stringify({finales:store.finales,concComp:store.concComp}));await page.evaluate(()=>IERegistroConnection.current().check(false,true));
 assert.equal(await page.locator('#hdrSyncIndicator').getAttribute('data-state'),'pending');assert.equal(await page.evaluate(()=>JSON.stringify({finales:store.finales,concComp:store.concComp})),draft);
 await page.evaluate(()=>fixtureRemote.available=false);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.save()),false);assert.equal(await page.locator('#hdrSyncIndicator').getAttribute('data-state'),'server');
 await page.evaluate(()=>{fixtureRemote.available=true;});await page.evaluate(()=>IERegistroConnection.current().check(false,true));assert.equal(await page.locator('#hdrSyncIndicator').getAttribute('data-state'),'server');
 const cloud=page.locator('#hdrSyncIndicator');assert.equal(await cloud.evaluate(el=>el.tagName),'BUTTON');
 await cloud.focus();await page.keyboard.press('Enter');await page.waitForSelector('#registroDiagnosticModal[open]');assert.match(await page.locator('#registroDiagnosticModal').textContent(),/no certifica/);assert.match(await cloud.getAttribute('aria-label'),/Servidor/);
 await page.keyboard.press('Escape');await cloud.focus();await page.keyboard.press('Space');await page.waitForSelector('#registroDiagnosticModal[open]');await page.keyboard.press('Escape');
 const requests=await page.evaluate(()=>fixtureRequests.length);assert.equal(await page.evaluate(()=>IERegistroNotas2UI.download()),true);assert.equal(await page.evaluate(()=>fixtureRequests.length),requests+1);
 await page.evaluate(()=>IERegistroConnection.current().check(false,true));assert.equal(await page.evaluate(()=>IERegistroNotas2UI.canEdit('promedios')),true);
 await page.evaluate(()=>{const key=finalKey(competencias()[0],studentKey(estudiantes()[0]));store.finales[key]={nivel:'B',nota20:12,origen:'letra'};fixtureRemote.versions.promedios++;});assert.equal(await page.evaluate(()=>IERegistroNotas2UI.save()),false);
 const conflict=await page.evaluate(()=>JSON.stringify(store.finales));await page.evaluate(()=>IERegistroConnection.current().check(false,true));assert.equal(await cloud.getAttribute('data-state'),'review');assert.equal(await page.evaluate(()=>IERegistroNotas2UI.current().status().state),'conflict');assert.equal(await page.evaluate(()=>JSON.stringify(store.finales)),conflict);
 assert.equal(await page.locator('#registroConnectionStatus').evaluate(el=>getComputedStyle(el).display),'none');assert.equal(await page.evaluate(()=>fixtureRemote.writes),0);assert.deepEqual(errors,[]);
 console.log(level+' '+width+'px: real lifecycle, pending, failed Save, CAS and keyboard diagnostic passed');checks++;await context.close();
}}finally{await browser.close();}return checks;}
module.exports={run};if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
