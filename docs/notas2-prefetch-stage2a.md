# Etapa 2A — precarga limitada de una segunda aula

Base: PR #114 DRAFT, `f8292e01c7d8105591214900d7f1115b75f8076b`.

## Alcance implementado

Registro sigue cargando primero su contexto visible A. Después de confirmar su autorización, puede reservar silenciosamente los datos de una sola segunda aula B del mismo nivel y bimestre. No comienza en el Hub ni recorre automáticamente todas las asignaciones o los cuatro bimestres.

`registro-notas2-prefetch.js` enumera candidatos desde el perfil, el catálogo N2 y el padrón disponible. Respeta el mapa exacto área→aulas y las restricciones específicas de Primaria. Conserva las reglas de perfiles históricos; no interpreta listas vacías como permisos generales. Transversales no se envía al protocolo ordinario N2.

Para esta primera implementación, B debe ser otra aula, sin datos locales de ninguno de sus paneles. No se precarga encima de un borrador ni sobre un contexto con asistencia local. Los periodos cerrados continúan utilizando el lector histórico existente. La enumeración no autoriza escrituras.

## Lectura, reserva y aplicación

- El coordinador recibe una copia inmutable del contexto; nunca cambia selectores, sesiones activas, foco ni formularios para consultar B.
- Su identidad incluye usuario, rol, token, permisosVersion, backend y generación. Las respuestas de una identidad anterior no se publican.
- La nueva operación de solo lectura del transporte existente permite únicamente `loadnotas2`. Comprueba `academicstate` antes y después del payload, sin llamar a `accept`, sanear almacenamiento, crear respaldos ni recargar la página. Una revocación/cambio de generación durante la petición invalida la reserva y pausa la autorización correspondiente.
- `registro-notas2.js` comparte su validador de contrato con la precarga; además se comprueban el alcance de todos los campos, el catálogo y las identidades frente al padrón. Legados ambiguos o respuestas incompletas no se convierten en datos activos.
- El resultado queda como JSON privado en memoria, sin modificar payloads, versiones o firmas de los motores visibles.
- Al seleccionar B se verifica su autorización con el controlador real. Solo entonces su carga inicial puede consumir la reserva y pasar por el `load()` original, con sus verificaciones de versiones, firmas, vacío, existencia, permisos y CAS.
- Antes de aplicar se compara de nuevo el estado local y se comprueban los campos en edición. Si cambiaron, se rechaza la publicación completa; no se modifica su base confirmada ni el borrador.
- No hay otro escritor. Guardar sigue usando el motor y su CAS por panel. Navegar, reservar y reconectar no ejecutan `savenotas2`.

## Prioridad y límites

Una sola precarga de fondo puede estar en curso. Seleccionar su propia aula reutiliza la petición pendiente; seleccionar otra aula o iniciar Guardar cancela el transporte de fondo y descarta su respuesta tardía. Cancelar en el navegador no garantiza detener una ejecución ya iniciada en Apps Script.

La reserva caduca a los 90 segundos. Se limita a 2 MiB estimados de texto UTF-16; una respuesta mayor se descarta y queda disponible mediante la lectura normal de primer plano. No se elimina ningún dato para cumplir este límite. No se reintentan escrituras; una desconexión pausa y descarta la reserva, y una reconexión autenticada puede volver a intentar la misma segunda aula. No se añaden nuevas aulas al completar la primera precarga.

La asistencia no se aplica durante la precarga. Al consumir B se exige que su estado local siga vacío/sin cambios; se aplica únicamente con B ya visible y mediante el adaptador existente. La asistencia de A y sus fechas/cierres no se sustituyen por la respuesta de B.

## Recursos y compatibilidad

El HTML carga el nuevo módulo antes del adaptador UI. Service Worker v27 incorpora el módulo al precache y conserva todos los recursos v26, network-first, TTL, MIME y exclusión de datos privados. Las pruebas de instalación fallida verifican que un recurso faltante no desactive el worker anterior.

No se modifica Apps Script, Google Sheets, el contrato persistido ni las fórmulas. Se usan las operaciones existentes `academicstate` y `loadnotas2`. **No se ha certificado el backend desplegado:** toda la validación funcional utiliza transporte y servicios ficticios. La dependencia previa del PR #114 en el ajuste legacy de `Notas2.js` sigue siendo aplicable; esta etapa no añade otro cambio de backend.

## Evidencia automatizada

- Pruebas unitarias con el coordinador, el transporte de lectura y el núcleo reales: aislamiento, contexto inmutable, permisos, cancelación, caducidad, generación, cierre, datos extranjeros, versiones, límites, publicación y CAS.
- Navegador Edge aislado: Primaria/Secundaria × 1366/390 px, edición de A mientras B se reserva, nota y conclusión pendientes conservadas, asistencia intacta y regreso a B sin otra lectura académica. Dos escenarios adicionales de revocación y desconexión/reconexión. Red externa bloqueada.
- En los cuatro escenarios A/B hubo una sola precarga de B. El recorrido completo incluye una lectura A, una B y una lectura manual B cancelada por el usuario durante la recuperación del conflicto: tres lecturas académicas. Ocho comprobaciones autenticadas en ese recorrido; el único intento de escritura fue explícito y rechazado por CAS. Cero subidas automáticas.
- Reserva observada: 1622 bytes estimados de texto en Primaria y 1606 en Secundaria; se libera al consumirla. Estos valores corresponden al fixture pequeño, no al heap ni a notas reales. No se extrapolan tiempos a producción.

La suite/CI y SHA exactos se documentan en el PR al cerrar la validación. No se ha desplegado esta funcionalidad.

## Riesgos y reversión

La reserva es una fotografía, no una actualización en tiempo real: una confirmación posterior de otra PC debe seguir provocando conflicto CAS al intentar guardar con una versión anterior. No certificar como actuales datos que solo están precargados.

Un borrador local, una lectura legacy o el límite de memoria pueden impedir la precarga; se mantiene el flujo normal de lectura/recuperación, sin limpiar datos para facilitarla. La ampliación a todas las aulas, otros bimestres o rutas de Tutor requiere otra autorización.

Reversión: revertir este commit de Etapa 2A, conservando los commits previos del PR #114; si llegase a publicarse, emitir una nueva versión estática coherente en lugar de reutilizar un identificador antiguo. No se requiere migración de datos ni cambios de backend para revertir la precarga. No ejecutar limpiezas de perfiles o cachés de usuarios.

**DRAFT. Sin merge, deploy, datos reales ni escrituras remotas. Detenerse para revisión antes de ampliar el alcance.**
