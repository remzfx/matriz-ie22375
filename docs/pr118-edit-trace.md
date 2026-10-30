# PR #118 — diagnóstico temporal de bloqueo sin navegación

Base: `a226ab74a36f69c305472a455f6ad3dd7067b275`.
Instrumentación optativa; no es otra corrección de autorización ni certifica
resuelto el incidente real. No se ejecutó sobre perfiles o datos institucionales.

## Activación controlada y exportación

La API `IERegistroEditTrace` está desactivada al cargar la página. No consulta
parámetros URL, localStorage, sessionStorage o IndexedDB para activarse. En una
sesión de captura expresamente autorizada sobre una versión revisada:

```js
IERegistroEditTrace.start();
IERegistroNotas2UI.canEdit(); // Observación inicial; no fuerza una verificación.
```

Mantener el contexto/panel y trabajar normalmente. No ejecutar Guardar, Subir,
revalidaciones forzadas o recuperaciones para provocar el incidente.
Después del bloqueo espontáneo:

```js
IERegistroEditTrace.stop();
IERegistroEditTrace.export(); // Devuelve JSON para copiar/guardar explícitamente.
```

En DevTools con helper `copy`, puede usarse
`copy(IERegistroEditTrace.export())`; no es una función añadida a la aplicación.
La instrumentación no descarga archivos, escribe en disco ni envía el JSON.
`capture()` devuelve una copia del objeto; `clear()` detiene y elimina solo el
búfer diagnóstico en memoria. No toca datos académicos. Recargar pierde la captura;
volver a `start()` comienza otra. No se correlacionan respuestas de capturas distintas.

## Formato

Contenedor: `{schema:1, active, capacity:300, dropped, events:[...]}`.
Cada evento contiene exclusivamente:

- `atMs`: tiempo relativo desde start; sin fecha/hora absoluta.
- `context`: identificador opaco c1, c2... de un binding observado; sin hash,
  token, usuario, aula o nombres. No es comparable entre capturas.
- `event`: gate, edit-blocked, connection, context, lease-expired,
  academicstate-start/end, verification-rejected o page-hidden/page-visible.
- `layer`: connection/ui y `panel` limitado a los paneles conocidos.
- `state`, `validUntilMs` relativo al mismo inicio y `expired`.
- `authorized`, `allowed`: booleanos observados, o null si el cortocircuito
  original no ejecutó ese predicado. No se hacen lecturas extra para completarlos.
- `clientState`, `clientReadonly`, `clientBusy`: estado observado por el guard
  de UI; null cuando no corresponde. No se incluyen versiones ni payloads.
- `canEdit`, `reason` y, para verificaciones, identificador numérico
  `verification` y `outcome` limitado a categorías seguras.

Los cambios true→false se marcan `edit-blocked`. Las causas distinguen expiración,
permisos, readonly, conflicto, cambio de contexto, estado/ocupación/legacy del
cliente, servidor/offline y ausencia de concesión. Un fallo de periodos queda
como `verification-rejected / period-verification`, para no atribuirlo falsamente
a academicstate si esa petición sí terminó bien.

No se exportan bindings, tokens, usuarios, nombres, notas, conclusiones,
identificadores de estudiantes, mensajes de error, respuestas ni contenido de
almacenamientos. Los valores son listas permitidas, booleanos o números. Un
getter inesperado no rompe el guard. Los contextos se asocian mediante referencias
opacas y WeakMap, sin guardar bindings como claves del diagnóstico.

## Límites y neutralidad

El búfer retiene los últimos 300 eventos y cuenta los descartados. Observaciones
idénticas de un guard se deduplican. Si `dropped>0`, puede faltar el inicio de una
verificación: no debe confundirse con una respuesta perdida. Tampoco se reconstruye
lo sucedido antes de activar ni se garantiza observar una transición si el
navegador no ejecuta el código durante una suspensión.

No hay polling, temporizadores diagnósticos, cambios de plazos ni callbacks de
autorización adicionales. Los predicados mantienen su orden, cortocircuito y
resultado. Se añaden observaciones a los guards existentes y al inicio/final
de verifyPermission; el controlador inline se mantiene idéntico al módulo.
No se modifican competencias, presentación, guardado, motor N2, CAS, backend,
padrones o borradores. La activación no otorga ningún permiso.

## Reproducción y verificación diferencial

Las fixtures existentes se reutilizan sin ejecutar sus suites. La nueva captura
sintética reproduce en el mismo contexto: renovación normal editable; fallo de
academicstate seguido por server y bloqueo; validación de periodos fallida tras
academicstate correcto; vencimiento real; rechazo de permisos; readonly;
conflicto/estado del cliente; cambio de contexto y respuesta de una captura antigua.
Solo se instrumenta y atribuye: no se cambia la política de esos bloqueos.

Se compara activado/desactivado y, en el guard del controlador, contra el SHA
base: decisiones, orden/número de predicados, valores pendientes, controles,
solicitudes y vencimientos iguales. Se comprueban búfer acotado, exportación
aislada, ausencia de persistencia/envíos y exclusión de datos privados. La
normalización histórica reconoce únicamente los deltas literales instrumentados;
no acepta mutaciones de permisos.

Once pruebas nuevas del diagnóstico; no se reejecutan localmente las 3279
regresiones aprobadas de los otros componentes. Sintaxis/dependencias y diff
se comprueban; la suite completa corresponde exclusivamente al CI automático.

La incidencia de producción permanece abierta hasta disponer de una captura
real autorizada. No se atribuye su causa al patrón ficticio. La captura se revisará
antes de proponer otro cambio. PR #118 DRAFT, sin merge ni deploy.
