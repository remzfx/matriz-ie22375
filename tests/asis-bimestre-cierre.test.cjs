const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {studentsFixture}=new Function('require','__dirname',read('tests/backend-students.test.cjs').split("\ntest(")[0]+'\nreturn {studentsFixture};')(require,__dirname);
const sample=(nombre,estado='DEFINITIVA',nivel='secundaria',codigo='SIAGIE-1')=>({
 nivel,grado:1,seccion:nivel==='primaria'?'Única':'A',orden:1,nombre,estadoMatricula:estado,idSiagie:codigo
});
function fixture(extraAlumnos=[]){
 const s=studentsFixture();
 s.c.bimestreAbierto_=()=>true;
 const alumnos=[sample('Synthetic Active'),sample('Synthetic Transferred','TRASLADADO','secundaria','SIAGIE-2'),sample('Synthetic Primary','DEFINITIVA','primaria','SIAGIE-3'),...extraAlumnos];
 const base={primaria:{estudiantes:alumnos.filter(x=>x.nivel==='primaria')},secundaria:{estudiantes:alumnos.filter(x=>x.nivel==='secundaria')}};
 const init=s.post({action:'savestudents',token:s.admin,version:s.init.version,base});
 assert.equal(init.ok,true);
 const roster=s.post({action:'seedstudentsroster',token:s.admin,version:init.version,bimestre:'III'});
 assert.equal(roster.ok,true);
 const config=()=>s.c.obtenerAsistenciaPeriodos_();
 const cfg=bims=>({anio:2026,bimestres:{I:'cerrado',II:'cerrado',III:'abierto',IV:'bloqueado',...bims}});
 const set=(bims,ver=config().ts)=>s.post({action:'saveasisperiodos',token:s.admin,version:ver,periodos:cfg(bims)});
 const item=(nombre='Synthetic Active',opts={})=>({anio:2026,bimestre:'III',fecha:'2026-10-11',
 nivel:'secundaria',grado:1,seccion:'A',nombre,idEstudiante:nombre==='Synthetic Transferred'?'siagie:SIAGIE-2':'siagie:SIAGIE-1',
 marca:'P',hora:'12:45',via:'manual',ts:Date.now()-10000,...opts});
 const save=items=>s.post({action:'saveasis',token:s.admin,items});
 const load=(bimestre='III',anio=2026)=>s.get({action:'loadasis',token:s.admin,anio,bimestre});
 return {s,alumnos,config,set,item,save,load};
}
test('Asistencia is blocked until Administration configures its own periods; grade periods stay untouched',()=>{
 const f=fixture(),periodoNotas=f.s.c.obtenerPeriodosConfig_();
 assert.equal(f.config().configurada,false);
 assert.equal(f.save([f.item()]).code,'PERIOD_CLOSED');
 assert.equal(f.s.tables.has('AsistenciaIngreso'),false);
 assert.equal(f.set({}).ok,true);
 assert.equal(f.config().bimestres.III,'abierto');
 assert.deepEqual(JSON.parse(JSON.stringify(f.s.c.obtenerPeriodosConfig_())),JSON.parse(JSON.stringify(periodoNotas)));
});
test('Bimonthly attendance validates verified roster; transferred students cannot be marked',()=>{
 const f=fixture();assert.equal(f.set({}).ok,true);
 const wrong=f.save([f.item('Synthetic Transferred')]);
 assert.equal(wrong.code,'ROSTER_CONFLICT',JSON.stringify(wrong));assert.equal(f.s.tables.has('AsistenciaIngreso'),false);
 const valid=f.save([f.item()]);
 assert.equal(valid.ok,true,JSON.stringify(valid));
 const current=f.load();
 assert.equal(current.ok,true,JSON.stringify(current));assert.equal(current.protocoloAsistencia,2);
 assert.equal(current.items.length,1);assert.equal(current.items[0].idEstudiante,'siagie:SIAGIE-1');
 assert.equal(current.items[0].bimestre,'III');assert.equal(Number(current.items[0].anio),2026);
});
test('Closing an attendance period atomically freezes history without closing the grade period',()=>{
 const f=fixture();assert.equal(f.set({}).ok,true);
 const save=f.save([f.item()]);assert.equal(save.ok,true,JSON.stringify(save));
 const before=JSON.stringify(f.s.tables.get('AsistenciaIngreso').rows);
 assert.equal(f.set({III:'cerrado'}).ok,true);
 const later=f.save([f.item('Synthetic Active',{marca:'F',versionBase:save.resultados[0].version,ts:Date.now()})]);
 assert.equal(later.code,'PERIOD_CLOSED');
 assert.equal(JSON.stringify(f.s.tables.get('AsistenciaIngreso').rows),before);
 assert.equal(f.load().items[0].marca,'P');
 assert.equal(f.s.c.bimestreAbierto_('III'),true);
});
test('Concurrent configuration edits require current server revision and never clobber closure',()=>{
 const f=fixture(),v=f.config().ts;
 assert.equal(f.set({}).ok,true);
 assert.equal(f.set({III:'cerrado'},v).code,'CONFLICT');
 assert.equal(f.config().bimestres.III,'abierto');
 assert.equal(f.set({III:'cerrado'}).ok,true);
 assert.equal(f.config().bimestres.III,'cerrado');
});
test('Year, bimestre and authorized student must match the scope of every batch',()=>{
 const f=fixture();assert.equal(f.set({}).ok,true);
 for(const opts of [{anio:2025},{bimestre:'IV'},{idEstudiante:'siagie:FORGED'},{fecha:'2025-10-11'},{nombre:'Unknown'}]){
  const res=f.save([f.item('Synthetic Active',opts)]);assert.equal(res.ok,false,JSON.stringify(opts));
 }
 assert.equal(f.s.tables.has('AsistenciaIngreso'),false);
});
test('Reading attendance remains possible after closure and restricts its year and bimestre',()=>{
 const f=fixture();assert.equal(f.set({}).ok,true);
 const first=f.save([f.item()]);assert.equal(first.ok,true,JSON.stringify(first));
 assert.equal(f.set({III:'cerrado'}).ok,true);
 assert.equal(f.load('III',2026).items.length,1);
 assert.equal(f.load('IV',2026).items.length,0);
 assert.equal(f.load('III',2027).items.length,0);
 assert.equal(f.s.post({action:'loadasisperiodos',token:f.s.admin}).periodos.bimestres.III,'cerrado');
});


test('Unmarked students remain unmarked until an explicit, confirmed classroom closure',()=>{
 const {runInNewContext}=require('node:vm'),src=read('auxiliar.html');
 assert.equal(src.includes('function completarFaltasAlSubir('),false,
  'The legacy automatic-absence generator must not be reachable');
 const upload=src.slice(src.indexOf('async function subirTodoNube() {'),src.indexOf('\n}',src.indexOf('async function subirTodoNube() {'))+2);
 assert.ok(upload.includes('pendienteMarcaAsistencia(all[k])'));
 assert.ok(upload.includes('it.marca && it.nombre'));
 assert.doesNotMatch(upload,/auto-falta|completarFaltasAlSubir|setRec\(/);
 const begin=src.indexOf('function cerrarAsistenciaAula() {'),finish=src.indexOf('\n}',begin);
 assert.ok(begin>=0&&finish>begin,'Explicit classroom closure must exist');
 const students=[{nombre:'Synthetic Present'},{nombre:'Synthetic No Mark A'},{nombre:'Synthetic Justified'},{nombre:'Synthetic No Mark B'}];
 const records=new Map([[students[0],{marca:'P'}],[students[2],{marca:'J'}]]);
 const writes=[],dialogs=[],alerts=[],toasts=[];
 let confirmed=false;
 const context={
  asistenciaEscribible:()=>true,ctx:()=>({grado:6,seccion:'A'}),
  alumnosAula:()=>students,getRec:al=>records.get(al)||{marca:''},
  setRec:(al,marca,via)=>{writes.push({al,marca,via});records.set(al,{marca});},
  confirm:message=>{dialogs.push(message);return confirmed;},
  alert:message=>alerts.push(message),renderLista:()=>{},toast:message=>toasts.push(message)
 };
 const fn=src.slice(begin,finish+2);
 runInNewContext(fn+'\ncerrarAsistenciaAula()',context);
 assert.equal(writes.length,0,'Cancel must leave ALL marks unchanged');
 assert.match(dialogs[0],/2 sin marca pasarán a Falta/);
 confirmed=true;
 runInNewContext(fn+'\ncerrarAsistenciaAula()',context);
 assert.equal(writes.length,2,'Only the two unmarked students receive a confirmed F');
 assert.deepEqual(writes.map(x=>x.al.nombre),['Synthetic No Mark A','Synthetic No Mark B']);
 assert.ok(writes.every(x=>x.marca==='F'&&x.via==='cierre'));
 assert.equal(records.get(students[0]).marca,'P');
 assert.equal(records.get(students[2]).marca,'J');
});

test('Legacy archive shows escaped cloud and local-only v1 marks without mixing v2 keys',async()=>{
 const {runInNewContext}=require('node:vm'),src=read('auxiliar.html');
 const getFunction=name=>{
  const start=src.indexOf('function '+name+'(');
  assert.ok(start>=0,name+' missing');
  return src.slice(start,src.indexOf('\n}',start)+2);
 };
 const start=src.indexOf('async function consultarHistorialAnterior() {'),end=src.indexOf('\n}',start)+2;
 assert.ok(start>=0&&end>start);
 const escapeFn=src.match(/^function escapeAuxiliar\(value\).*$/m)?.[0];
 assert.ok(escapeFn);
 const els={
  selNivel:{value:'primaria'},inpFecha:{value:'2026-10-11'},
  asisLegadoEstado:{textContent:''},asisLegadoLista:{innerHTML:''}
 };
 const requests=[],ctx={
  document:{getElementById:id=>els[id]},IEAuxPermissions:{permite:n=>n==='primaria'},
  CLOUD_API_URL:'https://synthetic.invalid',hoyISO:()=> '2026-10-11',
  tokenSesionAuxiliar:()=> 'synthetic-token',rechazarSesionAsistencia:()=>{},
  loadAsis:()=>({
   '2026-10-11||primaria||1||Única||Local Old Student':{marca:'T',hora:'08:11'},
   '2026||III||2026-10-11||primaria||1||Única||siagie:NEW':{marca:'P'}
  }),
  fetchLecturaNube:async url=>{
   requests.push(url);
   return {text:async()=>JSON.stringify({ok:true,protocoloAsistencia:2,historicoAnterior:true,items:[
    {nombre:'<img src=x onerror=alert(1)>',grado:1,seccion:'Única',marca:'P',hora:'08:00'}
   ]})};
  }
 };
 const code=escapeFn+'\n'+getFunction('marcasLocalesArchivoAnterior')+'\n'+
  getFunction('pintarArchivoAnterior')+'\n'+src.slice(start,end)+'\nconsultarHistorialAnterior()';
 const success=await runInNewContext(code,ctx);
 assert.equal(success,true);
 assert.equal(requests.length,1);
 assert.match(requests[0],/historico=1/);
 assert.doesNotMatch(requests[0],/bimestre=/);
 assert.match(els.asisLegadoLista.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(els.asisLegadoLista.innerHTML,/<img/);
 assert.match(els.asisLegadoEstado.textContent,/sin bimestre asignado/);
 assert.match(els.asisLegadoLista.innerHTML,/Local Old Student/);
 assert.doesNotMatch(els.asisLegadoLista.innerHTML,/siagie:NEW/);
 assert.match(els.asisLegadoLista.innerHTML,/Solo en este dispositivo/);
});

test('Daily attendance statistics distinguish P F T J and unregistered without writing',()=>{
 const f=fixture();assert.equal(f.set({}).ok,true);
 const empty=f.s.post({action:'loadasisstats',token:f.s.admin,anio:2026,bimestre:'III',nivel:'secundaria',fecha:'2026-10-11'});
 assert.equal(empty.ok,true,JSON.stringify(empty));assert.equal(empty.totalEstudiantes,1);
 assert.equal(empty.dias[0].sinMarca,1);assert.equal(empty.dias[0].F,0);
 assert.equal(f.save([f.item()]).ok,true);
 const before=f.s.state.writes;
 const day=f.s.post({action:'loadasisstats',token:f.s.admin,anio:2026,bimestre:'III',nivel:'secundaria',fecha:'2026-10-11'});
 assert.equal(day.ok,true,JSON.stringify(day));assert.equal(day.origen,'nube');
 assert.equal(day.dias[0].P,1);assert.equal(day.dias[0].sinMarca,0);
 assert.equal(f.s.state.writes,before,'aggregate statistics must not write');
 assert.equal(f.set({III:'cerrado'}).ok,true);
 assert.equal(f.s.post({action:'loadasisstats',token:f.s.admin,anio:2026,bimestre:'III',nivel:'secundaria',fecha:'2026-10-11'}).dias[0].P,1,'closed bimestre still readable');
});
test('Monthly attendance matches a synthetic 257-student reference and excludes transfers',()=>{
 const nuevos=Array.from({length:256},(_,i)=>sample('Synthetic Stats '+i,'DEFINITIVA','secundaria','STATS-'+i));
 const f=fixture(nuevos);assert.equal(f.set({}).ok,true);
 const estudiantes=[f.alumnos[0],...nuevos];
 assert.equal(estudiantes.length,257);
 const marcas=[[11,250,3,4],[12,230,20,7],[13,230,14,13]];
 marcas.forEach(([dd,P,F,T])=>{
  const items=estudiantes.map((al,i)=>f.item(al.nombre,{
   idEstudiante:'siagie:'+al.idSiagie,
   fecha:'2026-10-'+String(dd).padStart(2,'0'),
   marca:i<P?'P':i<P+F?'F':'T'
  }));
  const saved=f.save(items);
  assert.equal(saved.ok,true,JSON.stringify(saved).slice(0,300));
 });
 const before=f.s.state.writes,month=f.s.post({
  action:'loadasisstats',token:f.s.admin,anio:2026,bimestre:'III',nivel:'secundaria',mes:'2026-10'
 });
 assert.equal(month.ok,true,JSON.stringify(month).slice(0,300));
 assert.equal(month.totalEstudiantes,257);
 assert.equal(month.dias.length,3);
 assert.deepEqual(month.dias.map(d=>[d.fecha.slice(-2),d.P,d.F,d.T,d.J,d.sinMarca]),[
  ['11',250,3,4,0,0],['12',230,20,7,0,0],['13',230,14,13,0,0]
 ]);
 assert.equal(f.s.state.writes,before,'statistical history must not write');
 assert.equal(month.diasDelMes,31);
 const other=f.s.post({action:'loadasisstats',token:f.s.admin,anio:2026,bimestre:'III',nivel:'primaria',mes:'2026-10'});
 assert.equal(other.totalEstudiantes,1);assert.equal(other.dias.length,0);
});
test('Monthly counts report missing records and reject invalid/unscoped reads',()=>{
 const f=fixture([sample('Synthetic Second','DEFINITIVA','secundaria','SIAGIE-SECOND')]);
 assert.equal(f.set({}).ok,true);
 assert.equal(f.save([f.item()]).ok,true);
 const request=p=>f.s.post({action:'loadasisstats',token:f.s.admin,anio:2026,bimestre:'III',nivel:'secundaria',...p});
 const month=request({mes:'2026-10'});assert.equal(month.totalEstudiantes,2);
 assert.equal(month.dias[0].P,1);assert.equal(month.dias[0].sinMarca,1);
 assert.equal(month.dias[0].F,0);
 assert.equal(request({mes:'2026-13'}).code,'INVALID_PERIOD');
 assert.equal(request({fecha:'2026-02-30'}).code,'INVALID_PERIOD');
 assert.equal(request({mes:'2026-10',fecha:'2026-10-11'}).code,'INVALID_PERIOD');
 assert.equal(request({mes:'2025-10'}).code,'INVALID_PERIOD');
 assert.equal(request({fecha:'2026-10-11',nivel:'otro'}).code,'SCOPE');
 assert.equal(f.s.post({action:'loadasisstats',token:f.s.primary,anio:2026,bimestre:'III',nivel:'secundaria',mes:'2026-10'}).ok,false);
 const before=f.s.state.writes,sh=f.s.tables.get('AsistenciaIngreso');
 const duplicated=[...sh.rows[1]];sh.rows.push(duplicated);
 const duplicatedResult=request({fecha:'2026-10-11'});
 assert.equal(duplicatedResult.dias[0].duplicados,1);
 assert.equal(duplicatedResult.dias[0].P,0);
 assert.equal(duplicatedResult.dias[0].sinMarca,2,'ambiguous duplicate cannot be counted');
 assert.equal(f.s.state.writes,before,'duplicate detection must not mutate the sheet');
});
