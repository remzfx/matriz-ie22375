const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','aula_innovacion.html'),'utf8');

function extract(name){
  const start=html.indexOf('\nfunction '+name+'(');
  assert.notEqual(start,-1,'Función '+name+' ausente');
  const from=start+1, next=html.indexOf('\nfunction ',from+10);
  assert.notEqual(next,-1,'Cierre de '+name+' no delimitado');
  return html.slice(from,next);
}
function make(names,extras={}){
  const control={plan:{},feriados:{},...extras};
  vm.createContext(control);
  vm.runInContext(names.map(extract).join('\n'),control);
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
 const v=make(['esFeriado','esNoLectivoEditable','armarMes'],{
   plan,feriados:{[monday]:'Semana gestión'},
   document:{getElementById:id=>({value:'2026-12'})},
   diasMes:dates,ymd:d=>d.toISOString().slice(0,10),
   horasPed:()=>[1,2],colOk:()=>false,slotActivo:()=>false,
   setCelda:(f,n,h,o)=>{plan[f]??={};plan[f][n]??={};plan[f][n][h]=o;},
   bloqueCfg:()=> '2',armarSecundariaMes:()=>{},guardar:()=>{},render:()=>{}
 });
 v.armarMes(true);
 assert.equal(plan[monday].pri[2].texto,'Soporte');
 assert.equal(plan[monday].sec[1].tipo,'gestion');
});
