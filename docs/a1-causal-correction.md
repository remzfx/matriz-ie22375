# A1 — segunda fase, corrección causal de grupos de identidad

Autorización: comentario técnico [6177099232](https://github.com/remzfx/matriz-ie22375/pull/82#issuecomment-6177099232) y solicitud del usuario. Se actualiza el mismo PR #82; sin merge ni deploy.

## Cambio y causalidad

`registro-reconcile.js`, dentro de `plan`, compara los conjuntos por las mismas rutas del grupo, usando la igualdad de contenido existente (sin timestamps). La ausencia de una ruta también se compara; no se elige un valor por antigüedad.

| Relación entre conjuntos | Comportamiento |
| --- | --- |
| Local = remoto | No añade un conflicto de identidad; conserva la conciliación por ruta |
| Base conocida y local = base | Solo cambió remoto; conserva la conciliación de tres vías |
| Base conocida y remoto = base | Solo cambió local; conserva la conciliación de tres vías |
| Ambos diferentes de base y entre sí | Mantiene la revisión explícita del conjunto cuando las representaciones difieren |
| Base desconocida y conjuntos diferentes | No supone causalidad unilateral; mantiene las protecciones anteriores |

Esto evita interpretar una divergencia histórica interna como una edición concurrente. Las claves antiguas permanecen donde estaban, las conclusiones no se migran y una descarga no genera una subida. La lógica previa de sesiones/fechas borradas, desactivación de competencias y asistencia compartida conserva sus conflictos; el bloque no elimina conflictos ya detectados. La aplicación local, baseline, respaldo y CAS permanecen intactos.

No cambian normalización de notas, números exactos, permisos, cierres, token, identidad, servidor ni contratos A1/B1/B2. Un cambio unilateral de ruta o tombstone se trata como ya dispone la conciliación por ruta; no se borra una clave antigua solo porque haya una clave por ID.

## Pruebas y alcance

Los dos casos de conflicto recurrente del diagnóstico se convierten en regresiones positivas. El caso sin base local confirmada también verifica descarga y reapertura sin POST. Se añaden cambios unilaterales en evidencias, finales y conclusiones, con ambos sentidos; borrados/tombstones; cambios bilaterales en ID/alias; números exactos distintos en la misma banda; base desconocida; nombres ambiguos; lectura protegida denegada; nota pendiente con alias y reapertura.

Se mantienen las pruebas anteriores de cambios locales, cancelación, recuperación, respuesta perdida, CAS, permisos backend y cierres. Las comparaciones históricas de código usan `tests/a1-causal-snapshot.cjs`: solo revierte el bloque exacto autorizado para contrastar con sus referencias antiguas y exige una única aparición. No se elimina ninguna prueba ni se permite modificar el resto del conciliador. Las pruebas funcionales ejecutan el código actual, sin ese adaptador.

Todo usa datos ficticios, almacenamiento de memoria y transporte simulado. No se accedió al registro de 1.º A ni a Google Sheets. No se puede declarar resuelto el incidente de producción con estos resultados.

## Riesgos y límites

- Ambos lados pueden cambiar distintas representaciones de la misma identidad: se conserva la decisión explícita aunque el caso requiera una revisión humana adicional. No se adopta una regla automática de preferencia ID/nombre para descartar evidencia.
- Un histórico sin `origen` no se convierte automáticamente en letra. Los números exactos 12/13 permanecen distintos.
- Una base desconocida no permite reconstruir causalidad ni resolver una identidad ambigua.
- El respaldo sigue siendo acotado por contexto; no reemplaza un historial ni copias privadas previas.
- Un cliente offline con JS anterior puede continuar mostrando el conflicto. Service Worker y su estrategia vigente permanecen intactos; antes de una validación autorizada debe comprobarse que cada equipo recibió el recurso actualizado.

## Validación segura posterior

Aplicar el procedimiento del [diagnóstico](a1-critical-diagnostic.md), preservando primero borradores privados de ambos equipos y versión remota, sin elegir masivamente local/remoto ni borrar almacenamiento. Solo después de revisión y autorización de publicación, verificar con datos ficticios en ambos equipos: recurso nuevo, descarga, reapertura, conjuntos idénticos, edición local pendiente, conflicto real y rechazo CAS. La comprobación oficial de 1.º A requerirá autorización independiente y comparación privada por contexto/identidad; ninguna lectura o escritura oficial forma parte de este PR.

## Reversión

Si aparece una regresión tras una publicación expresamente autorizada, detener subidas del contexto afectado, conservar borradores y respaldos y revertir únicamente el bloque de comparación causal al estado del HEAD diagnóstico `68200806318b668adb0ea3f59b26cb6fbb7c7c4b`. No hay migración ni cambio de esquema que revertir. No borrar claves, notas, aliases, base ni recuperación. Volver al algoritmo anterior puede restaurar los avisos repetidos; cancelar y preservar datos mientras se revisa. No ejecutar reversión ni publicación automáticamente.

Validación local: **2130 pruebas aprobadas**, sin fallos, omitidas ni TODO. El archivo de sesiones contiene 25 pruebas (15 nuevas y dos diagnósticas convertidas); la ejecución focalizada con las regresiones A1 anteriores aprobó 108 pruebas. Sintaxis: 110 archivos JS/GS, 28 scripts inline; 67 dependencias locales. `git diff --check` aprobado. CI del HEAD final se consigna en la descripción del PR.
