// Actual DOM and local save, temporary browser profiles, synthetic roster only.
const fs=require('node:fs'),assert=require('node:assert/strict'),{build}=require('./registro-bulk-correction-browser.cjs');
const source=process.env.IE_EMPTY_SOURCE_REF?require('node:child_process').execFileSync('git',['show',process.env.IE_EMPTY_SOURCE_REF+':registro.html'],{encoding:'utf8',maxBuffer:4000000}):fs.readFileSync('registro.html','utf8');
(async()=>{const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});try{
 for(const level of ['primaria','secundaria'])for(const width of [1366,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:build(level,source)}):r.abort());await page.goto('https://fixture.invalid/');
  await page.evaluate(()=>{store.finales={};store.grades={};store.sessions=[];const comp=competencias()[0];for(const fecha of ['2026-10-14','2026-10-16']){const s={...ctxBase(),comp,capacidad:'Capacidad ficticia',fecha};store.sessions.push(s);for(const a of estudiantes())store.grades[[cloudClaveReg(),comp,s.capacidad,fecha,studentKey(a)].join('||')]={nivel:'B',nota20:12,origen:'numero',ts:1};}saveStore();renderFinales();window.academicView=()=>JSON.stringify([store.grades,store.finales,store.sessions,store.concComp]);});
  const before=await page.evaluate(()=>academicView());
  for(const mode of ['letra','num','letra','num']){await page.evaluate(mode=>{modoCalif=mode;renderFinales();},mode);assert.equal(await page.evaluate(()=>academicView()),before,'view changes never create direct grades');}
  assert.equal(await page.locator('#finLista tbody tr').count(),30);assert.equal(await page.locator('#finLista .fin-nota').first().inputValue(),'');assert.match(await page.locator('#finLista tbody tr').first().textContent(),/Cal 12 · B/);
  await page.evaluate(()=>guardarTodo());
  const count=await page.evaluate(()=>Object.keys(store.finales).length);
  if(process.env.IE_EMPTY_SOURCE_REF){assert.ok(count>0);console.log(level+' '+width+'px: reproduced '+count+' synthetic direct deletions on unchanged empty fields');}
  else{assert.equal(count,0);assert.equal(await page.evaluate(()=>academicView()),before);assert.equal(await page.evaluate(()=>JSON.stringify([fixture.persisted().grades,fixture.persisted().finales,fixture.persisted().sessions,fixture.persisted().concComp])),before);console.log(level+' '+width+'px: 60 evidence records, calculated B, both modes, local save with no phantom deletion/upload: passed');}
  assert.equal(await page.evaluate(()=>fixtureRequests.length),0);assert.deepEqual(errors,[]);await context.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
