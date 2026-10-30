'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const helper=new Function('require',fs.readFileSync('tests/notas2-session-authorization-browser.cjs','utf8').split('\nasync function run(){')[0]+'\nreturn {html,navigate:helpers.navigate};')(require);
const epoch='a'.repeat(32);
function html(){return helper.html('secundaria',4).replace("[{grado,seccion:'A'}]","[{grado,seccion:'A'},{grado,seccion:'B'}]").replace('window.holdFirst=true;','window.holdFirst=false;').replace('window.scopeDelay??3500','window.scopeDelay??0').replace('window.integralRequests=[];',`localStorage.setItem('ie22375_academic_epoch_v1','${epoch}');window.integralRequests=[];`).replaceAll('epoch:null',`epoch:'${epoch}'`).replaceAll('phase:null',"phase:'complete'");}
async function run(){const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});try{for(const width of [1366,390]){const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});let external=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html()}):(external++,r.abort()));await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>IERegistroNotas2UI.canEdit(),null,{timeout:15000});const result=await page.evaluate(async()=>{const warnings=[],warn=console.warn;console.warn=(tag,e)=>warnings.push({tag,...e});const native=window.fetch;let release;window.fetch=async(u,o)=>{const b=JSON.parse(o?.body||'{}');if(b.action==='loadstudents')await new Promise(r=>release=r);return native(u,o);};const pending=cargarPadronRegistro('III');await Promise.resolve();document.getElementById('selGrado').value='4';onGrado();document.getElementById('selSeccion').value='B';onContexto();document.getElementById('selGrado').value='5';onGrado();document.getElementById('selSeccion').value='B';onContexto();release?.();await pending;window.fetch=native;console.warn=warn;return {warnings,context:ctxBase(),status:document.getElementById('studentsStatus').textContent,epoch:JSON.parse(registroLocal.read()||'{}').academicEpoch};});assert.deepEqual(result.warnings,[],JSON.stringify(result));assert.equal(result.epoch,epoch);assert.equal(result.context.grado,5);assert.equal(result.context.seccion,'B');
await page.waitForFunction(()=>IERegistroNotas2UI.canEdit(),null,{timeout:15000});
const failure=await page.evaluate(async()=>{
 const original=Storage.prototype.setItem,key=registroLocal.key;
 Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Synthetic unavailable storage','QuotaExceededError');return original.call(this,k,v);};
 store.asistencia['synthetic-local-draft']={marca:'T',ts:1};
 const before=JSON.stringify([store.grades,store.finales,store.concComp,store.asistencia]);
 await cargarPadronRegistro('III');
 const failed={operation:document.getElementById('studentsStatus').dataset.persistenceError,label:document.querySelector('#hdrSyncIndicator .sync-label').textContent,preserved:before===JSON.stringify([store.grades,store.finales,store.concComp,store.asistencia])};
 Storage.prototype.setItem=original;
 await cargarPadronRegistro('III');
 return {...failed,recovered:!document.getElementById('studentsStatus').dataset.persistenceError,readable:!!registroLocal.read()};
});
assert.equal(failure.operation,'saveStore');assert.equal(failure.label,'Error local');assert.equal(failure.preserved,true);assert.equal(failure.recovered,true);assert.equal(failure.readable,true);
assert.equal(external,0);assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>integralRequests.filter(r=>r.action.startsWith('save')).length),0);console.log(JSON.stringify({width,passed:true,external,writes:0}));await page.close();}}finally{await browser.close();}}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
