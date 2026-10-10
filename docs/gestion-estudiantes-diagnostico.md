# Gestión de estudiantes: diagnóstico de carga

Base revisada: merge PR #67, 27c5f3694d5bba56fe3bb98cfaae6710fb1b179a. No se consultaron datos reales ni se desplegó código.

## Flujo actual

Admin consulta IEStudents.peek(): caché autorizada del mismo token, hasta 24h y limitada por expiración. Si existe, aplicarBaseServidor pinta inmediatamente y habilita la edición local. Luego IEStudents.load realiza lectura protegida loadstudents, deduplicada. La lectura tiene hasta dos intentos de 12s y pausa de 1.2s: aproximadamente 25.2s, más preparación del puente. fetchJSON limita fetch y lectura JSON. Fallos transitorios pueden devolver offline:true desde caché; rechazo explícito no habilita fallback. checkedLoad rechaza base no inicializada. inspect permite consultar esa base vacía para inicialización manual.

## Defectos comprobables y propuestas (no se cambia transporte ni sincronización en esta fase)

1. cargarEstudiantesAdmin recibe forceNetwork:true pero no lee ese campo: Actualizar consulta usa el mismo load deduplicado. No demuestra una solicitud nueva independiente. Propuesta: definir lectura explícita con contrato de verificación; no limpiar datos para forzar red.
2. load puede devolver offline:true; el mensaje principal distingue esa respuesta, pero una caché previa con offline ausente es pintada por aplicarBaseServidor como servidor antes del mensaje posterior. Los nuevos indicadores visuales distinguen caché, servidor y error; no autorizan escrituras.
3. Una recarga confirma descarte al comienzo, pero aplicarBaseServidor vuelve a asignar estado y bdPendiente=false al resolver la red. Si se edita durante esa espera desde caché, la respuesta tardía puede perder el borrador local. Reproducción: caché → load pendiente → edición/saveEstado → respuesta → borrador reemplazado. Propuesta: guardar revisión local/ID de petición y no aplicar una respuesta si hubo edición posterior; solicitar descarte explícito. Requiere corrección funcional posterior, sin cambiar silenciosamente este flujo.
4. verificar() muestra base de servidor en migracionPreview aunque listas internas contienen CSV. Reproducción: CSV con alumno de prueba A → verificar servidor con B → vista visible B, escritura seguiría enviando A. Corrección mínima aprobada e implementada: conservar la vista previa de cada nivel con CSV seleccionado; presentar la consulta de servidor en los indicadores y la comparación. Las pruebas verifican que vista previa y payload mantienen el mismo CSV, incluso cuando solo se seleccionó un nivel. No se cambia el envío ni la sincronización.
5. Importación manual mergeNivel identifica por nombre, no ID: dos alumnos con el mismo nombre pueden confluir. Se conserva ese flujo en herramientas avanzadas con aviso; usar el flujo SIAGIE principal para matrícula. Propuesta posterior: merge por IDs/códigos y revisión de ambigüedades, manteniendo compatibilidad histórica.

## Presentación añadida

Comparación informativa de CSV contra una consulta de servidor: ID/código exacto, sin fuzzy matching. Duplicados, conflicto de IDs y alumnos sin identidad requieren revisión. No se inventan conteos de nuevos/ausentes si hay ambigüedad. TRASLADADO se cuenta desde estadoMatricula y no se excluye. El análisis no cambia payloads ni confirmaciones; no introduce un segundo sincronizador.

Padrón: cantidad solo tras respuesta online; estado de periodo se consulta con fetchJSON (presupuesto de 12s), sin usar estado de localStorage como verificación. Crear se muestra únicamente con base inicializada, padrón ausente y periodo verificado abierto; backend conserva la autoridad. Si el periodo no se verifica, se indica No verificado.

## Límites

No se puede atribuir una demora de producción a red/Sheets/cold start sin telemetría real; estos hallazgos se derivan del código y pruebas sintéticas. No se usan copias históricas ni datos reales. Validación visual desktop/móvil y prueba manual de CSV vigentes por Admin pendientes. No merge ni deploy.
