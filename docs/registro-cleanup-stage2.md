# Limpieza arquitectónica — Etapa 2 (local)

Base: `7df796b899fbb058524865c03bd951646e56546a`.
Rama: `refactor/aip-limpieza-arquitectura`. Sin publicación ni despliegue.

## 2A — Impresión de Calificar

- Comprobada identidad de la implementación inline con `registro-calificar-print.js`, normalizando solo finales de línea y espacios exteriores.
- Retirado un bloque de 78 líneas, sustituido por una etiqueta relativa síncrona en la misma posición. Se conserva la API global, los estilos de impresión y el archivo externo sin cambios.
- Añadida la dependencia al precache v22 todavía no publicado. Si falta el constructor, `prepararImpresion()` informa del error y no imprime, borra el reporte anterior ni modifica notas; no pausa la edición académica por un fallo exclusivo de impresión.
- Se conservan sesiones, claves de evidencias, resultados calculados, notas directas, conclusiones y permisos. No se modifica paginación ni formato de impresión.
- Pruebas de equivalencia del reporte completo y CSS contra el constructor inline original en ambos niveles y escalas; regresiones de carga única, módulo ausente y JavaScript real disponible offline.
- Suite completa: **2590 aprobadas, 0 fallidas, canceladas u omitidas**. Se mantienen las pruebas anteriores de 30/40 estudiantes, 1/3/4/5 competencias, filtros de fechas, encabezados y estilos A4.
- `registro.html`: 3993 → 3917 líneas, reducción neta de 76 líneas incluyendo la protección de carga añadida.

## Conservación y límites

Solo se prueban datos ficticios y transportes aislados. No se inspeccionan ni modifican registros reales, incluidas las prioridades de III Bimestre 2026 y matriz consolidada II Bimestre 2026. Se conservan igualmente todos los demás períodos.
Apps Script, matrices, esquemas persistidos y contratos de nube permanecen intactos. No se incorpora PR #101 ni se corrigen incidentes pendientes de sincronización.
Las comparaciones históricas de pruebas resuelven el nuevo script externo; no se elimina cobertura académica ni se reintroduce el constructor inline en producción.

## 2B — Inventario y consolidación matemática

Inventario focalizado del frontend académico y sus consumidores. Los contratos de servidor se leen únicamente como referencia; no se modifican. Las matrices institucionales se inventarían, no se editan.

| Familia / ubicación | Responsabilidad y decisión |
| --- | --- |
| `registro.html`: `numToLetter`, `letterToNum`, `promedioNums` | Duplicaciones matemáticamente equivalentes a `registro-evaluation.js`. Delegan a esa instancia ya cargada; se mantienen las tres funciones globales como wrappers compatibles. |
| `registro-evaluation.js`: las tres utilidades anteriores | Fuente única del frontend Registro. Umbrales AD≥18, A≥14, B≥11; representantes AD=19, A=15, B=12, C=8; promedio de entradas individuales con el redondeo existente. Archivo intacto, incluida su paridad con GAS. |
| Registro: `pad2`, recolección `.cal-nota`/`.fin-nota`, manejadores numéricos | Redondean/validan entradas antes de clasificar. No equivalen a convertir una cifra decimal directamente a letra. No se alteran. |
| Registro: `notaDesdeSesiones`, `letraEnArea` | Filtran evidencias por contexto, competencia, fecha e identidad; conservan tratamiento histórico de valores y ausencias. No se sustituyen por `resultados`. |
| Registro: `notaDirectaAlumno`, `notaCompAlumno` | Seleccionan nota efectiva y conservan la prioridad de directo sobre evidencias. Implementaciones intactas. |
| Registro: `promGeneralAlumno`, `promReferencialAlumno`, `numeroExactoComp` | Referencial informativo de competencias activas y señal de exactitud numérica. No se convierte en resultado oficial ni se introduce un nuevo promedio de promedios. |
| Registro: `comparativoNotaAnterior` | Lee resultados históricos con filtros y comprobaciones propias, más estrictas que el lector actual en algunos casos. No se unifica. |
| `registro-academic-model.js`: `requiresConclusion`, `statistics`, `worked`, `validate` | Reglas curriculares, estado trabajado, frecuencias y porcentajes sobre evaluados. Primaria conserva conclusión B/C; Secundaria C. No son una duplicación de la media aritmética. Archivo intacto. |
| `registro-evaluation.js`: `valor`, `resultados` | `valor` valida y redondea entradas. `resultados` trabaja con esquema transversal y contabiliza evidencias/capacidades por competencia. No se reescriben. |
| `registro-transversales.js` / `transversales-client.js` | Consumen el motor para evidencias/decisiones; mantienen aportes por área, sugerencias, votos y final del Tutor. No se cambia la consolidación por un promedio numérico. |
| `admin.html`: `numToLetterAdm`, `promedioAdm`, `letraDesdePayload` | Promedio aritmético duplicado, pero conversión con contrato de rango distinto y lectura por contexto/identidad. Fuera de este bloque; Admin intacto. |
| `primaria.html` / `secundaria.html`: `numToLetterMat`, `letraANivelMatriz` | Conversión heredada sin rechazo de rango y traducción a claves `inicio/proceso/previsto/destacado`. No se reemplazan por helpers de Registro. |
| Matrices: `calcularResumenArea`, `resumenAreaEnGrado`, `logroDe`, estadísticas y comparativos | Suman conteos por competencia/aula y porcentajes sobre totales establecidos; normalizan/reparten conteos con su redondeo propio. No equivalen a promediar calificaciones individuales. No se alteran. |
| `matrix-registry-import.js`: `effective`, `number`, `plan` | Resuelve notas de nube con validación finita/rango, tombstones, duplicados, identidad y conclusiones; produce conteos. Se conserva como contrato B2, no como duplicado matemático eliminable. |
| `apps-script/Codigo.js`: `registroEvaluacion_` | Implementación del servidor independiente del navegador; su correspondencia existente permanece probada. No se modifica ni se reemplaza por un recurso del frontend. |

### Equivalencias demostradas y diferencias conservadas

- Se comparan los tres helpers contra `7df796b`: todos los octavos entre −2 y 22, umbrales, números en texto, vacíos, `null`, cero, inválidos y otras coerciones históricas; más casos explícitos y cien arrays deterministas de promedios, sin mutar entradas. Se mantienen validadores y ausencia de notas fuera de las utilidades puras.
- Los wrappers delegan una vez a la instancia existente: no crean un motor por celda ni implementan una segunda fórmula. Sus nombres y consumidores globales permanecen disponibles.
- Diferencia reproducida: `numToLetter(13.5)` es B, mientras `valor({modo:'num',valor:13.5})` primero redondea a 14 y da A. Se conservan ambas operaciones.
- Diferencia reproducida: matrices/Admin convierten 21 a AD y −1 a C; Registro devuelve vacío fuera de 0–20. No se unifican ni se cambia esa validación heredada en esta etapa.
- Diferencia reproducida: con evidencia histórica `{nota20:'ilegible', nivel:'A'}`, `notaDesdeSesiones` recupera A, mientras `resultados` no la cuenta como evidencia numérica válida. Se conserva cada lector, sin seleccionar una política nueva ni tocar registros históricos.
- `notaDesdeSesiones`, `notaDirectaAlumno`, `notaCompAlumno`, `promGeneralAlumno` y `promReferencialAlumno` permanecen iguales a la base. Una regresión enfrenta directo B a evidencia AD y conserva B; las pruebas anteriores mantienen conclusiones y sincronización.

### Dependencias, validación y reversión

`registro-evaluation.js` ya se cargaba y estaba precacheado. Ahora su disponibilidad es obligatoria antes de inicializar Registro y recuperación; si falla, se usa el fallo controlado existente, sin activar edición ni escribir datos. Se verifica también su HTTP 404 en navegador y la conservación exacta de notas/matriz ficticias. No se añade un archivo de producción ni una consulta a servicios.

- 2B reduce `registro.html` de 3917 a 3910 líneas: **7 líneas netas menos**. Etapa 2 completa: 3993 → 3910, **83 líneas netas menos en HTML**.
- Suite final: **2601 aprobadas, 0 fallidas, canceladas u omitidas**. Diez regresiones matemáticas y una dependencia fallida adicional, conservando toda la batería previa.
- Edge: cuatro escenarios de conexión/reconciliación en Primaria/Secundaria a 1366/390 px; diez fallos de dependencia, incluido el motor, con datos ficticios. Sin subidas automáticas ni escrituras académicas en los escenarios de fallo.
- Sintaxis, dependencias locales, finales de línea LF/CRLF y `git diff --check` comprobados.
- Revertir el commit 2B devuelve únicamente los wrappers/guards y sus fixtures; revertir 2A restaura el constructor inline y su precache anterior. No se requiere migrar, limpiar ni restaurar datos para revertir el código. No se ejecuta ninguna reversión.

Las diferencias no equivalentes quedan documentadas y detenidas; no bloquean la consolidación de las tres utilidades cuya equivalencia sí se demostró. Los incidentes pendientes de sincronización siguen fuera de alcance. No se inicia otra etapa después de esta entrega.
