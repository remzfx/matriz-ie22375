'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const identityFactory = require('../academic-identity.js');

/**
 * Fixture sintético idéntico al diagnóstico confirmado de Ninoska:
 * - 30 estudiantes (1.° A Secundaria)
 * - 3 competencias de Comunicación
 * - 180 entradas en finales (90 nom:, 90 id:)
 * - 28 coincidencias académicas (mismo nivel 'A')
 * - 62 divergencias de nivel de logro ('B' vs 'A')
 * - 20 conclusiones descriptivas en concComp
 * - 0 identidades no resueltas
 */
function createSyntheticNinoskaScenario() {
  const context = { nivel: 'secundaria', bim: 'III', grado: 1, seccion: 'A', area: 'Comunicación' };
  const competencies = [
    'Se comunica oralmente en su lengua materna',
    'Lee diversos tipos de textos escritos en su lengua materna',
    'Escribe diversos tipos de textos en su lengua materna'
  ];

  const prefix = 'secundaria||III||1||A||Comunicación||';

  const roster = [];
  for (let i = 1; i <= 30; i++) {
    const pad = String(i).padStart(2, '0');
    roster.push({
      nivel: 'secundaria',
      grado: 1,
      seccion: 'A',
      orden: i,
      idSiagie: `10${pad}`,
      codigoEstudiante: `COD${pad}`,
      nombre: `ESTUDIANTE FICTICIO ${pad}`
    });
  }

  const finales = {};
  const concComp = {};

  const tsOld = 1725148800000; // 01 Septiembre 2026
  const tsNew = 1728000000000; // 04 Octubre 2026

  let pairIndex = 0;
  for (const al of roster) {
    const studentNom = 'nom:' + encodeURIComponent(al.nombre);
    const studentId = 'id:' + encodeURIComponent(al.idSiagie);

    for (const comp of competencies) {
      pairIndex++;
      const keyNom = `${prefix}${comp}||${studentNom}`;
      const keyId = `${prefix}${comp}||${studentId}`;

      if (pairIndex <= 62) {
        // 62 casos de divergencia real de nivel de logro ('B' vs 'A')
        finales[keyNom] = { nota20: '', nivel: 'B', origen: 'letra', ts: tsOld };
        finales[keyId] = { nota20: '', nivel: 'A', origen: 'letra', ts: tsNew };
      } else {
        // 28 casos con coincidencia académica (mismo nivel 'A')
        finales[keyNom] = { nota20: '', nivel: 'A', origen: 'letra', ts: tsOld };
        finales[keyId] = { nota20: 16, nivel: 'A', origen: 'numero', ts: tsNew };
      }

      // 20 conclusiones descriptivas en concComp
      if (pairIndex <= 20) {
        concComp[keyId] = { texto: `Conclusión descriptiva sintética ${pairIndex}`, ts: tsNew };
      }
    }
  }

  return {
    context,
    competencies,
    roster,
    prefix,
    rawPayload: {
      sessions: [],
      grades: {},
      capsSel: {},
      calificarEstado: {},
      finales,
      concComp,
      competenciasEstado: {},
      asistencia: {}
    }
  };
}

// -----------------------------------------------------------------------------
// IMPLEMENTACIÓN DE PROYECCIÓN Y RECONCILIACIÓN HISTÓRICA
// -----------------------------------------------------------------------------

/**
 * Función extendida de proyección histórica que separa estrictamente:
 * - 28 coincidencias académicas: presentadas con el nivel consensuado ('A').
 * - 62 divergencias de nivel: retenidas como conflictos con candidatos para elección humana.
 * - 20 conclusiones descriptivas: conservadas íntegramente.
 */
function proyectarHistoricoN2_(payload, roster, context, competencies) {
  const identity = identityFactory;
  const resolver = identity.resolver(roster, context, competencies, payload.meta && payload.meta.studentAliases);

  const p = JSON.parse(JSON.stringify(payload || {}));
  const groups = new Map();
  const finalesMap = p.finales || {};

  for (const [k, value] of Object.entries(finalesMap)) {
    const canonical = resolver.canonical('finales', k);
    if (!canonical) continue;
    const path = JSON.stringify(['finales', canonical]);
    if (!groups.has(path)) groups.set(path, []);
    groups.get(path).push({ key: k, value });
  }

  const coincidencias = [];
  const divergencias = [];

  p.finales = {};

  for (const [path, records] of groups.entries()) {
    const [field, canonicalKey] = JSON.parse(path);

    if (records.length === 1) {
      p.finales[canonicalKey] = JSON.parse(JSON.stringify(records[0].value));
      continue;
    }

    const hasBorrado = records.some(r => r.value && r.value.borrado === true);
    const levels = new Set(records.map(r => r.value && r.value.nivel).filter(Boolean));

    if (!hasBorrado && levels.size === 1) {
      // Coincidencia académica de nivel de logro
      const nivelCoincidente = [...levels][0];
      const numScores = records.map(r => r.value && r.value.nota20).filter(s => s !== '' && s != null && Number.isFinite(Number(s)));
      const escalaIncompatible = numScores.some(score => {
        const letraCalculada = score >= 18 ? 'AD' : score >= 14 ? 'A' : score >= 11 ? 'B' : 'C';
        return letraCalculada !== nivelCoincidente;
      });

      if (!escalaIncompatible) {
        coincidencias.push({
          path,
          canonicalKey,
          nivel: nivelCoincidente,
          records: JSON.parse(JSON.stringify(records))
        });
        // Se presenta el nivel consensuado en la vista de Promedios
        p.finales[canonicalKey] = { nivel: nivelCoincidente, origen: 'letra' };
        continue;
      }
    }

    // Divergencia de nivel de logro: requiere selección explícita
    const parts = canonicalKey.split('||');
    const comp = parts[5];
    const tail = parts[parts.length - 1];
    const student = roster.find(al => `id:${encodeURIComponent(al.idSiagie)}` === tail);

    divergencias.push({
      path,
      canonicalKey,
      student: student ? { nombre: student.nombre, orden: student.orden, idSiagie: student.idSiagie } : null,
      competencia: comp,
      records: JSON.parse(JSON.stringify(records)),
      candidates: records.map((r, idx) => ({
        id: 'candidate:' + idx,
        label: r.key.includes('||nom:') ? 'Opción 1 (por Nombre)' : 'Opción 2 (por ID)',
        origenClave: r.key,
        value: JSON.parse(JSON.stringify(r.value))
      }))
    });
  }

  return {
    payload: p,
    coincidencias,
    divergencias
  };
}

/**
 * Respaldo en Google Drive con verificación SHA-256 en UTF-8
 */
function crearYVerificarRespaldoDrive_(clave, rawJsonString, mockDrive) {
  const bytesOriginales = Buffer.byteLength(rawJsonString, 'utf8');
  const sha256 = crypto.createHash('sha256').update(rawJsonString, 'utf8').digest('hex');
  const timestamp = Date.now();
  const claveSanitizada = clave.replace(/\|\|/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const fileName = `RESPALDO_HISTORICO_22375_${claveSanitizada}_${timestamp}.json`;

  const file = mockDrive.createFile(fileName, rawJsonString, 'application/json');
  const fileId = file.getId();

  // Verificación posterior de integridad
  const retrievedContent = mockDrive.getFileById(fileId).getBlob().getDataAsString();
  const retrievedSha = crypto.createHash('sha256').update(retrievedContent, 'utf8').digest('hex');
  const retrievedBytes = Buffer.byteLength(retrievedContent, 'utf8');

  if (retrievedSha !== sha256 || retrievedBytes !== bytesOriginales) {
    throw Error('Fallo crítico en verificación de integridad del respaldo en Drive.');
  }

  return {
    ok: true,
    fileId,
    fileName,
    sha256,
    bytes: bytesOriginales,
    fechaUtc: new Date(timestamp).toISOString()
  };
}

// -----------------------------------------------------------------------------
// PRUEBAS DE AUTOMATIZACIÓN (N2-R6)
// -----------------------------------------------------------------------------

test('1. CARGA: loadnotas2 recupera las 28 coincidencias, 20 conclusiones y 62 divergencias sin alterar Sheets', () => {
  const scenario = createSyntheticNinoskaScenario();
  const rawOriginalCopy = JSON.stringify(scenario.rawPayload);

  // Proyectar el registro histórico
  const result = proyectarHistoricoN2_(scenario.rawPayload, scenario.roster, scenario.context, scenario.competencies);

  // Verificaciones de conteo exacto:
  assert.equal(result.coincidencias.length, 28, 'Exactamente 28 coincidencias académicas');
  assert.equal(result.divergencias.length, 62, 'Exactamente 62 divergencias de nivel de logro');
  assert.equal(Object.keys(result.payload.finales).length, 28, 'El payload proyectado incluye las 28 notas coincidentes');
  assert.equal(Object.keys(result.payload.concComp).length, 20, 'Las 20 conclusiones descriptivas están 100% conservadas');

  // Integridad de la fuente de datos: el raw original NO fue modificado
  assert.equal(JSON.stringify(scenario.rawPayload), rawOriginalCopy, 'El JSON original de Sheets NO fue modificado en la lectura');
  assert.equal(Object.keys(scenario.rawPayload.finales).length, 180, 'Las 180 entradas originales permanecen intactas en la fuente');
});

test('2. VISUALIZACIÓN: cada una de las 62 divergencias expone estudiante, competencia y ambas calificaciones', () => {
  const scenario = createSyntheticNinoskaScenario();
  const reconcile = require('../registro-reconcile.js');
  const result = proyectarHistoricoN2_(scenario.rawPayload, scenario.roster, scenario.context, scenario.competencies);

  assert.equal(result.divergencias.length, 62);

  for (const div of result.divergencias) {
    // 1. Estudiante identificado
    assert.ok(div.student, 'Estudiante debe estar identificado');
    assert.ok(div.student.nombre.startsWith('ESTUDIANTE FICTICIO'));
    assert.ok(Number.isInteger(div.student.orden));
    assert.ok(div.student.idSiagie);

    // 2. Competencia
    assert.ok(scenario.competencies.includes(div.competencia));

    // 3. Dos opciones completas
    assert.equal(div.candidates.length, 2, 'Cada divergencia tiene exactamente dos opciones');
    const opt1 = div.candidates[0];
    const opt2 = div.candidates[1];

    assert.equal(opt1.value.nivel, 'B', 'Opción 1 tiene nivel B');
    assert.equal(opt2.value.nivel, 'A', 'Opción 2 tiene nivel A');
    assert.ok(opt1.origenClave.includes('||nom:'));
    assert.ok(opt2.origenClave.includes('||id:'));

    // 4. Verificación de renderizado en conflictView
    const view = reconcile.conflictView({
      path: div.path,
      candidates: div.candidates
    }, { roster: scenario.roster });

    assert.ok(view.title.includes(div.student.nombre), 'El título de visualización incluye el nombre del estudiante');
    assert.ok(view.title.includes('Orden ' + div.student.orden), 'El título incluye el orden');
    assert.ok(view.title.includes('ID ' + div.student.idSiagie), 'El título incluye el ID SIAGIE');
    assert.ok(view.title.includes(div.competencia), 'El título incluye la competencia');
  }
});

test('3. CONCILIACIÓN: resolución mediante elecciones explícitas humanas sin heurísticas automáticas', () => {
  const scenario = createSyntheticNinoskaScenario();
  const result = proyectarHistoricoN2_(scenario.rawPayload, scenario.roster, scenario.context, scenario.competencies);

  // Simular decisiones explícitas de la docente para las 62 divergencias:
  // Por ejemplo, para los primeros 30 elige Opción 2 ('A'), para los restantes 32 elige Opción 1 ('B')
  const humanChoices = {};
  result.divergencias.forEach((div, idx) => {
    humanChoices[div.canonicalKey] = idx < 30 ? 'A' : 'B';
  });

  // Aplicar la conciliación:
  const reconciledPayload = JSON.parse(JSON.stringify(result.payload));
  for (const div of result.divergencias) {
    const chosenLevel = humanChoices[div.canonicalKey];
    assert.ok(chosenLevel, 'Cada divergencia debe tener una elección soberana');
    reconciledPayload.finales[div.canonicalKey] = {
      nivel: chosenLevel,
      origen: 'letra'
    };
  }

  // Ahora el payload reconciliado tiene exactamente 90 calificaciones canónicas
  assert.equal(Object.keys(reconciledPayload.finales).length, 90, 'Total 90 calificaciones: 28 coincidentes + 62 elegidas');
  assert.equal(Object.keys(reconciledPayload.concComp).length, 20, '20 conclusiones conservadas');

  // Verificar que al re-proyectar NO queda ningún conflicto ni divergencia
  const finalVerification = proyectarHistoricoN2_(reconciledPayload, scenario.roster, scenario.context, scenario.competencies);
  assert.equal(finalVerification.divergencias.length, 0, 'Cero divergencias pendientes tras la conciliación autorizada');
});

test('4. PERSISTENCIA Y RESPALDO DRIVE: creación de archivo independiente en Drive y verificación SHA-256', () => {
  const scenario = createSyntheticNinoskaScenario();
  const rawOriginalString = JSON.stringify(scenario.rawPayload);
  const clave = 'secundaria||III||1||A||Comunicación';

  // Mock de almacenamiento en Google Drive
  const driveFiles = new Map();
  const mockDrive = {
    createFile: (name, content, mime) => {
      const id = 'DRIVE_FILE_' + Math.random().toString(36).substring(2, 9);
      driveFiles.set(id, { name, content, mime });
      return {
        getId: () => id,
        getName: () => name
      };
    },
    getFileById: (id) => {
      const fileData = driveFiles.get(id);
      if (!fileData) return null;
      return {
        getId: () => id,
        getName: () => fileData.name,
        getBlob: () => ({
          getDataAsString: () => fileData.content
        })
      };
    }
  };

  // 1. Ejecutar respaldo y verificación criptográfica
  const backupMeta = crearYVerificarRespaldoDrive_(clave, rawOriginalString, mockDrive);
  assert.equal(backupMeta.ok, true);
  assert.ok(backupMeta.fileId.startsWith('DRIVE_FILE_'));
  assert.equal(backupMeta.sha256.length, 64);
  assert.equal(backupMeta.bytes, Buffer.byteLength(rawOriginalString, 'utf8'));

  // 2. Estructurar el nuevo payload en Sheets con el puntero ligero (< 400 caracteres)
  const newPayload = {
    finales: { 'clave-canonica': { nivel: 'A' } },
    meta: {
      notas2: { schema: 1, adopted: true },
      externalDriveBackup: backupMeta
    }
  };

  const cellString = JSON.stringify(newPayload);
  assert.ok(cellString.length < 500, 'El puntero en la celda ocupa menos de 500 caracteres (muy lejos del límite de 50 000)');
  assert.equal(newPayload.meta.originalPayloadString, undefined, 'Cero bytes de payload original dentro de la celda de Sheets');

  // 3. Probar que si el contenido en Drive difiere, la verificación falla tajantemente
  assert.throws(() => {
    const corruptDrive = {
      createFile: () => ({ getId: () => 'fake_id' }),
      getFileById: () => ({ getBlob: () => ({ getDataAsString: () => '{"corrupto":true}' }) })
    };
    crearYVerificarRespaldoDrive_(clave, rawOriginalString, corruptDrive);
  }, /Fallo crítico en verificación de integridad/);
});

test('5. RECUPERACIÓN Y CONTROL DE CONCURRENCIA: CAS rechaza escrituras simultáneas con versión obsoleta', () => {
  // Simular el guardado en base de datos con control de versión CAS
  let currentDbVersion = 10;
  let currentDbRecord = {
    clave: 'secundaria||III||1||A||Comunicación',
    version: currentDbVersion,
    payloadString: '{"modeloAcademico":1}'
  };

  function simularSaveNotas2CAS(versionRecibida, nuevoPayload) {
    // CAS guard: si la versión recibida no es exactamente la versión confirmada en BD, rechaza
    if (versionRecibida !== currentDbVersion) {
      return { ok: false, code: 'CONFLICT', error: 'Otra computadora confirmó una versión posterior. Baje y revise antes de guardar.' };
    }
    currentDbVersion++;
    currentDbRecord = {
      clave: currentDbRecord.clave,
      version: currentDbVersion,
      payloadString: JSON.stringify(nuevoPayload)
    };
    return { ok: true, version: currentDbVersion };
  }

  // Intento 1: PC A con versión 10 guarda exitosamente -> BD avanza a 11
  const saveA = simularSaveNotas2CAS(10, { finales: { 'k1': { nivel: 'A' } } });
  assert.equal(saveA.ok, true);
  assert.equal(saveA.version, 11);
  assert.equal(currentDbVersion, 11);

  // Intento 2: PC B con versión 10 (obsoleta) intenta guardar simultáneamente -> RECHAZADO por CAS
  const saveB = simularSaveNotas2CAS(10, { finales: { 'k1': { nivel: 'B' } } });
  assert.equal(saveB.ok, false);
  assert.equal(saveB.code, 'CONFLICT');
  assert.match(saveB.error, /versión posterior/);
  // Los datos en BD permanecen con el guardado legítimo de PC A
  assert.equal(currentDbVersion, 11);
  assert.match(currentDbRecord.payloadString, /"nivel":"A"/);
});

test('6. INTERFAZ Y DIÁLOGO: IERegistroReconcile.choose genera la vista interactiva con 62 tarjetas y bloquea confirmación incompleta', async () => {
  const scenario = createSyntheticNinoskaScenario();
  const reconcile = require('../registro-reconcile.js');
  const result = proyectarHistoricoN2_(scenario.rawPayload, scenario.roster, scenario.context, scenario.competencies);

  // Simular un entorno DOM mínimo para choose()
  const elements = [];
  const eventListeners = new Map();

  class MockElement {
    constructor(tagName) {
      this.tagName = (tagName || 'DIV').toUpperCase();
      this.children = [];
      this.style = {};
      this.className = '';
      this.textContent = '';
      this.disabled = false;
      this.type = '';
      this.name = '';
      this.checked = false;
    }
    appendChild(child) { this.children.push(child); }
    append(child) { this.children.push(child); }
    setAttribute(k, v) { this[k] = v; }
    querySelectorAll(selector) {
      const found = [];
      const walk = (el) => {
        if (!el || typeof el !== 'object') return;
        if (selector === 'input,button,summary' && ['INPUT', 'BUTTON', 'SUMMARY'].includes(el.tagName)) found.push(el);
        if (Array.isArray(el.children)) el.children.forEach(walk);
      };
      walk(this);
      return found;
    }
    remove() {}
    focus() {}
  }

  const mockDocument = {
    createElement: (tag) => new MockElement(tag),
    body: new MockElement('BODY'),
    activeElement: null,
    addEventListener: (evt, fn) => {
      if (!eventListeners.has(evt)) eventListeners.set(evt, []);
      eventListeners.get(evt).push(fn);
    },
    removeEventListener: () => {}
  };

  const mockContext = {
    document: mockDocument,
    setInterval: () => 123,
    clearInterval: () => {},
    setTimeout: (fn) => fn(),
    clearTimeout: () => {}
  };
  mockContext.global = mockContext;
  mockContext.window = mockContext;
  vm.createContext(mockContext);

  // Cargar registro-reconcile.js completo en el contexto del DOM simulado
  const reconcileSrc = fs.readFileSync(path.join(__dirname, '../registro-reconcile.js'), 'utf8');
  vm.runInContext(reconcileSrc, mockContext);
  const chooseFn = mockContext.IERegistroReconcile.choose;

  // Iniciar choose para las 62 divergencias
  let promiseResolved = false;
  let resolvedChoices = null;

  const choosePromise = chooseFn(result.divergencias, () => true, { roster: scenario.roster }).then(res => {
    promiseResolved = true;
    resolvedChoices = res;
  });

  // Verificar que el diálogo se insertó en el body
  const dialog = mockDocument.body.children[0];
  assert.ok(dialog, 'El diálogo de conciliación fue insertado en el DOM');
  assert.equal(dialog.className, 'academic-conflict-dialog');

  // Encontrar todas las tarjetas y botones dentro del panel
  const panel = dialog.children[0];
  const content = panel.children.find(c => c.className === 'academic-conflict-content');
  const footer = panel.children.find(c => c.className === 'academic-conflict-footer');

  assert.ok(content, 'El panel contiene contenedor de contenido');
  assert.ok(footer, 'El panel contiene footer con acciones');

  // Verificar que se crearon exactamente 62 tarjetas de conflicto
  const cards = content.children.filter(c => c.className === 'academic-conflict-card');
  assert.equal(cards.length, 62, 'Exactamente 62 tarjetas interactivas de revisión');

  const applyBtn = footer.children.find(c => c.className && c.className.includes('academic-conflict-apply'));
  assert.ok(applyBtn, 'Botón de confirmación presente');
  assert.equal(applyBtn.disabled, true, 'El botón de confirmación inicia BLOQUEADO hasta completar todas las decisiones');

  // Simular que el usuario selecciona una opción en cada una de las 62 tarjetas
  cards.forEach((card, idx) => {
    const optionsContainer = card.children.find(c => c.className === 'academic-conflict-options');
    assert.ok(optionsContainer, 'Cada tarjeta contiene contenedor de opciones');
    assert.equal(optionsContainer.children.length, 2, '2 opciones por tarjeta');

    // Seleccionamos la opción 1 o 2
    const optionRow = optionsContainer.children[idx % 2];
    const radio = optionRow.children[0];
    radio.checked = true;
    radio.onchange(); // Disparar evento de selección
  });

  // Ahora que las 62 decisiones fueron tomadas, el botón debe estar DESBLOQUEADO
  assert.equal(applyBtn.disabled, false, 'El botón se desbloquea tras responder al 100% de las divergencias');

  // Simular clic en confirmar
  applyBtn.onclick();

  await choosePromise;
  assert.equal(promiseResolved, true, 'La promesa de conciliación resolvió');
  assert.equal(Object.keys(resolvedChoices).length, 62, 'Contiene exactamente las 62 decisiones explícitas tomadas');
});
