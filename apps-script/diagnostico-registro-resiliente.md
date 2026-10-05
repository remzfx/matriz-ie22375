# Registro: diagnóstico y corrección del flujo de carga

Revisión de main `1681dc8b96bd4edb81bf26568d76a9a7bda33d7a`, antes de editar. Este trabajo se prepara en una rama separada; no modifica producción ni ejecuta despliegues.

## Hallazgos y límites de evidencia

- `students.js` enviaba POST `loadstudents` correctamente, pero sin timeout, reintento ni deduplicación. La primera consulta de periodos podía bloquear la entrada sin tiempo límite. Un cuerpo HTTP pendiente también podía dejar el login esperando después de recibir cabeceras.
- `bloquearRegistroMientrasValida` asignaba `main.inert=true`. El camino de caché/offline no lo retiraba; por eso el supuesto modo solo lectura bloqueaba pestañas y consulta. `onContexto` también rechazaba navegación durante la carga.
- El backend de main reconoce POST `loadstudents`. El último workflow de Apps Script exitoso visible al revisar el repositorio apuntaba a `c60923dd97c4419e761d84234b4613ad4b9538c3`; su Codigo.js era idéntico al de main. Esto descarta que ese commit careciera de la acción, pero no prueba qué versión/manual deployment está atendiendo cada petición real.
- GET `loadstudents` terminaba en el mensaje genérico “Acción no válida”. Las URL configuradas de login, estudiantes y Registro coincidían. No se encontró una llamada GET de estudiantes en esos consumidores actuales. Queda como hipótesis una versión/bundle distinto o solicitud dirigida por otro método; no se atribuye sin evidencia el incidente real a un deployment antiguo.
- Registro conservaba su copia de caché al capturar cualquier error, incluso si el cliente la retiraba ante una denegación. Además, el estado `padronVerificadoServidor` no protegía todos los puntos de escritura; `inert` tampoco cubría Nube Subir/Guardar, situados fuera de main.
- Solicitudes superpuestas podían alterar mensajes/caché y dejar el estado de carga desactualizado. Consultar otro scope también borraba innecesariamente la caché válida del scope anterior.

## Flujo anterior

Login POST con timeout de cabeceras y dos intentos → sesión/token → bimestres locales o consulta sin límite → caché del bimestre → bloqueo completo de main → POST de alumnos sin límite → desbloqueo solo si la respuesta era online. Caché/error terminaban en alerts y bloqueo, sin un mecanismo de recuperación claro.

## Flujo corregido y funciones

- `index.html`: `leerRespuestaLoginConTiempo` y `loginBackendUnaVez` acotan también el cuerpo al presupuesto restante de 18 segundos del intento. Se conservan credenciales, sesión/token y los dos intentos existentes.
- `students.js`: `fetchJSON` limita fetch y cuerpo a 12 segundos; `request` realiza dos intentos de lectura separados por 1,2 segundos. No reintenta escrituras. `readOnce` comparte consultas concurrentes de la misma sesión/bimestre. `peek`/`remember` conservan scopes independientes dentro de la caché temporal de diez minutos, siempre ligados al token exacto. Lectura de alumnos siempre mediante POST `loadstudents`; nunca se envía el token por GET.
- `registro.html`: `cargarPadronRegistro` pinta caché autorizada inmediatamente y verifica en segundo plano. `solicitudPadron` impide que un resultado anterior reemplace el bimestre activo. `entrarNivel` no espera la consulta de alumnos para terminar la inicialización local; periodos tienen un límite de ocho segundos. `onContexto` permite navegación durante la verificación.
- `registroSoloLectura` exige verificación, bimestre coincidente y el token verificado todavía vigente e idéntico. Guardados, subida, notas, conclusiones, sesiones/capacidades y asistencia aplican ese guard también al invocarlos directamente. `sincronizarEdicionRegistro` deshabilita exclusivamente controles de escritura de todo el documento, incluidos los que están fuera de main. No usa inert como autorización.
- `estadoPadron`, `reintentarPadronRegistro` y `vigilarCachePadron` presentan estados no intrusivos, reintento manual y retirada de caché vencida. Calificar, Promedios, Resumen, Asistencia, área, grado y sección siguen consultables. Una respuesta negativa de autorización retira los alumnos visibles; no se interpreta como simple desconexión.
- `apps-script/Codigo.js`, `doGet`: un GET accidental de loadstudents devuelve `METHOD_NOT_ALLOWED` y exige POST, sin entregar alumnos. POST y su autorización permanecen intactos.

Cada carga termina en servidor verificado, caché de solo lectura o error recuperable con Reintentar. Una incompatibilidad de API permite únicamente consultar una caché previamente autorizada y se informa como problema de implementación, nunca como permisos verificados. Volver a recibir una respuesta válida reemplaza esa caché sin recargar la página.

## Seguridad y validación

No cambia HMAC, expiración, revocación por permisosVersion, roles, filtros server-side, padrones congelados, datos ni escrituras del backend. No hay fallback a listas públicas o tokens sin verificación. Una escritura siempre vuelve a pasar los controles del backend.

Pruebas con reloj y respuestas simuladas: servidor rápido/lento, timeout del cuerpo, reintento exitoso, caché + caída, navegación de área/pestañas en solo lectura, recuperación posterior, denegación/revocación, cambio de token, caché vencida, deduplicación y respuesta atrasada de otro bimestre. La ruta POST y el rechazo explícito de GET se ejecutan contra el backend simulado. La suite previa y sintaxis HTML siguen ejecutándose. Se ajustan stubs de pruebas para las dependencias actuales del flujo y la instrumentación de login existente en main.

Antes de desplegar, contrastar en la pestaña Network del navegador el método, action y URL /exec del incidente real con la implementación vigente de Apps Script. No copiar tokens ni contraseñas a logs, PRs o capturas compartidas. Una discrepancia de deployment requiere actualizar la implementación correcta; el cliente no intenta eludirla con GET ni concede escritura usando la caché.

Estas pruebas no equivalen a validación de producción. El nuevo mensaje de GET requiere desplegar el backend; el flujo frontal usa la ruta POST que ya existe en el backend anterior.
