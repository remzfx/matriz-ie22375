// Read-only incident reproduction. Reuse production adapters and synthetic fixtures;
// never open a browser profile, institutional endpoint or real storage.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixtureFrom(file){const src=fs.readFileSync(file,'utf8').split("\ntest(")[0];return new Function('require','__dirname',src+'\nreturn fixture;')(require,__dirname);}
const rosterFixture=fixtureFrom('tests/registro-roster-identity.test.cjs');
const adapterFixture=fixtureFrom('tests/notas2-ui.test.cjs');
const localStore=require('../registro-local-store.js');
function setup(failure){
 const r=rosterFixture(),a=adapterFixture(),disk=new Map(),operations=[];
 const storage={getItem(k){operations.push('read');if(failure==='read')throw Object.assign(Error('Synthetic access denied'),{name:'SecurityError'});return disk.get(k)??null;},setItem(k,v){operations.push('write');if(failure==='quota')throw Object.assign(Error('Synthetic quota exceeded'),{name:'QuotaExceededError'});disk.set(k,v);}};
 const session=()=>({role:'docente',user:'synthetic-teacher'});
 const key=localStore.create(storage,session).key;
 disk.set(key,failure==='json'?'{synthetic-invalid':JSON.stringify({asistencia:{},grades:{original:{nivel:'A'}}}));
 const local=localStore.create(storage,session);a.g.registroLocal=local;a.g.store=r.run('store');
 if(failure==='concurrent')disk.set(key,JSON.stringify({asistencia:{},grades:{other:{nivel:'B'}}}));
 if(failure==='quota')a.g.store.asistencia={synthetic:{marca:'P'}};
 let original; r.c.saveStore=()=>{try{a.api.persist();}catch(e){original=e;throw e;}};
 return {r,a,disk,key,operations,original:()=>original};
}
test('I/II/III/I rosters reuse the account store without multiplying persistent academic records',()=>{
 const f=setup(),before=f.disk.get(f.key);
 for(const bim of ['I','II','III','I']){
  f.r.el('selBim').value=bim;
  f.r.c.pintarPadronInmediato(f.r.roster([{idSiagie:'synthetic-'+bim,nombre:'FICTICIO '+bim,grado:4,seccion:'B'}],bim),bim,true);
  assert.equal(f.r.run('bdEstudiantes.bimestre'),bim);
 }
 assert.equal(f.disk.get(f.key),before);assert.equal(f.operations.includes('write'),false);
 assert.equal(f.a.requests.length,0);assert.equal(f.r.requests.length,0);
 assert.equal(f.r.run('Object.keys(store.studentAliases["secundaria||4||B"]).length'),3);
});
for(const [failure,name,message]of [['read','SecurityError',/access denied/],['json','Error',/interpretar el almacenamiento/],['concurrent','Error',/Otra pestaña/],['quota','QuotaExceededError',/quota exceeded/]]){
 test('saveStore failure '+failure+' is classified separately; students remain in memory',()=>{
  const f=setup(failure),before=f.disk.get(f.key),memory=f.r.run('store');
  memory.grades.synthetic={nivel:'C',origen:'letra'};
  for(const bim of ['I','III']){
   f.r.el('selBim').value=bim;
   assert.throws(()=>f.r.c.pintarPadronInmediato(f.r.roster([{idSiagie:'synthetic',nombre:'FICTICIO',grado:4,seccion:'B'}],bim),bim,true),e=>e.code==='LOCAL_STORAGE'&&e.operacion==='saveStore'&&e.tipo===name&&/saveStore/.test(e.message));
   assert.equal(f.original().name,name);assert.match(f.original().message,message);
   assert.equal(f.r.run('estudiantes().length'),1);assert.equal(memory.grades.synthetic.nivel,'C');
  }
  assert.equal(f.disk.get(f.key),before);assert.equal(f.a.requests.length,0);assert.equal(f.r.requests.length,0);
 });
}
test('VS Code and published origins have independent storage even for the same account',()=>{
 const maps=[new Map(),new Map()],session=()=>({role:'docente',user:'synthetic'});
 const stores=maps.map(m=>localStore.create({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)},session));
 stores[0].write('{"asistencia":{"synthetic":"P"}}');
 assert.equal(stores[1].read(),null);assert.equal(stores[0].key,stores[1].key);
 assert.equal(stores[0].read(),'{"asistencia":{"synthetic":"P"}}');
});
for(const bim of ['I','III']) {
 test(bim+': valid aliases retain originals and academic drafts while completing the roster capture',()=>{
  const f=setup(),memory=f.r.run('store'),beforeDisk=f.disk.get(f.key);
  memory.studentAliases={'secundaria||4||B':{'id:synthetic':['FICTICIO ANTERIOR']}};
  memory.grades.original={nivel:'B'};memory.finales.original={nivel:'A'};memory.concComp={original:'Conclusión ficticia'};
  const before=JSON.stringify([memory.grades,memory.finales,memory.concComp,memory.sessions]),diagnostics=[];
  f.r.c.console={warn:(...args)=>diagnostics.push(args)};f.r.el('selBim').value=bim;
  const base=f.r.roster([{idSiagie:'synthetic',nombre:'FICTICIO ACTUAL',grado:4,seccion:'B'}],bim);
  f.r.c.pintarPadronInmediato(base,bim,true);
  assert.equal(JSON.stringify([memory.grades,memory.finales,memory.concComp,memory.sessions]),before);
  assert.deepEqual(Array.from(memory.studentAliases['secundaria||4||B']['id:synthetic']),['FICTICIO ACTUAL','FICTICIO ANTERIOR']);
  assert.equal(f.r.run('bdEstudiantes'),base);assert.equal(f.disk.get(f.key),beforeDisk);
  assert.equal(diagnostics.length,0);assert.equal(f.a.requests.length+f.r.requests.length,0);
 });
 test(bim+': unexpected alias types are non-destructive, diagnosed before any storage operation',()=>{
  for(const invalid of ['unexpected',null,{},[42]]){
   const f=setup(),memory=f.r.run('store'),diagnostics=[],beforeDisk=f.disk.get(f.key);
   memory.studentAliases={'secundaria||4||B':{'id:valid':['FICTICIO ORIGINAL'],'id:synthetic':invalid}};
   memory.grades.original={nivel:'B'};memory.finales.original={nivel:'A'};memory.concComp={original:'Conclusión ficticia'};
   const before=JSON.stringify(memory),aliases=memory.studentAliases,operations=f.operations.length;
   f.r.c.console={warn:(...args)=>diagnostics.push(args)};f.r.el('selBim').value=bim;
   const base=f.r.roster([{idSiagie:'valid',nombre:'FICTICIO CAMBIADO',grado:4,seccion:'B'},{idSiagie:'synthetic',nombre:'FICTICIO SECRETO',grado:4,seccion:'B'}],bim);
   assert.throws(()=>f.r.c.pintarPadronInmediato(base,bim,true),e=>e.code==='LOCAL_STORAGE'&&e.operacion==='recordarPadron'&&e.tipo==='TypeError'&&/no se intentó guardar/.test(e.message)&&!/almacenamiento/.test(e.message));
   assert.equal(JSON.stringify(memory),before);assert.equal(memory.studentAliases,aliases);
   assert.equal(f.r.run('bdEstudiantes'),base);assert.equal(f.r.run('estudiantes().length'),2);
   assert.equal(f.operations.length,operations);assert.equal(f.disk.get(f.key),beforeDisk);
   assert.equal(JSON.stringify(diagnostics),'[["registro.persistencia",{"operacion":"recordarPadron","tipo":"TypeError","codigo":"UNKNOWN"}]]');
   assert.equal(f.a.requests.length+f.r.requests.length,0);
  }
 });
 test(bim+': loader classifies prior alias capture once without recursive retry or persistence',async()=>{
  const f=setup(),memory=f.r.run('store'),diagnostics=[],beforeDisk=f.disk.get(f.key);
  memory.studentAliases={'secundaria||4||B':{'id:synthetic':'unexpected'}};
  f.r.c.base=f.r.roster([{idSiagie:'synthetic',nombre:'FICTICIO',grado:4,seccion:'B'}],bim);
  f.r.c.console={warn:(...args)=>diagnostics.push(args)};f.r.el('selBim').value=bim;
  f.r.run('bdEstudiantes=base');
  const before=JSON.stringify(memory),operations=f.operations.length;
  assert.equal(await f.r.c.cargarPadronRegistro(bim),true);
  assert.equal(diagnostics.length,1);assert.equal(diagnostics[0][1].operacion,'recordarPadron');
  assert.equal(f.operations.length,operations);assert.equal(f.disk.get(f.key),beforeDisk);
  assert.equal(JSON.stringify(memory),before);assert.equal(f.a.requests.length+f.r.requests.length,0);
 });
}
test('Historical boundary recognizes only the exact diagnostic changes and exposes safety mutations',()=>{
 const boundary=require('./roster-persistence-boundary.cjs'),source=fs.readFileSync('registro.html','utf8');
 const previous=require('node:child_process').execFileSync('git',['show','96297c81e1f846f284e4b1371c5c4908d5d00eaf:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 assert.equal(boundary('registro.html',source),previous);
 for(const [from,to]of [['!Array.isArray(names)','false'],["throw errorPadronLocal('recordarPadron', e)","saveStore()"],['IEStudents.validToken() === tokenPadron','true']]){
  assert.ok(source.includes(from));assert.notEqual(boundary('registro.html',source.replace(from,to)),previous);
 }
});
