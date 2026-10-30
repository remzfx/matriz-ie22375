'use strict';
// Differential actual Registro DOM, students, UI, N2 and controller; no institutional transport or profile.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const read=f=>fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'),script=s=>'<script>'+s.replace(/<\/script/gi,'<\\/script')+'</script>';
const helpers=new Function('require',read('tests/comparativo-navigation-browser.cjs').split('\nasync function run(){')[0]+'\nreturn {html,navigate:helpers.navigate};')(require);
function html({baseline=false,legacy=false}={}){let h=helpers.html(false,true).replace('window.holdFirst=true;','window.holdFirst=false;').replaceAll("I:'abierto',II:'abierto',III:'abierto',IV:'bloqueado'","I:'abierto',II:'abierto',III:'abierto',IV:'abierto'");
 const ui=script(read('registro-notas2-ui.js')),setup=`window.scopeSupport=${!legacy};window.rosterDelay=0;
 for(const [k,db]of Object.entries(integrationDB))if(k.split('||')[1]==='IV'){db.payload=Object.fromEntries(Object.values(IERegistroNotas2.fields).flat().map(f=>[f,f==='sessions'?[]:{}]));db.versions={calificar:0,promedios:0,asistencia:0};db.at={calificar:null,promedios:null,asistencia:null};}
 const previousFetch=window.fetch;window.fetch=async(u,o)=>{const b=JSON.parse(o.body);if(b.action==='loadstudents'&&rosterDelay)await new Promise(r=>setTimeout(r,rosterDelay));return previousFetch(u,o);};IERegistroEditTrace.start();`;
 assert.ok(h.includes(ui));h=h.replace(ui,()=>script(setup)+ui);
 if(baseline)for(const f of ['registro-connection.js','registro-notas2-ui.js']){const current=script(read(f)),old=script(execFileSync('git',['show','9deac5a:'+f],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n'));assert.ok(h.includes(current));h=h.replace(current,()=>old);}
 return h;
}
async function run(){const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true}),results=[];
 try{for(const [width,legacy,baseline]of [[390,false,true],[390,false,false],[1366,false,false],[1366,true,false]]){
  const context=await browser.newContext({viewport:{width,height:768},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let external=0;page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html({baseline,legacy})}):(external++,r.abort()));await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios'));
  const visibility=async()=>page.locator('#hdrSyncIndicator').evaluate(el=>{const b=el.getBoundingClientRect();return {visible:b.width>0&&b.height>0&&b.top>=0&&b.bottom<=innerHeight,count:document.querySelectorAll('#hdrSyncIndicator').length};});
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));const scrolled=await visibility();assert.equal(scrolled.count,1);assert.equal(scrolled.visible,!baseline,'Old mobile header scrolls away; same cloud stays visible after correction');
  if(baseline){results.push({width,baseline,cloudVisible:scrolled.visible});await context.close();continue;}
  await page.waitForFunction(()=>IERegistroNotas2UI.prefetchStatus().completed===integralContexts.length-1&&!IERegistroNotas2UI.prefetchStatus().pending,null,{timeout:20000});await page.evaluate(()=>window.scrollTo(0,0));const A=await page.evaluate(()=>ctxBase()),visits=[];
  for(const bim of ['I','II','III','I','II','III','IV','III','II','I']){const n=await page.evaluate(()=>integralRequests.length),start=Date.now();await helpers.navigate(page,{...A,bim});const r=await page.evaluate(n=>({reads:integralRequests.slice(n).map(b=>b.action),version:IERegistroNotas2UI.current().status().panels.promedios.version,canEdit:IERegistroNotas2UI.canEdit(),trace:IERegistroEditTrace.capture().events.filter(e=>e.event==='edit-blocked').map(e=>e.reason)}),n);visits.push({bim,ms:Date.now()-start,...r});if(bim==='IV')assert.equal(await page.evaluate(()=>Object.keys(sliceRegistroArea(store,areaActual).finales||{}).length),0);}
  console.log(JSON.stringify({width,legacy,visits}));for(const v of visits.slice(3).filter(v=>v.bim!=='IV'))assert.equal(v.reads.filter(a=>a==='academicstate'||a==='loadnotas2').length,0);
  for(const panel of ['cal','fin','av','as']){await page.evaluate(panel=>showPanel(panel),panel);await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));assert.equal((await visibility()).visible,true);}
  await page.evaluate(()=>{showPanel('fin');window.scrollTo(0,0);rosterDelay=3000;});
  // A real roster transition coinciding with the same forced check as the scheduled heartbeat.
  const contextNow=await page.evaluate(()=>ctxBase());const transition=helpers.navigate(page,{...contextNow,bim:'II'});await page.waitForFunction(()=>cargandoEstudiantes);const n=await page.evaluate(()=>integralRequests.length),alreadyAuthorized=await page.evaluate(()=>IERegistroNotas2UI.canEdit());await page.evaluate(()=>IERegistroConnection.current().check(false,true));await transition;assert.equal(await page.evaluate(()=>IERegistroEditTrace.capture().events.some(e=>e.state==='session')),false);
  const transient=await page.evaluate(n=>integralRequests.slice(n).map(r=>r.action),n);assert.equal(transient.filter(a=>a==='academicstate').length,alreadyAuthorized?1:0);
  await page.evaluate(()=>{phaseOffset=151000;scopeDelay=300;});const renew=helpers.navigate(page,{...A,bim:'III'});await renew;assert.equal(await page.evaluate(()=>IERegistroNotas2UI.canEdit()),true);
  assert.equal(await page.evaluate(()=>integralRequests.some(r=>r.action.startsWith('save'))),false);assert.equal(external,0);assert.deepEqual(errors,[]);results.push({width,legacy,visits,transient,writes:0,cloudVisible:true});await context.close();
 }
 const report={passed:results.length,failed:0,synthetic:true,results};if(process.env.IE_CONTINUITY_OUTPUT)fs.writeFileSync(process.env.IE_CONTINUITY_OUTPUT,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{await browser.close();}}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
