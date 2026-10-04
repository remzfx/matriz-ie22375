# Estudiantes privados: rollout en dos PR

## Fuentes y discrepancia (sin resolución automática)

Admin y Registro contienen 408 alumnos; el JSON público contiene 407. La diferencia identificada por el propietario corresponde a Secundaria, 4.º B, orden 217. Ninguna lista antigua se considera semilla de la base privada, ni se incluye/excluye esa fila automáticamente. La base inicial será exclusivamente una exportación SIAGIE vigente revisada por Admin, de ambos niveles. El archivo local extraído anteriormente sirve solo como respaldo histórico y comparación; **no usarlo para inicializar**.

No había una base oficial de estudiantes en Sheets: Admin editaba localStorage y restauraba la copia empotrada. Se usa una hoja privada `EstudiantesBase` en el mismo Spreadsheet vinculado, con versiones fragmentadas y punteros `BASE_ACTUAL`/`BASE_OFICIAL`. Solo hay una base privada vigente; el segundo puntero es el respaldo de restauración de la primera importación revisada.

| Consumidor | Etapa A / PR #34 | Etapa B, pendiente de validación |
| --- | --- | --- |
| Admin | Conserva BD_EMPOTRADA, base local, importación SIAGIE/CSV/JSON, guardado y restauración actuales. Añade preparación privada manual e independiente en Importar. | Base privada; importación/edición/guardado y restauración en servidor. |
| Registro | Conserva BD_EMP y la fuente local actual. | POST protegido con alcance de sesión. |
| Primaria | Conserva totales y flujo actual. | Totales desde estudiantes privados. |
| Secundaria | Conserva JSON público y caché actuales. | Lista autorizada del backend. |
| Auxiliar | Conserva JSON público y base local actuales. | Lectura protegida de todo el colegio para Admin/Auxiliar. |
| Photochecks | Conserva fuente pública, QR y gate Admin actuales. | Lectura protegida Admin y QR generado localmente. |

## Etapa A: backend y preparación compatibles

1. Revisar y, cuando el propietario lo autorice, desplegar el backend del PR #34. Las nuevas acciones son aditivas: `loadstudents`, `initstudents`, `savestudents`, `restorestudents`. No cambian rutas existentes ni los seis consumidores. La hoja se crea al verificar la nueva lectura autenticada. No hay carga automática de alumnos ni migración de datos al desplegar.
2. El Admin de esta etapa puede publicarse antes o después del backend: sus funciones actuales siguen funcionando. Si el backend aún es antiguo, solo falla el botón manual de verificación/preparación privada; los módulos no usan ese lector nuevo.
3. En Admin → Importar → Preparar base privada, seleccionar CSV SIAGIE **vigentes** de Primaria y Secundaria. Se reutiliza el parser SIAGIE existente. Revisar las listas completas, grados/secciones/orden y matrícula; resolver la discrepancia contra SIAGIE vigente. Los archivos de la plataforma, localStorage, BD_EMPOTRADA, BD_EMP y el JSON público no se importan como semilla. Marcar la revisión y confirmar explícitamente la inicialización de una sola vez.
4. Verificar nuevamente conectado al servidor. Una respuesta desde caché offline **no** confirma la base en producción. Comparar conteos y listas de la base privada con SIAGIE; comprobar Admin, Auxiliar, Primaria por grados, Secundaria por relaciones exactas área→aula y rechazo de PIP/tokens inválidos. Validar guardado/restauración sobre datos de prueba o respaldo autorizado. No publicar datos privados ni modificar notas para esta comprobación.
5. Admin debe confirmar que la base privada está inicializada y correcta. Conservar registro de la validación sin nombres/credenciales. Mientras tanto los seis consumidores y las fuentes públicas originales se mantienen.

## Etapa B: corte posterior, en borrador

Solo después de la confirmación de producción, revisar/autorizar el segundo PR, cambiar su base a main si corresponde y actualizarlo con main. Este migra los seis consumidores a `students.js` por POST con token y elimina las tres copias públicas y los fallbacks globales. El backend y los datos privados ya existirán: el frontend podrá publicarse después sin requerir un despliegue simultáneo de Apps Script. No usar la existencia de la hoja, un número esperado de alumnos o una caché como aprobación automática. El borrador no se fusiona ni despliega durante esta preparación.

Si falla la validación en A, detener B y continuar con la plataforma actual. Tras el corte B, no volver a publicar rosters antiguos como solución a un error de conexión; corregir la lectura protegida. El respaldo privado permite restauración de Admin. El historial Git anterior no se reescribe en estos PR.

## Alcance y controles

Admin/Auxiliar: escuela completa; Primaria: grados del servidor; Secundaria: aulas de asignaciones exactas área→aula, con el formato legado explícito ya admitido. PIP no consume alumnos. Se mantienen tokens HMAC, expiración, revocación por permisosVersion, permisos, notas, escrituras académicas, bimestres, SIAGIE Excel y Classroom.

La preparación es manual, usa POST con token y exige conexión para inicializar/verificar. No se ejecutan merge, despliegue ni importaciones reales con estos PR. Las pruebas usan únicamente datos sintéticos. La exposición pública permanece deliberadamente en A para permitir el rollout compatible; se retira en B tras validar producción.
