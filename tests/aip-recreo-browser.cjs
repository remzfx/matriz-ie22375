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
  // Reset uses the customized weekly template even when this month has every override type.
  const baseline=await page.evaluate(()=>{
   plantilla={pri:{1:[0],4:[1]},sec:{2:[0],6:[1]}};
   colegiado={pri:{3:[0]},sec:{5:[0]}};
   cursosPorMes={'2026-12':['Matemática'],'2027-01':['Comunicación']};
   for(const nivel of ['pri','sec']){
    ['grupo','soporte','man','gestion','vacaciones','colegio','bloqueado'].forEach((tipo,i)=>setCelda('2026-12-14',nivel,i+1,{tipo,texto:tipo,manual:true}));
    setCelda('2026-12-15',nivel,1,{tipo:'feriado',texto:'Feriado'});
    setCelda('2027-01-04',nivel,1,{tipo:'man',texto:'Otro mes'});
   }
   plan['2026-12-19']={recreoOculto:{pri:true}};
   plan['2027-01-04'].recreoOculto={sec:true};
   feriados={'2026-12-14':'Semana gestión','2026-12-15':'Vacaciones','2026-12-19':'Feriado','2027-01-04':'Feriado'};
   guardar(true);
   document.getElementById('hpIni').value='05:00'; // Unapplied change must not be saved by Limpiar.
   return JSON.stringify([horario,plantilla,colegiado,cursosPorMes,plan['2027-01-04']]);
  });
  const verifyClean=async()=>{
   const actual=await page.evaluate(()=>{
    const levels={};
    for(const [nivel,id] of [['pri','boxPri'],['sec','boxSec']]){
     const table=document.querySelector('#'+id+' table');
     const weights=[...table.tHead.rows[0].cells].slice(2).map((th)=>Number(th.querySelector('button').textContent.slice(0,2)));
     levels[nivel]=[...table.tBodies[0].rows].flatMap(row=>[...row.cells].slice(2).map((td,i)=>({
      hora:row.cells[0].textContent,day:weights[i],text:td.textContent,color:getComputedStyle(td).backgroundColor
     })));
    }
    return {levels,baseline:JSON.stringify([horario,plantilla,colegiado,cursosPorMes,plan['2027-01-04']]),plan:Object.keys(plan),feriados};
   });
   assert.equal(actual.baseline,baseline);
   assert.deepEqual(actual.plan,['2027-01-04']);
   assert.deepEqual(actual.feriados,{'2027-01-04':'Feriado'});
   for(const [nivel,cells] of Object.entries(actual.levels)){
    const byWeekday=nivel==='pri'?{0:['1','3'],1:['4']}: {0:['2','5'],1:['6']};
    for(const {hora,day,text,color} of cells){
     const wd=new Date(2026,11,day).getDay()-1;
     const slots=byWeekday[wd]||[];
     if(hora==='R')assert.deepEqual([text,color],['RECREO','rgb(253, 230, 138)']);
     else if(wd===0&&hora===slots[1])assert.deepEqual([text,color],['Colegiado AIP','rgb(110, 231, 183)']);
     else if(hora===slots[0])assert.deepEqual([text,color],['—','rgb(187, 247, 208)']);
     else assert.deepEqual([text,color],['','rgb(203, 213, 225)']);
    }
   }
  };
  const limpiar=page.getByRole('button',{name:'Limpiar',exact:true});
  await limpiar.click();await verifyClean();
  await limpiar.click();await verifyClean();
  assert.equal(await page.locator('#hpIni').inputValue(),'05:00');
  assert.deepEqual(requests,['saveaip','loadaip']);
  await page.reload();await show();await verifyClean();
  await page.evaluate(()=>subirAipNube());
  await page.evaluate(()=>{plan={};feriados={};return bajarAipNube();});
  await verifyClean();
  assert.deepEqual(requests,['saveaip','loadaip','saveaip','loadaip']);
  assert.equal(external,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,passed:true,external,explicitCloud:requests,errors:0}));await context.close();
 }}finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
