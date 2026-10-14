# PR #83 · simplificación docente y recuperación segura

El PR permanece en borrador sobre `codex/registro-recovery-drafts`. No se ha autorizado merge ni deploy. Toda validación utiliza datos ficticios; no se modifican Apps Script, Sheets, Service Worker, matrices ni fuentes oficiales.

## Flujo docente

El pie presenta tres acciones principales, en este orden:

- **Recuperar Nube**, rojo suave: reemplazo voluntario del registro académico del contexto seleccionado. Lee la nube protegida, compara, pide confirmación, crea y relee un respaldo IndexedDB y verifica nuevamente la versión remota antes de aplicar. Si falla una protección se cancela. Conserva asistencia local y nunca sube datos.
- **Guardar**, azul: conserva el contrato unificado B1 `guardarRegistroIntegrado()`, incluyendo el envío explícito de aportes transversales conforme a sus reglas. Las calificaciones académicas quedan locales; se informa si están pendientes de subir. Si falla el aporte transversal, permanece pendiente con advertencia de conservar la pestaña.
- **Subir Nube**, verde: reutiliza `subirRegistroNube()` con permisos, cierre, padrón verificado, resolución A1 y versión/CAS. No añade una subida alternativa ni salta comprobaciones.

**Recuperar borrador** solo aparece cuando hay un respaldo diferente recuperable. Integra también el borrador anterior a conciliación; no se elimina esa capacidad. Toda restauración exige comparación, confirmación y nuevo respaldo verificado. No se ofrecen respaldos vacíos como notas recuperables.

## Bajada automática y autorización

Al entrar y cambiar aula, área o bimestre se realiza una lectura protegida mediante la función existente `bajarRegistroNube()`. La página local se pinta antes de esperar a la nube. Se usan el padrón autorizado del mismo token y los permisos de la sesión. Cuando termina de cargar el padrón, una notificación DOM habilita la lectura. Los eventos de selección, sesión, conexión y visibilidad se agrupan con un debounce de 180 ms; no existe un sondeo periódico del adaptador. Sin sesión vigente aparece «Inicia sesión para cargar tus notas» y no se inicia trabajo de nube ni de borradores.

Se añade un modo opcional a las funciones de conciliación existentes; su comportamiento manual predeterminado se conserva. El modo automático utiliza exactamente el plan base/local/nube A1:

- Sin cambios locales, aplica el registro remoto confirmado.
- Con cambios locales compatibles, incorpora únicamente cambios conciliables y conserva pendientes.
- Con cambios concurrentes incompatibles, no elige ni reemplaza notas. Muestra **Hay notas diferentes que necesitan revisión**, con **Revisar diferencias** para abrir la resolución A1 existente. Cancelar conserva ambos candidatos y permite volver a revisar.
- Sin conexión, informa **Sin conexión. Tus notas locales están conservadas**. El evento de conexión restablecida habilita una nueva lectura.

La lectura se deduplica y serializa con las operaciones A1 existentes y la recuperación de emergencia. Cada cambio de contexto tiene una generación: incluso A→B→A descarta la respuesta anterior. Las respuestas con otro token/contexto o cambios posteriores no reemplazan las notas. Volver a un aula inicia una lectura nueva; clics ordinarios no producen consultas duplicadas.

Se detecta un cambio de almacenamiento de otra pestaña antes y después de la lectura. La persistencia local se relee antes de aplicar y después de guardar; un fallo silencioso no permite anunciar **Notas actualizadas**. Los cierres mantienen las acciones de edición bloqueadas. Los históricos conservan su cargador existente de solo lectura, sin una segunda lectura automática paralela. Director utiliza sus permisos de sesión existentes: no se crea el rol `director` ni se concede privilegio adicional.

Ningún timer, bajada, conciliación o recuperación hace una subida académica ni envía aportes transversales. Los envíos requieren pulsar Guardar o Subir Nube según sus contratos existentes. Backend y B2 permanecen intactos.

## Emergencia y límites

Después de 2,5 segundos sin actividad se captura un borrador local. Un temporizador de cinco minutos se arma únicamente tras una edición académica y continúa solo mientras existan cambios; no trabaja durante inactividad sin cambios. La expiración firmada programa una única comprobación al vencer el token, sin alterar su TTL ni autorización. IndexedDB mantiene hasta siete días y aproximadamente 40 respaldos por usuario/rol/contexto, verificando la transacción y relectura. El alcance de usuario usa SHA-256 y no almacena el token. El hash **no cifra** las notas; quien controle el perfil del navegador puede acceder a datos persistidos.

Las notas, evidencias, conclusiones y asistencia académica siguen sus reglas actuales. Los aportes transversales volátiles pendientes **no quedan incluidos** en el respaldo académico: el aviso rojo exige conservar la pestaña. No se elimina su protección de cierre ni se persisten arbitrariamente sus objetos internos.

La cuota, navegación privada, expulsión de almacenamiento, borrado del perfil o fallo físico pueden impedir recuperación. No se garantiza protección antes de confirmar una escritura ni durante un corte a mitad de transacción. La retención puede ser menor por cuota o límite de respaldos. No borrar almacenamiento para resolver conflictos.

Los clientes antiguos del mismo navegador no coordinan escrituras mediante un lock compartido. Se detecta el desvío observado y se cancela; evitar editar el mismo perfil en pestañas paralelas durante la validación. La lectura usa el transporte protegido académico existente; si ese contrato no responde se conserva el registro local, sin modificar timeouts, backend ni deployment.

## Validación con GitHub Desktop y Live Server

1. En GitHub Desktop seleccionar `matriz-ie22375`, Fetch origin y la rama existente `codex/registro-recovery-drafts`. Verificar el HEAD indicado en el PR. No fusionar con main ni publicar Pages.
2. Abrir el repositorio en VS Code. Abrir `docs/demos/recovery-review.html` con Live Server. No abrir `registro.html` con una sesión oficial para esta demostración.
3. La demostración contiene datos ficticios, el pie/CSS y los adaptadores reales, con contratos académicos simulados. CSP `connect-src 'none'` bloquea APIs; usa persistencia de prueba aislada y el IndexedDB local. No valida autenticación ni transporte de producción.
4. Verificar a escritorio y 390 px: Recuperar Nube → Guardar → Subir Nube, controles de al menos 44 px, tabla con scroll interno y última fila por encima del pie. Los botones secundarios solo aparecen si procede.
5. En Recuperar Nube comparar 15 local / 12 remoto y conclusiones ficticias. Cancelar conserva 15; confirmar cambia a 12. Recargar con el mismo viewport conserva 12. Recuperar borrador permite volver a 15 y a la conclusión anterior tras confirmar. El perfil ficticio cambia entre escritorio/móvil: recargar después de cambiar tamaño para mantener consistente la prueba.
6. La bajada automática y los conflictos se validan además con las regresiones VM que ejecutan las funciones A1/B1 reales y un servidor sintético. Probar permisos, contextos, nube vacía/offline, dos dispositivos, cambios pendientes, cuota, bimestre cerrado, históricos, respuesta tardía y cero subidas automáticas mediante esas pruebas.
7. No utilizar notas oficiales para ensayar reemplazos. Una validación posterior autenticada exige un entorno autorizado de prueba; no ingresar credenciales oficiales en la demostración. No vaciar almacenamiento oficial ni reemplazar datos reales.

## Evidencia y verificaciones

Se inspeccionó el navegador integrado mediante computer-use a 1280×900 y 390×844. Tres acciones horizontales, sin desbordamiento de página; la tabla mantiene scroll interno. Con advertencia transversal, el pie móvil mide 257 px: última fila a y=559, pie desde y=587. El diálogo conserva encabezado visible y scroll interno. Se comprobó cancelar, confirmar, recargar y deshacer con IndexedDB real y datos ficticios.

Capturas: [PC](demos/recovery-desktop.png), [diálogo móvil](demos/recovery-mobile.png), [pie móvil](demos/recovery-mobile-footer.png). Se regenera la demostración con `node tests/recovery-preview-generator.cjs`.

Las pruebas históricas se ajustan únicamente para los botones autorizados y las opciones frontend de bajada automática/persistencia. El normalizador exige el cuerpo exacto esperado; una modificación académica adicional provoca fallo. Los cálculos, datos almacenados, CAS, módulos A1/B1/B2 y backend conservan sus regresiones funcionales.

Quedan pendientes una sesión autenticada de prueba completa, Safari/iPhone físico y cortes reales durante escrituras. Estas pruebas visuales no equivalen a validación de producción. Resultados finales y enlace del CI se consignan en el PR.

Resultado anterior, HEAD d3d4412: **2216 aprobadas, 0 fallidas, 0 omitidas, 0 TODO**. Incluye 29 regresiones nuevas de bajada automática, concurrencia, persistencia y pie estable. Sintaxis: **121 archivos JS/GS, 30 scripts inline y 73 dependencias locales**. Las comprobaciones git diff --check y git diff --cached --check pasan. El CI del HEAD final se enlaza en el PR #83 en borrador.

## Auditoría de rendimiento #6180460999

Se elimina el sondeo de cinco segundos del adaptador. Sin sesión vigente se muestra **Inicia sesión para cargar tus notas**; ninguna tarea de nube/borradores se inicia. Las consultas comienzan solo con sesión y padrón autorizados. La notificación `ie22375:registro-ready` únicamente comunica disponibilidad desde la sincronización visual existente; no cambia permisos, cálculos ni guardados. Los eventos de selección, sesión/storage, online, foco y visibilidad usan un debounce de 180 ms. Una lectura lenta conserva una única operación; al terminar atiende el último contexto pendiente y descarta la respuesta antigua.

La disponibilidad de borradores se memoiza por usuario/contexto/generación/revisión, incluyendo resultados negativos y consultas concurrentes. Se invalida tras cambios académicos, respaldo confirmado, conciliación/recuperación, sesión/contexto o almacenamiento relevante. Los hashes de usuario/rol se reutilizan en memoria; no incluyen el token. El vencimiento de los respaldos limita la vigencia de la revisión almacenada. No hay watchdog periódico nuevo. El timer de cinco minutos se arma solo tras editar; la expiración del token programa una única comprobación, sin cambiar HMAC/TTL.

### Evidencia reproducible antes/después

Ejecutar `node tests/registro-recovery-performance.cjs`. [Resultado JSON](demos/registro-recovery-performance.json), referencia anterior **d3d4412f48d7ef86b0f3deb076d6b591c192c155**, datos ficticios de 30/40 estudiantes y cinco competencias. Reloj simulado y transporte/IndexedDB ficticios; se ejecutan el adaptador y las funciones reales de A1/B1. Cuenta llamadas a JSON.stringify (incluye valores individuales; no equivale a serializar toda la base), requests protegidos, transacciones IndexedDB, hashes, llamados al render conciliado y escrituras del estado visible. El tiempo simulado evita resultados dependientes de red/hardware. No se pretende medir el costo de otros módulos, render completo de producción ni latencia real de Apps Script.

| Escenario / contador | Antes, 30 alumnos | Después, 30 | Antes, 40 alumnos | Después, 40 |
| --- | ---: | ---: | ---: | ---: |
| Primera carga: lecturas protegidas | 1 | 1 | 1 | 1 |
| Primera carga: serializaciones | 8423 | 9025 | 11223 | 12025 |
| Un minuto inactivo: serializaciones | 7224 | 0 | 9624 | 0 |
| Un minuto inactivo: transacciones IndexedDB | 12 | 0 | 12 | 0 |
| Un minuto inactivo: hashes | 12 | 0 | 12 | 0 |
| Un minuto inactivo: escrituras de estado | 12 | 0 | 12 | 0 |
| Cambio de aula: lecturas protegidas | 1 | 1 | 1 | 1 |
| Red lenta durante un minuto: lecturas protegidas | 1 | 1 | 1 | 1 |
| Sesión vencida: transacciones IndexedDB por minuto | 12 | 0 | 12 | 0 |
| Escrituras académicas remotas automáticas, todos los casos | 0 | 0 | 0 | 0 |

La primera carga adelanta una revisión de borradores que antes empezaba a los cinco segundos: suma 602/802 serializaciones, una transacción y un hash, sin bloquear la pintura local. Ese costo único sustituye las revisiones repetidas: **el total de serializaciones de la primera carga más un minuto inactivo disminuye aproximadamente 42,3 %**. No se presenta como una reducción de latencia real del backend. Durante un minuto idle/offline, el adaptador nuevo tiene cero requests, transacciones, hashes, serializaciones, renders y escrituras de estado.

Presupuestos automatizados: primera carga/cambio <=1 lectura protegida, <=1 transacción de revisión, <=1 hash, <=1 render conciliado, <=2 escrituras de estado y <=310×alumnos+100 serializaciones. Idle/offline sin cambios: todos los contadores en cero. Sesión ausente/vencida: cero trabajo de nube/borradores y un solo aviso. Red lenta: una lectura, cero renders mientras está pendiente y ninguna consulta periódica. Ediciones conservan respaldo debounced/periodicidad de emergencia y todas las verificaciones A1/CAS.

Las regresiones cubren debounce, recuperación/no pérdida, cierre/permisos, CAS, almacenamiento fallido, memoización invalidada por cambios reales, respuesta lenta con cambio de aula, expiración durante lectura y ausencia de subidas automáticas. La suite anterior que coincidió con una escritura de fuente se repite con archivos estables; no se oculta ni elimina la prueba de recuperación.

En Live Server abrir `docs/demos/recovery-preview.html?session=absent` para comprobar el estado sin autenticación (parámetro de demostración sin credenciales). [Captura móvil sin sesión](demos/recovery-session-absent.png). La demostración con sesión ficticia conserva los tres botones, comparación y cancelación; CSP bloquea las APIs. No usar sesiones oficiales para validar reemplazos. Permanecen pendientes Safari/iPhone físico y el transporte real en un entorno autorizado de prueba.

Resultado de la auditoría de rendimiento: **2228 aprobadas, 0 fallidas, 0 canceladas, 0 omitidas, 0 TODO**. Incluye 12 nuevas regresiones de rendimiento/eventos/expiración, además de todas las protecciones funcionales previas. Sintaxis: **123 JS/GS, 30 scripts inline y 73 dependencias locales**. git diff --check y git diff --cached --check pasan. El CI del nuevo HEAD se enlaza en el PR #83, que permanece en borrador.

## Corrección acotada del comentario #6180807049: EPT vacío

Referencia revisada: **39845b6af3e36565815c782995dee85d33e2dcb1**. No se inspeccionaron notas oficiales ni almacenamiento real del usuario; 0/30 finales visibles no permite atribuir la captura a una causa concreta. La reproducción usa Secundaria 1.º A / III / Educación para el Trabajo (EPT), la competencia real del catálogo, accessors reales de aliases/metadata y transporte ficticio.

Resultados demostrados:

| Caso ficticio | Plan A1 | Lectura remota | Comportamiento anterior | Corrección |
| --- | --- | --- | --- | --- |
| Local/remoto académicos vacíos, incluso con baseline histórico | 0 conflictos | Confirmada | Sin conflicto; mensaje genérico | Sin notas registradas, sin resolución |
| Escritura local seguida de baseline aún solo en memoria | 0 conflictos | No iniciada, bloqueo diskSafe | Hay notas diferentes… | Aviso de guardado local no verificable, sin resolución |
| Botón viejo visible y una lectura/resolución fallida sin resultado | 0 conflictos del caso actual | Sin prueba actual de conflicto | Reutilizaba la visibilidad como prueba | Oculta el botón; no inventa conflicto ni vacío |
| Resultado de otra área/token o con cero paths | No acredita conflicto actual | No válida para ese contexto | Aceptaba estado global | Rechazado por clave, token y cantidad real de conflictos |
| Tombstone local frente a nota remota editada | Conflicto real | Confirmada | Bloqueo A1 correcto | Se conserva el bloqueo y ambos candidatos |

La corrección está en la clasificación del pie. `bajarRegistroNube.resultado` comunica únicamente la cantidad real de conflictos y el contexto/token ya existentes; cancelar una revisión cuyo borrador cambió produce estado pendiente. No se modifica `registro-reconcile.js`, su plan causal ni la resolución de notas. No se normalizan ni eliminan tombstones. Los fallos de almacenamiento siguen cancelando sin alterar datos; **no** se relajó `diskSafe()` para hacer pasar una lectura.

«Sin notas registradas» requiere conciliación confirmada del contexto/token y ausencia de datos académicos tanto en el payload actual como en el remoto verificado. Evidencias, sesiones, conclusiones, selección/estado de competencias y tombstones impiden tratarlo como vacío inocuo. Una eliminación física local pendiente frente a una nota aún remota continúa como **Cambios pendientes de subir**. Una diferencia real de asistencia compartida también exige revisión aunque no existan finales.

`tests/registro-empty-ept.test.cjs` contiene reproducciones ejecutadas contra el adaptador del SHA revisado y regresiones de vacíos/baselines/aliases, fallo de almacenamiento, resultados viejos, respuesta atrasada, edición durante cancelación, tombstones, borrado pendiente, evidencias/conclusiones/sesiones y asistencia. Todo usa datos ficticios; cero escrituras académicas remotas.

[Comparación de rendimiento contra el HEAD revisado](demos/registro-empty-ept-performance.json): para 30/40 alumnos y cinco competencias, se mantienen exactamente los contadores anteriores en carga, cambio de aula, minuto idle, offline, red lenta y sesión vencida. Para 40: 12025 serializaciones de primera carga, 3223 al cambiar aula; minuto idle con cero requests/IndexedDB/hashes/serializaciones/renders/escrituras de estado. No se añade polling ni otra petición. Las regresiones de presupuestos originales también se ejecutan.

Se conservan los tres botones, A1/B1/B2, versiones/CAS, permisos, cierres, notas, conclusiones, asistencia, recuperación y rendimiento. Sin cambios en Apps Script/Sheets, Service Worker, students.js ni módulos transversales. PR #83 continúa en borrador, sin merge ni deploy. La captura original necesita diagnóstico autorizado separado si se quiere identificar cuál variante ocurrió en esa sesión real.

Resultado final de esta corrección: **2254 aprobadas, 0 fallidas, 0 canceladas, 0 omitidas, 0 TODO**, incluidas 26 regresiones nuevas de EPT. Sintaxis: **124 JS/GS, 30 scripts inline, 73 dependencias locales**. git diff --check y git diff --cached --check pasan. El CI del HEAD final se enlaza en el mismo PR #83 en borrador.
