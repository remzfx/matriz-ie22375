# Bridge de lectura protegida de estudiantes — PR #60

Parte de `main` en `61c69bcba5bc1b7f5ca2c92a2be85c0068d6fade`. La base no se considera vacía cuando falla el transporte. GitHub Pages conserva el frontend y Apps Script conserva la autorización y los datos.

## Transporte específico de lectura

`doGet` admite `bridge=students-v1` además del selector de login. Reutiliza la vista mínima HtmlService y el handshake del PR #59: origen permitido, ventana del sandbox perteneciente al iframe creado, ventana fijada tras INIT/ACK y nonce aleatorio de 128 bits. La URL solo lleva selector, origen padre y nonce. El token exacto y el bimestre viajan por `postMessage` dirigido al origen fijado; nunca por query string. No se guardan respuestas privadas en CacheStorage.

`studentsBridgeCargar(body)` llama directamente a `estudiantesRuta_({action:'loadstudents',token,bimestre})`. Ignora cualquier acción o payload de escritura del cliente. No ofrece RPC genérico. HMAC, TTL, permisosVersion, revocación, filtrado por rol/nivel y padrones continúan en la lógica existente. La vista de estudiantes no acepta solicitudes de login, y la vista de login no acepta lecturas.

Los consumidores cargan `login-bridge.js` antes de `students.js`. Este último prepara el iframe cuando hay sesión válida, incluso antes de la primera lectura. Admin, Docente y Auxiliar usan el mismo transporte. La lectura espera ACK de forma asincrónica, con límite de establecimiento de 12 segundos; no bloquea el render de la caché local. Si no se establece el bridge, continúa el transporte anterior: coordinador del Service Worker para Auxiliar cuando está disponible, o fetch POST. Los límites e intentos de ese fallback no cambian.

Una vez elegido el bridge se envía una sola RPC por lectura y no se dispara fetch ni reintento automático si falla. La RPC conserva el límite de lectura de 12 segundos. `readOnce()` sigue deduplicando por token exacto, época de autorización y bimestre; lecturas de distintos bimestres pueden coexistir y sus respuestas se correlacionan por identificador. El token y la época se vuelven a comprobar antes de enviar y antes de aceptar la respuesta. Un fallo transitorio conserva únicamente la caché todavía autorizada del mismo token; una denegación de sesión retira esa caché.

## Admin y disponibilidad

Sin una base inicializada confirmada, el resumen muestra `— alumnos · verificando…`, `Primaria (—)` y `Secundaria (—)`. Si falla la carga sin caché autorizada, indica `No se pudo cargar la base` y las cantidades quedan no disponibles. Una caché válida se pinta inmediatamente y se verifica en segundo plano. Solo una respuesta confirmada de base inicializada puede mostrar cero estudiantes.

El Service Worker pasa a v7 para retirar recursos estáticos anteriores; conserva el respaldo JS seguro y excluye la API privada. Las escrituras y las otras APIs no usan este bridge.

## Entrega

Validación local: `node --test tests/*.test.cjs` con **563 aprobadas y 0 fallidas**, sintaxis JavaScript y 23 scripts inline válidos, `git diff --check` sin errores. La regresión de 415 estudiantes genera la respuesta mediante el backend real sobre una base sintética, y comprueba el resumen de Admin.

La revisión separada detectó que vencer una RPC invalidaba el handshake de estudiantes. Se corrigió para descartar solo la solicitud vencida y permitir la próxima lectura por RPC; la regresión comprueba recuperación sin fetch y rechazo de la respuesta tardía. El revisor verificó la corrección y el arranque desde `<head>`: 21 pruebas específicas aprobadas, sin hallazgos accionables pendientes.

El código completo de Apps Script está en `apps-script/Codigo.js`, incluida la vista inline; no requiere un archivo HTML adicional. Este PR no hace merge ni deploy. Después del merge aprobado será necesario **Deploy Apps Script de una nueva versión de la implementación existente**, conservando su URL. La comprobación con el sandbox real de Google y producción queda pendiente de ese paso autorizado; las pruebas locales usan cuentas y estudiantes sintéticos.
