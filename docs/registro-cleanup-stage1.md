# Limpieza inicial de Registro — entrega local

Base: `main` / `7c5d003ddee37fddc71f1e6443e276c9d58252bf`.
Rama: `refactor/aip-limpieza-arquitectura`. Sin publicación, merge ni despliegue.

## Código eliminado y fuente única

Antes de retirar cada bloque se comprobó que su contenido era idéntico al archivo externo, normalizando únicamente finales de línea y espacios exteriores.

| Implementación duplicada en registro.html | Líneas del bloque anterior | Sustitución |
| --- | ---: | --- |
| Persistencia por cuenta (`registro-local-store.js`) | 20 | 1 etiqueta externa |
| Controlador de conexión (`registro-connection.js`) | 43 | 1 etiqueta externa |
| Borradores y almacenamiento IndexedDB (`registro-drafts.js`) | 48 | 1 etiqueta externa |
| Adaptador de recuperación/UI (`registro-recovery-ui.js`) | 200 | 1 etiqueta externa |

`registro.html`: **4284 → 3977 líneas; 307 líneas menos** en la extracción original (contadas por saltos de línea). Tras añadir los guards del cierre de observaciones: 3993 líneas, 291 menos que la base.
En la extracción original (`7cd4110`), los cuatro archivos externos permanecieron idénticos a la base. El cierre de observaciones añade únicamente un guard temprano al adaptador de recuperación. No se eliminan sus APIs, funciones, listeners, esquemas ni compatibilidad histórica.

## Carga y dependencias

Se conservan scripts clásicos síncronos y rutas relativas, con la misma posición de ejecución:
persistencia por cuenta → controlador de conexión → núcleo de Registro → borradores → adaptador de recuperación.
Las dependencias académicas `defer` mantienen su orden y terminan antes de `DOMContentLoaded`.
No se incorporan importaciones circulares. El adaptador conserva dependencias globales del núcleo; no se presenta como un módulo independiente del mismo.

El precache incorpora los cuatro archivos ahora obligatorios. El cierre de observaciones cambia v21 a **v22**; se conservan la estrategia network-first, el plazo de siete días, los endpoints y la política sobre datos privados. No se ejecuta el Service Worker sobre perfiles reales.
Si falta el controlador de conexión, `registroSoloLectura()` ahora falla cerrado: la ausencia del módulo no equivale a autorización para editar desde caché.

## Pruebas y conservación

- Base comprobada: 2565 aprobadas, cero fallos.
- Extracción original: 2576 aprobadas; cierre de observaciones: **2587 aprobadas, cero fallos/canceladas/omitidas**. Se añaden cuatro fallos de dependencia, seis casos de actualización/instalación del SW y una regresión de modo estricto del adaptador.
- Comparación ejecutable de persistencia, separación de cuentas, conexión y diferencias de borradores contra las copias revisadas de main.
- Casos de datos ficticios de 2026: registros del III con notas, evidencias, sesiones, conclusiones, asistencia e historial; matrices del II, otros períodos/cuentas y almacenamiento anterior conservados byte a byte.
- Edge headless: Primaria y Secundaria, 1366 y 390 px; dependencias externas, pausa offline, reconexión, actualización remota simulada, entrada iniciada conservada, conflicto y cancelación; cero subidas automáticas.
- Red de navegador bloqueada salvo documentos y scripts de `fixture.invalid`; backend y almacenamiento exclusivamente ficticios.
- `node scripts/check-source.cjs` y `git diff --check` aprobados.

## Cierre de observaciones y propuesta de Etapa 2

Ante HTTP 404 de cualquiera de los cuatro scripts, el HTML muestra un error controlado y pausa los controles. Si falta persistencia o conexión, el núcleo se detiene antes de inicializar el almacenamiento; si falta borradores, el adaptador no arranca parcialmente; si falta el adaptador, no hay autorización de edición. No se modifica el comportamiento académico de la carga satisfactoria.

La actualización simulada usa el SW v21 de la base y sus cachés ficticias. Se comprueba instalación coherente de HTML y los cuatro scripts en v22, activación y limpieza de v21. El fallo de cualquiera de esos cinco recursos impide solicitar activación y conserva el cliente v21 disponible. Las políticas de caché son las existentes; no se promete una actualización atómica bajo despliegues parciales arbitrarios.

Prueba adicional en Edge: ocho casos HTTP 404 (cuatro dependencias × 1366/390 px), aviso visible, edición pausada, notas del III y matriz del II de 2026 ficticias idénticas, cero escrituras académicas y cero subidas. La excepción deliberada de arranque por falta de persistencia/conexión queda identificada; no se confunde con un error académico o de permisos.

Candidatos concretos para Etapa 2, **sin implementar**, en este orden:

1. Externalizar `registro-calificar-print.js`: permanece una copia inline idéntica comprobada. Mantener impresión, escape, encabezados y paginación, con pruebas de equivalencia y fallo de carga específico; actualizar precache si corresponde.
2. Delegar `numToLetter`, `letterToNum` y `promedioNums` del HTML al motor existente `registro-evaluation.js`, conservando wrappers globales. Primero probar equivalencia para valores límite, vacíos, inválidos, notas históricas y redondeo; no cambiar fórmulas.
3. Separar el cálculo de `notaDesdeSesiones`/`notaCompAlumno` de su lectura del estado global: pasar contexto, sesiones, lector de identidad y notas por un adaptador. Preservar prioridad de la nota directa y cálculos existentes. No extraer sincronización ni mover claves persistidas en este bloque.
4. Extraer progresivamente la UI de sesiones (`fillComps`, `fillCaps`, `onCompChange`, `onCapSel`, `activarSesion`), con dependencias explícitas del contexto y callbacks. Mantener CNEB, U0–U8, sesiones sin unidad, borrados y eventos globales compatibles.

No consolidar aún catálogos por mera similitud ni retirar aliases, almacenamiento legacy o respaldos. La separación no autoriza borrar calificaciones reales. Se conserva la prioridad indicada para registros del III de 2026 y matriz del II, además del resto de datos y configuración.

Las comparaciones históricas usan un adaptador de pruebas que resuelve estas cuatro dependencias, en lugar de exigir su implementación dentro del HTML. No se retiran las comprobaciones académicas, CAS, propietarios ni cierres. Las fixtures aisladas de padrón/histórico declaran explícitamente la conexión simulada; las pruebas integradas usan el controlador real.

## Archivos modificados

- Producción: `registro.html`, `sw.js` (solo dependencias del precache).
- Adaptación de comparaciones históricas: `tests/empty-collection-boundary.cjs`, `tests/phase2-boundary.cjs`, `tests/layout-shells.test.cjs`, `tests/promedios-final-pr77.test.cjs`, `tests/registro-recovery-ui.test.cjs`, `tests/registro-pr84.test.cjs`.
- Integración y fixtures: `tests/registro-connection.test.cjs`, `tests/registro-connection-browser.cjs`, `tests/registro-history.test.cjs`, `tests/registro-resilience.test.cjs`, `tests/registro-roster-identity.test.cjs`, `tests/service-worker-static.test.cjs`.
- Nuevos: `tests/registro-script-fixture.cjs`, `tests/registro-connection-fixture.cjs`, `tests/registro-script-loading.test.cjs` y este documento.

## Dependencias conservadas y riesgos pendientes

- Se conservan almacenamiento sin propietario, aliases, claves históricas y recuperación de borradores: tienen consumidores y protegen antecedentes.
- El núcleo académico permanece inline; su separación requiere otro bloque revisado, no una extracción masiva.
- La copia del constructor de impresión `registro-calificar-print.js` queda para una extracción posterior, con sus pruebas específicas. No se elimina otra función por su apariencia de desuso.
- Los problemas diagnosticados de checking persistente y del rótulo de cierre administrativo no se corrigen en esta extracción. No se cambia la decisión de cierres ni se añade autorización offline.
- Notas 2.0 no se implementa ni migra aquí. La preservación sintética y los contratos actuales son una base de compatibilidad, no una validación sobre datos reales.
- La publicación futura debe incluir juntos HTML, dependencias y precache; revisar esa transición antes de autorizarla. CI remoto pendiente porque esta rama no se publica.

Reversión: revertir el commit de extracción restaura las copias y el precache anterior, sin migrar almacenamiento ni modificar datos. El commit de adaptación de pruebas puede revertirse por separado.
