# Competencias transversales: decisión oficial del Tutor

## Configuración explícita y despliegue futuro

Admin → Docentes y accesos permite marcar **Es tutor** y seleccionar varias aulas. Solo puede existir un Tutor activo por aula; frontend y backend validan la unicidad. Se conserva `tutorAulas`.

Cada relación académica área → aula tiene una selección independiente **Aporte TIC/Gestiona**. Se almacena como `aportesTransversales: { área: [aulas] }`. El servidor solo admite un subconjunto de las asignaciones académicas reales de ese docente. Ser Tutor no habilita aportes de su propia área. No hay habilitación automática por 2026/2027.

Las cuentas antiguas sin `aportesTransversales` quedan sin esa asignación. Admin debe revisar y habilitar explícitamente las relaciones correspondientes; no se infieren permisos de datos históricos. Guardar la configuración conserva la revocación existente por `permisosVersion`; los docentes vuelven a iniciar sesión y reciben solo su propia asignación/tutoría en el perfil.

Después de una aprobación y merge futuros, usar el workflow oficial **Deploy Apps Script**, verificar el backend y luego la publicación de Pages. No se ha desplegado con este PR. El frontend requiere `flujoTutor` para exportar; un backend anterior debe actualizarse. SW v16 cambia exclusivamente la versión de assets, conservando network-first, caducidad de siete días y exclusión de peticiones privadas/externas.

## Trabajo y envío

Un docente habilitado encuentra TIC y Gestiona en Calificar, Promedios y Resumen. Puede conservar evidencias incompletas como borrador; para Nube Subir debe completar ambas competencias para todo el padrón privado del aula y las conclusiones específicas C. `savereg` comprueba esa obligación desde la configuración del servidor, incluso con `envioIntegral:false` u omitido. Un docente sin asignación no recibe esas columnas, no aparece como faltante y puede enviar su área académica normalmente.

El Tutor abre **COMPETENCIAS TRANSVERSALES** junto a las áreas de Registro. Es un módulo separado; no modifica `areaActual` ni amplía permisos académicos. Su selector permite únicamente las aulas tutoradas verificadas por el servidor y mantiene separado cada bimestre. Durante este modo se ocultan los botones de subida/guardado del área académica anterior. Se protegen las decisiones sin guardar al cambiar aula, salir y cerrar la pestaña; no hay reintentos automáticos de escritura.

El Tutor ve todos los docentes/áreas habilitados, incluyendo su propio aporte solo si está asignado. Se conserva `transversalResumen_`: un voto completo efectivo por área (el más reciente), mayoría AD/A/B/C y empate sin sugerencia. La sugerencia no es oficial. Una C docente sin conclusión se muestra pendiente y no cuenta como voto completo; las conclusiones textuales nunca se promedian.

El Tutor guarda decisiones finales independientes y pulsa **ENVIAR AL REGISTRO OFICIAL**. Las dos decisiones de cada estudiante deben existir y utilizar la versión vigente de aportes; toda C final necesita una conclusión específica editable, sugerida o personalizada. AD/A/B no la requieren. El Tutor puede guardar borradores con aportes faltantes mediante la justificación existente. El envío oficial exige, para cada estudiante del padrón privado y ambas competencias, un aporte completo de cada docente/área/aula habilitado por Admin; una C docente necesita su propia conclusión. Los docentes no habilitados no bloquean. El backend verifica esta condición antes de emitir el snapshot y comunica los pendientes para deshabilitar el envío en la interfaz.

## Almacenamiento y compatibilidad

Se reutilizan TransversalesAportes, TransversalesConsolidado y TransversalesProcesado, los locks, conflictos optimistas, segmentación de celdas y claves existentes. No hay eliminación ni migración destructiva de filas.

- Los aportes anteriores siguen disponibles si su docente/área/aula queda explícitamente habilitado. Las filas de aportes deshabilitados se conservan sin participar en votos/versiones de la configuración actual.
- Las tutorías existentes se conservan; no se crean co-tutorías.
- Los consolidados anteriores quedan en `historico` para consulta autorizada, separados de los nuevos borradores del Tutor.
- Los snapshots antiguos de Admin (`schema:2`) permanecen almacenados, pero no son exportables como resultados oficiales nuevos.
- Los nuevos consolidados/snapshots usan `schema:3`, `flujo:tutor` y auditoría derivada del servidor: usuario Tutor, aula, bimestre, competencia, fecha/hora y versión de aportes.

Un nuevo aporte, un cambio relevante de asignación/tutoría o del padrón invalida el snapshot vigente sin reescribirlo. El Tutor debe revisar, guardar nuevas decisiones y volver a enviar. Una escritura interrumpida sin marcador consolidado queda no exportable. Admin dispone solo de consulta de estado/resultado y exportación; no tiene controles ni autorización de decisión, revisión o procesamiento. SIAGIE usa exclusivamente un snapshot Tutor vigente. Primaria, notas académicas, asistencia local y autenticación conservan su diseño.

## Prueba manual después de un despliegue autorizado

1. Admin configura dos aulas para un Tutor y habilita aporte solo en algunas relaciones académicas. Intentar un segundo Tutor activo en la misma aula debe fallar.
2. Reingresar con docentes habilitados/no habilitados: comprobar columnas, edición y bloqueo solo para el área habilitada incompleta.
3. Tutor cambia entre sus aulas/bimestres, ve aportes sin mezclar estudiantes y conserva las advertencias de borradores. Otra aula debe ser rechazada en servidor.
4. Elegir finales AD/A/B y C. Una C sin conclusión no permite envío oficial; completar ambas competencias y enviar.
5. Admin consulta Registro General y SIAGIE sin controles de decisión. Exportación solo usa snapshot Tutor vigente.
6. Cambiar un aporte desde otro docente: snapshot histórico intacto, exportación pendiente, revisión/reenvío necesarios.
7. Verificar Primaria, asistencia, Promedios/Resumen académicos, scroll y móvil. Sin cambios a cálculos/SIAGIE académicos.

## Límites conocidos

La sugerencia conserva la regla anterior por área; no calcula una nueva fórmula numérica ni un voto adicional por cada docente de la misma área. Los aportes completos y las C pendientes se muestran individualmente. Los snapshots históricos no se convierten automáticamente en oficiales y requieren una nueva decisión del Tutor. Revisar visualmente en producción de prueba antes de aprobar el flujo.

## Actualización funcional y UX: unidades, cierre y consulta

- Unidades opcionales numéricas: I = U0/U1/U2; II = U3/U4; III = U5/U6; IV = U7/U8. U0 es diagnóstico y no cuenta como una de las ocho regulares. «Sin unidad» mantiene compatibilidad con sesiones históricas. Las claves fecha/competencia/capacidad y los cálculos se conservan; el backend valida contra el bimestre real. Cambiar la unidad es un cambio de metadatos de la evidencia, no una migración de notas.
- Promedios concentra resultados, checkbox encima del título y conclusiones compactas por estudiante/competencia/bimestre en `concComp`. Primaria exige conclusión B/C y Secundaria C. SIAGIE y la validación integral server-side usan esa misma regla. Las observaciones de aportantes y las conclusiones oficiales del Tutor siguen separadas.
- Sugerencias rápidas: «No logró el propósito propuesto.», «No presenta evidencia para evaluar la competencia.» y «No asistió.», más las sugerencias pedagógicas existentes y texto propio. Reemplazar texto existente requiere confirmación; elegir texto propio no lo borra.
- Resumen es informativo: resultados ya calculados, promedio referencial y columnas transversales únicamente con asignación explícita; no muestra ni edita conclusiones. La estadística cuenta cada alumno una vez por su resultado referencial: matriculados, evaluados/no evaluados, AD/A/B/C, AD+A+B aprobados y C desaprobados. Esta clasificación solo describe el reporte; no decide promoción ni SIAGIE. Porcentajes sobre evaluados; cero evaluados produce 0 %.
- «Imprimir Resumen / PDF» genera contexto/docente, resultados y estadística sin controles ni conclusiones. La impresión detallada anterior se conserva separadamente. El promedio de los promedios se representa mediante el promedio referencial ya existente, sin otra fórmula oficial.
- Tutor trabaja TIC y Gestiona en pestañas separadas. Las columnas derivan de áreas/responsables habilitados; una celda desplegable muestra todos los docentes, evidencias y conclusiones C. La sugerencia mantiene un voto efectivo reciente por área. Pendiente y C ⚠ incluyen texto, no solo color. Los conteos por competencia usan `aportesPendientes` server-side.
- Se conserva guardar borradores; el envío oficial exige ambas competencias, todos los aportantes habilitados completos, conclusiones C, finales vigentes, Tutor único y bimestre abierto. Admin navega las pestañas en consulta, sin controles de decisión. No se cambia `transversalResumen_()` ni `transversalAportesPendientes_()`.
- SW v16 actualiza los recursos cacheados en conjunto; conserva network-first, 7 días, exclusión de datos privados y protección JS/HTML.

Prueba manual pendiente en producción: revisar 1366×768 y móvil ~390 px, conclusiones Primaria B/C y Secundaria C, unidades y recarga, Resumen/PDF A4, pestañas Tutor/múltiples aulas y aporte habilitado vs tutoría. Backend y frontend deben actualizarse por el flujo oficial después de un merge/despliegue expresamente autorizado. No se ha hecho merge ni despliegue.

Validación automatizada: 1158 pruebas aprobadas, 0 fallidas, 0 omitidas; 56 casos nuevos de unidades/UX. Sintaxis de 15 JS y 25 scripts inline en 9 HTML. Segunda revisión manual: conservación de notas/asistencia e historial, autorización explícita, separación docente/Tutor, reglas de conclusiones y controles de envío.

Riesgo de compatibilidad a revisar antes del rollout: sesiones históricas sin unidad siguen siendo válidas. Si existen sesiones antiguas con unidades fuera de la nueva distribución de su bimestre, se conservan al leer, pero el backend rechazará una nueva escritura con esos metadatos; deben revisarse y corregirse explícitamente, sin migración automática ni eliminación de notas. La comprobación visual local no pudo completarse por timeout al abrir el servidor de prueba; siguen pendientes escritorio, móvil e impresión real.
