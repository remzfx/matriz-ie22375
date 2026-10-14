# Simplificación docente — propuesta y validación

Base main posterior al PR82: `c6139fd461f7af9ea2c5a3f1268a9c41318acef9`. Frontend únicamente; PR en borrador, sin merge/deploy, Apps Script ni Sheets.

Recuperar Nube es una operación local voluntaria, distinta de Bajar Nube/A1. Lee loadreg protegido, muestra diferencias, exige confirmación, conserva un respaldo persistente con lectura de verificación y vuelve a comprobar versión/contenido remoto, token, permisos, cierre, contexto y firma local. Ante cualquier cambio cancela. Una nube sin registro se rechaza: no equivale a una orden de borrar. La asistencia local compartida entre áreas se conserva durante la recuperación de notas. No hay POST savereg en recuperación.

Guardar local conserva captura/almacenamiento académico y captura transversal sin enviar. Guardar y subir usa las operaciones explícitas existentes, incluidos validación, aportes transversales, conciliación A1 y CAS. Ningún timer sube datos. Los estados distinguen guardado local, pendiente y actualización confirmada; no se anuncia éxito en otro contexto.

Borradores: IndexedDB dedicada; cada registro contiene un snapshot del contexto, base causal y metadatos de recuperación, sin token ni contraseña. Usuario/rol se identifican mediante SHA-256; las notas no se cifran. Se verifica el contenido después de cada transacción. Autoguardado tras 2.5 segundos de inactividad y snapshot periódico cada cinco minutos si hay cambios. Historial hasta siete días y 40 snapshots por usuario/contexto; alta actividad puede reducir el plazo efectivo. La recuperación al reabrir se ofrece mediante comparación y confirmación, nunca se aplica automáticamente. Al restaurar un borrador se recupera su base causal para que A1 siga detectando cambios remotos posteriores. No reemplaza el esquema de almacenamiento existente ni modifica claves oficiales.

Riesgos: almacenamiento del navegador puede fallar, ser expulsado o quedar inaccesible en navegación privada; no se promete protección si el apagón ocurre antes de la escritura confirmada. Los datos locales siguen siendo privados del perfil del navegador, no cifrados frente a quien acceda a ese perfil. Sin almacenamiento verificable no se autoriza reemplazo. La asistencia y los aportes transversales conservan sus reglas y fuentes: los aportes volátiles pendientes no se consideran respaldados por un snapshot académico.

El estado añade una advertencia explícita de conservar la pestaña si existe un aporte transversal pendiente; esos aportes siguen usando su adaptador y CAS actuales. Una caché autorizada permite respaldo local sin red; subir sigue exigiendo verificación del servidor. El cierre institucional bloquea estas nuevas operaciones para Admin y Docente. Una página antigua offline no adquiere funciones nuevas: verificar primero que se recibió el HTML actualizado. Los adaptadores públicos se incluyen inline en HTML (copias comprobadas por tests), sin nuevas dependencias de red ni cambios en Service Worker/CacheStorage privado.

## Guía manual con datos ficticios

1. Entrar con sesión de prueba y seleccionar un área/bimestre abierto. Pulsar Guardar local; verificar estado y que no se realiza savereg ni envío transversal. Crear notas, conclusión C y evidencias ficticias; esperar tres segundos y luego cinco minutos con cambios pendientes.
2. Guardar una versión ficticia en la nube mediante Guardar y subir. Quitar masivo local y pulsar Recuperar Nube. Comparar estudiante/competencia; cancelar primero y comprobar conservación; repetir y confirmar. Verificar respaldo y asistencia local, cero escrituras remotas de recuperación.
3. Crear dos modificaciones diferentes desde sesiones ficticias independientes. Guardar y subir debe exigir la resolución A1 o rechazar CAS, conservando pendientes; ninguna elección masiva automática.
4. Simular cierre después de respaldo confirmado; reabrir sin limpiar almacenamiento. Pulsar Revisar borradores; comparar y cancelar primero, luego confirmar si corresponde. Verificar otras aulas/áreas/bimestres y base causal.
5. Probar lectura 404/offline, nube vacía, permisos retirados, bimestre cerrado, cuota/IndexedDB bloqueado, cambio de contexto y edición mientras está abierto el diálogo. No debe reemplazar datos ni mostrar éxito falso.
6. Revisar pie y diálogo a 390 px y escritorio: Recuperar Nube a la izquierda de Subir Nube, dos filas compactas, scroll interno y espacio inferior que se ajusta a la altura del pie. No se afirma una comprobación visual real en navegador en estas pruebas VM; esa comprobación manual forma parte de revisión del borrador.

Se detectan cambios de almacenamiento de otra pestaña antes de capturar/reemplazar, pero clientes antiguos no coordinan escrituras mediante un lock del navegador. Evitar editar el mismo perfil en pestañas paralelas durante la validación; respaldo y CAS remoto siguen siendo necesarios. No se asegura durabilidad física de IndexedDB frente a un corte durante la transacción: las pruebas simulan reapertura después de commit verificado.

## Resultados locales

`node --test tests/*.test.cjs`: **2174 aprobadas, 0 fallidas, 0 omitidas, 0 TODO**, incluidos 40 casos nuevos del motor y adaptador. Sintaxis: 117 JS/GS, 30 scripts inline; 67 dependencias locales. `git diff --check` sin errores. CI del commit final se registra en el PR en borrador. No se modificaron Apps Script, Service Worker, conciliador A1, matrices, students.js ni módulos transversales existentes.

## Estabilización solicitada por ChatGPT #6179320285

Los resultados anteriores corresponden al HEAD inicial `5d0ee02…`. Esta revisión añade advertencia roja persistente, aviso dentro de ambos diálogos y memoria de las entradas transversales pendientes observadas durante la misma sesión, incluso si se cambia el contexto. No persiste ni modifica esas evidencias: el adaptador transversal conserva su lógica y protección beforeunload. La confirmación nativa al cerrar pertenece al navegador y puede usar un texto genérico; el aviso escolar permanece visible antes de la acción.

Clics inocuos, selección de contexto o impresión no agendan snapshots. Solo entradas académicas y botones de mutación identificados los activan; los botones se contrastan con la firma académica observada. Las capturas de emergencia se serializan y la recuperación espera a que termine la verificación en curso. Si cambia contexto/permiso durante IndexedDB no se aplica reemplazo ni se anuncia éxito en el contexto nuevo. Las comprobaciones de base/local/nube y CAS existentes permanecen intactas.

Pruebas adicionales: lectura verificada fallida/corrupta, escritura fallida, cancelación con estado completo, deshacer desde before-recovery después de reapertura, espera en IndexedDB con cambio de contexto, firma posterior al diálogo, relectura remota, clic inocuo y concurrencia. El diálogo indica qué reemplaza, conserva y cómo deshacer. Su foco inicial queda en el encabezado accesible para evitar que móvil abra desplazado hacia los botones.

**Privacidad:** IndexedDB guarda calificaciones, evidencias y conclusiones **sin cifrado**. El SHA-256 identifica usuario/rol; no cifra las notas ni protege frente a quien controle el perfil del navegador. La retención puede ser menor de siete días por cuota, expulsión o límite de snapshots. En modo privado, tras borrar los datos locales o ante un fallo del dispositivo no existe garantía de recuperación. No limpiar almacenamiento para resolver un conflicto ni confiar en estos respaldos como única copia.

### Inspección real de navegador, separada de las pruebas VM

Se usó el navegador integrado de Codex, a 1280×900 y 390×844, en localhost:8895. La [demostración](demos/recovery-review.html) usa el pie/CSS y los adaptadores actuales con utilidades de distribución equivalentes a las del pie; los contratos académicos se simulan, las notas son ficticias y CSP bloquea conexión a APIs. IndexedDB es real del navegador. La persistencia ficticia de la página usa una clave propia de sessionStorage, sin token/contraseña; no se lee almacenamiento oficial.

- Escritorio: pie 160 px, separación inferior 172 px; última fila a y=727, antes del pie y=740.
- Móvil 390 px: pie 242 px con aviso largo visible, separación inferior 254 px; última fila a y=574, antes del pie y=602. Ancho de documento 375 px útiles por scrollbar: sin desbordamiento de página, tabla con scroll interno.
- Recuperar Nube inmediatamente a la izquierda de Subir Nube; diálogo móvil de 351 px, scroll interno y encabezado visible al abrir (scrollTop=0).
- Cancelar conserva 15; confirmar cambia a 12; recargar conserva 12; Revisar borradores permite devolver 15 y la conclusión previa con el respaldo persistente. Cero llamadas a APIs en la demostración.

Evidencias: [escritorio](demos/recovery-desktop.png), [diálogo móvil](demos/recovery-mobile.png), [última fila y pie móvil](demos/recovery-mobile-footer.png). El generador es `tests/recovery-preview-generator.cjs` y se regenera cuando cambia el pie.

Esto cumple la inspección de la demostración real, **no** prueba una sesión completa autenticada de producción, Safari/iPhone físico, cierre completo del proceso del navegador ni un apagón durante escritura. Esas comprobaciones siguen pendientes de validación autorizada segura. No se han tocado Apps Script/Sheets, transversales ni A1/B1/B2. El PR sigue en borrador y sin autorización de merge/deploy.

Resultado de esta estabilización: **2187 aprobadas, 0 fallidas, 0 omitidas, 0 TODO**; 50 pruebas focalizadas de motor/adaptador y tres pruebas de aislamiento de la demostración. Sintaxis: 120 JS/GS, 30 scripts inline y 73 dependencias locales. `git diff --check` aprobado. CI del HEAD final se consigna en el PR.

Validar solo con datos ficticios: Quitar masivo → Recuperar Nube; cambios pendientes/conflictos A1; nube inexistente/inaccesible; cierre/rol/contexto/token; fallo de cuota/IndexedDB; edición durante diálogo; versión remota cambiada; apagón después de commit confirmado; reapertura/comparación de borradores; alias/IDs, conclusiones y asistencia. Confirmar cero escrituras remotas de timers y recuperación, y CAS en Guardar y subir. Preservar snapshots privados antes de cualquier validación oficial posterior, que requiere autorización separada.
