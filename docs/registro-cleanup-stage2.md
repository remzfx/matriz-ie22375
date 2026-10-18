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
