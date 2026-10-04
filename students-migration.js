/* Etapa A: preparación manual aislada; no cambia la base usada por los módulos actuales. */
(function(global) {
  'use strict';
  const listas = {primaria: null, secundaria: null};
  let ocupada = false;
  function mensaje(text) { document.getElementById('migracionEstado').textContent = text; }
  async function importar(input, nivel) {
    if (ocupada) return;
    listas[nivel] = null;
    document.getElementById('migracionRevisada').checked = false;
    const file = input.files && input.files[0];
    if (!file) return;
    ocupada = true;
    try {
      const text = await file.text();
      // No usar la copia empotrada, localStorage ni exportaciones antiguas de la plataforma como semilla.
      if (!/ApellidoPaterno/i.test(text) || !/NumeroDeOrden|ITEM/i.test(text) || !/EstadoMatricula/i.test(text)) {
        throw new Error('Selecciona un CSV SIAGIE vigente con cabeceras de matrícula, no la base antigua de la plataforma.');
      }
      const destino = document.getElementById('importNivel');
      const anterior = destino.value;
      let list;
      try { destino.value = nivel; list = global.parseCSV(text); }
      finally { destino.value = anterior; }
      if (!list.length || list.some(a => a.nivel !== nivel)) throw new Error('Revisa el nivel y los alumnos del archivo SIAGIE.');
      listas[nivel] = list;
      document.getElementById('migracionPreview-' + nivel).textContent = list.map(a => a.grado + '° ' + a.seccion + ' · ' + a.orden + ' · ' + a.nombre).join('\n');
      mensaje('Borrador SIAGIE: Primaria ' + (listas.primaria || []).length + ' · Secundaria ' + (listas.secundaria || []).length + '. Revisa ambas listas antes de confirmar.');
    } catch(e) {
      document.getElementById('migracionPreview-' + nivel).textContent = '';
      mensaje(e.message);
    } finally { ocupada = false; }
  }
  async function verificar() {
    if (ocupada) return;
    ocupada = true;
    mensaje('Verificando la base privada en el servidor…');
    try {
      const base = await IEStudents.load();
      if (base.offline) throw new Error('La verificación requiere conexión; una caché no confirma producción.');
      if (base.inicializada) {
        ['primaria', 'secundaria'].forEach(nivel => {
          document.getElementById('migracionPreview-' + nivel).textContent = base[nivel].estudiantes.map(a => a.grado + '° ' + a.seccion + ' · ' + a.orden + ' · ' + a.nombre).join('\n');
        });
      }
      mensaje(base.inicializada ? 'Base privada inicializada: Primaria ' + base.primaria.estudiantes.length + ' · Secundaria ' + base.secundaria.estudiantes.length + '. Confirma estos datos antes de autorizar la etapa B.' : 'Backend disponible. Hoja privada pendiente de la importación SIAGIE revisada.');
    } catch(e) { mensaje(e.message); }
    finally { ocupada = false; }
  }
  async function inicializar() {
    if (ocupada) return;
    if (!listas.primaria || !listas.secundaria || !document.getElementById('migracionRevisada').checked) {
      mensaje('Importa ambos CSV SIAGIE vigentes y confirma que revisaste las dos listas.'); return;
    }
    if (!confirm('¿Inicializar una sola vez la base privada y su respaldo con estas dos listas SIAGIE revisadas? La base pública actual y los módulos existentes se conservan en esta etapa.')) return;
    ocupada = true;
    try {
      const actual = await IEStudents.load();
      if (actual.offline) throw new Error('La inicialización requiere conexión al backend.');
      if (actual.inicializada) throw new Error('La base privada ya está inicializada. No se reemplazará durante la migración.');
      await IEStudents.initialize({primaria: {estudiantes: listas.primaria}, secundaria: {estudiantes: listas.secundaria}}, actual.version);
      mensaje('Base privada y respaldo inicializados desde SIAGIE revisado. Verifica los datos en servidor; la etapa B sigue pendiente de tu autorización.');
    } catch(e) { mensaje(e.message); }
    finally { ocupada = false; }
  }
  global.IEMigrateStudents = {importar: importar, verificar: verificar, inicializar: inicializar};
})(window);
