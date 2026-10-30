const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','auxiliar.html'),'utf8');
function getFunction(name){
 const i=source.indexOf('function '+name+'(');
 assert.ok(i>=0,'Missing '+name);
 const end=source.indexOf('\n}',i);
 assert.ok(end>i);
 return source.slice(i,end+2);
}
test('Monthly statistics button is in the sticky header next to Inicio, not inside the form',()=>{
 const header=source.slice(source.indexOf('<header '),source.indexOf('</header>')+9);
 const attendance=source.slice(source.indexOf('<main id="vistaAsis"'),source.indexOf('</main>')+7);
 assert.match(header,/id="asisStatsBoton"[^>]*class="btn btn-estadisticas-header"/);
 assert.match(header,/onclick="verEstadisticasAsistencia\(\)"/);
 assert.ok(header.indexOf('asisStatsBoton')<header.indexOf('href="index.html"'));
 assert.doesNotMatch(attendance,/id="asisStatsBoton"/);
 assert.match(attendance,/id="asisStatsPanel"[^>]*hidden/);
});
test('Daily confirmed-cloud KPIs are in the fixed footer, not covering the main list',()=>{
 const attendance=source.slice(source.indexOf('<main id="vistaAsis"'),source.indexOf('</main>')+7);
 const footer=source.slice(source.indexOf('<footer id="asisResumenDiario"'),source.indexOf('</footer>')+9);
 assert.doesNotMatch(attendance,/id="asisResumenDiario"/);
 assert.doesNotMatch(attendance,/id="asisDiaKPIs"/);
 for(const id of ['asisDiaDetalle','asisDiaKPIs','asisDiaEstado'])assert.match(footer,new RegExp('id="'+id+'"'));
 assert.match(source,/\.asis-day-footer\s*\{\s*position:fixed;\s*bottom:0;/);
 assert.match(source,/#vistaAsis\s*\{\s*padding-bottom:calc\(/);
 assert.match(source,/env\(safe-area-inset-bottom/);
 assert.match(footer,/Actualizar/);
 assert.equal((source.match(/id="asisDiaKPIs"/g)||[]).length,1);
 assert.equal((source.match(/id="asisStatsBoton"/g)||[]).length,1);
});
test('Footer and statistics button hide on mass messaging and reappear in attendance view',()=>{
 const els=new Map(),shown=new Map();
 const get=id=>{
  if(!els.has(id))els.set(id,{
   hidden:false,value:'',
   classList:{toggle(c,v){shown.set(id+'-'+c,v)}},
   textContent:'',className:''
  });
  return els.get(id);
 };
 get('inpFecha').value='2026-10-11';
 let massCalls=0;
 const ctx={document:{getElementById:get},hoyISO:()=> '2026-10-11',
  enviarGruposHoy:()=>{massCalls++}};
 vm.runInNewContext(getFunction('verMenu')+'\nverMenu("grupos")',ctx);
 assert.equal(get('asisResumenDiario').hidden,true);
 assert.equal(get('asisStatsBoton').hidden,true);
 assert.equal(get('tituloModulo').textContent,'Envío masivo');
 assert.equal(massCalls,1);
 vm.runInNewContext('verMenu("asis")',ctx);
 assert.equal(get('asisResumenDiario').hidden,false);
 assert.equal(get('asisStatsBoton').hidden,false);
 assert.equal(get('tituloModulo').textContent,'Asistencia de ingreso');
});
test('Header button opens monthly panel, scrolls it into view and can close it',()=>{
 const els=new Map();let scroll=0,loads=0;
 const get=id=>{
  if(!els.has(id))els.set(id,{hidden:id==='asisStatsPanel',value:'',
   setAttribute(name,value){this[name]=value},
   scrollIntoView(){scroll++}});
  return els.get(id);
 };
 get('inpFecha').value='2026-10-11';
 const ctx={document:{getElementById:get},hoyISO:()=> '2026-10-11',
  cargarEstadisticasMensuales:()=>{loads++},estadisticaMesSerial:0};
 vm.runInNewContext(getFunction('verEstadisticasAsistencia')+'\nverEstadisticasAsistencia()',ctx);
 assert.equal(get('asisStatsPanel').hidden,false);
 assert.equal(get('asisStatsBoton')['aria-expanded'],'true');
 assert.equal(get('asisStatsMes').value,'2026-10');
 assert.equal(scroll,1);assert.equal(loads,1);
 vm.runInNewContext('verEstadisticasAsistencia()',ctx);
 assert.equal(get('asisStatsPanel').hidden,true);
 assert.equal(get('asisStatsBoton')['aria-expanded'],'false');
 assert.equal(loads,1);
});
test('Attendance selection keeps six fields in one desktop grid and wraps on mobile',()=>{
 const form=source.slice(source.indexOf('<div id="asisSeccionPanel"'),source.indexOf('<p id="asisEstado"'));
 const ids=['inpFecha','asisAnio','selBimestre','selNivel','selGrado','selSeccion'];
 ids.forEach((id,i)=>{assert.equal((form.match(new RegExp('id="'+id+'"','g'))||[]).length,1);if(i)assert.ok(form.indexOf(ids[i-1])<form.indexOf(id));});
 assert.match(source,/\.asis-context-grid \{ display:grid; grid-template-columns:minmax\(0,1.6fr\)/);
 assert.match(source,/@media \(max-width:640px\).*asis-context-grid.*repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(source,/\.asis-context-grid\[hidden\] \{ display:none/);
});

test('Single QR button stays above roster; upload remains a separate deliberate action',()=>{
 const form=source.slice(source.indexOf('<main id="vistaAsis"'),source.indexOf('<div id="lista"'));
 assert.equal((form.match(/onclick="toggleScan\(\)"/g)||[]).length,1);
 assert.match(form,/Escanear QR/);
 assert.doesNotMatch(form,/Probar lector QR|onclick="toggleScan\(true\)"/);
 assert.match(source.slice(source.indexOf('<footer id="asisResumenDiario"')),/onclick="subirTodoNube\(\)"/);
 assert.ok(source.indexOf('onclick="toggleScan()"')<source.indexOf('onclick="subirTodoNube()"'));
});
