const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const diagnosticSource = fs.readFileSync(path.join(__dirname, '..', 'registro-sync-diagnostic.js'), 'utf8');
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'registro-sync-diagnostic-ui.js'), 'utf8');
const reconcile = require('../registro-reconcile.js');
const identity = require('../academic-identity.js');
const modelVm = vm.createContext({window:{}});
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'registro-academic-model.js'), 'utf8'), modelVm);
const model = modelVm.window.IERegistroAcademico;
const diagnostic = require('../registro-sync-diagnostic.js');

const copy = x => JSON.parse(JSON.stringify(x));
const context = {nivel:'secundaria',bim:'III',grado:1,seccion:'A',area:'Educación para el Trabajo (EPT)'};
const key = [context.nivel,context.bim,context.grado,context.seccion,context.area].join('||');
const comp = 'Gestiona proyectos de emprendimiento económico o social';

function fixture() {
  const roster = Array.from({length:28}, (_,i) => ({
    nivel:'secundaria', grado:1, seccion:'A',
    idSiagie:'synthetic-'+i, codigoEstudiante:'synthetic-code-'+i,
    nombre:'PERSONA FICTICIA '+i
  }));
  const sessions = ['2026-10-14','2026-10-16'].map((fecha, i) => ({
    ...context, comp, fecha, capacidad:'Capacidad ficticia '+i
  }));
  const cloud = {sessions, grades:{}, finales:{}, meta:{}};
  for (const s of sessions) {
    for (const a of roster) {
      cloud.grades[[key, comp, s.capacidad, s.fecha, 'id:'+a.idSiagie].join('||')] = {nivel:'A', nota20:15};
    }
  }
  const final = i => [key, comp, 'id:'+roster[i].idSiagie].join('||');
  cloud.finales[final(0)] = {nivel:'A', nota20:15};
  const local = copy(cloud);
  for (let i = 0; i < 4; i++) {
    local.finales[final(i)] = {nivel:'A', nota20:15, origen:'letra'};
  }
  return {
    context, roster, competencies:[comp], local, baseline:{},
    remote:{exists:true, version:2, payload:cloud}, period:'abierto',
    connection:{state:'review'}, apis:{identity, reconcile, model}, final
  };
}

test('Verificar identidad estricta de registro-sync-diagnostic.js (PR #96 blob)', () => {
  const content = diagnosticSource.replace(/\r\n/g, '\n');
  const hash = crypto.createHash('sha1').update('blob ' + Buffer.byteLength(content) + '\0' + content).digest('hex');
  assert.equal(hash, '04de2f8ac34326a8a60a14f96995f23d57a53f3f', 'registro-sync-diagnostic.js debe ser byte-idéntico al PR #96');
});

test('Diagnóstico sintético 1A EPT III: 2 sesiones, 56 evidencias, 1 directa en nube; explica Promedios, no pérdida de evidencias', () => {
  const f = fixture();
  const before = JSON.stringify(f);
  const r = diagnostic.analyze(f);
  assert.equal(r.counts.cloud.sessions, 2);
  assert.equal(r.counts.cloud.grades, 56);
  assert.equal(r.counts.cloud.finales, 1);
  assert.equal(r.counts.local.finales, 4);
  assert.equal(r.conflicts.total, 1);
  assert.deepEqual(r.conflicts.byModule, {promedios: 1});
  assert.equal(r.conflicts.causes.origen, 1);
  assert.equal(r.conflicts.fields.origen, 1);
  assert.equal(r.blocks.period, false);
  assert.equal(r.blocks.synchronization, true);
  assert.equal(JSON.stringify(f), before, 'analyze() no debe mutar el estado de entrada');
});

test('Separación de causas: Calificar, asistencia compartida y contradicciones históricas sin elegir ganador', () => {
  const f = fixture();
  f.local = copy(f.remote.payload);
  f.baseline = {version:1, basePayload:copy(f.local)};
  const grade = Object.keys(f.local.grades)[0];
  f.local.grades[grade] = {nivel:'B', nota20:12, origen:'numero'};
  f.remote.payload.grades[grade] = {nivel:'AD', nota20:18, origen:'numero'};
  const attendance = 'secundaria||III||1||A||2026-10-14||id:synthetic-0';
  f.local.asistencia = {[attendance]:{marca:'P'}};
  f.remote.payload.asistencia = {[attendance]:{marca:'F'}};
  const name = [key, comp, f.roster[0].nombre].join('||');
  f.remote.payload.finales[name] = {nivel:'B', nota20:12, origen:'numero'};
  const r = diagnostic.analyze(f);
  assert.equal(r.status, 'review');
  assert.ok(r.conflicts.byModule.calificar);
  assert.ok(r.conflicts.byModule.asistencia);
  assert.ok(r.conflicts.byModule.identidades);
  assert.ok(r.conflicts.causes.representaciones_verificadas_sin_vigencia);
  assert.ok(r.conflicts.causes.numero_exacto);
});

test('Periodo cerrado se distingue de revisión de sincronización; no simula nube vacía ante error', () => {
  const f = fixture();
  f.local = copy(f.remote.payload);
  f.period = 'cerrado';
  f.connection.state = 'readonly';
  let r = diagnostic.analyze(f);
  assert.equal(r.blocks.period, true);
  assert.equal(r.blocks.synchronization, false);

  f.baseline = {version:2, basePayload:copy(f.local)};
  f.remote = {version:3, payload:{}, exists:false};
  r = diagnostic.analyze(f);
  assert.equal(r.status, 'read_rejected');
  assert.equal(r.code, 'READ_MISSING');
  assert.equal(r.blocks.period, true);
});

function pageContext(options = {}) {
  const f = fixture();
  const requests = [];
  const storage = new Map();
  const store = {...copy(f.local), academicSync:{}, meta:{[key]:{docente:'DOCENTE PRIVADO'}}, studentAliases:{}};
  storage.set('ie22375_registro_notas_v2', 'legacy-private');

  const c = vm.createContext({
    window: null,
    IEAcademicIdentity: identity,
    IERegistroReconcile: reconcile,
    IERegistroAcademico: model,
    IERegistroConnection: {current: () => ({snapshot: () => ({state:'review', binding:'PRIVATE_TOKEN', validUntil:0})})},
    getLoginSession: () => ({role:'docente', user:'PRIVATE_USER', token:'PRIVATE_TOKEN'}),
    ctxBase: () => context,
    registroLocal: {matches: () => true},
    tokenPadron: 'PRIVATE_TOKEN',
    padronBimestre: 'III',
    store,
    bdEstudiantes: {secundaria: {estudiantes: f.roster}},
    competencias: () => [comp],
    document: {querySelectorAll: () => []},
    localStorage: {
      getItem: k => storage.get(k) || null,
      setItem: () => { throw Error('forbidden write'); },
      removeItem: () => { throw Error('forbidden delete'); }
    },
    NOTAS_KEY: 'fake-notes-only',
    CLOUD_API_URL: 'https://synthetic.invalid',
    AbortSignal,
    fetch: async (url, o) => {
      const b = JSON.parse(o.body);
      requests.push({url, ...b});
      assert.ok(['loadreg', 'loadperiodos'].includes(b.action), 'Solo se permiten acciones loadreg y loadperiodos');
      assert.equal(o.cache, 'no-store');
      options.during?.(store, b);
      return {
        ok: true,
        json: async () => options.failure
          ? {ok:false, code:'SESSION', error:'PRIVATE_SERVER_ERROR'}
          : b.action === 'loadreg'
            ? {ok:true, soportaModeloAcademico:true, identidadAcademica:1, items:[{clave:key, ts:2, payload:copy(f.remote.payload)}]}
            : {ok:true, periodos:{bimestres:{III:'abierto'}}}
      };
    }
  });
  c.window = c;
  vm.runInContext(diagnosticSource, c);
  return {c, store, storage, requests};
}

test('runPage() emite únicamente lecturas permitidas, no muta almacenamiento y no expone datos sensibles', async () => {
  const p = pageContext();
  const beforeStore = JSON.stringify(p.store);
  const beforeStorage = JSON.stringify([...p.storage]);
  const r = await p.c.IERegistroSyncDiagnostic.runPage();

  assert.equal(r.status, 'review');
  assert.equal(p.requests.length, 2);
  assert.equal(JSON.stringify(p.store), beforeStore);
  assert.equal(JSON.stringify([...p.storage]), beforeStorage);
  assert.equal(r.legacyLocal, true);
  assert.doesNotMatch(JSON.stringify(r), /PRIVATE|PERSONA|DOCENTE|synthetic-|\|\||Capacidad|Educación/);
});

test('runPage() aborta con CONTEXT_CHANGED si los datos en memoria cambian durante la lectura', async () => {
  const p = pageContext({during: s => { Object.values(s.finales)[0].nivel = 'C'; }});
  const r = await p.c.IERegistroSyncDiagnostic.runPage();
  assert.equal(r.code, 'CONTEXT_CHANGED');
});

test('UI: buildDialogContent muestra estado administrativo real y aclara bloqueo de sincronización sin cierre real', () => {
  const contextVm = vm.createContext({ window: null });
  contextVm.window = contextVm;
  vm.runInContext(uiSource, contextVm);
  const { buildDialogContent } = contextVm.IERegistroSyncDiagnosticUI;

  const reportReview = {
    schema: 1, readOnly: true,
    period: { server: 'abierto', closed: false },
    connection: { state: 'review', leaseExpired: false, retentionFailed: false },
    conflicts: { total: 1, byModule: { promedios: 1 }, causes: { origen: 1 } },
    blocks: { period: false, synchronization: true },
    legacyLocal: true, domChangedControls: 0, status: 'review'
  };

  const htmlReview = buildDialogContent(reportReview);
  assert.match(htmlReview, /Servidor: Bimestre ABIERTO/);
  assert.match(htmlReview, /Edición pausada por revisión de sincronización/);
  assert.match(htmlReview, /el bimestre permanece <strong>ABIERTO<\/strong>/);
  assert.match(htmlReview, /Promedios:<\/strong> 1 conflicto/);
  assert.match(htmlReview, /Origen de calificación diferente/);
  assert.match(htmlReview, /Almacenamiento anterior.*datos locales de versiones anteriores/);

  const reportClosed = {
    schema: 1, readOnly: true,
    period: { server: 'cerrado', closed: true },
    connection: { state: 'readonly', leaseExpired: false, retentionFailed: false },
    conflicts: { total: 0, byModule: {}, causes: {} },
    blocks: { period: true, synchronization: false },
    legacyLocal: false, domChangedControls: 0, status: 'no_conflicts'
  };

  const htmlClosed = buildDialogContent(reportClosed);
  assert.match(htmlClosed, /Cierre administrativo en servidor: Bimestre cerrado/);
  assert.doesNotMatch(htmlClosed, /permanece <strong>ABIERTO<\/strong>/);
});

test('UI y Privacidad: El informe renderizado y el JSON copiado omiten datos personales, DNI y tokens', () => {
  const contextVm = vm.createContext({ window: null });
  contextVm.window = contextVm;
  vm.runInContext(uiSource, contextVm);
  const { buildDialogContent } = contextVm.IERegistroSyncDiagnosticUI;

  const mockReport = {
    schema: 1, readOnly: true,
    period: { server: 'abierto', closed: false },
    connection: { state: 'review' },
    conflicts: { total: 2, byModule: { promedios: 1, calificar: 1 }, causes: { origen: 1, numero_exacto: 1 } },
    blocks: { period: false, synchronization: true },
    legacyLocal: false, domChangedControls: 0, status: 'review'
  };

  const html = buildDialogContent(mockReport);
  const json = JSON.stringify(mockReport);

  assert.doesNotMatch(html, /PRIVATE|DNI|token|estudiante|alumno/i);
  assert.doesNotMatch(json, /PRIVATE|token|password|dni/i);
});

test('UI: Manejo de errores de conexión y contexto (TIMEOUT, CONTEXT_CHANGED, SESSION)', () => {
  const contextVm = vm.createContext({ window: null });
  contextVm.window = contextVm;
  vm.runInContext(uiSource, contextVm);
  const { buildDialogContent } = contextVm.IERegistroSyncDiagnosticUI;

  for (const code of ['TIMEOUT', 'CONTEXT_CHANGED', 'SESSION', 'API_INCOMPATIBLE']) {
    const errorReport = { schema: 1, readOnly: true, status: 'unavailable', code };
    const html = buildDialogContent(errorReport);
    assert.match(html, new RegExp('No se pudo completar la consulta de lectura \\(' + code + '\\)'));
    assert.match(html, /Conserva esta pestaña abierta\. No recargues la página ni limpies la memoria caché\./);
  }
});

test('Integración DOM simulada: Clic en botón abre dialog con showModal y no ejecuta escrituras locales', async () => {
  let writes = 0;
  const storage = new Map();
  const dialogCreated = [];

  const btnElem = {
    id: 'registroConnectionDiagnostic',
    disabled: false,
    textContent: 'Diagnosticar sincronización',
    dataset: {},
    click: function() { return this.onclick(); }
  };

  const dom = {
    readyState: 'complete',
    addEventListener: () => {},
    getElementById: (id) => {
      if (id === 'registroConnectionDiagnostic') return btnElem;
      return null;
    },
    createElement: (tag) => {
      const el = {
        tagName: tag.toUpperCase(),
        style: {},
        children: [],
        appendChild: function(c) { this.children.push(c); return c; },
        append: function(...args) { this.children.push(...args); },
        showModal: function() { this.open = true; },
        close: function() { this.open = false; },
        remove: function() {}
      };
      if (tag === 'dialog') dialogCreated.push(el);
      return el;
    },
    body: {
      appendChild: (el) => el
    }
  };

  const contextVm = vm.createContext({
    document: dom,
    window: null,
    navigator: { clipboard: { writeText: async () => {} } },
    localStorage: {
      getItem: (k) => storage.get(k) || null,
      setItem: () => { writes++; throw new Error('Forbidden write'); },
      removeItem: () => { writes++; throw new Error('Forbidden delete'); }
    },
    IERegistroSyncDiagnostic: {
      runPage: async () => ({
        schema: 1, readOnly: true,
        period: { server: 'abierto', closed: false },
        connection: { state: 'review' },
        conflicts: { total: 1, byModule: { promedios: 1 }, causes: { origen: 1 } },
        blocks: { period: false, synchronization: true },
        legacyLocal: true, domChangedControls: 0, status: 'review'
      })
    }
  });
  contextVm.window = contextVm;

  vm.runInContext(uiSource, contextVm);
  contextVm.IERegistroSyncDiagnosticUI.init();

  assert.equal(typeof btnElem.onclick, 'function');
  await btnElem.onclick();

  assert.equal(dialogCreated.length, 1, 'Debe crearse un modal <dialog>');
  assert.equal(dialogCreated[0].open, true, 'El modal debe abrirse con showModal');
  assert.equal(writes, 0, 'No debe ejecutarse ninguna escritura en localStorage');
});

test('registro.html: El botón de diagnóstico está en #registroConnectionStatus y los scripts están enlazados', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'registro.html'), 'utf8');
  assert.match(html, /<button type="button" id="registroConnectionDiagnostic">Diagnosticar sincronización<\/button>/);
  assert.match(html, /<script src="registro-sync-diagnostic\.js" defer><\/script>/);
  assert.match(html, /<script src="registro-sync-diagnostic-ui\.js" defer><\/script>/);
});
