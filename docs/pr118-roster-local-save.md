# PR #118 — fallo local al recuperar padrón

Base: `90b9396ad25df30d2e8d4493b18594156245b732`.

## Causa reproducida

En un perfil aislado con generación académica confirmada no nula, `persist()` conserva únicamente asistencia en el registro local original. Si el registro local todavía está vacío, el objeto preparado no contiene `academicEpoch`. El interceptor real de `academic-reset-client.js` añade ese metadato al escribir. `registroLocal.write()` compara exactamente el texto enviado con el leído: falla la verificación y no actualiza su referencia observada. El siguiente intento aparenta un cambio de otra pestaña. El fallo ocurre al pintar el padrón durante la navegación, no depende de una escritura remota ni demuestra una carrera entre escrituras.

Además, `paint()` clasificaba cualquier botón de reintento de padrón visible como fallo de servidor, aunque `errorPadronLocal()` hubiera diagnosticado `saveStore`.

## Ajuste mínimo

- Preparar la escritura con la generación ya conocida por el controlador existente, antes de la comparación exacta. No se modifica el interceptor, el control entre pestañas, el motor N2 ni el contenido académico original.
- Marcar el fallo local con la operación segura en el nodo de estado existente. La nubecita muestra **Error local**; los fallos reales de sesión/red/servidor y conflictos conservan su prioridad. Una persistencia correcta retira la marca.
- Se conservan las guardas de solicitud y token del padrón. No se añaden reintentos, descargas ni escrituras remotas.

## Evidencia diferencial

- Reproducción antes del cambio: falla de verificación al escribir; siguiente lectura rechaza como cambio de otra pestaña. Reproducción en Edge con DOM de Registro, adaptador, controlador de conexión, almacenamiento, protección de generación y precarga reales; backend ficticio.
- Después: 4 pruebas nuevas de integración/normalización exacta aprobadas; 18 pruebas anteriores directamente afectadas aprobadas (incluida la expectativa de conservación histórica adaptada exclusivamente por un normalizador de diff exacto).
- Navegador aislado 1366 y 390 px: lectura de padrón pendiente y navegación rápida 3A → 4B → 5B; el contexto final se conserva. Fallo real de `Storage.setItem` simulado con `QuotaExceededError`: mensaje **Error local**, datos en memoria conservados y recuperación al restablecer almacenamiento. Cero escrituras remotas y cero solicitudes externas.
- Sintaxis y dependencias locales verificadas; `git diff --check` correcto. Suite completa delegada al CI del nuevo commit; no se repite localmente.

## Límites

La causa está demostrada con código real y transporte ficticio; no certifica por sí sola que BeQuiet tuviera exactamente ese estado de generación/almacenamiento. No se accedió a su perfil, notas, backend ni almacenamiento. No se borran datos para reparar una pestaña que ya haya quedado con referencia observada desfasada: se mantienen las protecciones y los borradores. No merge ni deploy.
