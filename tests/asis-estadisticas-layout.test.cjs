const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','auxiliar.html'),'utf8');
const preview=fs.readFileSync(path.join(__dirname,'..','preview-asistencia-pr75.html'),'utf8');
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
test('Offline-only preview mirrors header and footer without touching production API',()=>{
 assert.match(preview,/<header[^>]*>[\s\S]*id="verStats"[^>]*>Estadísticas<\/button>/);
 assert.match(preview,/<footer id="previewDayFooter"/);
 assert.match(preview,/class="day-footer"/);
 assert.match(preview,/id="kpis"/);
 assert.match(preview,/id="statsPanel" hidden/);
 assert.match(preview,/sin conexión|sin conexión/i);
 assert.doesNotMatch(preview,/script\.google\.com|\/macros\/s\/|CLOUD_API_URL|fetch\s*\(/);
});
test('Attendance form displays Fecha Año Bimestre on same row and Nivel Grado Sección on second row',()=>{
 const form=source.slice(source.indexOf('<main id="vistaAsis"'),source.indexOf('    <input type="search" id="inpBuscar"'));
 const first=form.match(/<div class="asis-fila-fecha">([\s\S]*?)<p id="asisEstado"/);
 assert.ok(first,'First compact row');
 const firstIds=['inpFecha','asisAnio','selBimestre'];
 firstIds.forEach(id=>assert.match(first[1],new RegExp('id="'+id+'"')));
 assert.ok(firstIds.every((id,i)=>i===0||first[1].indexOf(firstIds[i-1])<first[1].indexOf(id)));
 const second=form.match(/<div class="asis-fila-aula">([\s\S]*?)$/);
 assert.ok(second,'Second compact row');
 const secondIds=['selNivel','selGrado','selSeccion'];
 secondIds.forEach(id=>assert.match(second[1],new RegExp('id="'+id+'"')));
 assert.ok(secondIds.every((id,i)=>i===0||second[1].indexOf(secondIds[i-1])<second[1].indexOf(id)));
 assert.match(source,/\.asis-fila-fecha\s*\{\s*display:grid;\s*grid-template-columns:minmax\(0,1\.8fr\)/);
 assert.match(source,/\.asis-fila-aula\s*\{\s*display:grid;\s*grid-template-columns:minmax\(0,1\.5fr\)/);
 assert.match(source,/@media \(max-width:440px\)/);
 assert.match(source,/\.asis-field select, \.asis-field input\[type=date\]\s*\{/);
 for(const id of [...firstIds,...secondIds])assert.equal((source.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
});
test('Single QR button stays above roster; upload remains a separate deliberate action',()=>{
 const form=source.slice(source.indexOf('<main id="vistaAsis"'),source.indexOf('<div id="lista"'));
 assert.equal((form.match(/onclick="toggleScan\(\)"/g)||[]).length,1);
 assert.match(form,/Escanear QR/);
 assert.doesNotMatch(form,/Probar lector QR|onclick="toggleScan\(true\)"/);
 assert.match(form,/onclick="subirTodoNube\(\)"/);
 assert.ok(form.indexOf('onclick="toggleScan()"')<form.indexOf('onclick="subirTodoNube()"'));
 assert.match(preview,/>Escanear QR<\/button>/);
 assert.doesNotMatch(preview,/Probar lector QR/);
 assert.doesNotMatch(preview,/getUserMedia|Html5Qrcode/,'Offline preview must remain visual-only');
});
