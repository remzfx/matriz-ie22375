# Registro: diagnóstico y corrección del flujo de carga

Revisión de main `1681dc8b96bd4edb81bf26568d76a9a7bda33d7a`, antes de editar. El diagnóstico original se conserva como antecedente del PR #52. La continuación revisa el ajuste local-first del mismo PR en `fix/registro-roster-resilience`; no abre otra rama ni modifica producción.

## Hallazgos y límites de evidencia

- `students.js` enviaba POST `loadstudents` correctamente, pero sin timeout, reintento ni deduplicación. La primera consulta de periodos podía bloquear la entrada sin tiempo límite. Un cuerpo HTTP pendiente también podía dejar el login esperando después de recibir cabeceras.
- `bloquearRegistroMientrasValida` asignaba `main.inert=true`. El camino de caché/offline no lo retiraba; por eso el supuesto modo solo lectura bloqueaba pestañas y consulta. `onContexto` también rechazaba navegación durante la carga.
- El backend de main reconoce POST `loadstudents`. El último workflow de Apps Script exitoso visible al revisar el repositorio apuntaba a `c60923dd97c4419e761d84234b4613ad4b9538c3`; su Codigo.js era idéntico al de main. Esto descarta que ese commit careciera de la acción, pero no prueba qué versión/manual deployment está atendiendo cada petición real.
- GET `loadstudents` terminaba en el mensaje genérico “Acción no válida”. Las URL configuradas de login, estudiantes y Registro coincidían. No se encontró una llamada GET de estudiantes en esos consumidores actuales. Queda como hipótesis una versión/bundle distinto o solicitud dirigida por otro método; no se atribuye sin evidencia el incidente real a un deployment antiguo.
- Registro conservaba su copia de caché al capturar cualquier error, incluso si el cliente la retiraba ante una denegación. Además, el estado `padronVerificadoServidor` no protegía todos los puntos de escritura; `inert` tampoco cubría Nube Subir/Guardar, situados fuera de main.
- Solicitudes superpuestas podían alterar mensajes/caché y dejar el estado de carga desactualizado. Consultar otro scope también borraba innecesariamente la caché válida del scope anterior.

## Flujo anterior

Login POST con timeout de cabeceras y dos intentos → sesión/token → bimestres locales o consulta sin límite → caché del bimestre → bloqueo completo de main → POST de alumnos sin límite → desbloqueo solo si la respuesta era online. Caché/error terminaban en alerts y bloqueo, sin un mecanismo de recuperación claro.

## Flujo definitivo local-first

Login → token firmado vigente → caché autorizada del token exacto y bimestre → padrón inmediato y trabajo local → POST `loadstudents` en segundo plano → verificación actual habilita Nube Subir. Una caída, timeout o backend incompatible conserva el trabajo local si la autorización cacheada sigue vigente. Sin caché válida, la edición queda bloqueada y aparece Reintentar; la navegación permanece disponible.

- `students.js`: fetch y cuerpo tienen un límite de 12 segundos por intento, con dos intentos de lectura separados por 1,2 segundos. No reintenta escrituras. `readOnce` comparte verificaciones del mismo token/bimestre. La caché en sessionStorage/localStorage dura como máximo 24 horas y nunca supera `exp` del token firmado (los tokens actuales duran 12 horas). Se conserva separadamente cada bimestre. Una respuesta para otro bimestre no se acepta ni se cachea.
- `clear` invalida también las peticiones que comenzaron antes de retirar la autorización: una respuesta tardía no puede restaurarla. El evento storage propaga la retirada entre pestañas. Una petición de un token anterior tampoco entrega ni cachea resultados para una sesión nueva.
- `registroSoloLectura`: permite edición únicamente con padrón autorizado vigente del mismo token/bimestre. No exige conexión para calificación, conclusiones, sesiones/capacidades, asistencia y Guardar local. `registroNubeNoVerificada` exige además la verificación actual; Nube Subir usa este guard directamente, además del estado de su botón.
- `cargarPadronRegistro` conserva `solicitudPadron` para descartar resultados de otro bimestre. No reinicia una sesión de calificación al verificar de nuevo el mismo contexto. `pintarPadronInmediato` recoge el trabajo local antes de reemplazar el padrón, conserva sesión, capacidades y borrador de conclusión, y vuelve a pintar la lista usando los datos nuevos. `llenarAulasPadron` evita el reinicio intermedio de contexto; cambiar de bimestre guarda el contexto anterior incluso con una verificación pendiente.
- `guardarTodo` conserva la nota recién recolectada frente a copias anteriores de `notas`. Si falla el almacenamiento, devuelve false y muestra un estado de error; no anuncia un guardado exitoso. Un refresco tardío no reconstruye y descarta el formulario si no pudo conservarlo. Libera almacenamiento y usa Reintentar sin cerrar la pestaña.
- `sincronizarEdicionRegistro` nunca bloquea main con inert. Navegación por área, grado, sección y Calificar/Promedios/Resumen/Asistencia sigue disponible. No fuerza readOnly=false en controles que tienen restricciones académicas propias. `vigilarCachePadron` continúa también después de verificar, retirando alumnos y edición si vence la caché o cambia/vence el token; los guards comprueban la vigencia en cada operación.
- `retirarVerificacionNube`: una subida sin confirmación bloquea siguientes subidas hasta verificar de nuevo. Un rechazo explícito de sesión/autorización (incluidos HTTP 401/403) retira también la autorización local y los alumnos visibles. Conserva las notas locales históricas. No reintenta ni repite una escritura automáticamente: una pérdida de respuesta puede ocurrir después de que el servidor haya guardado.
- `index.html` conserva la corrección original del timeout del cuerpo dentro del presupuesto de login. `apps-script/Codigo.js` conserva el rechazo GET `METHOD_NOT_ALLOWED` y la lectura POST existente. La continuación local-first inicial no modificó ninguno de esos dos archivos ni permisos del backend.

Cada carga termina en servidor verificado, modo local con autorización vigente o error recuperable con Reintentar. Una incompatibilidad como “Acción no válida” nunca cuenta como verificación ni habilita la nube. Una respuesta válida posterior reemplaza la caché sin recargar.

## Seguridad y validación

No cambia HMAC, expiración, revocación por permisosVersion, roles, filtros server-side, padrones congelados, datos ni escrituras del backend. No hay fallback a listas públicas o tokens sin verificación. Una escritura siempre vuelve a pasar los controles del backend.

Pruebas con reloj y respuestas simuladas: servidor rápido/lento, timeout del cuerpo, reintento exitoso, caché + caída, navegación de área/pestañas y trabajo local, recuperación posterior, denegación/revocación, cambio de token, caché vencida, deduplicación y respuesta atrasada de otro bimestre. La ruta POST y el rechazo explícito de GET se ejecutan contra el backend simulado. La suite previa y sintaxis HTML siguen ejecutándose. Se ajustan stubs de pruebas para las dependencias actuales del flujo y la instrumentación de login existente en main.

Antes de desplegar, contrastar en la pestaña Network del navegador el método, action y URL /exec del incidente real con la implementación vigente de Apps Script. No copiar tokens ni contraseñas a logs, PRs o capturas compartidas. Una discrepancia de deployment requiere actualizar la implementación correcta; el cliente no intenta eludirla con GET ni concede escritura al backend usando solo la caché.

Estas pruebas no equivalen a validación de producción. El nuevo mensaje de GET requiere desplegar el backend; el flujo frontal usa la ruta POST que ya existe en el backend anterior.


## Validación de la continuación y riesgos

Suite completa tras la corrección de asistencia: `node --test tests/*.test.cjs` — **365 aprobadas, 0 fallos**, sin pruebas omitidas/canceladas. Sintaxis verificada de los scripts inline de Registro/index y de students.js/Codigo.js; la suite también comprueba la sintaxis de todos los HTML. Se corrigieron los fixtures/aserciones que todavía suponían caché de diez minutos o exigían servidor para Guardar local.

Regresiones añadidas: almacenamiento persistente con nueva sesión de página, límite de 24 h y expiración firmada, petición pendiente invalidada tras rechazo y retirada entre pestañas, respuesta con bimestre incorrecto, doble carga, token cambiado/vencido, asistencia y guardado durante carga, cambio de bimestre pendiente, conservación de sesión/notas/conclusión ante respuesta tardía, restricciones readonly académicas, subida bloqueada sin verificación, denegación en subida, ausencia de reintentos de escritura y almacenamiento lleno.

Riesgos mínimos del modelo: sin conexión no se puede conocer una revocación nueva hasta recibir el rechazo del backend; por eso la autorización local está limitada por el token firmado y nunca permite subir sin verificación. La caché contiene datos privados autorizados en este navegador: borrar sus datos, cerrar una pestaña con almacenamiento fallido o perder el dispositivo puede perder trabajo no sincronizado. El error de almacenamiento se informa y el refresco conserva el formulario; no sustituye una copia sincronizada. Los cambios de nombre sin ID/código estable siguen sujetos a la compatibilidad por nombre existente. Estas simulaciones no equivalen a validación en producción.

## Continuación: asistencia y fechas sincronizadas

`asisSet` conserva marca/hora y añade `ts` al cambiar una marca. Limpiar una marca conserva una versión retirada (`borrado:true`) para que una descarga antigua no la restaure. `mergeRegistroPayload` aplica más reciente gana también a asistencia; los valores antiguos tipo string o `{marca,hora}` siguen siendo válidos, con versión 0. En empate se conserva el valor local; no se inventa antigüedad usando el timestamp global del payload.

`sliceRegistroArea` incluye `asisFechas` únicamente para nivel/bimestre/grado/sección actuales, y delimita exactamente el prefijo de las marcas. Las listas de fechas existentes siguen siendo arrays. Se unen fechas independientes y se añade `asisFechasEstado` (`ctx||fecha` → `{ts,borrado}`), sin reemplazar los arrays ni borrar datos antiguos, para preservar eliminaciones y reaperturas explícitas ante descargas atrasadas. Si un payload antiguo carece de fechas, se recuperan a partir de sus marcas vigentes. Nube Bajar actualiza la vista de asistencia activa.

La única modificación adicional en Codigo.js permite esos dos mapas en `payloadRegistroLectura_`, aplicando el mismo contexto de aula/bimestre autorizado que ya se aplica a asistencia. Para docentes, `asisFechas` requiere una clave de aula exacta; las fechas/versiones de otras aulas o bimestres se filtran. No cambia ningún permiso, token ni control de escritura. El backend deberá incluir este cambio cuando se autorice su despliegue; una implementación anterior elimina esos campos para docentes (las marcas permiten recuperar las fechas con asistencia, pero no las fechas sin marcas).

Se añadieron 10 pruebas: marcas locales nuevas frente a nube antigua, nube nueva frente a local antigua, formatos antiguos sin timestamp, empates, limpieza versionada, fechas por contexto, ida/vuelta entre dispositivos por consumidores reales, eliminación/reapertura de fechas y restauración por POST savereg/loadreg contra el backend protegido simulado. La prueba existente de filtrado también comprueba que no salen fechas ni versiones de aulas/bimestres ajenos.

El orden por timestamp comparte la dependencia de relojes de dispositivo que ya tienen notas/finales/conclusiones; se asegura avance monotónico por registro local, sin afirmar que se pueda reconstruir el orden real de dos registros antiguos sin timestamp. No se reintentan escrituras, no hay merge ni despliegue.
