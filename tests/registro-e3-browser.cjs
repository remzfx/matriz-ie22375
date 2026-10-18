// Real CSSOM/DOM before and after the seven-rule deletion; synthetic users and blocked external network.
'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),{html}=require('./registro-connection-browser.cjs'),{modules,source}=require('./registro-script-fixture.cjs');
const before=execFileSync('git',['show','f55a680:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const selector='.av-card,.av-comp,.av-meta,.av-badge,.av-ev,.av-stu';
async function scenario(browser,level,width,version){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],result=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.addInitScript(()=>{const Original=Date,fixed=Date.parse('2026-10-18T15:30:00Z');window.Date=class extends Original{constructor(...args){super(...(args.length?args:[fixed]));}static now(){return fixed;}};});
 const printer='<script>'+source('registro-calificar-print.js').replace(/<\/script/gi,'<\\/script')+'</script>';
 await page.route('**/*',r=>{const u=new URL(r.request().url()),file=u.pathname.slice(1);if(u.origin==='https://fixture.invalid'&&file==='')return r.fulfill({contentType:'text/html',body:html(level,false,version).replace('<script>/* Inicio guard de arranque de Registro. */',printer+'<script>/* Inicio guard de arranque de Registro. */')});if(u.origin==='https://fixture.invalid'&&[...modules,'registro-evaluation.js','registro-grading.js'].includes(file))return r.fulfill({contentType:'application/javascript',body:source(file)});return r.abort();});
 try{
  await page.goto('https://fixture.invalid/');await page.waitForFunction(()=>window.IERegistroConnection?.current()?.snapshot().state==='connected');
  await page.addStyleTag({content:'@media screen{.panel-cal.on,.panel-av.on{display:block!important}}'});
  await page.evaluate(()=>{
   window.fixturePrints=0;window.print=()=>fixturePrints++;document.getElementById('inpFecha').value='2026-10-01';fillComps();
   const c=ctxBase(),date='2026-10-01';store.sessions=[];store.grades={};store.finales={};store.concComp={};
   competencias().forEach((comp,i)=>{const capacidad=capsOficiales(comp)[0]||'Capacidad ficticia';store.sessions.push({...c,comp,capacidad,fecha:date,ts:1});estudiantes().forEach((al,j)=>{const n=[8,12,15,19][(i+j)%4],key=[c.nivel,c.bim,c.grado,c.seccion,c.area,comp,capacidad,date,studentKey(al)].join('||');store.grades[key]={nota20:n,nivel:numToLetter(n),origen:'numero',ts:1};});});
   const key=finalKey(competencias()[0],studentKey(estudiantes()[0]));store.finales[key]={nota20:8,nivel:'C',origen:'letra',ts:1};store.concComp[key]={texto:'Conclusión ficticia completa con ñ y tildes.',ts:1};store.asistencia['synthetic-unrelated']={marca:'T',ts:1};store.asisFechas[asisCtxKey()]=[date];store.asisFechasEstado[asisCtxKey()+'||'+date]={borrado:false,ts:1};
   onSesionChange();window.e3Academic=()=>JSON.stringify(Object.fromEntries(['grades','finales','concComp','sessions','capsSel','asistencia','asisFechas','asisFechasEstado'].map(k=>[k,store[k]||{}])));window.e3Original=e3Academic();
  });
  const capture=async(root,kind)=>{
   assert.equal(await page.locator(selector).count(),0,kind+' has no obsolete card consumer');
   const view=await page.locator(root).evaluate(el=>{const props=['display','position','font-family','font-size','font-weight','line-height','color','background-color','text-align','vertical-align','border-top-width','border-left-width','padding-top','padding-left','width','height'];return {dom:el.innerHTML,styles:[el,...el.querySelectorAll('th,td,button,input,select,textarea')].map(node=>({tag:node.tagName,classes:node.className,css:Object.fromEntries(props.map(p=>[p,getComputedStyle(node).getPropertyValue(p)]))}))};});
   assert.equal(await page.evaluate(()=>e3Academic()),await page.evaluate(()=>e3Original),kind+' preserves all academic maps');result.push({kind,...view});
  };
  for(const mode of ['letra','num']){
   await page.emulateMedia({media:'screen'});await page.evaluate(m=>modoCalif=m,mode);
   for(const [panel,root]of [['cal','#stuList'],['fin','#finLista'],['av','#avanceBox']]){await page.evaluate(p=>showPanel(p),panel);await capture(root,mode+' screen '+panel);}
   for(const kind of ['cal','fin','av','as']){
    await page.evaluate(k=>{if(k==='cal')prepararImpresion();else if(k==='as')imprimirAsistenciaRegistro();else imprimirResumen({promedios:k==='fin'});},kind);
    await page.waitForTimeout(250);await page.emulateMedia({media:'print'});await capture('#printArea',mode+' print '+kind);await page.emulateMedia({media:'screen'});
   }
  }
  assert.equal(await page.evaluate(()=>fixturePrints),8);assert.equal(await page.evaluate(()=>fixtureRequests.length),0);assert.equal(await page.evaluate(()=>fixtureRemote.writes),0);assert.deepEqual(errors,[]);return result;
 }finally{await context.close();}
}
async function run(){const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright'),browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});try{for(const level of ['primaria','secundaria'])for(const width of [1366,390]){const a=await scenario(browser,level,width,before),b=await scenario(browser,level,width,source('registro.html'));assert.deepEqual(b,a);console.log(level+' '+width+'px: '+a.length+' screen/print DOM and computed-style comparisons identical; zero card consumers, academic maps intact, zero uploads');}}finally{await browser.close();}}
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1});
