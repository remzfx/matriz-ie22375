# PR #81 — comparativo y consulta académica histórica

Base de esta corrección: e188bd7b2e8c4ec2dada78cd925b098f7531f30b. Mismo PR y rama codex/registro-visual-stats. Sin merge, despliegue, datos oficiales ni modificación de Apps Script.

## Diagnóstico y estabilización

Se revisó el comentario técnico del PR y el log del CI #164 (run 38558922805), y se reprodujo localmente el resultado: 1766 aprobadas, 254 fallidas. renderFinales dependía de las variables léxicas nuevas del comparativo, ausentes en fixtures que extraen y ejecutan ese renderizador aisladamente. Los otros fallos eran comparaciones históricas de source previas al comparativo. El renderizador conserva sus dependencias académicas obligatorias y acepta la ausencia del comparativo opcional. Se corrigieron los snapshots cronológicos para retirar únicamente hooks autorizados, incluidos los de consulta histórica. A1-snapshot ahora extrae las funciones de la fuente ya normalizada, en lugar de buscar texto bruto que ya había sido transformado por otro snapshot.

Las 2020 pruebas existentes volvieron a pasar antes de implementar la consulta histórica. No se eliminaron, omitieron ni desactivaron pruebas de seguridad. Las 54 regresiones nuevas ejecutan la fuente actual sin normalizar; mantienen además comparaciones exactas de backend, modelos, cálculo, A1 y contratos B1/B2.

## Comparativo protegido

La lectura usa POST loadreg con token y contexto exacto, además de loadRoster del periodo consultado. Se exige padrón inicializado y verificado, respuesta soportaModeloAcademico, items con clave y metadatos del contexto solicitado y ausencia de duplicados. Un timeout de lectura está acotado. BASE_ACTUAL, respuestas offline, formatos antiguos, duplicados, cambios de token y respuestas de otro contexto no verifican una consulta histórica.

Las identidades se cruzan primero por ID SIAGIE, después por código cuando no contradice IDs existentes, y finalmente por nombre único y sin identidades incompatibles. La lectura de claves antiguas reutiliza IEStudentIdentity.leer y sus protecciones contra homónimos y dueños distintos. Se conservan tombstones y competencias no trabajadas. No se cruzan notas de un alumno nuevo con otro que comparta su nombre. No se producen envíos ni cambios al store actual.

## Consulta I–IV

El selector conserva valores I/II/III/IV, identifica con candado los periodos no abiertos y conserva la selección manual; inicialmente prefiere un bimestre abierto. Admin y Docente pueden consultar los periodos. Los permisos efectivos continúan siendo los del servidor; el backend puede rechazar una petición o devolver un subconjunto vacío. El cliente no interpreta un conjunto vacío como autorización para buscar otros registros.

Todo periodo académico no abierto se consulta en solo lectura, también para Admin. Se exige su padrón propio confirmado. Si no existe, se muestra un error recuperable y no se sustituye por BASE_ACTUAL. Los cierres de Asistencia de ingreso/Auxiliar y sus endpoints permanecen intactos; la pestaña Asistencia del Registro histórico también es de solo lectura.

El snapshot remoto se conserva exclusivamente en memoria, ligado a token/contexto y secuencia de petición. Los renderizadores y la impresión leen una proyección síncrona clonada, con el padrón histórico propio. La proyección nunca se mezcla ni persiste en el borrador local: saveStore está bloqueado durante ella y store, lector, escritor, lista de estudiantes y adaptador transversal se restauran con finally incluso si falla un render. Los borradores transversales actuales no se usan para sintetizar resultados históricos oficiales. Los borradores pendientes y sus versiones se conservan al restaurar el adaptador.

Los controles de notas, conclusiones, evidencias, fechas, tombstones, calificación masiva, Guardar y subida quedan protegidos por el gate de solo lectura existente. Bajar Nube en un periodo cerrado refresca la vista aislada y no ejecuta la conciliación A1 contra el borrador. Al regresar a III/IV abiertos se usa el registro editable original. Las respuestas tardías de otra área, aula, periodo, token o petición se descartan. La impresión conserva los renderizadores existentes, usando el padrón y resultados del periodo consultado.

## Validación y límites

2074 pruebas aprobadas, 0 fallidas, 0 omitidas/canceladas: 2020 existentes más 54 nuevas. Datos exclusivamente ficticios. Se ejecutan renders/impresión, lecturas y negativas de autorización contra el backend real simulado; no se usan Google Sheets oficiales.

La lectura se limita al esquema académico vigente. Los contratos actuales identifican los registros por nivel/bimestre/aula/área y no separan años escolares: este cambio no implementa archivo multianual ni migra datos de 2026/2027. Un histórico sin padrón verificable o con identidad ambigua queda no disponible o sin referencia. Los snapshots oficiales transversales históricos no se reconstruyen con borradores locales. La paginación física PDF continúa pendiente por la limitación de navegador previamente documentada; estas regresiones no se presentan como una validación de PDF nativo. ChatGPT conserva la revisión de CSS/HTML; este ajuste no cambia el CSS aprobado.

Reversión: revertir el commit de esta corrección. No hay migración de almacenamiento, hojas, notas, padrones ni credenciales. No merge ni deploy.
