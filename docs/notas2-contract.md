# Notas 2.0 — contrato local N2-A

Base: 666e528. Desarrollo local, sin despliegue ni migración de datos reales.

## Contrato

`loadnotas2` y `savenotas2` son POST autenticados. El servidor deriva ámbito/docente desde token y configuración. Construye la clave, verifica el padrón autorizado y el cierre, proyecta identidades sin elegir entre notas contradictorias y usa ScriptLock para escrituras.

Guardar recibe `panel`, `version` y únicamente los campos completos del panel. La versión CAS es independiente por panel y el servidor compone el nuevo payload desde la fila vigente bajo lock. Distintos paneles no se sobrescriben; dos cambios sobre el mismo panel requieren revisar antes de reemplazar. La fila sigue en RegistroNotas y conserva sus campos/clave para los consumidores actuales.

- Calificar: sessions, grades, capsSel, calificarEstado.
- Promedios: finales, concComp, competenciasEstado.
- Asistencia: asistencia, asisFechas, asisFechasEstado. Este canal preserva la sincronización ya existente que compartía la fila; no cambia sus cálculos ni la asistencia de ingreso de Auxiliar.

El servidor devuelve `notas2:1`, key, exists, legacy, readonly, versions, at y payload; las versiones y fechas provienen del servidor. No añade historial de subidas. Conserva el historial y metadatos anteriores sin borrarlos ni archivarlos de nuevo. Un cliente antiguo no puede sobrescribir una fila ya adoptada por Notas 2.0 mediante savereg.

## Decisiones confirmadas

Promedios cambia solo al procesar o editar: no es una vista viva de Calificar. El estado trabajado pasa de Calificar a Promedios al Procesar. Un contexto histórico permanece en consulta hasta Procesar y Guardar explícitamente Promedios; no se convierten ni suben sus resultados automáticamente. Un período cerrado nunca se adopta escribiendo.

El núcleo `registro-notas2.js` administra una sesión en memoria: lectura inicial, confirmación manual de descarga, guardado por panel, control de respuestas tardías, timeout con abort, pendientes y procesamiento. No conoce DOM ni localStorage, IndexedDB o archivos de auditoría. No reintenta escrituras.

## Compatibilidad y despliegue pendiente

El frontend nuevo deberá exigir el protocolo antes de habilitar edición y no usar savereg como fallback. El backend se deberá desplegar primero; las rutas antiguas continúan intactas para filas no adoptadas. La publicación no está autorizada. Antes de adoptar una fila histórica debe conservarse su consulta y solicitar la operación explícita autorizada. No se ejecuta ninguna migración.

## Validación N2-A

28 pruebas focalizadas, datos ficticios, servidor Apps Script simulado: dos PC, CAS, paneles independientes, fecha del servidor, red/timeout/respuesta incompleta, respuesta perdida sin retry, ediciones durante petición, cambio de sesión, cierres, permisos, inyección de claves, historial/asistencia y entrada histórica. La integración DOM y regresiones completas pertenecen a N2-B–D; no se afirma aún que Notas 2.0 esté terminado.
