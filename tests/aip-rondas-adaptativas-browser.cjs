'use strict';

const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const horarioRealista=require('./fixtures/aip-horario-realista.cjs');
const plantilla30=require('./fixtures/aip-plantilla-30.json');
const ref='a4f0e4d';
const origin='https://aip-adaptativo.fixture.invalid';
const fromMain=file=>execFileSync('git',['show',ref+':'+file],{encoding:'utf8'});
const chain=require('./fixtures/aip-cadena-reasignacion.cjs');
const fixtures={
 chain,
 continuity:{...chain,offsets:[0,56,112,168]},
 annual:{horarioRealista,plantilla30},
 impossible:{horarioRealista,plantilla30,impossible:true}
};

async function measure(browser,width,version,name){
 const ctx=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
 try{
  const page=await ctx.newPage(),errors=[],external=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('dialog',dialog=>dialog.accept());
  await ctx.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.href==='https://cdn.tailwindcss.com/')return route.fulfill({contentType:'text/javascript',body:process.env.IE_AIP_TAILWIND?
    fs.readFileSync(process.env.IE_AIP_TAILWIND,'utf8'):"document.head.insertAdjacentHTML('beforeend','<style>.hidden{display:none!important}</style>')"});
   if(url.origin!==origin){external.push(url.href);return route.abort();}
   const file=url.pathname==='/'?'aula_innovacion.html':url.pathname.slice(1);
   if(!['aula_innovacion.html','layout-shells.css','aip-colegiado.js','aip-distribucion.js','aip-estadisticas.js','aip-paquete.js'].includes(file))return route.fulfill({status:404});
   let contents=version==='main'?fromMain(file):fs.readFileSync(file,'utf8');
   if(file.endsWith('.html'))contents=contents.replace(/const CLOUD_API_URL = '[^']+';/,"const CLOUD_API_URL = 'https://backend.fixture.invalid/exec';");
   const contentType=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
   return route.fulfill({contentType,body:contents});
  });
  await page.goto(origin);
  const metrics=await page.evaluate(({name,config})=>{
   const year='2026',months=Array.from({length:10},(_,i)=>year+'-'+String(i+3).padStart(2,'0'));
   plan={};colegiado={pri:{},sec:{}};programacionesColegiado=[];feriados={};cursosPorMes={};
   if(config.slots){
    plantilla={pri:{},sec:{}};horarioDoc={};
    const dates=new Map((config.offsets||[0]).flatMap(offset=>config.dates.map((date,i)=>{
     const shifted=new Date(date+'T12:00:00Z');shifted.setUTCDate(shifted.getUTCDate()+offset);
     return [shifted.toISOString().slice(0,10),config.starts[i]];
    })));
    for(const [slot,date] of config.dates.entries()){
     const wd=new Date(date+'T12:00:00').getDay()-1,h=config.starts[slot];
     for(const hour of [h,h+1]){
      (plantilla.sec[hour]??=[]).push(wd);
      (horarioDoc[wd]??={})[hour]=Object.fromEntries(config.sections.flatMap((section,i)=>config.slots[i].includes(slot)?[[section,{area:'MAT',doc:'Docente ficticio '+i,docenteId:'D'+i}]]:[]));
     }
    }
    for(const d of diasEscolaresAip(year))for(const h of horasPed('sec')){
     const date=ymd(d),start=dates.get(date);
     if(h!==start&&h!==start+1)setCelda(date,'sec',h,{tipo:'vacio',texto:'',manual:true});
    }
   }else{
    plantilla=structuredClone(config.plantilla30);horarioDoc=structuredClone(config.horarioRealista);
    for(const date of fechasSemana('2026-04-13'))feriados[date]='Semana gestión';
    Object.assign(feriados,{'2026-04-02':'Feriado','2026-05-01':'Feriado','2026-05-18':'Vacaciones','2026-05-19':'Vacaciones'});
    programacionesColegiado=[{id:'prueba',name:'Rotación ficticia',mode:'rotativo',active:true,levels:['sec'],start:'2026-03-02',end:'2026-12-31',
     day:0,hours:{sec:{all:[5,6]}},times:{sec:Object.fromEntries(horasPorNivelColegiado().sec.filter(([h])=>[5,6].includes(h)))},include:[],exclude:[]}];
    for(const date of ['2026-04-01','2026-04-08','2026-05-06','2026-05-13'])for(const h of horasPed('sec')){
     setCelda(date,'sec',h,{tipo:'vacio',texto:'',manual:true});
    }
    setCelda('2026-04-07','sec',2,{tipo:'bloqueado',texto:'',manual:true});
    setCelda('2026-05-07','sec',2,{tipo:'abierto',texto:'—',manual:true});
    // Change availability on a day that has a redundant weekly alternative.
    plantilla.sec[2]=plantilla.sec[2].filter(day=>day!==0);
    if(config.impossible)horarioDoc[0][7]['5U']={area:'EPT',doc:'Docente sin par',docenteId:'sin-par'};
   }
   document.getElementById('inpMes').value='2026-05';renderPlantilla();
   const motor=IEAipDistribucion,nombres=docentesAip(),dias=diasEscolaresAip(year),original=structuredClone(plan);
   const initial=oportunidadesAip(dias,nombres,true),catalogo=inventarioAip(nombres);
   plan={};const noOverrides=oportunidadesAip(dias,nombres,true);plan=original;
   const opportunityId=r=>[r.date,r.h1,motor.key(r)].join('|');
   const eligible=new Set(initial.opportunities.map(opportunityId));
   const blocked=new Set(noOverrides.opportunities.filter(r=>!eligible.has(opportunityId(r))).map(r=>r.date+'|'+r.h1));
   const possible=new Set(initial.opportunities.map(motor.key));
   const time=performance.now(),ok=generarPeriodoAip(months,true,['sec']),ms=Math.round(performance.now()-time);
   if(!ok)throw Error('No se generó el periodo ficticio');
   const report=ultimoInformeAip[0],round=report.estado,placements=historialAip(year,nombres);
   const missed=report.alternativas.filter(r=>r.reason==='Oportunidad compatible sin asignar en la búsqueda').length;
   const availablePending=[...round.pending].filter(id=>possible.has(id));
   const covered=new Set([...round.credits.values()].map(({row})=>motor.key(row)));
   let conflicts=0;
   for(const row of placements){
    const day=new Date(row.date+'T12:00:00').getDay()-1;
    if(!pipOk('sec',row.hour,day)||esColegiadoReservado(row.date,'sec',row.hour))conflicts++;
   }
   const extras=report.extras;
   const reopening=celda('2026-05-07','sec',2);
   return {institutional:catalogo.size,compatible:possible.size,impossible:catalogo.size-possible.size,blocked:blocked.size,
    pendingCompatible:availablePending.length,neverCovered:availablePending.filter(id=>!covered.has(id)).length,
    pending:round.pending.size,covered:covered.size,completed:round.completed.length,hours:placements.length,
    support:extras.soporte,maintenance:extras.mantenimiento,missed,ms,conflicts,anomalies:round.anomalies.length,
    maxMonthly:Math.max(0,...motor.summarize(placements,[]).months.values()),openUsed:reopening?.aperturaAip===true,
    closes:round.completed.map(r=>r.close.date),
    monthly:months.map(m=>placements.filter(r=>r.date.startsWith(m)).length)};
  },{name,config:fixtures[name]});
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  if(process.env.IE_AIP_EVIDENCE&&version==='current'&&name!=='chain'){
   await page.locator('#tabBtnEstadisticas').click();
   await page.locator('[aria-label="Avance anual de rondas"]').screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,name+'-rondas-adaptativas-'+width+'.png')});
  }
  return metrics;
 }finally{await ctx.close();}
}

async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});
 try{
  for(const name of Object.keys(fixtures)){
   const old=await measure(browser,1366,'main',name);
   console.log(JSON.stringify({name,old}));
   if(process.argv.includes('--diagnostico'))continue;
   for(const width of [1366,390]){
    const current=await measure(browser,width,'current',name);
    assert.equal(current.conflicts+current.anomalies,0);
    assert.ok(current.maxMonthly<=2);
    assert.ok(current.hours>=old.hours);
    if(name==='chain'){assert.equal(current.completed,1);assert.ok(current.hours>old.hours);}
    if(name==='continuity'){
     assert.equal(old.completed,3);assert.equal(current.completed,4);assert.equal(current.closes[0],'2026-05-08');
     assert.ok(current.hours>old.hours);
    }
    if(name==='annual'){assert.equal(current.impossible,0);assert.equal(current.openUsed,true);}
    if(name==='impossible'){assert.equal(current.impossible,1);assert.equal(current.completed,0);}
    console.log(JSON.stringify({name,width,current}));
   }
  }
 }finally{await browser.close();}
}
run().catch(error=>{console.error(error.stack);process.exitCode=1;});
