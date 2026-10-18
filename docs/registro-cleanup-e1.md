# Bloque E1 — eliminación de código muerto confirmado

Base: `47d357a3bccf7706fd626adc11a4a6fcf0acb9da`.
Rama local: `refactor/aip-limpieza-arquitectura`.

## Retirada exacta

Solo cambia un archivo de producción: `registro.html`.

- `markDirty()` (antes 2162–2164): eliminada su declaración de tres líneas.
  La nueva búsqueda de todo el árbol versionado confirmó que no tenía llamadas,
  handlers HTML, export ni registro de despacho dinámico. Se conservan `dirty`,
  `dirtyAcademico`, `markClean` y asignaciones activas de cambios.
- `renderChipsCaps()` (antes 2504): eliminada su declaración vacía.
- Eliminadas sus ocho llamadas: `onContexto` (1995), `onCompChange` (2149),
  `onSesionChange` (2195), dos ramas de `activarSesion` (2230, 2240),
  `abrirSesionFecha` (2431), `borrarSesionFecha` (2455) y `quitarCapGrilla` (2531).
  Las líneas citadas son las de la base, no las desplazadas del resultado.

El cuerpo retirado se ejecutó en VM con acceso prohibido a DOM, store,
selección, almacenamiento y transporte: no produjo efectos. No apareció un
consumidor nuevo que obligara a suspender alguna retirada. Las referencias
restantes en tests/docs son evidencia histórica, no código cargado por la UI.

**12 líneas de producción eliminadas; ninguna implementación trasladada ni
sustituida.** HTML: 3873 → 3861 líneas. No hay cambio de módulo, carga ni SW.
No se tocan A3–A7 ni los candidatos B.

## Pruebas adaptadas

- `registro-session-preparation.test.cjs`: deja de simular el callback como
  evento `chips`. La versión anterior ejecuta su no-op real cuando corresponde;
  ambas versiones se comparan por selección, sesión activa, valores, store y
  render. Se conserva el orden de los efectos útiles `load/save/render`.
- `registro-caps-default.test.cjs`, `registro-resilience.test.cjs` y
  `registro-transversales-integracion.test.cjs`: retirados stubs vacíos
  innecesarios. Se mantienen las aserciones de cambios reales, estados,
  sesiones, fechas, notas y directos.
- `registro-script-fixture.cjs`: el comparador histórico reconstruye solamente
  los diez fragmentos exactos retirados (dos declaraciones y ocho llamadas).
  Esto solo sirve a los goldens de etapas anteriores, no a producción. No se
  normalizan guardas ni mutaciones adicionales.
- Nueva `registro-e1-dead-code.test.cjs`: verifica el diff completo del HTML
  contra la base, exclusivamente las eliminaciones autorizadas; ejecuta el
  no-op anterior con APIs prohibidas; comprueba que el comparador histórico
  sigue detectando un cambio ajeno de guarda.
- `registro-connection-browser.cjs`: acepta opcionalmente un HTML de referencia
  para reutilizar el mismo fixture aislado antes/después, sin variar dependencias.
- Nuevo `registro-e1-browser.cjs`: compara el núcleo y DOM reales de ambas
  versiones en perfiles independientes; no sustituye los handlers académicos.

## Validación ejecutada

- Focalizadas de capacidades, colecciones vacías, selección por defecto y
  resiliencia: **73/73**.
- E1, recuperación y Guardar unificado: **27/27**. Incluyen recuperación,
  cancelación, cuota/IndexedDB, undo tras reapertura, cambios de contexto durante
  operación y conservación de asistencia/respaldos; cero escritura remota.
- Suite completa `node --test tests/*.test.cjs`: **2627 aprobadas, 0 fallidas,
  0 omitidas, 0 canceladas**. Tres pruebas nuevas sobre las 2624 anteriores.
- Edge aislado antes/después: Primaria/Secundaria × 1366/390 px, dos perfiles
  por combinación (**cuatro pares, ocho perfiles**), 30 alumnos ficticios.
  Ocho checkpoints por par comparan datos académicos, selección, sesión activa,
  contexto y HTML de Calificar/Promedios: **32 comparaciones de checkpoints**.
  Incluyen agregar/reseleccionar capacidades, edición manual, cambio de
  competencia, calificación masiva, Guardar local, abrir fecha vacía y volver,
  quitar otra capacidad y cambiar efectivamente entre Matemática/Comunicación.
  Se conservan evidencia A, conclusión, directos y asistencia de otro contexto.
- Los timestamps nuevos se excluyen solo del comparador entre perfiles para
  evitar diferencias de reloj. Además se comprueba que los timestamps previos
  de conclusión y asistencia permanecen exactamente en 12345. La comparación
  no normaliza valores de notas, fechas, claves, orden ni conclusiones.
- Edge aislado: cuatro escenarios adicionales de conexión Primaria/Secundaria
  a 1366/390 px, pérdida/reconexión, actualización desde servidor simulado,
  edición iniciada antes del corte, conflicto real y revisión cancelada.
  Notas locales conservadas y cero subidas.
- En todas las pruebas de navegador: red externa bloqueada, backend ficticio,
  perfiles nuevos, errores de página controlados y cero POST académico.
- Sintaxis/dependencias: `node scripts/check-source.cjs`.
- Revisión manual del diff y `git diff --check`.

Los escenarios de recuperación positiva/undo se ejecutaron en el backend y
almacenamiento simulados de las pruebas Node existentes, no como interacción
de recuperación en Edge. El HTML completo coincide con la base salvo las doce
líneas eliminadas; no hay cambios en implementación de recuperación, guardas o
contratos. No se afirma validación de datos reales ni de publicación.

## Alcance y conservación

Producción: solo `registro.html`.
Pruebas: los seis archivos existentes adaptados y los dos nuevos indicados
arriba (ocho archivos de pruebas en total).
Documentación: este informe.

GAS, matrices, identidad, permisos, cierres, padrón, asistencia, contratos de
nube, almacenamiento, algoritmos y reglas académicas no cambian. Los cuerpos
que implementan esas responsabilidades son idénticos a la base. No se leyó,
modificó ni borró ningún dato real, incluidos los registros prioritarios de
Ninoska Galindo III/2026, matriz consolidada II/2026 y los demás períodos.

## Riesgos y reversión

No se identificó riesgo funcional nuevo en el sistema versionado. No pueden
certificarse extensiones o llamadas manuales de consola ajenas al repositorio.
Los adaptadores de goldens históricos siguen siendo deuda de pruebas: no se
aborda B11 aquí y no se usan para ocultar cambios de negocio o seguridad.

Un único commit local contiene el bloque. Revertirlo recupera los símbolos,
llamadas y ajustes de tests, sin migración, limpieza de caché o restauración de
datos. No se ejecutó reversión. Sin CI remoto nuevo: no hay push ni PR.

Bloque terminado para revisión. Sin nuevas etapas, push, PR, merge ni deploy.
