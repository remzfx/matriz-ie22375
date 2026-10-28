# Comparativo bimestral: reutilización de lectura histórica autorizada

Referencia previa: `e5cac8e90aa0a02b8bb98d5a14aa4841e8e5fbd9`, PR #118 DRAFT.

## Causa y alcance

`alternarComparativoBim()` descartaba la presentación y `cargarComparativoBim()`
volvía a recorrer I/II mediante `leerRegistroHistorico()`, aunque esas lecturas
ya estuvieran verificadas en la misma página. Cada periodo ausente puede implicar
`loadstudents`, `academicstate` (barrera existente) y `loadreg`.

La reserva 2B enumera bimestres abiertos y no es una autorización de lectura de
bimestres cerrados. Los clientes N2 y sus reservas no exponen aquí una proyección
histórica completa con su padrón confirmado; no se consumen ni se copia su borrador.
Se reutilizan únicamente pruebas completas obtenidas por el lector histórico
autorizado existente. El adaptador N2 expone solo las versiones confirmadas de
Calificar/Promedios conocidas en esa página para invalidar una lectura si cambian;
no crea clientes, no devuelve notas y no concede autorización.

## Protección

- Caché volátil en Registro: máximo 12 contextos, 512 KiB por entrada y 2 MiB
  conjuntos. Sin localStorage, IndexedDB, historiales nuevos ni cambios académicos.
- Clave por nivel/bimestre/grado/sección/área. Propietario por token, usuario,
  rol, perfil/asignaciones, versión de permisos, URL, generación y configuración.
- Una lectura solo se reserva mientras existe una autorización vigente del
  contexto visible, con binding exacto y estado conectado/pendiente o verificación
  que aún conserva su autorización anterior. Se conserva el plazo original:
  navegar o renovar otra autorización no extiende una prueba histórica existente.
- Cada hit vuelve a comprobar token válido, conexión, autorización, padrón vigente
  de ese bimestre (incluyendo identidades), estado local acotado y versiones N2
  conocidas. Cambio, ausencia o caducidad invalida la prueba; se usa la ruta
  histórica autenticada anterior. Sin autorización reutilizable no se habilita
  el cacheo, pero la lectura histórica explícita conserva sus controles anteriores.
- Respuestas incompletas/ambiguas, padrón no confirmado, ausencia de fila o cambio
  de autorización no se convierten en pruebas reutilizables. Las lecturas simultáneas
  del mismo contexto comparten petición, devolviendo copias independientes.
- No se cambia la conciliación por ID/código/nombre, la prioridad de nota directa,
  el cálculo por evidencias ni el tratamiento de registros adoptados.
- La presentación captura contexto, secuencia, identidad y alumnos actuales.
  Una respuesta tardía no se publica en otra aula. Si hay una entrada de Promedios
  aún sin capturar, no se reconstruye la tabla al terminar la lectura; los datos
  comparativos quedan disponibles para el siguiente render normal.
- No se añade paralelismo, precarga, escritura, reintento de guardado ni contrato
  de Apps Script. `registro-notas2-prefetch.js`, motor N2, backend y SW no cambian.

## Pruebas y medición

Datos y transporte ficticios; solicitudes externas bloqueadas. El runner de
navegador ejecuta Registro, estudiantes y transporte de generación reales.
Los tiempos siguientes usan **3000 ms por cada loadreg**, no latencia de producción.

| Caso III con I/II | Antes, PC/móvil | Después, PC/móvil | Solicitudes evitadas |
|---|---|---|---|
| Sin lecturas anteriores | ≈6,2 s; 6 solicitudes | ≈6,2 s; mismas lecturas necesarias | 0 |
| Reabrir dentro de vigencia | ≈6,2 s; 6 solicitudes | ≈97–100 ms; 0 solicitudes | 6 |
| I/II leídos previamente | ≈6,2 s; 6 solicitudes | ≈97–100 ms; 0 solicitudes | 6 |
| Solo II ausente | Relee ambos | Solo padrón/generación/loadreg de II | 3 |

Los valores finales y CI del SHA exacto se registran en el PR. No son p50/p95 de
producción ni certificación de Google Sheets. Las pruebas cubren autorización
vencida, no extensión de plazo, desconexión, cambio de usuario/permisos/generación,
grado y regreso, versiones, padrones distintos, concurrencia, copias aisladas,
pendientes y controles de identidad existentes.

Pruebas diferenciales iniciales: 87 aprobadas. Se ejecuta el CI completo del
commit resultante; no se repiten auditorías ni pruebas de carga de docentes.
`tests/registro-comparativo-cache-browser.cjs` usa `IE_PLAYWRIGHT_MODULE` y permite
guardar solo métricas sintéticas con `IE_COMPARATIVO_OUTPUT`.

## Límites y reversión

Una prueba representa la respuesta consultada, no garantiza conocer una escritura
posterior de otra PC. Los cambios observados de versiones se invalidan de inmediato;
los remotos no observados requieren otra lectura cuando vence la autorización o
el padrón. No se prolonga esa ventana ni se afirma que una reserva abierta cubra
un periodo cerrado. No hay garantía de caché cuando falta una autorización actual.

Revertir el commit devuelve las lecturas por apertura. No hay esquema persistido,
migración ni datos académicos que revertir. Sin merge, deploy ni datos reales.
