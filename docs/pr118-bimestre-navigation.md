# PR #118 — verificación al cambiar de bimestre

Base diferencial: `e8a9fe82a2b4dec0bb681af40f9818c02c1d4f61`.
Datos, cuenta, almacenamiento, reloj y transporte exclusivamente ficticios.

## Causas demostradas

En la primera visita a un periodo sin padrón cacheado, `cargarPadronRegistro()`
deja temporalmente `padronBimestre` distinto del selector. Sus notificaciones
llaman a `refresh()` y programan un check mientras `authorized()` todavía es
falso. El coordinador publica `session`; el callback del adaptador elimina el
alcance compartido. Cuando llega el padrón vuelve a solicitar `academicstate`,
aunque el alcance anterior cubría ese periodo y todavía no había vencido.
Cambiar de aula sin cambiar de padrón no genera esta ventana.

Con caché y autorización vigentes, los regresos ya evitaban `academicstate` y
`loadnotas2`: no se atribuye al código un fallo no reproducido en ese caso.

Además, la primera comprobación calculaba `lease` antes de recibir el alcance.
Aunque aceptaba el alcance de 60 segundos, no devolvía su límite al coordinador,
que aplicaba su valor genérico de 150 segundos. La regresión reproduce ese
exceso y comprueba que el límite emitido se respete desde la primera concesión.

## Corrección mínima

Solo cambia `registro-notas2-ui.js`:

- `refresh()` espera la lectura de padrón existente antes de programar una
  comprobación automática si el contexto todavía no está autorizado. La edición
  sigue bloqueada por `authorized()`/`canEdit()`. Los checks forzados y Tutor
  conservan su recorrido. No se oculta un spinner de una solicitud en curso.
- El resultado de verificación toma también el alcance recién emitido para
  conservar su vencimiento original, sin renovar ni ampliar su duración.

No cambia el backend, TTL, CAS, guardado, borradores, asistencia, motor de
conexión, coordinador de precarga ni políticas de caché/padrón. Perfil, usuario,
token, permisosVersion y generación mantienen las comprobaciones existentes.
La versión independiente del padrón no forma parte de `prefetchOwner()` y una
actualización normal no retira el alcance; su ventana temporal de carga sí
provocaba el falso estado de sesión descrito arriba.

## Mediciones diferenciales

Reloj virtual, 4000 ms por respuesta. A = academicstate, N = loadnotas2,
P = loadstudents. No son mediciones de producción ni tiempos reales de navegador.

| Transición | Antes A/N/P | Después A/N/P | Listo antes → después |
|---|---|---|---|
| Inicio III | 1/1/1 | 1/1/1 | 12080 → 12080 ms |
| Primera I | 1/1/1 | 0/1/1 | 12080 → 8080 ms |
| Regreso III | 0/0/1 | 0/0/1 | 30 → 30 ms |
| Regreso I | 0/0/1 | 0/0/1 | 30 → 30 ms |

En los regresos, la actualización de padrón continúa por su ruta protegida
existente (~4080 ms hasta terminar en esta simulación); la consulta ya queda
disponible antes. I y III conservan identidades y versiones de padrón distintas.
Con latencias de 3000 y 5000 ms, cambiar de grado/sección dentro de los periodos
cubiertos no requiere academicstate; volver a clientes cargados tampoco
descarga notas. Un aula nueva descarga su registro una vez.

Al vencer el alcance se revalida sin descargar de nuevo un cliente inicializado.
Los periodos cerrados quedan excluidos del alcance por diseño del backend
actual (regresiones anteriores reutilizadas, no reejecutadas). La prueba de I
cerrado mantiene solo lectura y sus comprobaciones: una en visita fría y dos
en regreso cacheado, por pintado de caché y posterior refresco del padrón. Ese
caso puede mostrar notas durante la verificación; no se lo disimula ni se
habilita edición. No se ha consultado la configuración institucional real.

Verificación local diferencial: seis regresiones nuevas y dos comprobaciones
históricas existentes directamente afectadas. Se reutilizan los otros 3264
resultados del último CI durante el desarrollo, sin reejecutar suites de backend,
CAS, guardado, asistencia ni simulaciones de carga. La suite completa corresponde
únicamente al CI automático del SHA final. Las listas históricas admiten solo
los deltas literales de esta corrección y detectan mutaciones de seguridad.

Sin operaciones institucionales, merge ni deploy. PR #118 sigue DRAFT.
