# Fase 1: diagnóstico dirigido, sin operaciones de recuperación

Base: main `96829312848251fdea6cdb787dfe2a75da2b1314`, después de PR95.
Caso: Secundaria, 1.º A, EPT, III. No se accedió a producción ni se usaron datos reales.
No se mezcla con Procesar a Promedios ni con PR94. Ningún archivo de producto
existente cambia: solo se agrega un diagnóstico opcional, pruebas e informe.

## Hallazgos demostrados y límite de la conclusión

- `prepararVersionAcademica()` compara la base causal, el estado local y la nube
  mediante `academicPlan()`. Una diferencia por sí sola no es un conflicto: importan
  la base y las modificaciones de cada lado. La asistencia compartida tiene revisión
  propia; la versión de EPT no demuestra causalidad sobre otras áreas.
- La descarga automática devuelve `estado: conflicto` sin elegir candidatos cuando
  hay decisiones pendientes. El verificador de conexión pasa a `review`; `canEdit()`
  deja de autorizar edición y la interfaz bloquea los controles. Por tanto un conflicto
  de Promedios/Asistencia/identidad puede pausar también Calificar: no demuestra que
  sus evidencias estén dañadas. Guardar/Subir se deshabilitan mientras se revisa.
- `bimCerradoDocente()` incluye `registroSoloLectura()`, que a su vez incorpora la
  conexión. No se puede interpretar ese booleano como prueba de un cierre de Admin.
  El diagnóstico consulta el estado de periodo por separado y no llama a ese helper.
- Las lecturas no íntegras, el backend anterior al protocolo de identidad, sesión
  rechazada, padrón de otro contexto o problemas de persistencia también pueden
  impedir verificar. Lease de 150 s y chequeo visible de 120 s siguen sin cambios.
- Reproducción con 28 estudiantes ficticios: dos sesiones y 56 evidencias idénticas
  en ambos lados; nube con una nota directa sin origen, local con cuatro en Letras,
  sin base causal. Resulta **un conflicto de Promedios por origen**, cero de Calificar.
  Las otras notas locales son diferencias pendientes, no conflictos automáticamente.
  Esta combinación demuestra una causa posible, **no la causa de producción**.
- Otra reproducción separa conflicto concurrente de evidencia, asistencia P/F y
  representaciones de identidad verificadas pero contradictorias. Una referencia
  14/15 de Letras no genera conflicto; números exactos 14/15 sí. Un alias no verificado
  se cuenta como no resuelto sin asociarlo a un estudiante por suposición.

Los totales de Sheets y la captura antigua **no permiten reconstruir el local actual**.
Falta ejecutar la comparación autorizada de ese contexto en la sesión afectada.
No hay evidencia suficiente para cambiar el motor, inferir orígenes históricos,
borrar notas locales o determinar qué versión debe prevalecer.

## Diagnóstico disponible y garantías

`registro-sync-diagnostic.js` no se carga desde registro.html ni se instala en SW.
No crea UI, timers periódicos ni listeners; no se ejecuta al abrir la página.
`analyze()` usa los motores aprobados sobre copias efímeras; nunca aplica decisiones.
`runPage()` toma el contexto local en memoria, base ya existente, padrón y controles,
y hace una lectura `loadreg` y otra `loadperiodos`, sin reintento automático.
Usa POST **solo para estas acciones de lectura**, con token en body y `no-store`.
No se incluye identidad/token en URL. Un POST `savereg` no existe en el diagnóstico.

Evita deliberadamente `sliceRegistroArea`, `baselineAcademica`, `guardarTodo`,
`automatic`, `resolve`, `leerEstadoRemotoAcademico` y `sincronizarPeriodosNube`:
algunos inicializan estructuras, conservan respaldos, aplican cambios o actualizan
la caché de periodos. Se copian solo las piezas necesarias de la base causal, no
los respaldos históricos. No escribe localStorage/sessionStorage/IndexedDB,
CacheStorage ni Sheets; no revoca/limpia sesiones ante rechazo. Los errores solo
devuelven códigos de una lista cerrada, nunca el mensaje privado del servidor.

El informe retorna exclusivamente:

- Cantidades originales local/nube por campo (sesiones, evidencias, directas,
  conclusiones, asistencia y selección de capacidades); no equivalen a un inventario
  de estudiantes ni a notas efectivas calculadas.
- Versiones CAS numéricas disponibles, integridad de lectura y disponibilidad de
  comparación; ausencia/corrupción no se presenta como una base vacía confirmada.
- Conflictos por módulo y causa. Cada conflicto cuenta una vez por módulo/causa;
  un conflicto conjunto puede afectar varios módulos, por lo que no se suman para
  obtener el total. Los campos adicionales se agrupan sin exportar sus nombres.
- Identidades no resueltas, sin IDs, nombres, claves ni candidatos.
- Cierre de periodo verificado separado de bloqueo de sincronización. `review`
  describe revisión; no prueba cierre ni corrupción de Calificar. Periodo desconocido
  se muestra desconocido, no abierto.
- Comparación del resultado hipotético con la nube (sin aplicarlo). Es información
  diagnóstica, no autorización para editar ni una nueva confirmación de guardado.
- Presencia de almacenamiento antiguo sin propietario y coincidencia disco/memoria,
  sin leer ni exportar el contenido legado. Disco distinto de memoria puede reflejar
  trabajo sin guardar; no se diagnostica automáticamente un fallo de almacenamiento.
- Cantidad de controles cuya propiedad `value` difiere de `defaultValue`. Se advierte
  que el análisis académico corresponde al modelo en memoria: **no recolecta ni
  guarda entradas aún en edición**, y ese contador no prueba por sí solo suciedad.

No retorna datos de alumnos, nombres de docentes/usuarios, tokens, claves académicas,
calificaciones individuales, textos de conclusiones ni el historial. No hace logs.
Si cambia sesión/contexto/padrón/modelo/control durante la lectura, descarta el informe.
El registro normal conserva sus tareas previas de fondo; el diagnóstico no las inicia,
pausa ni modifica. No debe utilizarse para sustituir la conservación de una pestaña.

## Uso propuesto, pendiente de revisión y autorización

No se ejecutó en producción. Tras aprobar el diagnóstico, el responsable puede
mantener abierta la sesión afectada y el contexto exacto, sin pulsar Guardar, Subir,
Bajar, Recuperar ni cambiar selecciones. Cargar el archivo revisado como un Snippet
de DevTools, **sin recargar el registro ni desplegar el frontend**, y después ejecutar:

```js
await IERegistroSyncDiagnostic.runPage()
```

Compartir solo ese informe agregado. No compartir `store`, capturas de filas,
requests/token, consola completa ni los argumentos de `analyze()`. Si devuelve
`CONTEXT_CHANGED`, error de lectura o hay controles en edición, conservar la pestaña;
no guardar, sustituir datos ni repetir operaciones de recuperación para investigar.
Un informe sin conflictos no certifica el backend completo, identidades no resueltas
ni autoriza ninguna escritura. La revisión de datos antiguos locales es un trabajo
separado de Admin; no se necesita recuperarlos para esta comparación.

## Corrección mínima propuesta y siguiente decisión

Todavía **no hay corrección de datos/motor justificada**. La intervención mínima es
obtener el diagnóstico del estado actual. Si se confirma únicamente origen histórico
sin verificar, conservar revisión y originales: no convertirlo por defecto a Letras
o Numérica. Si hay cambios concurrentes reales, usar la revisión explícita existente
solo tras autorización. Si todas las diferencias son equivalencias verificadas pero
el motor sigue generando conflictos, crear la reproducción con esos campos y proponer
un parche de igualdad estrictamente acotado. Si el único bloqueo es periodo cerrado,
no tocar sincronización: corresponde al estado configurado por Admin.

Pruebas ficticias reproducibles: `node --test tests/registro-sync-diagnostic.test.cjs`.
Se reutilizan las regresiones de conexión y de explicaciones/identidad/A1; la suite
general única corresponde al CI del HEAD final. Sin merge, deploy, respaldo adicional
de auditoría, escritura académica ni cambio del motor.
