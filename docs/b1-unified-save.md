# Bloque B — diagnóstico y propuesta

Base auditada: main bd86c257bb2c70c1577df38e4eb64deae6bbaa49, después del PR #78.
B1 y B2 se separan para revisar guardado e importación independientemente. Sin datos reales.

## B1 — diagnóstico confirmado

- registro.html: Guardar promedios llamaba a guardarRegistroIntegrado(true), usando guardarFinales(): captura directos numéricos, conserva letras originales y guarda store.
- Guardar del pie llamaba a guardarRegistroIntegrado(false), usando guardarTodo(): recolectarPantalla captura evidencia Calificar, directos de Promedios, concComp y asistencia; guarda metadatos y capacidades. Guardar asistencia solo llamaba a saveStore.
- Ambas variantes invocaban IERegistroTransversales.save(): los aportes están separados del store académico y se envían con versión y permisos al servidor. No son un borrador durable offline. Cambiar esto supondría otro diseño de persistencia y recuperación; B1 conserva el contrato vigente.
- onContexto renderiza Calificar siempre, pero Promedios únicamente si está visible. Sus controles ocultos podían pertenecer al área/aula/bimestre anterior, mientras recolectarPantalla construía claves con el contexto actual.

## B1 — implementación mínima

Un único Guardar académico en el pie ejecuta siempre guardarTodo y luego el adaptador transversal existente. Retira Guardar promedios y el Guardar redundante de Asistencia tras comprobar equivalencia. Mantiene guardarFinales disponible por compatibilidad, sin nuevo consumidor UI. Renombra únicamente las etiquetas de Registro a Subir Nube/Bajar Nube, con handlers intactos.

Valida solo lectura, cierre e inputs inválidos antes de recoger. Promedios marca su contexto renderizado; al guardar, sus notas y conclusiones antiguas se excluyen si pertenecen a otro contexto. Una respuesta de otro token/contexto no muestra éxito en el contexto nuevo. No cambia autorización, notas ya persistidas, identidad, cálculo, concArea, asistencia, timestamps ni sincronización A1.

La nota académica se guarda localmente; savereg continúa siendo exclusivo de Subir Nube. Guardar conserva la sincronización transversal anterior. Los mensajes distinguen Registro guardado en el dispositivo, aportes enviados y aportes pendientes. Si falla la red transversal, el trabajo académico queda local y el aporte permanece pendiente en memoria con la advertencia de salida existente. No cerrar esa pestaña sin resolverlo. No se afirma que un aporte pendiente esté persistido offline.

Sin cambios en Apps Script, Sheets, students.js, matrices, módulo transversal ni SW v20. No hay nueva dependencia estática que requiera renovar SW. Una copia HTML offline anterior puede mostrar los botones antiguos; los contratos y almacenamiento siguen siendo compatibles.

## B2 — diagnóstico original y seguimiento

Implementación frontend desde la base posterior al PR #79: [B2 — importación segura](b2-matrix-registry-import.md). El diagnóstico y la propuesta siguientes documentan el comportamiento anterior, reemplazado por lecturas protegidas de nube y confirmación local explícita.

En primaria.html y secundaria.html, traerDesdeRegistro lee ie22375_registro_notas_v2 del navegador. Usa solo estado.areaActual cuando está seleccionada; recorre directos/evidencias y reemplaza conteos inicio/proceso/previsto/destacado sin preview ni aprobación del reemplazo. No verifica si son registros confirmados en servidor. El primer resultado encontrado para una identidad puede prevalecer por orden de iteración; no calcula necesariamente el promedio efectivo completo del Registro.

La ruta de evidencias de Primaria filtra sesión por nivel/bimestre/grado/área, pero no sección, y sus claves de grades solo por nivel/competencia/área. Secundaria filtra además aula/bimestre/capacidad/fecha. Ambos importadores escriben conteos agregados: no poseen un almacén de conclusiones individuales que autorice crear una copia paralela.

Propuesta para PR B2 independiente:
1. Lectura POST protegida loadreg o loadNivel, revisando el contrato vigente; token/configuración server-side como límite. Nunca usar localStorage como evidencia de confirmación en nube.
2. Obtener todas las áreas autorizadas del aula y bimestre y el padrón protegido correspondiente. Reutilizar identidad/catálogos/resultados efectivos de Registro, evitando contar alias duplicados o evidencias arbitrarias.
3. Preview por área/competencia: fuente verificada, versión, totales, ausentes, pendientes y diferencias con conteos existentes. Conservar conclusiones en su fuente oficial; no inventar un esquema para replicarlas en la matriz.
4. Aplicación explícita por contexto: conservar datos consolidados divergentes hasta decidir; no escribir nube automáticamente. Revalidar contexto, permisos/cierre y cambios posteriores antes de aplicar. Dedupe por identidad estable, compatibilidad por nombre inequívoco.
5. Probar área faltante, cierre, filtros alterados, respuestas atrasadas, cancelación, idempotencia, alias y conflictos. Si necesita backend, presentar esa dependencia antes de cambiarlo.

## Validación B1 y revisión

34 regresiones nuevas con valores exclusivamente ficticios: equivalencia de directos 0/8/12/15/20/borrado; captura unificada; letras y timestamps intactos; asistencia/capacidades/historial; cierres/solo lectura; errores de almacenamiento/rango; contextos; Tutor separado; envíos transversales reales contra backend simulado; red/CONFLICT/verificación pendiente; ningún savereg desde Guardar.

Los snapshots históricos normalizan únicamente los cambios B1 mediante b1-snapshot.cjs, y siguen comprobando el resto de funciones/estructura. Las regresiones B1 leen fuente actual sin esa normalización. Las pruebas de calificación masiva siguen comprobando sus mecanismos originales.

Prueba manual mínima en copia aislada con estudiantes ficticios: Guardar desde Calificar y Promedios, cambiar área con Promedios oculto, verificar conclusiones/fechas, y comprobar los mensajes diferenciados con/sin conexión transversal. No usar notas oficiales.

Reversión: revertir el commit B1 del PR, sin eliminar store ni academicSync ni aportes históricos. No requiere desplegar backend ni tocar datos. No hacer merge/deploy sin autorización expresa.

Suite final: 1758 aprobadas, 0 fallidas, 0 omitidas. Sintaxis/dependencias: 83 JS/GS, 28 scripts inline y 54 referencias locales. git diff --check correcto.
