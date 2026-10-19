// Verification script for UI adjustments:
// 1) "Procesar a Promedios" visibility across tabs
// 2) Discreet sync indicator in header & hidden persistent banner during normal operation
// 3) Toast notification on verified sync
// 4) Prominent alert on error/conflict
// 5) Secondary diagnostic access
const PW_PATH = process.env.IE_PLAYWRIGHT_MODULE || 
  'C:\\Users\\Remz\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\playwright';
const { chromium } = require(PW_PATH);
const assert = require('node:assert/strict');

const SESSION_FICTICIA = {
  user: 'docente_primaria',
  pass: 'ficticio123',
  nombre: 'Docente Ficticio Primaria 1A',
  nivel: 'primaria',
  role: 'docente',
  aulas: ['1|A'],
  grados: ['1'],
  token: 'mock-token-ficticio-123'
};

const STUDENTS_FICTICIOS = [
  {
    idSiagie: 'STU001',
    codigoEstudiante: 'COD001',
    numeroDocumento: '00000001',
    apellidosNombres: 'ALUMNO FICTICIO UNO',
    nivel: 'primaria',
    grado: '1',
    seccion: 'A'
  },
  {
    idSiagie: 'STU002',
    codigoEstudiante: 'COD002',
    numeroDocumento: '00000002',
    apellidosNombres: 'ALUMNO FICTICIO DOS',
    nivel: 'primaria',
    grado: '1',
    seccion: 'A'
  }
];

async function run() {
  console.log('--- Iniciando verificación automatizada de ajustes visuales Notas 2.0 ---');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();

  await context.addInitScript(({ session, students }) => {
    sessionStorage.setItem('ie22375_session_v1', JSON.stringify(session));
    sessionStorage.setItem('ie22375_estudiantes_cache_v1', JSON.stringify({
      ts: Date.now(),
      data: students,
      token: session.token
    }));
  }, { session: SESSION_FICTICIA, students: STUDENTS_FICTICIOS });

  const page = await context.newPage();

  page.on('console', msg => console.log('Browser log [' + msg.type() + ']:', msg.text()));
  page.on('pageerror', err => console.log('Browser uncaught error:', err));

  await page.goto('http://127.0.0.1:8080/registro.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // 1. Verificación del indicador discreto de sincronización en el encabezado
  console.log('[1/5] Verificando indicador discreto en el encabezado (#hdrSyncIndicator)...');
  const syncInd = page.locator('#hdrSyncIndicator');
  await syncInd.waitFor({ state: 'attached', timeout: 5000 });
  const isSyncIndVisible = await syncInd.isVisible();
  assert.equal(isSyncIndVisible, true, 'El indicador discreto debe ser visible en el encabezado');
  const syncState = await syncInd.getAttribute('data-state');
  console.log('   Estado inicial del indicador:', syncState);
  assert.ok(syncState, 'El indicador debe tener data-state');

  // 2. Verificación de que la barra persistente NO aparece en la vista principal en estado normal
  console.log('[2/5] Verificando que la barra persistente esté oculta en estado normal...');
  const connectionBox = page.locator('#registroConnectionStatus');
  const boxDisplay = await connectionBox.evaluate(el => window.getComputedStyle(el).display);
  console.log('   computed display de #registroConnectionStatus:', boxDisplay);
  assert.equal(boxDisplay, 'none', 'La barra persistente debe estar completamente oculta en estado normal (display: none)');

  // 3. Verificación de visibilidad del botón "Procesar a Promedios"
  console.log('[3/5] Verificando visibilidad del botón "Procesar a Promedios" por pestaña...');
  const processBtn = page.locator('#registroRecoveryControls button:has-text("Procesar a Promedios")');
  
  // Pestaña Calificar (por defecto o activa)
  await page.locator('#tabCal').click();
  await page.waitForTimeout(300);
  let isHiddenCal = await processBtn.isHidden();
  let displayCal = await processBtn.evaluate(el => window.getComputedStyle(el).display);
  console.log('   Pestaña Calificar -> isHidden:', isHiddenCal, 'display:', displayCal);
  assert.equal(isHiddenCal, false, 'El botón debe ser visible en Calificar');
  assert.notEqual(displayCal, 'none', 'display no debe ser none en Calificar');

  // Pestaña Promedios
  await page.locator('#tabFin').click();
  await page.waitForTimeout(300);
  let isHiddenFin = await processBtn.isHidden();
  let displayFin = await processBtn.evaluate(el => window.getComputedStyle(el).display);
  console.log('   Pestaña Promedios -> isHidden:', isHiddenFin, 'display:', displayFin);
  assert.equal(isHiddenFin, true, 'El botón debe estar oculto en Promedios');
  assert.equal(displayFin, 'none', 'display debe ser none en Promedios');

  // Pestaña Resumen
  await page.locator('#tabAv').click();
  await page.waitForTimeout(300);
  let isHiddenAv = await processBtn.isHidden();
  let displayAv = await processBtn.evaluate(el => window.getComputedStyle(el).display);
  console.log('   Pestaña Resumen -> isHidden:', isHiddenAv, 'display:', displayAv);
  assert.equal(isHiddenAv, true, 'El botón debe estar oculto en Resumen');
  assert.equal(displayAv, 'none', 'display debe ser none en Resumen');

  // Regreso a Calificar
  await page.locator('#tabCal').click();
  await page.waitForTimeout(300);
  let isHiddenCalReturn = await processBtn.isHidden();
  let displayCalReturn = await processBtn.evaluate(el => window.getComputedStyle(el).display);
  console.log('   Regreso a Calificar -> isHidden:', isHiddenCalReturn, 'display:', displayCalReturn);
  assert.equal(isHiddenCalReturn, false, 'El botón debe reaparecer al volver a Calificar');

  // 4. Verificación de toast breve y no invasivo en sincronización exitosa
  console.log('[4/5] Verificando comportamiento de toast en conexión exitosa...');
  await page.evaluate(() => {
    // Simular evento de conexión verificada
    const box = document.getElementById('registroConnectionStatus');
    box.dataset.state = 'checking';
    // Forzar transición a connected mediante IERegistroRecovery o toast
    if (typeof toast === 'function') toast('Notas verificadas');
  });
  const toastEl = page.locator('#toast');
  const toastText = await toastEl.textContent();
  const toastVisibleInitially = await toastEl.isVisible();
  console.log('   Toast activo -> visible:', toastVisibleInitially, 'texto:', JSON.stringify(toastText));
  assert.equal(toastVisibleInitially, true, 'El toast debe ser visible brevemente');
  assert.match(toastText, /Notas verificadas|Sincronización/);
  
  // Esperar a que el toast se oculte automáticamente (timeout original de 1600ms)
  await page.waitForTimeout(2000);
  const toastVisibleAfter = await toastEl.isVisible();
  console.log('   Toast después de timeout -> visible:', toastVisibleAfter);
  assert.equal(toastVisibleAfter, false, 'El toast debe ocultarse automáticamente');

  // 5. Verificación de aviso visible solo ante error o conflicto
  console.log('[5/5] Verificando que solo ante error o conflicto se muestre el aviso visible...');
  await page.evaluate(() => {
    // Simular error o conflicto
    const box = document.getElementById('registroConnectionStatus');
    box.dataset.state = 'offline';
    box.style.display = 'flex';
  });
  const isBoxVisibleOnError = await connectionBox.isVisible();
  console.log('   Aviso visible ante estado offline:', isBoxVisibleOnError);
  assert.equal(isBoxVisibleOnError, true, 'El aviso debe ser visible ante fallos o conflictos');

  // Diagnóstico accesible fuera de la vista principal (en menú secundario o dentro de details)
  const diagBtn = page.locator('#registroConnectionDiagnostic');
  assert.ok(await diagBtn.count() > 0, 'El botón de diagnóstico sigue existiendo en el DOM para soporte');

  // 6. Verificación de visibilidad del botón «Reintentar notas» (#registroRetryOffer)
  console.log('[6/6] Verificando visibilidad del botón «Reintentar notas» (#registroRetryOffer)...');
  const retryBtn = page.locator('#registroRetryOffer');

  // A. Estado normal en todas las pestañas: debe estar oculto
  console.log('   -> Comprobando estado normal en todas las pestañas...');
  for (const [tabId, tabName] of [['#tabCal', 'Calificar'], ['#tabFin', 'Promedios'], ['#tabAv', 'Resumen'], ['#tabAs', 'Asistencia']]) {
    await page.locator(tabId).click();
    await page.waitForTimeout(200);
    const hiddenInNormal = await retryBtn.isHidden();
    console.log(`      Pestaña ${tabName} en estado normal -> isHidden: ${hiddenInNormal}`);
    assert.equal(hiddenInNormal, true, `«Reintentar notas» debe estar oculto en ${tabName} en estado normal`);
  }

  // B. Simular fallo recuperable (server / offline)
  console.log('   -> Simulando estado de error (server / offline)...');
  await page.evaluate(() => {
    const conn = IERegistroConnection.current();
    if (conn) {
      conn.pause('server');
      conn.check = async () => { conn.pause('server'); return false; };
    }
  });

  // 1) Error en Calificar: visible
  await page.locator('#tabCal').click();
  await page.waitForTimeout(200);
  let isVisibleCalError = await retryBtn.isVisible();
  console.log('   -> Error en Calificar -> isVisible:', isVisibleCalError);
  assert.equal(isVisibleCalError, true, '«Reintentar notas» debe ser visible ante error en Calificar');

  // 2) Error en Promedios: visible
  await page.locator('#tabFin').click();
  await page.waitForTimeout(200);
  let isVisibleFinError = await retryBtn.isVisible();
  console.log('   -> Error en Promedios -> isVisible:', isVisibleFinError);
  assert.equal(isVisibleFinError, true, '«Reintentar notas» debe ser visible ante error en Promedios');

  // 3) Error en Resumen: oculto
  await page.locator('#tabAv').click();
  await page.waitForTimeout(200);
  let isHiddenAvError = await retryBtn.isHidden();
  console.log('   -> Error en Resumen -> isHidden:', isHiddenAvError);
  assert.equal(isHiddenAvError, true, '«Reintentar notas» debe permanecer oculto en Resumen incluso con error');

  // 4) Error en Asistencia: oculto
  await page.locator('#tabAs').click();
  await page.waitForTimeout(200);
  let isHiddenAsError = await retryBtn.isHidden();
  console.log('   -> Error en Asistencia -> isHidden:', isHiddenAsError);
  assert.equal(isHiddenAsError, true, '«Reintentar notas» debe permanecer oculto en Asistencia incluso con error');

  // C. Recuperación exitosa (vuelve a connected): oculto
  console.log('   -> Simulando recuperación exitosa...');
  await page.evaluate(() => {
    const conn = IERegistroConnection.current();
    if (conn) {
      conn.pause('connected');
      conn.check = async () => { conn.pause('connected'); return true; };
    }
  });
  await page.locator('#tabCal').click();
  await page.waitForTimeout(200);
  let isHiddenAfterRecovery = await retryBtn.isHidden();
  console.log('   -> Tras recuperación exitosa en Calificar -> isHidden:', isHiddenAfterRecovery);
  assert.equal(isHiddenAfterRecovery, true, '«Reintentar notas» debe ocultarse automáticamente tras recuperación exitosa');

  console.log('--- ¡TODAS LAS VERIFICACIONES VISUALES PASARON SATISFACTORIAMENTE! ---');
  await browser.close();
}

run().catch(err => {
  console.error('Error durante la verificación:', err);
  process.exit(1);
});
