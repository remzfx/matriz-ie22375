# B2 — importación masiva segura Desde Registro

Base auditada: `main e41a9853eb79847dce35c0dda926c29b25bd9971`, después del PR #79. Todas las pruebas usan datos ficticios.

## Contrato existente y alcance

`loadreg` admite POST protegido con token, nivel, bimestre, grado y sección, sin seleccionar área. El servidor verifica la sesión vigente y las asignaciones exactas de DOCENTE_ACCESOS; devuelve todos los bloques autorizados con `soportaModeloAcademico`, payload y `ts`. Admin recibe todas las áreas; un docente recibe únicamente las suyas. Las regresiones ejecutan este contrato real con Sheets simulados y comprueban que la lectura no escribe.

`loadNivel` contiene consolidados de matriz, no resultados individuales de Registro, y no se utiliza para esta importación. No se cambia Apps Script, autorización, bridge, students.js ni Registro. No requiere Deploy Apps Script.

La fuente académica es exclusivamente el snapshot persistido en RegistroNotas que confirma `loadreg`, nunca las notas del navegador. El backend actual no expone un estado adicional de aprobación del Registro: B2 no inventa ese estado ni interpreta borradores locales como datos oficiales. Solo permite aplicar competencias completas, trabajadas y con conclusiones obligatorias presentes en su fuente. Competencias Transversales conserva su circuito independiente Tutor+AIP y se excluye de esta importación académica.

## Flujo

1. Desde Registro consulta todas las áreas autorizadas del aula/bimestre, el padrón protegido del bimestre y el estado de periodos. Exige contrato académico válido, padrón inicializado y contexto coincidente. Un fallo de transporte conserva la matriz anterior.
2. Resuelve estudiantes mediante student-identity.js: ID SIAGIE, código y compatibilidad por nombre inequívoco. No suma dos veces una identidad estable; conflictos de identidad/código bloquean la vista. Los homónimos no heredan notas por nombre.
3. Reutiliza modelo, identidad y conversiones de Registro. El resultado directo efectivo prevalece. En su ausencia, calcula el promedio redondeado de las evidencias válidas de la competencia, filtradas por contexto completo/capacidad/fecha. No cuenta cada evidencia como un resultado final. No trabajadas, notas inválidas, registros divergentes, falta de calificación o conclusión obligatoria quedan pendientes.
4. La vista previa muestra área/competencia, alumnado, AD/A/B/C, pendientes, conteos anteriores, diferencias y versión del bloque. Una competencia pendiente no se aplica parcialmente. Los conteos divergentes quedan sin seleccionar hasta una decisión expresa. Un docente puede consultar esta vista en periodo abierto; únicamente Admin puede aplicar.
5. Aplicar exige confirmación explícita y repite las lecturas para detectar cambios de nube, padrón/versiones, permisos, token, contexto, catálogo, periodo o conteos locales. Cancelar, una respuesta atrasada o cualquier diferencia impide la aplicación. Reabrir después de aplicar identifica los conteos iguales como Sin cambios.
6. Actualiza solo los conteos seleccionados en la matriz local, conservando los demás campos y áreas. Primero persiste la copia; si falla el almacenamiento, mantiene el estado anterior. No llama a saveArea, savereg ni otro endpoint de escritura. La subida de matriz sigue siendo una acción separada del usuario.

Las conclusiones individuales se consultan únicamente para verificar integridad según las reglas vigentes (Primaria B/C; Secundaria C). No se copian a la matriz, no se muestran en la vista ni se alteran; permanecen en Registro.

## Compatibilidad y límites

- Se conserva el bloqueo existente de Desde Registro en bimestres cerrados/bloqueados; la matriz puede seguir consultándose. La aplicación también exige un periodo abierto confirmado por servidor.
- El plan vive en memoria. El SW agrega solamente el nuevo JS estático al precache; no guarda respuestas privadas, tokens ni alumnado en CacheStorage. Sus estrategias de red, expiración y exclusión de APIs permanecen intactas.
- loadreg conserva el transporte POST existente. Un 404 o fallo de red impide importar y muestra el error; no borra datos ni recurre a notas locales. La carga de estudiantes mantiene su bridge actual.
- La segunda lectura detecta cambios hasta ese momento; no crea una transacción remota. Un cambio de servidor posterior a esa lectura requiere una nueva importación. Como la aplicación es local, B2 no sobrescribe RegistroNotas en ningún caso.
- No modifica B1, conciliación A1, aportes transversales ni sus pendientes. Los snapshots históricos excluyen solo el importador reemplazado y las dependencias estáticas añadidas; el resto del HTML sigue comparándose exactamente.

Comprobación manual pendiente en Live Server con datos ficticios: dialog/modal, scroll horizontal en teléfono, todas las áreas de un aula, selección de un reemplazo divergente, cancelar y volver a importar. Comprobar además un fallo de red durante la segunda lectura. No utilizar notas reales para validar este PR.

Validación local: 1803 pruebas aprobadas, 0 fallidas/omitidas (38 regresiones B2). Sintaxis: 86 archivos JS/GS y 28 scripts inline; 62 dependencias locales verificadas. `git diff --check` correcto.

Reversión: revertir el PR sin borrar almacenamiento ni datos de Sheets. No merge ni deploy sin autorización expresa.
