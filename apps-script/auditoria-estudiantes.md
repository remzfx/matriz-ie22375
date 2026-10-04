# Etapa B: consumidores privados y padrones por bimestre

El PR #35 integra `main` con los PR #36, #37 y #38. Conserva sin cambios `apps-script/Codigo.js`: estudiantes trasladados, punteros privados `BASE_ACTUAL`, `BASE_OFICIAL`, `PADRON_I` a `PADRON_IV`, sincronización solo de bimestres abiertos y enriquecimiento opcional de identidad. No ejecuta importaciones, merge ni despliegue.

| Consumidor | Fuente después del corte |
| --- | --- |
| Admin | `IEStudents.load()` para administrar la base actual; `loadRoster(bimestre)` para exportar notas SIAGIE. Conserva importación SIAGIE/CSV/JSON, edición, guardado y restauración privados. |
| Registro | `IEStudents.loadRoster(bimestre)` al entrar y al cambiar bimestre. La lista activa solo proviene de ese resultado. |
| Primaria | Base privada autorizada para totales por grado; conserva el flujo académico de la matriz. |
| Secundaria | Base privada autorizada para totales por aula; conserva las relaciones exactas área → aula del servidor. |
| Auxiliar | Base privada de todo el colegio, con el rol existente Admin/Auxiliar. |
| Photochecks | Base privada para Admin; QR generado localmente con el contenido compatible con Auxiliar. |

Los seis consumidores usan `students.js`, POST y token en el cuerpo. No hay fallback a alumnos embebidos, JSON público ni claves antiguas de localStorage. Se eliminan `BD_EMPOTRADA` de Admin, `BD_EMP` de Registro y `bd_oficial_2026.json`. No quedan copias estáticas de estudiantes en el árbol de producción; el historial de Git no se reescribe.

## Registro: identidad y compatibilidad

`student-identity.js` define una sola `studentKey(alumno)`: `id:<idSiagie>`, después `cod:<codigoEstudiante>`, finalmente `nom:<nombre normalizado>`. Los identificadores se codifican para no introducir separadores en las claves. Los eventos de edición transportan esa identidad, manteniendo el nombre visible.

La lectura busca primero las claves estables del estudiante y luego una clave histórica por nombre normalizado, dentro del mismo contexto académico. Los nombres observados para una identidad estable se conservan como alias del aula en `payload.meta.studentAliases`; `meta` sigue siendo un objeto y mantiene el docente y demás campos. Estos alias viajan en la sincronización existente de Registro. No se renombra, elimina ni migra destructivamente ninguna clave de `RegistroNotas`.

Una corrección de nombre/orden con el mismo ID mantiene sus notas estables. Los alias permiten recuperar notas antiguas por nombre cuando se ha observado su asociación con ese ID/código. Un alumno nuevo aparece vacío; un retirado desaparece de la lista activa sin borrar su historial. Borrar explícitamente una nota guarda una marca en su clave estable para que el respaldo antiguo no la haga reaparecer. No se asignan notas por nombre ambiguo a homónimos.

Admin y Registro conservan el cruce Excel por ID primero, luego código y nombre como respaldo. Ambos leen notas estables e históricas con el mismo auxiliar. Se preservan los identificadores opcionales y matrícula transferida del PR #38; las plantillas y estructura de notas no cambian.

## Padrones y conectividad

El backend existente entrega `PADRON_<bimestre>` si está inicializado. Si falta, devuelve la base actual autorizada con `padronInicializado:false`; Registro informa que ese padrón está pendiente y no lo presenta como congelado. No crea un padrón automáticamente. Un padrón cerrado ya existente conserva su lista aunque cambie `BASE_ACTUAL`.

La caché es temporal, de diez minutos, ligada al token exacto y al bimestre solicitado. No sirve un bimestre distinto, ni se usa ante una denegación del servidor. Una falla sin caché válida vacía la lista activa y bloquea la edición. Una respuesta offline se identifica expresamente y no confirma producción.

Los controles manuales de `students-migration.js` permanecen porque ahora también administran los padrones y la sincronización del PR #37. La inspección inicial puede verificar una base aún no inicializada; los consumidores normales fallan hasta que Admin la inicialice. Solo CSV SIAGIE vigente de ambos niveles, revisión marcada y confirmación explícita pueden iniciar la base. No se usan copias históricas ni localStorage como semilla. La discrepancia histórica de Secundaria 4.º B, orden 217 sigue sin resolverse automáticamente.

## Revisión antes de publicar

- Confirmar conectado al servidor la base privada y los padrones necesarios. Un bimestre cerrado sin padrón sigue reportando el fallback; no se inventa una lista histórica.
- Verificar los ID/códigos vigentes. Si una nota antigua solo tiene un nombre que cambió antes de su primera asociación con un ID/código, no puede recuperarse esa relación de forma inequívoca: requiere revisión manual, sin emparejamiento aproximado automático.
- Revisar el corte de los seis consumidores y la exportación SIAGIE con una copia controlada. Las pruebas locales son simuladas y no sustituyen validación de producción.

Ejecutar `node --test tests/*.test.cjs`. La suite conserva controles de rol, tokens ausentes/vencidos/alterados/revocados, padrones congelados, transferidos, enriquecimiento de identidad, carga de consumidores y sintaxis HTML, y añade casos de identidad estable y compatibilidad de notas.

El PR permanece en borrador para revisión. No se modifican tokens, permisos, rutas del backend, escrituras académicas ni reglas de bimestre; no hay merge ni despliegue automático en esta preparación.
