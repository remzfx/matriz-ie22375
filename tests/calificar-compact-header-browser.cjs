'use strict';
// Actual Registro markup/renderers/N2 adapter, synthetic data/transport, locally supplied Tailwind runtime.
const fs=require('node:fs'),assert=require('node:assert/strict'),cp=require('node:child_process');
const realBuild=require('./registro-bulk-correction-browser.cjs').build;
const template=fs.readFileSync('tests/notas2-browser.cjs','utf8').split('async function run(){')[0];
function html(source){const requireFixture=name=>name==='./registro-bulk-correction-browser.cjs'?{build:level=>realBuild(level,source)}:require(name);const build=new Function('require',template+'\nreturn html;')(requireFixture);return build('secundaria').replace('<meta charset="utf-8">','<meta charset="utf-8">'+'<script src="https://fixture.invalid/tailwind.js"></script>'+'<style>'+fs.readFileSync('layout-shells.css','utf8')+'</style>');}
async function run(){const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true}),results=[];
try{for(const revision of ['before','after'])for(const width of [1366,390]){
 const source=revision==='before'?cp.execFileSync('git',['show','9d81f20:registro.html'],{encoding:'utf8',maxBuffer:4000000}):fs.readFileSync('registro.html','utf8');
 const context=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block'}),page=await context.newPage(),errors=[];let external=0;page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:html(source)}):r.request().url()==='https://fixture.invalid/tailwind.js'?r.fulfill({contentType:'application/javascript',body:fs.readFileSync(process.env.IE_TAILWIND_LOCAL,'utf8')}):(external++,r.abort()));await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>IERegistroNotas2UI.canEdit('promedios'));
 await page.evaluate(()=>{showPanel('cal');fillComps();const comp=competencias()[0],cap=capsOficiales(comp)[0];document.getElementById('inpFecha').value='2026-10-26';document.getElementById('selComp').value=comp;fillCaps();document.getElementById('selCap').value=cap;onCapSel();activarSesion();});
 await page.waitForFunction(()=>document.querySelector('#listaSesiones [data-fecha]'));
 for(const count of [1,6])for(const state of ['unsaved','confirmed','pending']){
  await page.evaluate(async({count,state})=>{
   const one={...store.sessions[0],fecha:'2026-10-26'};store.sessions=Array.from({length:count},(_,i)=>({...one,fecha:'2026-10-'+String(26-i).padStart(2,'0'),ts:i+1}));
   const local=sliceRegistroArea();local.calificarEstado=Object.fromEntries(Object.entries(store.calificarEstado||{}).filter(([k])=>k.startsWith(prefijoReg())));local.capsSel=Object.fromEntries(Object.entries(local.capsSel||{}).filter(([,v])=>Array.isArray(v)&&v.length));for(const field of IERegistroNotas2.fields.calificar)fixtureRemote.payload[field]=JSON.parse(JSON.stringify(local[field]||{}));fixtureRemote.versions.calificar++;fixtureRemote.at.calificar=state==='unsaved'?null:1700000000000;
   const ok=await IERegistroNotas2UI.current().load({panel:'calificar',manual:true});if(!ok)throw Error('Synthetic baseline rejected: '+document.getElementById('toast').textContent);
   if(state==='pending')store.sessions[0].unidad=store.sessions[0].unidad==='U1'?'U2':'U1';
   document.getElementById('inpFecha').value='2026-10-26';loadCapsElegidas();renderSesiones();renderStudents();
  },{count,state});
  await page.waitForTimeout(60);
  const measure=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
   const wrap=document.getElementById('wrapSesiones'),title=[...wrap.children].find(e=>e.textContent==='SESIONES GUARDADAS'),help=[...wrap.children].find(e=>e.textContent==='Un chip por día. Tócalo para abrir esa fecha.'),status=document.querySelector('#listaSesiones [role="status"]'),chips=[...document.querySelectorAll('#listaSesiones .sess-chip')];
   const cal=document.getElementById('wrapCalificar'),table=document.getElementById('stuList');
   return {sessionsHeight:wrap.getBoundingClientRect().height,calHeaderHeight:table.getBoundingClientRect().top-cal.getBoundingClientRect().top,title:rect(title),help:rect(help),status:rect(status),statusText:status.textContent,chips:chips.map(rect),calLabel:document.getElementById('lblSesionActiva').textContent,selector:rect(cal.querySelector('.mode-toggle')),header:rect(document.getElementById('lblSesionActiva')),pageWidth:document.documentElement.scrollWidth,viewport:innerWidth};
  });
  assert.equal(measure.chips.length,count);assert.match(measure.calLabel,/2026-10-26.*1 capacidad/);
  assert.match(measure.statusText,state==='pending'?/Cambios locales/:state==='confirmed'?/confirmado en la nube/:/sin guardado confirmado/);
  if(revision==='after'){
   assert.ok(measure.pageWidth<=width+1,'No page overflow');
   if(width===1366){assert.ok(Math.abs(measure.title.y-measure.help.y)<5);assert.ok(Math.abs(measure.title.y-measure.status.y)<5,'Status shares header row');assert.ok(Math.abs(measure.selector.y-measure.header.y)<20);}
   assert.ok(measure.chips.every(r=>r.y>=Math.max(measure.title.bottom,measure.help.bottom,measure.status.bottom)),'Chips are exclusively below header');
   assert.ok(measure.chips.every(r=>r.right<=width),'No overflowing chips');
  }
  const before=await page.evaluate(()=>JSON.stringify({grades:store.grades,finales:store.finales,concComp:store.concComp,asistencia:store.asistencia,sessions:store.sessions}));
  for(const mode of ['num','letra']){await page.locator('#wrapCalificar [data-modo="'+mode+'"]').click();assert.equal(await page.evaluate(()=>modoCalif),mode);}
  assert.equal(await page.evaluate(()=>JSON.stringify({grades:store.grades,finales:store.finales,concComp:store.concComp,asistencia:store.asistencia,sessions:store.sessions})),before);
  results.push({revision,width,count,state,...measure});
 }
 await page.locator('#listaSesiones button[data-fecha]').nth(1).click();assert.equal(await page.locator('#inpFecha').inputValue(),'2026-10-25');assert.equal(await page.locator('#listaSesiones .sess-chip.on').count(),1);
 assert.equal(await page.evaluate(()=>fixtureRemote.writes),0);assert.equal(external,0);assert.deepEqual(errors,[]);await context.close();
}const comparison=[1366,390].map(width=>{const before=results.find(r=>r.revision==='before'&&r.width===width&&r.count===1&&r.state==='pending'),after=results.find(r=>r.revision==='after'&&r.width===width&&r.count===1&&r.state==='pending');return {width,sessionsBefore:before.sessionsHeight,sessionsAfter:after.sessionsHeight,calHeaderBefore:before.calHeaderHeight,calHeaderAfter:after.calHeaderHeight,reduction:before.sessionsHeight-after.sessionsHeight+before.calHeaderHeight-after.calHeaderHeight};});console.log(JSON.stringify({passed:results.length,failed:0,synthetic:true,comparison,results},null,2));}finally{await browser.close();}}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
