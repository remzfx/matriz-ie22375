# Asistencia de ingreso: versiones, conflictos y publicación segura

Este cambio corresponde exclusivamente a `AsistenciaIngreso`/Auxiliar. No modifica la asistencia académica de Registro, identidades, marcas P/F/T/J, horarios ni permisos por nivel. Base: main posterior al PR #73 (`d3fee52033c2c0b7244d00d52e9a5ae0799ed30f`). No se ejecutaron despliegues, escrituras en Sheets reales ni pruebas con datos personales.

## Causa y contrato

`saveasis` buscaba y escribía sin una sección crítica, no comparaba la versión leída y escribía once celdas separadas. Una petición atrasada podía reemplazar una marca nueva y dos altas podían crear duplicados. `it.ts || Date.now()` convertía registros sin timestamp en modificaciones aparentemente nuevas.

Ahora búsqueda, revalidación de sesión/alcance, comparación y escritura ocurren bajo `ScriptLock` (espera máxima 30 s). Una fila se escribe mediante un solo `setValues`; se ejecuta `SpreadsheetApp.flush()` antes de responder/liberar el lock. No es una transacción de todo el lote.

- `loadasis` conserva su contrato y añade `protocoloAsistencia:1` y `items[].version`.
- La versión opaca `asis1:...` es una firma HMAC del contenido normalizado de las doce columnas. Usa el secreto existente; no modifica tokens ni autenticación. La columna 12 `revisionServidor` se crea únicamente con la primera escritura aceptada. Las once columnas anteriores conservan su posición.
- Los registros históricos obtienen una versión calculada al leer, sin escritura ni migración masiva. Cambios externos en contenido también cambian la versión. Rotar el secreto cambia estas versiones: exige nueva consulta antes de modificar.
- Una actualización diferente requiere `versionBase` exactamente igual a la versión vigente. Un alta requiere versión base vacía. Una versión obsoleta devuelve conflicto aunque el reloj del cliente indique un tiempo mayor.
- El reenvío del mismo contenido (marca, hora, vía y motivo) es `repetida`: no modifica timestamp ni versión. El timestamp, por sí solo, no constituye una edición.
- Para modificar una fila, el timestamp debe ser entero positivo válido, superior al anterior cuando este es válido y no mayor que la hora del servidor + 5 minutos. Ausente/inválido o igual con contenido distinto se rechaza. Un alta legacy sin timestamp conserva `0`; nunca se inventa la hora actual. Un timestamp histórico excesivamente futuro no bloquea para siempre una reparación con CAS y reloj válido.
- Duplicados en el lote rechazan todo antes de escribir. Duplicados históricos generan conflicto por clave; no se eliminan ni reparan automáticamente.
- Un lote con cualquier nivel no autorizado se rechaza completo, sin escribir ni devolver datos de otros niveles. Se conserva la revocación por configuración; se revalida dentro del lock.

## Lotes y frontend local-first

La respuesta incluye `guardados`, `repetidos`, `conflictos` y `resultados[]` con clave, estado (`aceptada`, `repetida`, `conflicto`), versión y motivo del conflicto. Si hay conflictos, `ok:false`/`code:CONFLICT` no anula las otras marcas aceptadas. El frontend procesa únicamente recibos versionados correspondientes a claves enviadas; no muestra un éxito total ante resultados parciales o ausentes.

La información adicional local es `versionServidor`, `firmaConfirmada` y, cuando existe conflicto, `remoto`. Se mantienen las claves y campos anteriores. Una edición durante fetch permanece pendiente; una respuesta atrasada no retrocede la versión confirmada. Una descarga conserva las marcas locales pendientes, guarda la versión remota para revisión y no convierte el conflicto en sobrescritura.

Para resolver, bajar asistencia, revisar y volver a subir manualmente. Si hay discrepancias consultadas, la confirmación explícita permite conservar las marcas locales como una **nueva decisión manual**, actualizar su timestamp y usar la versión remota consultada. No altera marca, hora, vía ni motivo. Si otro dispositivo cambió la nube entretanto, CAS vuelve a rechazar. Cancelar conserva los datos. No hay reintentos automáticos de escritura.

Antes de la primera subida, o tras 30 segundos de una comprobación satisfactoria, se consulta `asisprotocol` mediante POST autenticado, sin leer ni devolver filas de `AsistenciaIngreso`. Las verificaciones simultáneas de escaneo comparten la misma solicitud en curso; los errores no se cachean. Con backend anterior se bloquea la escritura y se conserva la marca local. La sesión se revalida de nuevo en cada `saveasis` del servidor, incluso mientras la comprobación está en caché. La subida masiva envía solo marcas pendientes; si todas están confirmadas no realiza POST de escritura. Cada conflicto remoto pendiente muestra **estudiante, fecha, aula, marca local y marca remota** en un diálogo de confirmación individual; cancelar excluye esa marca del lote y no modifica su borrador local. Una marca en conflicto escaneada mediante QR no se sobrescribe automáticamente: debe revisarse desde Subir asistencia. Una respuesta antigua o no verificable no confirma recepción. Un rechazo explícito `SESSION` retira autorización, sin borrar asistencia local. La asistencia automática no obtiene una excepción para sobrescribir registros existentes.

## Publicación propuesta — requiere autorización

1. Antes de cualquier despliegue autorizado, conservar respaldos privados de Sheets y marcas locales pendientes mediante el procedimiento institucional; no publicar ni adjuntar datos personales al PR. Ejecutar CI y probar el contrato en un Spreadsheet de ensayo aislado con datos sintéticos.
2. Publicar **primero el backend completo** `apps-script/Codigo.js` mediante el workflow institucional y actualizar la implementación existente, conservando URL. No publicar Pages primero ni editar hojas manualmente como parte de este cambio.
3. Con sesión autorizada, comprobar en producción el endpoint ligero `asisprotocol` (autenticación y `protocoloAsistencia:1`, sin cargar historial), seguido de una lectura `loadasis` restringida por fecha/nivel para verificar versiones y alcance. Una respuesta offline no valida el deployment. No realizar escrituras de prueba en producción sin autorización independiente. No hacer escrituras reales como prueba sin autorización independiente.
4. Publicar después el frontend `auxiliar.html`. Service Worker y su estrategia no cambian. Verificar online que se obtiene el HTML nuevo; un navegador offline puede seguir teniendo cliente anterior y debe conectarse para actualizarlo. El cliente anterior puede crear filas nuevas o repetir contenido; no puede modificar una fila existente sin versión.
5. En el entorno aislado, validar dos dispositivos: alta concurrente, modificación con versión obsoleta, reenvío y lote parcial. Comprobar avisos y conservación de borradores, horarios, QR y permisos de Primaria/Secundaria. Luego realizar la prueba institucional autorizada antes de habilitar uso general.

## Reversión y recuperación

**No revertir el backend al escritor antiguo sin CAS**: reintroduciría la pérdida de marcas. Mantener el backend protegido y, si es necesario, revertir solo frontend; el cliente anterior tendrá actualizaciones rechazadas hasta volver al cliente compatible. Ante incidente, suspender las subidas mediante el procedimiento institucional y conservar lectura/local-first mientras se investiga.

No borrar la columna 12, filas, claves locales ni pendientes; no restaurar indiscriminadamente una copia de Sheets sobre datos posteriores. Comparar respaldos de forma privada y recuperar únicamente las claves revisadas y autorizadas. Un fallo de red/flush puede dejar algunas filas persistidas sin recibo: conservar pendientes, consultar y reenviar **manualmente**; el mismo contenido será reconocido como repetido. Una eliminación local no se propaga: tombstones quedan para otro PR.

## Pruebas y límites

Los tests usan exclusivamente estudiantes sintéticos. Simulan lectura/escritura de rangos, intercalaciones en búsqueda y escritura, exclusión mediante lock, relojes inválidos, revocación durante la espera, recibos parciales y carreras de subida/bajada. Cubren integración cliente/backend y segundo dispositivo. La simulación no ejecuta el planificador real de Apps Script, sus cuotas, latencia, fallo físico de Sheets ni tipificación automática de celdas: la prueba aislada posterior sigue siendo necesaria.

El lock serializa las subidas y la búsqueda recorre el historial de ingreso: medir latencia con volumen institucional antes de optimizar en otro PR. Ediciones directas de Sheets u otros escritores que no utilicen el mismo lock no ofrecen exclusión mutua; el fingerprint detecta cambios ya visibles, pero no garantiza atomicidad frente a esos escritores. Un lote no es transaccional frente a errores físicos, y la resolución requiere revisión humana del conflicto.
