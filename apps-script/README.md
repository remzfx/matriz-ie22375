# Apps Script — despliegue con GitHub

Este directorio será la fuente versionada del backend de Google Apps Script de la I.E. 22375.

## Objetivo

Después de la configuración inicial, el flujo será:

1. editar el backend en GitHub;
2. revisar y hacer merge;
3. ejecutar el workflow **Deploy Apps Script**;
4. GitHub hace `clasp push`;
5. GitHub actualiza la implementación existente del Web App.

La URL del Web App se conserva porque se reutiliza el mismo deployment ID.

## Configuración inicial — una sola vez

### 1. Habilitar Apps Script API

En la cuenta Google propietaria del proyecto, habilitar Apps Script API desde la configuración de Apps Script.

### 2. Obtener el Script ID

Abrir el proyecto real de Apps Script:

**Configuración del proyecto → IDs → ID de secuencia de comandos / Script ID**

No confundir:
- **Script ID**: identifica el proyecto.
- **Deployment ID**: identifica la implementación publicada del Web App.

### 3. Autorizar clasp en una PC

Requiere Node.js 20 o superior.

```bash
npm install --global @google/clasp
clasp login
```

### 4. Clonar una copia temporal del proyecto real

```bash
clasp clone-script TU_SCRIPT_ID
```

Esto permite obtener el `appsscript.json` real del proyecto. Antes del primer despliegue automatizado, ese manifiesto debe copiarse a:

```
apps-script/appsscript.json
```

No inventar un manifiesto: el push de Apps Script reemplaza el contenido remoto completo.

### 5. Crear GitHub Secrets

En GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

Crear:

#### CLASPRC_JSON

Contenido completo del archivo creado por `clasp login`:

- Windows: `%USERPROFILE%\.clasprc.json`
- macOS/Linux: `~/.clasprc.json`

Este archivo contiene un token sensible. **Nunca subirlo al repositorio ni pegarlo en chats.**

#### CLASP_JSON

Usar:

```json
{"scriptId":"TU_SCRIPT_ID","rootDir":"apps-script"}
```

#### APPS_SCRIPT_DEPLOYMENT_ID

ID de la implementación Web App actual que queremos conservar.

## Primer despliegue

Antes de ejecutarlo, comprobar que `apps-script/` contiene:

- código Apps Script actual;
- `appsscript.json` real, obtenido del proyecto existente.

Además, en **Configuración del proyecto → Propiedades de la secuencia de comandos**, crear:

- `IE22375_ADMIN_PASS`: contraseña vigente del rol Admin. No escribir su valor en el repositorio.
- `IE22375_AUXILIAR_PASS` y `IE22375_PIP_PASS`: contraseñas privadas para los roles existentes Auxiliar e Innovación. El login ahora se valida en servidor y emite el mismo token HMAC. Definir contraseñas nuevas; las anteriores estaban publicadas en el cliente. No hay fallback al login local y las sesiones anteriores sin token requieren volver a iniciar sesión.

El backend crea automáticamente `IE22375_TOKEN_SECRET` la primera vez que emite un token. Si ya existe,
no debe reemplazarse: cambiarlo invalida inmediatamente todas las sesiones firmadas.

Luego:

**GitHub → Actions → Deploy Apps Script → Run workflow**

El workflow inicialmente es manual a propósito.

## Después de verificar

Cuando tengamos al menos un despliegue correcto y comprobemos que la URL pública sigue funcionando, podremos cambiar el workflow para que se ejecute automáticamente solo cuando cambien archivos dentro de `apps-script/` en `main`.

## Seguridad

- No commitear `.clasprc.json`.
- No commitear tokens OAuth.
- No poner tokens en `AGENTS.md`, issues, PRs o logs.
- Si un token queda expuesto, revocarlo y generar uno nuevo.

## Nota sobre clasp

`clasp push` reemplaza el contenido del proyecto remoto con los archivos locales aceptados. Por eso la primera sincronización debe preservar el manifiesto y cualquier archivo existente del proyecto.

## Autorización de las escrituras restantes

- `saveasis`: Admin/Auxiliar, cuyo módulo actual cubre todo el colegio. Solo contextos de Primaria/Secundaria válidos; se valida el lote completo antes de escribir y se construye la clave en servidor. Docentes registran su asistencia académica por `savereg`, no por esta ruta de ingreso.
- `saveaip`: Admin/Innovación (`pip`), sin conceder acceso a docentes ni auxiliares.
- `savetpl` y `savewa`: solo Admin. Auxiliar conserva la consulta/envío a grupos existentes, sin editar su configuración.

Antes de una implementación futura, definir las dos contraseñas privadas. Este bloque no configura propiedades, no fusiona ramas ni despliega.



## Lecturas protegidas

GET y POST aplican la misma autorización. Los consumidores de la plataforma envían el token de sesión por POST en el cuerpo; no lo incorporan a la URL. Los GET existentes requieren token para las lecturas protegidas.

| Ruta | Acceso |
| --- | --- |
| `loadreg`, `loadNivel`, alias `load` | Admin: lectura completa; Docente: solo su alcance vigente en `DocentesAcceso`. |
| `loadtplstatus` | Admin: completo; Docente: estado de plantillas de sus aulas autorizadas, sin IDs de Drive. |
| `loadtpl` | Solo Admin. El Excel completo puede incluir varias áreas y no se puede filtrar por área en el backend actual. Restricción aprobada: docentes conservan consulta de estado, pero la exportación del Excel completo desde Registro requiere Admin. |
| `loadasis`, `loadwa` | Admin/Auxiliar, conforme al alcance escolar de sus módulos existentes. |
| `loadaip` | Admin/PIP. |
| `classroom` | Admin; conserva respuesta JSON/JSONP, sin exponer públicamente cursos de la cuenta de ejecución. No hay consumidor de lectura en la interfaz actual; el botón solo abre Classroom. |
| `loaddoc` | Conserva POST solo Admin; GET siempre rechazado. |

Para Primaria se filtran grados autorizados. Para Secundaria se exige la relación exacta área → aula de `asignaciones`; solo los registros antiguos sin ese mapa conservan el fallback explícito `areas`+`aulas`. Los filtros de la consulta solo reducen ese alcance: omitirlos o falsificarlos nunca concede otros contextos. Firma, expiración y revocación por `permisosVersion` se conservan. Los registros se filtran antes de retornar su payload; sus sesiones y mapas internos también se limitan al contexto de la fila. La forma de `payload.meta` permanece intacta.

### Lecturas públicas deliberadas

- `ping`: diagnóstico de conexión, sin registros, alumnos ni permisos.
- `loadperiodos`: año y estados globales de bimestres necesarios para sincronizar las interfaces; no devuelve registros académicos ni configuración de docentes.

La acción `login` sigue siendo el punto público de autenticación existente, con credenciales y sin cambios.

No se modifican rutas de escritura, formatos almacenados, secretos ni diseño de tokens.

## Estudiantes privados

Las siguientes acciones nuevas aceptan exclusivamente POST JSON con el token en el cuerpo:

| Acción | Acceso y comportamiento |
| --- | --- |
| `loadstudents` | Admin y Auxiliar: colegio completo. Docente Primaria: grados de la configuración vigente. Docente Secundaria: unión de aulas de sus relaciones exactas área → aula; conserva el formato legado explícito de permisos ya soportado. PIP rechazado: su módulo no consume estudiantes. |
| `initstudents` | Solo Admin, una sola vez: importación inicial revisada y respaldo oficial privado. |
| `savestudents` | Solo Admin: guardar la base revisada con la versión leída; rechaza cambios concurrentes. |
| `restorestudents` | Solo Admin: restaurar el respaldo oficial privado con una nueva versión. |

`loadstudents` no usa filtros ni roles/identidades enviados por el cliente para ampliar permisos. Retorna únicamente `nivel`, `grado`, `seccion`, `orden`, `nombre`, además de versión/estado de inicialización de la base. Se conservan la validación HMAC existente, expiración y revocación docente por `permisosVersion`. El lock compartido con `savedoc` permite volver a comprobar la versión docente después de esperar, sin tomar locks anidados.

### Fuente y restauración

La auditoría no encontró una base de alumnos existente en Sheets: Admin editaba almacenamiento local y restauraba una copia empotrada; otros módulos consumían el JSON público o copias locales. Se reutiliza **el mismo Spreadsheet vinculado al Apps Script**, con una hoja privada nueva `EstudiantesBase` (`clave`, `version`, `json`). No crear otro Spreadsheet ni publicar esta hoja.

Las versiones se almacenan en fragmentos de hasta 30.000 caracteres por celda. `BASE_ACTUAL` apunta a la única base vigente; `BASE_OFICIAL` conserva la primera importación explícita, para restaurar. Ambos son punteros a versiones privadas, no bases activas paralelas. Los punteros se escriben al final y las operaciones comparten lock; un fallo durante los fragmentos no reemplaza la versión vigente. El respaldo nunca se sustituye por una edición/importación posterior. Las versiones anteriores quedan privadas para recuperación; no son leídas por el cliente.

### Migración inicial pendiente del despliegue autorizado

Este PR no despliega ni escribe datos reales en Sheets. Antes de cambiar producción, el administrador debe conservar/exportar la base vigente desde el Admin actual y guardar su respaldo original en un lugar privado. Se preservó fuera del repositorio un archivo local para importar el respaldo empotrado original. Hay una diferencia de una fila entre el JSON público y la copia original de restauración; revisar cuál lista representa la matrícula vigente, sin fusionarlas automáticamente.

Después del despliegue que autorice el propietario:

1. Iniciar sesión Admin y abrir Importar. La lectura de una hoja todavía vacía indica que falta inicialización; no se usa ninguna lista pública como fallback.
2. Importar el JSON privado revisado con nivel **Ambos** y modo **Reemplazar** (también se conserva SIAGIE/CSV por nivel). Revisar los alumnos y conteos.
3. Pulsar **Confirmar base oficial inicial y respaldo privado**. Esta operación explícita crea la base vigente y su respaldo de restauración una sola vez. No inicializar con una lista parcial.
4. Las siguientes importaciones/ediciones quedan como borrador en la pestaña hasta pulsar **Guardar BD**. Restaurar recupera el respaldo inicial desde Sheets. Exportaciones JSON/CSV siguen siendo descargas privadas de Admin, no archivos publicados.
5. Verificar Registro, matrices, asistencia y Photochecks. El cambio requiere backend y consumidores en la misma puesta en producción; no publicar solo el frontend antes del backend y la importación.

### Caché y consumidores

`students.js` utiliza POST y una caché de sesión de diez minutos ligada al **token exacto**, con copia independiente del borrador de Admin. Siempre intenta consultar el backend: una denegación limpia la caché y nunca usa fallback. Solo un fallo de conexión permite la última respuesta autorizada del mismo token, aún vigente y dentro del TTL, señalada como temporal/sin conexión. Fuera de esa ventana se muestra error y no se cargan nombres. La revocación no puede comprobarse sin conexión; la ventana offline queda limitada a esos diez minutos. No se guarda una base permanente global ni se confía en el antiguo almacenamiento compartido entre roles. Las claves antiguas se ignoran, sin borrarlas silenciosamente, para permitir recuperar un respaldo local previo.

Se migraron seis consumidores: Admin, Registro, Primaria, Secundaria, Auxiliar y Photochecks. Primaria/Secundaria calculan los totales oficiales desde la respuesta protegida y conservan la estructura de notas. Photochecks sigue siendo exclusivo de Admin y genera QR localmente con la biblioteca ya incluida; el contenido QR sigue siendo el usado por Auxiliar.

### Retirada pública y validación

- `admin.html` y `registro.html`: eliminadas las listas empotradas de alumnos.
- `bd_oficial_2026.json`: eliminado del árbol publicado.
- `secundaria.html`, `auxiliar.html`, `photochecks.html`: eliminadas consultas al JSON y fallbacks permanentes compartidos.
- No quedan copias estáticas de estudiantes en archivos de producción del árbol nuevo. El respaldo local de migración queda fuera del repositorio. Este PR no reescribe el historial Git: las versiones históricas previas siguen existiendo.

Auditoría completa en [auditoria-estudiantes.md](auditoria-estudiantes.md). Ejecutar `node --test tests/*.test.cjs`: pruebas previas y nuevas de roles, tokens, filtros falsificados, revocación concurrente, guardado/restauración, importación SIAGIE/CSV/JSON, consumidores, caché y sintaxis de todos los HTML. Los fixtures contienen solo datos sintéticos.


