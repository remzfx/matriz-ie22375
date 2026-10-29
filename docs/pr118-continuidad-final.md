# PR #118 — Continuidad: diagnóstico diferencial final

Base: `9deac5ad571b4d1212f64598a58d112e5e9c6d11`. Árbol limpio al comenzar. Se revisaron los informes de navegación, renovación, traza y recuperación ya existentes; no se repitieron auditorías, pruebas de carga ni la suite completa local.

## Causas y alcance demostrado

**A/B — Navegación y IV vacío.** La espera de padrón en `refresh()` ya protegía los checks que ella misma programa. No protegía el temporizador interno de `IERegistroConnection.check()`: una renovación que coincidía con `cargandoEstudiantes` y `authorized() === false` interpretaba la transición como sesión inválida y retiraba todas las concesiones. También podía ocurrir al terminar una renovación iniciada antes de esa transición. Se reprodujeron ambos fallos con el controlador/adaptador reales. Se conserva una espera acotada a la operación de padrón existente, con token aún válido. La finalización de esa lectura vuelve a programar el check mediante el evento existente; no se añade polling, lectura, sincronizador ni vigencia.

La corrección aplica al módulo externo y su copia inline idéntica. No concede permisos durante la transición: `authorized()`/`allowed()`/`canEdit()` siguen cerrando edición. Una respuesta explícita SESSION/DENIED conserva prioridad y revoca acceso aunque el padrón esté cargando. Si vence la concesión, no se reutiliza; hay que verificar antes de editar. Los checks de Tutor y la recuperación conservan su recorrido.

**C — Bloqueo periódico sin navegación.** Las renovaciones sanas ya aprobadas siguen conservando edición y foco mientras hay concesión vigente. La nueva corrección cubre su coincidencia demostrada con la transición de padrón, no certifica resuelto todo bloqueo espontáneo. `checking / validUntil=0 / authorized=true / ready` describe la ausencia de concesión, pero no identifica su origen. No se encontró una nueva causa reproducible en sesión estable sin transición. Para atribuir el caso de BeQuiet falta la traza existente `IERegistroEditTrace` que abarque el bloqueo (eventos de concesión, verificación, visibilidad y motivo), y confirmar el SHA de los recursos efectivamente servidos. No se necesita información académica, tokens, credenciales ni limpiar almacenamiento. No se crea otra instrumentación.

**D — Nubecita.** En móvil, `#appHdr` es deliberadamente no fijo: al desplazarse por tablas largas, el botón existente salía del viewport con la cabecera. Se reprodujo con el código anterior. El mismo `#hdrSyncIndicator` se posiciona de forma fija, con objetivo táctil 44 px y fondo contrastado. No se crea otro botón, evento ni diagnóstico. El navegador verifica una sola instancia visible tras desplazarse en Calificar, Promedios, Resumen y Asistencia. No se reproduce una eliminación del nodo al cambiar de panel; no se atribuye a esa hipótesis.

**E — Mensajes.** Una lectura de padrón real se identifica como «Cargando padrón…», incluso con una tabla confirmada visible: aviso compacto y sin fingir descarga académica. Se conservan «Verificando acceso…», descarga de calificaciones, datos preparados y errores. El texto exacto «Verificando datos…» no aparece en los archivos de producción revisados: si continúa viéndose en BeQuiet, falta comprobar qué recursos sirve ese entorno; no se borra su caché.

## Medición y límites

| Caso ficticio | Antes | Después |
|---|---|---|
| Heartbeat a 120 s durante padrón transitorio | `session`, concesión retirada (`validUntil=0`) | Conserva el vencimiento original; no inventa acceso durante la espera |
| Padrón termina con concesión todavía vigente | Requiere recuperar autorización retirada | `canEdit=true` en la comprobación de 30 ms del reloj controlado |
| La concesión venció durante la carga | Edición bloqueada | Sigue bloqueada hasta respuesta autenticada; no amplía vigencia |
| Renovación termina durante padrón transitorio | Retira concesión anterior | Conserva solo la concesión anterior, sin aceptar una nueva |
| Backend anterior y transición a IV sin padrón listo | Descarta concesiones de I/II | Mantiene ambas hasta su vencimiento; no vuelve a verificarlas por ese incidente |
| Nubecita móvil tras desplazamiento | Fuera del viewport | Mismo botón visible, sin duplicados |

En navegador se recorren I → II → III → I → II → III y III → IV vacío → III → II → I. Con las reservas iniciales listas y alcance compartido vigente, no hay `loadnotas2` ni `academicstate` de navegación; cada cambio de bimestre conserva la consulta de padrón y estado de plantilla existente. La navegación completa de la fixture tarda aproximadamente 0,28–0,42 s, que incluye terminar esa consulta y **no equivale al tiempo de bloqueo de edición**. En el backend anterior, la primera autorización de un contexto todavía no visitado sigue siendo necesaria; sus regresos con concesión vigente no la repiten. Visitar IV vacío no retira concesiones de los otros periodos. Tras vencer autorización se verifica otra vez legítimamente.

La fixture espera que termine la precarga inicial antes de contar las solicitudes de navegación: las descargas de fondo de otros contextos no se contabilizan como recargas del visible. Se utiliza la traza de edición existente y los contadores del transporte ficticio existente.

## Validación diferencial y reutilización

- **6 pruebas unitarias nuevas**, con relojes/datos ficticios y controlador/adaptador reales. Tres reprodujeron los fallos antes de corregirlos. Incluyen expiración, rechazo explícito, backend anterior y rotulación del padrón.
- **37 pruebas anteriores directamente afectadas reejecutadas**: navegación, renovación, recuperación al volver visible, indicadores y normalización exacta. Total local: **43 aprobadas, 0 fallidas**. La adaptación del normalizador histórico solo retira los deltas literales nuevos; las comprobaciones académicas/de seguridad no se desactivan.
- **4 comprobaciones nuevas de navegador**: móvil anterior para reproducir la nubecita fuera de pantalla; móvil/escritorio corregidos; escritorio con backend anterior. Datos y perfiles ficticios, red externa bloqueada, cero escrituras académicas. Incluyen IV vacío, carga de padrón simultánea con check forzado, vencimiento y visibilidad en los cuatro paneles.
- **3.261 pruebas anteriores reutilizadas** del CI aprobado de `9deac5a`, sin presentarlas como ejecutadas localmente: 3.298 anteriores menos las 37 regresiones afectadas. Backend, CAS, guardado, asistencia y precarga no se modifican ni se prueban otra vez manualmente. La regresión completa corresponde al CI automático del nuevo SHA.

Los resultados del navegador y sus métricas quedan fuera del repositorio (`AIP_PR118_CONTINUIDAD_FINAL.json` en el directorio local de evidencias). No certifican el backend desplegado ni el entorno BeQuiet. No se han realizado consultas institucionales.

## Archivos y cierre

Producción: `registro-connection.js` (`check`), `registro-notas2-ui.js` (callback de espera, detalle de lectura y estilo del botón existente), `registro.html` (copia inline idéntica y título de lectura). Pruebas nuevas focalizadas, un normalizador exacto y su conexión con los goldens existentes. No cambian backend, fórmulas, versiones/CAS, guardado, permisos, cierres, datos persistidos, IndexedDB o Service Worker.

El PR queda DRAFT para revisión, sin merge ni deploy. La carrera de renovación/padrón y la salida de pantalla del indicador están corregidas y probadas. El bloqueo espontáneo sin transición permanece sin atribución causal adicional; no se declara resuelto por ocultar indicadores. Reversión ordinaria del commit, sin cambiar ni recuperar datos.
