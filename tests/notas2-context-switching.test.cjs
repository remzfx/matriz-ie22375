// Pruebas sintéticas: Comprobación focalizada de cambio de contexto académico (aula, área, bimestre) en Notas 2.0
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../registro-notas2.js');

const copy = x => JSON.parse(JSON.stringify(x));

function setupMultiContextFixture() {
  let context = { nivel: 'secundaria', bim: 'I', grado: 1, seccion: 'A', area: 'Matemática' };
  let currentToken = 'token-ficticio-123';

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
    },
    'secundaria||II||1||A||Matemática': {
      payload: {
        sessions: [],
        grades: { 'secundaria||II||1||A||Matemática||C1||Cap1||id:estudiante1': { nota20: 19, nivel: 'AD' } },
        capsSel: {},
        calificarEstado: {},
        finales: {},
        concComp: {},
        competenciasEstado: {},
        asistencia: {},
        asisFechas: {},
        asisFechasEstado: {}
      },
      versions: { calificar: 30, promedios: 30, asistencia: 30 },
      at: { calificar: 3000, promedios: 3000, asistencia: 3000 }
    }
  };

  const requests = [];
  const messages = [];
  const renderCalls = [];
  let disk = JSON.stringify({ grades: {}, asistencia: {} });
  let pane = 'calificar';
  let editable = true;

  const data = Object.fromEntries(Object.values(core.fields).flat().map(f => [f, f === 'sessions' ? [] : {}]));

  const elements = {
    registroSaveState: { textContent: '' },
    registroConnectionStatus: { dataset: {}, style: {} },
    registroConnectionText: { textContent: '' }
  };

  const g = {
    CLOUD_API_URL: 'https://synthetic.invalid/exec',
    sesionActiva: null,
    notas: {},
    capsElegidas: [],
    console,
    setTimeout: () => 1,
    clearTimeout() {},
    AbortController,
    Date,
    Map,
    JSON,
    document: {
      getElementById: id => {
        if (id === 'panelCalificar' || id === 'panelAsistencia') {
          return { classList: { contains: () => id === (pane === 'calificar' ? 'panelCalificar' : 'none') } };
        }
        return elements[id] || null;
      },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {}
    },
    navigator: { onLine: true },
    window: null,
    IERegistroNotas2: core,
    registroDependenciaFallida() { throw Error('Unexpected missing module'); },
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
    recolectarPantalla() {},
    saveCapsElegidas() {},
    loadCapsElegidas() {},
    sincronizarPeriodosNube: async () => true,
    renderSesiones() { renderCalls.push('sesiones:' + g.cloudClaveReg()); },
    renderStudents() { renderCalls.push('students:' + g.cloudClaveReg()); },
    renderFinales() { renderCalls.push('finales:' + g.cloudClaveReg()); },
    sincronizarEdicionRegistro() {},
    guardarAsistencia() {},
    IERegistroGrading: { sessionsFor: () => [], sessionsOn: () => [] },
    confirm: () => true,
    IERegistroConnection: {
      create: o => {
        g.connectionConfig = o;
        return {
          canEdit: () => editable,
          check: async () => !!(await o.verify({valid:()=>true,review:false})).ok,
          invalidate() {}
        };
      }
    },
    IERegistroTransversales: { current: () => ({ dirty: false }), capture() {}, save: async () => true }
  };

  g.window = g;
  g.fetch = async (url, opts) => {
    const b = JSON.parse(opts.body);
    requests.push(b);
if(b.action==='academicstate')return {ok:true,text:async()=>JSON.stringify({ok:true,academicReset:1,epoch:null,phase:'idle'})};
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
      db.at[b.panel] = Date.now();
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
  const api = g.IERegistroNotas2UI;

  function switchContext(newCtx) {
    context = Object.assign({}, context, newCtx);
    g.padronBimestre = context.bim;
    api.refresh();
  }

  return { g, api, databases, requests, messages, renderCalls, switchContext, getContext: () => context };
}

test('1. Contexto 1 (1.° A) se inicializa y descarga notas de 1.° A con su versión propia', async () => {
  const fMulti = setupMultiContextFixture();
  const verifyFn = fMulti.g.connectionConfig.verify;

  // Verificación de Contexto 1 (1.° A Matemática)
  const resCtx1 = await verifyFn({ valid: () => true });
  assert.equal(resCtx1.ok, true, 'Contexto 1 debe verificar exitosamente');

  // Comprobar que loadnotas2 pidió 1.° A
  const lastLoad = fMulti.requests.filter(r => r.action === 'loadnotas2').at(-1);
  assert.equal(lastLoad.grado, 1, 'Debe haber cargado grado 1');
  assert.equal(lastLoad.seccion, 'A', 'Debe haber cargado sección A');

  // Comprobar que en memoria de Notas 2.0 la versión es 10 (la de 1.° A)
  const clientCtx1 = fMulti.api.current();
  assert.equal(clientCtx1.status().panels.calificar.version, 10, 'Versión de Contexto 1 debe ser 10');

  // Comprobar que la nota de 1.° A es 16
  const gradeKey1 = 'secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1';
  assert.equal(fMulti.g.store.grades[gradeKey1]?.nota20, 16, 'Nota de estudiante 1 debe ser 16');
});

test('2. Al cambiar a Contexto 2 (2.° A), se realiza la descarga inicial correspondiente con su propia versión y notas', async () => {
  const fMulti = setupMultiContextFixture();
  const verifyFn = fMulti.g.connectionConfig.verify;

  // Cargar Contexto 1
  await verifyFn({ valid: () => true });
  const loadsBeforeSwitch = fMulti.requests.filter(r => r.action === 'loadnotas2').length;

  // Cambiar a Contexto 2: 2.° A Matemática
  fMulti.switchContext({ grado: 2, seccion: 'A' });

  // Ejecutar verificación del nuevo contexto (aún no inicializado para 2.° A)
  const resCtx2 = await verifyFn({ valid: () => true });
  assert.equal(resCtx2.ok, true, 'Contexto 2 debe verificar exitosamente');

  // Debe haber emitido una nueva solicitud loadnotas2 para 2.° A
  const loadsAfterSwitch = fMulti.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsAfterSwitch, loadsBeforeSwitch + 1, 'Debe haber ejecutado loadnotas2 para el nuevo contexto');

  const lastLoadCtx2 = fMulti.requests.filter(r => r.action === 'loadnotas2').at(-1);
  assert.equal(lastLoadCtx2.grado, 2, 'La nueva carga debe ser de grado 2');
  assert.equal(lastLoadCtx2.seccion, 'A', 'La nueva carga debe ser de sección A');

  // La versión en Contexto 2 debe ser 20 (la de 2.° A, no la de 1.° A que era 10)
  const clientCtx2 = fMulti.api.current();
  assert.equal(clientCtx2.status().panels.calificar.version, 20, 'Versión de Contexto 2 debe ser 20 independiente');

  // La nota de estudiante 2 debe ser 14
  const gradeKey2 = 'secundaria||I||2||A||Matemática||C1||Cap1||id:estudiante2';
  assert.equal(fMulti.g.store.grades[gradeKey2]?.nota20, 14, 'Nota de estudiante 2 debe ser 14');
});

test('3. No hay contaminación cruzada de versiones ni notas entre contextos', async () => {
  const fMulti = setupMultiContextFixture();
  const verifyFn = fMulti.g.connectionConfig.verify;

  // Cargar 1.° A
  await verifyFn({ valid: () => true });
  const client1 = fMulti.api.current();
  assert.equal(client1.status().panels.calificar.version, 10);

  // Cambiar y cargar 2.° A
  fMulti.switchContext({ grado: 2, seccion: 'A' });
  await verifyFn({ valid: () => true });
  const client2 = fMulti.api.current();
  assert.equal(client2.status().panels.calificar.version, 20);

  // Volver a 1.° A: el cliente de 1.° A sigue conservando su versión 10 intacta
  fMulti.switchContext({ grado: 1, seccion: 'A' });
  const client1Again = fMulti.api.current();
  assert.equal(client1Again.status().panels.calificar.version, 10, '1.° A conserva su versión original 10');
  assert.notEqual(client1Again.status().panels.calificar.version, client2.status().panels.calificar.version, 'No se contaminaron las versiones');
});

test('4. En el nuevo contexto (2.° A), las comprobaciones periódicas no ejecutan loadnotas2', async () => {
  const fMulti = setupMultiContextFixture();
  const verifyFn = fMulti.g.connectionConfig.verify;

  // Cargar 2.° A
  fMulti.switchContext({ grado: 2, seccion: 'A' });
  await verifyFn({ valid: () => true });
  const loadsInitCtx2 = fMulti.requests.filter(r => r.action === 'loadnotas2').length;

  // Simular 3 verificaciones periódicas en 2.° A
  await verifyFn({ valid: () => true });
  await verifyFn({ valid: () => true });
  await verifyFn({ valid: () => true });

  const loadsAfterPeriodics = fMulti.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsAfterPeriodics, loadsInitCtx2, 'Cero solicitudes loadnotas2 durante verificaciones periódicas en Contexto 2');
});

test('5. Guardar, Bajar Nube y CAS funcionan independientemente en cada contexto', async () => {
  const fMulti = setupMultiContextFixture();
  const verifyFn = fMulti.g.connectionConfig.verify;

  // Cargar 1.° A
  await verifyFn({ valid: () => true });

  // 5.1 Guardar exitoso en 1.° A avanza la versión de 1.° A a 11
  const save1 = await fMulti.api.save();
  assert.equal(save1, true, 'Guardar en 1.° A debe ser exitoso');
  assert.equal(fMulti.databases['secundaria||I||1||A||Matemática'].versions.calificar, 11, 'Versión en DB de 1.° A avanzó a 11');

  // Cambiar a 2.° A
  fMulti.switchContext({ grado: 2, seccion: 'A' });
  await verifyFn({ valid: () => true });
  assert.equal(fMulti.api.current().status().panels.calificar.version, 20, 'Versión de 2.° A sigue en 20');

  // 5.2 Simular conflicto CAS exclusivamente en 2.° A
  fMulti.databases['secundaria||I||2||A||Matemática'].versions.calificar = 25; // Servidor tiene 25
  const save2Conflict = await fMulti.api.save(); // Cliente 2 tiene 20
  assert.equal(save2Conflict, false, 'Guardado con versión desfasada en 2.° A debe fallar');
  assert.equal(fMulti.api.current().status().state, 'conflict', 'Estado de cliente 2.° A debe ser conflict');

  // 5.3 Bajar Nube en 2.° A resuelve el desfase descargando versión 25
  const downloadRes = await fMulti.api.download();
  assert.equal(downloadRes, true, 'Bajar Nube en 2.° A debe resolver');
  assert.equal(fMulti.api.current().status().panels.calificar.version, 25, 'Versión en 2.° A actualizada a 25');

  // 1.° A no fue afectado por el conflicto de 2.° A
  fMulti.switchContext({ grado: 1, seccion: 'A' });
  assert.equal(fMulti.api.current().status().panels.calificar.version, 11, '1.° A conserva su versión 11 sin perturbación');
});

test('6. Cambio de Bimestre (I a II) crea nuevo contexto independiente con su propia descarga inicial', async () => {
  const fMulti = setupMultiContextFixture();
  const verifyFn = fMulti.g.connectionConfig.verify;

  // Cargar Bimestre I
  await verifyFn({ valid: () => true });
  assert.equal(fMulti.api.current().status().panels.calificar.version, 10);

  // Cambiar a Bimestre II
  fMulti.switchContext({ bim: 'II' });
  const loadsBeforeBim2 = fMulti.requests.filter(r => r.action === 'loadnotas2').length;

  await verifyFn({ valid: () => true });
  const loadsAfterBim2 = fMulti.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsAfterBim2, loadsBeforeBim2 + 1, 'Cambio de Bimestre debe emitir carga inicial para Bimestre II');

  const lastLoad = fMulti.requests.filter(r => r.action === 'loadnotas2').at(-1);
  assert.equal(lastLoad.bimestre, 'II', 'La carga debe solicitar Bimestre II');

  // Versión de Bimestre II es 30
  assert.equal(fMulti.api.current().status().panels.calificar.version, 30, 'Versión de Bimestre II debe ser 30');
  const gradeKeyBim2 = 'secundaria||II||1||A||Matemática||C1||Cap1||id:estudiante1';
  assert.equal(fMulti.g.store.grades[gradeKeyBim2]?.nota20, 19, 'Nota de Bimestre II debe ser 19');
});
