// Pruebas sintéticas: Desacoplamiento de verificación periódica de conexión y descarga académica loadnotas2
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../registro-notas2.js');

const copy = x => JSON.parse(JSON.stringify(x));

function setupFixture() {
  const context = { nivel: 'secundaria', bim: 'I', grado: 1, seccion: 'A', area: 'Matemática' };
  const key = Object.values(context).join('||');
  const prefix = key + '||';

  const data = Object.fromEntries(Object.values(core.fields).flat().map(f => [f, f === 'sessions' ? [] : {}]));
  const remote = copy(data);
  const versions = { calificar: 100, promedios: 100, asistencia: 100 };
  const at = { calificar: 1000, promedios: 1000, asistencia: 1000 };

  const messages = [];
  const requests = [];
  const renderCalls = [];
  let disk = JSON.stringify({ grades: {}, asistencia: {} });
  let pane = 'calificar';
  let editable = true;

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
    cloudClaveReg: () => key,
    getLoginSession: () => ({ token: 'synthetic-tok', role: 'docente', nombre: 'DOCENTE FICTICIO' }),
    IEStudents: { validToken: () => 'synthetic-tok' },
    padronBimestre: 'I',
    tokenPadron: 'synthetic-tok',
    areaActual: 'Matemática',
    areas: () => ['Matemática'],
    registroLocal: { matches: () => true, read: () => disk, write: s => { disk = s; } },
    ctxBase: () => context,
    esVistaAdmin: () => false,
    bimestreHabilitado: () => true,
    registroConsultaHistorica: () => false,
    registroHistoricoProyectando: false,
    prefijoReg: () => prefix,
    sliceRegistroArea: () => copy(data),
    store: data,
    mergeRegistroPayload: p => Object.assign(data, p),
    toast: m => messages.push(m),
    recolectarPantalla() {},
    saveCapsElegidas() {},
    loadCapsElegidas() {},
    sincronizarPeriodosNube: async () => true,
    renderSesiones() { renderCalls.push('sesiones'); },
    renderStudents() { renderCalls.push('students'); },
    renderFinales() { renderCalls.push('finales'); },
    sincronizarEdicionRegistro() { renderCalls.push('edicion'); },
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
    if (b.action === 'loadnotas2') {
      return {
        ok: true,
        text: async () => JSON.stringify({
          ok: true,
          notas2: 1,
          key,
          exists: true,
          legacy: false,
          readonly: false,
          versions: copy(versions),
          at: copy(at),
          payload: copy(remote)
        })
      };
    }
    if (b.action === 'savenotas2') {
      if (b.version !== versions[b.panel]) {
        return {
          ok: true,
          text: async () => JSON.stringify({
            ok: false,
            code: 'CONFLICT',
            error: 'Otra computadora confirmó una versión posterior.'
          })
        };
      }
      Object.assign(remote, copy(b.payload));
      versions[b.panel]++;
      at[b.panel] = 2000;
      return {
        ok: true,
        text: async () => JSON.stringify({
          ok: true,
          notas2: 1,
          key,
          exists: true,
          legacy: false,
          readonly: false,
          versions: copy(versions),
          at: copy(at),
          panel: b.panel,
          payload: copy(remote)
        })
      };
    }
    return { ok: false };
  };

  vm.createContext(g);
  vm.runInContext(fs.readFileSync('registro-notas2-ui.js', 'utf8'), g);
  const api = g.IERegistroNotas2UI;

  return { g, api, data, remote, versions, requests, messages, renderCalls };
}

test('1. Verificación inicial descarga notas automáticamente mediante loadnotas2 y muestra toast', async () => {
  const f = setupFixture();
  const verifyFn = f.g.connectionConfig.verify;
  const changedFn = f.g.connectionConfig.changed;

  assert.equal(f.requests.filter(r => r.action === 'loadnotas2').length, 0);

  // Ejecutar verificación inicial
  const res1 = await verifyFn({ valid: () => true });
  assert.equal(res1.ok, true, 'La verificación inicial debe ser exitosa');

  // Comprobar que se realizó loadnotas2
  const loadsAfterInit = f.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsAfterInit, 1, 'Debe haber ejecutado exactamente 1 solicitud loadnotas2 inicial');
  assert.ok(f.renderCalls.length > 0, 'Debe haber invocado render() en la carga inicial');

  // Simular evento changed con estado connected
  changedFn({ state: 'connected' });
  assert.equal(f.messages.includes('Notas verificadas'), false, 'NO debe mostrar toast emergente en la conexión (eliminado de la interfaz habitual)');
});

test('2. Verificaciones periódicas posteriores NO ejecutan loadnotas2 ni render()', async () => {
  const f = setupFixture();
  const verifyFn = f.g.connectionConfig.verify;
  const changedFn = f.g.connectionConfig.changed;

  // 1. Carga inicial
  await verifyFn({ valid: () => true });
  changedFn({ state: 'connected' });
  f.messages.length = 0; // Limpiar mensajes
  f.renderCalls.length = 0; // Limpiar llamadas a render

  const loadsBefore = f.requests.filter(r => r.action === 'loadnotas2').length;

  // 2. Simular primera verificación periódica posterior (ej. a los 2 minutos)
  const resPeriodica1 = await verifyFn({ valid: () => true });
  assert.equal(resPeriodica1.ok, true, 'La verificación periódica debe ser exitosa');

  // 3. Simular segunda verificación periódica posterior (ej. a los 4 minutos)
  const resPeriodica2 = await verifyFn({ valid: () => true });
  assert.equal(resPeriodica2.ok, true, 'La segunda verificación periódica debe ser exitosa');

  const loadsAfter = f.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsAfter, loadsBefore, 'Las verificaciones periódicas NO deben emitir loadnotas2');
  assert.equal(f.renderCalls.length, 0, 'Las verificaciones periódicas NO deben ejecutar render()');

  // 4. Comprobar que changed periódico no muestra el toast repetitivo
  changedFn({ state: 'connected' });
  assert.equal(f.messages.includes('Notas verificadas'), false, 'NO debe mostrar toast en renovaciones de fondo');
});

test('3. Modificaciones remotas de otra sesión no sobrescriben silenciosamente notas de la sesión abierta', async () => {
  const f = setupFixture();
  const verifyFn = f.g.connectionConfig.verify;

  // Carga inicial: sesión A tiene versión 100
  await verifyFn({ valid: () => true });

  // Simular que Sesión B modificó notas en el servidor y avanzó versión a 101
  f.remote.grades['Secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1'] = { nota20: 18, nivel: 'A' };
  f.versions.calificar = 101;

  // Sesión A tiene nota local 14 ingresada en memoria
  f.data.grades['Secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1'] = { nota20: 14, nivel: 'B' };

  // Verificación periódica en Sesión A ocurre en segundo plano
  await verifyFn({ valid: () => true });

  // La nota en Sesión A debe permanecer intacta en 14 (no sobrescrita por el 18 de B)
  const notaEnA = f.data.grades['Secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1']?.nota20;
  assert.equal(notaEnA, 14, 'La verificación periódica no debe alterar notas locales con datos remotos ajenos');
});

test('4. Protección CAS permanece activa: guardar con versión desfasada es rechazado como CONFLICT', async () => {
  const f = setupFixture();
  const verifyFn = f.g.connectionConfig.verify;

  // Carga inicial con versión 100
  await verifyFn({ valid: () => true });

  // Otra sesión avanza la versión remota a 105
  f.versions.calificar = 105;

  // Sesión A intenta guardar (su versión es 100)
  const saveResult = await f.api.save();
  assert.equal(saveResult, false, 'El guardado debe ser rechazado');
  assert.equal(f.api.current().status().state, 'conflict', 'El estado del cliente debe pasar a conflict');
});

test('5. Bajar Nube (download) solicita explícitamente loadnotas2 y actualiza los datos a petición del usuario', async () => {
  const f = setupFixture();
  const verifyFn = f.g.connectionConfig.verify;

  // Carga inicial
  await verifyFn({ valid: () => true });
  const loadsInit = f.requests.filter(r => r.action === 'loadnotas2').length;

  // Servidor tiene nueva nota
  f.remote.grades['Secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1'] = { nota20: 20, nivel: 'AD' };
  f.versions.calificar = 102;

  // Usuario hace clic en Bajar Nube
  f.g.confirm = () => true;
  const downloadResult = await f.api.download();
  assert.equal(downloadResult, true, 'Bajar Nube debe completarse exitosamente');

  const loadsAfter = f.requests.filter(r => r.action === 'loadnotas2').length;
  assert.equal(loadsAfter, loadsInit + 1, 'Bajar Nube debe ejecutar explícitamente loadnotas2');
  assert.equal(f.messages.includes('Se restauró la última versión confirmada.'), true, 'Debe mostrar toast de restauración');
  assert.equal(f.data.grades['Secundaria||I||1||A||Matemática||C1||Cap1||id:estudiante1']?.nota20, 20, 'Debe reflejar la nota actualizada de la nube');
});
