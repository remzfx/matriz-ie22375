// Actual controls and persistence; reuses the phase3 isolated DOM and synthetic server.
const fs=require('node:fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('tests/registro-connection-browser.cjs','utf8');
const html=new Function('require',source.slice(0,source.indexOf('\n(async()=>'))+'\nreturn html;')(p=>p==='./registro-bulk-correction-browser.cjs'?require('./registro-bulk-correction-browser.cjs'):require(p));
(async()=>{const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});try{
 for(const width of [1366,390]){const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html()}):r.abort());await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>IERegistroConnection.canEdit());
 await page.evaluate(()=>{window.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);if(body.action!=='savereg')throw Error('Unexpected synthetic write');fixtureRemote.writes++;if(body.version!==fixtureRemote.version)return {status:200,text:async()=>JSON.stringify({ok:false,code:'CONFLICT'})};fixtureRemote.version++;fixtureRemote.payload=body.payload;return {status:200,text:async()=>JSON.stringify({ok:true,version:fixtureRemote.version,identityHistory:[]})};};});
 await page.locator('.fin-bulk-actions button').filter({hasText:/^A$/}).click();
 await page.locator('button[onclick="IERegistroRecovery.local()"]').click();await page.waitForFunction(()=>!IERegistroRecovery.diagnostic().busy);
 assert.equal(await page.evaluate(()=>fixtureRemote.writes),0,'Guardar must remain local');assert.equal(await page.evaluate(()=>fixture.note(0).nivel),'A');
 await page.locator('button[onclick="IERegistroRecovery.upload()"]').click();await page.waitForFunction(()=>fixtureRemote.writes===1);await page.waitForFunction(()=>!subirRegistroNube.pending);
 assert.equal(await page.evaluate(()=>Object.values(fixtureRemote.payload.finales)[0].nivel),'A');assert.equal(await page.evaluate(()=>dirty),false);
 await page.locator('#tabCal').click();assert.equal(await page.locator('#panelCalificar').evaluate(n=>n.classList.contains('on')),true);
 await page.locator('#tabAs').click();assert.equal(await page.locator('#panelAsistencia').evaluate(n=>n.classList.contains('on')),true);
 await page.locator('#tabFin').click();assert.equal(await page.evaluate(()=>fixture.note(0).nivel),'A');assert.equal(await page.evaluate(()=>fixtureRemote.writes),1,'Navigation never uploads');assert.deepEqual(errors,[]);
 console.log(width+'px: actual Promedios, local Save, one explicit upload, Calificar/Asistencia navigation, retained notes: passed');await context.close();
 }}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
