# PR #118 — Espera obligatoria y lectura secundaria del padrón

Base: `887c99ccff8ff133b7eb103467d13a7fe16c08c4`.

## Causa y corrección

`readStatus().pending` representaba cualquier lectura pendiente del contexto visible. `paintReadFeedback()` utilizaba directamente ese valor para el spinner superior. Una lectura secundaria legítima podía convivir con panel confirmado y autorización vigente, pero conservaba la presentación de una espera que impedía trabajar.

Se conserva `pending` como estado real de la operación y se añade una clasificación exclusivamente visual:

- `backgroundRoster`: lectura del padrón de la sesión y bimestre visibles, panel con versión confirmada, estado ready, sin otra lectura académica activa ni operación busy, y permiso efectivo de edición del panel.
- `blocking`: operación pendiente que no cumple todas esas condiciones.

El spinner y aria-busy superiores observan `blocking`. La lectura secundaria permanece visible en la nubecita: «Conectado · verificando padrón» o «Cambios pendientes · verificando padrón», con descripción accesible explícita. Al finalizar, el estado vuelve al normal. No se oculta una espera por la mera presencia de notas ni solo por canEdit=true.

No se modifican decisiones de autorización, plazos, CAS, motores de guardado, datos, borradores ni sincronización académica. Los errores conservan prioridad. Si falta la concesión válida o el panel no está confirmado, se conserva la espera correspondiente.

## Resultado y diagnóstico

El cargador registra `roster-start` y `roster-end` en IERegistroEditTrace existente, únicamente si el responsable activó ese diagnóstico. Resultados permitidos: ok, timeout, permissions, context-change o error. No se guardan nombres, notas, tokens ni contenido de almacenamiento. Se mantiene la copia inline idéntica al módulo externo; en registro-connection.js cambia únicamente la lista de eventos permitidos del diagnóstico.

Se conservan los timeouts y reintentos existentes del transporte. No se añade un temporizador para fingir que una operación terminó: una lectura lenta sigue pendiente en el estado real y en la nubecita. El timeout o fallo finaliza con su resultado seguro; no produce una confirmación de éxito.

## Verificación diferencial

- 6 pruebas nuevas: Calificar, Promedios y Asistencia con lectura secundaria real; espera sin concesión; resultado y privacidad del trace; cambios locales pendientes junto a la lectura secundaria.
- 41 pruebas existentes afectadas: feedback, ciclo de vida del padrón, restauración de controles y diagnóstico. Todas aprobadas tras corregir la coherencia entre la copia inline y externa del diagnóstico.
- El primer CI detectó dos fixtures de contexto desconocido que simulaban readStatus sin el nuevo campo blocking. Se actualizó exclusivamente ese contrato de la fixture; se mantienen todas las aserciones de spinner obligatorio, ausencia de valores previos, aislamiento y permisos. Las dos pruebas fallidas pasan.
- Se actualiza una expectativa anterior que exigía el spinner superior durante una lectura secundaria editable. Ahora comprueba que la lectura sigue pendiente y observable en la nube, sin exigir el bloqueo visual retirado por esta orden.
- Navegador Edge con cargador, DOM, N2 y controlador reales, transporte ficticio: una lectura con demora mínima de 3000 ms permaneció pendiente durante 3279 ms sin spinner superior; se comprobaron respuestas fuera de orden y paso de espera obligatoria a secundaria al recuperar una concesión válida. Cero escrituras, solicitudes externas y errores de página.
- Sintaxis: 276 archivos JS/GS, 36 scripts inline, 90 dependencias locales; diff sin errores.
- Se reutiliza el CI aprobado de la base (3316 pruebas) para componentes intactos. No se ejecuta otra batería completa local: el CI del nuevo SHA valida la integración completa.

Las pruebas usan únicamente datos ficticios. No certifican el backend efectivo ni sustituyen la observación final en BeQuiet. PR sigue DRAFT; sin merge, deploy ni operaciones institucionales. Reversión: revertir este commit sin tocar notas, perfiles o cachés.
