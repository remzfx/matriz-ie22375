# PR #111 — auditoría final pre-merge

Fecha: 23 de octubre de 2026. SHA inicial auditado: `514e4c865bf95ef43c61708bfe72d9136fdae9a3`. El SHA final es el commit que contiene este informe, publicado en el mismo PR DRAFT. Dictamen técnico local: **APTO PARA MERGE**, sujeto a CI satisfactorio de ese mismo commit y revisión independiente. **No autoriza despliegue ni eliminación.**

## Hallazgos reproducidos y corregidos

| Criticidad | Hallazgo en el SHA inicial | Corrección y evidencia |
| --- | --- | --- |
| Alta | `Estados` no estaba clasificada: podían sobrevivir conteos académicos derivados. | `academicResetLegacyMatrix_` valida su esquema institucional de tres columnas y siete campos JSON; solo sustituye `datos` por `{}`. Contexto, docente y matrícula permanecen iguales. Campos/estructuras desconocidos detienen el plan. Una prueba del plan y ejecutor reales demuestra el saneamiento limitado. |
| Alta | Un historial/campo descartado o un fragmento transversal podía contener asistencia sin inspeccionar. | `discardable` y `academicResetTransversalPayloads_` detectan asistencia anidada/serializada y reconstruyen bloques antes de descartar. Asistencia encontrada implica aborto antes del batch. Las tres marcas de asistencia y sus versiones confirmadas se conservan; nunca se reubican automáticamente. |
| Alta | Hojas con nombres no académicos y encabezados parcialmente conocidos podían pasar el inventario. | Lista explícita de hojas conocidas; cualquier otra detiene la preparación. Encabezados completos y columnas adicionales se validan en matrices/historiales/transversales. Se conservan intactas PRIMARIA/SECUNDARIA con sus esquemas vacíos exactos. |
| Media | Versiones N2 fuera de rango, metadatos de confirmación desconocidos e historial con checksum alterado no se rechazaban siempre. | Validación de esquema/paneles/versiones/fechas, límite seguro de la versión nueva y verificación de SHA-256/ID del bloque histórico. Datos corruptos detienen el plan; no se convierten en un reinicio aparentemente válido. |

Las reproducciones añadidas antes de corregir mostraron 13 fallos en el ejecutor, cinco de asistencia anidada en el modelo y tres de metadatos desconocidos. Los casos adicionales de checksum/columnas y los caminos permitidos permanecen cubiertos. Se actualizaron solo fixtures esquemáticos para utilizar los encabezados/schema:1 reales; no se eliminaron aserciones de seguridad.

## Archivos de producción revisados (14)

| Archivos | Funciones / conclusión |
| --- | --- |
| `academic-reset.js`, `apps-script/AcademicResetModel.js` | `clean`, `discardable`, `registration`, `local`, `localKey`. Misma implementación cliente/GAS. Eliminación de campos conocidos, conservación opaca de asistencia y aborto si hay asistencia dentro de datos descartables. |
| `apps-script/AcademicReset.js` | Snapshot, clasificación, plan, huellas, archivos Drive, propietario, preparación, ejecución y reanudación. El plan es puro respecto de persistencia. Solo H:I de RegistroNotas, J de EstadosAreas y C de Estados legado; hojas de calificaciones puras conservan encabezados. No hay `deleteSheet`, borrado de filas ni nueva copia de notas descartadas. |
| `apps-script/Codigo.js`, `apps-script/Notas2.js` | `academicResetState_`, `academicResetGuard_`, `academicResetRead_`, `doPost`, `transversalesRuta_`, `notas2Ruta_` y bridge. Barrera bajo ScriptLock en todos los escritores académicos. Savereg legacy queda bloqueado incluso con generación nueva; falta/generación anterior/fase blocked se rechaza. Panel asistencia mantiene validación, CAS y cierres propios. |
| `academic-reset-client.js` | `install/ensure/accept/fetch`, saneamiento Storage e IndexedDB. Una generación autenticada nueva exige saneamiento y recarga; nunca se reenvía la escritura capturada. Descargas/navegación no crean guardados. Pestañas antiguas no certifican sus datos como generación nueva. |
| `registro-drafts.js`, `registro.html` | Borradores etiquetados/filtrados por generación, carga previa del control, contexto académico inicial. La copia inline y el módulo conservan equivalencia. Sin cambios a cálculos, notas o asistencia fuera del reinicio autorizado. |
| `primaria.html`, `secundaria.html`, `admin.html` | Carga de los dos módulos antes de lectores/almacenamiento; matrices inician generación del cliente. No se retiran controles, currículo, usuarios, asignaciones ni cierres. |
| `transversales-client.js`, `transversales.html` | Bridge conserva token/ruta y comprueba generación antes de operar; fallback fetch pasa por la misma barrera. Borradores en memoria se invalidan por recarga, no se suben automáticamente. |
| `sw.js` | v26 añade ambos recursos y conserva todo el precache anterior. Sin cambios de network-first, TTL, MIME o exclusión de respuestas privadas. Solo CacheStorage estático versionado; no borra perfiles, Storage ni bases de usuarios. |

Registro Oficial y el importador real se probaron como lectores de payload saneado: no pueden derivar notas anteriores. Las rutas de matrices, transversales y Notas 2.0 comparten la generación; GET/bridge no ofrecen ejecución administrativa. Las funciones de limpieza terminan en `_`, son privadas para `google.script.run` y no están despachadas por doGet/doPost. No hay invocaciones desde HTML, inicialización ni workflows. El workflow de Apps Script solo se inicia manualmente y publica código; no invoca limpieza.

## Integridad y reanudación

- Preparar exige propietario y solo lee: no crea control, hojas, archivos, copias ni respaldos. Devuelve códigos/conteos/huellas, no datos individuales.
- Ejecutar vuelve a comprobar propietario, confirmación, inventario y archivos bajo ScriptLock. Una única transacción de Sheets incluye el marcador `blocked` y los cambios académicos; asistencia no se toma del cliente.
- Mientras esté `blocked`, se rechazan escritores académicos; asistencia sigue su protocolo independiente. Una interrupción o respuesta perdida no genera reintentos automáticos.
- Reanudar explícitamente la misma operación verifica huellas y solo termina archivos pendientes, sin repetir la eliminación de Sheets. Si cambia asistencia/protegidos o un archivo, queda bloqueado para revisión.
- En `complete`, repetir la misma aprobación es no-op, incluso si ya se registraron notas nuevas. No se abre ningún bimestre.
- Nuevas notas siguen requiriendo autorización, identidad, generación y CAS; los tests verifican un guardado válido y rechazo de la misma versión repetida.

## Inventario real observado y límites

Metadata institucional: 13 hojas; todas están contempladas. PRIMARIA/SECUNDARIA ya se habían leído completas, solo encabezados. En esta auditoría se consultó `Estados!A1:Z1` y `Estados!A1:Z1000` en modo FORMULA, sin escrituras: una fila de estado legado, estructura de conteos por aula/área/competencia. Solo se publican esquema y clasificación, nunca valores/personas. Hojas adicionales desconocidas, asistencia embebida, columnas nuevas, bloques incompletos o archivos no verificables abortan el dry-run.

Archivos conocidos: referencias `externalDriveBackup` y nombre `RESPALDO_HISTORICO_22375_`, verificados por contexto y huella antes de sanearlos en el mismo archivo. No se inspeccionó ni certificó la totalidad de Drive real: ese inventario corresponde al dry-run del propietario. Exportaciones ajenas, revisiones de Google Drive y despliegues antiguos no pueden declararse eliminados por estas pruebas.

## Validación de este cierre

- Pruebas focalizadas: **105 aprobadas / 0 fallidas / 0 omitidas**.
- Suite completa: **2.898 aprobadas / 0 fallidas / 0 omitidas**.
- Sintaxis/dependencias: **198 JS/GS, 36 scripts inline, 89 dependencias**.
- `git diff --check`: satisfactorio.
- Edge headless real: **8/8**, 1366 y 390 px, perfiles temporales y red externa bloqueada. Ejecuta scripts actuales y Storage real con respuestas ficticias; no es una prueba real de Google Sheets ni certificación de toda la interfaz.
- Los tests usan funciones reales de producción y Sheets/Drive/Lock/IDB simulados según el caso. No se ejecutaron guardados, recuperación ni limpieza en servicios reales.
- GitHub Actions debe verificarse para el HEAD final antes de emitir el cierre definitivo; no se reutiliza como prueba el CI del SHA inicial.

## Riesgos operativos y comprobaciones posteriores (no ejecutadas)

1. **Alta, condición de ejecución:** retirar todas las versiones de Web App o herramientas externas que puedan escribir sin la barrera. Un código antiguo desplegado independientemente no se vuelve seguro al fusionar este PR.
2. **Alta, condición de ejecución:** mantenimiento sin ediciones manuales de Sheets ni escritores externos. ScriptLock coordina este proyecto, no a personas/API externas; una lectura y un batch no son CAS global de Google Sheets.
3. **Media:** propietario efectivo y activo deben coincidir con propietario de Spreadsheet. Compartidas sin propietario individual fallan de forma controlada. Verificar autorización Sheets/Drive/UrlFetchApp/ScriptApp y disponibilidad de Google Sheets API; no se ha certificado OAuth real ni se cambiaron permisos. El manifiesto usa inferencia de scopes y solo declara Classroom avanzado; el batch REST no depende del servicio avanzado Sheets.
4. **Media:** verificar despliegue coordinado backend/frontend/SW y dry-run real del propietario. Cualquier fuente nueva cambia el inventario y requiere revisión antes de autorizar la ejecución.
5. **Media:** perfiles cerrados conservan datos físicos hasta abrir el cliente nuevo; el servidor actualizado rechaza sus escrituras antiguas. Revisiones del proveedor/archivos externos requieren gestión separada, sin crear fuentes alternativas de calificaciones.
6. No existe recuperación automática después de la eliminación autorizada. Antes de ejecutar puede revertirse el PR; después no debe retirarse la barrera ni volver a escritores anteriores. Ante fallo, mantener `blocked` y corregir hacia adelante conservando asistencia.

**Separación obligatoria:** auditoría Codex → revisión ChatGPT → autorización de merge → merge → deploy por responsable → dry-run real → autorización independiente para eliminar. PR DRAFT; sin merge, deploy ni limpieza real durante esta auditoría.
