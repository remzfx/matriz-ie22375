// Pruebas sintéticas de cierre: Sistema de Sincronización Notas 2.0 (N2-G.17C)
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../registro-notas2.js');

const copy = x => JSON.parse(JSON.stringify(x));

function setupFixture(initialOverrides = {}) {
  let context = { nivel: 'secundaria', bim: 'I', grado: 1, seccion: 'A', area: 'Matemática' };
  let currentToken = 'token-ficticio-123';
  let pane = 'calificar';
  let currentTime = 1000000;

  const databases = {
    'secundaria||I||1||A||Matemática': {
      payload: {
        sessions: [],
        grades: { 'secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1': { nota20: 16, nivel: 'A' } },
        capsSel: {},
        calificarEstado: {},
        finales: {},
        concComp: {},
        competenciasEstado: {},
        asistencia: {},
        asisFechas: {},
        asisFechasEstado: {}
      },
      versions: { calificar: 10, promedios: 10, asistencia: 10 },
      at: { calificar: 1000, promedios: 1000, asistencia: 1000 }
    },
    'secundaria||I||2||A||Matemática': {
      payload: {
        sessions: [],
        grades: { 'secundaria||I||2||A||Matemática||C1||Cap1||id:estudiante2': { nota20: 14, nivel: 'B' } },
        capsSel: {},
        calificarEstado: {},
        finales: {},
        concComp: {},
        competenciasEstado: {},
        asistencia: {},
        asisFechas: {},
        asisFechasEstado: {}
      },
      versions: { calificar: 20, promedios: 20, asistencia: 20 },
      at: { calificar: 2000, promedios: 2000, asistencia: 2000 }
    }
  };

  const requests = [];
  const messages = [];
  let disk = JSON.stringify({ grades: {}, asistencia: {} });

  const data = Object.fromEntries(Object.values(core.fields).flat().map(f => [f, f === 'sessions' ? [] : {}]));

  const listeners = {};
  const domElements = {
    registroSaveState: { textContent: '' },
    registroConnectionStatus: { dataset: {}, style: { display: 'none' } },
    registroConnectionText: { textContent: '' },
    hdrSyncIndicator: {
      id: 'hdrSyncIndicator',
      setAttribute(name, value) { this[name] = value; },
      dataset: {},
      title: '',
      style: { color: '', display: '' },
      querySelector: () => domElements.syncDot
    },
    syncDot: { style: { backgroundColor: '', animation: '' } },
    appHdr: {
      querySelector: () => null
    },
    registroRetryOffer: { hidden: true }
  };

  let cState = 'checking';
  let editable = true;

  const g = {
    CLOUD_API_URL: 'https://synthetic.invalid/exec',
    sesionActiva: null,
    notas: {},
    capsElegidas: [],
    console,
    setTimeout: () => 1,
    clearTimeout: () => {},
    AbortController,
    Date,
    Map,
    JSON,
    document: {
      getElementById: id => domElements[id] || (id === 'panelCalificar' || id === 'panelAsistencia' ? { classList: { contains: () => id === (pane === 'calificar' ? 'panelCalificar' : 'none') } } : null),
      querySelector: sel => {
        if (sel === '#hdrSyncIndicator') return domElements.hdrSyncIndicator;
        if (sel.includes('IERegistroNotas2UI.save')) return { disabled: false, hidden: false, querySelector: () => ({ textContent: '' }) };
        if (sel.includes('IERegistroNotas2UI.process')) return { disabled: false, hidden: false, querySelector: () => ({ textContent: '' }) };
        if (sel.includes('IERegistroNotas2UI.download')) return { disabled: false, hidden: false, querySelector: () => ({ textContent: '' }) };
        return null;
      },
      querySelectorAll: () => [],
      addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
      createElement: tag => {
        if (tag === 'span') return domElements.hdrSyncIndicator;
        return { style: {}, classList: { contains: () => false }, appendChild: () => {}, setAttribute: () => {} };
      }
    },
    navigator: { onLine: true },
    window: null,
    IERegistroNotas2: core,
    registroDependenciaFallida: () => { throw Error('Missing dependency'); },
    cloudClaveReg: () => [context.nivel, context.bim, context.grado, context.seccion, context.area].join('||'),
    getLoginSession: () => ({ token: currentToken, role: 'docente', nombre: 'DOCENTE FICTICIO' }),
    IEStudents: { validToken: () => currentToken },
    padronBimestre: 'I',
    tokenPadron: 'token-ficticio-123',
    areaActual: 'Matemática',
    areas: () => ['Matemática', 'Comunicación'],
    registroLocal: { matches: () => true, read: () => disk, write: s => { disk = s; } },
    ctxBase: () => context,
    esVistaAdmin: () => false,
    bimestreHabilitado: () => true,
    registroConsultaHistorica: () => false,
    registroHistoricoProyectando: false,
    prefijoReg: () => [context.nivel, context.bim, context.grado, context.seccion, context.area].join('||') + '||',
    sliceRegistroArea: () => {
      const pref = [context.nivel, context.bim, context.grado, context.seccion, context.area].join('||') + '||';
      const sliced = copy(data);
      sliced.grades = Object.fromEntries(Object.entries(data.grades || {}).filter(([k]) => k.startsWith(pref)));
      sliced.finales = Object.fromEntries(Object.entries(data.finales || {}).filter(([k]) => k.startsWith(pref)));
      return sliced;
    },
    store: data,
    mergeRegistroPayload: p => Object.assign(data, p),
    toast: m => messages.push(m),
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
      create: o => {
        g.connectionConfig = o;
        return {
          canEdit: () => editable,
          snapshot: () => ({ state: cState }),
          check: async (rev, force) => {
            return o.verify({ valid: () => true, review: rev });
          },
          pause: r => { cState = r; editable = false; o.changed?.({ state: r }); },
          changed: p => { cState = p ? 'pending' : 'connected'; o.changed?.({ state: cState }); },
          invalidate: () => { cState = 'checking'; o.changed?.({ state: 'checking' }); }
        };
      }
    },
    IERegistroTransversales: { current: () => ({ dirty: false }), capture: () => {}, save: async () => true }
  };

  g.addEventListener = (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); };
  g.window = g;
  g.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    requests.push(b);
    const reqKey = [b.nivel, b.bimestre, b.grado, b.seccion, b.area].join('||');
    const db = databases[reqKey];

    if (b.action === 'loadnotas2') {
      if (!db) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            ok: true,
            notas2: 1,
            key: reqKey,
            exists: false,
            legacy: false,
            readonly: false,
            versions: { calificar: 0, promedios: 0, asistencia: 0 },
            at: { calificar: null, promedios: null, asistencia: null },
            payload: Object.fromEntries(Object.values(core.fields).flat().map(f => [f, f === 'sessions' ? [] : {}]))
          })
        };
      }
      return {
        ok: true,
        text: async () => JSON.stringify({
          ok: true,
          notas2: 1,
          key: reqKey,
          exists: true,
          legacy: false,
          readonly: false,
          versions: copy(db.versions),
          at: copy(db.at),
          payload: copy(db.payload)
        })
      };
    }

    if (b.action === 'savenotas2') {
      if (!db) throw Error('No DB for ' + reqKey);
      if (b.version !== db.versions[b.panel]) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            ok: false,
            code: 'CONFLICT',
            error: 'Otra computadora confirmó una versión posterior.'
          })
        };
      }
      Object.assign(db.payload, copy(b.payload));
      db.versions[b.panel]++;
      db.at[b.panel] = currentTime;
      return {
        ok: true,
        text: async () => JSON.stringify({
          ok: true,
          notas2: 1,
          key: reqKey,
          exists: true,
          legacy: false,
          readonly: false,
          versions: copy(db.versions),
          at: copy(db.at),
          panel: b.panel,
          payload: copy(db.payload)
        })
      };
    }

    return { ok: false };
  };

  vm.createContext(g);
  vm.runInContext(fs.readFileSync('registro-notas2-ui.js', 'utf8'), g);
  (listeners['DOMContentLoaded'] || []).forEach(fn => fn());

  return {
    g,
    api: g.IERegistroNotas2UI,
    domElements,
    requests,
    messages,
    databases,
    domListeners: listeners,
    trigger: (t, ev) => { (listeners[t] || []).forEach(fn => fn(ev)); },
    setConnectionState: s => {
      cState = s;
      g.connectionConfig.changed({ state: s });
    },
    setTime: t => { currentTime = t; },
    switchContext: newCtx => {
      context = Object.assign({}, context, newCtx);
      g.padronBimestre = context.bim;
      g.IERegistroNotas2UI.refresh();
    }
  };
}

test('1. Descarga automática al iniciar e ingresar por primera vez a un contexto', async () => {
  const f = setupFixture();
  const verifyFn = f.g.connectionConfig.verify;

  assert.equal(f.requests.filter(r => r.action === 'loadnotas2').length, 0);

  const res = await verifyFn({ valid: () => true });
  assert.equal(res.ok, true);

  const loads = f.requests.filter(r => r.action === 'loadnotas2');
  assert.equal(loads.length, 1, 'Debe haber exactamente 1 descarga inicial');
  assert.equal(loads[0].grado, 1);
  assert.equal(loads[0].seccion, 'A');

  const client = f.api.current();
  assert.equal(client.status().panels.calificar.version, 10);
});

test('2. Cero descargas periódicas de notas mientras el docente trabaja', async () => {
  const f = setupFixture();
  const verifyFn = f.g.connectionConfig.verify;

  // Carga inicial
  await verifyFn({ valid: () => true });
  const loadsBefore = f.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsBefore, 1);

  // Verificaciones periódicas posteriores (ej. cada 2 minutos)
  await verifyFn({ valid: () => true });
  await verifyFn({ valid: () => true });
  await verifyFn({ valid: () => true });

  const loadsAfter = f.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsAfter, loadsBefore, 'CERO solicitudes loadnotas2 durante comprobaciones periódicas de fondo');
});

test('3. Guardar manual y Subir Nube únicamente bajo acciones explícitas', async () => {
  const f = setupFixture();
  await f.g.connectionConfig.verify({ valid: () => true });

  const savesBefore = f.requests.filter(r => r.action === 'savenotas2').length;
  assert.equal(savesBefore, 0, 'No hay guardados automáticos');

  // Modificar una nota
  const gradeKey = 'secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1';
  f.g.store.grades[gradeKey] = { nota20: 18, nivel: 'A' };

  // Guardado explícito del docente
  const ok = await f.api.save();
  assert.equal(ok, true, 'Guardado explícito debe ser confirmado');

  const savesAfter = f.requests.filter(r => r.action === 'savenotas2').length;
  assert.equal(savesAfter, 1, 'Exactamente 1 guardado ejecutado tras la acción explícita');
  assert.equal(f.api.current().status().panels.calificar.version, 11);
});

test('4. Bajar Nube únicamente bajo solicitud explícita del docente', async () => {
  const f = setupFixture();
  await f.g.connectionConfig.verify({ valid: () => true });

  // Cambiar en la nube remotamente
  const gradeKey = 'secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1';
  f.databases['secundaria||I||1||A||Matemática'].payload.grades[gradeKey] = { nota20: 20, nivel: 'AD' };
  f.databases['secundaria||I||1||A||Matemática'].versions.calificar = 11;

  const loadsBefore = f.requests.filter(r => r.action === 'loadnotas2').length;

  // Bajar Nube explícito
  const ok = await f.api.download();
  assert.equal(ok, true);

  const loadsAfter = f.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsAfter, loadsBefore + 1, 'Debe haber emitido loadnotas2 tras clic en Bajar Nube');
  assert.equal(f.g.store.grades[gradeKey].nota20, 20, 'La nota debe coincidir con la confirmada de la nube');
});

test('5. Protección CAS: rechazo de versiones desactualizadas sin descartar trabajo local', async () => {
  const f = setupFixture();
  await f.g.connectionConfig.verify({ valid: () => true });

  // Otra máquina avanzó la versión a 15
  f.databases['secundaria||I||1||A||Matemática'].versions.calificar = 15;

  // Docente tiene nota 17 en memoria e intenta guardar con versión 10
  const gradeKey = 'secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1';
  f.g.store.grades[gradeKey] = { nota20: 17, nivel: 'A' };

  const ok = await f.api.save();
  assert.equal(ok, false, 'El guardado debe ser rechazado por CAS');

  // Estado del cliente debe pasar a conflict
  const status = f.api.current().status();
  assert.equal(status.state, 'conflict');

  // La nota local en memoria NO debe ser descartada
  assert.equal(f.g.store.grades[gradeKey].nota20, 17, 'El trabajo local en memoria se conserva íntegro');

  // La nubecita debe reflejar estado de alerta ROJO
  assert.equal(f.domElements.hdrSyncIndicator.dataset.state, 'review');
  assert.equal(f.domElements.syncDot.style.backgroundColor, '#ef4444', 'Dot debe ser ROJO ante conflicto CAS');
});

test('6. Interfaz habitual: colores de la nubecita corresponden exactamente al estado efectivo', async () => {
  const f = setupFixture();
  const verifyFn = f.g.connectionConfig.verify;

  // A. Estado Conectado sin cambios pendientes -> VERDE
  await verifyFn({ valid: () => true });
  f.setConnectionState('connected');

  assert.equal(f.domElements.hdrSyncIndicator.dataset.state, 'connected');
  assert.equal(f.domElements.syncDot.style.backgroundColor, '#10b981', 'Dot debe ser VERDE');

  // B. Docente modifica una nota -> NARANJA (cambios pendientes)
  const gradeKey = 'secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1';
  f.g.store.grades[gradeKey] = { nota20: 19, nivel: 'AD' };
  f.api.collect(); // Recolecta cambios
  f.trigger('input'); // Dispara evento de edición del usuario

  // Nubecita debe ser NARANJA mientras hay cambios pendientes
  assert.equal(f.domElements.hdrSyncIndicator.dataset.state, 'pending');
  assert.equal(f.domElements.syncDot.style.backgroundColor, '#f59e0b', 'Dot debe ser NARANJA ante cambios pendientes');

  // C. Error de servidor / desconexión -> ROJO
  f.setConnectionState('offline');
  assert.equal(f.domElements.hdrSyncIndicator.dataset.state, 'offline');
  assert.equal(f.domElements.syncDot.style.backgroundColor, '#ef4444', 'Dot debe ser ROJO ante desconexión');
});

test('7. Eliminada la barra naranja «Conflicto pendiente» y el toast repetitivo «Notas verificadas»', async () => {
  const f = setupFixture();
  const changedFn = f.g.connectionConfig.changed;

  // Simular transición a review o error
  changedFn({ state: 'review' });

  // La barra #registroConnectionStatus debe permanecer oculta (display: none)
  assert.equal(f.domElements.registroConnectionStatus.style.display, 'none', 'La barra naranja debe estar oculta en la interfaz habitual');

  // Simular reconexión de fondo
  f.messages.length = 0;
  changedFn({ state: 'connected' });
  assert.equal(f.messages.includes('Notas verificadas'), false, 'El toast emergente repetitivo debe estar eliminado');
});

test('8. Transición limpia al cambiar de aula, área o bimestre', async () => {
  const f = setupFixture();
  await f.g.connectionConfig.verify({ valid: () => true });

  // Cambiar a 2.° A
  f.switchContext({ grado: 2, seccion: 'A' });
  await f.g.connectionConfig.verify({ valid: () => true });

  // Verificar que 2.° A cargó su versión 20 y nota 14
  assert.equal(f.api.current().status().panels.calificar.version, 20);
  const gradeKey2 = 'secundaria||I||2||A||Matemática||C1||Cap1||id:estudiante2';
  assert.equal(f.g.store.grades[gradeKey2]?.nota20, 14);

  // Volver a 1.° A: conserva versión 10 sin nueva descarga innecesaria si ya está inicializado
  f.switchContext({ grado: 1, seccion: 'A' });
  assert.equal(f.api.current().status().panels.calificar.version, 10);
});
