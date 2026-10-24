'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','secundaria.html'),'utf8').replace(/\r\n/g,'\n');
const start=src.indexOf('        async function bajarNube() {');
const end=src.indexOf('\n\n\n        // ============================================\n        // TOAST',start);
assert.ok(start>0&&end>start,'Se debe localizar exactamente la función real de descarga');
const download=src.slice(start,end).trim();
function harness(token){
 const calls=[],toasts=[],state={bimestre:'II',grado:'3°',seccion:'A',datos:{},areaActual:null};
 const ctx={window:{__IE_SES:token?{token}:null},CLOUD_API_URL:'https://synthetic.invalid/exec',CLOUD_NIVEL:'secundaria',estado:state,storageDisponible:false,
  confirm:()=>{calls.push('confirm');return true;},mostrarToast:(message,type)=>toasts.push({message,type}),
  fetchLecturaNube:async url=>{calls.push(url);return{text:async()=>JSON.stringify({ok:true,items:[{nivel:'secundaria',bimestre:'II',grado:'3°',seccion:'A',area:'Comunicación',competencias:{'Se comunica oralmente en su lengua materna':{inicio:10,proceso:10,previsto:6,destacado:4}}}]})}},
  syncInputTotalEstudiantes:()=>{},actualizarBotonesSeleccion:()=>{},renderizarSelectoresGrado:()=>{},renderizarAreas:()=>{},renderizarResumen:()=>{},
  periodoSoloLecturaActual:()=>true,console:{error:e=>{throw e;}}
 };
 return {fn:vm.runInNewContext('('+download+')',ctx),calls,toasts,state};
}
test('Secundaria: Nube Bajar con sesión válida carga II cerrado solo para consulta sin falsa excepción',async()=>{
 const h=harness('test-token');await h.fn();
 assert.equal(h.calls.filter(x=>x.includes('loadNivel')).length,1);
 assert.equal(h.state.datos['II|3°|A']['Comunicación']['Se comunica oralmente en su lengua materna'].inicio,10);
 assert.ok(h.toasts.some(x=>x.type==='success'&&x.message.includes('Bimestre cerrado, solo lectura')));
 assert.ok(!h.toasts.some(x=>x.type==='error'));
});
test('Secundaria: Nube Bajar sin sesión impide la consulta',async()=>{
 const h=harness(null);await h.fn();
 assert.equal(h.calls.length,0);
 assert.ok(h.toasts.some(x=>x.type==='error'&&x.message.includes('Inicia sesión')));
});
test('Secundaria: el cierre bloquea subida y edición, pero deja Nube Bajar habilitado',()=>{
 const start=src.indexOf('function aplicarModoPeriodoActual()'),end=src.indexOf("document.addEventListener('DOMContentLoaded'",start);
 assert.ok(start>0&&end>start);
 const block=src.slice(start,end);
 assert.match(block,/\[onclick\^="subirNube"\]/);
 assert.match(block,/\[onclick\^="limpiarTodo"\]/);
 assert.doesNotMatch(block,/\[onclick\^="bajarNube"\]/);
 assert.match(src,/<button onclick="bajarNube\(\)"/);
});
