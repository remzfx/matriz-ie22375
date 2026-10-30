# PR #118 — avisos de padrón por contexto

Base: `368dafac24381230fd7335484c9856624d834d84`.

- Causa: `paint()` usaba `retryRoster.hidden === false` para inferir un error de servidor; el nodo y el texto persistían al pasar a otra sección. El error no estaba ligado al contexto académico.
- Ajuste: el aviso registra contexto y clase explícita (local/remota). Cambiar de contexto retira únicamente avisos de padrón obsoletos. Las respuestas fallidas tardías conservan el contexto de la solicitud que las originó. La visibilidad de Reintentar deja de certificar una caída de servidor.
- Un fallo local no se resuelve por cambiar de sección: se conserva como advertencia de persistencia pendiente de verificación. La marca solo se retira después de completar las operaciones locales correspondientes; una captura de alias pendiente en otro contexto no se da por verificada al pintar una sección distinta.
- No se modifican SIN_PADRON, motor N2, permisos, CAS, notas, borradores, backend o guardados en nube.

## Verificación diferencial

5 pruebas nuevas y 165 existentes directamente afectadas (170 casos únicos) aprobadas. La dependencia de presentación añadida a `onContexto` exige cargar el helper real en los fixtures que extraen funciones de producción; no se sustituyeron sus comprobaciones de seguridad. Dos fixtures parciales de `cargarPadronRegistro` necesitaron una identidad de contexto ficticia, y se repitieron únicamente esos dos fallos.

Edge aislado, 1366 y 390 px: navegación A→B→A; recuperación de notas; aviso remoto obsoleto retirado; fallo real simulado de `Storage.setItem` con `QuotaExceededError`; advertencia local conservada después de cambiar de sección; asistencia ficticia pendiente conservada; recuperación controlada; cero escrituras remotas y cero red externa. Las pruebas usan los módulos/DOM reales con transporte ficticio; no certifican BeQuiet ni Google Sheets.

Sintaxis/dependencias y `git diff --check` correctos. Se reutiliza la evidencia de componentes sin cambios, sin repetir la suite completa localmente. El CI del nuevo SHA debe evaluarse separadamente: el bloqueo de integración de #118 con la limpieza de main (#119/#120) sigue fuera de esta corrección y no se ha resuelto ni fusionado.
