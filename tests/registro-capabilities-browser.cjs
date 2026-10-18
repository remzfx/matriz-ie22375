// Actual page core and DOM, synthetic accounts/roster; every external request blocked.
'use strict';
const assert=require('node:assert/strict'),{html}=require('./registro-connection-browser.cjs'),{modules,source}=require('./registro-script-fixture.cjs');
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});
 try{for(const level of ['primaria','secundaria'])for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',r=>{const url=new URL(r.request().url()),file=url.pathname.slice(1);if(url.origin==='https://fixture.invalid'&&file==='')return r.fulfill({contentType:'text/html',body:html(level)});if(url.origin==='https://fixture.invalid'&&[...modules,'registro-evaluation.js','registro-grading.js'].includes(file))return r.fulfill({contentType:'application/javascript',body:source(file)});return r.abort();});
  await page.goto('https://fixture.invalid/');
  await page.waitForFunction(()=>window.IERegistroConnection?.current()?.snapshot().state==='connected');
  // The shared fixture starts on Promedios; enable its Calificar panel for this scenario.
  await page.addStyleTag({content:'.panel-cal.on{display:block!important}'});
  await page.evaluate(()=>{document.getElementById('inpFecha').value='2026-10-01';fillComps();modoCalif='letra';showPanel('cal');onSesionChange();});
  const caps=await page.locator('#selCap option').evaluateAll(xs=>xs.map(x=>x.value).filter(v=>v&&v!=='__otra__'));assert.ok(caps.length>=2);
  const add=page.locator('button[onclick="activarSesion()"]');
  for(const cap of caps.slice(0,2)){await page.selectOption('#selCap',cap);await add.click();}
  assert.equal(await page.evaluate(()=>capsElegidas.length),2);assert.equal(await page.evaluate(()=>store.sessions.length),2);
  await page.selectOption('#selCap',caps[0]);await add.click();assert.equal(await page.evaluate(()=>store.sessions.length),2,'Re-selecting a capacity never duplicates a session');
  const cell=page.locator('#stuList tbody tr').first().locator('[data-nom][data-cap]').first();
  for(const letter of ['C','B','A','AD']){await cell.locator('button[data-val="'+letter+'"]').click();assert.equal(await page.evaluate(()=>Object.values(store.grades).find(v=>!v.borrado)?.nivel),letter);}
  await page.evaluate(()=>{const id=studentKey(estudiantes()[0]),cp=competencias()[0];store.concComp[finalKey(cp,id)]={texto:'Conclusión sintética conservada'};aplicarFinalManual(cp,id,'B');});
  await page.evaluate(()=>setModoCalif('num'));
  const numeric=page.locator('#stuList tbody tr').first().locator('.cal-nota').first();await numeric.fill('15');await numeric.dispatchEvent('change');
  assert.equal(await page.evaluate(()=>Object.values(store.grades).find(v=>!v.borrado)?.nota20),15);
  await page.locator('#stuList button[title="Borrar esta capacidad"]').first().click();
  assert.equal(await page.evaluate(()=>capsElegidas.length),1);assert.equal(await page.evaluate(()=>store.sessions.length),1);
  assert.equal(await page.evaluate(()=>Object.values(store.finales).find(v=>!v.borrado)?.nivel),'B','Direct grade survives capacity removal');
  assert.equal(await page.evaluate(()=>Object.values(store.concComp)[0].texto),'Conclusión sintética conservada');
  await page.evaluate(()=>{abrirSesionFecha('2026-10-01');guardarTodo();});
  assert.equal(await page.evaluate(()=>capsElegidas.length),1);assert.equal(await page.evaluate(()=>fixture.persisted().sessions.length),1);
  assert.equal(await page.evaluate(()=>fixtureRequests.length),0);assert.deepEqual(errors,[]);
  console.log(level+' '+width+'px: CNEB choices, add/reselect/remove, letters/0-20, active date, direct/conclusion retained, local save, zero remote calls: passed');await context.close();
 }}finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
