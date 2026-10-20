// Pruebas unitarias automatizadas para visibilidad y comportamiento del botón «Reintentar notas» (#registroRetryOffer)
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../registro-notas2.js');

function createTestHarness(initialPane = 'calificar') {
  const context = { nivel: 'primaria', bim: 'I', grado: 1, seccion: 'A', area: 'Matemática' };
  const key = Object.values(context).join('||');
  const prefix = key + '||';
  const data = Object.fromEntries(Object.values(core.fields).flat().map(f => [f, f === 'sessions' ? [] : {}]));

  let currentPane = initialPane;
  const elements = {
    registroSaveState: { textContent: '' },
    registroRetryOffer: { id: 'registroRetryOffer', hidden: true, onclick: null },
    registroConnectionStatus: { id: 'registroConnectionStatus', dataset: {}, style: {} },
    registroConnectionText: { id: 'registroConnectionText', textContent: '' },
    panelCalificar: { classList: { contains: (c) => c === 'on' && currentPane === 'calificar' } },
    panelFinales: { classList: { contains: (c) => c === 'on' && currentPane === 'promedios' } },
    panelAvance: { classList: { contains: (c) => c === 'on' && currentPane === 'resumen' } },
    panelAsistencia: { classList: { contains: (c) => c === 'on' && currentPane === 'asistencia' } }
  };

  let connectionListener = null;
  let connectionState = 'checking';
  let checkCalled = 0;

  const g = {
    CLOUD_API_URL: 'https://synthetic.invalid/exec',
    sesionActiva: null,
    notas: {},
    capsElegidas: [],
    console,
    setTimeout: (fn) => typeof fn === 'function' ? fn() : 1,
    clearTimeout: () => {},
    AbortController,
    Date,
    Map,
    JSON,
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    navigator: { onLine: true },
    window: null,
    IERegistroNotas2: core,
    registroDependenciaFallida: () => {},
    cloudClaveReg: () => key,
    getLoginSession: () => ({ token: 'mock-token', role: 'docente', nombre: 'DOCENTE FICTICIO' }),
    IEStudents: { validToken: () => 'mock-token' },
    padronBimestre: 'I',
    tokenPadron: 'mock-token',
    areaActual: 'Matemática',
    areas: () => ['Matemática'],
    registroLocal: { matches: () => true, read: () => '{}', write: () => {} },
    ctxBase: () => context,
    esVistaAdmin: () => false,
    bimestreHabilitado: () => true,
    registroConsultaHistorica: () => false,
    registroHistoricoProyectando: false,
    prefijoReg: () => prefix,
    sliceRegistroArea: () => ({ ...data }),
    store: data,
    mergeRegistroPayload: (p) => Object.assign(data, p),
    toast: () => {},
    recolectarPantalla: () => {},
    saveCapsElegidas: () => {},
    loadCapsElegidas: () => {},
    sincronizarPeriodosNube: async () => true,
    renderSesiones: () => {},
    renderStudents: () => {},
    renderFinales: () => {},
    sincronizarEdicionRegistro: () => {},
    guardarAsistencia: () => {},
    IERegistroGrading: { sessionsFor: () => [], sessionsOn: () => [] },
    confirm: () => true,
    IERegistroConnection: {
      create: (o) => {
        connectionListener = o.changed;
        return {
          canEdit: () => true,
          check: async () => { checkCalled++; return { ok: true }; },
          invalidate: () => {},
          snapshot: () => ({ state: connectionState })
        };
      }
    }
  };

  g.window = g;
  vm.createContext(g);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'registro-notas2-ui.js'), 'utf8'), g);

  return {
    elements,
    setPane(pane) {
      currentPane = pane;
      if (g.IERegistroNotas2UI) {
        g.IERegistroNotas2UI.persist?.(); // triggers internal state if needed
      }
    },
    simulateState(state) {
      connectionState = state;
      if (connectionListener) {
        connectionListener({ state });
      }
    },
    getCheckCount: () => checkCalled
  };
}

// Notas 2.0 keeps retry in the diagnostic, never the habitual footer.
// 1. Error en Calificar: oculto
test('1. Error de servidor u offline en Calificar: «Reintentar notas» permanece en diagnóstico', () => {
  const harness = createTestHarness('calificar');
  harness.simulateState('server');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Debe permanecer fuera del pie ante error de servidor en Calificar');
  harness.simulateState('offline');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Debe permanecer fuera del pie ante offline en Calificar');
});

// 2. Error en Promedios: visible
test('2. Error de servidor u offline en Promedios: «Reintentar notas» permanece en diagnóstico', () => {
  const harness = createTestHarness('promedios');
  harness.simulateState('server');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Debe permanecer fuera del pie ante error de servidor en Promedios');
  harness.simulateState('offline');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Debe permanecer fuera del pie ante offline en Promedios');
});

// 3. Error en Resumen: oculto
test('3. Error en Resumen: «Reintentar notas» permanece oculto', () => {
  const harness = createTestHarness('resumen');
  harness.simulateState('server');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Debe estar oculto en Resumen incluso con error server');
  harness.simulateState('offline');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Debe estar oculto en Resumen incluso con error offline');
});

// 4. Error en Asistencia: oculto
test('4. Error en Asistencia: «Reintentar notas» permanece oculto', () => {
  const harness = createTestHarness('asistencia');
  harness.simulateState('server');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Debe estar oculto en Asistencia incluso con error server');
  harness.simulateState('offline');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Debe estar oculto en Asistencia incluso con error offline');
});

// 5. Estado normal en cualquier pestaña: oculto
test('5. Estado normal (connected / pending) en cualquier pestaña: «Reintentar notas» está oculto', () => {
  for (const pane of ['calificar', 'promedios', 'resumen', 'asistencia']) {
    const harness = createTestHarness(pane);
    harness.simulateState('connected');
    assert.equal(harness.elements.registroRetryOffer.hidden, true, `Debe estar oculto en ${pane} cuando connected`);
    harness.simulateState('pending');
    assert.equal(harness.elements.registroRetryOffer.hidden, true, `Debe estar oculto en ${pane} cuando pending`);
  }
});

// 6. Recuperación exitosa: oculto automáticamente
test('6. Recuperación exitosa tras error: «Reintentar notas» se oculta automáticamente', () => {
  const harness = createTestHarness('calificar');
  harness.simulateState('server');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Oculto en el pie también con error');
  harness.simulateState('connected');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'Oculto automáticamente tras recuperación exitosa');
});

// 7. Conflicto de versiones (review): oculto
test('7. Conflicto de versiones (review): «Reintentar notas» permanece oculto', () => {
  const harness = createTestHarness('calificar');
  harness.simulateState('review');
  assert.equal(harness.elements.registroRetryOffer.hidden, true, 'No debe mostrarse para resolver automáticamente conflictos de versiones');
});
