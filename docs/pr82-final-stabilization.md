# PR #82 — estabilización final

HEAD recibido: `fb7cd798427227b394764d0713aa716b91e98627`. Se revisó el CI fallido [38631066077](https://github.com/remzfx/matriz-ie22375/actions/runs/38631066077): 2126 aprobadas, cuatro fallidas. Esta fase no cambia archivos de producción.

## Causa exacta de los cuatro fallos

Entre el HEAD con CI aprobado `c0e7d47b27fdbd9abd138963a93427d797d42971` y el recibido solo cambió `registro.html`: Sección pasa a ser la tercera columna directa, aumenta la separación horizontal a 24 px y se ocultan Grado/Sección desde el CSS inicial. Eventos, IDs, scripts y lógica académica permanecen iguales.

| Prueba | Expectativa antigua y causa |
| --- | --- |
| B2 demonstration isolates all data/transport/persistence… | Compara Registro con `f3247e6` tras normalizar mejoras anteriores. La estructura nueva de Sección no estaba normalizada. Las aserciones de aislamiento, transporte y backend no fallaron. |
| B2 matrix wiring reads all areas… | Compara Registro con `e41a985…` usando el mismo snapshot visual antiguo. Quedó la diferencia de estructura de Sección; las lecturas protegidas, importador y confirmación explícita no cambiaron. |
| Final stabilization preserves ALL reviewed production source… | Compara bytes con `0d20b148…`; aparecieron la nueva estructura y los dos ajustes CSS aprobados. |
| Entire original source is unchanged outside explicit presentation/statistics additions… | El snapshot elimina el bloque CSS visual autorizado, pero no devolvía la estructura nueva de Sección a la referencia antigua. |

Los cuatro fallos son expectativas históricas desactualizadas. No se detectó una regresión funcional en estas diferencias. No se cambian Apps Script, Service Worker, Registro, conciliador, permisos ni contratos del servidor.

## Ajuste de pruebas sin ocultar regresiones

`tests/registro-context-layout-snapshot.cjs` usa los dos HEAD anteriores como referencias y admite únicamente la estructura exacta aprobada y las reglas CSS exactas. Exige límites del bloque, una sola aparición y los eventos originales. Restituye esas diferencias solo para contrastar los snapshots históricos; cualquier otra diferencia sigue llegando a sus comparaciones byte a byte. La normalización causal previa se mantiene intacta.

El snapshot visual compartido incorpora este paso; la comparación de la auditoría final lo aplica únicamente a `registro.html`. No se eliminan pruebas ni assertions. Los tests B2 de seguridad continúan comprobando permisos, lectura protegida, transporte, aislamiento de datos y ausencia de escrituras no solicitadas.

Las cuatro regresiones nuevas leen el HTML actual sin normalizar para verificar tres columnas directas, selectores ocultos por CSS inicial, controles compactos, IDs/eventos únicos y scripts académicos idénticos. También prueban que la guarda rechaza mutaciones ficticias de eventos, separación y duplicación de reglas y que una alteración del coordinador académico no se oculta.

## Validación y límites

243 pruebas focalizadas aprobadas: cuatro fallos anteriores, nuevas guardas, conciliación/recuperación A1, B1/B2 e identidad histórica. La suite incluye descarga y reapertura sin conflictos repetidos, notas pendientes, conflictos reales, conclusiones, claves históricas, recuperación, versiones y CAS. No hay acceso a notas oficiales: datos ficticios y entornos aislados.

Suite completa local: **2134 aprobadas, 0 fallidas, 0 omitidas, 0 TODO**. Sintaxis: 112 archivos JS/GS, 28 scripts inline y 67 dependencias locales. `git diff --check` sin errores. CI del HEAD final se registra en el PR. Se conserva exactamente el diseño aprobado del HEAD recibido; no se realiza un rediseño ni se afirma una nueva validación visual en navegador.

Los riesgos y el procedimiento seguro de validación de 1.º A siguen en [corrección causal](a1-causal-correction.md) y [diagnóstico](a1-critical-diagnostic.md): preservar borradores privados y versión remota, no borrar almacenamiento ni resolver masivamente conflictos, verificar recurso actualizado en ambos equipos y revisar cambios efectivos por contexto/identidad antes de autorizar escrituras oficiales. El incidente de producción no se declara resuelto. Sin merge ni deploy.
