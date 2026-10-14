# PR #81 — impresión de Promedios

Base: 9d1a62c5bd27049105b46feb4c558c0f59f94371. Se siguió el comentario técnico del PR: el generador imprimía solo las letras y excluía estadísticas en Promedios; no consultaba concCompAlumno.

Solo cambia producción en imprimirResumen(opciones) cuando promedios es true, y CSS exclusivo de impresión .promedios-print. La tabla de notas, encabezado, A4 horizontal y firmas se conservan. Debajo se agrega un anexo de conclusiones efectivamente registradas con Estudiante, Competencia, Nivel y Conclusión. Los textos se leen por identidad con concCompAlumno, se escapan y se imprimen completos en 7,5 pt; no hay textos automáticos ni placeholders. Una conclusión conservada de competencia no trabajada se identifica explícitamente como No trabajada, sin convertirla en resultado activo ni borrarla.

Primaria recupera estadisticaResumenHTML y estadisticasCompetenciasHTML una sola vez. Se mantienen los conteos/cálculos y su leyenda: el resumen general está basado en promedio referencial informativo, no determina promoción ni SIAGIE. Los resultados efectivos, sin nota, conclusiones pendientes y avance permanecen desglosados por competencia. Secundaria recibe el anexo sin nuevas estadísticas, de acuerdo con el alcance solicitado.

La consulta cerrada sigue usando la proyección y el padrón histórico ya verificados; no lee el borrador editable ni transversales no confirmadas. No modifica notas, conclusiones, modelo académico, permisos, cierres, almacenamiento o contratos A1/B1/B2. Resumen conserva exactamente su HTML anterior; Calificar y Asistencia mantienen sus generadores intactos.

El HEAD de partida traía 31 fallos derivados de los botones visuales de contexto añadidos sin actualizar las fixtures y snapshots. Se adaptaron exclusivamente pruebas: mocks de hooks de presentación en harnesses aislados, normalización histórica acotada a la interfaz aprobada y expectativas del ancho visual de conclusión. No se modificó esa interfaz ni se eliminaron/desactivaron pruebas de seguridad. La nueva regresión compara toda la fuente productiva con el HEAD inicial, exceptuando únicamente el generador compartido y el CSS de impresión aprobado para Promedios; comprueba también que los demás generadores, cálculos y backend permanecen idénticos.

Validación: 2089 aprobadas, 0 fallidas/omitidas/canceladas, con 15 regresiones nuevas. Primaria y Secundaria, 30/40 alumnos sintéticos, Letras/0–20, cinco competencias, B/C, ausencia de texto, identidades históricas y escape de caracteres especiales. Se ejecutan los renderizadores reales con almacenamiento simulado y cero escrituras remotas.

Fixture para Live Server:

```powershell
node tests/registro-bimestral-print-fixture.cjs promedios.html primaria "Personal Social" 40 promedios
```

La fixture es autónoma, usa datos ficticios y bloquea red. Verificar en impresión nativa texto completo, repetición de encabezados, filas completas, A4 horizontal y firmas finales. No se generó PDF nativo por la limitación de navegador previamente documentada: el HTML/CSS automatizado no certifica paginación física ni ausencia real de solapamientos.

Reversión: revertir este commit. Sin migración de datos, cambios en Apps Script/Sheets, merge o deploy.
