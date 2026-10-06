# Login bridge — revisión antes de merge/deploy

Producción reportó HTTP 404 al iniciar sesión también como Admin después del PR #58. Google documenta que [ContentService redirige a una URL de un solo uso](https://developers.google.com/apps-script/guides/content). Este cambio añade una vía distinta para el login: una vista HtmlService llama a la misma autenticación mediante [google.script.run](https://developers.google.com/apps-script/guides/html/communication). No demuestra todavía que todos los fallos de alojamiento de Google desaparezcan; requiere validación posterior a la revisión independiente.

## Protocolo y límites de confianza

- GitHub Pages sigue mostrando el formulario. `login-bridge.js` crea un iframe oculto al mostrar login; su URL contiene únicamente `bridge=login-v1`, origen padre y nonce aleatorio de 128 bits. Nunca contiene usuario, contraseña ni token.
- `doGet` crea HtmlService exclusivamente para ese selector y con origen y nonce válidos. Los orígenes padre permitidos son `https://matriz.biblioteca360.com`, `https://biblioteca360.com`, `https://www.biblioteca360.com` y `https://remzfx.github.io`. En otros orígenes, incluido un archivo local, continúa el fetch existente.
- HtmlService usa un [sandbox iframe](https://developers.google.com/apps-script/guides/html/restrictions) dentro del iframe de la página. READY se dirige a los ancestros con el origen padre exacto. El padre comprueba el origen de Google, el nonce y que `event.source` pertenezca al iframe creado; después fija esa ventana y ese origen para INIT/ACK y todas las respuestas. El hijo exige un ancestro del origen permitido y fija su ventana tras INIT. No se utiliza `targetOrigin='*'`. El acceso limitado a `Window.parent` entre orígenes está [permitido por el navegador](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy#cross-origin_script_api_access).
- Las credenciales se envían solo después de ACK, por `postMessage`, a la ventana fijada. El hijo llama una vez a `loginBridgeAutenticar`, que devuelve directamente `responderLogin_()`. El nonce correlaciona mensajes; no sustituye la autenticación ni concede permisos. El identificador creciente de solicitud rechaza replays y respuestas antiguas.
- `ALLOWALL` permite incrustar la vista; la protección se implementa en el protocolo descrito, como exige la [documentación de XFrameOptionsMode](https://developers.google.com/apps-script/reference/html/x-frame-options-mode). La vista no ofrece formulario ni navegación y no acepta mensajes de otras ventanas/orígenes.
- Ninguna contraseña se escribe en almacenamiento o diagnósticos. El perfil y la sesión conservan sus campos actuales. HMAC, TTL de 12 horas, roles, permisosVersion y reglas de autorización permanecen en la autenticación existente.

## Fallback y disponibilidad

No se espera a que el iframe cargue para habilitar el formulario. Si el bridge no completó el handshake, se usa inmediatamente el fetch actual, sin cambiar sus 18 segundos ni sus dos intentos técnicos existentes. Un login por bridge usa el mismo límite de 18 segundos y una sola solicitud: una denegación o fallo RPC no dispara fetch ni otro intento automático. Una respuesta antigua no puede reemplazar una sesión ya escrita o invalidada.

`sw.js` pasa a v6 y añade `login-bridge.js` al respaldo estático validado. La comunicación con Apps Script nunca se almacena en CacheStorage. Cookies de terceros, bloqueos de iframe o cambios del entorno Google pueden impedir el handshake; en esos casos permanece el fallback. La carga del iframe no puede considerarse verificada solo por su evento `load`: se exige ACK.

## Entrega y validación

`Codigo.js` contiene el Apps Script completo, incluida la vista inline del bridge; no se necesita crear otro archivo HTML en el proyecto de Apps Script. Cuando se autorice una implementación futura, se conserva el deployment existente y su URL.

Las pruebas automatizadas ejecutan el cliente padre, el script del sandbox y la autenticación real con cuentas sintéticas. Cubren handshake, origen/source/nonce rechazados, credenciales fuera de URL y almacenamiento, cuatro roles/modelo idéntico, denegación sin retry, fallback, error RPC sin duplicación y sesiones/respuestas antiguas. La prueba de navegador con el sandbox real de Google, Safari/iPhone y la implementación actual queda pendiente: este PR no hace merge ni deploy y no utiliza credenciales de producción.
