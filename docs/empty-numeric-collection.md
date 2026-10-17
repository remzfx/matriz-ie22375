# Diagnóstico posterior a PR97: controles numéricos vacíos

Base independiente: main `96829312848251fdea6cdb787dfe2a75da2b1314` (PR95).
PR94, PR96 y PR97 permanecen separados y no se modifican.

## Causa reproducible y límite

`notaDesdeSesiones()` calcula desde `grades`; `notaCompAlumno()` da prioridad a
`finales` y utiliza el calculado si no existe directo. Esas funciones no escriben
calificaciones. El render muestra `Cal B`/`Cal 12 · B`; el campo numérico directo
permanece vacío. Alternar Letras/0–20 no crea un directo.

El defecto está en la recolección: `recolectarPantalla()` y `guardarFinales()` escribían
`{borrado:true,ts:...}` para un campo directo vacío incluso sin nota previa.
La recolección de `.cal-nota` presentaba el mismo problema e incluso podía agregar
una sesión vacía. Guardar, o una captura interna que reutilizara ese recolector,
podía así inventar una intención de eliminación. No convierte el cálculo en un
directo A/B: fabrica un tombstone donde no había directo/evidencia.

Con base sin directo, borrado local artificial y una nueva nota directa remota, A1
detecta correctamente un conflicto de eliminación frente a dato nuevo. La intención
local de borrar era falsa. El problema se demostró tanto en main como en el HEAD de
PR97, sin modificar sus ramas. En navegador: 30 alumnos ficticios × 4 competencias
producían 120 borrados artificiales después de guardar la vista numérica intacta.

Esto demuestra una causa posible de conflictos; **no identifica la causa del incidente
real**. Las diferencias de `origen:letra`, `origen:numero` y origen ausente pueden ser
conflictos auténticos adicionales. No se infiere un origen ni se elige una nota por
su letra. La proyección de nombres/códigos sigue dependiendo del padrón autorizado.

## Corrección mínima

Solo tres condiciones en `registro.html`: vacío sin registro previo, registro ya
borrado o una nota en Letras que mantiene vacío su campo numérico es un no-op.
Se conservan el borrado explícito de una nota numérica existente, su confirmación,
tombstones pendientes, evidencias, conclusiones, fechas y otros contextos.
No se limpia ningún tombstone que ya exista. No se crean respaldos de auditoría.
No se toca backend, identidad, motores A1/B1/CAS, permisos, cierres ni cálculos.
Procesar a Promedios no forma parte del cambio.

## Evidencia sintética

`tests/registro-empty-collection.test.cjs`: render/captura/guardado reales, Primaria
y Secundaria, ambos modos, orígenes explícitos y ausentes, ID/código/nombre verificados,
primera PC vacía, conflicto causado por borrado artificial, eliminación real y cancelación.
La guarda histórica admite únicamente el diff exacto y rechaza alterar `readOnly`.
Las primeras 20 regresiones dieron 12 fallos antes de la corrección y 20 aprobadas
después. La batería final incluye casos adicionales.

`tests/registro-empty-collection-browser.cjs`: navegador real con perfiles temporales,
red externa abortada y datos ficticios. Las aserciones completaron 1366/390 px en
ambos niveles: 60 evidencias intactas, calculado B, cero directos al guardar y cero
peticiones externas. El mismo runner contra el main anterior reprodujo los 120
borrados. En este equipo Edge dejó pendiente el cierre del runner después de las
aserciones; se terminaron exclusivamente esos procesos de prueba. No se presenta
ese problema de cierre como una ejecución de navegador con salida limpia.

La revisión focalizada de PR97 confirmó sus ocho regresiones, CI del HEAD exacto y
las aserciones de consulta/impresión en 1366/390 px. Su motor de conexión y sus reglas
académicas permanecen intactos. No se repitió su suite completa local ya aprobada.

## Siguiente paso y reversión

Revisión independiente de este PR. No desplegado ni fusionado. Revertir el commit
restaura el recolector anterior, sin migrar ni reescribir datos; también reintroduce
el defecto. Los borrados artificiales existentes no deben limpiarse automáticamente:
pueden ser indistinguibles de eliminaciones intencionales.

Para atribuir el caso real sigue haciendo falta el diagnóstico agregado de PR96,
previa aprobación de su ejecución. Mantener abierta la pestaña y el contexto afectado;
no pulsar Guardar/Subir/Recuperar, no recargar ni limpiar almacenamiento. Seguir el
Snippet revisado de `docs/sync-directed-diagnostic.md` de PR96 y compartir solamente
el resultado agregado de `IERegistroSyncDiagnostic.runPage()`, sin tokens, store,
capturas de notas ni consola completa. El diagnóstico no autoriza recuperar datos.
