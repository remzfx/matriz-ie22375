# PR #118 — Comparativo y regreso a aulas

Referencia: `6cb0d5f30e99a39a682cef9108f712ea8ebcc579`. Datos y transportes exclusivamente ficticios; sin solicitudes institucionales.

## Diagnóstico y corrección

El comparativo esperaba toda la cadena del bimestre I antes de iniciar II: padrón → verificación de generación → registro, dos veces. Un cliente N2 o una reserva de otro bimestre no equivale a una prueba histórica completa: puede carecer del padrón de ese periodo y de paneles. `IEStudents.loadRoster()` comparte peticiones simultáneas, pero no omite por sí solo una nueva lectura por existir `peekRoster()`.

La corrección consulta hasta dos bimestres independientes simultáneamente. IV usa un lote de dos y luego el tercero. Mantiene el mismo lector autenticado, sus timeouts, caché histórica, coalescencia y controles de actor, contexto, padrón, versiones y borradores. Captura la firma de cada prueba al recibirla; cambiar I mientras II sigue pendiente impide publicar un comparativo incoherente. No modifica fórmulas, permisos, CAS, motor N2, precarga 2B ni Apps Script.

Se conserva la reutilización de pruebas históricas completas dentro de su vigencia original. No se usa un padrón de la caché general de hasta 24 horas como prueba de vigencia actual, ni se prolonga su autorización. No hay precarga global de históricos.

## Navegación y autorización

El recorrido 3.º A → 4.º A → 5.º A → 3.º A ya reutiliza clientes/reservas y autorización suficiente. No se demostró una descarga académica redundante con autorización vigente. Las peticiones de estado de plantillas SIAGIE son distintas de la descarga de notas.

Después de 150 segundos, sin renovación válida, verificar acceso es obligatorio aunque las notas sigan visibles. No se cambia ese límite ni se considera un cliente existente como autorización. El componente ahora titula esa operación **«Verificando acceso…»**, no «sincronizando información». Conserva el mensaje de descarga y el de preparación del comparativo para sus operaciones reales, sin alterar el modal Guardar.

Un backend que no devuelva `contextAuthorization` conserva el fallback autenticado; su implementación efectiva no se certificó mediante consultas reales. Los 17 segundos observados en producción no se midieron contra datos reales: se reprodujo y corrigió la cadena secuencial, no se atribuye una latencia de servidor real a una simulación.

## Evidencia diferencial

- `tests/comparativo-latency.test.cjs`: reloj determinista sobre las funciones reales. Antes de corregir, las tres pruebas de mejora fallaron. Incluye I preparado, ambos preparados, reapertura sin consultas, 10 docentes independientes, integridad y cambio de padrón durante la otra lectura.
- `tests/comparativo-navigation-browser.cjs`: DOM, controlador, motor, estudiantes y transporte de generación reales; backend ficticio y red externa bloqueada. Mide cada `loadstudents`, `academicstate`, `loadreg`, cálculo y renderizado. Prueba 1366/390 px, 3/5/10 segundos, rutas con clientes y reservas, autorización vigente/vencida, revocación y borrador pendiente. Los 10 segundos por petición alcanzan el timeout histórico existente: se conserva el error y se retira el indicador, sin publicar datos parciales.
- Las 101 pruebas focalizadas pasan; suite completa: **3.259 aprobadas, cero fallidas/canceladas/omitidas**. Se conservan las regresiones de identidad, padrones diferentes, históricos cerrados, expiración, respuestas tardías, notas directas y campos en edición.
- Los goldens solo normalizan los deltas exactos nuevos. La prueba de respuesta tardía ahora resuelve ambas peticiones paralelas y conserva las comprobaciones de aislamiento; no se elimina cobertura de seguridad.

| Transporte ficticio por lectura | Antes (reloj determinista) | Después | Peticiones de padrón/registro |
|---|---:|---:|---:|
| 3 s | 12 s | 6 s | 4 → 4 |
| 5 s | 20 s | 10 s | 4 → 4 |
| 10 s, lector sin transporte HTTP | 40 s | 20 s | 4 → 4 |

El último renglón prueba orden/concurrencia en el lector; **no** promete que el transporte HTTP complete una petición que exceda sus timeouts. En Edge con 3/5 segundos por padrón/registro, el comparativo frío mide aproximadamente 12,2/20,2 segundos antes y 6,2/10,2 después. La verificación de generación sigue existiendo: el transporte actual coalesce las dos verificaciones simultáneas, pasando de dos `academicstate` a una (6 → 5 solicitudes totales). Las reaperturas válidas mantienen cero solicitudes.

En cuatro mediciones adicionales de cálculo/render (dos anchos, antes/después), la proyección midió 6,1–6,7 ms antes y 5,5–5,7 ms después; el render final, 79,7–82,0 ms antes y 79,6–81,3 ms después. Cada padrón y cada lectura histórica consumió aproximadamente los 3 segundos simulados; `academicstate` tuvo respuesta sintética inmediata (<1 ms). La mejora procede de solapar esperas, no de modificar cálculos.

Los **12 escenarios funcionales de navegador** pasan. Con autorización vigente, las visitas preparadas midieron 170–219 ms, cero `academicstate` y cero `loadnotas2`; solo estado de plantillas. Con autorización vencida: una `academicstate` necesaria y cero descargas de notas sobre clientes confirmados. Revocar la sesión bloquea edición, conserva cambios pendientes y no genera escrituras.

## Concurrencia y límites

Con 10 docentes y un servicio ficticio limitado a 10 peticiones activas, ambas variantes completan las mismas 40 lecturas en 12/20/40 segundos para las tres latencias; el pico activo queda en 10. La cola total sube de 10 a 20 por las dos lecturas independientes por docente. No hay mejora a saturación ni empeoramiento del total en ese modelo. Sin ese límite externo podría haber hasta 20 peticiones activas entre los 10 navegadores, más otras operaciones existentes. No se certifican cuotas ni capacidad real de Apps Script.

Resultados JSON y logs de fases, cálculo/render y concurrencia permanecen fuera del repositorio en el directorio local de evidencias. No se accede a notas reales. Riesgo residual: carga real del backend y disponibilidad de autorización de alcance en el despliegue efectivo; no se agregan mecanismos de sincronización por hipótesis.

Reversión: revertir este commit de forma ordinaria vuelve a las lecturas secuenciales y mensajes anteriores, sin alterar almacenamiento. El PR permanece DRAFT; merge y deploy requieren revisión y autorización.
