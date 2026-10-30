# PR #118 — Indicador del padrón vinculado a su lectura

Base: `dabde52aa4af16345dce24d2be6bb17d9d59de02`.

## Diagnóstico puntual

`cargarPadronRegistro()` es el único escritor de `cargandoEstudiantes`: lo activa al comenzar, lo desactiva al recibir el resultado o error, y lo limpia en finally solo si conserva `solicitudPadron`. Las respuestas anteriores no deben limpiar una solicitud más reciente. Las lecturas de precarga de otros padrones (`readRoster`) no modifican esa bandera.

Defecto demostrado: `readStatus()` interpretaba la bandera global como carga del bimestre de `ctxBase()`, aunque la operación perteneciera a otro bimestre. Se reprodujo una lectura III pendiente presentada como carga de I. La nubecita también usaba la bandera sin esa asociación al elegir el texto.

No se reprodujo un indicador permanentemente visible una vez terminadas todas las lecturas del contexto actual. Una lectura real del padrón puede seguir activa aunque el cliente N2 ya esté listo, haya notas visibles y exista autorización vigente: en ese caso el indicador debe continuar. No se atribuye el caso de BeQuiet a caché, backend ni navegador sin evidencia.

## Corrección mínima

Dos archivos de producción: `registro.html` y `registro-notas2-ui.js`.

- Se identifica en memoria la operación actual mediante solicitud, bimestre y token, sin registrar ni exportar el token.
- El indicador de lectura observa únicamente una operación pendiente del bimestre y sesión visibles. Se limpia la referencia al finalizar la solicitud más reciente; una respuesta vieja no puede limpiarla.
- Se reutiliza la presentación existente, incluida la nubecita. No se oculta el indicador por notas visibles o `canEdit=true`, ni se utilizan temporizadores para hacerlo desaparecer.
- Se conservan sin cambios todas las decisiones de autorización, renovación, permisos, guardado, CAS, motor N2, borradores y recuperación. No se añade ninguna lectura ni escritura.

## Evidencias diferenciales

Seis pruebas nuevas con cargador real de Registro, adaptador N2 y controlador: atribución de otra lectura; lectura lenta y cliente editable; III→I→II→III con respuestas fuera de orden; error; lecturas rápidas; sesión diferente. Pasaron las 6.

Se reejecutaron 28 pruebas existentes directamente afectadas (feedback, restauración y transición del padrón): 34 aprobadas en total, 0 fallidas. Dos fixtures que representaban una lectura real solo mediante el booleano ahora incluyen su operación explícita. El normalizador histórico incorpora exclusivamente el diff exacto; no elimina las comprobaciones de comportamiento ni modifica reglas de seguridad.

Navegador Edge con código real, datos y transporte ficticios, red externa bloqueada: 1 escenario aprobado. Una demora mínima inyectada de 3000 ms mantuvo el aviso; el ciclo observado incluyendo el transporte ficticio y recorrido de la página duró 3284 ms. El aviso estaba oculto al resolver el cargador. Respuestas II→III→I no reactivaron un aviso terminado ni limpiaron prematuramente la operación vigente. Cero solicitudes externas, escrituras académicas o errores de página.

Los casos rápidos usan reloj sintético de 10 ms; no se extrapolan a producción. Sintaxis: 273 archivos JS/GS, 36 scripts inline, 90 dependencias locales; diff sin errores. La suite completa se deja al CI del nuevo SHA. Se reutiliza el CI aprobado de la base (3310 pruebas) para los componentes intactos, sin repetir auditorías ni simulaciones de concurrencia.

## Límite y reversión

La duración de la lectura real de BeQuiet y su eventual finalización no están verificadas desde esta computadora. Esta corrección resuelve la atribución cruzada demostrada; no certifica por sí sola la desaparición de todo indicador persistente real. Sin operaciones institucionales, merge ni deploy. Para revertir: revertir este commit exclusivamente, sin tocar datos ni cachés.
