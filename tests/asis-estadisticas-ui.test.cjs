const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','auxiliar.html'),'utf8');
function fn(name) {
 const i=source.indexOf((name==='actualizarEstadisticaDia'?'async ':'')+'function '+name+'(');
 assert.ok(i>=0,'Missing function '+name);
 const end=source.indexOf('\n}',i);
 assert.ok(end>i,'Missing end '+name);
 return source.slice(i,end+2);
}
const esc=source.match(/^function escapeAuxiliar\(value\).*$/m)?.[0];
test('Monthly stacked chart reproduces 257-student example without mixing lateness and absence',()=>{
 const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:''});return nodes.get(id);};
 const context={document:{getElementById:get}};
 const code=esc+'\n'+fn('pintarMesAsistencia')+'\n'+
 'pintarMesAsistencia({nivel:"secundaria",anio:2026,bimestre:"III",mes:"2026-10",totalEstudiantes:257,dias:['+
 '[11,250,3,4],[12,230,20,7],[13,230,14,13]'+
 '].map(([d,P,F,T])=>({fecha:"2026-10-"+d,P,F,T,J:0,sinMarca:0}))})';
 vm.runInNewContext(code,context);
 assert.match(get('asisStatsInfo').textContent,/257 estudiantes/);
 assert.match(get('asisStatsInfo').textContent,/OCTUBRE 2026/);
 assert.equal((get('asisStatsGrafico').innerHTML.match(/asis-chart-col/g)||[]).length,3);
 assert.equal((get('asisStatsTabla').innerHTML.match(/<tr class="border-b">/g)||[]).length,3);
 assert.match(get('asisStatsTabla').innerHTML,/250/);
 assert.match(get('asisStatsTabla').innerHTML,/230/);
 assert.match(get('asisStatsLeyenda').innerHTML,/Tardanzas/);
 assert.match(get('asisStatsLeyenda').innerHTML,/Faltas/);
 assert.match(get('asisStatsGrafico').innerHTML,/asis-T/);
 assert.match(get('asisStatsGrafico').innerHTML,/asis-F/);
});
test('Stacked bar rejects contradictory totals and displays unregistered people separately',()=>{
 const els={asisStatsInfo:{textContent:''},asisStatsLeyenda:{innerHTML:''},
  asisStatsGrafico:{innerHTML:''},asisStatsTabla:{innerHTML:''}};
 const ctx={document:{getElementById:id=>els[id]}};
 const compile=esc+'\n'+fn('pintarMesAsistencia');
 vm.runInNewContext(compile,ctx);
 assert.throws(()=>vm.runInNewContext('pintarMesAsistencia({nivel:"primaria",anio:2026,bimestre:"III",mes:"2026-10",totalEstudiantes:10,dias:[{fecha:"2026-10-11",P:9,F:2,T:0,J:0,sinMarca:0}]})',ctx),/no corresponden al padrón/);
 vm.runInNewContext('pintarMesAsistencia({nivel:"primaria",anio:2026,bimestre:"III",mes:"2026-10",totalEstudiantes:10,dias:[{fecha:"2026-10-11",P:6,F:1,T:1,J:0,sinMarca:2}]})',ctx);
 assert.match(els.asisStatsGrafico.innerHTML,/asis-S/);
 assert.match(els.asisStatsTabla.innerHTML,/>2<\/td>/);
});
test('Daily statistics query is authenticated, scoped and displays only confirmed cloud totals',async()=>{
 const els=new Map(),el=id=>{if(!els.has(id))els.set(id,{value:'',textContent:'',innerHTML:''});return els.get(id);};
 el('selNivel').value='secundaria';el('selBimestre').value='III';
 el('inpFecha').value='2026-10-11';
 const requested=[],c=vm.createContext({document:{getElementById:el},encodeURIComponent,
  CLOUD_API_URL:'https://synthetic.invalid',
  IEAuxPermissions:{permite:n=>n==='secundaria'},
  bimestreAsistencia:()=> 'III',anioAsistencia:()=>2026,tokenSesionAuxiliar:()=> 'synthetic-token',
  hoyISO:()=> '2026-10-11',
  fetchLecturaNube:async url=>{requested.push(url);return{text:async()=>JSON.stringify({
   ok:true,protocoloAsistencia:2,origen:'nube',nivel:'secundaria',bimestre:'III',fecha:'2026-10-11',
   totalEstudiantes:257,dias:[{fecha:'2026-10-11',P:250,F:3,T:4,J:0,sinMarca:0,registrados:257,duplicados:0}]
  })};}});
 vm.runInContext('let estadisticaDiaSerial=0;\n'+fn('estadisticaParams')+'\n'+fn('kpiAsistencia')+'\n'+fn('actualizarEstadisticaDia'),c);
 assert.equal(await vm.runInContext('actualizarEstadisticaDia()',c),true);
 assert.equal(requested.length,1);
 assert.match(requested[0],/action=loadasisstats/);
 assert.match(requested[0],/nivel=secundaria/);
 assert.match(requested[0],/bimestre=III/);
 assert.match(requested[0],/fecha=2026-10-11/);
 assert.match(el('asisDiaDetalle').textContent,/Padrón: 257 estudiantes/);
 assert.match(el('asisDiaKPIs').innerHTML,/250/);
 assert.match(el('asisDiaKPIs').innerHTML,/Tardanzas/);
 assert.match(el('asisDiaEstado').textContent,/confirmadas en la nube/);
 el('selNivel').value='otro';
 assert.equal(await vm.runInContext('actualizarEstadisticaDia()',c),false);
 assert.equal(requested.length,1);
});
