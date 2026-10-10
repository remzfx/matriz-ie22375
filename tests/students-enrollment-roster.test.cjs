const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8'),clone=x=>JSON.parse(JSON.stringify(x));
const {studentsFixture}=new Function('require','__dirname',read('tests/backend-students.test.cjs').split("test('loadstudents uses canonical")[0]+'\nreturn {studentsFixture};')(require,__dirname);
const {fixture}=new Function('require','__dirname',read('tests/students-client.test.cjs').split('function checkRequest')[0]+'\nreturn {fixture};')(require,__dirname);
const {fixture:management}=new Function('require','__dirname',read('tests/students-rollout.test.cjs').split('\nconst file=')[0]+'\nreturn {fixture};')(require,__dirname);
const alumnos=()=>Array.from({length:265},(_,i)=>({nivel:'secundaria',grado:1,seccion:'A',orden:i+1,nombre:'Synthetic Student '+i,idSiagie:'synthetic-id-'+i,codigoEstudiante:'synthetic-code-'+i,estadoMatricula:i<257?'DEFINITIVA':'TRASLADADO'}));
function opened(s){s.c.bimestreAbierto_=b=>['I','III'].includes(b);}
test('SIAGIE sync keeps 265/257/8 in base, filters only III and preserves frozen students and all history',()=>{
 const s=studentsFixture();opened(s);
 const todos=alumnos(),anterior=todos.map(a=>({...a,estadoMatricula:'DEFINITIVA'}));
 const init=s.post({action:'savestudents',token:s.admin,version:s.init.version,base:{primaria:{estudiantes:[]},secundaria:{estudiantes:anterior}}});
 assert.equal(init.ok,true);
 const seeded=s.post({action:'seedstudentsroster',token:s.admin,version:init.version,bimestre:'I'});assert.equal(seeded.estudiantes.length,265);
 const antesI=clone(s.load(s.admin,{bimestre:'I'}));
 s.c.bimestreAbierto_=b=>b==='III';
 s.tables.get('RegistroNotas').rows.push(['synthetic-history','secundaria','I',1,'A','Math','Synthetic',1,JSON.stringify({grades:{'id:synthetic-id-264':{valor:15}},concComp:{historic:'preserve'},asistencia:{historic:'P'}})]);
 s.sheet('Asistencia',[['header'],['synthetic-attendance','preserve']]);
 s.sheet('Transversales',[['header'],['synthetic-snapshot','preserve']]);
 const history=()=>JSON.stringify([...s.tables].filter(([k])=>k!=='EstudiantesBase').map(([k,v])=>[k,v.rows]));
 const antes=history();
 const res=s.post({action:'syncstudents',token:s.admin,version:init.version,bimestre:'III',base:{primaria:{estudiantes:[]},secundaria:{estudiantes:todos}}});
 assert.equal(res.ok,true);assert.equal(res.estudiantes.length,265);assert.equal(res.padron.estudiantes.length,257);
 assert.notEqual(res.version,res.padron.version);assert.equal(res.fuentePadron,'actual');
 assert.equal(s.load(s.admin).estudiantes.filter(a=>a.estadoMatricula==='TRASLADADO').length,8);
 const frozen=s.load(s.admin,{bimestre:'I'});assert.equal(frozen.version,antesI.version);assert.deepEqual(frozen.estudiantes,antesI.estudiantes);
 const actual=s.load(s.admin),roster=s.load(s.admin,{bimestre:'III'});
 assert.deepEqual(actual.estudiantes,todos);assert.deepEqual(roster.estudiantes,todos.slice(0,257));
 assert.equal(s.load(s.secondary,{bimestre:'III'}).estudiantes.length,257);
 assert.equal(history(),antes);
 const writes=s.state.writes;
 assert.equal(s.post({action:'syncstudents',token:s.admin,version:res.version,bimestre:'I',base:s.base}).code,'PERIOD_CLOSED');
 assert.equal(s.post({action:'seedstudentsroster',token:s.admin,version:res.version,bimestre:'II'}).code,'PERIOD_CLOSED');
 assert.equal(s.state.writes,writes);
 const existing=s.post({action:'seedstudentsroster',token:s.admin,version:res.version,bimestre:'I'});
 assert.equal(existing.version,antesI.version);assert.equal(s.state.writes,writes);
});
test('New seeded open roster filters transferred students without changing the complete base version',()=>{
 const s=studentsFixture();opened(s);const saved=s.post({action:'savestudents',token:s.admin,version:s.init.version,base:{primaria:{estudiantes:[]},secundaria:{estudiantes:alumnos()}}});
 const res=s.post({action:'seedstudentsroster',token:s.admin,version:saved.version,bimestre:'III'});
 assert.equal(res.ok,true);assert.equal(res.estudiantes.length,257);assert.equal(s.load(s.admin).version,saved.version);assert.equal(s.load(s.admin).estudiantes.length,265);
});
for(const estado of ['','PREMATRICULA','__proto__'])test('Unknown enrollment '+JSON.stringify(estado)+' requires review before sync or seed and never writes',()=>{
 const s=studentsFixture();opened(s);const list=alumnos();list[0].estadoMatricula=estado;
 const base={primaria:{estudiantes:[]},secundaria:{estudiantes:list}};
 let before=s.state.writes;
 const rejected=s.post({action:'syncstudents',token:s.admin,version:s.init.version,bimestre:'III',base});
 assert.equal(rejected.ok,false);assert.match(rejected.error,/Revisa los estados/);assert.equal(s.state.writes,before);
 const saved=s.post({action:'savestudents',token:s.admin,version:s.init.version,base});before=s.state.writes;
 const seeded=s.post({action:'seedstudentsroster',token:s.admin,version:saved.version,bimestre:'III'});
 assert.equal(seeded.ok,false);assert.match(seeded.error,/Revisa los estados/);assert.equal(s.state.writes,before);
 assert.equal(s.load(s.admin).estudiantes.length,265);
});
test('Client sync caches the complete base and filtered roster separately, preserving other bimestres',async()=>{
 const s=fixture(),list=alumnos();
 const response=(items,version,bimestre='')=>({ok:true,inicializada:true,padronInicializado:true,bimestre,version,estudiantes:items,fuentePadron:bimestre?'bimestre':'actual'});
 s.c.fetch=async(_,opts)=>{const body=JSON.parse(opts.body);return {ok:true,json:async()=>body.action==='syncstudents'?{...response(list,'base-new'),padron:response(list.slice(0,257),'roster-new','III')}:response(list,'history-'+body.bimestre,body.bimestre)};};
 await s.c.IEStudents.loadRoster('I');await s.c.IEStudents.loadRoster('III');
 const result=await s.c.IEStudents.sync({primaria:{estudiantes:[]},secundaria:{estudiantes:list}},'old','III');
 assert.equal(result.secundaria.estudiantes.length,265);assert.equal(s.c.IEStudents.peek().version,'base-new');
 assert.equal(s.c.IEStudents.peekRoster('III').secundaria.estudiantes.length,257);assert.equal(s.c.IEStudents.peekRoster('III').version,'roster-new');
 assert.equal(s.c.IEStudents.peekRoster('I').secundaria.estudiantes.length,265);
});
test('Admin displays dynamic imported/active/transferred counts and blocks unknown CSV states',async()=>{
 const s=management(),list=alumnos();s.window.parseCSV=()=>clone(list);
 const file={files:[{text:async()=> 'NumeroDeOrden;ApellidoPaterno;EstadoMatricula\nsynthetic'}]};
 await s.api.importar(file,'secundaria');
 assert.match(s.el('gestionMatricula').textContent,/265 importados · 257 vigentes · 8 trasladados/);
 assert.deepEqual(clone(s.api.resumenMatricula(list)),{total:265,vigentes:257,trasladados:8,otros:0});
 const other=list.map(a=>({...a,estadoMatricula:'PENDIENTE'}));s.window.parseCSV=()=>other.map(a=>({...a,nivel:'primaria'}));await s.api.importar(file,'primaria');
 s.el('migracionBimestre').value='III';s.el('migracionRevisada').checked=true;
 s.c.IEStudents.inspect=async()=>({inicializada:true,version:'v',primaria:{estudiantes:[]},secundaria:{estudiantes:list}});
 let writes=0;s.c.IEStudents.sync=async()=>{writes++;};await s.api.sincronizarPadron();
 assert.equal(writes,0);assert.match(s.el('migracionEstado').textContent,/Revisa los estados/);
});
test('Academic consumers keep their selected-bimestre roster source rather than the complete global base',()=>{
 const reg=read('registro.html'),admin=read('admin.html'),backend=read('apps-script/Codigo.js');
 assert.match(reg,/IEStudents.loadRoster\(bimestre\)/);
 assert.match(admin,/IEStudents.loadRoster\(bim\)/);
 assert.match(backend,/leerPadronEstudiantes_\(sh,ctx.bimestre\)/);
 for(const module of ['primaria.html','secundaria.html'])assert.match(read(module),/bimestre \? IEStudents.loadRoster\(bimestre\)/);
 for(const tab of ['Calificar','Promedios','Resumen','Asistencia'])assert.ok(reg.includes(tab));
});

test('Late old roster response cannot replace the verified filtered cache after sync',async()=>{
 const s=fixture(),list=alumnos();let resolve;
 const roster={ok:true,inicializada:true,padronInicializado:true,bimestre:'III',version:'new-roster',estudiantes:list.slice(0,257)};
 s.c.fetch=async(_,options)=>{const action=JSON.parse(options.body).action;return {ok:true,json:()=>action==='loadstudents'?new Promise(r=>resolve=r):Promise.resolve({ok:true,inicializada:true,version:'new-base',estudiantes:list,padron:roster})};};
 const pending=s.c.IEStudents.loadRoster('III');await Promise.resolve();await Promise.resolve();
 await s.c.IEStudents.sync({},'old','III');
 resolve({...roster,version:'old-roster',estudiantes:list});
 const late=await pending;assert.equal(late.version,'new-roster');assert.equal(late.secundaria.estudiantes.length,257);
 assert.equal(s.c.IEStudents.peekRoster('III').version,'new-roster');assert.equal(s.c.IEStudents.peek().secundaria.estudiantes.length,265);
});
test('All-transferred CSV leaves a complete base and a valid empty academic roster',()=>{
 const s=studentsFixture();opened(s);const list=alumnos().map(a=>({...a,estadoMatricula:'TRASLADADO'}));
 const r=s.post({action:'syncstudents',token:s.admin,version:s.init.version,bimestre:'III',base:{primaria:{estudiantes:[]},secundaria:{estudiantes:list}}});
 assert.equal(r.ok,true);assert.equal(s.load(s.admin).estudiantes.length,265);assert.equal(s.load(s.admin,{bimestre:'III'}).estudiantes.length,0);
});
