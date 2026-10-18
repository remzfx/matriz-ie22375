// Before/after actual UI comparison; fresh synthetic profiles and simulated server only.
'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{html}=require('./registro-connection-browser.cjs'),{modules,source}=require('./registro-script-fixture.cjs');
const before=execFileSync('git',['show','47d357a:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
async function scenario(browser,level,width,version){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/*',r=>{const u=new URL(r.request().url()),file=u.pathname.slice(1);if(u.origin==='https://fixture.invalid'&&file==='')return r.fulfill({contentType:'text/html',body:html(level,false,version)});if(u.origin==='https://fixture.invalid'&&[...modules,'registro-evaluation.js','registro-grading.js'].includes(file))return r.fulfill({contentType:'application/javascript',body:source(file)});return r.abort();});
 try{
  await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>window.IERegistroConnection?.current()?.snapshot().state==='connected');
  await page.addStyleTag({content:'.panel-cal.on{display:block!important}'});
  await page.evaluate(()=>{
   window.e1Trace=[];window.e1Snapshot=()=>{
    const normalize=x=>Array.isArray(x)?x.map(normalize):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).filter(([k])=>!['ts','_ts'].includes(k)).map(([k,v])=>[k,normalize(v)])):x;
    e1Trace.push({context:cloudClaveReg(),academic:normalize(Object.fromEntries(['grades','finales','concComp','sessions','capsSel','asistencia','asisFechas','asisFechasEstado'].map(k=>[k,store[k]||{}]))),selected:JSON.parse(JSON.stringify(capsElegidas)),active:sesionActiva&&{...sesionActiva},cal:document.getElementById('stuList').innerHTML,fin:document.getElementById('finLista').innerHTML});
   };
   fixtureSession.areas.push('Comunicación');fixtureSession.asignaciones['Comunicación']=['2|A'];sessionStorage.setItem('ie22375_session_v1',JSON.stringify(fixtureSession));
   store.asistencia['e1-other-context']={marca:'T',ts:12345};store.asisFechas['e1-other-context']=['2026-09-01'];store.asisFechasEstado['e1-other-context||2026-09-01']={borrado:false,ts:12345};
   document.getElementById('inpFecha').value='2026-10-01';fillComps();modoCalif='letra';showPanel('cal');onSesionChange();e1Snapshot();
  });
  const caps=await page.locator('#selCap option').evaluateAll(xs=>xs.map(x=>x.value).filter(v=>v&&v!=='__otra__'));assert.ok(caps.length>=2);
  for(const cap of caps.slice(0,2)){await page.selectOption('#selCap',cap);await page.locator('button[onclick="activarSesion()"]').click();}
  await page.selectOption('#selCap',caps[0]);await page.locator('button[onclick="activarSesion()"]').click();assert.equal(await page.evaluate(()=>store.sessions.length),2);
  await page.locator('#stuList tbody tr').first().locator('[data-nom][data-cap]').first().locator('[data-val="A"]').click();
  await page.evaluate(()=>{const id=studentKey(estudiantes()[0]),cp=competencias()[0];store.concComp[finalKey(cp,id)]={texto:'Conclusión ficticia intacta',ts:12345};guardarTodo();e1Snapshot();});
  const comps=await page.locator('#selComp option').evaluateAll(xs=>xs.map(x=>x.value));assert.ok(comps.length>1);
  await page.selectOption('#selComp',comps[1]);await page.selectOption('#selComp',comps[0]);
  await page.evaluate(()=>{e1Snapshot();showPanel('fin');});
  await page.locator('.fin-bulk-actions button').filter({hasText:/^B$/}).click();
  await page.locator('#finLista tbody tr').first().locator('[data-fin]').first().locator('[data-val="AD"]').click();
  await page.evaluate(()=>{guardarTodo();e1Snapshot();abrirSesionFecha('2026-10-02');e1Snapshot();abrirSesionFecha('2026-10-01');showPanel('cal');});
  await page.locator('#stuList button[title="Borrar esta capacidad"]').nth(1).click();
  await page.evaluate(()=>{guardarTodo();e1Snapshot();areaActual='Comunicación';fillComps();onContexto({localOnly:true});if(areaActual!=='Comunicación')throw Error('Synthetic area switch failed');e1Snapshot();areaActual='Matemática';fillComps();onContexto({localOnly:true});abrirSesionFecha('2026-10-01');guardarTodo();e1Snapshot();});
  assert.equal(await page.evaluate(()=>areaActual),'Matemática');
  assert.equal(await page.evaluate(()=>Object.values(store.grades).filter(g=>g.nivel==='A').length),1,'Original evidence survives navigation and unrelated capacity removal');
  assert.equal(await page.evaluate(()=>store.asistencia['e1-other-context'].ts),12345);
  assert.equal(await page.evaluate(()=>Object.values(store.concComp)[0].ts),12345);
  assert.equal(await page.evaluate(()=>fixtureRequests.length),0);assert.equal(await page.evaluate(()=>fixtureRemote.writes),0);assert.deepEqual(errors,[]);
  return await page.evaluate(()=>e1Trace);
 }finally{await context.close();}
}
async function run(){const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});try{for(const level of ['primaria','secundaria'])for(const width of [1366,390]){
 const a=await scenario(browser,level,width,before),b=await scenario(browser,level,width,source('registro.html'));assert.deepEqual(b,a);console.log(level+' '+width+'px: before/after academic state, selection and DOM identical at '+a.length+' checkpoints; manual/bulk/local/date/context, retained attendance/conclusions, zero uploads');
 }}finally{await browser.close();}}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
