// Actual page controls/core and script error handlers; synthetic profiles only.
const assert=require('node:assert/strict'),{html}=require('./registro-connection-browser.cjs');
const {modules,source}=require('./registro-script-fixture.cjs');
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});
 try{for(const width of [1366,390])for(const missing of [...modules,'registro-evaluation.js','registro-grading.js']){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
  const key='ie22375_registro_notas_v2:owner:'+encodeURIComponent(JSON.stringify(['docente','fictitious-math']));
  const raw=JSON.stringify({finales:{synthetic:{nivel:'B',nota20:12}},grades:{},concComp:{synthetic:{texto:'Antecedente ficticio III 2026'}},sessions:[]});
  const matrix='{"anio":2026,"II":{"synthetic":"A"}}';
  await page.addInitScript(({key,raw,matrix})=>{
   localStorage.setItem(key,raw);localStorage.setItem('matriz_SEC_IE22375',matrix);
   window.fixtureAcademicWrites=[];const write=Storage.prototype.setItem;
   Storage.prototype.setItem=function(k,v){if(k===key||k==='matriz_SEC_IE22375')fixtureAcademicWrites.push(k);return write.call(this,k,v);};
  },{key,raw,matrix});
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=new URL(route.request().url()),file=url.pathname.slice(1);
   if(url.origin==='https://fixture.invalid'&&file==='')return route.fulfill({contentType:'text/html',body:html('secundaria',true)});
   if(url.origin==='https://fixture.invalid'&&[...modules,'registro-evaluation.js','registro-grading.js'].includes(file))return route.fulfill({status:file===missing?404:200,contentType:'application/javascript',body:file===missing?'':source(file)});
   return route.abort();
  });
  await page.goto('https://fixture.invalid/');
  assert.match(await page.locator('#registroConnectionText').textContent(),/No se pudo cargar.*Edición pausada/);
  assert.equal(await page.evaluate(()=>!!window.IERegistroConnection?.canEdit()),false);
  assert.equal(await page.evaluate(()=>registroSoloLectura()),true);
  assert.equal(await page.locator('button[onclick="IERegistroRecovery.local()"]').isDisabled(),true);
  assert.equal(await page.locator('button[onclick="IERegistroRecovery.upload()"]').isDisabled(),true);
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),raw);
  assert.equal(await page.evaluate(()=>localStorage.getItem('matriz_SEC_IE22375')),matrix);
  assert.deepEqual(await page.evaluate(()=>fixtureAcademicWrites),[]);
  assert.equal(await page.evaluate(()=>fixtureRemote.writes),0);assert.equal(await page.evaluate(()=>fixtureRequests.length),0);
  assert.deepEqual(errors,['registro-local-store.js','registro-connection.js','registro-evaluation.js','registro-grading.js'].includes(missing)?['Registro pausado: falta una dependencia obligatoria.']:[]);
  console.log(width+'px '+missing+': controlled 404, editing paused, exact notes/matrix retained, zero academic writes');
  await context.close();
 }}finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
