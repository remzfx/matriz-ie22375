# Issue86 — impresión integral de Calificar

Base: main posterior al PR85 (`8d2c1dbf8254f3c9757f7ae97a0479eb4fa5c794`). Diagnóstico limitado a impresión y sus consumidores directos.

## Causas y corrección

- `prepararImpresion()` reutilizaba `validarConclusionesOficial()` para el bimestre completo: provocaba una advertencia SIAGIE desde Calificar. La impresión auxiliar ya no la llama. Las reglas oficiales siguen intactas.
- Generaba una tabla, nómina y salto de página por competencia. Ahora produce una sola grilla con C1/C2/... → fecha → evidencia abreviada, más resultado por competencia. La leyenda conserva nombres completos y correspondencia C/E/fecha.
- Las celdas se elegían por `origen`, ignorando `modoCalif`. Ahora Letras usa el nivel existente y 0–20 el número original cuando existe. Una nota originalmente en letras sigue representada por su letra en modo numérico, como en pantalla, sin inventar equivalencias exactas.

El botón independiente «Imprimir detalle de evidencias» desaparece. La acción general Imprimir/PDF abre «Imprimir general · Calificar», por defecto para todo el bimestre; conserva filtros diario/semanal. Otras pestañas conservan sus botones y rutas.

Resultado significa resultado efectivo **bimestral**, con prioridad de la nota directa de Promedios. El filtro de fechas limita evidencias, no recalcula ni reemplaza resultados del bimestre. Se identifica si el resultado es directo o calculado. Falta de nota se imprime como `—`.

## Protección y validación

`IECalificarPrint.build()` es un generador de HTML de solo lectura. El wrapper lee contexto/padrón/notas actuales y llama a `window.print()`: no recolecta controles, no recarga store, no guarda, no toca baseline/CAS ni solicita nube. Conserva proyección histórica y autorización del contexto. No modifica Apps Script, Service Worker, matrices, asistencia, roles ni cierres.

Las regresiones usan exclusivamente datos ficticios: 1/3/4/5 competencias, 30/40 alumnos, ambas escalas, múltiples fechas/capacidades, sesiones duplicadas, faltantes, prioridad directa, bimestres cerrados y autorización. Comparan todo el estado antes/después y mantienen los guards de las funciones académicas/otras impresiones. El normalizador histórico admite solo hashes exactos de los dos wrappers de impresión autorizados y el módulo/CSS probado; no ignora cambios académicos arbitrarios.

Vistas autocontenidas sin APIs: [Letras](demos/calificar-integral-letras.html) y [0–20](demos/calificar-integral-numeros.html). Regenerar con `node tests/calificar-integral-preview.cjs`. Inspeccionadas en navegador con datos ficticios.

## Papel, paginación y límite pendiente

- A4 horizontal, márgenes de 8 mm; A3 horizontal cuando hay más de 28 columnas de evidencia/resultado. Fuentes de 6–8 puntos y nombres completos con ajuste de línea.
- `thead` repetible; filas sin división; ninguna competencia provoca un salto ni una nómina nueva. No se descartan columnas.
- La previsualización nativa no pudo inspeccionarse mediante el navegador integrado. Comprobación manual mínima: abrir las dos fixtures, imprimir a PDF con el navegador habitual y confirmar tamaño horizontal, filas completas y repetición de encabezados desde la segunda página. No usar notas reales ni confirmar una impresión física.
- Un bimestre excepcionalmente ancho puede requerir papel A3 o filtro diario/semanal para mantener legibilidad. El navegador/controlador puede sustituir el papel o reducir escala; revisar antes de imprimir.

Sin merge ni deploy. Un único PR en borrador para revisión del Issue86.
