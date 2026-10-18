# Etapa 3A — núcleo de lectura académica

Base: `b7e36192a1e50f3719f2dffba7b0f4b349a3673a`, rama local
`refactor/aip-limpieza-arquitectura`. No incorpora PR #101.

## Separación realizada

`registro.html` conserva los adaptadores `notaDirectaAlumno`,
`notaDesdeSesiones` y `notaCompAlumno`: tienen consumidores reales en
Promedios, Resumen, impresión, estadísticas y validación SIAGIE.
Se retiraron sus implementaciones de cálculo; no se eliminaron sus contratos.

`registro-grading.js` es la única implementación del cálculo extraído:

- `sessionsFor(sessions, context, competence)`: selecciona sesiones por nivel,
  bimestre, grado, sección, área y competencia. Solo grado conserva comparación
  mediante String. Conserva orden, capacidades, fechas y sesiones repetidas.
- `direct(record, math)`: interpreta el registro directo ya resuelto.
- `calculated(records, math)`: convierte evidencias y calcula su media redondeada.
- `effective(worked, direct, calculated, math)`: aplica prioridad de directo,
  calculado y ausencia de resultado; conserva `src: P/C`.

El motor matemático es una entrada explícita: la instancia existente
`IERegistroEvaluacion`, sin nuevas fórmulas ni instancias por celda.
El módulo no conoce DOM, store, identidad, persistencia, permisos ni transporte.
El adaptador sigue resolviendo las claves con `finalKey`, `identidadAlumno` y
`leerNota`. Se mantienen alias verificados, tombstones y lectura histórica.
Una competencia no trabajada no lee notas; un directo válido no lee evidencias.
Las conclusiones no participan en la media y no son reescritas.

## Dependencias y carga

Script clásico síncrono después de `registro-evaluation.js` y antes del núcleo.
Sin dependencias circulares. Los guards de arranque y recuperación exigen el
módulo nuevo: un fallo detiene edición y conserva almacenamiento, sin fallback
de cálculo ni autorizaciones antiguas. El precache incluye el nuevo archivo.
SW sigue en v22: esta rama completa continúa sin publicar; no se tocaron cachés
reales ni políticas de red, expiración o exclusión de datos privados.

## Equivalencia y pruebas

El commit de caracterización precede al de extracción y pasó contra el código
anterior. `registro-grading-equivalence.test.cjs` compara ambas implementaciones
contra `git show b7e3619:registro.html`, ejecutando los lectores reales de identidad.
Compara resultado, orden de lecturas, claves y ausencia de escrituras.

- Primaria/Secundaria × Letras/0–20, con 121 combinaciones de directo/evidencia
  por contexto: 484 combinaciones. Incluye AD/A/B/C, cero, vacío, 13.5,
  representaciones históricas, inválidos y borrados. No endurece silenciosamente
  la coerción histórica ni confunde el validador de entrada con el lector.
- Directo B prevalece sobre evidencia AD; directo borrado recupera calculado.
- Sesiones de otro contexto no intervienen. Capacidades distintas conservan su
  peso; sesiones repetidas mantienen la ponderación anterior (0,0,20 → 7).
- Alias históricos continúan leyendo originales sin renombrarlos. Conclusiones,
  asistencia y metadatos de sincronización permanecen exactamente iguales.
- Cinco pruebas puras adicionales: entradas congeladas, determinismo, contexto
  explícito, prioridad sin leer evidencia y ejecución con APIs ambientales
  prohibidas. El módulo admite CommonJS para pruebas y global clásico en Pages.
- Los fixtures cargan el módulo real. El adaptador de goldens históricos solo
  reconstruye wrappers exactos conocidos; la equivalencia ejecutable anterior y
  las pruebas de carga/fallo cubren el código actual, sin depender de ese adaptador.

Resultados ejecutados en esta etapa:

- Pruebas específicas iniciales: 61/61; puras + caracterización: 13/13.
- Suite completa `node --test tests/*.test.cjs`: **2615 aprobadas, 0 fallidas,
  0 omitidas, 0 canceladas**.
- Edge real aislado: cuatro escenarios Primaria/Secundaria a 1366/390 px,
  conexión, pausa offline, actualización remota, cambios concurrentes y revisión
  cancelada; cero subidas automáticas.
- Edge real: doce fallos de dependencia (seis módulos × dos anchos), conservando
  notas/matriz ficticias y pausando edición sin escrituras académicas.
- Red bloqueada hacia producción en estos escenarios. Ningún dato real leído,
  alterado o eliminado; tampoco los registros prioritarios de III/II de 2026.

## Tamaño, archivos y límites

`registro.html`: **3910 → 3892 líneas**, reducción neta de 18.
Diff del HTML: 28 líneas retiradas y 10 añadidas. Nuevo módulo: 30 líneas.
Incluyendo la línea de precache, el código de producción crece **13 líneas
netas**: esta separación reduce el HTML y su acoplamiento, no el total global.
Las pruebas y documentación incrementan el tamaño total; no se cuentan como
código eliminado. No se conservó una segunda implementación de producción.

Producción: `registro.html`, `registro-grading.js`, `registro-recovery-ui.js`,
`sw.js`. Pruebas: caracterización, pureza, equivalencia matemática, carga,
fixture histórico, integración transversal, precache, transversales y los tres
fixtures de navegador afectados. Este documento completa el inventario.

Persistencia, esquemas, nube A1/B1/CAS, Apps Script, matrices, Admin, reglas de
conclusiones y lectores históricos independientes no cambiaron. No existe CI
remoto nuevo porque están prohibidos push y PR en esta etapa.

## Riesgos, reversión y siguientes candidatos

La dependencia nueva debe distribuirse junto con HTML y precache cuando se
autorice publicar. Un fallo carga cierra edición deliberadamente; no destruye
notas. La equivalencia preserva incluso casos históricos anómalos, sin afirmar
que sean reglas nuevas deseables. Las pruebas ficticias no validan datos reales.

Revertir únicamente el commit de extracción restaura los tres lectores inline,
guards y precache anteriores; el commit previo de caracterización puede
conservarse. No requiere migración ni restauración de datos. No se ejecutó reversión.

Dependencias pendientes: lectura global de contexto/store, resolución de alias,
estado trabajado y consumidores de interfaz. No retirar wrappers mientras sus
consumidores sigan existiendo. Candidatos futuros, sin implementar: separar
adaptadores de lectura/contexto; caracterizar selección de sesiones/capacidades
de UI; estudiar lectores históricos por contrato individual. No unificar con
matrices/Admin ni abordar bloqueos de sincronización como parte de esta limpieza.

Etapa 3A terminada; se detiene aquí para revisión. Sin push, PR, merge ni deploy.
