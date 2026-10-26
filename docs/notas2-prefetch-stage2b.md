# Etapa 2B — sincronización progresiva ordinaria de Notas 2.0

Base: PR #114 DRAFT, `a300cb49f129f4ccf23f175f7607d4f8970a40d3`.

## Causa y solución

El coordinador 2A tenía una reserva única y un único destino. Tampoco conocía padrones de otros bimestres abiertos. Esa limitación se sustituye por una cola del mismo coordinador; no se crea otro motor de sincronización o escritura.

La enumeración utiliza asignaciones exactas del perfil autenticado, el catálogo N2 y padrones confirmados. Primaria conserva sus restricciones de grados y sección Única y sus asignaciones explícitas; Secundaria mantiene área→aula, sin producto cartesiano no autorizado. Listas vacías no conceden acceso general. Los perfiles históricos mantienen únicamente la compatibilidad existente.

Se preparan exclusivamente periodos **abiertos**: los cerrados/bloqueados conservan el lector histórico original. Tutor y Transversales no entran en esta cola. No se inicia una precarga en el Hub.

## Funcionamiento y aislamiento

1. El contexto visible se carga y autoriza primero con el motor/controlador existentes.
2. El adaptador recuerda su padrón confirmado y obtiene, secuencialmente, los padrones de los demás periodos abiertos mediante `IEStudents.readRoster` (lectura aislada sobre el mismo endpoint). No cambia `bdEstudiantes`, selectores ni la sesión activa para leer otras aulas. Rechaza resultados offline, de otro bimestre o sin padrón confirmado.
3. La cola prepara los candidatos restantes con una sola tarea académica de fondo. Los contextos ya conocidos o con reservas válidas no se descargan otra vez.
4. Cada reserva conserva propietario/token/permisos/backend/generación, clave exacta, prueba del padrón, payload, versiones CAS, firmas local/remota, fecha y caducidad. Cambiar las asignaciones del perfil también cambia la identidad de precarga, aunque el token local no haya cambiado.
5. `academicstate` se verifica antes y después de cada lectura de fondo mediante el transporte de solo lectura de 2A. No se invoca saneamiento, aceptación de una generación nueva ni recarga de página desde una precarga.
6. Seleccionar un contexto da prioridad al primer plano: promueve su petición pendiente o cancela la de otra aula. Una reserva se consume únicamente después de verificar sesión, permisos, generación, vigencia y prueba del padrón.
7. La respuesta reservada sigue pasando por `load()` y las firmas/versiones originales. Si existe trabajo local desconocido o cambió durante la petición, no se aplica: se conserva para revisión mediante la recuperación ordinaria. Nunca se sobrescribe para facilitar la precarga.
8. Guardar continúa siendo explícito, con autenticación y CAS del mismo motor. La cola se suspende durante Guardar, subida de asistencia, recuperación, carga visible, comprobación de conexión, desconexión o pestaña oculta. Una respuesta cancelada o de otra identidad no se publica.

Las reservas consumidas, caducadas o ya innecesarias se liberan solo de la memoria privada del coordinador. No se limpian localStorage, IndexedDB, perfiles, borradores ni datos académicos. La caducidad no desencadena una nueva descarga del mismo contexto; una visita posterior utiliza el flujo ordinario si hace falta.

## Asistencia e históricos

Varias áreas comparten el mismo ámbito de asistencia (nivel/bimestre/grado/sección). Por ello una reserva académica **no aplica ni confirma el panel de asistencia**, aunque venga incluido en la respuesta completa del backend. Todas las versiones se validan; solo se difiere la aplicación y su base de asistencia. El motor no permite editar un panel sin base confirmada.

Al abrir Asistencia se verifica su propia versión mediante la lectura ordinaria. Una lectura inesperadamente vacía frente a datos locales mantiene el rechazo existente y conserva esos datos; no se inventa una base vacía. Calificar/Promedios no se reescriben al cargar ese panel.

La lectura ordinaria de estudiantes puede retirar su caché al rechazar una consulta. Se conserva intacta para el primer plano y se añade `readRoster` al mismo módulo: usa la lectura POST existente, valida token/época/respuesta y devuelve el padrón sin publicar caché, borrar estados o reintentar. Así, un padrón faltante de otro bimestre no bloquea A.

La regresión integral detectó una recursión del adaptador al entrar en un periodo cerrado antes de que llegase su prueba histórica: `paint()` veía el contexto anterior del contenedor, llamaba `render()`, y el lector pendiente todavía no podía actualizar ese contenedor. Se excluye esa reconstrucción automática mientras gobierna la consulta histórica. No se modifica el lector, su proyección ni sus permisos.

## Límites iniciales

| Control | Valor | Motivo y comportamiento al alcanzar el límite |
|---|---:|---|
| Tareas académicas de fondo | 1 | Mantener prioridad visible y evitar ráfagas contra Apps Script. |
| Pausa mínima entre tareas | 500 ms | Ceder el hilo y espaciar peticiones; no estima latencia de producción. |
| Vigencia de reserva | 5 minutos | Datos de consulta, no autorización de escritura. Guardar conserva CAS. |
| Memoria retenida estimada global | 16 MiB | Suma JSON/firmas de reservas y copias de padrón del coordinador. La cola espera capacidad; no borra trabajo local. |
| Reserva individual | 2 MiB estimados | Una respuesta mayor queda para lectura ordinaria, sin vaciar datos. |
| Copias de padrón | 1 MiB por padrón; 4 MiB total | También sujetas a la capacidad global de 16 MiB. No se altera el caché institucional del módulo de estudiantes. |
| Intentos académicos de fondo | 192 por propietario/página | Incluye fallos/cancelaciones. No limita acciones explícitas del docente. Cada intento usa hasta tres operaciones del protocolo (dos comprobaciones y una lectura). |
| Intentos por contexto | 2 | Permite retomar una cancelación/desconexión, evita reintentos ilimitados. |
| Contextos admitidos en cola | 256 | Se informa el total enumerado y cuántos quedan diferidos; no se oculta la cobertura parcial. |
| Lecturas adicionales de padrón | Una por bimestre abierto faltante | Como máximo cuatro intentos lógicos por identidad. La lectura aislada no reintenta ni invalida el caché visible; los fallos quedan identificados por código/bimestre. |

Los límites cubren perfiles sintéticos de Primaria 1–6 y Secundaria 1–5 con áreas y periodos múltiples. Un perfil mayor, datos extraordinarios o mucha latencia pueden producir cobertura parcial por presupuesto/caducidad: no se promete que todo permanezca simultáneamente en memoria. Los contextos diferidos siguen disponibles bajo demanda y nunca habilitan escrituras por estar enumerados.

`retainedBytes` mide reservas serializadas y firmas; `rosterRetainedBytes` las copias de padrón; `totalRetainedBytes/peakTotalBytes` los suman. Son estimaciones de retención, no un límite del heap completo: objetos temporales, DOM, motor, perfiles/cachés previos y overhead del navegador se miden aparte.

## Validación y medición

Las pruebas ejercitan el coordinador, motor, controlador, módulo de estudiantes, transporte de generación y DOM reales con servicios ficticios. No utilizan credenciales institucionales ni Google Sheets real. Los artefactos de navegador bloquean red externa y emplean perfiles nuevos.

- Primaria: seis grados, dos áreas y dos periodos abiertos → **24 contextos enumerados**, uno visible y **23 preparados** automáticamente.
- Secundaria: cinco grados, secciones A/B en Matemática y asignación de Comunicación exclusivamente en A, dos periodos abiertos → **30 enumerados**, uno visible y **29 preparados**.
- En la preparación inicial: **24/30 lecturas académicas**, **48/60 comprobaciones autenticadas** y una lectura adicional de padrón. No hay lecturas de periodos cerrados por la cola ni subidas automáticas.
- La navegación observada reutiliza siete reservas por escenario sin nuevas lecturas académicas para esas selecciones. Los contextos ya conocidos también se reutilizan mediante el cliente original.
- Datos del ensayo: 30 estudiantes ficticios por aula, competencias reales del catálogo, notas y conclusiones sintéticas. Se conservan campo activo, foco, DOM, nota/conclusión pendientes, asistencia y disco académico mientras llegan otras aulas.
- Reservas: pico de **1650544 bytes en Primaria** y **2028824 en Secundaria**; padrón **132398/203774 bytes**. Total retenido estimado: **1782942/2232598 bytes**, por debajo de 16 MiB. Estas cifras pertenecen a la carga sintética y no predicen otros registros.
- El runner recoge además `Runtime.getHeapUsage` de Chromium antes/después, sin forzar GC. Incluye runtime y DOM y depende del GC; no se interpreta como una medición de heap de Apps Script ni de dispositivos reales.
- Unidades/integración: cola, presupuestos, caducidad, aborto, orden, contexto no autorizado, revocación, cambio de usuario/token/permisos/generación/padrón, borradores, cierre, asistencia diferida, interrupción de Guardar/recuperación y CAS.
- Navegador: escritorio 1366 px y móvil 390 px, cambio entre grados y áreas, visita a otro bimestre abierto y a uno cerrado mediante el histórico, regreso con pendientes, lectura propia de asistencia y conflicto CAS/cancelación.

Resultados definitivos de suite, navegador, CI y SHA se registran en el PR para el mismo commit. No se extrapolan tiempos sintéticos al backend desplegado.

## Compatibilidad, riesgos y reversión

El código usa únicamente operaciones existentes: `academicstate`, `loadnotas2`, `loadstudents`; la consulta histórica sigue usando su lector anterior. Apps Script permanece idéntico a la base de esta etapa. El ajuste previo de compatibilidad legacy de `Notas2.js` dentro del PR #114 sigue siendo una dependencia del PR completo.

**El backend desplegado no está certificado.** Revisar su código en el repositorio, pruebas en VM o recursos JS públicos no demuestra autenticación y versión efectiva del Web App. La prueba real autenticada solo podrá hacerse después de una autorización específica, preferentemente con cuenta TEST ficticia, y solo registrando códigos/versiones/recuentos. No se hizo esa llamada en esta etapa.

Un aborto local no garantiza cancelar Apps Script ya iniciado. El coordinador descarta la respuesta y aplica límites, pero no certifica concurrencia física de ejecuciones del servidor después de una cancelación. Una fotografía precargada tampoco sustituye la comprobación CAS frente a otra PC.

SW **v28** actualiza de forma coherente los recursos existentes de la integración; no elimina recursos de precache ni cambia network-first, TTL, MIME o exclusiones privadas. La limpieza del worker sigue limitada a sus cachés estáticas versionadas y no se ha ejecutado en usuarios reales.

Reversión: revertir únicamente el commit de Etapa 2B, volviendo al coordinador A/B aprobado de 2A. No hay migración de esquemas, backend ni datos para deshacer. Si llegara a publicarse, emitir después una versión estática nueva y coherente; no reutilizar identificadores de caché antiguos ni limpiar perfiles.

**Mismo PR #114 DRAFT. Sin merge, deploy, modificaciones institucionales ni escrituras reales. Detenerse para revisión antes de ampliar límites o rutas.**
