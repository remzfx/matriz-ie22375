# PR #118 — checking sin concesión y recuperación

Base diferencial: `4919300328b7c1b2a37fa0d1ba35ac3a117e738e`.
Reloj, cuenta, transporte y datos ficticios; Secundaria III, 3.º A, Matemática.
No se consultó la implementación institucional ni se modificaron sus datos.

## Causa reproducida

`arm()` difiere el heartbeat 120 segundos si la pestaña está oculta. La concesión
anterior sigue venciendo en su fecha real. `watchLease()` la retira correctamente
y emite checking con validUntil=0, pero no adelanta el intento ya diferido.
El handler de visibilitychange solo atendía la precarga, sin solicitar una
comprobación. Además, un check no forzado que aún encontraba concesión válida
devolvía true sin corregir ese temporizador diferido.

Esto reproduce exactamente la observación: authorized/allowed true, cliente
ready, clientReadonly/clientBusy/retentionFailed false, checking, validUntil=0,
canEdit=false y no-grant cuando se empieza a capturar después del vencimiento.
El controlador no había olvidado todo intento: esperaba un heartbeat muy posterior.

## Cronología con alcance compartido y latencia ficticia de 4 segundos

| Momento | Antes | Después |
|---|---|---|
| 4 s | Concesión vigente hasta 150 s | Igual |
| 110 s | Pestaña oculta | Igual |
| 120 s | Heartbeat diferido a 240 s | Igual |
| 150 s | watchLease → checking, until=0, edición pausada | Igual si sigue oculta |
| Regreso visible a 160 s | No comprueba | Programa comprobación a 160,03 s |
| 162 s | Sigue sin concesión | Sigue sin concesión; espera servidor |
| 164,03 s | Sigue sin concesión | Nueva respuesta válida; edición recuperada |
| 244 s | Por fin llega la respuesta del heartbeat diferido | Ya estaba recuperada |

Si se vuelve a 145 s, se renueva a 149,03 s, antes del vencimiento: no hay bloqueo.
Antes, aun regresando a 145 s se bloqueaba a 150 s hasta 244 s. Se mantienen dos
academicstate, una descarga académica inicial y cero escrituras en cada recorrido.
También se verifica el backend compatible sin contextAuthorization: su concesión
inicial vence a 154 s; vuelve a 164 s y recupera a 168,03 s frente a 248 s antes.
No se exige implementar la extensión compartida para corregir esta recuperación.

## Cambio mínimo

- `registro-connection.js`, `check()`: al reutilizar una concesión todavía válida,
  reprogramar con el margen existente de 30 segundos y el intervalo existente.
  No cambia until ni concede permisos; solo corrige cuándo comprobar de nuevo.
- Misma línea en el controlador inline de `registro.html`.
- `registro-notas2-ui.js`: al volver visible, llamar a refresh() existente. No
  fuerza una descarga académica ni evita las comprobaciones de permisos/periodos.
- El diagnóstico optativo añade page-hidden/page-visible, sin datos del aula,
  para contrastar esta secuencia con una captura real. Sigue desactivado por defecto.

La captura puntual recibida no prueba por sí sola que el equipo hubiera pasado
por una pestaña oculta. Esta es una causa demostrada del mismo estado, no una
atribución inventada de toda transición real. Las nuevas marcas permiten verificarlo.
No se ocultan controles ni se amplían plazos; sin respuesta válida no hay edición.

## Otras rutas, sin ampliar el alcance

- Un backend compatible sin alcance compartido sí concede y renueva permisos.
- Un resultado ya vencido se rechaza y programa el reintento a 15 segundos.
- Una respuesta descartada por epoch en el mismo contexto inicia una verificación
  nueva; no aplica la respuesta anterior. Se reproduce sin cambiar de aula.
- Los rechazos de academicstate y periodos procesados mantienen session/server
  y sus reglas existentes, no un éxito ficticio. Se reutilizan sus regresiones
  ya aprobadas; no se reejecutan suites de backend, CAS o guardado.

Ocho pruebas nuevas diferenciales aprobadas; 3290 resultados anteriores reutilizados
durante desarrollo. Se compara antes/después, conserva el JSON de notas/borradores,
comprueba cero escrituras, concesión aún cero mientras espera y controlador inline
idéntico. La normalización histórica admite solo los deltas literales autorizados.
Sintaxis/dependencias y diff correctos. Suite completa solo mediante CI automático.

No se modifican históricos persistentes, motor N2, API, Sheets, borradores ni CAS.
PR #118 DRAFT. Sin merge, deploy ni operaciones institucionales.
