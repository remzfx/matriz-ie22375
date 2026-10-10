# Gestión de estudiantes: diagnóstico y garantías

Base del PR: merge #67, 27c5f3694d5bba56fe3bb98cfaae6710fb1b179a. Corrección final revisada sobre ca8d94ecc6f314578853b581340f14a5e7bac09d. No se consultaron datos reales ni se desplegó código.

## Flujo y matrícula

Admin muestra caché autorizada del mismo token, con vigencia máxima de 24h limitada por expiración. Luego consulta loadstudents protegido. La lectura sin puente tiene hasta dos intentos de 12s y pausa de 1.2s, más preparación del puente. fetchJSON limita fetch y cuerpo; una respuesta offline no verifica producción. Actualizar consulta utiliza inspect protegido para solicitar una lectura nueva, sin considerar caché una verificación.

BASE_ACTUAL conserva todos los importados. El padrón seleccionado abierto contiene solo DEFINITIVA; TRASLADADO conserva IDs, códigos e historial en la base. Otros estados, incluido uno ausente, requieren revisión y bloquean sync/seed antes de escribir. Inicializar, guardar y restaurar la base siguen conservando todos los estados. No se filtran ni se migran automáticamente los padrones históricos.

Gestión muestra importados, vigentes, trasladados y otros estados dinámicamente. Comparación informativa por ID/código exactos, sin fuzzy matching ni segundo sincronizador. Cada CSV seleccionado mantiene su vista previa al consultar el servidor. Crear padrón requiere base inicializada, padrón ausente y bimestre abierto verificado. El backend conserva la autoridad.

Registro, matrices y Registro General consultan loadRoster por bimestre. Tutor consulta loadtransversales y el backend resuelve el padrón de ese contexto. Si todavía no hay padrón, permanece la compatibilidad BASE_ACTUAL con padronInicializado:false, sin creación automática.

## Publicación y recuperación

Causa anterior: syncstudents usaba una sola lista para base y padrón; después de separarlas publicaba dos punteros sucesivos. Una interrupción podía hacer visible solo uno.

Solución: bajo ScriptLock y control de versión, preparar ambas versiones inmutables completas sin publicar punteros individuales. Una sola fila ESTUDIANTES_COMMIT contiene schema:1, el ID de operación, la versión/partes de BASE_ACTUAL y la versión/partes del PADRON del bimestre. Esa fila completa es el punto de publicación.

El lector recorre cronológicamente los punteros antiguos y los marcadores válidos. Un marcador incompleto/ilegible no confirma nada. El índice de caché incluye el número de filas de Sheets y la reconstrucción incluye la versión: preparar datos o confirmar una operación no reutiliza índices anteriores. No hay una segunda fuente de verdad. Los punteros históricos siguen siendo legibles y los de otros bimestres no cambian.

Las dos respuestas llevan operacionConfirmada con el mismo ID, permitiendo comparar la pareja mediante lecturas protegidas. Las lecturas efectuadas a distintos instantes pueden observar operaciones diferentes si hay otra actualización concurrente; no son una transacción entre solicitudes.

Si se pierde la confirmación o su respuesta, se devuelve SYNC_UNCONFIRMED, nunca éxito. El marcador puede haber persistido: consultar base y padrón en servidor antes de volver a operar. Si no persistió, se leen las versiones anteriores; si persistió completo, las nuevas. No se reintentan escrituras automáticamente. Datos preparados sin marcador quedan como filas históricas no visibles; no se eliminan automáticamente.

El mismo protocolo protege enriquecimientos que afectan simultáneamente base y padrón. students.js mantiene cachés separadas por token/ámbito; CONFLICT, PERIOD_CLOSED y SYNC_UNCONFIRMED conservan la caché autorizada para consulta, sin considerarla confirmación actual. Rechazos de autorización siguen retirando la autorización.

## Borradores Admin

Causa: aplicarBaseServidor sustituía estado y bdPendiente al llegar una respuesta tardía.

Solución: cada consulta registra número de solicitud, revisión local y token. saveEstado incrementa la revisión. Una respuesta anterior se ignora; si hubo edición o hay cambios pendientes, no se sustituye el borrador ni su baseVersion original. Ante error de red también se conserva el borrador. Al guardar con una versión antigua, el backend devuelve conflicto y el borrador permanece.

El mensaje ofrece guardar, revisar o recargar. Recargar con cambios pendientes requiere confirmación explícita de descarte. Cambiar/cerrar sesión impide aplicar la respuesta anterior y deshabilita edición; el borrador no se elimina de memoria. Las cantidades dejan de presentarse como autorizadas. No se introdujo almacenamiento persistente adicional de borradores; abandonar/cerrar la pestaña sigue sujeto a la advertencia existente.

## Identificadores y periodos cerrados

enrichstudents valida periodo y ambas listas antes de escribir. Si existe un padrón cerrado/bloqueado, devuelve PERIOD_CLOSED sin modificar siquiera la base. Si no hay padrón, el enriquecimiento de base no crea uno, incluso en un periodo cerrado.

Prioridad de asociación: ID/código exactos existentes; como compatibilidad, nombre normalizado exacto y único dentro del aula. Nunca nombres parecidos. Duplicados de entrada, homónimos ambiguos, reutilización de ID/código y conflictos con identidad existente requieren revisión; no se sobrescriben IDs conflictivos. No hay excepción extraordinaria para historia cerrada.

subirPlantillaAula diferencia plantilla guardada de asociación rechazada. La respuesta conserva cantidades de IDs realmente asociados. No se modifican notas, claves académicas ni snapshots.

## Validación y límites

Pruebas sintéticas 265/257/8: base completa, padrón abierto filtrado, IDs conservados, historia y padrones cerrados intactos. Fallos simulados antes de escribir, tras preparar base, tras preparar padrón, marcador parcial, tras confirmar y tras flush. También: caché→edición→respuesta tardía, respuestas invertidas, error de red, conflicto al guardar, descarte explícito y cambio/cierre de sesión.

No se atribuye una demora productiva a cold start/Sheets/red sin telemetría. No se eliminaron filas preparadas sin confirmación. El flujo manual avanzado de combinar por nombre permanece fuera de esta corrección y requiere revisión cuidadosa.

Validación visual real pendiente: Browser Use no pudo conectar con la vista local. Validación manual futura: desplegar solo tras autorización, usar CSV SIAGIE vigentes revisados, comprobar conteos, IDs de operación y muestras históricas con lectura de servidor, probar interrupción y relogin. Nunca tomar offline/caché como validación productiva. SW v18 y lógica académica intactos. Sin merge, deploy ni cambios a datos reales.
