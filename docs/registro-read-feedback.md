# PR #118 — Indicador de lecturas pendientes

Presentación compartida para Calificar, Promedios, Asistencia, consulta histórica y comparativo. No inicia peticiones, guarda datos ni estima porcentajes. El modal de Guardar permanece independiente.

## Estados reutilizados

- Promesa de verificación autenticada ya existente, asociada al binding actual.
- Estado `checking/busy` y versiones confirmadas del cliente N2 por panel.
- Carga de padrón existente; disponibilidad autorizada de reservas del coordinador 2B.
- Decisión de caché histórica existente y secuencia/contexto del comparativo.
- Errores de conexión, servidor, sesión y conflicto; timeouts existentes.

La grilla no confirmada muestra el indicador en su espacio. Una recuperación con datos ya visibles usa un aviso compacto. Las verificaciones silenciosas con autorización vigente no generan animación. El comparativo conserva visible la tabla principal y no muestra indicador al reutilizar históricos válidos.

Las respuestas históricas tardías solo pueden retirar el indicador de su propia secuencia/contexto. No cambian las comprobaciones de identidad, autorización, generación o versiones. Sin temporizadores nuevos de lectura ni reintentos. La animación CSS tiene alternativa estática con `prefers-reduced-motion` y se excluye de impresión.

## Validación diferencial

- `node --test tests/registro-read-feedback.test.cjs`: controlador real IERegistroConnection, motor N2 y adaptador; acceso pendiente, tres paneles, error de red/timeout/sesión, recuperación explícita, CAS, borrador pendiente y modal de guardado independiente.
- Las pruebas históricas siguen ejecutando las funciones reales. Los normalizadores de goldens retiran exclusivamente deltas exactos de presentación; una mutación adicional de Guardar continúa detectándose. Las expectativas antiguas de texto se sustituyen por comprobaciones del componente y del bloqueo académico.
- `node tests/registro-read-feedback-browser.cjs`: Edge real, perfiles nuevos, datos ficticios, transporte simulado y red externa bloqueada. Anchos 1366/390, latencias 3000/5000/10000 ms, carga inicial, verificación silenciosa, recuperación, comparativo frío/caliente, Guardar, red fallida, sesión vencida, timeout, respuesta de contexto anterior y movimiento reducido. Verifica además aula precargada con autorización vigente.
- Capturas y resultados JSON quedan fuera del repositorio en `AIP_PR118_READ_FEEDBACK` del directorio de evidencias local. No se incluyen perfiles ni datos privados.

Las latencias son sintéticas; no certifican el rendimiento ni la compatibilidad del backend desplegado. Las capturas proceden del Registro real con la fixture aislada existente; no acceden a recursos institucionales ni CDN externos.

Resultado local: 3.251 pruebas aprobadas, cero fallidas/canceladas/omitidas. Navegador: 11 escenarios aprobados, cero errores de página ni solicitudes externas. Con retrasos simulados de 3/5/10 segundos, la presentación inicial completa midió aproximadamente 3,9/6,0/11,0 segundos en escritorio y 3,9/6,0/10,9 segundos en móvil (incluye creación de página y renderizado). El salto a un aula preparada midió 205/238 ms, sin lecturas académicas ni nueva autorización; se conservaron dos consultas existentes de estado de plantillas SIAGIE. Reabrir el comparativo válido produjo cero solicitudes. Solo hubo un guardado explícito por escenario de guardado y ningún reenvío automático.

## Alcance y reversión

Producción: solo `registro.html` y `registro-notas2-ui.js`. Sin modificaciones del motor N2, coordinador 2B, backend, CAS, contrato remoto, políticas de caché o Service Worker. Revertir el commit de presentación recupera los mensajes anteriores sin alterar datos persistidos. Requiere revisión del PR; no se realiza merge ni despliegue.
