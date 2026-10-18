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

`registro.html`: **4284 → 3977 líneas; 307 líneas menos** (contadas por saltos de línea).
Los cuatro archivos externos permanecen idénticos a la base. No se eliminan sus APIs, funciones, listeners, esquemas ni compatibilidad histórica: se eliminan sus segundas implementaciones.

## Carga y dependencias

Se conservan scripts clásicos síncronos y rutas relativas, con la misma posición de ejecución:
persistencia por cuenta → controlador de conexión → núcleo de Registro → borradores → adaptador de recuperación.
Las dependencias académicas `defer` mantienen su orden y terminan antes de `DOMContentLoaded`.
No se incorporan importaciones circulares. El adaptador conserva dependencias globales del núcleo; no se presenta como un módulo independiente del mismo.

El precache incorpora los cuatro archivos ahora obligatorios. No cambian la versión v21, la estrategia network-first, el plazo de siete días, los endpoints ni la política sobre datos privados. No se ejecuta el Service Worker sobre perfiles reales.
Si falta el controlador de conexión, `registroSoloLectura()` ahora falla cerrado: la ausencia del módulo no equivale a autorización para editar desde caché.

## Pruebas y conservación

- Base comprobada: 2565 aprobadas, cero fallos.
- Entrega: 2576 aprobadas, cero fallos/canceladas/omitidas; diez regresiones nuevas de carga/comportamiento y una de precache.
- Comparación ejecutable de persistencia, separación de cuentas, conexión y diferencias de borradores contra las copias revisadas de main.
- Casos de datos ficticios de 2026: registros del III con notas, evidencias, sesiones, conclusiones, asistencia e historial; matrices del II, otros períodos/cuentas y almacenamiento anterior conservados byte a byte.
- Edge headless: Primaria y Secundaria, 1366 y 390 px; dependencias externas, pausa offline, reconexión, actualización remota simulada, entrada iniciada conservada, conflicto y cancelación; cero subidas automáticas.
- Red de navegador bloqueada salvo documentos y scripts de `fixture.invalid`; backend y almacenamiento exclusivamente ficticios.
- `node scripts/check-source.cjs` y `git diff --check` aprobados.

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
