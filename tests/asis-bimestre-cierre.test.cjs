const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const {studentsFixture}=new Function('require','__dirname',read('tests/backend-students.test.cjs').split("\ntest(")[0]+'\nreturn {studentsFixture};')(require,__dirname);
const sample=(nombre,estado='DEFINITIVA',nivel='secundaria',codigo='SIAGIE-1')=>({
 nivel,grado:1,seccion:nivel==='primaria'?'Única':'A',orden:1,nombre,estadoMatricula:estado,idSiagie:codigo
});
function fixture(){
 const s=studentsFixture();
 s.c.bimestreAbierto_=()=>true;
 const alumnos=[sample('Synthetic Active'),sample('Synthetic Transferred','TRASLADADO','secundaria','SIAGIE-2'),sample('Synthetic Primary','DEFINITIVA','primaria','SIAGIE-3')];
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


test('Auto-completed absences preserve the name required by attendance protocol v2',()=>{
 const {runInNewContext}=require('node:vm');
 const src=read('auxiliar.html');
 const start=src.indexOf('function completarFaltasAlSubir() {');
 const end=src.indexOf('\n}',start)+2;
 assert.ok(start>=0&&end>start,'Automatic absence function must exist');
 const key='2026||III||2026-10-11||secundaria||1||A||siagie:AUTOMATIC-1';
 const stored={};
 const state={
  document:{getElementById:()=>({value:'2026-10-11'})},
  hoyISO:()=> '2026-10-11',asistenciaEscribible:()=>true,
  loadAsis:()=>stored,saveAsis:()=>{},
  todosAlumnos:()=>[{nombre:'Synthetic Automatic Student',nivel:'secundaria'}],
  jornadaCerrada:()=>true,asisKey:()=>key,horaAhora:()=> '13:00'
 };
 const result=runInNewContext(src.slice(start,end)+'\ncompletarFaltasAlSubir()',state);
 assert.equal(result,1);
 assert.equal(stored[key].marca,'F');
 assert.equal(stored[key].nombre,'Synthetic Automatic Student');
});
