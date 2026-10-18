# Etapa 3B — preparación de sesiones y capacidades

Base: `076da3b0fbc066129fa03ef12a9b575d6534e749`.
Rama local: `refactor/aip-limpieza-arquitectura`.

## Caracterización y alcance

El primer commit incorpora seis pruebas ejecutables contra el código anterior,
antes de extraer. La comparación toma `git show 076da3b:registro.html`; después
de la extracción se amplió a nueve pruebas. Los datos son ficticios.

Inventario relevante:

| Función | Responsabilidad y decisión |
| --- | --- |
| `fillComps`, `capsOficiales`, `fillCaps`, `onCapSel` | Catálogo CNEB/transversal y controles DOM. Se conservan íntegros. |
| `capacidadElegida` | Lectura DOM conservada; selección entre valor oficial y Otra, y trim, delegados a función pura. |
| `normCapItem` | Conserva nombre global por consumidores reales en carga, apertura y activación. Normalización delegada. |
| `capsDeComp` | Conserva nombre por consumidor real en Promedios. Preparación de capacidades delegada. |
| `onSesionChange`, `abrirSesionFecha` | Conservan efectos, orden, selección y sesión activa; solo delegan filtrado por contexto/fecha. |
| `renderSesiones` | Conserva su comparación estricta de grado, orden por fecha/ts, HTML y listeners. No se fuerza equivalencia con lectores que aceptan grado numérico/texto. |
| `activarSesion`, `quitarCapGrilla`, `borrarSesionFecha`, `upsertSesionCap` | Guardas, confirmaciones, mutación y almacenamiento intactos. |
| `loadCapsElegidas`, `saveCapsElegidas`, `tieneCapSel`, `keyCapsHoy` | Selección, identidad de capacidad y persistencia intactas; no crear otra fuente de estado. |

La búsqueda global confirmó consumidores de los tres wrappers. No se eliminan
adaptadores con uso real ni el no-op histórico `renderChipsCaps`, que todavía
tiene llamadas; su eventual retirada requeriría una revisión propia.

## Fuente única y complejidad real

Se reutiliza `registro-grading.js`; no hay archivo, dependencia ni capa nueva.
API pura añadida:

- `sessionsOn(sessions, context, date)`: contexto y fecha explícitos, sin ordenar,
  deduplicar ni escribir sesiones.
- `capabilityValue(selected, custom)`: devuelve la selección o el texto de Otra,
  con el trim anterior. El adaptador sigue leyendo el campo custom solo cuando
  corresponde, sin añadir nuevos estados ni restricciones.
- `normalizeCapability(item, fallback, isTransversal)`: conserva cadenas
  históricas, fallback, nombres exactos y clasificación de origen. La regla
  transversal es una dependencia explícita suministrada por el adaptador.
- `capabilitiesFor(sessions, context, competence)`: conserva primera fecha y
  primera aparición, trim solo para este resumen y deduplicación histórica.

El helper privado `inContext` centraliza las comparaciones exactas, incluyendo
`String(grado)`. Lo reutilizan `sessionsFor` y `sessionsOn`. Los cuatro predicados
antes copiados en cálculo, resumen de capacidades, cambio y apertura de fecha
quedan en una sola implementación. La variante visual estricta no se modifica.

Esto reduce mantenimiento de reglas duplicadas, además de mover líneas: tres
wrappers pierden la implementación de decisión/preparación y el módulo puede
probarse con entradas congeladas sin DOM. Los handlers siguen siendo dueños de
efectos. No se creó un segundo estado de sesiones ni otro mecanismo de guardado.

Medidas por función del HTML (líneas, incluidas firma y cierre):

| Función | Antes | Después |
| --- | ---: | ---: |
| `capacidadElegida` | 5 | 4 |
| `normCapItem` | 6 | 3 |
| `capsDeComp` | 14 | 3 |
| `onSesionChange` | 14 | 13 |
| `abrirSesionFecha` | 25 | 22 |

HTML: **3892 → 3873**, 19 líneas netas menos.
Módulo: **30 → 49**, 19 más. Total de producción: **sin aumento neto**.
No se declara reducción de complejidad global por contar líneas trasladadas;
la mejora comprobable es eliminar copias del predicado y separar decisiones
puras de DOM/store, conservando diferencias intencionales.

## Equivalencia y datos conservados

Se mantiene orden de sesiones, selección y primera sesión activa, unidad,
fechas y claves históricas. El resumen de capacidades puede deduplicar su lista,
como antes; esto no deduplica sesiones ni altera ponderación de evidencias.
La clasificación académica/transversal no cambia. Capacidades seleccionadas y
competencias no trabajadas siguen en sus handlers y guardas actuales.

No cambian cálculo, prioridad de directos, conclusiones, identidad, nube,
A1/B1/CAS, permisos, cierres, padrón, asistencia o esquemas persistidos. No se
tocan Apps Script, matrices, usuarios ni problemas de conexión; sin PR #101.
No se accedió, eliminó ni alteró ningún dato real, incluidos los registros
prioritarios de Ninoska Galindo III/2026 y matriz consolidada II/2026.

## Validación ejecutada

- Caracterización previa: **6/6** antes de cambiar producción.
- Pruebas focalizadas de preparación, equivalencia de notas, selección por
  defecto e integración transversal: **150/150**.
- Preparación ampliada, límites históricos y pureza: **40/40**.
- Suite final `node --test tests/*.test.cjs`: **2624 aprobadas, 0 fallidas,
  0 omitidas, 0 canceladas**. Son nueve pruebas más que Etapa 3A.
- Edge real aislado: cuatro escenarios Primaria/Secundaria × 1366/390 px,
  30 alumnos ficticios: selección oficial CNEB, agregar dos capacidades,
  reselección sin duplicar sesiones, AD/A/B/C, nota 15, retirada de una
  capacidad, reapertura de fecha, persistencia local, conservación de directo B
  y conclusión. **Cero llamadas remotas**. Fixture existente con servidor
  simulado; red externa bloqueada y perfiles nuevos, sin almacenamiento real.
- La primera ejecución del fixture nuevo omitía la dependencia de conexión y
  fue rechazada por el guard de arranque; se corrigió reutilizando el fixture
  completo existente, sin cambiar ni relajar el guard de producción.
- Sintaxis y dependencias: `node scripts/check-source.cjs`.
- Revisión manual del diff y `git diff --check`.

Los goldens históricos conservan un adaptador test-only para cinco cuerpos
exactos conocidos; no se acepta cualquier implementación. Las nueve pruebas
comparativas y el navegador ejecutan los wrappers nuevos y el módulo real,
independientemente de ese adaptador. No se retira cobertura de seguridad.

## Archivos y dependencias restantes

Producción: `registro.html`, `registro-grading.js`.
Pruebas: `tests/registro-session-preparation.test.cjs`,
`tests/registro-capabilities-browser.cjs`, `tests/registro-script-fixture.cjs`.
Documentación: este archivo.

El HTML conserva DOM, contexto, estado seleccionado, sesión activa, stores,
confirmaciones y guardas. El catálogo CNEB y reconocimiento transversal siguen
en sus fuentes originales. La carga y precache existentes incluyen el módulo;
no se cambia SW v22, porque no se añade un recurso ni se publica esta rama.
Cuando se autorice distribuir, HTML y módulo deben publicarse coherentemente.

## Límites y reversión

Se preserva incluso el comportamiento heredado de nombres como `constructor`
en la deduplicación del resumen; no se aprovecha la limpieza para cambiarlo.
Los fixtures no certifican datos reales, servicios oficiales ni publicación.
No hay CI remoto nuevo: no se ha autorizado push ni PR.

Revertir el segundo commit de esta etapa restaura los cuerpos inline y la API
anterior del módulo, sin tocar almacenamiento ni necesitar migraciones. El
primer commit de caracterización puede conservarse. No se ejecuta reversión.

Candidatos posteriores, solo para revisión: caracterizar preparación de fechas
de la lista visual y aislar catálogos de UI sin cambiar contratos. Los handlers
de mutación y los lectores históricos se conservan hasta tener pruebas propias.
No se inicia otro bloque. Sin push, PR, merge ni deploy.
