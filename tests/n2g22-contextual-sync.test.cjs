'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createHarness(options = {}) {
  const core = require(path.resolve(__dirname, '../registro-notas2.js'));
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

  let legacy = options.legacy !== undefined ? options.legacy : false;
  let serverReadonly = options.readonly !== undefined ? options.readonly : false;
  let periodClosed = options.periodClosed !== undefined ? options.periodClosed : false;
  let role = options.role || 'docente';
  let token = options.token || 'valid-token';
  let networkOnline = true;
  let serverFailNext = null;
  let casConflictNext = false;
  const requests = [];
  const events = {};
  const activeTimers = [];

  const nodes = {};
  function node(tag = 'div') {
    const n = {
      tagName: tag.toUpperCase(),
      children: [],
      classList: {
        _classes: new Set(),
        add(c) { this._classes.add(c); },
        remove(c) { this._classes.delete(c); },
        contains(c) { return this._classes.has(c); },
        toggle(c, v) { if (v === undefined) v = !this.contains(c); if (v) this.add(c); else this.remove(c); return v; }
      },
      style: {},
      dataset: {},
      title: '',
      value: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      disabled: false,
      readOnly: false,
      setAttribute(k, v) { this[k] = v; },
      getAttribute(k) { return this[k]; },
      appendChild(c) { this.children.push(c); if (c.id) nodes[c.id] = c; return c; },
      querySelector(s) {
        if (s === '.sync-dot') return this.dot || (this.dot = node('span'));
        if (s === '.sync-other-dot') return this.otherDot || (this.otherDot = node('span'));
        if (s.includes('span')) return this.span || (this.span = node('span'));
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
      showModal() { this.open = true; },
      close() { this.open = false; },
      remove() { delete nodes[this.id]; }
    };
    return n;
  }

  nodes.appHdr = node();
  nodes.appHdr.querySelector = () => ({ appendChild(c) { nodes[c.id] = c; return c; } });
  nodes.registroConnectionStatus = node();
  nodes.registroConnectionText = node();
  nodes.registroRetryOffer = node();
  nodes.registroRecoveryControls = node();
  nodes.panelFinales = node();
  nodes.panelCalificar = node();
  nodes.panelAvance = node();
  nodes.panelAsistencia = node();
  nodes.selGrado = node('select'); nodes.selGrado.value = String(context.grado || 1);
  nodes.selSeccion = node('select'); nodes.selSeccion.value = context.seccion || 'A';
  nodes.selBim = node('select'); nodes.selBim.value = context.bim || 'III';
  nodes.viewApp = node('div');
  nodes.viewHome = node('div');
  nodes.wrapSeccion = node('div');
  nodes.lblSesionActiva = node('div');
  nodes.registroTutorPanel = node('section'); nodes.registroTutorPanel.hidden = true;
  nodes.registroAcademicoPanel = node('div'); nodes.registroAcademicoPanel.hidden = false;
  nodes.registroAcademicFooter = node('div'); nodes.registroAcademicFooter.hidden = false;

  let activePanel = options.initialPanel || 'promedios';
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
    addEventListener: (e, fn) => { (events[e] || (events[e] = [])).push(fn); },
    dispatchEvent: (e) => {
      const fns = events[e.type] || [];
      for (const fn of fns) fn(e);
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
    areas: () => [context.area, 'Comunicación'],
    registroLocal: {
      matches: () => true,
      read: () => JSON.stringify(store),
      write: (data) => {}
    },
    store,
    sesionActiva: null,
    notas: {},
    cloudClaveReg: () => key,
    prefijoReg: () => key + '||',
    ctxBase: () => ({ nivel: 'primaria', bim: nodes.selBim?.value || context.bim, grado: parseInt(nodes.selGrado?.value || context.grado, 10), seccion: nodes.selSeccion?.value || context.seccion, area: g.areaActual || context.area }),
    selGrado: nodes.selGrado,
    selSeccion: nodes.selSeccion,
    selBim: nodes.selBim,
    nivel: 'primaria',
    padronBimestre: context.bim || 'III',
    gradosPermitidos: () => [1, 2],
    aulasPermitidas: () => [],
    loadBD: () => ({ primaria: { estudiantes: [{ grado: 1, seccion: 'A' }, { grado: 1, seccion: 'B' }, { grado: 2, seccion: 'A' }] } }),
    actualizarBotonesContextoRegistro: () => {},
    pintarBotonesContextoRegistro: () => {},
    actualizarUnidades: () => {},
    tutorRegistroController: null,
    cerrarTransversalesRegistro: () => true,
    renderAreas: () => {},
    fillComps: () => {},
    actualizarDocenteResponsable: () => {},
    fillCaps: () => {},
    loadCapsElegidas: () => {},
    renderChipsCaps: () => {},
    markClean: () => {},
    updateHdr: () => {},
    consultarEstadoSiagie: () => {},
    nivelPermitido: () => 'primaria',
    location: { href: '' },
    escapeRegistro: (x) => String(x),
    saveStore: () => {},
    registroSoloLectura: () => false,
    contextoActivoRegistro: { nivel: 'primaria', bim: context.bim || 'III', grado: parseInt(context.grado || 1, 10), seccion: context.seccion || 'A', area: context.area },
    estudiantes: () => students,
    studentKey: (s) => 'id:' + s.idSiagie,
    competencias: () => comps,
    esVistaAdmin: () => role === 'admin',
    bimestreHabilitado: (b) => b === 'III' && !periodClosed,
    registroConsultaHistorica: () => false,
    sincronizarPeriodosNube: async () => { if (serverFailNext) { serverFailNext = null; return false; } return true; },
    loadPeriodosAdmin: () => ({ bimestres: { III: periodClosed ? 'cerrado' : 'abierto' } }),
    sliceRegistroArea: () => copy(store),
    mergeRegistroPayload: (p) => { Object.assign(store, copy(p)); },
    guardarAsistencia: () => {},
    saveCapsElegidas: () => {},
    loadCapsElegidas: () => {},
    renderSesiones: () => {},
    renderStudents: () => {},
    renderFinales: () => {},
    renderAvance: () => {},
    renderAsistencia: () => {},
    sincronizarEdicionRegistro: () => {},
    recolectarPantalla: (pane) => {
      if (pane === 'promedios') {
        for (const n of domFinNotas) {
          if (!n.readOnly && n.value !== '') {
            store.finales[n.dataset.key] = { nivel: n.value, nota20: 15, origen: 'letra', ts: Date.now() };
          }
        }
        for (const c of domConclusions) {
          if (c.value !== '') {
            store.concComp[c.dataset.key] = c.value;
          }
        }
      }
    },
    metaRegistro: () => ({ notas2: { schema: 1, adopted: !legacy } }),
    leerNota: (map, k) => map[k] || null,
    retirarVerificacionNube: () => {},
    toast: (msg) => { toasts.push(msg); },
    confirm: () => true,
    IERegistroEvaluacion: {},
    IERegistroGrading: {
      sessionsOn: () => [],
      sessionsFor: () => [],
      calculated: () => ({ letra: 'A', nota: 15 })
    },
    fetch: async (url, opts) => {
      const body = JSON.parse(opts.body);
      requests.push(body);
if(body.action==='academicstate')return {ok:true,text:async()=>JSON.stringify({ok:true,academicReset:1,epoch:null,phase:'idle'})};
      if (serverFailNext) {
        const code = serverFailNext;
        serverFailNext = null;
        return { ok: false, status: code === 'SESSION' ? 401 : 500, text: async () => JSON.stringify({ ok: false, code }) };
      }
      if (body.action === 'loadnotas2') {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            notas2: 1,
            key,
            readonly: serverReadonly,
            legacy,
            exists: true,
            versions: copy(versions),
            at: copy(at),
            payload: copy(store)
          })
        };
      }
      if (body.action === 'savenotas2') {
        if (casConflictNext) {
          casConflictNext = false;
          return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ ok: false, code: 'CONFLICT', error: 'Conflicto CAS' })
          };
        }
        const panel = body.panel;
        const now = Date.now();
        versions[panel] = Math.max(versions[panel] + 1, now);
        at[panel] = now;
        Object.assign(store, copy(body.payload));
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            ok: true,
            notas2: 1,
            panel,
            key,
            readonly: serverReadonly,
            legacy: false,
            exists: true,
            versions: copy(versions),
            at: copy(at),
            payload: copy(store)
          })
        };
      }
      return { ok: false, status: 400, text: async () => '{"ok":false}' };
    }
  };

  g.window = g;
  vm.createContext(g);

  // Load connection and UI modules
  const connCode = fs.readFileSync(path.resolve(__dirname, '../registro-connection.js'), 'utf8');
  vm.runInContext(connCode, g);

  const uiCode = fs.readFileSync(path.resolve(__dirname, '../registro-notas2-ui.js'), 'utf8');
  vm.runInContext(uiCode, g);

  const regHtml = fs.readFileSync(path.resolve(__dirname, '../registro.html'), 'utf8');
  function extractFn(name) {
    const a = regHtml.search(new RegExp('(?:async )?function ' + name + '\\('));
    assert.ok(a >= 0, name);
    return regHtml.slice(a, regHtml.indexOf('\n}', a) + 2);
  }
  for (const fn of ['actualizarAvisoPadronContexto', 'confirmarSalidaContexto', 'onGrado', 'onContexto', 'setArea', 'volverHome', 'guardarTodo']) {
    vm.runInContext(extractFn(fn), g);
  }

  return {
    g,
    store,
    versions,
    at,
    requests,
    toasts,
    nodes,
    domFinNotas,
    domConclusions,
    get connection() { return g.IERegistroConnection.current(); },
    get ui() { return g.IERegistroNotas2UI; },
    setNetworkOnline: (v) => { networkOnline = v; },
    setServerFailNext: (code) => { serverFailNext = code; },
    setCasConflictNext: (v) => { casConflictNext = v; },
    setPeriodClosed: (v) => { periodClosed = v; },
    setRole: (r) => { role = r; },
    setServerReadonly: (v) => { serverReadonly = v; },
    setLegacy: (v) => { legacy = v; },
    switchPanel: (p) => {
      activePanel = p;
      nodes.panelCalificar.classList.toggle('on', p === 'calificar');
      nodes.panelFinales.classList.toggle('on', p === 'promedios');
      nodes.panelAsistencia.classList.toggle('on', p === 'asistencia');
      nodes.panelAvance.classList.toggle('on', p === 'resumen');
      g.IERegistroNotas2UI.refresh();
    },
    dispose: () => {
      for (const id of activeTimers) clearTimeout(id);
    }
  };
}

// ============================================================================
// ESCENARIOS DE PRUEBA OBLIGATORIOS (CONDICIÓN 9)
// ============================================================================

test('1. Guardar masivo C en Promedios: transiciona de naranja a verde inmediatamente tras confirmación', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    const ind = h.nodes.hdrSyncIndicator;
    assert.equal(ind.dataset.state, 'connected', 'Debe iniciar en verde (connected)');

    // Simular nota ingresada en Promedios
    h.store.finales[h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1'] = {
      nivel: 'C', nota20: 8, origen: 'letra', ts: Date.now()
    };
    api.refresh();

    assert.equal(ind.dataset.state, 'pending', 'Debe pasar a naranja (pending) al editar Promedios');
    assert.equal(ind.style.color, '#fde68a');

    // Guardar Promedios
    const ok = await api.save();
    assert.equal(ok, true, 'Guardar Promedios debe confirmarse con éxito');

    // Debe transicionar inmediatamente a verde (connected)
    assert.equal(ind.dataset.state, 'connected', 'Debe transicionar inmediatamente a verde');
    assert.equal(ind.querySelector('.sync-dot').style.backgroundColor, '#10b981', 'El punto debe ser #10b981');
    assert.equal(ind.title, 'Conectado — notas verificadas.');
  } finally {
    h.dispose();
  }
});

test('2. Calificar pendiente y Promedios limpio: nube verde con aviso de Calificar', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    // Promedios está limpio, introducimos una nota en Calificar
    h.store.grades[h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||Cap1||2026-10-20||id:s1'] = {
      nivel: 'A', nota20: 15, origen: 'numero', ts: Date.now()
    };
    api.refresh();

    const ind = h.nodes.hdrSyncIndicator;
    // Como el panel activo es Promedios y Promedios está limpio, la nube principal es verde
    assert.equal(ind.dataset.state, 'connected', 'El panel activo (Promedios) limpio debe verse verde');
    assert.equal(ind.querySelector('.sync-dot').style.backgroundColor, '#10b981');

    // Debe mostrar aviso discreto de Calificar
    const otherDot = ind.querySelector('.sync-other-dot');
    assert.ok(otherDot, 'Debe existir el punto auxiliar');
    assert.equal(otherDot.style.display, 'inline-block', 'El punto auxiliar debe estar visible');
    assert.equal(otherDot.style.backgroundColor, '#f59e0b', 'El punto auxiliar debe ser ámbar (#f59e0b)');
    assert.ok(ind.title.includes('Calificar con cambios sin guardar'), 'El título debe advertir sobre Calificar: ' + ind.title);
  } finally {
    h.dispose();
  }
});

test('3. Promedios pendiente y Calificar limpio: Calificar se ve verde con aviso de Promedios', async () => {
  const h = createHarness({ initialPanel: 'calificar' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    // Calificar limpio, Promedios con cambios pendientes
    h.store.finales[h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1'] = {
      nivel: 'AD', nota20: 19, origen: 'letra', ts: Date.now()
    };
    api.refresh();

    const ind = h.nodes.hdrSyncIndicator;
    // Panel activo es Calificar y está limpio -> verde
    assert.equal(ind.dataset.state, 'connected', 'Calificar limpio debe verse verde');
    assert.equal(ind.querySelector('.sync-dot').style.backgroundColor, '#10b981');

    // Aviso de Promedios
    const otherDot = ind.querySelector('.sync-other-dot');
    assert.equal(otherDot.style.display, 'inline-block');
    assert.ok(ind.title.includes('Promedios con cambios sin guardar'), 'Debe advertir sobre Promedios: ' + ind.title);

    // Si el docente conmuta a Promedios, el indicador principal pasa a ámbar (pending)
    h.switchPanel('promedios');
    assert.equal(ind.dataset.state, 'pending', 'Al conmutar a Promedios debe pasar a pendiente');
    assert.equal(otherDot.style.display, 'none', 'El punto auxiliar se oculta porque el activo es el pendiente');
  } finally {
    h.dispose();
  }
});

test('4. Selección y deselección de capacidad (Condición 1): sin falso pendiente en vacíos y detección de eliminación real', async () => {
  const h = createHarness({ initialPanel: 'calificar' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    const dateKey = h.g.cloudClaveReg() + '||2026-10-20';

    // A) Inicialización: store.capsSel[dateKey] = []
    h.store.capsSel[dateKey] = [];
    api.refresh();
    assert.equal(api.current().pending('calificar'), false, 'Array vacío generado por UI no debe ser pendiente espurio');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'connected', 'Nube debe mantenerse verde');

    // B) Selección real de capacidad
    h.store.capsSel[dateKey] = [{ comp: 'Resuelve problemas de cantidad', cap: 'Traduce cantidades' }];
    api.refresh();
    assert.equal(api.current().pending('calificar'), true, 'Seleccionar capacidad DEBE detectarse como pendiente');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'pending');

    // C) Guardar selección de capacidad
    const okSave = await api.save();
    assert.equal(okSave, true, 'Guardado de Calificar debe tener éxito');
    assert.equal(api.current().pending('calificar'), false, 'Tras guardar, debe estar limpio');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'connected');

    // D) Deselección / eliminación real de la capacidad
    h.store.capsSel[dateKey] = [];
    api.refresh();
    assert.equal(api.current().pending('calificar'), true, 'Eliminar la capacidad previamente confirmada DEBE detectarse como pendiente real');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'pending');

    // E) Guardar la eliminación
    const okSaveDel = await api.save();
    assert.equal(okSaveDel, true, 'Guardado de la eliminación debe tener éxito');
    assert.equal(api.current().pending('calificar'), false, 'Tras guardar eliminación, debe quedar limpio');
    assert.equal(h.nodes.hdrSyncIndicator.dataset.state, 'connected');
  } finally {
    h.dispose();
  }
});

test('5. Cambio entre paneles sin escrituras espurias ni pérdida de estado (Condición 7)', async () => {
  const h = createHarness({ initialPanel: 'calificar' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    const initialRequestsCount = h.requests.length;

    // Agregar notas en Calificar y en Promedios
    const gKey = h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||Cap1||2026-10-20||id:s1';
    const fKey = h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s2';
    h.store.grades[gKey] = { nivel: 'B', nota20: 12, origen: 'numero', ts: Date.now() };
    h.store.finales[fKey] = { nivel: 'A', nota20: 15, origen: 'letra', ts: Date.now() };

    // Conmutar varias veces entre paneles
    h.switchPanel('promedios');
    h.switchPanel('asistencia');
    h.switchPanel('resumen');
    h.switchPanel('calificar');

    // Verificar: NINGUNA petición HTTP adicional fue disparada por cambiar de panel
    assert.equal(h.requests.length, initialRequestsCount, 'No debe haber escrituras automáticas ni cargas remotas al cambiar de panel');

    // Verificar: Las notas de ambos paneles siguen intactas en memoria
    assert.equal(h.store.grades[gKey].nota20, 12, 'Las notas de Calificar deben conservarse intactas');
    assert.equal(h.store.finales[fKey].nivel, 'A', 'Las notas de Promedios deben conservarse intactas');
  } finally {
    h.dispose();
  }
});

test('6A. Cambio de grado (onGrado): detectar grado anterior fiable, aceptar vs cancelar sin perder cambios ni autoguardado', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    // Contexto inicial: grado 1, sección A
    assert.equal(h.g.contextoActivoRegistro.grado, 1);
    const fKey = h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1';
    h.store.finales[fKey] = { nivel: 'AD', nota20: 19, origen: 'letra', ts: Date.now() };
    api.refresh();

    // Simular que el usuario cambia selGrado a 2 pero CANCELA en el prompt
    let promptShown = false;
    h.g.confirm = (msg) => {
      promptShown = true;
      assert.ok(msg.includes('Promedios'), 'El prompt debe listar el panel con cambios: ' + msg);
      assert.ok(msg.includes('cambiar de grado'), 'El prompt debe indicar la acción específica: ' + msg);
      return false; // Cancela
    };

    h.nodes.selGrado.value = '2';
    h.g.onGrado();

    // Verificaciones tras cancelar:
    assert.equal(promptShown, true, 'Debe mostrar el prompt al intentar cambiar de grado');
    assert.equal(h.nodes.selGrado.value, '1', 'selGrado debe restaurarse al grado anterior (1)');
    assert.equal(h.g.contextoActivoRegistro.grado, 1, 'El contexto activo debe seguir siendo grado 1');
    assert.equal(h.store.finales[fKey].nivel, 'AD', 'Los cambios en memoria deben permanecer intactos');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'No debe emitirse ningún guardado remoto');

    // Ahora el usuario cambia selGrado a 2 y ACEPTA salir sin guardar
    promptShown = false;
    h.g.confirm = () => { promptShown = true; return true; }; // Acepta

    h.nodes.selGrado.value = '2';
    h.g.onGrado();

    // Verificaciones tras aceptar:
    assert.equal(promptShown, true, 'Debe mostrar prompt');
    assert.equal(h.nodes.selGrado.value, '2', 'selGrado debe reflejar el nuevo grado (2)');
    assert.equal(h.g.contextoActivoRegistro.grado, 2, 'El contexto activo debe actualizarse a grado 2');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'NUNCA debe guardar remotamente en la nube');
  } finally {
    h.dispose();
  }
});

test('6B. Cambio de sección (onContexto): detectar sección anterior fiable, aceptar vs cancelar y cero confirmaciones en inicialización', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    // Contexto inicial: grado 1, sección A
    assert.equal(h.g.contextoActivoRegistro.seccion, 'A');

    // Inicialización / renderizado sin cambios NO debe mostrar prompt alguno
    let promptShown = false;
    h.g.confirm = () => { promptShown = true; return true; };
    h.g.onContexto();
    assert.equal(promptShown, false, 'No debe pedir confirmación durante inicialización o refresco sin cambios');

    // Agregar nota pendiente en Promedios
    const fKey = h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1';
    h.store.finales[fKey] = { nivel: 'B', nota20: 13, origen: 'letra', ts: Date.now() };
    api.refresh();

    // El usuario cambia selSeccion a 'B' pero CANCELA
    promptShown = false;
    h.g.confirm = (msg) => {
      promptShown = true;
      assert.ok(msg.includes('cambiar de sección'), 'El prompt debe indicar cambiar de sección: ' + msg);
      return false; // Cancela
    };

    h.nodes.selSeccion.value = 'B';
    h.g.onContexto();

    assert.equal(promptShown, true, 'Debe mostrar confirmación al cambiar sección con cambios pendientes');
    assert.equal(h.nodes.selSeccion.value, 'A', 'selSeccion debe restaurarse a la sección previa (A)');
    assert.equal(h.g.contextoActivoRegistro.seccion, 'A', 'El contexto activo debe mantenerse en sección A');
    assert.equal(h.store.finales[fKey].nivel, 'B', 'Los datos deben conservarse intactos');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'No debe haber escrituras remotas');

    // El usuario cambia selSeccion a 'B' y ACEPTA
    promptShown = false;
    h.g.confirm = () => { promptShown = true; return true; }; // Acepta

    h.nodes.selSeccion.value = 'B';
    h.g.onContexto();

    assert.equal(promptShown, true, 'Debe mostrar prompt');
    assert.equal(h.nodes.selSeccion.value, 'B', 'selSeccion debe quedar en la nueva sección (B)');
    assert.equal(h.g.contextoActivoRegistro.seccion, 'B', 'El contexto activo debe pasar a sección B');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'Cero escrituras remotas involuntarias');
  } finally {
    h.dispose();
  }
});

test('6C. Cambio de área (setArea) y bimestre: aceptar vs cancelar sin escrituras remotas', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    assert.equal(h.g.areaActual, 'Matemática');
    const fKey = h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1';
    h.store.finales[fKey] = { nivel: 'AD', nota20: 18, origen: 'letra', ts: Date.now() };
    api.refresh();

    // Cambiar área a Comunicación cancelando
    let promptShown = false;
    h.g.confirm = (msg) => {
      promptShown = true;
      assert.ok(msg.includes('cambiar de área'));
      return false;
    };
    h.g.setArea('Comunicación');

    assert.equal(promptShown, true);
    assert.equal(h.g.areaActual, 'Matemática', 'El área debe seguir siendo Matemática tras cancelar');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0);

    // Cambiar área a Comunicación aceptando
    promptShown = false;
    h.g.confirm = () => { promptShown = true; return true; };
    h.g.setArea('Comunicación');

    assert.equal(promptShown, true);
    assert.equal(h.g.areaActual, 'Comunicación', 'El área debe actualizarse a Comunicación tras aceptar');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'Cero escrituras remotas');
  } finally {
    h.dispose();
  }
});

test('6D. Salida sin guardar (volverHome) y persistencia local (guardarTodo): cero escrituras remotas y sin adopción legacy', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    const fKey = h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1';
    h.store.finales[fKey] = { nivel: 'A', nota20: 15, origen: 'letra', ts: Date.now() };
    api.refresh();

    // Salir cancelando
    let promptShown = false;
    h.g.confirm = (msg) => { promptShown = true; return false; };
    h.g.volverHome();

    assert.equal(promptShown, true);
    assert.equal(h.g.location.href, '', 'No debe redirigir si se cancela');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0);

    // Salir aceptando
    promptShown = false;
    h.g.confirm = () => { promptShown = true; return true; };
    h.g.volverHome();

    assert.equal(promptShown, true);
    assert.equal(h.g.location.href, 'index.html', 'Debe redirigir al index al aceptar');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'NUNCA debe guardar automáticamente en la nube');
    assert.equal(h.store.finales[fKey].nivel, 'A', 'Los datos locales legítimos se preservan en memoria');
  } finally {
    h.dispose();
  }
});

test('6E. confirmarSalidaContexto recolecta ediciones del DOM recientes y nota inválida (> 20) no borra modificaciones al cancelar', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    // Configurar un elemento en el DOM simulado
    const fKey = h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1';
    const fakeInput = { dataset: { key: fKey }, value: '', readOnly: false };
    h.domFinNotas.push(fakeInput);

    // El docente teclea una nota inválida (> 20) directamente en el input
    fakeInput.value = '99';

    // confirmarSalidaContexto recolecta y detecta que hay cambios/inválidos
    let promptShown = false;
    h.g.confirm = (msg) => {
      promptShown = true;
      assert.ok(msg.includes('Promedios'), 'Debe advertir sobre el panel con cambios: ' + msg);
      return false; // Cancela salida
    };

    const resCancel = h.g.confirmarSalidaContexto('salir');
    assert.equal(promptShown, true, 'Debe disparar el prompt de confirmación');
    assert.equal(resCancel, false, 'Al cancelar debe retornar false');
    assert.equal(fakeInput.value, '99', 'El valor editado por el docente NO debe borrarse ni perderse del DOM');

    // El docente corrige a una nota válida '16'
    fakeInput.value = '16';
    promptShown = false;
    h.g.confirm = (msg) => { promptShown = true; return true; }; // Acepta

    const resAccept = h.g.confirmarSalidaContexto('salir');
    assert.equal(promptShown, true, 'Debe detectar las ediciones recolectadas del DOM');
    assert.equal(resAccept, true, 'Al aceptar debe permitir salir');
    assert.equal(h.store.finales[fKey].nota20, 15, 'recolectarPantalla capturó la edición');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'Cero peticiones savenotas2');
  } finally {
    h.dispose();
  }
});

test('6F. Evitar mensajes duplicados: aceptar cambio de grado no dispara segundo prompt para sección', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    // Agregar cambio pendiente
    const fKey = h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1';
    h.store.finales[fKey] = { nivel: 'AD', nota20: 20, origen: 'letra', ts: Date.now() };
    api.refresh();

    // Contar cuántas veces se llama confirm() durante onGrado
    let confirmCallCount = 0;
    h.g.confirm = (msg) => {
      confirmCallCount++;
      return true; // Acepta cambiar de grado
    };

    h.nodes.selGrado.value = '2';
    h.g.onGrado();

    // Debe llamarse EXACTAMENTE UNA VEZ (para grado), no una segunda vez para sección
    assert.equal(confirmCallCount, 1, 'Debe mostrarse exactamente un diálogo de confirmación, sin duplicados');
    assert.equal(h.nodes.selGrado.value, '2');
    assert.equal(h.g.contextoActivoRegistro.grado, 2);
  } finally {
    h.dispose();
  }
});

test('7. Conflicto CAS, offline, server error y checking (Condición 4): prioridad estricta sin pintar verde falso', async () => {
  const h = createHarness({ initialPanel: 'promedios' });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    const ind = h.nodes.hdrSyncIndicator;
    assert.equal(ind.dataset.state, 'connected', 'Debe estar connected');

    // A) Offline -> offline (rojo)
    h.setNetworkOnline(false);
    h.g.dispatchEvent(new h.g.Event('offline'));
    assert.equal(ind.dataset.state, 'offline', 'Pasa a offline');
    assert.equal(ind.querySelector('.sync-dot').style.backgroundColor, '#ef4444', 'Debe ser rojo (#ef4444)');

    // Reconectar red
    h.setNetworkOnline(true);
    await h.connection.check(true, true);
    assert.equal(ind.dataset.state, 'connected', 'Reconexión exitosa');

    // B) Error de Servidor (500) -> server (rojo)
    h.setServerFailNext('SERVER');
    await h.connection.check(false, true);
    assert.equal(ind.dataset.state, 'server', 'Error de servidor debe pasar a server');
    assert.equal(ind.querySelector('.sync-dot').style.backgroundColor, '#ef4444', 'Debe ser rojo (#ef4444)');

    // Restaurar servidor
    await h.connection.check(false, true);
    assert.equal(ind.dataset.state, 'connected', 'Servidor recuperado');

    // C) Solo lectura (Bimestre cerrado) -> readonly (slate)
    h.setPeriodClosed(true);
    await h.connection.check(false, true);
    assert.equal(ind.dataset.state, 'readonly', 'Bimestre cerrado debe ser readonly');
    assert.equal(ind.querySelector('.sync-dot').style.backgroundColor, '#94a3b8', 'Debe ser slate (#94a3b8)');

    // Reabrir periodo
    h.setPeriodClosed(false);
    await h.connection.check(false, true);
    assert.equal(ind.dataset.state, 'connected', 'Periodo abierto');

    // D) Conflicto CAS -> review (rojo)
    h.setCasConflictNext(true);
    h.store.finales[h.g.cloudClaveReg() + '||' + h.g.competencias()[0] + '||id:s1'] = { nivel: 'C', nota20: 8, origen: 'letra', ts: Date.now() };
    await api.save();
    assert.equal(ind.dataset.state, 'review', 'Conflicto CAS debe pasar a review');
    assert.equal(ind.querySelector('.sync-dot').style.backgroundColor, '#ef4444', 'Debe ser rojo (#ef4444)');
  } finally {
    h.dispose();
  }
});

test('8. Persistencia histórica / legacy: no adopta sin procesar y conserva persistencia local de asistencia', async () => {
  const h = createHarness({ initialPanel: 'promedios', legacy: true });
  try {
    const api = h.g.IERegistroNotas2UI;
    await h.connection.check(false, true);
    h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));

    // En contexto legacy, Guardar Promedios sin cambios no emite savenotas2
    const saveWithoutEdits = await api.save();
    assert.equal(saveWithoutEdits, false, 'Guardar sin cambios en legacy debe rechazarse');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'No debe emitir savenotas2');

    // Asistencia se guarda y persiste localmente sin adoptar ni enviar académico
    h.switchPanel('asistencia');
    const saveAsis = await api.save();
    assert.equal(saveAsis, true, 'Guardar asistencia local debe ser exitoso');
    assert.equal(h.requests.filter(r => r.action === 'savenotas2').length, 0, 'Guardar asistencia no envía academic savenotas2');
  } finally {
    h.dispose();
  }
});

for (const [field,action] of [['selGrado','onGrado'],['selSeccion','onContexto'],['selBim','cambiarBimestreRegistro']]) {
 test('dynamic binding: '+field+' warns before leaving the old pending context',async()=>{
  const h=createHarness({initialPanel:'promedios'});
  try {
   h.g.cloudClaveReg=()=>[h.g.ctxBase().nivel,h.g.ctxBase().bim,h.g.ctxBase().grado,h.g.ctxBase().seccion,h.g.ctxBase().area].join('||');
   h.g.prefijoReg=()=>h.g.cloudClaveReg()+'||';
   // Keep the server's synthetic context consistent with its response.
   h.g.ctxBase=()=>({nivel:'secundaria',bim:h.nodes.selBim.value,grado:Number(h.nodes.selGrado.value),seccion:h.nodes.selSeccion.value,area:h.g.areaActual});
   h.g.contextoActivoRegistro={...h.g.ctxBase()};
   const source=fs.readFileSync(path.resolve(__dirname,'../registro.html'),'utf8');
   const start=source.indexOf('async function cambiarBimestreRegistro(');
   vm.runInContext(source.slice(start,source.indexOf('\n}',start)+2),h.g);
   await h.connection.check(false,true);
   const oldKey=h.g.cloudClaveReg(),noteKey=oldKey+'||C1||id:s1';
   h.store.finales[noteKey]={nivel:'A',nota20:15,origen:'letra'};
   let prompts=0;h.g.confirm=()=>{prompts++;return false;};
   h.nodes[field].value=field==='selGrado'?'2':field==='selSeccion'?'B':'IV';
   await h.g[action]();
   assert.equal(prompts,1,'must inspect pending changes using the previous binding');
   assert.equal(h.g.cloudClaveReg(),oldKey,'cancel restores original selectors');
   assert.equal(h.store.finales[noteKey].nivel,'A');
   assert.equal(h.requests.filter(r=>r.action==='savenotas2').length,0);
  } finally {h.dispose();}
 });
}

test('historical normalization admits exact context hooks and never masks a mutated academic handler',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../registro.html'),'utf8').replace(/\r\n/g,'\n');
 const boundary=s=>require('./n2g22-context-boundary.cjs')(require('./notas2-worked-boundary.cjs')('registro.html',s));
 const old=require('node:child_process').execFileSync('git',['show','e2774536d360fce75949cbd0254517a2995cb073:registro.html'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
 assert.equal(boundary(source),old);
 assert.notEqual(boundary(source.replace('function confirmarSalidaContexto(accionTexto) {','function confirmarSalidaContexto(accionTexto) { throw Error("mutated");')),old);
 assert.notEqual(boundary(source.replace('function guardarTodo() {','function guardarTodo() { throw Error("mutated");')),old);
});

test('leaving the page protects pending work even when the active panel is clean',async()=>{
 const h=createHarness({initialPanel:'promedios'});
 try {
  await h.connection.check(false,true);
  h.g.document.dispatchEvent(new h.g.Event('DOMContentLoaded'));
  let blocked=false;const event={type:'beforeunload',preventDefault(){blocked=true;}};
  h.g.dispatchEvent(event);assert.equal(blocked,false);
  h.store.grades[h.g.cloudClaveReg()+'||C1||Cap1||2026-10-20||id:s1']={nivel:'B',nota20:12,origen:'letra'};
  h.ui.refresh();assert.equal(h.ui.activePending(),false);assert.equal(h.ui.hasPending(),true);
  h.g.dispatchEvent(event);assert.equal(blocked,true);assert.equal(event.returnValue,'');
  assert.equal(h.requests.filter(r=>r.action==='savenotas2').length,0);
 } finally {h.dispose();}
});
