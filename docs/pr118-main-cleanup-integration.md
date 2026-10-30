# PR #118 — integración con limpieza #119/#120

Referencias: `main a4293de842500a0c96a757978cc0fdf51a603a34`; PR #118 previo `c8a00c8dc30d952f2ec02b03de5848f03b2abc23` (incluye `368dafa` y el ajuste posterior de avisos por contexto).

## Conciliación

- `registro-connection.js`: se respeta su eliminación en main. Su implementación completa —controlador y traza de #118— ya está integrada byte a byte en `registro.html`; no se restaura el duplicado.
- `tests/calificar-integral-print.test.cjs`: se combinan el lector de impresión inline de #119 y las normalizaciones de modal/selección de #118. Se conservan todas las comprobaciones de impresión y seguridad.
- `tests/notas2-selective-integration.test.cjs`: la conciliación automática conserva las normalizaciones de #118 y el lector inline de main; se verifica mediante las pruebas diferenciales.
- Los consumidores de pruebas añadidos por #118 pasan a leer los bloques vigentes con `registro-inline-modules.cjs`. El marcador del controlador identifica también su traza integrada. Los fixtures históricos y de reloj interceptan ese mismo lector, conservando la distinción anterior/actual y las expectativas de caducidad, revocación y recuperación.
- Las retiradas de módulos duplicados, previews y documentos de #119/#120 permanecen. No se incorporan funciones nuevas.

## Equivalencia y evidencia

`registro.html`, `registro-notas2-ui.js`, `registro-notas2.js` y `registro-notas2-prefetch.js` permanecen idénticos al SHA previo de #118: no cambia SIN_PADRON, academicEpoch, avisos locales por contexto, guardado, permisos, CAS ni borradores. Dos regresiones nuevas verifican esta equivalencia y la ausencia de los módulos retirados.

202 casos diferenciales únicos aprobados: 2 nuevos y 200 existentes directamente afectados. Los fallos de lectura de archivos retirados y de selección de versión histórica en fixtures se corrigieron usando el lector inline, sin cambiar sus expectativas; se repitieron solo las pruebas afectadas.

Navegador aislado con transporte ficticio: SIN_PADRON (0 lecturas N2 del periodo ausente y carga normal tras inicializar), avisos por contexto y recuperación de fallo local en 1366/390 px. Tres escenarios aprobados; cero escrituras remotas y cero solicitudes externas. No constituye certificación de BeQuiet o Apps Script real.

Sintaxis, dependencias y ambos `git diff --check` correctos. No se ejecuta manualmente la suite completa: la aprobación final corresponde al CI del SHA integrado.

Esta integración solo actualiza la rama del PR DRAFT. No fusiona #118 a main, no despliega y no accede a datos institucionales.
