'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createHarness(options = {}) {
  const core = require('../registro-notas2.js');
  const copy = x => JSON.parse(JSON.stringify(x));

  const context = {
    nivel: options.nivel || 'secundaria',
    bim: options.bim || 'III',
    grado: options.grado !== undefined ? options.grado : 1,
    seccion: options.seccion || 'A',
    area: options.area || 'Matemática'
  };
  const key = [context.nivel, context.bim, context.grado, context.seccion, context.area].join('||');

  const students = [
    { idSiagie: 's1', nombre: 'ESTUDIANTE UNO' },
    { idSiagie: 's2', nombre: 'ESTUDIANTE DOS' }
  ];

  const comps = ['Resuelve problemas de cantidad', 'Resuelve problemas de regularidad'];

  const initialData = {
    sessions: options.sessions || [],
    grades: options.grades || {},
    capsSel: options.capsSel || {},
    calificarEstado: options.calificarEstado || {},
    finales: options.finales || {},
    concComp: options.concComp || {},
    competenciasEstado: options.competenciasEstado || {},
    asistencia: options.asistencia || {},
    asisFechas: options.asisFechas || {},
    asisFechasEstado: options.asisFechasEstado || {}
  };

  const store = copy(initialData);

  const versions = {
    calificar: options.versions?.calificar ?? 0,
    promedios: options.versions?.promedios ?? 0,
    asistencia: options.versions?.asistencia ?? 0
  };

  const at = {
    calificar: options.at?.calificar ?? null,
    promedios: options.at?.promedios ?? null,
    asistencia: options.at?.asistencia ?? null
  };

  let legacy = options.legacy !== undefined ? options.legacy : true;
  let serverReadonly = options.readonly !== undefined ? options.readonly : false;
  let periodClosed = options.periodClosed !== undefined ? options.periodClosed : false;
  let role = options.role || 'docente';
  let token = options.token || 'valid-token';
  let networkOnline = options.online !== undefined ? options.online : true;

  const requests = [];
  const events = {};
  const nodes = {};
  const activeTimers = [];

  function node(tag = 'div') {
    const n = {
      tagName: tag.toUpperCase(),
      style: {},
      dataset: {},
      hidden: false,
      disabled: false,
      children: [],
      classList: {
        contains: (cls) => (n.classes || []).includes(cls),
        add: (cls) => { (n.classes = n.classes || []).push(cls); },
        remove: (cls) => { n.classes = (n.classes || []).filter(c => c !== cls); }
      },
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      appendChild(c) { this.children.push(c); if (c.id) nodes[c.id] = c; },
      querySelector(s) {
        if (s === '.sync-dot') return this.dot || (this.dot = node('span'));
        if (s.includes('span')) return this.span || (this.span = node('span'));
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: () => {},
      showModal() { this.open = true; },
      close() { this.open = false; },
      remove() { delete nodes[this.id]; }
    };
    return n;
  }

  nodes.appHdr = node();
  nodes.appHdr.querySelector = () => ({ appendChild(c) { nodes[c.id] = c; } });
  nodes.registroConnectionStatus = node();
  nodes.registroConnectionText = node();
  nodes.registroRetryOffer = node();
  nodes.registroRecoveryControls = node();
  nodes.panelFinales = node();
  nodes.panelCalificar = node();
  nodes.panelAvance = node();
  nodes.panelAsistencia = node();

  let activePanel = options.initialPanel || 'calificar';
  nodes['panel' + (activePanel === 'promedios' ? 'Finales' : activePanel === 'calificar' ? 'Calificar' : activePanel === 'asistencia' ? 'Asistencia' : 'Avance')].classList.add('on');

  const domFinNotas = [];
  const domConclusions = [];
  const toasts = [];

  const g = {
    console,
    AbortController,
    Date,
    Map,
    Set,
    JSON,
    navigator: {
      get onLine() { return networkOnline; }
    },
    setTimeout: (fn, ms) => {
      if (ms > 5000) return 1;
      const id = setTimeout(fn, ms);
      activeTimers.push(id);
      return id;
    },
    clearTimeout: (id) => clearTimeout(id),
    document: {
      readyState: 'loading',
      visibilityState: 'visible',
      documentElement: { dataset: { notas2: '1' } },
      getElementById: (id) => nodes[id] || null,
      querySelector: (s) => {
        if (s.includes('IERegistroNotas2UI.save')) return nodes.saveBtn || (nodes.saveBtn = node('button'));
        if (s.includes('IERegistroNotas2UI.process')) return nodes.processBtn || (nodes.processBtn = node('button'));
        if (s.includes('IERegistroNotas2UI.download')) return nodes.downBtn || (nodes.downBtn = node('button'));
        return null;
      },
      querySelectorAll: (sel) => {
        if (sel === '#finLista .fin-nota' || sel.includes('.fin-nota')) return domFinNotas;
        if (sel === '.academic-conclusion' || sel.includes('.academic-conclusion')) return domConclusions;
        return [];
      },
      createElement: node,
      body: node(),
      addEventListener: (e, fn) => { (events[e] || (events[e] = [])).push(fn); },
      dispatchEvent: (e) => {
        const fns = events[e.type] || [];
        for (const fn of fns) fn(e);
      }
    },
    Event: class { constructor(type) { this.type = type; } },
    CLOUD_API_URL: 'https://fixture.invalid',
    IERegistroNotas2: core,
    registroDependenciaFallida: () => { throw Error('Missing dependency'); },
    getLoginSession: () => ({
      token,
      role,
      user: role === 'admin' ? 'admin' : 'docente1',
      nombre: role === 'admin' ? 'ADMINISTRADOR' : 'DOCENTE FICTICIO'
    }),
    IEStudents: {
      validToken: () => token,
      peekRoster: () => ({ estudiantes: students, inicializada: true }),
      loadRoster: async () => ({ estudiantes: students, inicializada: true })
    },
    padronBimestre: 'III',
    tokenPadron: token,
    areaActual: context.area,
    areas: () => [context.area],
    registroLocal: {
      matches: () => true,
      read: () => JSON.stringify(store),
      write: (data) => {}
    },
    ctxBase: () => context,
    cloudClaveReg: () => key,
    prefijoReg: () => key + '||',
    esVistaAdmin: () => role === 'admin',
    bimestreHabilitado: (bim) => !periodClosed && (!bim || bim === 'III'),
    registroConsultaHistorica: () => false,
    registroHistoricoProyectando: false,
    store,
    sesionActiva: null,
    notas: {},
    sliceRegistroArea: () => copy(store),
    mergeRegistroPayload: (p) => { Object.assign(store, p); },
    loadCapsElegidas: () => {},
    saveCapsElegidas: () => {},
    recolectarPantalla: (pane) => {
      if (pane === 'promedios') {
        for (const input of domFinNotas) {
          if (!input.readOnly && input.value !== '') {
            const num = Number(input.value);
            const level = num >= 18 ? 'AD' : num >= 14 ? 'A' : num >= 11 ? 'B' : 'C';
            store.finales[input.dataset.key] = { nivel: level, nota20: num, origen: 'numero' };
          } else if (input.value === '') {
            delete store.finales[input.dataset.key];
          }
        }
        for (const ta of domConclusions) {
          if (ta.value !== '') {
            store.concComp[ta.dataset.key] = { texto: ta.value, ts: Date.now() };
          } else {
            delete store.concComp[ta.dataset.key];
          }
        }
      }
    },
    sincronizarPeriodosNube: async () => true,
    renderSesiones: () => {},
    renderStudents: () => {},
    renderFinales: () => {},
    renderAvance: () => {},
    renderAsistencia: () => {},
    sincronizarEdicionRegistro: () => {},
    guardarAsistencia: () => {},
    toast: (msg) => { toasts.push(msg); },
    confirm: () => true,
    estudiantes: () => students,
    competencias: () => comps,
    studentKey: (s) => 'id:' + s.idSiagie,
    finalKey: (cp, sId) => [key, cp, sId].join('||'),
    leerNota: (map, k) => map[k] || null,
    letterToNum: (l) => l === 'AD' ? 19 : l === 'A' ? 15 : l === 'B' ? 12 : 8,
    numToLetter: (n) => n >= 18 ? 'AD' : n >= 14 ? 'A' : n >= 11 ? 'B' : 'C',
    competenciaTrabajada: () => true,
    IERegistroEvaluacion: { COMP: {} },
    IERegistroGrading: {
      sessionsFor: () => [],
      sessionsOn: () => []
    },
    calificarAreaMasiva: (val) => {
      const can = g.IERegistroNotas2UI.canEdit('promedios');
      if (!can) return false;
      store.finales[key + '||' + comps[0] + '||id:s1'] = { nivel: val, nota20: val === 'AD' ? 19 : val === 'A' ? 16 : val === 'B' ? 13 : 9, origen: 'letra' };
      g.IERegistroNotas2UI.refresh();
      return true;
    },
    quitarAreaMasiva: () => {
      const can = g.IERegistroNotas2UI.canEdit('promedios');
      if (!can) return false;
      delete store.finales[key + '||' + comps[0] + '||id:s1'];
      g.IERegistroNotas2UI.refresh();
      return true;
    },
    setPanel: (name) => {
      activePanel = name;
      ['panelCalificar', 'panelFinales', 'panelAvance', 'panelAsistencia'].forEach(id => {
        if (nodes[id]) nodes[id].classList.remove('on');
      });
      nodes['panel' + (name === 'promedios' ? 'Finales' : name === 'calificar' ? 'Calificar' : name === 'asistencia' ? 'Asistencia' : 'Avance')].classList.add('on');
    }
  };

  g.window = g;
  g.globalThis = g;
  g.global = g;

  g.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    requests.push(body);
if(body.action==='academicstate')return {ok:true,text:async()=>JSON.stringify({ok:true,academicReset:1,epoch:null,phase:'idle'})};

    if (body.action === 'loadnotas2') {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          notas2: 1,
          key,
          exists: true,
          action: 'loadnotas2',
          versions: { ...versions },
          at: { ...at },
          legacy,
          readonly: serverReadonly,
          payload: {
            sessions: copy(store.sessions),
            grades: copy(store.grades),
            capsSel: copy(store.capsSel),
            calificarEstado: copy(store.calificarEstado),
            finales: copy(store.finales),
            concComp: copy(store.concComp),
            competenciasEstado: copy(store.competenciasEstado),
            asistencia: copy(store.asistencia),
            asisFechas: copy(store.asisFechas),
            asisFechasEstado: copy(store.asisFechasEstado)
          }
        })
      };
    }

    if (body.action === 'savenotas2') {
      if (body.version !== versions[body.panel]) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ ok: false, code: 'CONFLICT' })
        };
      }
      versions[body.panel]++;
      at[body.panel] = Date.now();
      if (body.panel === 'promedios' && legacy) {
        legacy = false;
      }
      Object.assign(store, copy(body.payload));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          ok: true,
          notas2: 1,
          key,
          action: 'savenotas2',
          panel: body.panel,
          versions: { ...versions },
          at: { ...at },
          legacy,
          readonly: serverReadonly,
          payload: {
            sessions: copy(store.sessions),
            grades: copy(store.grades),
            capsSel: copy(store.capsSel),
            calificarEstado: copy(store.calificarEstado),
            finales: copy(store.finales),
            concComp: copy(store.concComp),
            competenciasEstado: copy(store.competenciasEstado),
            asistencia: copy(store.asistencia),
            asisFechas: copy(store.asisFechas),
            asisFechasEstado: copy(store.asisFechasEstado)
          }
        })
      };
    }

    throw new Error('Unknown action: ' + body.action);
  };

  const contextVm = vm.createContext(g);

  // Load connection, UI, and diagnostic scripts
  const connectionSrc = require('./registro-inline-modules.cjs').read('registro-connection.js');
  vm.runInContext(connectionSrc, contextVm);

  const uiSrc = fs.readFileSync(path.join(__dirname, '..', 'registro-notas2-ui.js'), 'utf8');
  vm.runInContext(uiSrc, contextVm);

  const diagSrc = fs.readFileSync(path.join(__dirname, '..', 'registro-sync-diagnostic-ui.js'), 'utf8');
  vm.runInContext(diagSrc, contextVm);

  return {
    g,
    connection: g.IERegistroConnection.current(),
    ui: g.IERegistroNotas2UI,
    recovery: g.IERegistroRecovery,
    diag: g.IERegistroSyncDiagnosticUI,
    nodes,
    store,
    requests,
    toasts,
    domFinNotas,
    domConclusions,
    addFinNota: (k, val = '') => {
      const inp = node('input');
      inp.value = val;
      inp.readOnly = false;
      inp.dataset = { key: k };
      inp.classes = ['fin-nota'];
      domFinNotas.push(inp);
      return inp;
    },
    addConclusion: (k, val = '') => {
      const ta = node('textarea');
      ta.value = val;
      ta.dataset = { key: k };
      ta.classes = ['academic-conclusion'];
      domConclusions.push(ta);
      return ta;
    },
    dispose: () => {
      activeTimers.forEach(id => clearTimeout(id));
      g.IERegistroConnection.current()?.dispose();
    },
    setRole: (r) => { role = r; },
    setToken: (t) => { token = t; },
    setOnline: (o) => { networkOnline = o; },
    setServerReadonly: (r) => { serverReadonly = r; },
    setPeriodClosed: (c) => { periodClosed = c; },
    setLegacy: (l) => { legacy = l; },
    versions
  };
}

test('CASO 1: Conexión docente autorizada + bimestre abierto', async () => {
  // A. legacy = true
  const hLegacy = createHarness({ role: 'docente', bim: 'III', legacy: true, initialPanel: 'promedios' });
  try {
    await hLegacy.connection.check(false, true);

    assert.equal(hLegacy.ui.canEdit('promedios'), true, 'legacy=true: Promedios must be editable');
    assert.equal(hLegacy.ui.canEdit('calificar'), false, 'legacy=true: Calificar must be strictly blocked');
    assert.equal(hLegacy.ui.canEdit('asistencia'), true, 'legacy=true: Asistencia must be editable');

    // Bulk actions in Promedios work immediately without requiring process()
    assert.equal(hLegacy.g.calificarAreaMasiva('A'), true, 'calificarAreaMasiva works under legacy');
    assert.equal(hLegacy.g.quitarAreaMasiva(), true, 'quitarAreaMasiva works under legacy');

    // N2-G.20B.1: Attempting to save Promedios without real modifications in legacy must be strictly blocked
    // (quitarAreaMasiva returned store to original state, so pending is false and processed is false)
    assert.equal(hLegacy.ui.current().status().panels.promedios.pending, false, 'No pending changes in Promedios');
    const saveNoChanges = await hLegacy.ui.save();
    assert.equal(saveNoChanges, false, 'Guardar sin modificaciones en Promedios legacy debe ser rechazado');
    assert.equal(hLegacy.ui.current().status().legacy, true, 'No debe adoptar si no hay cambios reales');
    assert.equal(hLegacy.requests.filter(r => r.action === 'savenotas2').length, 0, 'No debe enviar savenotas2 al backend sin cambios reales');

    // Calificar cannot be saved directly while legacy
    assert.equal(await hLegacy.ui.current().save('calificar'), false, 'Calificar cannot be saved while legacy');

    // Now make a real modification in Promedios
    assert.equal(hLegacy.g.calificarAreaMasiva('A'), true, 'calificarAreaMasiva works under legacy');
    assert.equal(hLegacy.ui.current().status().panels.promedios.pending, true, 'Real pending changes exist');

    // Saving Promedios with real changes adopts Notas 2.0 (clears legacy)
    const saveOk = await hLegacy.ui.save();
    assert.equal(saveOk, true, 'Promedios save succeeds');
    assert.equal(hLegacy.ui.current().status().legacy, false, 'Legacy is cleared after saving Promedios');
    assert.equal(hLegacy.ui.canEdit('calificar'), true, 'Calificar is now editable after adoption');

    // B. legacy = false
    const hAdopted = createHarness({ role: 'docente', bim: 'III', legacy: false, initialPanel: 'promedios' });
    try {
      await hAdopted.connection.check(false, true);
      assert.equal(hAdopted.ui.canEdit('promedios'), true, 'legacy=false: Promedios editable');
      assert.equal(hAdopted.ui.canEdit('calificar'), true, 'legacy=false: Calificar editable');
      assert.equal(hAdopted.ui.canEdit('asistencia'), true, 'legacy=false: Asistencia editable');
      assert.equal(hAdopted.g.calificarAreaMasiva('AD'), true, 'Bulk grading works immediately');
    } finally {
      hAdopted.dispose();
    }
  } finally {
    hLegacy.dispose();
  }
});

test('CASO 2: Modo Admin: solo lectura estricto, reintento operativo, sin permisos de escritura', async () => {
  const hAdmin = createHarness({ role: 'admin', bim: 'III', legacy: false, initialPanel: 'promedios' });
  try {
    await hAdmin.connection.check(false, true);

    assert.equal(hAdmin.ui.canEdit('promedios'), false, 'Admin cannot edit Promedios');
    assert.equal(hAdmin.ui.canEdit('calificar'), false, 'Admin cannot edit Calificar');
    assert.equal(hAdmin.ui.canEdit('asistencia'), false, 'Admin cannot edit Asistencia');
    assert.equal(hAdmin.g.calificarAreaMasiva('A'), false, 'Bulk buttons are blocked in Admin');

    // Indicator is neutral slate 'readonly'
    const ind = hAdmin.nodes.hdrSyncIndicator;
    assert.equal(ind.dataset.state, 'readonly');
    assert.equal(ind.title, 'Vista Administrador — solo lectura.');
    assert.equal(ind.querySelector('.sync-dot').style.backgroundColor, '#94a3b8');

    // Retry operates cleanly without granting write permissions
    await hAdmin.recovery.resolve();
    assert.equal(hAdmin.ui.canEdit('promedios'), false, 'Admin still strictly read-only after retry');
    assert.equal(hAdmin.nodes.hdrSyncIndicator.dataset.state, 'readonly');

    // N2-G.20B.1: Verify real non-destructive server check in Admin
    // When server is unreachable, Admin retry fails cleanly to 'server' (does NOT simulate success)
    hAdmin.g.sincronizarPeriodosNube = async () => false;
    await hAdmin.recovery.resolve();
    assert.equal(hAdmin.nodes.hdrSyncIndicator.dataset.state, 'server', 'Admin retry reflects real server failure');
    assert.equal(hAdmin.ui.canEdit('promedios'), false, 'Admin still strictly read-only on server failure');

    // Reconnecting to healthy server restores readonly
    hAdmin.g.sincronizarPeriodosNube = async () => true;
    await hAdmin.recovery.resolve();
    assert.equal(hAdmin.nodes.hdrSyncIndicator.dataset.state, 'readonly', 'Admin restored to readonly on verified server');
    assert.equal(hAdmin.ui.canEdit('promedios'), false, 'Admin remains strictly read-only');
  } finally {
    hAdmin.dispose();
  }
});

test('CASO 3: Bimestre cerrado en backend o frontend: solo lectura estricto', async () => {
  // Backend closed
  const hClosedServer = createHarness({ role: 'docente', bim: 'III', readonly: true, initialPanel: 'promedios' });
  try {
    await hClosedServer.connection.check(false, true);
    assert.equal(hClosedServer.ui.canEdit('promedios'), false);
    assert.equal(hClosedServer.nodes.hdrSyncIndicator.dataset.state, 'readonly');
    assert.equal(hClosedServer.nodes.hdrSyncIndicator.title, 'Bimestre cerrado — solo lectura.');
  } finally {
    hClosedServer.dispose();
  }

  // Frontend closed (historical period)
  const hClosedPeriod = createHarness({ role: 'docente', bim: 'I', periodClosed: true, initialPanel: 'promedios' });
  try {
    await hClosedPeriod.connection.check(false, true);
    assert.equal(hClosedPeriod.ui.canEdit('promedios'), false);
    assert.equal(hClosedPeriod.nodes.hdrSyncIndicator.dataset.state, 'readonly');
  } finally {
    hClosedPeriod.dispose();
  }
});

test('CASO 4: Sesión inválida o expirada: detiene edición inmediatamente', async () => {
  const h = createHarness({ role: 'docente', bim: 'III', legacy: false, initialPanel: 'promedios' });
  try {
    await h.connection.check(false, true);
    assert.equal(h.ui.canEdit('promedios'), true);

    // Invalidate session
    h.setToken('');
    await h.connection.check(false, true);

    assert.equal(h.ui.canEdit('promedios'), false, 'Edits stopped immediately on expired session');
    assert.equal(h.connection.snapshot().state, 'session');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'session');
    assert.equal(h.nodes.hdrSyncIndicator.title, 'Sesión inválida — vuelve a iniciar sesión.');
    assert.equal(h.nodes.hdrSyncIndicator.querySelector('.sync-dot').style.backgroundColor, '#ef4444');
  } finally {
    h.dispose();
  }
});

test('CASO 5: Invalidad / cambio de contexto durante solicitud en vuelo: re-verifica sin bucles ni quedar en checking', async () => {
  const h = createHarness({ role: 'docente', bim: 'III', legacy: false });
  try {
    let finishCloudPeriod;
    h.g.sincronizarPeriodosNube = () => new Promise(r => { finishCloudPeriod = r; });

    // Start check (flight active)
    const pCheck = h.connection.check(false, true);
    assert.equal(h.connection.snapshot().state, 'checking');

    // Invalidate during flight
    h.connection.invalidate();
    assert.equal(h.connection.snapshot().state, 'checking');

    // Finish in-flight request
    finishCloudPeriod(true);
    h.g.sincronizarPeriodosNube = async () => true;
    await pCheck;

    // Let the queued check from finally run
    await new Promise(r => setTimeout(r, 20));

    assert.notEqual(h.connection.snapshot().state, 'checking', 'Connection must not remain frozen at checking');
    assert.equal(h.connection.snapshot().state, 'connected', 'Re-verified successfully');
  } finally {
    h.dispose();
  }
});

test('CASO 6: Error transitorio de red: pasa a offline, no borra datos locales, recupera al reconectar', async () => {
  const h = createHarness({ role: 'docente', bim: 'III', legacy: false, initialPanel: 'promedios' });
  try {
    await h.connection.check(false, true);

    h.g.calificarAreaMasiva('A');
    const localSnapshot = JSON.stringify(h.store);

    // Network drops
    h.setOnline(false);
    h.connection.pause('offline');

    assert.equal(h.ui.canEdit('promedios'), false, 'Editing paused while offline');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'offline');
    assert.equal(h.nodes.hdrSyncIndicator.title, 'Conexión perdida. Estamos intentando reconectar…');
    assert.equal(JSON.stringify(h.store), localSnapshot, 'Local work strictly preserved');

    // Reconnection
    h.setOnline(true);
    await h.connection.check(false, true);

    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'pending', 'Shows pending local changes upon reconnect');
    assert.equal(h.nodes.hdrSyncIndicator.title, 'Conectado — cambios sin guardar.');
    assert.equal(JSON.stringify(h.store), localSnapshot, 'Data intact after reconnect');
  } finally {
    h.dispose();
  }
});

test('CASO 7: Conflicto CAS: bloquea guardado, muestra revisión/rojo, no sobrescribe notas', async () => {
  const h = createHarness({ role: 'docente', bim: 'III', legacy: false, initialPanel: 'promedios' });
  try {
    await h.connection.check(false, true);

    h.g.calificarAreaMasiva('A');
    const localData = JSON.stringify(h.store);

    // Version bumped in backend by session B
    h.versions.promedios = 99;

    // Attempt save
    const saveResult = await h.ui.save();
    assert.equal(saveResult, false, 'Save rejected due to CAS conflict');
    assert.equal(h.ui.current().status().state, 'conflict');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'review');
    assert.equal(h.nodes.hdrSyncIndicator.title, 'Conflicto de versiones — consulta la nube antes de guardar.');
    assert.equal(h.nodes.hdrSyncIndicator.querySelector('.sync-dot').style.backgroundColor, '#ef4444');
    assert.equal(JSON.stringify(h.store), localData, 'CAS rejection preserves local data');
  } finally {
    h.dispose();
  }
});

test('CASO 8: Asistencia: render y recolección no generan cambios espurios en asisFechas', async () => {
  const h = createHarness({ role: 'docente', bim: 'III', legacy: false, initialPanel: 'asistencia' });
  try {
    await h.connection.check(false, true);

    // Backend returned empty asisFechas: {}
    // Frontend attendance module initialized store.asisFechas = { "secundaria||III||1||A": [] }
    h.store.asisFechas = { 'secundaria||III||1||A': [] };

    // Trigger UI check/paint
    h.ui.refresh();
    await new Promise(r => setTimeout(r, 50));

    // No pending changes should be reported because empty array was normalized in capture()
    const status = h.ui.current().status();
    assert.equal(status.panels.asistencia.pending, false, 'No false pending on empty asisFechas');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'connected', 'Indicator remains green connected');
    assert.equal(h.nodes.hdrSyncIndicator.title, 'Conectado — notas verificadas.');
  } finally {
    h.dispose();
  }
});

test('CASO 9: Transición de colores de la nube: verde, amarillo, rojo y solo lectura corresponden exactamente', async () => {
  const h = createHarness({ role: 'docente', bim: 'III', legacy: false, initialPanel: 'promedios' });
  try {
    await h.connection.check(false, true);

    const dot = () => h.nodes.hdrSyncIndicator.querySelector('.sync-dot').style.backgroundColor;

    // 1. Verde (#10b981): Conectado y sin pendientes
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'connected');
    assert.equal(dot(), '#10b981');

    // 2. Amarillo/Ámbar (#f59e0b): Cambios pendientes
    h.g.calificarAreaMasiva('B');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'pending');
    assert.equal(dot(), '#f59e0b');

    // 3. Rojo (#ef4444): Error / sesión / conflicto
    h.connection.pause('session');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'session');
    assert.equal(dot(), '#ef4444');

    // 4. Solo lectura (#94a3b8): Neutral slate
    const hAdmin = createHarness({ role: 'admin', bim: 'III', legacy: false });
    try {
      await hAdmin.connection.check(false, true);
      assert.equal(hAdmin.nodes.hdrSyncIndicator.dataset.state, 'readonly');
      assert.equal(hAdmin.nodes.hdrSyncIndicator.querySelector('.sync-dot').style.backgroundColor, '#94a3b8');
    } finally {
      hAdmin.dispose();
    }
  } finally {
    h.dispose();
  }
});

test('CASO 10: Interacción real de DOM simulado: notas directas, masivas, notas inválidas y conclusiones en Promedios legacy', async () => {
  const noteKey = 'secundaria||III||1||A||Matemática||Resuelve problemas de cantidad||id:s1';
  const concKey = 'secundaria||III||1||A||Matemática||Resuelve problemas de cantidad||id:s1';

  // 1. Guardar sin modificaciones en Promedios legacy es rechazado y no emite savenotas2
  const h1 = createHarness({ role: 'docente', bim: 'III', legacy: true, initialPanel: 'promedios' });
  try {
    await h1.connection.check(false, true);
    const inp1 = h1.addFinNota(noteKey, ''); // DOM input vacío
    const ta1 = h1.addConclusion(concKey, ''); // DOM conclusion vacía

    const ok1 = await h1.ui.save();
    assert.equal(ok1, false, 'Guardar sin cambios debe ser rechazado');
    assert.equal(h1.toasts.includes('No hay cambios pendientes para guardar en Promedios.'), true, 'Muestra aviso de sin cambios');
    assert.equal(h1.requests.filter(r => r.action === 'savenotas2').length, 0, 'No emite savenotas2');
    assert.equal(h1.ui.current().status().legacy, true, 'No adopta legacy');

    // 2. Nota inválida en el DOM (> 20) es detectada por collect() y bloquea el guardado
    inp1.value = '25';
    const okInvalidHigh = await h1.ui.save();
    assert.equal(okInvalidHigh, false, 'Nota > 20 debe ser rechazada');
    assert.equal(h1.toasts.includes('Corrige las notas inválidas antes de guardar.'), true, 'Aviso de nota inválida');
    assert.equal(h1.requests.filter(r => r.action === 'savenotas2').length, 0, 'No emite savenotas2 con nota inválida');

    // Nota inválida negativa (< 0)
    inp1.value = '-3';
    const okInvalidNeg = await h1.ui.save();
    assert.equal(okInvalidNeg, false, 'Nota negativa debe ser rechazada');

    // 3. Nota directa válida recién modificada en el DOM se recolecta y guarda con éxito
    inp1.value = '17';
    const okValidNote = await h1.ui.save();
    assert.equal(okValidNote, true, 'Nota directa válida se guarda');
    assert.equal(h1.requests.filter(r => r.action === 'savenotas2').length, 1, 'Emite savenotas2');
    assert.equal(h1.ui.current().status().legacy, false, 'Adopta Notas 2.0 tras guardar');
    assert.equal(h1.ui.canEdit('calificar'), true, 'Calificar ahora editable tras adopción');
  } finally {
    h1.dispose();
  }

  // 4. Modificación de conclusión en el DOM se recolecta y permite guardar
  const h2 = createHarness({ role: 'docente', bim: 'III', legacy: true, initialPanel: 'promedios' });
  try {
    await h2.connection.check(false, true);
    h2.addFinNota(noteKey, '');
    const ta2 = h2.addConclusion(concKey, 'Evidencia de progreso notable.');

    const okConc = await h2.ui.save();
    assert.equal(okConc, true, 'Cambio de conclusión permite guardar');
    assert.equal(h2.requests.filter(r => r.action === 'savenotas2').length, 1, 'Emite savenotas2 para conclusión');
    assert.equal(h2.store.concComp[concKey]?.texto, 'Evidencia de progreso notable.', 'Conclusión sincronizada en store');
    assert.equal(h2.ui.current().status().legacy, false, 'Adopta Notas 2.0 tras guardar conclusión');
  } finally {
    h2.dispose();
  }

  // 5. Calificar legacy se mantiene estrictamente bloqueado
  const h3 = createHarness({ role: 'docente', bim: 'III', legacy: true, initialPanel: 'calificar' });
  try {
    await h3.connection.check(false, true);
    assert.equal(h3.ui.canEdit('calificar'), false, 'Calificar legacy no es editable');
    assert.equal(await h3.ui.current().save('calificar'), false, 'Guardar calificar legacy es rechazado');
    assert.equal(h3.requests.filter(r => r.action === 'savenotas2').length, 0, 'No emite savenotas2 para Calificar legacy');
  } finally {
    h3.dispose();
  }
});
