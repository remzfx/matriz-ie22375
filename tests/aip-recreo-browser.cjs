'use strict';
// Full current AIP page; fresh browser profiles and fictitious cloud, all external requests blocked.
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('aula_innovacion.html','utf8').replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/,'<style>.hidden{display:none!important}</style>').replace(/const CLOUD_API_URL = '[^']+';/,"const CLOUD_API_URL = 'https://backend.fixture.invalid/exec';");
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});
 try{for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await context.newPage();let cloud=null,external=0;const requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',async route=>{
   const url=route.request().url();
   if(url==='https://aip.fixture.invalid/')return route.fulfill({contentType:'text/html',body:source});
   if(url==='https://aip.fixture.invalid/layout-shells.css')return route.fulfill({contentType:'text/css',body:fs.readFileSync('layout-shells.css','utf8')});
   if(url==='https://backend.fixture.invalid/exec'){
    const body=route.request().postDataJSON();requests.push(body.action);
    if(body.action==='saveaip'){cloud=JSON.parse(JSON.stringify(body.payload));return route.fulfill({json:{ok:true}});}
    assert.equal(body.action,'loadaip');return route.fulfill({json:{ok:true,payload:cloud}});
   }
   external++;return route.abort();
  });
  await page.goto('https://aip.fixture.invalid/');
  const show=()=>page.evaluate(()=>{document.getElementById('inpMes').value='2026-12';render();});await show();
  const before=await page.evaluate(()=>JSON.stringify([horario,HPRI(),HSEC()]));
  const cell=n=>page.locator('td[onclick="clicCelda(\'2026-12-14\',\''+n+'\',\'R\')"]');
  for(const n of ['pri','sec']){
   await page.locator('button[onclick="abrirColumna(\'2026-12-14\',\''+n+'\')"]').click();
   await page.locator('#modTipo').selectOption('soporte');
   await page.locator('#modal button[onclick="aplicarModal()"] ').click();
   assert.equal(await cell(n).textContent(),'');await cell(n).click();assert.equal(await cell(n).textContent(),'RECREO');
   assert.equal(await cell(n).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(253, 230, 138)');
   await page.evaluate(n=>{abrirColumna('2026-12-14',n);document.getElementById('modTipo').value='man';aplicarColumna();},n);
   assert.equal(await cell(n).textContent(),'');
  }
  await page.evaluate(()=>guardar(true));await page.reload();await show();assert.equal(await cell('pri').textContent(),'');assert.equal(await cell('sec').textContent(),'');
  await cell('pri').click();await page.evaluate(()=>subirAipNube());await page.evaluate(()=>{plan={};return bajarAipNube();});
  assert.equal(await cell('pri').textContent(),'RECREO');assert.equal(await cell('sec').textContent(),'');
  assert.equal(await page.evaluate(()=>JSON.stringify([horario,HPRI(),HSEC()])),before);assert.deepEqual(requests,['saveaip','loadaip']);assert.equal(external,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,passed:true,external,explicitCloud:requests,errors:0}));await context.close();
 }}finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
