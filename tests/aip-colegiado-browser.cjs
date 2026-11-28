'use strict';
// Production page, deterministic fictitious fixtures and no external backend.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const backend='https://backend.fixture.invalid/exec';
const source=fs.readFileSync('aula_innovacion.html','utf8').replace(/const CLOUD_API_URL = '[^']+';/,"const CLOUD_API_URL = '"+backend+"';");
const expected=['2026-12-21','2026-12-29','2027-01-06','2027-01-14','2027-01-22','2027-01-25'];
async function run(){
 const {chromium}=require(process.env.IE_PLAYWRIGHT_MODULE||'playwright');
 const browser=await chromium.launch({channel:process.env.CI?undefined:'msedge',headless:true});
 try{for(const width of [1366,390]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const messages=[],errors=[],requests=[],external=[];
  let cloud=null,cancel=false;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async dialog=>{messages.push(dialog.message());await (cancel?dialog.dismiss():dialog.accept());});
  await page.route('**/*',route=>{
   const url=route.request().url();
   if(url==='https://aip.fixture.invalid/')return route.fulfill({contentType:'text/html',body:source});
   if(url==='https://cdn.tailwindcss.com/')return route.fulfill({contentType:'text/javascript',body:process.env.IE_AIP_TAILWIND?fs.readFileSync(process.env.IE_AIP_TAILWIND,'utf8'):"document.head.insertAdjacentHTML('beforeend','<style>.hidden{display:none!important}</style>')"});
   for(const file of ['layout-shells.css','aip-colegiado.js','aip-distribucion.js','aip-estadisticas.js', 'aip-paquete.js'])if(url==='https://aip.fixture.invalid/'+file)return route.fulfill({contentType:file.endsWith('.css')?'text/css':'text/javascript',body:fs.readFileSync(file,'utf8')});
   if(url===backend){
    const body=route.request().postDataJSON();
    requests.push(body.action);
    if(body.action==='saveaip'){cloud=body.payload;return route.fulfill({json:{ok:true}});}
    assert.equal(body.action,'loadaip');
    return route.fulfill({json:{ok:true,payload:cloud}});
   }
   external.push(url);return route.abort();
  });
  await page.goto('https://aip.fixture.invalid/');
  await page.evaluate(()=>{
   plantilla={pri:{1:[0,1,2,3,4],2:[0,1,2,3,4]},sec:{4:[0,1,2,3,4],5:[0,1,2,3,4],6:[0,1,2,3,4],7:[0,1,2,3,4]}};
   colegiado={pri:{6:[0]},sec:{}};
   feriados={'2026-12-29':'Feriado','2027-01-06':'Vacaciones','2027-01-14':'Semana gestión'};
   cursosPorMes={'2026-12':['MAT'],'2027-01':['MAT']};
   horarioDoc={};
   for(let d=0;d<5;d++)horarioDoc[d]=Object.fromEntries([4,5,6,7].map(h=>[h,{'1A':{area:'Matemática',doc:'Docente ficticio'}}]));
   setCelda('2026-12-21','pri',1,{tipo:'grupo',texto:'Asignación ficticia'});
   document.getElementById('selBloque').value='2';
   document.getElementById('inpMes').value='2026-12';
  });
  await page.locator('#tabBtnColegiado').click();
  await page.getByRole('button',{name:'Agregar programación'}).click();
  const form=page.locator('#colegiadoForm');
  await form.locator('[name=nombre]').fill('Rotación ficticia');
  await form.locator('[name=nivel]').selectOption('ambos');
  await form.locator('[name=modo]').selectOption('rotativo');
  await form.locator('[name=inicio]').fill('2026-12-21');
  await form.locator('[name=fin]').fill('2027-01-31');
  for(const wd of [0,1,2,3,4])for(const [nivel,horas] of [['pri',[1,2]],['sec',[5,6]]])for(const hora of horas)await form.locator('input[data-nivel='+nivel+'][data-fila="'+wd+'"][value="'+hora+'"]').check();
  assert.equal(await form.locator('#colegiadoHoras input[value=R]').count(),0);
  assert.match(await form.locator('#colegiadoHoras').innerText(),/08:00-08:45/);
  await form.getByRole('button',{name:'Vista previa'}).click();
  const preview=await page.locator('#colegiadoVista').innerText();
  assert.match(preview,/2026-12-21/);assert.match(preview,/2027-01-25/);assert.doesNotMatch(preview,/2026-12-29|2027-01-06|2027-01-14/);
  if(process.env.IE_AIP_EVIDENCE)await page.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'colegiado-'+width+'.png'),fullPage:true});
  cancel=true;
  await form.getByRole('button',{name:'Guardar programación'}).click();
  assert.match(messages.at(-1),/Se retirarán 1/);
  assert.equal(await page.evaluate(()=>programacionesColegiado.length),0);
  assert.equal(await page.evaluate(()=>celda('2026-12-21','pri',1).tipo),'grupo');
  cancel=false;
  await form.getByRole('button',{name:'Guardar programación'}).click();
  const original=await page.evaluate(()=>JSON.stringify(programacionesColegiado));
  assert.equal(await page.evaluate(()=>celda('2026-12-21','pri',1)),undefined);
  const reserva=async()=>page.evaluate(dates=>dates.map(f=>[
   f,[1,2].map(h=>esColegiadoReservado(f,'pri',h)),[5,6].map(h=>esColegiadoReservado(f,'sec',h))
  ]),expected);
  const active=expected.map((f,i)=>[f,[0,4,5].includes(i)?[true,true]:[false,false],[0,4,5].includes(i)?[true,true]:[false,false]]);
  assert.deepEqual(await reserva(),active);
  await page.evaluate(()=>{clicCelda('2026-12-21','pri','1');});
  assert.equal(await page.locator('#modTipo').inputValue(),'colegio');
  await page.locator('#modal').getByRole('button',{name:'Cancelar'}).click();
  assert.equal(await page.evaluate(()=>celda('2026-12-21','pri',1)),undefined);
  await page.locator('#tabBtnMes').click();
  const generate=()=>page.evaluate(()=>{mesesAnioSel=['2026-12','2027-01'];armarAnio();});
  for(let i=0;i<2;i++){ await generate(); assert.deepEqual(await reserva(),active); }
  await page.evaluate(()=>{armarMes();aplicarPlantillaAlMes();});
  assert.deepEqual(await reserva(),active);
  const results=await page.evaluate(()=>{
   const noGroups=['2026-12-21','2027-01-22','2027-01-25'].every(f=>[1,2].every(h=>!celda(f,'pri',h))&&[5,6].every(h=>!celda(f,'sec',h)));
   const pairs=paresLibresSec(new Date('2026-12-21T12:00:00')).filter(s=>s.h2);
   return {noGroups,noCross:pairs.every(s=>s.h2<5||s.h1>6),elsewhere:Object.values(plan).some(row=>Object.values(row.sec||{}).some(c=>c.tipo==='grupo')),pending:ultimoInformeAip.length>0};
  });
  assert.deepEqual(results,{noGroups:true,noCross:true,elsewhere:true,pending:true});
  await page.evaluate(()=>limpiarMes());
  assert.equal(await page.evaluate(()=>document.querySelector('#boxPri td.c-col[onclick*="2026-12-21"]').textContent),'Colegiado AIP');
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),original);
  await page.reload();
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),original);
  assert.deepEqual(requests,[]);
  await page.evaluate(()=>subirAipNube());
  await page.evaluate(()=>{programacionesColegiado=[];return bajarAipNube();});
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),original);
  await page.evaluate(()=>{const pkg=paqueteAip();delete pkg.programacionesColegiado;aplicarPaqueteAip(pkg);});
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),original);
  const checkPreview=await page.evaluate(()=>{
   document.getElementById('inpMes').value='2026-12';
   // Only the individual block is no lectivo. Its neighboring block is still reserved.
   setCelda('2026-12-21','pri',1,{tipo:'gestion',texto:'Gestión individual',manual:true});
   setCelda('2026-12-21','sec',7,{tipo:'colegio',texto:'Copia residual',manual:true});
   render();
   const filas=ocurrenciasColegiado(programacionesColegiado[0]);
   const acts=filas.find(x=>x.fecha==='2026-12-21'&&x.nivel==='pri');
   const visible=[...document.querySelectorAll('#boxPri td.c-col')].filter(td=>td.onclick?.toString().includes('2026-12-21'));
   return {preview:acts.horas,active:[1,2].map(h=>esColegiadoReservado('2026-12-21','pri',h)),
     visible:visible.map(td=>td.textContent),residual:document.getElementById('boxSec').innerText.includes('Copia residual'),
     residualUsable:slotActivo('2026-12-21','sec',7,0)};
  });
  assert.deepEqual(checkPreview,{preview:[2],active:[false,true],visible:['Colegiado AIP','Colegiado AIP'],residual:false,residualUsable:true});
  await page.evaluate(()=>{setCelda('2026-12-21','pri',1,null);armarMes(true);});
  assert.equal(await page.evaluate(()=>esColegiadoMaterializado(plan['2026-12-21'].sec[7])),false);
  await page.evaluate(()=>{
   document.getElementById('hsIni').value='14:00';
   aplicarHorarioInst();
  });
  const halted=await page.evaluate(()=>{
   const before=JSON.stringify(plan);
   mesesAnioSel=['2026-12','2027-01'];
   armarMes();armarAnio();aplicarPlantillaAlMes();armarSecundariaMes(diasMes('2026-12'));
   return {active:esColegiadoReservado('2026-12-21','sec',5),blocked:!slotActivo('2026-12-21','sec',7,0),
     unaffected:esColegiadoReservado('2026-12-21','pri',1),planKept:before===JSON.stringify(plan),
     shown:document.querySelector('#boxSec button[onclick*="2026-12-21"]').textContent.includes('Revisar colegiado')};
  });
  assert.deepEqual(halted,{active:false,blocked:true,unaffected:true,planKept:true,shown:true});
  assert.ok(messages.some(m=>/Generación pausada.*Colegiado AIP/.test(m)&&m.includes('Rotación ficticia')));
  await page.locator('#tabBtnColegiado').click();
  assert.match(await page.locator('#colegiadoLista').innerText(),/Horario pendiente de revisión/);
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await form.getByRole('button',{name:'Vista previa'}).click();
  assert.match(await page.locator('#colegiadoVista').innerText(),/17:30-18:15/);
  if(process.env.IE_AIP_EVIDENCE){
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'colegiado-revision-'+width+'.png'),fullPage:true});
  }
  cancel=true;
  await form.getByRole('button',{name:'Guardar programación'}).click();
  assert.match(messages.at(-1),/Se reemplazarán los tramos anteriores/);
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),original);
  assert.equal(await page.evaluate(()=>hayColegiadoPendiente('2026-12-21','sec')),true);
  cancel=false;
  await form.locator('[name=nombre]').fill('Rotación actualizada');
  await form.getByRole('button',{name:'Guardar programación'}).click();
  assert.match(await page.locator('#colegiadoLista').innerText(),/Rotación actualizada/);
  assert.equal(await page.evaluate(()=>programacionesColegiado[0].times.sec[5]),'17:30-18:15');
  assert.equal(await page.evaluate(()=>hayColegiadoPendiente('2026-12-21','sec')),false);
  assert.equal(await page.evaluate(()=>esColegiadoReservado('2026-12-21','sec',5)),true);
  await page.evaluate(()=>{document.getElementById('hsN').value='5';aplicarHorarioInst();});
  assert.equal(await page.evaluate(()=>hayColegiadoPendiente('2026-12-21','sec')&&!slotActivo('2026-12-21','sec',4,0)),true);
  await page.evaluate(()=>{document.getElementById('hsN').value='7';aplicarHorarioInst();});
  assert.equal(await page.evaluate(()=>hayColegiadoPendiente('2026-12-21','sec')),false);
  assert.deepEqual(await page.evaluate(()=>{
   return [['hsMin','50'],['hsRecH','3'],['hsRecM','40']].map(([id,value])=>{
    const input=document.getElementById(id),old=input.value;
    input.value=value;aplicarHorarioInst();
    const pending=hayColegiadoPendiente('2026-12-21','sec');
    input.value=old;aplicarHorarioInst();
    return pending&&!hayColegiadoPendiente('2026-12-21','sec');
   });
  }),[true,false,true]); // Moving R earlier without changing the interval of hours 5–6 remains compatible.
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await form.locator('[name=fin]').fill('2027-01-23');
  for(const wd of [0,1,2,3,4])await form.locator('input[data-nivel=sec][data-fila="'+wd+'"][value="6"]').uncheck();
  await form.getByRole('button',{name:'Guardar programación'}).click();
  assert.equal(await page.evaluate(()=>esColegiadoReservado('2027-01-25','pri',1)),false);
  assert.equal(await page.evaluate(()=>esColegiadoReservado('2026-12-21','sec',6)),false);
  assert.equal(await page.evaluate(()=>slotActivo('2026-12-21','sec',6,0)),true);

  await page.evaluate(()=>{
   const duplicate=structuredClone(programacionesColegiado[0]);duplicate.id='segunda';duplicate.name='Segunda reserva';
   confirmarProgramacionColegiado(duplicate,ocurrenciasColegiado(duplicate));
  });
  await page.locator('#colegiadoLista article').last().getByRole('button',{name:'Vista previa'}).click();
  assert.match(await page.locator('#colegiadoVista').innerText(),/[1-9]\d* coinciden/);
  const first=page.locator('#colegiadoLista article').first();
  await first.getByRole('button',{name:'Desactivar'}).click();
  assert.equal(await page.evaluate(()=>esColegiadoReservado('2026-12-21','pri',1)),true);
  await first.getByRole('button',{name:'Activar',exact:true}).click();
  await page.locator('#colegiadoLista article').last().getByRole('button',{name:'Eliminar'}).click();
  assert.equal(await page.evaluate(()=>esColegiadoReservado('2026-12-21','pri',1)),true);
  await first.getByRole('button',{name:'Eliminar'}).click();
  assert.equal(await page.evaluate(()=>esColegiadoReservado('2026-12-21','pri',1)),false);
  assert.equal(await page.evaluate(()=>esColegiadoReservado('2026-12-21','pri',6)),true);
  await page.evaluate(()=>{
   editKey={fecha:'2026-12-21',nivel:'pri',hora:1};
   document.getElementById('modTipo').value='colegio';
   aplicarModal();
  });
  assert.equal(await page.evaluate(()=>esColegiadoReservado('2026-12-21','pri',1)&&!esColegiadoMaterializado(plan['2026-12-21']?.pri?.[1])),true);
  assert.deepEqual(requests,['saveaip','loadaip']);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  // Differential coverage: real editor interactions with distinct weekday hours at both levels.
  await page.evaluate(()=>{
   plan={};feriados={'2027-01-06':'Feriado'};colegiado={pri:{},sec:{}};programacionesColegiado=[];
   renderGestorColegiado();
  });
  await page.getByRole('button',{name:'Agregar programación'}).click();
  await form.locator('[name=nombre]').fill('Horarios por día · prueba ficticia');
  await form.locator('[name=nivel]').selectOption('ambos');
  await form.locator('[name=modo]').selectOption('rotativo');
  await form.locator('[name=inicio]').fill('2026-12-21');
  await form.locator('[name=fin]').fill('2027-01-31');
  const hours={pri:[[1],[2],[1,2],[2],[1]],sec:[[5],[6],[4],[7],[5,6]]};
  for(const nivel of ['pri','sec'])for(let wd=0;wd<5;wd++)for(const h of hours[nivel][wd])
   await form.locator(`input[data-nivel=${nivel}][data-fila="${wd}"][value="${h}"]`).check();
  assert.equal(await form.locator('.colegiado-matrix').count(),2);
  assert.equal(await form.locator('.colegiado-matrix tbody tr').count(),10);
  assert.equal(await form.locator('input[value=R]').count(),0);
  assert.ok(await form.locator('.colegiado-pip').count()>0);
  assert.ok(await form.locator('td:not(.colegiado-pip)').count()>0);
  const measure=await page.evaluate(()=>({
   pageFits:document.documentElement.scrollWidth<=innerWidth,
   matrices:[...document.querySelectorAll('.colegiado-scroll')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth})),
   touch:[...document.querySelectorAll('.colegiado-matrix label')].every(e=>e.getBoundingClientRect().height>=44)
  }));
  assert.equal(measure.pageFits,true);assert.equal(measure.touch,true);
  if(width===390)assert.ok(measure.matrices.every(e=>e.scroll>e.client));
  const scroller=form.locator('.colegiado-scroll').last();
  await scroller.evaluate(e=>{e.scrollLeft=e.scrollWidth;});
  if(width===390)assert.ok(await scroller.evaluate(e=>e.scrollLeft>0));
  await scroller.evaluate(e=>{e.scrollLeft=0;});
  await form.getByRole('button',{name:'Vista previa'}).click();
  const expectedPreview=await page.evaluate(()=>ocurrenciasColegiado(leerEditorColegiado()));
  for(const row of expectedPreview)assert.deepEqual(row.horas,hours[row.nivel][new Date(row.fecha+'T12:00:00').getDay()-1]);
  assert.ok(expectedPreview.some(r=>r.fecha==='2027-01-25'&&r.nivel==='pri'&&r.horas.join()==='1'));
  assert.ok(!expectedPreview.some(r=>r.fecha==='2027-01-06'));
  if(process.env.IE_AIP_EVIDENCE){
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,'colegiado-por-dia-'+width+'.png'),fullPage:true});
  }
  await form.getByRole('button',{name:'Guardar programación'}).click();
  const dayRule=await page.evaluate(()=>JSON.stringify(programacionesColegiado));
  const compare=()=>page.evaluate(()=>{
   const rows=ocurrenciasColegiado(programacionesColegiado[0]);
   const exact=IEAipColegiado.dates(programacionesColegiado[0]).every(fecha=>['pri','sec'].every(nivel=>
    horasPed(nivel).every(h=>esColegiadoReservado(fecha,nivel,h)===(rows.find(r=>r.fecha===fecha&&r.nivel===nivel)?.horas.includes(h)||false))));
   let calendar=true;
   const selected=document.getElementById('inpMes').value;
   for(const month of ['2026-12','2027-01']){
    document.getElementById('inpMes').value=month;render();
    for(const nivel of ['pri','sec'])for(const td of document.querySelectorAll(nivel==='pri'?'#boxPri td[onclick]':'#boxSec td[onclick]')){
     const match=td.getAttribute('onclick').match(/clicCelda\('([^']+)','[^']+','(\d+)'\)/);
     if(match&&td.classList.contains('c-col')!==esColegiadoReservado(match[1],nivel,Number(match[2])))calendar=false;
    }
   }
   document.getElementById('inpMes').value=selected;render();
   return {rows,exact,calendar};
  });
  const compared=await compare();
  assert.deepEqual(compared.rows,expectedPreview);assert.equal(compared.exact,true);assert.equal(compared.calendar,true);
  await page.evaluate(()=>{
   document.getElementById('inpMes').value='2026-12';mesesAnioSel=['2026-12','2027-01'];
   armarMes();armarAnio();limpiarMes();
  });
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),dayRule);
  assert.equal((await compare()).exact,true);
  await page.reload();
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),dayRule);
  await page.evaluate(()=>subirAipNube());
  await page.evaluate(()=>{programacionesColegiado=[];return bajarAipNube();});
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),dayRule);
  await page.locator('#tabBtnColegiado').click();
  await page.getByRole('button',{name:'Editar',exact:true}).click();
  await form.locator('[name=modo]').selectOption('diario');
  const daily=await page.evaluate(()=>ocurrenciasColegiado(leerEditorColegiado()));
  for(const row of daily)assert.deepEqual(row.horas,hours[row.nivel][new Date(row.fecha+'T12:00:00').getDay()-1]);
  assert.ok(daily.length>expectedPreview.length);
  await form.getByRole('button',{name:'Guardar programación'}).click();
  assert.equal((await compare()).exact,true);
  assert.equal((await compare()).calendar,true);
  assert.deepEqual(requests,['saveaip','loadaip','saveaip','loadaip']);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  const date='2026-07-31',next='2026-08-03';
  await page.evaluate(({date,next})=>{
   plan={};feriados={};colegiado={pri:{},sec:{}};cursosPorMes={};
   const grupos={'1A':{area:'MAT',doc:'Docente ficticio'}};
   horarioDoc={4:Object.fromEntries([1,2,3,4,5,6,7].map(h=>[h,grupos]))};
   plantilla={pri:{},sec:{5:[0,4],6:[0,4]}};
   const hours=horasPorNivelColegiado();
   const rule=(nivel,hs)=>({id:'fixture-'+nivel,name:'Reserva '+nivel,mode:'rotativo',active:true,levels:[nivel],start:date,end:next,
    day:4,hours:{[nivel]:{all:hs}},times:{[nivel]:Object.fromEntries(hours[nivel].filter(([h])=>hs.includes(h)))},include:[],exclude:[]});
   programacionesColegiado=[rule('pri',[1]),rule('sec',[5,6])];
   document.getElementById('inpMes').value='2026-07';showAipTab('mes');onMes();
  },{date,next});
  const originalRules=await page.evaluate(()=>JSON.stringify(programacionesColegiado));
  const cell=(h,n='sec')=>page.locator(`td[onclick="clicCelda('${date}','${n}','${h}')"]`);
  const header=page.locator(`button[onclick="abrirColumna('${date}','sec')"]`);
  const modal=page.locator('#modal');
  const apply=async(trigger,tipo)=>{
   await trigger.click();await modal.locator('#modTipo').selectOption(tipo);
   if(tipo==='grupo')await modal.locator('#modGrupo').selectOption('1A');
   await modal.getByRole('button',{name:'Aplicar',exact:true}).click();
  };
  const state=()=>page.evaluate(({date,next})=>({
   tipos:horasPed('sec').map(h=>celda(date,'sec',h)?.tipo||null),
   sec:[5,6].map(h=>esColegiadoReservado(date,'sec',h)),
   pri:esColegiadoReservado(date,'pri',1),next:esColegiadoReservado(next,'sec',5),
   horas:registrosCalendarioAip([new Date(date+'T12:00:00')],'sec',{},docentesAip()).conteo.colegiado
  }),{date,next});
  assert.deepEqual((await state()).sec,[true,true]);
  await apply(header,'vacio');
  const empty=await state();
  assert.deepEqual(empty,{tipos:Array(7).fill('vacio'),sec:[false,false],pri:true,next:true,horas:0});
  assert.equal(await cell(5).innerText(),'');
  assert.equal(await cell(1,'pri').innerText(),'Colegiado AIP');
  assert.equal(await page.evaluate(date=>celda(date,'sec','R'),date),undefined);
  await cell('R').click();
  assert.equal(await cell('R').innerText(),'RECREO');
  // Creating, deactivating and reactivating a recurrence leaves the exception intact.
  await page.evaluate(()=>{
   const copied={...structuredClone(programacionesColegiado[1]),id:'segunda-prueba',name:'Segunda rotación'};
   confirmarProgramacionColegiado(copied,ocurrenciasColegiado(copied));
  });
  await page.locator('#tabBtnColegiado').click();
  const extraRule=page.locator('#colegiadoLista article').last();
  await extraRule.getByRole('button',{name:'Vista previa'}).click();
  assert.doesNotMatch(await page.locator('#colegiadoVista').innerText(),/2026-07-31/);
  await extraRule.getByRole('button',{name:'Desactivar'}).click();
  await extraRule.getByRole('button',{name:'Activar',exact:true}).click();
  await extraRule.getByRole('button',{name:'Eliminar'}).click();
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),originalRules);
  await page.locator('#tabBtnMes').click();
  assert.deepEqual(await state(),empty);
  await page.emulateMedia({media:'print'});
  assert.equal(await cell(5).innerText(),'');assert.equal(await cell(1,'pri').innerText(),'Colegiado AIP');
  await page.emulateMedia({media:'screen'});
  async function evidencia(nombre){
   if(!process.env.IE_AIP_EVIDENCE)return;
   await cell(5).scrollIntoViewIfNeeded();
   await page.locator('#boxSec').screenshot({path:path.join(process.env.IE_AIP_EVIDENCE,nombre+'-'+width+'.png')});
  }
  await evidencia('prioridad-vacio');
  await apply(cell(5),'colegio');await apply(cell(6),'colegio');
  assert.deepEqual(await state(),{...empty,tipos:['vacio','vacio','vacio','vacio','colegiado-manual','colegiado-manual','vacio'],sec:[true,true],horas:2});
  await evidencia('prioridad-colegiado-individual');
  await apply(cell(5),'soporte');
  assert.deepEqual((await state()).sec,[false,true]);
  assert.equal(await cell(5).innerText(),'Soporte');
  await apply(cell(5),'restaurar');
  assert.deepEqual((await state()).sec,[true,true]);
  for(const tipo of ['gestion','vacaciones','feriado','bloqueado','soporte','man','grupo','abierto','colegio','vacio']){
   await apply(header,tipo);
   const s=await state(),col=tipo==='colegio';
   assert.deepEqual(s.tipos,Array(7).fill(col?'colegiado-manual':tipo));
   assert.deepEqual(s.sec,[col,col]);assert.equal(s.pri&&s.next,true);
   assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),originalRules);
  }
  await apply(cell(6),'colegio');
  const mixed=await state();
  await page.getByRole('button',{name:'Armar mes',exact:true}).click();
  await page.evaluate(()=>{mesesAnioSel=['2026-07','2026-08'];renderMesesAnio();});
  await page.getByRole('button',{name:'Armar meses marcados',exact:true}).click();
  assert.deepEqual(await state(),mixed);
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.reload();
  await page.evaluate(()=>{document.getElementById('inpMes').value='2026-08';onMes();document.getElementById('inpMes').value='2026-07';onMes();});
  assert.deepEqual(await state(),mixed);
  await page.evaluate(async()=>{await subirAipNube();plan={};await bajarAipNube();});
  assert.deepEqual(await state(),mixed);
  await apply(header,'restaurar');
  assert.deepEqual((await state()).sec,[true,true]);
  await apply(header,'vacio');
  await page.getByRole('button',{name:'Limpiar',exact:true}).click();
  assert.deepEqual(await state(),{...empty,tipos:Array(7).fill(null),sec:[true,true],horas:2});
  assert.equal(await page.evaluate(()=>JSON.stringify(programacionesColegiado)),originalRules);

  // Vacío on an ordinary cell has to block a recurrence created later.
  const individual=()=>page.evaluate(date=>({
   value:celda(date,'sec',4),reserved:esColegiadoReservado(date,'sec',4),
   neighboring:esColegiadoReservado(date,'sec',3)
  }),date);
  assert.deepEqual(await individual(),{value:undefined,reserved:false,neighboring:false});
  await apply(cell(4),'vacio');
  const explicitEmpty={tipo:'vacio',texto:'',manual:true};
  assert.deepEqual((await individual()).value,explicitEmpty);
  await page.locator('#tabBtnColegiado').click();
  await page.getByRole('button',{name:'Agregar programación'}).click();
  await form.locator('[name=nombre]').fill('Colegiado posterior · prueba');
  await form.locator('[name=nivel]').selectOption('sec');
  await form.locator('[name=modo]').selectOption('semanal');
  await form.locator('[name=dia]').selectOption('4');
  await form.locator('[name=inicio]').fill(date);
  await form.locator('[name=fin]').fill(date);
  for(const h of [3,4])await form.locator(`input[data-nivel=sec][data-fila=all][value="${h}"]`).check();
  await form.getByRole('button',{name:'Guardar programación'}).click();
  const preserved={value:explicitEmpty,reserved:false,neighboring:true};
  assert.deepEqual(await individual(),preserved);
  await page.locator('#tabBtnMes').click();
  await page.getByRole('button',{name:'Armar mes',exact:true}).click();
  assert.deepEqual(await individual(),preserved);
  await page.getByRole('button',{name:'Guardar',exact:true}).click();
  await page.reload();
  await page.evaluate(()=>{document.getElementById('inpMes').value='2026-07';onMes();});
  assert.deepEqual(await individual(),preserved);
  await page.evaluate(async()=>{await subirAipNube();plan={};await bajarAipNube();});
  assert.deepEqual(await individual(),preserved);
  assert.equal(await cell(4).innerText(),'');
  await apply(cell(4),'restaurar');
  assert.deepEqual(await individual(),{value:undefined,reserved:true,neighboring:true});
  assert.deepEqual(requests,['saveaip','loadaip','saveaip','loadaip','saveaip','loadaip','saveaip','loadaip']);
  assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,date,overrides:true,recurrenceRestored:true,persistence:true}));
  console.log(JSON.stringify({weekdayMatrices:width,rotationRows:expectedPreview.length,dailyRows:daily.length,measure}));
  console.log(JSON.stringify({width,expected,omitted:expected.slice(1,4),...results,requests}));
  await page.close();
 }}finally{await browser.close();}
}
if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
