# Competencias transversales de Secundaria

Admin configura `tutorAulas` dentro de la configuración vigente `DOCENTE_ACCESOS`. Solo puede existir un tutor activo por aula. Guardar docentes incrementa `permisosVersion` y revoca las sesiones docentes anteriores; deberán ingresar nuevamente. La firma y duración de 12 horas no cambian.

Registro permite aportar ambas competencias desde cada área curricular autorizada, usando letras o números de 0 a 20. Conserva el valor original y su equivalencia: 18–20 AD, 14–17 A, 11–13 B, 0–10 C. La antigua área Competencias Transversales deja de ofrecerse en nuevas asignaciones de Secundaria; sus datos anteriores se conservan sin migración. Primaria mantiene su modelo vigente.

El módulo `transversales.html` permite al tutor consultar únicamente sus aulas y a PIP/AIP coordinar Secundaria. Admin consulta todo sin sustituir las confirmaciones. Los docentes que no son tutores solo reciben sus propios aportes del área/aula consultada en Registro. Las lecturas entregan un padrón mínimo del aula y bimestre; PIP no obtiene acceso a `loadstudents`.

La sugerencia cuenta una valoración por área y propone únicamente un nivel modal sin empate. Empates, diferencias de dos niveles y áreas faltantes generan una alerta informativa. El tutor o AIP introduce explícitamente la decisión final. Debe justificarla si difiere de la sugerencia, no existe sugerencia o hay alerta. Ninguna sugerencia se transforma automáticamente en nota oficial.

Cada competencia requiere confirmación independiente de Tutor y AIP sobre la decisión vigente. Cambiar la decisión o su justificación retira ambas confirmaciones. Cambiar cualquier aporte, permisos o versión de padrón vuelve obsoleta la decisión anterior y exige revisarla, guardarla y confirmarla nuevamente. Los bimestres cerrados/bloqueados son consultables, sin escrituras.

## Almacenamiento y transporte

Las hojas privadas `TransversalesAportes` y `TransversalesConsolidado` se crean al primer guardado y conservan versiones por append. No se reescribe `RegistroNotas` ni se transforman notas históricas. Los aportes están separados por bimestre, aula, área y usuario. El consolidado conserva equivalencia, valor original, justificación, autor, fecha, resumen pedagógico y ambas confirmaciones. No guarda tokens ni contraseñas.

Las escrituras se serializan con ScriptLock y comprueban versión esperada. Una edición concurrente devuelve `CONFLICT` para recargar y revisar; no se reintenta una escritura automáticamente. Las lecturas se deduplican por token y contexto en memoria.

El bridge específico `transversales-v1` utiliza HtmlService + google.script.run y comparte las validaciones de origen, ventana y nonce del bridge vigente. Su RPC acepta únicamente las siete acciones del módulo. El token viaja por postMessage/cuerpo POST y nunca por URL. Si no se establece el bridge se usa el POST existente; cuando está listo no se duplica la petición. Las respuestas se descartan si cambia el token. El Service Worker v9 almacena solo recursos estáticos; ningún aporte, padrón ni decisión entra en CacheStorage.

## SIAGIE y operación

En Admin, DESEN TIC y GEST AUTO utilizan únicamente finales con ambas confirmaciones y versión vigente. Se limpian las celdas transversales obsoletas de la plantilla exportada y se informa cada estudiante/competencia pendiente. Se comprueba de nuevo la versión antes de generar el archivo. Las hojas académicas mantienen su exportación existente.

El backend completo y compacto está en `apps-script/Codigo.js`. Este PR no ejecuta merge ni deploy. Después de revisión y autorización se necesitará actualizar Apps Script con ese archivo completo y una nueva versión de la implementación existente, manteniendo su URL. La validación local no sustituye la comprobación posterior en producción.
