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


