'use strict';
// Identical fictitious timetable and constraints for main and the new app.
const fs=require('node:fs'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),path=require('node:path');
const baseline='ac60a16ba9a0bf4c1df020dfc7ac7905e829c377';
const fromBaseline=file=>execFileSync('git',['show',baseline+':'+file],{encoding:'utf8',maxBuffer:2500000});
const current=fs.readFileSync('aula_innovacion.html','utf8'),previous=fromBaseline('aula_innovacion.html');
const baselineModules=new Map(['aip-distribucion.js','aip-estadisticas.js'].map(file=>[file,fromBaseline(file)]));
const audit=require('../aip-distribucion.js');
const plantilla30=require('./fixtures/aip-plantilla-30.json');
const horarioRealista=require('./fixtures/aip-horario-realista.cjs');
const fake='https://backend.fixture.invalid/exec';
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright');
 const preview=process.argv.includes('--preview');
 const browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:!preview});
 async function fixture(width,code,modules=new Map()){
  const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  const page=await ctx.newPage();let cloud=null;
  const errors=[],external=[],requests=[];
  page.on('dialog',d=>d.accept());
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://aip.fixture.invalid/')return route.fulfill({contentType:'text/html',body:code.replace(/const CLOUD_API_URL = '[^']+';/,"const CLOUD_API_URL = '"+fake+"';")});
   if(url==='https://cdn.tailwindcss.com/')return route.fulfill({contentType:'text/javascript',body:process.env.IE_AIP_TAILWIND?fs.readFileSync(process.env.IE_AIP_TAILWIND,'utf8'):"document.head.insertAdjacentHTML('beforeend','<style>.hidden{display:none!important}</style>')"});
   for(const f of ['layout-shells.css','aip-colegiado.js','aip-distribucion.js','aip-estadisticas.js', 'aip-paquete.js'])if(url==='https://aip.fixture.invalid/'+f)return route.fulfill({contentType:f.endsWith('.css')?'text/css':'text/javascript',body:modules.get(f)??fs.readFileSync(f,'utf8')});
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
   document.getElementById('inpMes').value='2026-03';renderPlantilla();render();
  });
  return {ctx,page,errors,external,requests,package:()=>cloud};
 }
 async function measure(page){
  const measured=await page.evaluate(()=>{
   const start=performance.now();armarAnio();const elapsedMs=Math.round(performance.now()-start);
   const docs=new Set(),sections=new Set(),courses=new Set(),combos=new Map(),monthly=new Map();
   let conflicts=0,outside=0,hours=0,support=0,maintenance=0;
   for(const [date,day] of Object.entries(plan))if(date.startsWith('2026-'))for(const [h,c] of Object.entries(day.sec||{})){
    if(c.tipo!=='grupo'){support+=Number(c.tipo==='soporte');maintenance+=Number(c.tipo==='man');continue;}
    const doc=normDoc(c.doc),course=normArea(c.area),month=date.slice(0,7),combo=[doc,course,c.seccion].join('|');
    docs.add(doc);sections.add(c.seccion);courses.add(course);hours++;
    if(!combos.has(combo))combos.set(combo,new Set());
    combos.get(combo).add(month);
    const key=combo+'|'+month;monthly.set(key,(monthly.get(key)||0)+1);
    if(!c.manual){
     if(esColegiadoReservado(date,'sec',h))conflicts++;
     const wd=new Date(date+'T12:00:00').getDay()-1,row=getHS()[wd]?.[h]?.[c.seccion];
     if(!row||normDoc(row.doc)!==doc||normArea(row.area)!==course||esFeriado(date)||!pipOk('sec',Number(h),wd))outside++;
    }
   }
   let repeats=0;
   for(const months of combos.values()){
    const sorted=[...months].map(m=>Number(m.slice(5))).sort((a,b)=>a-b);
    for(let i=1;i<sorted.length;i++)if(sorted[i]===sorted[i-1]+1)repeats++;
   }
   const registered=new Set(Object.values(getHS()).flatMap(w=>Object.values(w)).flatMap(h=>Object.values(h)).map(r=>normDoc(r.doc)));
   return {teachers:docs.size,sections:sections.size,courses:courses.size,combos:combos.size,pendingTeachers:registered.size-docs.size,
    maxMonthly:Math.max(0,...monthly.values()),repeats,hours,support,maintenance,conflicts,outside,elapsedMs,
    history:historialAip('2026'),target:[...inventarioAip(docentesAip()).keys()],adjacent:horasPed('sec').filter(h=>horasConsecutivasSec(h,h+1))};
  });
  const {history,target,adjacent,...metrics}=measured;
  const rounds=audit.rounds(target,audit.completeBlocks(history,(a,b)=>b===a+1&&adjacent.includes(a)));
  const earned=[...rounds.credits.values()].map(credit=>credit.row);
  const cumulative=['2026-03','2026-04','2026-05'].map(m=>new Set(earned.filter(r=>audit.month(r)<=m).map(audit.key)).size);
  return {...metrics,cumulative,marchHours:history.filter(r=>audit.month(r)==='2026-03').length,
   firstClose:rounds.completed[0]?.close.date??null,lastCredit:earned.at(-1)?.date??null,
   rounds:rounds.completed.length,objective:target.length,pending:rounds.pending.size,withoutRoundCredit:rounds.anomalies.length};
 }
 function twoCombinations(months){
  plan={};feriados={};colegiado={pri:{},sec:{}};programacionesColegiado=[];
  plantilla.sec={1:[0],2:[0],3:[0],4:[0]};
  const item=(doc,area)=>({doc,area});
  horarioDoc={0:{1:{'1A':item('Docente A','MAT')},2:{'1A':item('Docente A','MAT')},
    3:{'1B':item('Docente B','COM')},4:{'1B':item('Docente B','COM')}}};
  aplicarHorarioInst();
  generarPeriodoAip(months,true,['sec']);
  return historialAip('2026').length;
 }
 async function monthCapture(p,month,filename){
  await p.evaluate(value=>{showAipTab('mes');document.getElementById('inpMes').value=value;onMes();},month);
  if(process.env.IE_AIP_EVIDENCE)await p.locator('#boxSec').screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,filename+'.png')});
 }
 try{
  if(preview){
   const f=await fixture(1366,current);
   await f.page.evaluate(({config,horario})=>{
    plantilla=config;horarioDoc=horario;plan={};colegiado={pri:{},sec:{}};
    guardarCfg(false);saveHS();renderPlantilla();renderMesesAnio();renderEditorHS();generarPeriodoAip(mesesAnioSel,true);
   },{config:plantilla30,horario:horarioRealista});
   console.log('Vista previa ficticia de AIP en Edge. Cierra la ventana para terminar.');
   await f.page.waitForEvent('close',{timeout:0});
   return;
  }
  const twoMonths=['2026-03','2026-04'];
  const schoolMonths=Array.from({length:10},(_,i)=>'2026-'+String(i+3).padStart(2,'0'));
  const old=await fixture(1366,previous,baselineModules),oldMetrics=await measure(old.page);
  const oldCompatible=await old.page.evaluate(twoCombinations,schoolMonths);
  assert.deepEqual(old.errors,[]);assert.deepEqual(old.external,[]);assert.deepEqual(old.requests,[]);await old.ctx.close();
  for(const width of [1366,390]){
   const f=await fixture(width,current),p=f.page;
   const protectedState=await p.evaluate(()=>JSON.stringify([plan['2026-02-09'],plan['2027-03-01'],colegiado,programacionesColegiado,cursosPorMes]));
   const modern=await measure(p);
   assert.equal(modern.conflicts+modern.outside+modern.withoutRoundCredit,0);assert.ok(modern.maxMonthly<=2);
   assert.equal(modern.pending,oldMetrics.pending);
   assert.ok(modern.cumulative[0]>oldMetrics.cumulative[0]&&modern.lastCredit<=oldMetrics.lastCredit);
   assert.equal(await p.evaluate(()=>JSON.stringify([plan['2026-02-09'],plan['2027-03-01'],colegiado,programacionesColegiado,cursosPorMes])),protectedState);
   assert.equal(await p.evaluate(()=>{
    const before=JSON.stringify(plan),stored=localStorage.getItem(KEY);
    return !generarPeriodoAip(['2026-01','2026-02'],true,['sec'])&&JSON.stringify(plan)===before&&localStorage.getItem(KEY)===stored;
   }),true);
   assert.equal(await p.evaluate(()=>{
    const before=JSON.stringify(plan);
    const assertValid=IEAipDistribucion.validate;IEAipDistribucion.validate=()=>{throw new Error('Fallo ficticio');};
    try{return generarPeriodoAip(['2026-03','2026-04'],true)===false&&before===JSON.stringify(plan)&&before===localStorage.getItem(KEY);}
    finally{IEAipDistribucion.validate=assertValid;}
   }),true);
   if(width===1366)assert.equal(await p.evaluate(()=>{const before=JSON.stringify(plan);armarAnio();return before===JSON.stringify(plan);}),true);
   if(process.env.IE_AIP_EVIDENCE)for(const month of twoMonths)await monthCapture(p,month,'cierre-calendario-'+month+'-'+width);
   assert.match(await p.locator('#boxInformeAip').textContent(),/Motivos de Soporte y Mantenimiento/);
   await p.getByText(/Motivos de Soporte y Mantenimiento/).click();
   const unused=p.locator('[aria-label="Tramos sin atención pedagógica"] tbody tr');
   await unused.first().waitFor({state:'visible'});
   assert.equal(await unused.count(),modern.support);
   await p.locator('#tabBtnEstadisticas').click();
   await p.locator('#filtrosAip select[name=nivel]').selectOption('sec');
   assert.match(await p.locator('#resultadoAip > p').first().innerText(),new RegExp('^'+modern.hours+' horas'));
   const matrix=p.locator('[aria-label="Matriz anual por docente, curso y sección"]');
   const monthly=p.locator('[aria-label="Cobertura acumulada y horas de Secundaria"]');
   assert.equal(await monthly.locator('tbody tr').count(),10);
   assert.equal(await monthly.locator('tbody tr').first().locator('td').nth(4).innerText(),String(modern.marchHours));
   assert.match(await p.locator('#rondasAip').innerText(),/Horas de enero y febrero conservadas: 1/);
   assert.ok(await matrix.locator('tbody tr').count()>10);
   assert.equal(await matrix.locator('tbody tr').evaluateAll(rows=>rows.reduce((n,r)=>n+Number(r.lastElementChild.textContent),0)),modern.hours);
   if(width===390){
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await matrix.evaluate(el=>el.scrollWidth>el.clientWidth),true);
   }
   if(process.env.IE_AIP_EVIDENCE){
    await p.evaluate(()=>window.scrollTo(0,0));
    await p.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'cierre-estadisticas-'+width+'.png')});
    await matrix.locator('thead').scrollIntoViewIfNeeded();
    await p.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'cierre-matriz-'+width+'.png')});
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
   assert.ok(JSON.stringify(f.package()).length<=49000);
   const cloudChars=JSON.stringify(f.package()).length;
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
   const compatible=await p.evaluate(twoCombinations,schoolMonths);
   assert.equal(oldCompatible,40);assert.equal(compatible,40);
   await p.evaluate(()=>showAipTab('estadisticas'));
   const progress=p.locator('[aria-label="Avance anual de rondas"]');
   assert.match(await progress.locator('tbody tr').first().innerText(),/2 de 2[\s\S]*100 %[\s\S]*Completada[\s\S]*2026-03-02/);
   assert.match(await progress.locator('tbody tr').nth(1).innerText(),/100 %[\s\S]*Completada[\s\S]*2026-04-06/);
   assert.equal(await progress.locator('tbody tr').count(),11);
   assert.match(await progress.locator('tbody tr').nth(9).innerText(),/100 %[\s\S]*Completada[\s\S]*2026-12-07/);
   if(process.env.IE_AIP_EVIDENCE){
    await progress.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'cierre-rondas-completas-'+width+'.png')});
    if(width===1366)for(const month of schoolMonths)await monthCapture(p,month,'cierre-compatible-'+month);
   }
   await p.evaluate(()=>{
    delete horarioDoc[0][4]['1B'];
    plan={};
    generarPeriodoAip(['2026-03','2026-04'],true,['sec']);
    showAipTab('estadisticas');
   });
   assert.match(await progress.innerText(),/1 de 2[\s\S]*50 %/);
   assert.match(await p.locator('#rondasAip').innerText(),/Ronda 2 bloqueada/);
   assert.equal(await p.getByRole('button',{name:'Autorizar exclusión'}).count(),0);
   if(process.env.IE_AIP_EVIDENCE)await progress.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'cierre-ronda-bloqueada-'+width+'.png')});
   await p.evaluate(()=>{
    sessionStorage.setItem('ie22375_session_v1',JSON.stringify({user:'pip',role:'pip',token:'test-ficticio',tokenExp:Date.now()+3600000}));
    renderEstadisticasAip();
   });
   await p.getByLabel('Combinación a excluir').selectOption({label:'Docente B · Comunicación · 1B'});
   await p.getByLabel('Motivo de la exclusión').fill('Horario sin dos tramos');
   await p.getByRole('button',{name:'Autorizar exclusión'}).click();
   assert.match(await p.locator('#rondasAip').innerText(),/Universo institucional: 2 · Universo autorizado: 1/);
   await p.evaluate(()=>{generarPeriodoAip(['2026-03','2026-04'],true,['sec']);return subirAipNube();});
   assert.ok(f.package().exclusionesRondasAip['2026'][0].reason);
   await p.evaluate(()=>{exclusionesRondasAip={};return bajarAipNube();});
   await p.reload();await p.locator('#tabBtnEstadisticas').click();
   assert.match(await p.locator('#rondasAip').innerText(),/Universo institucional: 2 · Universo autorizado: 1/);
   await p.getByRole('button',{name:'Reincorporar'}).click();
   assert.match(await p.locator('#rondasAip').innerText(),/Ronda 2 bloqueada/);
   assert.equal(await p.evaluate(()=>{
    const fecha='2026-05-04';
    plantilla.sec={};plan={};
    setCelda(fecha,'sec',1,{tipo:'abierto',texto:'—'});setCelda(fecha,'sec',2,{tipo:'abierto',texto:'—'});
    return generarPeriodoAip(['2026-05'],true,['sec'])&&celda(fecha,'sec',1).tipo==='abierto'&&celda(fecha,'sec',2).tipo==='abierto';
   }),true);
   const dynamicStarts=await p.evaluate(()=>{
    const start=months=>{
     if(!generarPeriodoAip(months,true,['sec']))throw new Error('Generación ficticia fallida');
     const first=ultimoInformeAip[0].estado.completed[0].start;
     return [first.date,first.h1,first.h2];
    };
    const grupo={'1A':{doc:'Docente ficticio',area:'MAT'}};
    plan={};colegiado={pri:{},sec:{}};programacionesColegiado=[];cursosPorMes={};
    feriados={'2026-03-04':'Feriado','2026-03-11':'Semana gestión'};
    horarioDoc={2:{5:grupo,6:grupo}};plantilla.sec={5:[2],6:[2]};
    setCelda('2026-03-18','sec',5,{tipo:'bloqueado',texto:'',manual:true});
    const wednesday=start(['2026-03']);
    const retained=celda('2026-03-18','sec',5).manual===true;
    plan={};feriados={'2026-05-07':'Vacaciones'};cursosPorMes={'2026-04':[],'2026-05':['MAT']};
    horarioDoc={3:{1:grupo,2:grupo}};plantilla.sec={1:[3],2:[3]};
    programacionesColegiado=[{id:'fecha-ficticia',name:'Reserva ficticia',active:true,mode:'semanal',day:3,levels:['sec'],
      start:'2026-05-14',end:'2026-05-14',hours:{sec:{all:[1,2]}},times:{sec:Object.fromEntries(HSEC().filter(([h])=>h===1||h===2))},include:[],exclude:[]}];
    const thursday=start(['2026-04','2026-05']);
    return {wednesday,thursday,retained,colegiado:esColegiadoReservado('2026-05-14','sec',1)};
   });
   assert.deepEqual(dynamicStarts,{wednesday:['2026-03-25',5,6],thursday:['2026-05-21',1,2],retained:true,colegiado:true});
   assert.deepEqual(f.requests,['saveaip','loadaip','saveaip','loadaip']);assert.deepEqual(f.external,[]);assert.deepEqual(f.errors,[]);
   console.log(JSON.stringify({width,old:oldMetrics,new:modern,cleaned,cloudChars,oldCompatible,compatible,dynamicStarts}));
   await f.ctx.close();
   const weekly=await fixture(width,current),page=weekly.page;
   await page.evaluate(horario=>{
    horarioDoc=horario;plan={};colegiado={pri:{},sec:{}};
    renderPlantilla();renderMesesAnio();renderEditorHS();render();
   },horarioRealista);
   const templates=page.locator('#boxPlantPri, #boxPlantSec');
   const slot=(nivel,h,day)=>page.locator(`td[onclick="togglePlantilla('${nivel}',${h},${day})"]`);
   const cell=(date,nivel,h)=>page.locator(`td[onclick="clicCelda('${date}','${nivel}','${h}')"]`);
   for(const [nivel,horas] of [['pri',6],['sec',7]])for(let h=1;h<=horas;h++)for(let day=0;day<5;day++){
    const wanted=(plantilla30[nivel][h]||[]).includes(day);
    if((await slot(nivel,h,day).innerText()==='AIP')!==wanted)await slot(nivel,h,day).click();
   }
   async function checkTemplate(expected){
    assert.deepEqual(await templates.evaluateAll(roots=>roots.map(root=>[...root.querySelectorAll('td.c-aip')].map(c=>c.getAttribute('onclick')))),
     Object.entries(expected).map(([level,hours])=>Object.entries(hours).flatMap(([h,days])=>days.slice().sort().map(day=>`togglePlantilla('${level}',${h},${day})`))));
    for(const level of ['pri','sec'])assert.deepEqual(await page.evaluate(n=>{
     const clean=value=>Object.fromEntries(Object.entries(value).filter(([,days])=>days.length).map(([h,days])=>[h,days.slice().sort()]));
     return [clean(plantilla[n]),clean(JSON.parse(localStorage.getItem(CFG_KEY)).plantilla[n])];
    },level),[expected[level],expected[level]]);
   }
   await checkTemplate(plantilla30);
   if(process.env.IE_AIP_EVIDENCE)for(const [i,level] of ['pri','sec'].entries()){
    await templates.nth(i).screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'pr131-plantilla-30-'+level+'-'+width+'.png')});
   }
   const snapshot=()=>page.evaluate(()=>JSON.stringify(programacionesColegiado));
   const protectedRules=await snapshot();
   const verifyPlan=async(expected,months)=>{
    const result=await page.evaluate(({expected,months})=>{
     const used=new Set(),errors=[],types=new Set(),summary={pri:0,sec:0};
     for(const [date,record] of Object.entries(plan)){
      if(!date.startsWith('2026-'))continue;
      for(const level of ['pri','sec'])for(const [h,c] of Object.entries(record[level]||{})){
       if(c.manual||!['grupo','soporte','man'].includes(c.tipo))continue;
       const day=new Date(date+'T12:00:00').getDay()-1;
       if(!months.includes(date.slice(5,7))||!(expected[level][h]||[]).includes(day)
         ||esColegiadoReservado(date,level,Number(h))||!horasPed(level).includes(Number(h)))errors.push([date,level,h,c.tipo]);
       used.add(date.slice(5,7));types.add(c.tipo);summary[level]++;
      }
     }
     return {used:[...used].sort(),errors,types:[...types].sort(),summary};
    },{expected,months});
    assert.deepEqual(result.used,months);assert.deepEqual(result.errors,[]);assert.deepEqual(result.types,['grupo','man','soporte']);
    assert.ok(result.summary.pri&&result.summary.sec);
   };
   await page.getByRole('button',{name:'Armar mes',exact:true}).click();
   await verifyPlan(plantilla30,['03']);
   await page.getByRole('button',{name:'Armar meses marcados',exact:true}).click();
   await verifyPlan(plantilla30,schoolMonths.map(m=>m.slice(5)));
   assert.equal(await snapshot(),protectedRules);
   const roundCheck=await page.evaluate(()=>{
    const motor=IEAipDistribucion,report=ultimoInformeAip[0].estado;
    const owners=new Set(),monthHours=new Map();
    for(const [date,day] of Object.entries(plan))for(const c of Object.values(day.sec||{})){
     if(c.tipo!=='grupo'||c.manual)continue;
     if(c.seccion==='5U'&&c.area==='CCSS')owners.add(c.docenteId);
     const id=[date.slice(0,7),c.area,c.seccion].join('|');
     monthHours.set(id,(monthHours.get(id)||0)+1);
    }
    const sequence=[...report.credits.values()];
    return {crossings:choquesHS().length,owners:[...owners],cap:Math.max(0,...monthHours.values()),
     target:report.target.size,covered:new Set(sequence.map(({row})=>motor.key(row))).size,
     closed:report.completed.length,pending:report.pending.size,anomalies:report.anomalies.length,
     chronological:sequence.every(({row,round})=>{
      const previous=report.completed[round-2]?.close;
      return !previous||row.date>previous.date||(row.date===previous.date&&row.h1>previous.h2);
     })};
   });
   assert.deepEqual(roundCheck.owners,['fixture-03']);
   assert.equal(roundCheck.crossings+roundCheck.anomalies,0);
   assert.equal(roundCheck.cap,2);assert.equal(roundCheck.target,54);assert.equal(roundCheck.covered,54);
   assert.ok(roundCheck.closed>=2);assert.equal(roundCheck.chronological,true);
   const override=cell('2026-03-02','pri',4);
   await override.click();
   await page.locator('#modTipo').selectOption('soporte');
   await page.locator('#modal').getByRole('button',{name:'Aplicar',exact:true}).click();
   assert.equal(await override.innerText(),'Soporte');
   const inactivePri=cell('2026-03-03','pri',4),inactiveSec=cell('2026-03-03','sec',2);
   assert.ok(await inactivePri.innerText());assert.ok(await inactiveSec.innerText());
   const conteoDeMarzo=()=>page.evaluate(()=>['pri','sec'].map(n=>{
    const {conteo}=registrosCalendarioAip(diasMes('2026-03'),n,{},docentesAip());
    return conteo.grupo+conteo.soporte+conteo.man;
   }));
   const beforeClosing=await conteoDeMarzo();
   await slot('pri',4,1).click();
   await slot('sec',2,1).click();
   await page.getByRole('button',{name:'Aplicar plantilla al mes',exact:true}).click();
   for(const disabled of [inactivePri,inactiveSec]){
    assert.equal(await disabled.innerText(),'');assert.match(await disabled.getAttribute('class'),/c-gray/);
   }
   assert.ok((await conteoDeMarzo()).every((count,i)=>count<beforeClosing[i]));
   const modified=structuredClone(plantilla30);modified.pri[4]=[3];modified.sec[2]=[0,2,3,4];
   await page.getByRole('button',{name:'Armar meses marcados',exact:true}).click();
   await verifyPlan(modified,schoolMonths.map(m=>m.slice(5)));
   await checkTemplate(modified);
   assert.equal(await override.innerText(),'Soporte');assert.equal(await snapshot(),protectedRules);
   const atomic=await page.evaluate(()=>{
    const old=JSON.stringify(plan),stored=localStorage.getItem(KEY),original=armarPrimariaMes;
    armarPrimariaMes=days=>{original(days);setCelda('2026-03-02','pri',1,{tipo:'man',texto:'Forzado por la prueba'});};
    try{return !generarPeriodoAip(['2026-03'],true)&&JSON.stringify(plan)===old&&localStorage.getItem(KEY)===stored;}
    finally{armarPrimariaMes=original;}
   });
   assert.equal(atomic,true);
   if(process.env.IE_AIP_EVIDENCE){
    await templates.last().screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'pr131-plantilla-sec-'+width+'.png')});
    await page.locator('#boxPri').screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'pr131-calendario-pri-'+width+'.png')});
   }
   assert.deepEqual(weekly.requests,[]);
   await Promise.all([page.waitForResponse(fake),page.getByRole('button',{name:'Subir nube'}).click()]);
   await page.reload();await checkTemplate(modified);
   await slot('pri',4,1).click();
   await Promise.all([page.waitForResponse(fake),page.getByRole('button',{name:'Bajar nube'}).click()]);
   await page.waitForFunction(()=>!pipOk('pri',4,1));
   await checkTemplate(modified);
   await verifyPlan(modified,schoolMonths.map(m=>m.slice(5)));
   assert.equal(await snapshot(),protectedRules);
   assert.equal(await override.innerText(),'Soporte');
   assert.deepEqual(weekly.requests,['saveaip','loadaip']);assert.deepEqual(weekly.errors,[]);assert.deepEqual(weekly.external,[]);
   console.log(JSON.stringify({width,weeklyTemplateHours:30,afterEditing:28,atomic,months:10,roundCheck}));
   await weekly.ctx.close();
  }
 }finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
