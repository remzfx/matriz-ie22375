
function comprobarSheetsV4Seguro() {
  const resultado = verificarServicioLimpiezaCalificaciones_();
  console.log(JSON.stringify(resultado));
  
}

function inventarioFinalSeguro() {
  const resultado = prepararLimpiezaCalificaciones_();
  console.log(JSON.stringify(resultado));

}

function ejecutarLimpiezaAutorizada() {
  const plan = prepararLimpiezaCalificaciones_();

  if (!plan.ok || plan.mode !== 'dry-run') {
    throw new Error('Inventario no autorizado.');
  }

  const esperados = {
    RegistroNotas: 6,
    EstadosAreas: 125,
    Estados: 1,
    TransversalesAportes: 1
  };

  for (const [hoja, cantidad] of Object.entries(esperados)) {
    if (plan.counts[hoja] !== cantidad) {
      throw new Error('Cambió el inventario: ' + hoja);
    }
  }

  if (plan.files !== 0) {
    throw new Error('Archivos históricos no previstos.');
  }

  for (const hoja of ['PRIMARIA', 'SECUNDARIA']) {
    const c = plan.classifications[hoja];
    if (c?.kind !== 'headers-only-derived-statistics'
        || c.dataRows !== 0) {
      throw new Error('Clasificación inesperada: ' + hoja);
    }
  }

  const resultado = ejecutarLimpiezaCalificaciones_({
    ...plan,
    confirmation: 'ELIMINAR SOLO CALIFICACIONES'
  });

  console.log(JSON.stringify(resultado));
}

function verificarEstadoLimpiezaSeguro() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('AcademicResetControl');

  if (!hoja) {
    console.log('MARCADOR: NO EXISTE');
    console.log('No repetir la limpieza.');
    return;
  }

  const encabezados = hoja.getRange('A1:E1').getValues()[0];
  const estado = hoja.getRange('A2:E2').getValues()[0];

  console.log('MARCADOR: EXISTE');
  console.log('Encabezados: ' + JSON.stringify(encabezados));
  console.log('Esquema: ' + estado[0]);
  console.log('Epoch presente: ' + Boolean(estado[1]));
  console.log('Fase: ' + estado[3]);
  console.log('Manifiesto presente: ' + Boolean(estado[4]));
}

function diagnosticarLimpiezaBloqueada() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const control = ss.getSheetByName('AcademicResetControl');

  if (!control) {
    console.log('SIN MARCADOR. NO REINTENTAR.');
    return;
  }

  const fila = control.getRange('A2:E2').getValues()[0];
  const epoch = String(fila[1]);
  const fase = String(fila[3]);

  console.log('Fase: ' + fase);
  console.log('Epoch válido: ' + /^[a-f0-9]{32}$/.test(epoch));

  const registro = ss.getSheetByName('RegistroNotas');
  if (!registro) {
    console.log('RegistroNotas no encontrado.');
    return;
  }

  const ultima = registro.getLastRow();
  const valores = ultima > 1
    ? registro.getRange(2, 9, ultima - 1, 1).getValues()
    : [];

  let vacios = 0;
  let conNotas = 0;
  let errores = 0;
  let conAsistencia = 0;

  for (const [raw] of valores) {
    if (!raw) continue;

    try {
      const p = JSON.parse(raw);
      const notas = ['grades', 'finales', 'concComp', 'concArea']
        .some(k => p[k] &&
          typeof p[k] === 'object' &&
          Object.keys(p[k]).length > 0);

      const sesiones = Array.isArray(p.sessions) &&
        p.sessions.length > 0;

      if (notas || sesiones) conNotas++;
      else vacios++;

      if (p.asistencia || p.asisFechas || p.asisFechasEstado) {
        conAsistencia++;
      }
    } catch (_) {
      errores++;
    }
  }

  console.log('Registros académicos vacíos: ' + vacios);
  console.log('Registros que conservan notas: ' + conNotas);
  console.log('JSON ilegibles: ' + errores);
  console.log('Registros con campos de asistencia: ' + conAsistencia);
  console.log('DIAGNÓSTICO DE SOLO LECTURA COMPLETADO');
}

function finalizarLimpiezaPendienteSeguro() {
  academicResetOwner_();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const control = ss.getSheetByName('AcademicResetControl');
  const manifest = JSON.parse(control.getRange('E2').getValue());

  if (!Array.isArray(manifest.files) || manifest.files.length !== 0) {
    throw new Error('Existen archivos pendientes. Detener.');
  }

  const areas = ss.getSheetByName('EstadosAreas');
  const datos = areas.getRange(
    2, 3, areas.getLastRow() - 1, 8
  ).getValues();

  const segundo = datos.filter(r => r[0] === 'II');

  if (segundo.length !== 108 ||
      segundo.some(r => !r[7] || r[7] === '{}')) {
    throw new Error('Consolidados II no verificados.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const estado = academicResetState_();

    if (estado.phase !== 'blocked') {
      throw new Error('Estado inesperado: ' + estado.phase);
    }

    const resultado = academicResetFinishFiles_(estado);

    SpreadsheetApp.flush();
    console.log(JSON.stringify(resultado));
    console.log('Fase: ' + academicResetState_().phase);
  } finally {
    lock.releaseLock();
  }
}




