const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
function extract(file,name) {
  const src=read(file),start=src.search(new RegExp('(?:async )?function '+name+'\\('));
  assert.ok(start>=0,name);
  return src.slice(start,src.indexOf('\n        }',start)+'\n        }'.length);
}
function backend() {
  // Reuse the existing protected-read harness; only synthetic accounts/data.
  const harness=read('tests/backend-read-auth.test.cjs');
  const setup=harness.slice(harness.indexOf('function setup()'),harness.indexOf('function fixture()'));
  const s=new Function('vm','source','assert','crypto',setup+';return setup();')(vm,read('apps-script/Codigo.js'),assert,crypto);
  s.docentes[1].asignaciones['Matemática']=['1|A'];
  s.docentes.push({user:'test-secondary-b',nombre:'Test Secondary B',nivel:'secundaria',asignaciones:{'Matemática':['1|B']}});
  s.docentes.forEach(doc=>{doc.pass='opaque-fixture-value';doc.password='opaque-fixture-value';doc.privateExtra='opaque-fixture-value';});
  s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);
  return s;
}
function frontend(s,role,user) {
  let token=s.token(user,role);const entries=new Map(),nodes=new Map(),calls=[];
  function node(id) {
    if(!nodes.has(id))nodes.set(id,{value:'',innerHTML:'',textContent:'',disabled:false,readOnly:false,
      classList:{add(){},remove(){},toggle(){}},parentElement:{classList:{add(){},remove(){}}}});
    return nodes.get(id);
  }
  const c=vm.createContext({window:{},Date,console,
    sessionStorage:{getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)},
    IEStudents:{validToken:()=>token,fetchJSON:async(api,options)=>{const body=JSON.parse(options.body);calls.push(body);return s.post(body);}},
    document:{getElementById:node,querySelectorAll:()=>[]},mostrarToast(){},
    syncInputTotalEstudiantes(){},renderizarAreas(){},renderizarResumen(){},renderizarCompetencias(){},syncInputDocente(){},
    actualizarBotonesSeleccion(){},guardarDatos(){},aplicarModoPeriodoActual(){},estadoPeriodoAdmin(){return 'cerrado';},
    cargarBaseOficialCache(){},cargarBaseOficialEstudiantes(){}});
  c.window.IEStudents=c.IEStudents;
  vm.runInContext(read('matrix-teachers.js'),c);c.IEMatrixTeachers=c.window.IEMatrixTeachers;
  const run=code=>vm.runInContext(code,c);
  return {c,run,node,calls,entries,setToken:value=>{token=value;}};
}

test('matrix endpoint returns only names and assignments to Admin, never credentials',()=>{
  const s=backend(),response=s.post({action:'loadmatrixteachers',token:s.admin});
  assert.equal(response.ok,true);assert.equal(response.docentes.length,s.docentes.length);
  for(const doc of response.docentes) {
    assert.ok(Object.keys(doc).every(k=>['nombre','nivel','grados','asignaciones','areas','aulas'].includes(k)));
    assert.equal('pass' in doc,false);assert.equal('password' in doc,false);assert.equal('user' in doc,false);
  }
  assert.equal(JSON.stringify(response).includes('opaque-fixture-value'),false);
});
test('matrix endpoint limits each teacher to own official assignments despite forged filters',()=>{
  const s=backend();
  for(const user of ['test-primary','test-secondary','test-secondary-b']) {
    const response=s.post({action:'loadmatrixteachers',token:s.token(user),role:'admin',user:'admin',nivel:'primaria'});
    assert.equal(response.ok,true);assert.equal(response.docentes.length,1);
    assert.equal(response.docentes[0].nombre,s.docentes.find(d=>d.user===user).nombre);
    assert.equal(JSON.stringify(response).includes('opaque-fixture-value'),false);
  }
});
test('matrix endpoint rejects absent, expired, revoked and removed sessions and other roles',()=>{
  const s=backend();
  for(const token of [undefined,s.token('test-primary','docente',{exp:Date.now()-1}),s.token('test-primary','docente',{permisosVersion:999}),s.token('removed'),s.token('auxiliar','auxiliar')]) {
    const r=s.post({action:'loadmatrixteachers',token});assert.equal(r.ok,false);assert.equal(r.docentes,undefined);
  }
  // Savedoc revocation must also affect this new view immediately.
  assert.equal(s.post({action:'savedoc',token:s.admin,docentes:s.docentes.filter(d=>d.user!=='test-primary')}).ok,true);
  assert.equal(s.post({action:'loadmatrixteachers',token:s.primary}).ok,false);
});

for(const role of ['admin','docente']) test('Primaria '+role+': assigned grade shows official name in readonly field',async()=>{
  const s=backend(),f=frontend(s,role,role==='admin'?'admin':'test-primary');
  await f.c.IEMatrixTeachers.load('synthetic-api');
  f.run("let estado={grado:'PRIMERO',bimestre:'III',nombreDocente:'Historical',docentesPorAula:{'III|PRIMERO|UNICA':'Historical'}};");
  f.run(extract('primaria.html','getNombreDocente'));f.run(extract('primaria.html','syncInputDocente'));
  f.c.syncInputDocente();assert.equal(f.node('nombreDocente').value,'Test Primary');assert.equal(f.node('nombreDocente').readOnly,true);
  f.run("estado.grado='TERCERO'");assert.equal(f.c.getNombreDocente(),'Test Primary');
  f.run("estado.grado='SEGUNDO'");f.c.syncInputDocente();assert.equal(f.node('nombreDocente').value,'Sin registrar');
  const input=read('primaria.html').match(/<input[^>]*id="nombreDocente"[^>]*>/)[0];
  assert.match(input,/readonly/);assert.doesNotMatch(input,/oninput|onchange/);
});
for(const role of ['admin','docente']) test('Secundaria '+role+': area and aula show the same official teacher',async()=>{
  const s=backend(),f=frontend(s,role,role==='admin'?'admin':'test-secondary');
  await f.c.IEMatrixTeachers.load('synthetic-api');
  f.run(`let estado={grado:'1°',seccion:'A',areaActual:'Matemática',bimestre:'III',docentes:{'III|1°|A':{'Matemática':'Historical'}}};
    const ESTRUCTURA_AREAS={'Matemática':{competencias:[],color:'',textColor:'',icon:''}};
    function calcularResumenArea(){return {inicio:0,proceso:0,previsto:0,destacado:0}};`);
  f.run(extract('secundaria.html','getDocenteArea'));f.run(extract('secundaria.html','renderizarAreaHeader'));
  assert.equal(f.c.getDocenteArea('Matemática'),'Test Secondary');f.c.renderizarAreaHeader();
  assert.ok(f.node('areaHeader').innerHTML.includes('Docente responsable: Test Secondary'));
  assert.doesNotMatch(f.node('areaHeader').innerHTML,/<input|oninput|onchange/);
  f.run("estado.grado='5°';estado.seccion='ÚNICA'");assert.equal(f.c.getDocenteArea('Ciencia y Tecnología'),'Test Secondary');
  assert.equal(f.c.getDocenteArea('Matemática'),'Sin registrar');
});
test('two secondary teachers in the same area resolve independently for A and B',async()=>{
  const s=backend(),f=frontend(s,'admin','admin');await f.c.IEMatrixTeachers.load('synthetic-api');
  assert.equal(f.c.IEMatrixTeachers.nombre('secundaria','1°','A','Matemática'),'Test Secondary');
  assert.equal(f.c.IEMatrixTeachers.nombre('secundaria','1°','B','Matemática'),'Test Secondary B');
  const own=frontend(s,'docente','test-secondary-b');await own.c.IEMatrixTeachers.load('synthetic-api');
  assert.equal(own.c.IEMatrixTeachers.nombre('secundaria','1°','B','Matemática'),'Test Secondary B');
  assert.equal(own.c.IEMatrixTeachers.nombre('secundaria','1°','A','Matemática'),'');
});
test('legacy area+aula is used only when asignaciones is absent, even an empty map blocks fallback',async()=>{
  const s=backend();s.docentes.push({user:'empty-map',nombre:'Empty Map',nivel:'secundaria',areas:['Other'],aulas:['4|A'],asignaciones:{}});
  s.tables.get('DocentesAcceso').rows[1][2]=JSON.stringify(s.docentes);
  const f=frontend(s,'admin','admin');await f.c.IEMatrixTeachers.load('synthetic-api');
  assert.equal(f.c.IEMatrixTeachers.nombre('secundaria','2°','B','Matemática'),'Test Legacy');
  assert.equal(f.c.IEMatrixTeachers.nombre('secundaria','4°','A','Other'),'');
});
test('official teacher cache is session-bound and sanitized, and server denial clears it',async()=>{
  const s=backend(),f=frontend(s,'admin','admin');await f.c.IEMatrixTeachers.load('synthetic-api');
  assert.equal(f.calls[0].action,'loadmatrixteachers');assert.equal(Object.keys(f.calls[0]).length,2);
  assert.equal([...f.entries.values()].join('').includes('opaque-fixture-value'),false);
  f.setToken(s.primary);assert.equal(f.c.IEMatrixTeachers.peek(),null);
  await f.c.IEMatrixTeachers.load('synthetic-api');assert.equal(f.c.IEMatrixTeachers.peek().length,1);
  s.tables.get('DocentesAcceso').rows.push(['DOCENTE_ACCESOS',2000,JSON.stringify(s.docentes)]);
  await assert.rejects(f.c.IEMatrixTeachers.load('synthetic-api'));assert.equal(f.c.IEMatrixTeachers.peek(),null);
});

for(const file of ['primaria.html','secundaria.html']) {
  test(file+': administrative periods permit consultation while guarding edits',()=>{
    const s=backend(),f=frontend(s,'admin','admin');
    f.run("let estado={bimestre:'III',areaActual:null,datos:{}};let periodosAdminMatriz={bimestres:{I:'cerrado',II:'bloqueado',III:'abierto',IV:'cerrado'}};");
    for(const name of ['estadoPeriodoAdmin','periodoEditableActual','periodoSoloLecturaActual','impedirEdicionPeriodo','renderBimestre','aplicarModoPeriodoActual','actualizarDato','setBimestre']) f.run(extract(file,name));
    f.c.renderBimestre();const html=f.node('btnBimestre').innerHTML;
    assert.match(html,/periodo-cerrado/);assert.match(html,/periodo-bloqueado/);assert.match(html,/fa-lock/);
    assert.doesNotMatch(html,/disabled/);
    for(const bim of ['I','II','IV']) {
      f.c.setBimestre(bim);assert.equal(f.run('estado.bimestre'),bim);assert.equal(f.c.periodoSoloLecturaActual(),true);
      assert.equal(f.c.impedirEdicionPeriodo(false),true);
      const before=f.run('JSON.stringify(estado.datos)');f.c.actualizarDato({dataset:{},value:'5'});assert.equal(f.run('JSON.stringify(estado.datos)'),before);
      f.c.aplicarModoPeriodoActual();assert.match(f.node('periodReadOnlyBanner').textContent,/Solo lectura/);
    }
    f.c.setBimestre('III');assert.equal(f.c.periodoEditableActual(),true);assert.equal(f.c.impedirEdicionPeriodo(false),false);
    assert.match(extract(file,'renderizarCompetencias'),/periodoSoloLecturaActual\(\) \? 'disabled'/);
  });
  test(file+': periods refresh from loadperiodos and fall back to the existing cloud cache',async()=>{
    const s=backend(),f=frontend(s,'admin','admin');const stored=new Map(),cfg={bimestres:{I:'cerrado',II:'bloqueado',III:'abierto',IV:'cerrado'}};
    f.c.localStorage={getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)};
    f.c.fetch=async url=>{assert.ok(url.includes('action=loadperiodos'));return {text:async()=>JSON.stringify({ok:true,periodos:cfg})}};
    f.run("const CLOUD_API_URL='synthetic-api',PERIODOS_CLOUD_KEY='ie22375_periodos_cloud_v1';let periodosAdminMatriz=null;function renderBimestre(){}");
    f.run(extract(file,'cargarPeriodosAdminMatriz'));assert.equal(await f.c.cargarPeriodosAdminMatriz(),true);
    assert.deepEqual(JSON.parse(stored.get('ie22375_periodos_cloud_v1')),cfg);
    f.c.fetch=async()=>{throw Error('offline')};assert.equal(await f.c.cargarPeriodosAdminMatriz(),true);
    assert.equal(f.run("periodosAdminMatriz.bimestres.III"),'abierto');
  });
}
test('Primaria guards import, Registro, clear and cloud upload in closed periods',async()=>{
  const c=vm.createContext({impedirEdicionPeriodo:()=>true,renderizarCompetencias(){}});
  for(const name of ['traerDesdeRegistro','limpiarTodo','subirNube','aplicarImportacion','enviarAreaANube','ejecutarSubidaAreas']) {
    vm.runInContext(extract('primaria.html',name),c);await c[name]();
  }
  vm.runInContext(extract('primaria.html','importarDatos'),c);const event={target:{value:'synthetic'}};c.importarDatos(event);assert.equal(event.target.value,'');
});
for(const role of ['admin','docente']) test('Primaria removes four quick-summary cards for '+role+' while keeping Comparativo',()=>{
  const node={innerHTML:'old',classList:{add(value){assert.equal(value,'hidden')}}};
  const c=vm.createContext({window:{__IE_SES:{role}},document:{getElementById:()=>node}});
  vm.runInContext(extract('primaria.html','renderizarResumen'),c);c.renderizarResumen();assert.equal(node.innerHTML,'');
  assert.doesNotMatch(extract('primaria.html','renderizarResumen'),/Progreso General|Inicio \(C\)|En Proceso \(B\)|Logrado \(A\+AD\)/);
  assert.match(read('primaria.html'),/function abrirComparativo/);
});
