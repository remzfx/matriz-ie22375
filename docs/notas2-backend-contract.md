# N2-G.18A — Backend compatible Notas 2.0

Construcción local sobre `cd03df0fb651fd6cfd10a94f9a0dbfe8900f0e30`.
Implementación revisada: `857011a45287682f289ffad2c1bf946bc1dfee23`.
No incorpora frontend, Service Worker, limpiezas anteriores ni despliegues.

## Protocolo

`loadnotas2` y `savenotas2` son acciones POST del `doPost` existente. Exigen token
válido y autorización server-side para nivel, grado, sección y área. Reutilizan
permisos, revocación, identidad académica, catálogo y padrones existentes. La clave
de RegistroNotas y la identidad docente se construyen con las reglas existentes;
`body.clave` no decide la fila. Admin conserva su facultad actual de indicar el
docente; para docentes la identidad proviene de la configuración del servidor.

`savenotas2` recibe `panel`, `version` (entero explícito) y el contenido completo
de ese panel; rechaza otros campos dentro del payload y claves de otro contexto:

| Panel | Campos |
|---|---|
| calificar | sessions, grades, capsSel, calificarEstado |
| promedios | finales, concComp, competenciasEstado |
| asistencia | asistencia, asisFechas, asisFechasEstado |

La respuesta incluye `ok`, `notas2:1`, `key`, `exists`, `legacy`, `readonly`,
`versions`, `at` y `payload`; el guardado confirmado añade `panel`. El payload
conserva el formato compatible de RegistroNotas y sus metadatos existentes.

Las escrituras leen y componen la fila vigente bajo ScriptLock, comprueban CAS
independiente por panel, conservan los demás paneles y asignan versión/fecha del
servidor. El reenvío con la versión anterior se rechaza con CONFLICT. No se añaden
reintentos, historial de subidas ni operaciones automáticas de migración.
Las reglas transversales vigentes se conservan para el guardado docente de
Secundaria. El protocolo guarda paneles parciales respecto del informe oficial:
no reemplaza la validación de completitud SIAGIE de los flujos actuales.

## Lectura, históricos y cierres

Una lectura no crea filas, no persiste equivalencias ni adopta registros. Proyecta
identidades verificables usando el padrón y rechaza contradicciones, filas
duplicadas, datos ilegibles o permisos inválidos. El padrón conserva el
comportamiento vigente de la función institucional existente; no se modifica en
esta fase. Los bimestres cerrados/bloqueados se pueden consultar con autorización,
pero no guardar. No se consulta ni altera ningún dato real durante las pruebas.

Un contexto académico histórico no se adopta al guardar asistencia. Calificar
histórico rechaza su escritura con LEGACY_REVIEW; la adopción académica requiere
el guardado explícito de Promedios por el futuro frontend compatible.

El guard legacy **rechaza savereg cuando existe meta.notas2**, incluso si
`adopted:false` por una escritura de asistencia. Este es el comportamiento exacto
de la implementación revisada: la protección cubre participación en el protocolo,
no solamente adopción de Promedios. Las filas que aún no tienen esos metadatos
conservan las rutas anteriores. No se debe permitir a un cliente antiguo eludir
CAS borrando metadatos ni retirando NOTAS2_REQUIRED.

`loadreg` conserva `calificarEstado` únicamente para el contexto autorizado. Las
notas, conclusiones, asistencia, fechas, aliases, historial y campos anteriores
no pertenecientes al panel guardado se mantienen. El límite de 49000 caracteres
rechaza un guardado sin truncar ni limpiar antecedentes.

## Validación y publicación pendientes

`tests/backend-notas2.test.cjs` ejecuta doPost, autorización, modelo e identidad
reales en VM con servicios Sheets/Cache/Lock/HMAC ficticios reutilizados de la
suite existente. No carga el motor frontend ni se conecta a Apps Script real.
La prueba de procedencia compara el backend con el commit revisado; por eso la
CI futura deberá mantener fetch-depth:0, como el workflow actual.

Antes de publicar: ejecutar esta prueba, regresiones completas, sintaxis,
dependencias y diff --check; revisar el diff y respaldos recuperables. Esta fase
no prepara ni autoriza un despliegue real. Un despliegue posterior del backend
debe incluir el proyecto compatible completo y conservar URL/implementación.
Los clientes anteriores deben continuar sobre filas no participantes.

Antes de usar el frontend nuevo, validar el backend compatible en TEST con datos
ficticios. Después de participar/adoptar filas no es seguro volver al backend
antiguo: conservar protocolo y NOTAS2_REQUIRED, pausar edición y recuperar un
frontend compatible. Restauraciones de datos requieren autorización separada.

Se preservan todos los datos institucionales, incluidos III/2026 y II/2026
consolidado. No se ejecutan limpiezas, migraciones ni escrituras remotas.
