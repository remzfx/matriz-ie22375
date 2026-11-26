'use strict';
// Identical fictitious timetable and constraints for main and the new app.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),path=require('node:path');
const baseline='6992c06c7782add21f4181b3680b2f82721cca36';
const current=fs.readFileSync('aula_innovacion.html','utf8'),previous=execFileSync('git',['show',baseline+':aula_innovacion.html'],{encoding:'utf8',maxBuffer:2500000});
const fake='https://backend.fixture.invalid/exec';
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});
 async function fixture(width,code){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await ctx.newPage();let cloud=null;
  const errors=[],external=[],requests=[];
  page.on('dialog',d=>d.accept());
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://aip.fixture.invalid/')return route.fulfill({contentType:'text/html',body:code.replace(/const CLOUD_API_URL = '[^']+';/,"const CLOUD_API_URL = '"+fake+"';")});
   if(url==='https://cdn.tailwindcss.com/')return route.fulfill({contentType:'text/javascript',body:process.env.IE_AIP_TAILWIND?fs.readFileSync(process.env.IE_AIP_TAILWIND,'utf8'):"document.head.insertAdjacentHTML('beforeend','<style>.hidden{display:none!important}</style>')"});
   for(const f of ['layout-shells.css','aip-colegiado.js','aip-distribucion.js','aip-estadisticas.js', 'aip-paquete.js'])if(url==='https://aip.fixture.invalid/'+f)return route.fulfill({contentType:f.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(f,'utf8')});
   if(url===fake){
    const body=route.request().postDataJSON();requests.push(body.action);
    if(body.action==='saveaip'){
     assert.ok(JSON.stringify(body.payload).length<=49000,'simulated cloud cell size');
     cloud=body.payload;return route.fulfill({json:{ok:true}});
    }
    assert.equal(body.action,'loadaip');return route.fulfill({json:{ok:true,payload:cloud}});
   }
   external.push(url);return route.abort();
  });
  await page.goto('https://aip.fixture.invalid/');
  await page.evaluate(()=>{
   const sections=['1A','1B','2A','2B','3A','3B','4A','4B','5U'];
   const areas=['MAT','COM','CYT','CCSS','ING','ART'];
   horarioDoc={};
   for(let d=0;d<5;d++){
    horarioDoc[d]={};
    for(let h=1;h<=7;h++){
     const pair=Math.floor((h-1)/2);
     horarioDoc[d][h]=Object.fromEntries(sections.map((section,i)=>{
      const docente=(i*3+d*5+pair*4)%24;
      const area=areas[(i+d+pair)%areas.length];
      return [section,{doc:'Docente ficticio '+String(docente+1).padStart(2,'0'),area}];
     }));
    }
   }
   // Make some neighboring hours incompatible while retaining their genuine candidates.
   horarioDoc[1][2]['1A'].area='COM';
   horarioDoc[3][6]['2A'].area='ART';
   plantilla={pri:{1:[0,1,2,3,4],2:[0,1,2,3,4]},sec:{}};
   for(let h=1;h<=7;h++)plantilla.sec[h]=[0,1,2,3,4];
   colegiado={pri:{},sec:{2:[0]}};
   feriados={'2026-04-03':'Feriado','2026-05-01':'Vacaciones','2026-07-27':'Semana gestión'};
   programacionesColegiado=[{id:'fixture-col',name:'Colegiado ficticio',active:true,mode:'rotativo',levels:['sec'],start:'2026-03-02',end:'2026-12-31',day:0,hours:{sec:{all:[5,6]}},times:{sec:Object.fromEntries(HSEC().filter(([h])=>h===5||h===6))},include:[],exclude:[]}];
   mesesAnioSel=Array.from({length:10},(_,i)=>'2026-'+String(i+3).padStart(2,'0'));
   cursosPorMes=Object.fromEntries(mesesAnioSel.map(m=>[m,areas.slice()]));
   plan={'2026-02-09':{sec:{1:{tipo:'grupo',seccion:'1A',doc:'Docente ficticio 01',area:'MAT',texto:'Fijo previo',manual:true}}},
    '2027-03-01':{sec:{1:{tipo:'grupo',seccion:'1A',doc:'Docente ficticio 99',area:'MAT',texto:'Otro año',manual:true}}}};
   document.getElementById('inpMes').value='2026-03';render();
  });
  return {ctx,page,errors,external,requests,package:()=>cloud};
 }
 async function measure(page){
  return page.evaluate(()=>{
   const start=performance.now();armarAnio();const elapsedMs=Math.round(performance.now()-start);
   const docs=new Set(),sections=new Set(),courses=new Set(),combos=new Map(),monthly=new Map();
   let conflicts=0,outside=0,hours=0;
   for(const [date,day] of Object.entries(plan))if(date.startsWith('2026-'))for(const [h,c] of Object.entries(day.sec||{})){
    if(c.tipo!=='grupo')continue;
    const doc=normDoc(c.doc),course=normArea(c.area),month=date.slice(0,7),combo=[doc,course,c.seccion].join('|');
    docs.add(doc);sections.add(c.seccion);courses.add(course);hours++;
    if(!combos.has(combo))combos.set(combo,new Set());
    combos.get(combo).add(month);
    const key=combo+'|'+month;monthly.set(key,(monthly.get(key)||0)+1);
    if(!c.manual){
     if(esColegiadoReservado(date,'sec',h))conflicts++;
     const wd=new Date(date+'T12:00:00').getDay()-1,row=getHS()[wd]?.[h]?.[c.seccion];
     if(!row||normDoc(row.doc)!==doc||normArea(row.area)!==course||esFeriado(date))outside++;
    }
   }
   let repeats=0;
   for(const months of combos.values()){
    const sorted=[...months].map(m=>Number(m.slice(5))).sort((a,b)=>a-b);
    for(let i=1;i<sorted.length;i++)if(sorted[i]===sorted[i-1]+1)repeats++;
   }
   const registered=new Set(Object.values(getHS()).flatMap(w=>Object.values(w)).flatMap(h=>Object.values(h)).map(r=>normDoc(r.doc)));
   return {teachers:docs.size,sections:sections.size,courses:courses.size,combos:combos.size,pendingTeachers:registered.size-docs.size,
    maxMonthly:Math.max(0,...monthly.values()),repeats,hours,conflicts,outside,elapsedMs};
  });
 }
 try{
  const old=await fixture(1366,previous),oldMetrics=await measure(old.page);
  assert.deepEqual(old.errors,[]);assert.deepEqual(old.external,[]);assert.deepEqual(old.requests,[]);await old.ctx.close();
  for(const width of [1366,390]){
   const f=await fixture(width,current),p=f.page;
   const protectedState=await p.evaluate(()=>JSON.stringify([plan['2026-02-09'],plan['2027-03-01'],colegiado,programacionesColegiado,cursosPorMes]));
   const modern=await measure(p);
   assert.equal(modern.conflicts+modern.outside,0);assert.ok(modern.maxMonthly<=2);assert.ok(modern.combos>oldMetrics.combos||modern.repeats<oldMetrics.repeats);
   assert.equal(await p.evaluate(()=>JSON.stringify([plan['2026-02-09'],plan['2027-03-01'],colegiado,programacionesColegiado,cursosPorMes])),protectedState);
   assert.equal(await p.evaluate(()=>{
    const before=JSON.stringify(plan);
    const assertValid=IEAipDistribucion.validate;IEAipDistribucion.validate=()=>{throw new Error('Fallo ficticio');};
    try{return generarPeriodoAip(['2026-03','2026-04'],true)===false&&before===JSON.stringify(plan)&&before===localStorage.getItem(KEY);}
    finally{IEAipDistribucion.validate=assertValid;}
   }),true);
   if(width===1366)assert.equal(await p.evaluate(()=>{const before=JSON.stringify(plan);armarAnio();return before===JSON.stringify(plan);}),true);
   await p.locator('#tabBtnEstadisticas').click();
   await p.locator('#filtrosAip select[name=nivel]').selectOption('sec');
   assert.match(await p.locator('#resultadoAip > p').first().innerText(),new RegExp('^'+modern.hours+' horas'));
   const matrix=p.locator('[aria-label="Matriz anual por docente, curso y sección"]');
   assert.ok(await matrix.locator('tbody tr').count()>10);
   assert.equal(await matrix.locator('tbody tr').evaluateAll(rows=>rows.reduce((n,r)=>n+Number(r.lastElementChild.textContent),0)),modern.hours);
   if(width===390){
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await matrix.evaluate(el=>el.scrollWidth>el.clientWidth),true);
   }
   if(process.env.IE_AIP_EVIDENCE){
    await p.evaluate(()=>window.scrollTo(0,0));
    await p.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'estadisticas-aip-'+width+'.png')});
    await matrix.locator('thead').scrollIntoViewIfNeeded();
    await p.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'matriz-aip-'+width+'.png')});
   }
   const find=p.locator('#filtrosAip input[name=buscar]');
   await find.fill('docente ficticio 01');
   assert.ok(await matrix.locator('tbody tr').count()>=1);
   assert.ok((await matrix.locator('tbody tr').allTextContents()).every(t=>t.includes('Docente ficticio 01')));
   await find.fill('');
   await p.evaluate(()=>{showAipTab('mes');document.getElementById('inpMes').value='2026-03';limpiarMes();showAipTab('estadisticas');});
   const cleaned=await matrix.locator('tbody tr').evaluateAll(rows=>rows.reduce((n,r)=>n+Number(r.lastElementChild.textContent),0));
   assert.ok(cleaned<modern.hours);
   assert.equal(await p.evaluate(()=>programacionesColegiado.length),1);
   assert.deepEqual(f.requests,[]);
   await p.evaluate(()=>subirAipNube());
   assert.equal(f.package().aipEncoding,'gzip-base64-v1');
   await p.evaluate(()=>{plan={};return bajarAipNube();});
   await p.reload();await p.locator('#tabBtnEstadisticas').click();
   const reloaded=await matrix.locator('tbody tr').evaluateAll(rows=>rows.reduce((n,r)=>n+Number(r.lastElementChild.textContent),0));
   assert.equal(reloaded,cleaned);
   assert.deepEqual(f.requests,['saveaip','loadaip']);assert.deepEqual(f.external,[]);assert.deepEqual(f.errors,[]);
   assert.equal(await p.evaluate(()=>{
    const month='2026-03',date=month+'-03',first=getHS()[1][1]['1A'];
    const group={tipo:'grupo',seccion:'1A',doc:first.doc,area:first.area};
    plan={[date]:{sec:{1:{...group,manual:true},2:{...group},3:{...group}}}};
    const preserved=JSON.stringify(plan[date]);
    return generarPeriodoAip(['2026-05'],true,['sec'])&&JSON.stringify(plan[date])===preserved;
   }),true);
   const excess='3 horas programadas (manuales: 1 · heredadas sin marca manual: 2)';
   assert.match(await p.locator('#boxInformeAip').textContent(),/Oportunidades compatibles evaluadas: [1-9]\d*/);
   assert.ok((await p.locator('#boxInformeAip').textContent()).includes(excess));
   assert.ok((await p.locator('[aria-label="Origen de excesos mensuales"]').textContent()).includes(excess));
   assert.deepEqual(f.requests,['saveaip','loadaip']);assert.deepEqual(f.errors,[]);
   console.log(JSON.stringify({width,old:oldMetrics,new:modern,cleaned,cloudChars:JSON.stringify(f.package()).length}));
   await f.ctx.close();
  }
 }finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
