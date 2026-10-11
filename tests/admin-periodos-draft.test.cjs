const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const {extract} = new Function('require', '__dirname', read('tests/students-client.test.cjs').split('function fixture')[0] + '\nreturn {extract};')(require, __dirname);

function fixture() {
  const elements = new Map(), storage = new Map(), requests = [], saves = [], alerts = [], messages = [];
  const base = {anio:2026, version:'synthetic-base-v1', inicializada:true,
    primaria:{estudiantes:[{nombre:'Synthetic Primary', grado:1, seccion:'Única', orden:1, idSiagie:'synthetic-id-p', codigoEstudiante:'synthetic-code-p', estadoMatricula:'DEFINITIVA'}]},
    secundaria:{estudiantes:[{nombre:'Synthetic Transfer', grado:4, seccion:'B', orden:2, idSiagie:'synthetic-id-s', codigoEstudiante:'synthetic-code-s', estadoMatricula:'TRASLADADO'}]}};
  const element = id => {
    if (!elements.has(id)) elements.set(id, {value:'', textContent:'', innerHTML:''});
    return elements.get(id);
  };
  const context = vm.createContext({Date, console, document:{getElementById:element,
    querySelectorAll:() => ['I','II','III','IV'].map(b => ({value:b==='III'?'abierto':'cerrado', getAttribute:() => b}))},
    localStorage:{getItem:k => storage.get(k)||null, setItem:(k,v) => storage.set(k,v)},
    alert:message => alerts.push(message), confirm:() => false,
    tokenSesionAdmin:() => 'synthetic-admin-token', CLOUD_API_URL:'https://synthetic.invalid/exec',
    fetch:async (url, options) => {requests.push({url, options, body:JSON.parse(options.body)}); return {text:async () => JSON.stringify({ok:true})};},
    estadoBD:message => messages.push(message), fillFiltros(){}, renderTabla(){}, permitirEdicionBD:() => true,
    IEStudents:{validToken:() => 'synthetic-admin-token', peek:() => clone(base), empty:() => ({}),
      save:async (draft, version) => {saves.push({draft:clone(draft), version}); return {...clone(draft), version:'synthetic-base-v2'};},
      loadRoster:() => {throw Error('Periodos must not touch rosters');}}
  });
  const run = code => new vm.Script(code).runInContext(context);
  run(`const LS_PER='ie22375_admin_periodos', PERIODOS_CLOUD_KEY='ie22375_periodos_cloud_v1';
    let estado=null, bdPendiente=false, bdGuardando=false, baseCargada=true, baseInicializada=true, baseVersion='synthetic-base-v1', modoEdicionBase=true;
    let resumenMenuAdmin={token:'',base:null,padron:null,bimestre:'',baseEstado:'Pendiente',padronEstado:'Pendiente'};`);
  for (const name of ['escapeConsulta','defaultPeriodos','loadPeriodos','initPeriodosUI','actualizarResumen','saveEstado','aplicarBaseServidor','cargarEstudiantesAdmin','savePeriodos','guardarBD','exportarJSON']) run(extract('admin.html', name));
  context.fixtureBase = clone(base); run('estado=fixtureBase;');
  element('cfgAnio').value = '2027';
  storage.set('ie22375_periodos_cloud_v1', JSON.stringify({anio:2026, bimestres:{III:'abierto'}}));
  return {context, run, base, elements, storage, requests, saves, alerts, messages};
}

function assertBaseUnchanged(f, expected=f.base) {
  assert.deepEqual(clone(f.run('estado')), expected);
  assert.equal(f.run('baseVersion'), 'synthetic-base-v1');
  assert.equal(f.saves.length, 0);
}

test('Saving only periods preserves the entire base, versions and student draft revision', async () => {
  const f=fixture(); f.context.cargarEstudiantesAdmin.revision=7;
  await f.context.savePeriodos();
  assertBaseUnchanged(f);
  assert.equal(f.run('bdPendiente'), false);
  assert.equal(f.context.cargarEstudiantesAdmin.revision, 7);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].body.action, 'saveperiodos');
  assert.equal(f.requests[0].body.token, 'synthetic-admin-token');
  assert.equal(f.requests[0].options.method, 'POST');
  const per=JSON.parse(f.storage.get('ie22375_admin_periodos'));
  assert.equal(per.anio, 2027); assert.equal(per.bimestres.III, 'abierto');
  assert.deepEqual(JSON.parse(f.storage.get('ie22375_periodos_cloud_v1')), per);
  assert.equal(f.elements.get('hdrAnio').textContent, 'Año 2027');
  assert.match(f.alerts.at(-1), /sincronizados/);
});

test('Authentic pending student edits survive period save without another revision or discard', async () => {
  const f=fixture(); f.run('estado.primaria.estudiantes[0].nombre="Synthetic draft";saveEstado();');
  const draft=clone(f.run('estado')), revision=f.context.cargarEstudiantesAdmin.revision;
  await f.context.savePeriodos();
  assertBaseUnchanged(f, draft);
  assert.equal(f.run('bdPendiente'), true);
  assert.equal(f.context.cargarEstudiantesAdmin.revision, revision);
  assert.match(f.messages.at(-1), /Cambios pendientes/);
});

test('Period save during a fresh student download does not block the response or revert the header', async () => {
  const f=fixture(); let resolve;
  f.context.IEStudents.load=() => new Promise(r => {resolve=r;});
  const loading=f.context.cargarEstudiantesAdmin({forceNetwork:true});
  await f.context.savePeriodos();
  resolve({...clone(f.base), version:'synthetic-fresh'}); await loading;
  assert.equal(f.run('baseVersion'), 'synthetic-fresh'); assert.equal(f.run('bdPendiente'), false);
  assert.equal(f.context.cargarEstudiantesAdmin.revision, undefined);
  assert.equal(f.elements.get('hdrAnio').textContent, 'Año 2027');
  assert.equal(f.run('estado.anio'), 2026);
});

test('A real edit during download remains protected even when periods are subsequently saved', async () => {
  const f=fixture(); let resolve;
  f.context.IEStudents.load=() => new Promise(r => {resolve=r;});
  const loading=f.context.cargarEstudiantesAdmin();
  f.run('estado.secundaria.estudiantes[0].nombre="Synthetic pending transfer";saveEstado();');
  const draft=clone(f.run('estado')), revision=f.context.cargarEstudiantesAdmin.revision;
  await f.context.savePeriodos();
  resolve({...clone(f.base), version:'synthetic-fresh'}); await loading;
  assertBaseUnchanged(f, draft); assert.equal(f.run('bdPendiente'), true);
  assert.equal(f.context.cargarEstudiantesAdmin.revision, revision);
  assert.match(f.messages.at(-1), /no reemplazó tus modificaciones/);
});

for (const pending of [false,true]) test('Network failure saving periods preserves '+(pending?'pending':'clean')+' student state and confirmed period cache', async () => {
  const f=fixture(); if (pending) f.run('estado.primaria.estudiantes[0].nombre="Synthetic pending";saveEstado();');
  const draft=clone(f.run('estado')), revision=f.context.cargarEstudiantesAdmin.revision;
  const confirmed=f.storage.get('ie22375_periodos_cloud_v1');
  f.context.fetch=async (url,options) => {f.requests.push({body:JSON.parse(options.body)}); throw Error('Synthetic network');};
  await f.context.savePeriodos();
  assertBaseUnchanged(f, draft); assert.equal(f.run('bdPendiente'), pending);
  assert.equal(f.context.cargarEstudiantesAdmin.revision, revision);
  assert.equal(f.storage.get('ie22375_periodos_cloud_v1'), confirmed);
  assert.equal(JSON.parse(f.storage.get('ie22375_admin_periodos')).anio, 2027);
  assert.match(f.alerts.at(-1), /NO están activos/);
  assert.equal(f.requests.length, 1); assert.equal(f.requests[0].body.action, 'saveperiodos');
});

test('Server rejection of periods does not create a student modification or claim cloud success', async () => {
  const f=fixture(); const confirmed=f.storage.get('ie22375_periodos_cloud_v1');
  f.context.fetch=async () => ({text:async () => JSON.stringify({ok:false,error:'Synthetic rejection'})});
  await f.context.savePeriodos();
  assertBaseUnchanged(f); assert.equal(f.run('bdPendiente'), false);
  assert.equal(f.storage.get('ie22375_periodos_cloud_v1'), confirmed);
  assert.match(f.alerts.at(-1), /NO están activos/);
});

test('Saving periods leaves the actual student save payload and optimistic version intact', async () => {
  const f=fixture(); f.run('estado.primaria.estudiantes[0].nombre="Synthetic edit";saveEstado();');
  const draft=clone(f.run('estado'));
  await f.context.savePeriodos(); assert.equal(f.saves.length, 0);
  await f.context.guardarBD();
  assert.equal(f.saves.length, 1); assert.deepEqual(f.saves[0], {draft,version:'synthetic-base-v1'});
  assert.equal(f.run('bdPendiente'), false); assert.equal(f.run('baseVersion'), 'synthetic-base-v2');
});

test('Student JSON export after period save retains original year, identities and enrollment states', async () => {
  const f=fixture(); let exported;
  f.context.Blob=class {constructor(parts){exported=JSON.parse(parts[0]);}};
  f.context.URL={createObjectURL:() => 'blob:synthetic'};
  f.context.document.createElement=() => ({click(){}});
  await f.context.savePeriodos(); f.context.exportarJSON();
  assert.deepEqual(exported, f.base);
});

test('Periods can be saved before a student base exists without creating a draft', async () => {
  const f=fixture(); f.run('estado=null;');
  await f.context.savePeriodos();
  assert.equal(f.run('estado'), null); assert.equal(f.run('bdPendiente'), false);
  assert.equal(f.context.cargarEstudiantesAdmin.revision, undefined);
  assert.equal(f.elements.get('hdrAnio').textContent, 'Año 2027'); assert.equal(f.saves.length, 0);
});
