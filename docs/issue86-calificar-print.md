# Issue86 — Registro Auxiliar Integral de CALIFICAR

Base actualizada a main posterior al PR87: 4d9d3ab226d4cf34a14bcdb3d140271ae438feb7. Se amplía el mismo PR88 en borrador.

## Diagnóstico reutilizado y cambios nuevos

Las causas ya verificadas eran: validación SIAGIE dentro de Calificar, tabla/nómina separada por competencia y escala elegida por origen en lugar de la modalidad activa. Esas correcciones se conservan; no se repite la auditoría.

La orden ampliada cambia el diseño a **fecha → competencia → capacidad/evidencia**. Se utilizan solo sesiones existentes, ordenadas por fecha y competencia del área. N.º y apellidos/nombres completos permanecen a la izquierda. Los tres niveles de encabezado usan agrupación y tonos sobrios distintos; los nombres completos de competencias/evidencias quedan en una leyenda trazable C/E/fecha.

## Resumen sin confundir Calificar con Promedios

El resumen C1/C2/... aparece al final de la grilla, únicamente en el último bloque. Su dato principal **Cal** se obtiene de notaDesdeSesiones(), sin calcular con un algoritmo nuevo. Si hay una nota directa, se muestra aparte como **Prom: ... · directa** usando notaDirectaAlumno(). La prioridad de esa nota en Promedios y en notaCompAlumno() no cambia. Los resultados son bimestrales, aunque el filtro reduzca las evidencias visibles.

Letras muestra AD/A/B/C. En 0–20 se presenta el número original/resultado existente cuando procede; una letra originalmente guardada como letra se conserva sin inventar un valor exacto. Esta es la misma distinción de presentación de la pantalla. No se modifica ninguna nota.

## Papel y continuación

A4 horizontal con 8 mm de margen. Se eliminó el cambio automático a A3. Si hay demasiadas evidencias, se distribuyen en bloques consecutivos de columnas, cada uno en una página nueva; una tabla puede continuar verticalmente. No se omite ni repite una clave estudiante/fecha/competencia/capacidad. La nómina se repite **solo para identificar las filas en las continuaciones**, no como registros independientes por competencia. El resumen aparece una sola vez al final. No hay bloque vacío final.

Cada bloque repite título institucional y contexto; thead repite fechas/competencias/capacidades en continuaciones verticales. Las filas evitan división. Las evidencias no inventan sesiones: se conservan filtros de día, semana y bimestre.

## Protección y evidencia

Solo cambian generación de impresión, selector, CSS y fixtures. No hay recolectar/guardar/recargar store, solicitudes de nube, cambios en baseline/CAS, A1/B1, roles, cierres, historial, asistencia, recuperación, Apps Script, SIAGIE ni Service Worker. Calificar no exige conclusiones; las validaciones oficiales de Primaria B/C y Secundaria C permanecen intactas.

Las pruebas reutilizadas y ampliadas comprueban ambas escalas, Primaria/Secundaria, registros incompletos, múltiples fechas/capacidades, bloqueos, cero mutaciones y cada clave de evidencia exactamente una vez, además de Cal B + Prom A sin sobrescribir A.

Fixtures autocontenidas sin APIs: [Letras](demos/calificar-integral-letras.html) y [0–20](demos/calificar-integral-numeros.html). Regenerar con node tests/calificar-integral-preview.cjs.

## Comprobación manual mínima pendiente

La previsualización nativa de impresión no es inspeccionable desde el navegador integrado. Abrir únicamente las fixtures ficticias en el navegador habitual y exportar a PDF: confirmar A4 horizontal, filas completas, encabezados repetidos desde página 2 y continuidad de los bloques. El controlador puede sustituir tamaño o escala. No usar notas reales ni confirmar impresión física.

No merge. No deploy. Revisión y autorización individual del usuario pendientes.
