const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','aula_innovacion.html'),'utf8');

function extract(name){
  const start=html.search(new RegExp('\\n(?:async )?function '+name+'\\('));
  assert.notEqual(start,-1,'Función '+name+' ausente');
  const from=start+1, tail=html.slice(from+10), offset=tail.search(/\n(?:async )?function /), next=offset<0?-1:from+10+offset;
  assert.notEqual(next,-1,'Cierre de '+name+' no delimitado');
  return html.slice(from,next);
}
function make(names,extras={}){
  const control={IEAipPaquete:require('../aip-paquete.js'),IEAipDistribucion:require('../aip-distribucion.js'),exclusionesRondasAip:{},plan:{},feriados:{},ultimoInformeAip:[],renderInformeAip(){},renderEstadisticasAip(){},programacionesColegiado:[],esColegiadoReservado:()=>false,hayColegiadoPendiente:()=>false,revisarColegiadoAntesDeGenerar:()=>true,leerProgramacionesColegiado(){},renderGestorColegiado(){},...extras};
  vm.createContext(control);
  vm.runInContext(['esColegiadoMaterializado','depurarColegiadoMensual',...names].map(extract).join('\n'),control);
  return control;
}
const monday='2026-12-14',tuesday='2026-12-15';
const example=()=>({
  [monday]:{
    pri:{1:{tipo:'gestion',texto:'Semana gestión'},2:{tipo:'soporte',texto:'Soporte'}},
    sec:{1:{tipo:'gestion',texto:'Semana gestión'},2:{tipo:'gestion',texto:'Semana gestión'}}
  },
  [tuesday]:{pri:{1:{tipo:'grupo',texto:'3°'}}}
});
const dates=()=>[new Date(monday+'T12:00:00'),new Date(tuesday+'T12:00:00')];

test('Semana gestión permite pintar cada hora con su propio estado, sin quitar el día completo',()=>{
 const elements={inpMes:{value:'2026-12'},titPri:{},titSec:{},boxPri:{},boxSec:{}};
 const v=make(['esFeriado','esNoLectivoEditable','celda','render'],{
   plan:example(),feriados:{[monday]:'Semana gestión',[tuesday]:'Feriado'},
   document:{getElementById:id=>elements[id]},
   diasMes:dates,ymd:d=>d.toISOString().slice(0,10),DOW:['LUN','MAR','MIE','JUE','VIE'],
   HPRI:()=>[[1,'08:00'],[2,'08:45'],['R','RECREO']],
   HSEC:()=>[[1,'13:00'],[2,'13:45']],
   horasPed:nivel=>nivel==='pri'?[1,2]:[1,2],
   colOk:()=>false,slotActivo:()=>false,
   clsDe:t=>({gestion:'c-ges',soporte:'c-sop',vacaciones:'c-vac'}[t]||'c-gray')
 });
 v.render();
 assert.match(elements.boxPri.innerHTML,/class="c-ges" onclick="clicCelda\('2026-12-14','pri','1'\)">Semana gestión<\/td>/);
 assert.match(elements.boxPri.innerHTML,/class="c-sop" onclick="clicCelda\('2026-12-14','pri','2'\)">Soporte<\/td>/);
 assert.match(elements.boxSec.innerHTML,/clicCelda\('2026-12-14','sec','1'\)/);
 assert.match(elements.boxPri.innerHTML,/class="c-fer" onclick="toggleFeriadoDia\('2026-12-15'\)">Feriado<\/td>/);
});
test('Clic en hora de gestión abre el editor y no cambia la marca de toda la fecha',()=>{
 const feriados={[monday]:'Semana gestión'};
 let opened=[],toggled=0,confirmed=0;
 const v=make(['esFeriado','esNoLectivoEditable','clicCelda'],{
   feriados,modoDefinir:()=>false,
   abrirModal:(...args)=>opened.push(args),
   toggleFeriadoDia:()=>toggled++,
   confirm:()=>{confirmed++;return true;}
 });
 v.clicCelda(monday,'sec',2);
 assert.equal(opened.length,1);
 assert.equal(opened[0].join('|'),'2026-12-14|sec|2');
 assert.equal(toggled,0);
 assert.equal(confirmed,0);
 assert.equal(feriados[monday],'Semana gestión');
});
test('Editar una hora de gestión conserva otras horas y el horario de primaria/secundaria',()=>{
 const plan=example(),feriados={[monday]:'Semana gestión'};
 const els={modTipo:{value:'soporte'},modGrupo:{value:'3A'}};
 const v=make(['esNoLectivoEditable','celda','setCelda','aplicarModal'],{
   plan,feriados,editKey:{fecha:monday,nivel:'sec',hora:1},
   document:{getElementById:id=>els[id]},
   getHS:()=>({}),cerrarModal:()=>{},render:()=>{},
   marcarNoClases:()=>{throw Error('No debe reescribir la semana');}
 });
 v.aplicarModal();
 assert.equal(plan[monday].sec[1].tipo,'soporte');
 assert.equal(plan[monday].sec[2].tipo,'gestion');
 assert.equal(plan[monday].pri[1].tipo,'gestion');
 assert.equal(plan[tuesday].pri[1].texto,'3°');
 assert.equal(feriados[monday],'Semana gestión');
 els.modTipo.value='gestion';v.editKey={fecha:monday,nivel:'sec',hora:1};v.aplicarModal();
 assert.equal(plan[monday].sec[1].tipo,'gestion');
 assert.equal(plan[monday].sec[2].tipo,'gestion');
 els.modTipo.value='vacio';v.aplicarModal();
 assert.equal(plan[monday].sec[1].tipo,'vacio');
 assert.equal(plan[monday].sec[2].tipo,'gestion');
});
test('Armar mes no borra cambios individuales en los días de gestión',()=>{
 const plan=example();
 plan[monday].pri[2]={tipo:'soporte',texto:'Soporte'};
 const v=make(['esFeriado','esNoLectivoEditable','liberarAsignacionesAip','armarPrimariaMes'],{
   plan,feriados:{[monday]:'Semana gestión'},
   document:{getElementById:id=>({value:'2026-12'})},
   diasMes:dates,ymd:d=>d.toISOString().slice(0,10),
   horasPed:()=>[1,2],colOk:()=>false,slotActivo:()=>false,
   setCelda:(f,n,h,o)=>{plan[f]??={};plan[f][n]??={};plan[f][n][h]=o;},
   bloqueCfg:()=> '2',armarSecundariaMes:()=>{},guardar:()=>{},render:()=>{}
 });
 v.liberarAsignacionesAip(dates(),['pri','sec']); v.armarPrimariaMes(dates());
 assert.equal(plan[monday].pri[2].texto,'Soporte');
 assert.equal(plan[monday].sec[1].tipo,'gestion');
});

test('Encabezado de fecha abre menú por nivel sin marcar feriado automáticamente',()=>{
 const out={modTit:{},modSub:{},modTipo:{value:'grupo'},modGrupo:{innerHTML:'',value:'',options:[],appendChild(o){this.options.push(o);}},modal:{classList:{remove(){}}}};
 const v=make(['abrirColumna'],{
   editKey:null,
   document:{getElementById:id=>out[id],createElement:()=>({value:'',textContent:''})},
   horasPed:n=>n==='pri'?[4,5,6]:[1,2,3],
   candidatos:(wd,h)=>h===1?[{seccion:'3A',texto:'3A COM'}]:[{seccion:'3B',texto:'3B COM'}],
   onModTipo:()=>{}
 });
 v.abrirColumna('2026-12-25','sec');
 assert.equal(v.editKey.fecha,'2026-12-25');
 assert.equal(v.editKey.nivel,'sec');
 assert.equal(v.editKey.columna,true);
 assert.equal(out.modTipo.value,'');
 assert.match(out.modSub.textContent,/excepto el recreo/);
 assert.deepEqual(out.modGrupo.options.map(o=>o.value),['3A','3B']);
});

test('Aplicar desde fecha modifica únicamente las horas de esa fecha y nivel, no recreo ni días vecinos',()=>{
 const fecha='2026-12-25';
 const p={
   [fecha]:{pri:{4:{tipo:'gestion',texto:'Semana gestión'},5:{tipo:'gestion',texto:'Semana gestión'}},sec:{1:{tipo:'gestion',texto:'Semana gestión'},2:{tipo:'gestion',texto:'Semana gestión'},R:{tipo:'gestion',texto:'RECREO'}}},
   '2026-12-24':{sec:{1:{tipo:'grupo',texto:'1A'}}}
 };
 const originalPrim=JSON.stringify(p[fecha].pri),other=JSON.stringify(p['2026-12-24']);
 const inputs={modTipo:{value:'soporte'},modGrupo:{value:'3A'}};
 let rendered=0,closed=0;
 const v=make(['celda','setCelda','aplicarColumna'],{
   plan:p,editKey:{fecha,nivel:'sec',columna:true},
   document:{getElementById:id=>inputs[id]},
   horasPed:n=>n==='sec'?[1,2]:[4,5],
   getHS:()=>({}),render:()=>rendered++,cerrarModal:()=>closed++
 });
 v.aplicarColumna();
 for(const h of [1,2]){
   assert.equal(p[fecha].sec[h].tipo,'soporte');
   assert.equal(p[fecha].sec[h].manual,true);
 }
 assert.equal(p[fecha].sec.R.texto,'RECREO');
 assert.equal(JSON.stringify(p[fecha].pri),originalPrim);
 assert.equal(JSON.stringify(p['2026-12-24']),other);
 assert.equal(rendered,1);
 assert.equal(closed,1);
});

test('Asignar grupo por fecha incorpora grupo y docente de cada hora sin afectar el otro nivel',()=>{
 const fecha='2026-12-25';
 const p={[fecha]:{pri:{4:{tipo:'soporte',texto:'Soporte'}},sec:{}}};
 const inputs={modTipo:{value:'grupo'},modGrupo:{value:'3A'}};
 const v=make(['celda','setCelda','aplicarColumna'],{
   plan:p,editKey:{fecha,nivel:'sec',columna:true},
   document:{getElementById:id=>inputs[id]},
   horasPed:n=>n==='sec'?[1,2]:[4,5],
   getHS:()=>({4:{1:{'3A':{area:'COM',doc:'Docente A'}},2:{'3A':{area:'MAT',doc:'Docente B'}}}}),
   render:()=>{},cerrarModal:()=>{}
 });
 v.aplicarColumna();
 assert.equal(p[fecha].sec[1].doc,'Docente A');
 assert.equal(p[fecha].sec[2].doc,'Docente B');
 assert.equal(p[fecha].sec[1].seccion,'3A');
 assert.equal(p[fecha].sec[2].manual,true);
 assert.equal(p[fecha].pri[4].tipo,'soporte');
});

test('Feriado por encabezado es exclusivo de la columna seleccionada y puede visualizarse por nivel',()=>{
 const fecha='2026-12-25',plan={[fecha]:{pri:{4:{tipo:'grupo',texto:'3°'}},sec:{}}};
 const inputs={modTipo:{value:'feriado'},modGrupo:{value:''}};
 const v=make(['celda','setCelda','aplicarColumna'],{
   plan,editKey:{fecha,nivel:'sec',columna:true},
   document:{getElementById:id=>inputs[id]},
   horasPed:n=>n==='sec'?[1,2]:[4,5],
   getHS:()=>({}),render:()=>{},cerrarModal:()=>{}
 });
 v.aplicarColumna();
 assert.equal(plan[fecha].sec[1].tipo,'feriado');
 assert.equal(plan[fecha].sec[2].tipo,'feriado');
 assert.equal(plan[fecha].pri[4].texto,'3°');
});

function recreoFixture(storage=new Map()){
 const elements={inpMes:{value:'2026-12'},selBloque:{value:'2'},modTipo:{value:'soporte'},modGrupo:{value:'3A'},titPri:{},titSec:{},boxPri:{},boxSec:{}};
 const horario={pri:{inicio:'08:00',minBloque:45,nHoras:6,recreoDespues:3,recreoMin:15},sec:{inicio:'13:00',minBloque:45,nHoras:7,recreoDespues:4,recreoMin:30}};
 let cloud=null;const requests=[];
 const v=make(['toMin','fromMin','buildHoras','HPRI','HSEC','horasPed','esFeriado','esNoLectivoEditable','celda','setCelda','clsDe','render','clicCelda','aplicarColumna','aplicarModal','load','guardar','paqueteAip','aplicarPaqueteAip','limpiarMes','tokenSesionAip','subirAipNube','bajarAipNube'],{
  horario,plantilla:{pri:{},sec:{}},colegiado:{pri:{},sec:{}},cursosPorMes:{},KEY:'synthetic-aip-plan',CLOUD_API_URL:'https://synthetic.invalid',
  localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,s)=>storage.set(k,s)},sessionStorage:{getItem:()=>JSON.stringify({token:'synthetic-only'})},
  document:{getElementById:id=>elements[id]},diasMes:dates,ymd:d=>d.toISOString().slice(0,10),DOW:['LUN','MAR','MIE','JUE','VIE'],
  colOk:()=>false,slotActivo:()=>false,modoDefinir:()=>false,getHS:()=>({}),bloqueCfg:()=> '2',
  guardarCfg(){},loadCfg(){},saveHS(){},leerFormHorario(){},pintarFormHorario(){},renderPlantilla(){},renderFeriados(){},renderCursosMes(){},renderEditorHS(){},cerrarModal(){},alert(){},confirm:()=>true,
  abrirModal(){throw Error('R must not open an academic editor');},marcarNoClases(){throw Error('Individual edits must not change the entire period');},
  fetch:async(url,options)=>{const body=JSON.parse(options.body);requests.push(body.action);assert.equal(body.action,'saveaip');cloud=JSON.parse(JSON.stringify(body.payload));return {json:async()=>({ok:true})};},
  fetchLecturaNube:async()=>{requests.push('loadaip');return {json:async()=>({ok:true,payload:JSON.parse(JSON.stringify(cloud))})};}
 });
 const assign=(fecha,nivel,tipo='soporte')=>{v.editKey={fecha,nivel,columna:true};elements.modTipo.value=tipo;v.aplicarColumna();};
 const rest=(fecha,nivel)=>{const h=elements[nivel==='pri'?'boxPri':'boxSec'].innerHTML,needle="clicCelda('"+fecha+"','"+nivel+"','R')";const td=h.split('<td').find(x=>x.includes(needle));return td?td.split('</td>')[0]:null;};
 return {v,elements,storage,requests,assign,rest};
}
for(const nivel of ['pri','sec'])test(nivel+': general assignment hides only its rest, first click restores it, next assignment hides again',()=>{
 const f=recreoFixture(),before=JSON.stringify(f.v.horario);f.v.render();
 assert.match(f.elements.boxPri.innerHTML,/class="c-rec">RECREO/);
 f.assign(monday,nivel);assert.ok(f.rest(monday,nivel),'Empty R remains clickable');assert.doesNotMatch(f.rest(monday,nivel),/RECREO|c-rec|Soporte/);
 assert.match(f.elements[nivel==='pri'?'boxSec':'boxPri'].innerHTML,/class="c-rec">RECREO/);
 f.v.clicCelda(monday,nivel,'R');assert.match(f.rest(monday,nivel),/class="c-rec"/);assert.match(f.rest(monday,nivel),/>RECREO$/);
 const after=JSON.stringify(f.v.plan);f.v.clicCelda(monday,nivel,'R');assert.equal(JSON.stringify(f.v.plan),after,'Visible R is not an academic editor or toggle');
 f.assign(monday,nivel,'man');assert.doesNotMatch(f.rest(monday,nivel),/RECREO|c-rec|Mantenimiento/);
 assert.equal(f.v.plan[monday][nivel].R,undefined);assert.equal(JSON.stringify(f.v.horario),before);assert.deepEqual(f.requests,[]);
});
test('individual academic edits preserve hidden/visible rest and isolate dates and levels, including nonteaching dates',()=>{
 const f=recreoFixture();f.v.feriados[monday]='Semana gestión';f.assign(monday,'pri');f.assign(tuesday,'sec','feriado');
 const before=JSON.stringify(f.v.plan[monday].recreoOculto);f.v.editKey={fecha:monday,nivel:'pri',hora:1};f.elements.modTipo.value='man';f.v.aplicarModal();
 assert.equal(JSON.stringify(f.v.plan[monday].recreoOculto),before);assert.doesNotMatch(f.rest(monday,'pri'),/RECREO/);assert.doesNotMatch(f.rest(tuesday,'sec'),/RECREO/);
 f.v.clicCelda(monday,'pri','R');assert.match(f.rest(monday,'pri'),/>RECREO$/);assert.doesNotMatch(f.rest(tuesday,'sec'),/RECREO/);
 assert.equal(f.v.plan[monday].sec?.R,undefined);assert.equal(f.v.feriados[monday],'Semana gestión');
});
test('rest presentation survives local save/reload and the actual upload/download payload in both states',async()=>{
 const f=recreoFixture();f.assign(monday,'pri');f.assign(tuesday,'sec');f.v.guardar(true);
 const next=recreoFixture(f.storage);next.v.load();next.v.render();assert.doesNotMatch(next.rest(monday,'pri'),/RECREO/);assert.doesNotMatch(next.rest(tuesday,'sec'),/RECREO/);
 next.v.clicCelda(monday,'pri','R');await next.v.subirAipNube();next.v.plan={};await next.v.bajarAipNube();
 assert.match(next.rest(monday,'pri'),/>RECREO$/);assert.doesNotMatch(next.rest(tuesday,'sec'),/RECREO/);
 next.assign(monday,'pri');await next.v.subirAipNube();next.v.plan={};await next.v.bajarAipNube();assert.doesNotMatch(next.rest(monday,'pri'),/RECREO/);
 const restored=recreoFixture(f.storage);restored.v.load();restored.v.render();assert.doesNotMatch(restored.rest(monday,'pri'),/RECREO/);
 assert.deepEqual(next.requests,['saveaip','loadaip','saveaip','loadaip']);
});

test('Limpiar cancels without changes, then deletes only the selected month and is idempotent',()=>{
 const f=recreoFixture();
 const next='2027-01-04',weekend='2026-12-19';
 f.v.plan={...example(),[weekend]:{recreoOculto:{pri:true}},[next]:{sec:{1:{tipo:'soporte'}},recreoOculto:{sec:true}}};
 f.v.feriados={[monday]:'Semana gestión',[weekend]:'Feriado',[next]:'Vacaciones'};
 const before=JSON.stringify([f.v.plan,f.v.feriados]),other=JSON.stringify(f.v.plan[next]);
 f.v.confirm=()=>false;f.v.limpiarMes();
 assert.equal(JSON.stringify([f.v.plan,f.v.feriados]),before);
 assert.equal(f.storage.size,0);
 f.v.confirm=message=>{assert.match(message,/todas las asignaciones.*plantilla semanal vigente/);return true;};
 for(let i=0;i<2;i++){
  f.v.limpiarMes();
  assert.deepEqual(Object.keys(f.v.plan),[next]);
  assert.equal(JSON.stringify(f.v.plan[next]),other);
  assert.deepEqual(Object.keys(f.v.feriados),[next]);
  assert.equal(f.v.feriados[next],'Vacaciones');
  assert.equal(f.storage.get('synthetic-aip-plan'),JSON.stringify(f.v.plan));
 }
 assert.deepEqual(f.requests,[]);
});

test('load and cloud discard obsolete monthly Colegiado cells but keep weekly settings and monthly overrides',()=>{
 const f=recreoFixture();
 const old=example();
 old[monday].pri[3]={tipo:'colegio',manual:true};
 old[monday].sec[3]={tipo:'colegiado'};
 old[monday].recreoOculto={sec:true};
 f.storage.set('synthetic-aip-plan',JSON.stringify(old));
 f.v.load();
 assert.equal(f.v.plan[monday].pri[3],undefined);
 assert.equal(f.v.plan[monday].sec[3],undefined);
 assert.equal(f.v.plan[monday].pri[2].tipo,'soporte');
 assert.equal(f.v.plan[monday].recreoOculto.sec,true);
 f.v.aplicarPaqueteAip({plan:old,colegiado:{pri:{1:[0]},sec:{}}});
 assert.equal(f.v.plan[monday].pri[3],undefined);
 assert.equal(f.v.plan[monday].sec[3],undefined);
 assert.deepEqual(f.v.colegiado.pri[1],[0]);
 assert.deepEqual(f.requests,[]);
});
