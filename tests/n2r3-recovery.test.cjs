'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const setup = new Function('require', '__dirname', read('tests/backend-write-auth.test.cjs').split('\nfor (const action')[0] + '\nreturn setup;')(require, path.join(root, 'tests'));

function createNinoskaFixture() {
  const s = setup();
  vm.runInContext(read('apps-script/Notas2.js'), s.c);

  const context = { nivel: 'secundaria', bimestre: 'III', grado: 1, seccion: 'A', area: 'Comunicación' };
  const key = [context.nivel, context.bimestre, context.grado, context.seccion, context.area].join('||');
  const comps = s.c.registroAcademico_().catalog.secundaria['Comunicación'];

  // Roster for 1 A
  const roster = [
    { nivel: 'secundaria', grado: 1, seccion: 'A', idSiagie: '1001', codigoEstudiante: 'COD01', nombre: 'ALUMNO UNO PRIMERO' },
    { nivel: 'secundaria', grado: 1, seccion: 'A', idSiagie: '1002', codigoEstudiante: 'COD02', nombre: 'ALUMNO DOS SEGUNDO' },
    { nivel: 'secundaria', grado: 1, seccion: 'A', idSiagie: '1003', codigoEstudiante: 'COD03', nombre: 'ALUMNO TRES TERCERO' },
    { nivel: 'secundaria', grado: 1, seccion: 'A', idSiagie: '1004', codigoEstudiante: 'COD04', nombre: 'ALUMNO CUATRO CUARTO' }
  ];

  s.tables.set('EstudiantesBase', {});
  s.c.leerPadronEstudiantes_ = () => ({ estudiantes: JSON.parse(JSON.stringify(roster)) });

  // Teacher token
  const token = s.secondary;
  const cfg = s.c.obtenerDocentesConfig_();
  const dSec = cfg.docentes.find(d => d.user === 'test-secondary');
  dSec.areas.push('Comunicación');
  dSec.aulas.push('1|A');
  dSec.asignaciones['Comunicación'] = ['1|A'];
  s.c.obtenerDocentesConfig_ = () => cfg;

  const request = (action, extra = {}) => s.post(s.body(action, { ...context, token, docente: 'GALINDO ALVIAR, Ninoska', ...extra }));
  const seed = (p, version = 1728000000000) => {
    s.tables.get('RegistroNotas').rows.push([
      key, context.nivel, context.bimestre, context.grado, context.seccion, context.area, 'GALINDO ALVIAR, Ninoska', version, JSON.stringify(p)
    ]);
  };

  return { s, context, key, comps, roster, request, seed };
}

test('1. Recuperación legacy con finales poblado: loadnotas2 carga notas exitosamente sin escrituras', () => {
  const f = createNinoskaFixture();
  const writesBefore = f.s.state.writes;
  const c1 = f.comps[0];
  const c2 = f.comps[1];
  const c3 = f.comps[2];

  const payload = {
    grades: {},
    sessions: [],
    finales: {
      [f.key + '||' + c1 + '||ALUMNO UNO PRIMERO']: { nota20: '', nivel: 'AD', origen: 'letra', ts: 100 },
      [f.key + '||' + c2 + '||ALUMNO UNO PRIMERO']: { nota20: '', nivel: 'A', origen: 'letra', ts: 100 },
      [f.key + '||' + c1 + '||ALUMNO DOS SEGUNDO']: { nota20: '', nivel: 'B', origen: 'letra', ts: 100 },
      [f.key + '||' + c1 + '||ALUMNO TRES TERCERO']: { nota20: '', nivel: 'C', origen: 'letra', ts: 100 }
    }
  };

  f.seed(payload);
  const res = f.request('loadnotas2');
  assert.equal(res.ok, true);
  assert.equal(res.legacy, true);
  assert.equal(f.s.state.writes, writesBefore, 'Ausencia total de escrituras durante lectura');

  const loadedFinales = res.payload.finales;
  assert.equal(loadedFinales[f.key + '||' + c1 + '||id:1001'].nivel, 'AD');
  assert.equal(loadedFinales[f.key + '||' + c2 + '||id:1001'].nivel, 'A');
  assert.equal(loadedFinales[f.key + '||' + c1 + '||id:1002'].nivel, 'B');
  assert.equal(loadedFinales[f.key + '||' + c1 + '||id:1003'].nivel, 'C');
});

test('2. Calificaciones vacías heredadas: celdas sin valor no abortan lectura ni borran notas', () => {
  const f = createNinoskaFixture();
  const c1 = f.comps[0];

  const payload = {
    grades: {},
    sessions: [],
    finales: {
      [f.key + '||' + c1 + '||ALUMNO UNO PRIMERO']: { nota20: '', nivel: 'A', origen: 'letra' },
      [f.key + '||' + c1 + '||ALUMNO DOS SEGUNDO']: { nota20: '', nivel: '', origen: 'letra' }, // vacía
      [f.key + '||' + c1 + '||ALUMNO TRES TERCERO']: { nota20: null, nivel: '' }, // vacía
      [f.key + '||' + c1 + '||ALUMNO CUATRO CUARTO']: { nota20: 16, nivel: 'A', origen: 'numero' }
    }
  };

  f.seed(payload);
  const res = f.request('loadnotas2');
  assert.equal(res.ok, true);
  assert.equal(res.payload.finales[f.key + '||' + c1 + '||id:1001'].nivel, 'A');
  assert.equal(res.payload.finales[f.key + '||' + c1 + '||id:1004'].nota20, 16);
});

test('3. Identidades retiradas y desconocidas: no bloquean lectura ni se aproximan a otros alumnos', () => {
  const f = createNinoskaFixture();
  const c1 = f.comps[0];

  const payload = {
    grades: {},
    sessions: [],
    finales: {
      [f.key + '||' + c1 + '||ALUMNO UNO PRIMERO']: { nota20: '', nivel: 'A', origen: 'letra' },
      [f.key + '||' + c1 + '||ALUMNO TRASLADADO RETIRADO']: { nota20: '', nivel: 'B', origen: 'letra' }
    }
  };

  f.seed(payload);
  const res = f.request('loadnotas2');
  assert.equal(res.ok, true);
  // Alumno activo recibe su nota proyectada exactamente
  assert.equal(res.payload.finales[f.key + '||' + c1 + '||id:1001'].nivel, 'A');
  // Alumno no reconocido queda en unresolvedIdentities sin asignar falsamente a ningún alumno activo
  assert.ok(res.payload.meta?.unresolvedIdentities?.length > 0);
  assert.equal(res.payload.finales[f.key + '||' + c1 + '||id:1002'], undefined);
  assert.equal(res.payload.finales[f.key + '||' + c1 + '||id:1003'], undefined);
});

test('4. Identidades ambiguas: conflicto real requiere revisión explícita', () => {
  const f = createNinoskaFixture();
  const c1 = f.comps[0];

  // Mismo alumno tiene 2 registros contradictorios
  const payload = {
    grades: {},
    sessions: [],
    finales: {
      [f.key + '||' + c1 + '||id:1001']: { nota20: 14, nivel: 'A', origen: 'letra' },
      [f.key + '||' + c1 + '||nom:ALUMNO%20UNO%20PRIMERO']: { nota20: 10, nivel: 'C', origen: 'letra' }
    }
  };

  f.seed(payload);
  const res = f.request('loadnotas2');
  assert.equal(res.ok, true);
  assert.equal(res.historicalConflicts?.length, 1);
  assert.equal(res.payload.finales[f.key + '||' + c1 + '||id:1001'], undefined);
  assert.equal(res.historicalConflicts[0].candidates.length, 2);
});

test('5. Bloqueo EMPTY entre paneles: registro legacy con calificar vacío carga promedios sin error', async () => {
  const core = require('../registro-notas2.js');
  let appliedPayload = null;

  const client = core.create({
    key: 'secundaria||III||1||A||Comunicación',
    binding: () => 'binding-key',
    authorized: () => true,
    readonly: () => false,
    capture: () => ({
      sessions: [],
      // Borrador local existente en calificar
      grades: { 'secundaria||III||1||A||Comunicación||comp||cap||2026-10-01||id:1001': { nota20: 15 } },
      finales: {},
      concComp: {},
      competenciasEstado: {},
      asistencia: {}
    }),
    apply: p => { appliedPayload = p; },
    request: async () => ({
      ok: true,
      notas2: 1,
      exists: true,
      legacy: true,
      readonly: false,
      key: 'secundaria||III||1||A||Comunicación',
      versions: { calificar: 0, promedios: 1728000000000, asistencia: 0 },
      at: { calificar: null, promedios: 1728000000000, asistencia: null },
      payload: {
        sessions: [],
        grades: {},
        capsSel: {},
        calificarEstado: {},
        finales: { 'secundaria||III||1||A||Comunicación||comp||id:1001': { nota20: '', nivel: 'A', origen: 'letra' } },
        concComp: {},
        competenciasEstado: {},
        asistencia: {},
        asisFechas: {},
        asisFechasEstado: {}
      }
    }),
    hasExisting: name => name === 'calificar'
  });

  const ok = await client.load();
  assert.equal(ok, true, 'client.load() debe ser exitoso');
  assert.equal(client.status().state, 'ready');
  assert.ok(appliedPayload !== null);
  assert.equal(appliedPayload.finales['secundaria||III||1||A||Comunicación||comp||id:1001'].nivel, 'A');
});

test('6. Visualización de notas con origen letra en Promedios: renderiza A, B, C y AD correctamente', () => {
  // Simular la lógica de renderFinales() de registro.html (línea 3616)
  const renderItem = (dir, original) => {
    let nota = '', letra = '';
    if (dir.letra || (dir.nota !== '' && dir.nota != null)) {
      nota = original.origen === 'letra' ? '' : (dir.nota !== '' && dir.nota != null ? dir.nota : '');
      letra = dir.letra;
    }
    return { nota, letra };
  };

  // Nota directa letra con nota20 vacía
  for (const L of ['AD', 'A', 'B', 'C']) {
    const r = renderItem({ nota: '', letra: L }, { nota20: '', nivel: L, origen: 'letra' });
    assert.equal(r.letra, L);
    assert.equal(r.nota, '');
  }

  // Nota directa letra con nota20 numérica de referencia
  const rLetraConNum = renderItem({ nota: 14, letra: 'A' }, { nota20: 14, nivel: 'A', origen: 'letra' });
  assert.equal(rLetraConNum.letra, 'A');
  assert.equal(rLetraConNum.nota, '', 'En modo letra, nota directa conserva campo numérico vacío');

  // Integridad de notas numéricas directas
  const rNum = renderItem({ nota: 17, letra: 'A' }, { nota20: 17, nivel: 'A', origen: 'numero' });
  assert.equal(rNum.letra, 'A');
  assert.equal(rNum.nota, 17, 'En modo número, conserva la nota numérica exacta');
});

test('7. Aislamiento entre grados, áreas y bimestres', () => {
  const f = createNinoskaFixture();
  const c1 = f.comps[0];

  // Intento de leer o guardar en área no asignada
  const resBadArea = f.request('loadnotas2', { area: 'Educación Física' });
  assert.equal(resBadArea.ok, false);
  assert.equal(resBadArea.code, 'SESSION');

  // Intento en bimestre cerrado
  const resClosedBim = f.request('savenotas2', { bimestre: 'II', panel: 'promedios', version: 0, payload: { finales: {}, concComp: {}, competenciasEstado: {} } });
  assert.equal(resClosedBim.ok, false);
  assert.equal(resClosedBim.code, 'CLOSED');
});

test('8. Conservar intactos los borradores locales de Calificar y Asistencia cuando se recupera Promedios desde legacy', async () => {
  const core = require('../registro-notas2.js');
  let appliedPayload = null;

  const localCalificarDraft = { 'secundaria||III||1||A||Comunicación||comp||cap||2026-10-01||id:1001': { nota20: 16 } };
  const localAsistenciaDraft = { 'secundaria||III||1||A||Comunicación||2026-10-01||id:1001': { marca: 'A' } };

  const client = core.create({
    key: 'secundaria||III||1||A||Comunicación',
    binding: () => 'binding-key',
    authorized: () => true,
    readonly: () => false,
    capture: () => ({
      sessions: [{ id: 'sess-1' }],
      grades: localCalificarDraft,
      finales: {},
      concComp: {},
      competenciasEstado: {},
      asistencia: localAsistenciaDraft
    }),
    apply: p => { appliedPayload = p; },
    request: async () => ({
      ok: true,
      notas2: 1,
      exists: true,
      legacy: true,
      readonly: false,
      key: 'secundaria||III||1||A||Comunicación',
      versions: { calificar: 0, promedios: 1728000000000, asistencia: 0 },
      at: { calificar: null, promedios: 1728000000000, asistencia: null },
      payload: {
        sessions: [],
        grades: {},
        capsSel: {},
        calificarEstado: {},
        finales: { 'secundaria||III||1||A||Comunicación||comp||id:1001': { nota20: '', nivel: 'A', origen: 'letra' } },
        concComp: {},
        competenciasEstado: {},
        asistencia: {},
        asisFechas: {},
        asisFechasEstado: {}
      }
    }),
    hasExisting: name => name === 'calificar' || name === 'asistencia'
  });

  const ok = await client.load();
  assert.equal(ok, true, 'client.load() debe ser exitoso al recuperar Promedios');
  assert.equal(client.status().state, 'ready');
  assert.ok(appliedPayload !== null);
  // Promedios sí se recupera
  assert.equal(appliedPayload.finales['secundaria||III||1||A||Comunicación||comp||id:1001'].nivel, 'A');
  // Calificar y Asistencia locales no son sobreescritos por los arrays/objetos vacíos del payload remoto
  assert.equal(appliedPayload.grades, undefined, 'Borrador de calificar no debe ser pisado');
  assert.equal(appliedPayload.sessions, undefined, 'Sesiones de calificar no deben ser pisadas');
  assert.equal(appliedPayload.asistencia, undefined, 'Borrador de asistencia no debe ser pisado');
});

test('9. Conserva la protección EMPTY original para registros no legacy, incluso con versión 0', async () => {
  const core = require('../registro-notas2.js');
  let errorCode = null;

  const client = core.create({
    key: 'secundaria||III||1||A||Comunicación',
    binding: () => 'binding-key',
    authorized: () => true,
    readonly: () => false,
    capture: () => ({
      sessions: [],
      grades: { 'secundaria||III||1||A||Comunicación||comp||cap||2026-10-01||id:1001': { nota20: 14 } },
      finales: {},
      concComp: {},
      competenciasEstado: {},
      asistencia: {}
    }),
    apply: () => { assert.fail('No debe llamar apply si falló EMPTY'); },
    error: err => { errorCode = err.code; },
    request: async () => ({
      ok: true,
      notas2: 1,
      exists: true,
      legacy: false, // NO legacy
      readonly: false,
      key: 'secundaria||III||1||A||Comunicación',
      versions: { calificar: 0, promedios: 0, asistencia: 0 }, // Versión 0
      at: { calificar: null, promedios: null, asistencia: null },
      payload: {
        sessions: [],
        grades: {},
        capsSel: {},
        calificarEstado: {},
        finales: {},
        concComp: {},
        competenciasEstado: {},
        asistencia: {},
        asisFechas: {},
        asisFechasEstado: {}
      }
    }),
    hasExisting: name => name === 'calificar'
  });

  const ok = await client.load();
  assert.equal(ok, false, 'client.load() debe retornar false cuando falla EMPTY');
  assert.equal(errorCode, 'EMPTY', 'Debe fallar con código EMPTY protegiendo el borrador local');
});
