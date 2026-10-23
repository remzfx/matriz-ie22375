# Corrección posterior a #111: Sheets API en GCP predeterminado

## Diagnóstico y decisión

El responsable informa que el inventario de `prepararLimpiezaCalificaciones_()` terminó correctamente, pero una llamada REST de solo lectura devolvió HTTP 403 `PERMISSION_DENIED` por Sheets API deshabilitada/no utilizada. La preparación de #111 utilizaba SpreadsheetApp/Drive; no comprobaba el servicio REST que luego necesitaba la ejecución. Por ello, inventario correcto no equivalía a disponibilidad de la API. El manifiesto anterior solo declaraba Classroom.

El rechazo `resourcemanager.projects.get` de Cloud Console es compatible con las restricciones normales de acceso a proyectos GCP predeterminados; no demuestra falta de permisos sobre el Spreadsheet. No se ha accedido ni modificado la configuración real del proyecto en esta investigación.

Google documenta que, en un proyecto predeterminado, **añadir un servicio avanzado en Apps Script y guardar habilita automáticamente su API**. La habilitación manual desde Cloud Console corresponde a proyectos estándar. No se necesita cambiar de proyecto, crear un cliente OAuth, sustituir cuentas, copiar tokens ni generar claves.

Fuentes oficiales consultadas:

- [Servicios avanzados: habilitación por editor/manifiesto y API automática en proyecto predeterminado](https://developers.google.com/apps-script/guides/services/advanced).
- [Proyectos Cloud: acceso limitado y administración del predeterminado por Apps Script](https://developers.google.com/apps-script/guides/cloud-platform-projects).
- [Servicio avanzado de Sheets: mismo protocolo y objetos de la API v4](https://developers.google.com/apps-script/advanced/sheets).
- [spreadsheets.batchUpdate: todas las peticiones se aplican juntas; petición inválida invalida el conjunto](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate).
- [SpreadsheetApp.flush: aplica cambios pendientes; no documenta rollback transaccional](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#flush()).

## Solución preparada

1. Declarar `Sheets / v4 / sheets` en `dependencies.enabledAdvancedServices`, conservando Classroom y todas las demás opciones del manifiesto. No se modifica la asociación GCP ni se añaden credenciales/scopes explícitos.
2. Añadir `verificarServicioLimpiezaCalificaciones_()`, privada y solo para el propietario. Comprueba namespace, métodos y acceso al Spreadsheet mediante `Sheets.Spreadsheets.get(id,{fields:'spreadsheetId'})`. No consulta celdas, títulos ni nombres. Devuelve exclusivamente `{ok:true, mode:'read-only', service:'Sheets v4'}`; no expone ID, token o error remoto completo.
3. Preparar y la primera ejecución comprueban ese acceso antes de continuar. No hay validación mediante un batch vacío: incluso el preflight es una lectura estricta.
4. Cambiar exclusivamente el transporte de la transacción a `Sheets.Spreadsheets.batchUpdate({requests}, id)`. Se mantiene el mismo plan, ScriptLock, generación, marcador `blocked`, manifiesto de huellas, validación de asistencia y CAS. No se llama a `UrlFetchApp` ni `ScriptApp.getOAuthToken` para limpiar.
5. Una excepción o respuesta no verificable detiene la ejecución, sin reenvío desde el código. No se intenta una alternativa de escritura. El responsable debe consultar primero el marcador antes de reanudar.

El servicio avanzado es un wrapper de la misma Sheets API, **no una API distinta que eluda una prohibición institucional**. La habilitación corrige la dependencia; una política administrativa o denegación OAuth real puede seguir bloqueándola y debe investigarse sin cambiar credenciales/GCP.

## Alternativa nativa evaluada

No se implementa una sustitución con `SpreadsheetApp.setValue/setValues/clearContent` sucesivos. ScriptLock coordina ejecuciones del proyecto, pero no vuelve atómicas varias escrituras; `flush()` tampoco añade rollback. Un corte podría dejar filas saneadas sin marcador o un estado parcial difícil de certificar.

Una alternativa exclusivamente nativa exigiría diseñar otro protocolo persistente de preparación/roll-forward con un bloqueo previo verificable para todos los escritores y comprobación por unidad antes/después, incluyendo asistencia compartida en JSON y concurrencia. No sería equivalente por limitarse a un try/catch y no es necesaria si puede habilitarse el batch existente. No se prepara una migración ni un historial alternativo de notas descartadas.

## Procedimiento posterior para el responsable — NO ejecutado

1. Esperar revisión/autorización de este correctivo. Mantener la asociación GCP predeterminada y el Spreadsheet actual; no crear otro proyecto o archivo.
2. En el editor del Apps Script **existente y vinculado**, comprobar Servicios → Google Sheets API, versión v4, identificador `Sheets`. Si falta, añadirla; si está declarada, no duplicarla. Conservar Classroom. Guardar el proyecto/manifiesto revisado. Esta es una modificación de configuración que realizará el responsable, no el agente.
3. Autorizar con la misma cuenta propietaria mediante el flujo normal de Apps Script si Google lo solicita. No compartir ni pegar contraseñas, claves, tokens o códigos en logs. Si el consentimiento es bloqueado por la organización, detenerse y solicitar soporte administrativo; no elevar IAM ni migrar GCP.
4. Ejecutar **solo** `verificarServicioLimpiezaCalificaciones_()` desde el editor. Resultado esperado: resumen `ok:true / read-only / Sheets v4`. No ejecuta limpieza ni crea control. Si continúa 403, detenerse; revisar que el servicio se añadió al proyecto vinculado correcto y que se guardó. No llamar al ejecutor para comprobar permisos.
5. Ejecutar un **nuevo dry-run** `prepararLimpiezaCalificaciones_()` y revisar inventario/huellas/clasificaciones. La lectura de metadatos confirma habilitación y acceso de lectura; no demuestra autorización efectiva de escritura ni disponibilidad futura. No se realizará una escritura de prueba en el Spreadsheet real para certificarla.
6. Detenerse y obtener la autorización independiente de eliminación. Antes de cualquier ejecución deben seguir cumplidos los requisitos de #111: backend con barrera de generación efectivamente desplegado, frontend coherente, mantenimiento, retiro de escritores viejos y ausencia de ediciones externas. Una comprobación del editor no certifica la versión del Web App publicado.

Añadir el servicio al proyecto predeterminado también puede habilitar el REST anterior; no se atribuye a ese camino una transacción distinta. El correctivo usa el wrapper oficial para declarar claramente la dependencia y evitar manejo manual de OAuth.

## Fallos y recuperación

| Momento | Comportamiento / recuperación explícita |
| --- | --- |
| Falta el servicio, API deshabilitada, 403 o lectura inválida | Sin batch, sin marcador nuevo y sin cambios en archivos. Corregir habilitación/autorización antes de otro dry-run. |
| API deja de estar disponible tras preparar | Primera ejecución vuelve a verificar y se detiene antes de escribir. |
| El batch se rechaza antes del commit | No se sanean archivos ni se ejecutan escrituras nativas alternativas; consultar control y volver a preparar únicamente tras revisar el fallo. |
| Corte antes o después del commit / respuesta perdida o inválida | No reintentar automáticamente. Comprobar control: ausente implica revisar/repreparar; `blocked` permite reanudación explícita con la misma aprobación. Esta reanudación no vuelve a enviar el batch de Sheets. |
| Fallo en archivos después de commit | Permanece `blocked`; huellas identifican archivos ya saneados. La reanudación solo termina pendientes y compara asistencia/protegidos; no depende de volver a ejecutar Sheets API. |
| Operación `complete` repetida | No-op: no borra calificaciones nuevas. |

La atomicidad cubre el batch de Sheets, no Drive ni ediciones humanas externas. La fase `blocked` y las huellas siguen coordinando esa segunda etapa; no se introduce una transacción distribuida ficticia ni se eliminan protecciones ante asistencia concurrente. No se crean copias de las notas descartadas.

## Validación y límites

Las pruebas ejecutan el procedimiento real con Sheets avanzado/Drive/Lock simulados. Reproducen ausencia del servicio, 403, respuesta de lectura equivocada, propietario inválido, batch rechazado, respuesta perdida/inválida tras commit, interrupciones de archivos, reanudación, CAS, asistencia y repetición después de notas nuevas. El simulador prohíbe transporte REST y extracción manual de OAuth, para detectar fallbacks accidentales. El test del manifiesto comprueba que todo salvo la nueva dependencia permanece idéntico.

No se ha habilitado el servicio real, migrado GCP, modificado credenciales, realizado llamadas de prueba al backend real, ejecutado limpieza ni desplegado. La eficacia de la habilitación en el proyecto del responsable sigue pendiente de la comprobación de lectura indicada; la documentación oficial respalda el mecanismo, no una certificación de esa configuración particular.

Reversión previa a ejecutar: revertir solo este correctivo; la limpieza seguirá bloqueada si no hay API. Después de una operación iniciada, no retirar la barrera de #111 ni iniciar un segundo reinicio. Mantener `blocked` y reanudar/corregir hacia adelante según el control. No existe rollback automático de las calificaciones eliminadas por decisión del responsable.

Resultados locales del correctivo: **2.906 aprobadas, 0 fallidas, 0 omitidas**; **113 pruebas focalizadas**, ocho añadidas para disponibilidad/transporte del servicio. Sintaxis: 198 archivos JS/GS y 36 scripts inline; 89 dependencias locales válidas. `git diff --check` satisfactorio. CI se verifica por separado sobre el HEAD publicado. No se repitieron pruebas visuales porque el frontend y Service Worker permanecen idénticos a main.
