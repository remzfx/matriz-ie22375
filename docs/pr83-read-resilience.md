# PR #83 — revisión de #6182301531 y #6182314131

Referencia: `ca2db13b518795c20268de35fc75394a0b7902b6`. Solo fixtures ficticias y servidor en memoria. No se inspeccionaron sesiones ni registros oficiales para atribuir las capturas originales a una causa concreta.

## Causas reproducidas

1. `automatic()` esperaba `bajarRegistroNube()` sin plazo máximo. La espera estaba en `leerEstadoRemotoAcademico()`: tanto fetch como `response.text()` podían quedar pendientes. `checking` y el lock de lectura permanecían activos; no existía un estado final. La reproducción del código anterior confirma que el estado no termina hasta liberar manualmente el transporte simulado. Una captura sin tiempo transcurrido no demuestra por sí sola este cuelgue.
2. `pendingAcademic()` usaba igualdad del canonical completo con la base causal. `sliceRegistroArea()` incluye por defecto `asisFechas: {aula: []}`; una fila remota inexistente o dispersa devuelve `{}`. Aunque ambos están académicamente vacíos y la lectura se verifica, sus representaciones difieren. Aliases de identidad conservados localmente también pueden diferir sin ser una edición académica. El controller de respaldo de emergencia volvía a mostrar pendiente usando otra firma, incluso después de Guardar un registro vacío. Las pruebas reproducen expresamente el falso aviso del HEAD anterior.

## Corrección acotada

- La lectura automática y la revisión explícita tienen un presupuesto de **15 segundos** para fetch y cuerpo juntos. Se transmite un `AbortSignal` al transporte protegido existente. Sin AbortController, o si el transporte ignora la cancelación, el plazo sigue terminando la lectura.
- La carrera de tiempo está dentro de la **lectura sin mutaciones**, no alrededor de una conciliación que siga ejecutándose. Tras vencer el plazo no se ejecuta A1, no se aplica payload, no cambia baseline ni se publica otro resultado. Una respuesta SESSION tardía tampoco revoca la sesión actual. El lock se libera al terminar el intento acotado. Contexto, generación, token, padrón y persistencia se vuelven a validar antes de aplicar.
- Se conserva el estado local ante fallo, aparece un mensaje de timeout/conexión y **Reintentar notas**. Un cambio de contexto invalida el estado visual anterior. No hay polling ni reintentos ilimitados: se deduplica por contexto/generación; volver online o pulsar reintento permite una nueva lectura. No se reintenta ninguna escritura.
- Solo para decidir el aviso se normalizan buckets de fechas vacíos y se ignora metadata de compatibilidad de identidad. Se comparan los demás campos y los tombstones explícitos: notas, evidencias, sesiones, conclusiones, capacidades seleccionadas, competencias no trabajadas y asistencia real siguen pendientes. Una eliminación frente a una base con datos sigue pendiente. Sin lectura verificada no se anuncia vacío.
- Esta normalización **no** modifica canonical de A1, baseline, versión, CAS, payload, identidades, datos ni firmas de respaldo. Guardar y el respaldo de emergencia comparten la clasificación del aviso, conservando la protección y persistencia del borrador.
- Revisar diferencias aparece en el grupo de Recuperar Nube, únicamente para conflictos A1 actuales. El grupo permite wrap y el ajuste existente de altura del pie conserva el espacio del contenido.

## Diagnóstico seguro y tiempos

`IERegistroRecovery.diagnostic()` devuelve la última medición del contexto actual: `elapsedMs`, fase final, tiempos por fase, resultado y nombres de campos pendientes. No contiene token, usuario, nombres de estudiantes, valores de notas, payloads ni URL. Se limpia al cambiar contexto/sesión.

Las fases son preparación, guardado local, lectura, cuerpo, conciliación, respaldo, persistencia y pintura. Sesión y padrón son prerrequisitos: si no están disponibles no se inicia el mensaje de verificación ni una lectura remota. Los tests inyectan 4000 ms en lectura y obtienen 4000 ms; los cuelgues de fetch/cuerpo terminan a 15000 ms; pruebas separadas inyectan tiempo en A1, persistencia y pintura para comprobar la atribución. **Son tiempos sintéticos, no mediciones del servidor de producción.**

## Pruebas y rendimiento

32 regresiones nuevas en `tests/registro-read-resilience.test.cjs`: reproducción anterior, vacío disperso, aliases, Guardar/respaldo, cambios en diez campos significativos, tombstones, base ausente/red caída, fetch/cuerpo colgados, aborto efectivo, respuesta tardía, reintento explícito, lectura lenta/deduplicación, aula/ABA/token/expiración, edición posterior, rechazo SESSION tardío, contrato protegido de transporte y tiempos por fases. Se mantienen las suites A1/B1/CAS, permisos, cierres, recuperación, almacenamiento fallido y aportes transversales.

Evidencia de contadores antes/después contra ca2db13: `docs/demos/registro-read-resilience-performance.json`, con 30/40 alumnos sintéticos y cinco competencias. Primera carga/cambio de aula: una lectura, cero escrituras académicas; minuto idle y offline idle: cero requests, hashes, renders, serializaciones e IndexedDB. La carga inicial de 40 alumnos conserva 12025 serializaciones; cambiar aula usa 3257 frente a 3223 anteriores (34 adicionales por clasificación semántica cuando difieren representaciones, sin otra consulta). Un cuelgue ahora produce dos cambios de estado (verificando → timeout), sin render ni IndexedDB secundarios. Los presupuestos automatizados originales siguen comprobándose.

Los snapshots históricos permiten exclusivamente las cinco funciones de lectura/instrumentación nuevas mediante expectativas literales completas; una mutación académica artificial continúa siendo rechazada. La fixture de pie fue regenerada desde el HTML actual. No se presentan las capturas previas como evidencia del nuevo reintento; la comprobación nueva es estructural y automatizada.

## Límites y reversión

El timeout puede interrumpir una lectura legítima lenta; los datos locales se conservan y el reintento es explícito. JavaScript síncrono y una decisión humana en el diálogo no pueden interrumpirse mediante el timer de red. Las lecturas históricas y la recuperación voluntaria mantienen sus flujos existentes; no se altera autorización ni se permite escribir con una sesión no verificada. El transporte de lectura sigue siendo POST protegido `loadreg`; «cero escrituras» se refiere a cero envíos académicos automáticos, no a ausencia de POST de lectura.

No cambia Apps Script, Sheets, SW, A1 ni B2. Los módulos externos de referencia siguen incrustados idénticos en Registro para no añadir una dependencia de despliegue/SW. Revertir el commit correctivo restaura el frontend anterior sin migrar ni borrar datos o respaldos. No se ejecuta despliegue ni escritura en producción. PR permanece en borrador, pendiente de revisión y autorización.
