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

## Integración N2-B–D validada localmente

El Registro utiliza la sesión volátil y el adaptador Notas 2.0. Guardar confirma exclusivamente Calificar o Promedios, según la pestaña; una confirmación no limpia el pendiente del otro panel. Bajar Nube realiza una lectura fresca y pide confirmación con la fecha del servidor. Procesar a Promedios modifica solo la memoria y requiere Guardar posterior. La selección trabajado de Calificar se transfiere al procesar. Los registros adoptados no recuperan el cálculo vivo como resultado oficial en matrices ni comparativos; los históricos sin adoptar conservan su interpretación anterior.

La asistencia conserva Guardar local y Subir Nube manual. El adaptador escribe únicamente sus mapas en el almacenamiento existente, conservando los datos académicos históricos originales. Los aportes transversales siguen usando su contrato vigente: si su guardado explícito falla, permanecen pendientes aunque el panel académico ya haya sido confirmado. Tutor conserva su verificación propia. No se modificaron fórmulas, usuarios, permisos, cierres ni reglas de conclusiones.

El archivo de recuperación anterior se conserva por los consumidores históricos y demos independientes; su inicialización termina inmediatamente en una página Notas 2.0. No ejecuta sus timers, borradores ni subidas en ese modo. Las comparaciones históricas de código excluyen solo los cambios exactos autorizados mediante notas2-boundary.cjs; las regresiones nuevas ejecutan el código actual sin esa normalización.

Validación final: 2704 pruebas aprobadas, 0 fallidas, 0 omitidas. 44 pruebas específicas del núcleo/backend/adaptador. Edge aislado: Primaria y Secundaria, 1366 y 390 px; guardado por panel, procesamiento, ausencia de borradores académicos nuevos en disco, restauración aceptada/cancelada, pausa y reconexión sin subidas e impresión local. Sintaxis: 190 JS/GS y 31 scripts inline; 84 dependencias. Primera ejecución completa: 2685/2702, 17 expectativas históricas/fixtures desactualizadas; se actualizaron y se volvió a ejecutar por esos fallos. Sin desactivar pruebas de seguridad. CI remoto no ejecutado: publicación prohibida.

## Orden de publicación propuesto, no ejecutado

1. Revisar los commits y validar el contrato simulado. No asumir que la versión de producción incorpora esta rama.
2. Cuando se autorice, publicar primero el backend completo de esta rama: Codigo.js, AcademicIdentity.js y el nuevo Notas2.js junto al manifiesto existente. Conservar URL e implementación. No basta sustituir Codigo.js aisladamente.
3. Comprobar el protocolo mediante una cuenta/contexto de prueba autorizado. Ninguna lectura adopta ni migra datos. El frontend anterior continúa con sus rutas mientras no se haya adoptado la fila.
4. Publicar después HTML, lectores y módulos junto con SW v24. Un backend antiguo o una dependencia ausente deja edición pausada; no existe fallback de escritura a savereg.
5. La adopción histórica ocurre únicamente tras Procesar y Guardar Promedios explícitos, en bimestre abierto. No realizar una adopción masiva ni limpieza de registros.

## Reversión y límites

Antes de adoptar filas, los commits locales pueden revertirse en orden inverso. Después de una adopción real futura, NO retirar el guard NOTAS2_REQUIRED ni borrar meta.notas2 para hacer funcionar un cliente antiguo: permitiría una escritura sin el CAS por panel. Conservar el backend nuevo y pausar edición mientras se repone el frontend compatible. No se ejecutó esta operación ni se tocó almacenamiento real.

Los CAS por panel rechazan cambios de una PC desactualizada; no mezclan automáticamente dos ediciones del mismo panel. Ante respuesta perdida, conservar la pestaña y verificar mediante lectura: no hay reintento automático de escrituras. Los cambios no guardados son volátiles por decisión del usuario. Las copias históricas ya existentes no se borran ni se convierten en fuente oficial. Una identidad ambigua, un registro ilegible/duplicado o una celda superior al límite de 49000 caracteres bloquea el guardado con error conservador: no se eligen notas ni se eliminan antecedentes. La integración Google real, Safari/iPhone físico y paginación PDF real de esta versión quedan fuera de las simulaciones locales.
