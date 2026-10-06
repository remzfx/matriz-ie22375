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
- `IE22375_PIP_PASS`: contraseña privada de Innovación, validada en servidor. No hay fallback al login local.
- Auxiliar: configurar cuentas y niveles en **Admin → Auxiliares**. `IE22375_AUXILIAR_PASS` queda únicamente como origen opcional para la migración explícita de la cuenta anterior; por sí sola ya no permite iniciar sesión. Seguir [la guía de permisos y migración](auxiliares-niveles.md).

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
| `loadmatrixteachers` | POST con token: Admin ve todas las asignaciones; Docente solo las propias. Vista de `DOCENTE_ACCESOS` con nombres, nivel, grados y área→aula; nunca entrega `pass`, contraseñas ni usuarios. |

Primaria y Secundaria usan esta vista para el docente responsable, con caché temporal ligada al token. Los nombres históricos de las matrices no sustituyen la asignación oficial. El código completo de esta ruta está en `Codigo.js`; requiere una actualización futura de la implementación existente para estar disponible en producción. Este PR no realiza merge ni despliegue.

Para Primaria se filtran grados autorizados. Para Secundaria se exige la relación exacta área → aula de `asignaciones`; solo los registros antiguos sin ese mapa conservan el fallback explícito `areas`+`aulas`. Los filtros de la consulta solo reducen ese alcance: omitirlos o falsificarlos nunca concede otros contextos. Firma, expiración y revocación por `permisosVersion` se conservan. Los registros se filtran antes de retornar su payload; sus sesiones y mapas internos también se limitan al contexto de la fila. La forma de `payload.meta` permanece intacta.

### Lecturas públicas deliberadas

- `ping`: diagnóstico de conexión, sin registros, alumnos ni permisos.
- `loadperiodos`: año y estados globales de bimestres necesarios para sincronizar las interfaces; no devuelve registros académicos ni configuración de docentes.

La acción `login` sigue siendo el punto público de autenticación existente, con credenciales y sin cambios en este bloque. La retirada de las listas estáticas corresponde exclusivamente a la etapa B, después de validar la base privada en producción.

No se modifican rutas de escritura, formatos almacenados, secretos ni diseño de tokens.



## Estudiantes privados — etapa B en revisión (PR #35)

La rama integra el main que incluye los PR #34 y #36–38. Migra los seis consumidores a POST con token y retira las bases embebidas y el JSON público. Conserva el backend actual, el alcance por rol y los controles manuales SIAGIE/padrones en Admin; no usa listas históricas ni almacenamiento local como semilla.

Registro carga el padrón del bimestre seleccionado mediante IEStudents.loadRoster. Si falta, conserva el resultado autorizado con padronInicializado:false y lo informa. Un padrón cerrado existente permanece congelado. La caché temporal exige el mismo token y bimestre; offline no equivale a validación de producción.

student-identity.js comparte la identidad ID → código → nombre normalizado y la lectura de notas antiguas por nombre. Las nuevas notas usan identidad estable; las claves históricas no se renombrarán ni borrarán automáticamente. Admin y Registro mantienen el cruce SIAGIE por ID/código antes de nombre.

El borrador no autoriza un corte de producción. Antes de publicar, revisar la base privada, padrones y permisos conectado al servidor. No resolver automáticamente la discrepancia histórica de Secundaria 4.º B, orden 217. La inicialización sigue requiriendo CSV SIAGIE vigente de ambos niveles y revisión/confirmación explícitas.

Detalle, fuentes y límites de compatibilidad: [auditoria-estudiantes.md](auditoria-estudiantes.md). Pruebas: node --test tests/*.test.cjs, con fixtures sintéticos. No se han ejecutado merge, despliegue ni importaciones reales.
