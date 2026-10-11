# Plan de estabilización institucional 2026–2027

## Estado y alcance de esta entrega

Decisión institucional aprobada: operar como máximo dos años escolares.
Este primer PR incorpora CI y documentación. **No implementa** separación por
año, congelamiento, migración, rotación, retiro o borrado. El comportamiento
actual de producción permanece intacto. Cada PR posterior requiere autorización
y revisión independientes; este documento no autoriza escrituras en producción.

Referencia auditada: main después del PR #70, commit
`19b91cf2ef2919ac9849dbda5553df08e0d19f86`.

## Filosofía: complemento del SIAGIE

La plataforma facilita gestión, evaluación, asistencia y seguimiento institucional.
No constituye otro SIAGIE ni sustituye sus registros oficiales. Los CSV SIAGIE
vigentes, revisados expresamente por Admin, son entradas de matrícula; la
plataforma conserva identidades, evidencias y trazabilidad necesarias para sus
funciones. No reconstruye automáticamente una matrícula histórica desde una
base actual, un navegador o un CSV de otro periodo.

## Ventana operativa de dos años

| Año | Estado | Operaciones |
| --- | --- | --- |
| Actual institucional | ACTIVO | Lectura y escritura sujetas a rol, asignación y bimestre |
| Inmediatamente anterior | CONGELADO | Consulta y referencias, exclusivamente bajo demanda |
| Anteriores | Fuera de la ventana | Respaldo y retiro posteriores, autorizados por separado |

En 2027: 2027 activo y 2026 congelado. En 2028: 2028 activo y 2027 congelado.
La política acota la ventana operativa; **no autoriza eliminar** los datos que
ya existen ni fija un plazo legal de conservación. Antes de otro cambio anual
debe resolverse el respaldo/retención del año que saldría de la ventana.

El año institucional y los estados proceden del servidor. La fecha del equipo,
`body.anio`, el rol declarado por el navegador o una bandera visual nunca
habilitan escrituras. Año activo no equivale a todos sus bimestres abiertos.

El año congelado rechaza cualquier modificación ordinaria, incluso por Admin:
matrículas, importación/enriquecimiento, padrones, notas, asistencia, sincronización,
recálculos persistentes, transversales, plantillas y configuración anual.
El rechazo debe producirse antes de efectos secundarios y de forma coordinada
con el congelamiento concurrente. Debe comprobarse también en RPC/bridges,
alias y llamadas directas al backend.

La consulta puede calcular una representación temporal en memoria, pero nunca
recalcular ni actualizar registros persistidos del año congelado. No crear
hojas, índices persistentes, padrones o versiones históricas como efecto
secundario de una lectura. Login y Hub no descargan históricos.

## Separación inequívoca por año

El esquema concreto se definirá en un PR de diseño compatible, sin cambiarlo
en este PR. Los siguientes contratos son obligatorios:

| Dominio | Identidad/alcance anual requerido |
| --- | --- |
| Matrícula/base y respaldo | Año escolar + versión; conservar vigentes y trasladados |
| Padrón | Año + bimestre + versión propia; no sustituir por BASE_ACTUAL histórica |
| Registro y matrices | Año + nivel + bimestre + grado + sección + área |
| Notas/conclusiones/evidencias | Contexto anual anterior + competencia + identidad estable; fechas cuando corresponda |
| Asistencia de Registro | Año + aula + bimestre + fecha + identidad; conservar fechas/tombstones |
| Asistencia de ingreso | Año + fecha + nivel/aula + identidad, con lectura legacy compatible |
| Transversales | Año + aula + bimestre + área/aporte; snapshots y versiones vinculados al mismo año |
| Reportes/SIAGIE | Año/contexto/padrón explícitos; promedio referencial nunca oficial |
| Cachés y borradores | Token/permisos + año + contexto + versión; TTL acotado por expiración real |
| Configuración anual | Periodos, calendarios y referencias al año; cuentas globales distinguidas de asignaciones anuales |

No basta incluir `anio` en un snapshot o cambiar una etiqueta. Claves,
búsquedas, validaciones, índices, lectura legacy, almacenamiento local y
exportaciones deben compartir el mismo contexto. Un ID SIAGIE pertenece al
estudiante y **no se reemplaza** al cambiar de año. El año identifica matrícula
y registros, no inventa una nueva identidad personal.

No mezclar asistencia académica y asistencia de ingreso; sus finalidades y
formatos siguen siendo diferentes.

## Congelamiento y recuperación extraordinaria

El congelamiento es irreversible desde las operaciones ordinarias. No habrá
un selector de Admin que vuelva a abrir un año congelado ni un booleano de
cliente que omita el guard. Cambiar la configuración actual de bimestres no
descongela el año anterior.

Antes de congelar, inventariar trabajo local pendiente y confirmar su recepción
o recuperación privada. Un borrador antiguo no adquiere autorización para
escribir al año congelado; debe conservarse sin borrarlo y ofrecer una vía
extraordinaria de revisión. Tampoco debe trasladarse silenciosamente al año activo.

Una recuperación extraordinaria requiere incidente documentado, autorización
institucional, copia independiente verificada y restauración ensayada en entorno
aislado. Cualquier reparación debe tener alcance y operador identificados,
validación posterior y trazabilidad. No equivale a reabrir la edición ordinaria.
Esta entrega solo documenta ese procedimiento; no añade una ruta de recuperación.

## Migración compatible de 2026 a 2027

1. Inventariar esquemas, claves legacy sin año, punteros, snapshots, archivos
   SIAGIE y borradores pendientes, sin publicarlos ni registrar datos personales.
2. Obtener respaldo independiente de 2026 y verificar su restauración aislada.
3. Definir el mapeo legacy a 2026 mediante procedencia comprobable. Si una clave
   es ambigua, detener y solicitar revisión; no inferir el año solo por el reloj.
4. Incorporar backend de lectura compatible, namespaces anuales y guards,
   manteniendo las rutas y formatos actuales mientras se actualizan consumidores.
5. Migrar consumidores/cachés por módulos con pruebas de lectura de notas por ID,
   código y respaldo por nombre. No borrar originales ni invalidar notas antiguas.
6. Confirmar 2026 completo y trabajo pendiente resuelto antes del congelamiento.
7. Inicializar 2027 con SIAGIE vigente revisado por Admin, permisos y calendario
   aprobados. No usar localStorage ni copias históricas como semilla automática.
8. Validar con cuentas sintéticas y luego prueba institucional autorizada.
   Solo después activar el nuevo año y mantener 2026 como consulta bajo demanda.

Los nombres, IDs, códigos, estado de matrícula y órdenes originales se conservan.
Numeración visual no modifica identidades ni órdenes almacenados. Los
trasladados permanecen en la base y su historial; el padrón académico del
bimestre abierto aplica matrícula vigente y revisión explícita de otros estados.
No modificar padrones cerrados ni resolver discrepancias SIAGIE automáticamente.

## Respaldo, restauración y eventual retiro

Este PR **no implementa borrado ni rotación anual**.

Procedimiento futuro, sujeto a autorización separada:

1. Definir responsables, alcance por año y obligaciones de conservación aplicables.
2. Respaldar datos, adjuntos/plantillas necesarios, esquema, versiones, punteros,
   configuración relevante y código compatible en almacenamiento independiente
   del Spreadsheet original, privado y con acceso mínimo.
3. Crear manifiesto sin datos personales: versión de esquema, año, tablas,
   cantidades, tamaños y hashes de integridad; custodiarlo con el respaldo.
4. Verificar integridad, acceso autorizado y capacidad real de leer el respaldo.
5. Restaurar en entorno aislado con comunicaciones/escrituras a producción
   deshabilitadas. Comparar conteos, relaciones, notas, asistencia y snapshots;
   documentar resultados sin copiar nombres o credenciales al informe.
6. Aprobar expresamente el retiro del año identificado. Nunca seleccionar filas
   solo por fechas incompletas o una coincidencia de texto.
7. Retirar de la ventana operativa mediante el procedimiento aprobado; conservar
   originales y archivo según la política institucional. La eliminación física,
   si corresponde, exige autorización específica posterior.
8. Verificar que los dos años operativos y sus permisos permanecen íntegros.

Un respaldo lógico dentro de la misma hoja no sustituye un respaldo independiente.
El rollback de código nunca debe implicar borrar datos nuevos. Revertir esquema
solo si el código anterior puede leerlo; de lo contrario, mantener compatibilidad
y corregir hacia adelante. En frontend, cualquier reversión que afecte recursos
cacheados necesita una versión nueva del SW, no reutilizar una versión antigua.

## Inventario de módulos y fuentes a revisar

| Módulo/fuente actual | Trabajo posterior |
| --- | --- |
| index.html, login-bridge.js | Contexto institucional, sesión/roles; sin precargar históricos |
| admin.html, students-migration.js | Separar borradores de periodos; importación anual y estados explícitos |
| students.js, EstudiantesBase | Base/respaldo/padrón anual, caché por año/token y compatibilidad legacy |
| student-identity.js | Conservar identidad estable, aliases y numeración solo visual |
| registro.html, RegistroNotas | Contexto anual, borradores, notas, conclusiones y asistencia compatibles |
| registro-academic-model.js, registro-evaluation.js | Paridad cliente/backend; no alterar fórmulas ni reglas actuales |
| primaria.html, secundaria.html, EstadosAreas | Matrices/reportes anuales y consulta congelada |
| auxiliar.html, auxiliar-permissions.js, AsistenciaIngreso | Niveles autorizados, sincronización robusta y claves anuales |
| photochecks.html | Base anual protegida; conservar QR e identidades compatibles |
| transversales-client.js, registro-transversales.js, hojas transversales | Aportes/decisiones/snapshots anuales; Tutor y versiones vigentes |
| aula_innovacion.html/js, PlanAIP | Calendario/plan anual; permisos existentes |
| ConfigSistema, DocentesAcceso, matrix-teachers.js, auxiliar-admin.js | Distinguir cuentas de permisos/contextos anuales; revocación intacta |
| Plantillas SIAGIE, Drive, grupos/horarios | Inventariar referencias anuales frente a configuración global |
| apps-script/Codigo.js y bridges | Guards anuales completos, paridad, atomicidad y compatibilidad |
| sw.js | Conservar network-first y exclusión de datos privados; revisar futuras versiones |
| tests y workflows | CI, fallos simulados, concurrencia, contratos y pruebas de restauración |

## PR incrementales y dependencias

Los nombres son propuestas, no números de PR reservados. No comenzar el
siguiente PR hasta que la institución lo autorice.

| Orden | PR pequeño | Dependencia | Riesgo y regresiones obligatorias |
| --- | --- | --- | --- |
| 1 | CI + este plan | Ninguna | Sin producción; sintaxis/dependencias, suite completa, CI falla correctamente |
| 2 | Periodos separados de borrador de estudiantes | CI aprobado | No perder borradores; savePeriodos no marca BD pendiente |
| 3 | Escape de HTML en sinks demostrados | CI aprobado | Nombres/textos literales; conservar handlers y layout |
| 4 | Merge de asistencia de ingreso | CI aprobado | Antiguo/nuevo/empate, relojes, concurrencia y registros legacy |
| 5 | Borrado sincronizado versionado | Merge de asistencia | No resucitar marcas ni eliminar pendientes; tombstones compatibles |
| 6 | Padrón académico propio | CI aprobado | Ausente/abierto/cerrado, Tutor, reportes y validación backend |
| 7 | Credenciales docentes: servidor | Diseño/revisión de seguridad | Login compatible, DTO sin claves, edición sin reset y revocación |
| 8 | Credenciales: consumidores y limpieza local | Servidor compatible | No cerrar usuarios involuntariamente ni borrar trabajo académico |
| 9 | Atomicidad/cierre/configuración | CI y casos de concurrencia | Actualizaciones perdidas, cierre simultáneo y conflictos explícitos |
| 10 | Contrato anual + backend compatible | Inventario, respaldo restaurable | Legacy 2026, año falsificado, año congelado y todos los alias/RPC |
| 11 | Consumidores y almacenamiento anual por módulos | Backend anual compatible | Local-first, identidades, históricos bajo demanda y no colisión |
| 12 | Preparación/activación institucional 2027 | Validaciones anteriores + autorización | Matrícula, permisos, reportes y congelamiento total de 2026 |
| 13 | Rendimiento/extracción gradual | Contratos y medición | Paridad, latencia, móviles y conservación de datos |
| Posterior | Retiro de años anteriores | Respaldo independiente + ensayo + autorización | Fuera del alcance actual; jamás borrado automático |

La separación de identidad de asistencia, ciclo de sesión/rotación y dependencias
externas requiere PR propios. No girar el secreto de tokens sin revisar su
relación con los verificadores de Auxiliar. Las reglas de evaluación/conclusiones
actuales no se cambian como efecto secundario de esta preparación.

## Protección de datos y permisos

- Mantener tokens HMAC, expiración, permisosVersion y autorización server-side.
- Docente Secundaria: relación exacta área→aula; Primaria: asignaciones vigentes.
- Auxiliar: únicamente niveles autorizados; Tutor/Admin conservan sus roles.
- Histórico congelado no concede a un docente acceso a otras aulas/áreas:
  debe definirse un permiso de consulta explícito en servidor para ese contexto,
  sin deducirlo del navegador ni asumir acceso universal.
- No publicar bases, listas, contraseñas, tokens, identificadores reales o
  respaldos. Las pruebas utilizan exclusivamente datos sintéticos.
- Cachés privadas ligadas a token/año/contexto; expiración real como límite.
  La caché de estudiantes no sustituye autenticación.
- Logout/revocación debe retirar autorización sin destruir notas ni asistencia
  pendientes. Un error transitorio no debe convertirse en revocación.
- Revisar ACL/publicación del Spreadsheet y custodia del respaldo mediante una
  comprobación autorizada posterior; CI no consulta servicios institucionales.

## Criterios verificables de aceptación de 2027

1. Solo dos años operativos; el anterior se consulta únicamente bajo demanda.
2. Año institucional resuelto por servidor; ninguna bandera de cliente amplía
   permisos o habilita escritura en un año congelado.
3. Pruebas de todas las escrituras/alias/RPC rechazan el año congelado antes de
   efectos secundarios, incluso para Admin y bajo cierre concurrente.
4. Matriculas, padrones, notas, asistencia, transversales, reportes y cachés de
   2026/2027 no colisionan para el mismo ID/aula/bimestre/área.
5. Los registros legacy 2026 siguen legibles y no se reescriben al consultarlos.
6. Padrones propios conservan historia; trasladados e identidades SIAGIE no se
   eliminan; estados desconocidos requieren revisión.
7. Notas por ID/código y notas antiguas por nombre mantienen compatibilidad;
   concArea permanece solo como historial según las reglas actuales.
8. Se conserva trabajo local autorizado, navegación y bloqueo de nube hasta
   verificación; cambio/expiración/revocación retira autorización local.
9. Asistencia mantiene marcas, fechas, eliminación y recuperación de pendientes
   sin sobrescrituras antiguas ni sincronizaciones automáticas peligrosas.
10. Tutor, asignaciones, snapshots schema:3 y exportación SIAGIE mantienen
    semántica y autorización; promedio referencial sigue siendo informativo.
11. Prueba de restauración aislada aprobada antes de activar/congelar/retirar.
12. Suite y CI aprobados, prueba manual autorizada en móvil/escritorio y medición
    de carga con datos sintéticos representativos. No inventar umbrales o tiempos
    medidos: acordarlos antes del PR de rendimiento.

## Cómo ejecutar las comprobaciones de este primer PR

Node.js LTS fijado en CI: `24.13.0`. Actualizarlo posteriormente mediante un
cambio explícito y probado. No hay instalación de dependencias de aplicación.

```sh
node scripts/check-source.cjs
node --test tests/*.test.cjs
git diff --check
```

El comprobador usa el inventario versionado de Git: valida JS/CJS/MJS/GS,
scripts inline ejecutables y dependencias locales script/stylesheet/manifest.
No ejecuta código productivo ni descarga CDN. Comprueba mayúsculas de rutas
también en Windows. No sustituye validación DOM/visual, MIME publicado ni
pruebas reales de Apps Script.

El workflow `CI — pruebas y comprobaciones locales` corre en PR hacia main y
push a main, con permiso de lectura y sin secretos. El resumen del job informa
totales aprobados/fallidos/omitidos; si una comprobación falla, el job falla.
El workflow manual de despliegue Apps Script se conserva sin cambios.

Revertir este primer PR retira CI/documentación/comprobadores; no requiere
restauración de Sheets ni cambios en producción. La protección de rama para
exigir el check requiere configuración posterior autorizada de GitHub.
