# Auxiliares: cuentas privadas y permisos por nivel

Admin conserva acceso a ambos niveles. Cada auxiliar accede únicamente a Primaria, Secundaria o ambos, según lo que Admin seleccione explícitamente.

## Configuración después del despliegue autorizado

1. Iniciar sesión como Admin y abrir **Auxiliares**.
2. Pulsar **Recargar desde servidor** para leer la configuración vigente.
3. Introducir nombre y usuario; marcar Primaria, Secundaria o ambos y el estado activo. Una cuenta activa necesita al menos un nivel.
4. Para una cuenta nueva, indicar contraseña. Para editar una cuenta existente, dejarla vacía conserva la contraseña actual.
5. Guardar en servidor. Los auxiliares deben volver a iniciar sesión con su usuario asignado.

No se crean cuentas ni se asignan ambos niveles automáticamente. La hoja `ConfigSistema` se crea con el mecanismo existente cuando sea necesaria; Admin puede seguir trabajando aunque no haya auxiliares configurados.

## Cuenta global anterior

Si solo existe `IE22375_AUXILIAR_PASS`, la cuenta global y sus tokens anteriores dejan de autorizar operaciones protegidas. Admin puede crear la cuenta `auxiliar`, indicar su nombre, seleccionar sus niveles y marcar **Migrar cuenta auxiliar antigua usando su contraseña privada** para conservarla sin verla ni enviarla al navegador. También puede indicar una contraseña nueva y crear cuentas separadas para cada nivel.

La opción de migración se muestra solo antes de la primera configuración. Nunca implica seleccionar ambos niveles. Después de guardar, la propiedad antigua deja de intervenir en el login; puede retirarse manualmente tras validar las cuentas nuevas. Este PR no modifica propiedades de producción ni realiza despliegues.

## Persistencia y revocación

`AUXILIAR_ACCESOS` se almacena en la hoja privada `ConfigSistema`, con timestamp y registros de usuario, nombre, niveles, estado y hash HMAC de contraseña. El hash incorpora usuario y el secreto privado del servidor; no se devuelve por ninguna API, ni siquiera a Admin. No publicar ni cambiar `IE22375_TOKEN_SECRET`: cambiarlo invalida tokens y requiere restablecer las contraseñas de estas cuentas.

Cada cambio incrementa la versión global de auxiliares. **Todas las sesiones Auxiliar anteriores quedan revocadas**, incluso al editar otra cuenta. Admin, Docentes e Innovación conservan sus reglas actuales. Cada petición protegida comprueba firma, expiración, cuenta vigente, estado y versión; los niveles efectivos se recuperan del servidor. Las escrituras administrativas usan lock y control de versión para evitar sobrescribir cambios de otro Admin.

## Alcance de las operaciones

- `loadstudents`: filtra la base privada antes de responder. Un filtro de nivel solo puede reducir el alcance; pedir otro nivel se rechaza.
- `loadasis`: filtra las filas por nivel autorizado; un nivel solicitado fuera de permisos se rechaza.
- `saveasis`: valida todos los items antes de escribir. Un lote mixto o un nivel no autorizado rechaza el lote completo.
- `loadwa`: devuelve únicamente grupos de los niveles autorizados. `savewa` sigue siendo exclusivamente Admin; Auxiliar solo consulta grupos y abre enlaces, sin una ruta propia de escritura WhatsApp.
- El selector muestra una etiqueta si solo hay un nivel y ambas opciones si hay dos. Los procesos de faltas, QR y subida filtran los niveles autorizados; manipular el DOM o la sesión no amplía permisos del backend.

Las cachés existentes no son autoridad para escribir en servidor. Un cambio de permisos exige nuevo login; la revocación se comprueba en la siguiente petición protegida. No se exponen listas de otras cuentas a Auxiliar.

## Validación

Ejecutar `node --test tests/*.test.cjs`, comprobar sintaxis JavaScript y scripts inline HTML y ejecutar `git diff --check`. Los nuevos casos incluyen cuentas por nivel, solicitudes manipuladas, revocación, lotes mixtos sin escrituras parciales, faltas automáticas, selectores, WhatsApp y migración explícita.
