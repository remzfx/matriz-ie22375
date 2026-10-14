# PR #83 · simplificación docente y recuperación segura

El PR permanece en borrador sobre `codex/registro-recovery-drafts`. No se ha autorizado merge ni deploy. Toda validación utiliza datos ficticios; no se modifican Apps Script, Sheets, Service Worker, matrices ni fuentes oficiales.

## Flujo docente

El pie presenta tres acciones principales, en este orden:

- **Recuperar Nube**, rojo suave: reemplazo voluntario del registro académico del contexto seleccionado. Lee la nube protegida, compara, pide confirmación, crea y relee un respaldo IndexedDB y verifica nuevamente la versión remota antes de aplicar. Si falla una protección se cancela. Conserva asistencia local y nunca sube datos.
- **Guardar**, azul: conserva el contrato unificado B1 `guardarRegistroIntegrado()`, incluyendo el envío explícito de aportes transversales conforme a sus reglas. Las calificaciones académicas quedan locales; se informa si están pendientes de subir. Si falla el aporte transversal, permanece pendiente con advertencia de conservar la pestaña.
- **Subir Nube**, verde: reutiliza `subirRegistroNube()` con permisos, cierre, padrón verificado, resolución A1 y versión/CAS. No añade una subida alternativa ni salta comprobaciones.

**Recuperar borrador** solo aparece cuando hay un respaldo diferente recuperable. Integra también el borrador anterior a conciliación; no se elimina esa capacidad. Toda restauración exige comparación, confirmación y nuevo respaldo verificado. No se ofrecen respaldos vacíos como notas recuperables.

## Bajada automática y autorización

Al entrar y cambiar aula, área o bimestre se realiza una lectura protegida mediante la función existente `bajarRegistroNube()`. La página local se pinta antes de esperar a la nube. Se usan el padrón autorizado del mismo token y los permisos de la sesión. Cuando termina de cargar el padrón, la detección periódica permite iniciar la lectura; no consulta la nube cada cinco segundos.

Se añade un modo opcional a las funciones de conciliación existentes; su comportamiento manual predeterminado se conserva. El modo automático utiliza exactamente el plan base/local/nube A1:

- Sin cambios locales, aplica el registro remoto confirmado.
- Con cambios locales compatibles, incorpora únicamente cambios conciliables y conserva pendientes.
- Con cambios concurrentes incompatibles, no elige ni reemplaza notas. Muestra **Hay notas diferentes que necesitan revisión**, con **Revisar diferencias** para abrir la resolución A1 existente. Cancelar conserva ambos candidatos y permite volver a revisar.
- Sin conexión, informa **Sin conexión. Tus notas locales están conservadas**. El evento de conexión restablecida habilita una nueva lectura.

La lectura se deduplica y serializa con las operaciones A1 existentes y la recuperación de emergencia. Cada cambio de contexto tiene una generación: incluso A→B→A descarta la respuesta anterior. Las respuestas con otro token/contexto o cambios posteriores no reemplazan las notas. Volver a un aula inicia una lectura nueva; clics ordinarios no producen consultas duplicadas.

Se detecta un cambio de almacenamiento de otra pestaña antes y después de la lectura. La persistencia local se relee antes de aplicar y después de guardar; un fallo silencioso no permite anunciar **Notas actualizadas**. Los cierres mantienen las acciones de edición bloqueadas. Los históricos conservan su cargador existente de solo lectura, sin una segunda lectura automática paralela. Director utiliza sus permisos de sesión existentes: no se crea el rol `director` ni se concede privilegio adicional.

Ningún timer, bajada, conciliación o recuperación hace una subida académica ni envía aportes transversales. Los envíos requieren pulsar Guardar o Subir Nube según sus contratos existentes. Backend y B2 permanecen intactos.

## Emergencia y límites

Después de 2,5 segundos sin actividad se captura un borrador local; cada cinco minutos con cambios hay respaldo periódico. IndexedDB mantiene hasta siete días y aproximadamente 40 respaldos por usuario/rol/contexto, verificando la transacción y relectura. El alcance de usuario usa SHA-256 y no almacena el token. El hash **no cifra** las notas; quien controle el perfil del navegador puede acceder a datos persistidos.

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

Resultado final local: **2216 aprobadas, 0 fallidas, 0 omitidas, 0 TODO**. Incluye 29 regresiones nuevas de bajada automática, concurrencia, persistencia y pie estable. Sintaxis: **121 archivos JS/GS, 30 scripts inline y 73 dependencias locales**. Las comprobaciones git diff --check y git diff --cached --check pasan. El CI del HEAD final se enlaza en el PR #83 en borrador.
