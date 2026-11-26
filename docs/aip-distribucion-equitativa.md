# Distribución equitativa y estadísticas AIP

El generador anterior elegía parejas en el orden del calendario y volvía a calcular sus prioridades para cada mes. Contaba principalmente visitas por sección. Una elección temprana podía agotar el único bloque de otro docente, y la comparación de las dos horas no exigía que pertenecieran al mismo curso.

El generador actual construye primero las parejas compatibles a partir del horario, la plantilla semanal del PIP, las áreas habilitadas y las reservas de colegiado. Para cada año lee el calendario directamente. Conserva las asignaciones de los meses no seleccionados y las marcas manuales, y excluye las asignaciones automáticas que se van a sustituir. Una sola propuesta coordina todos los meses seleccionados del mismo año. La propuesta se valida antes de persistir el plan. Si la validación o el guardado local fallan, se conserva el plan anterior.

## Prioridades y desempate

El motor usa dos horas consecutivas del mismo docente, área y sección. Una combinación puede ocupar un solo bloque automático por mes. Cualquier hora manual existente de esa combinación cuenta para el límite de dos horas. Los excesos manuales se conservan y se informan. Las horas no asignadas pasan a Soporte o Mantenimiento.

Se realizan tres recorridos de cobertura y hasta tres rondas de realocación. Al evaluar una alternativa se consideran, en orden, docentes cubiertos, cursos y secciones cubiertos, combinaciones cubiertas, oportunidades escasas, equidad de horas, repeticiones y bloques asignados. La escasez se estima con el inverso de las oportunidades compatibles. Para la equidad se usan rendimientos decrecientes del total de horas con mayor peso para docentes. Los empates se resuelven por fecha, hora de inicio e identidad normalizada. Los bloques de relleno no agregan repeticiones consecutivas. El informe identifica las repeticiones que permanecen en la solución.

Para cada bloque sobrante se recalcula la ganancia de equidad sobre las horas anuales confirmadas en el calendario y las ya propuestas por el motor. Ante igual ganancia por docente, área y sección, se prefiere la combinación con menos horas. Los empates finales conservan el orden estable de candidatos. Los excesos de meses conservados distinguen horas con marca manual y horas heredadas sin esa marca. El origen de estas últimas no puede confirmarse en registros anteriores a la marca manual.

La búsqueda considera un conjunto acotado de realocaciones. El resultado es determinista para la misma entrada y no certifica un óptimo global. Dos combinaciones con oportunidades compatibles pueden competir por las mismas horas. El universo institucional mostrado se construye del horario docente vigente y la matriz también conserva combinaciones presentes en el calendario del año. Primaria mantiene su asignador por grado.

## Comparación con el mismo calendario ficticio

Se ejecutaron ambos generadores en Edge con 24 docentes, nueve secciones, seis áreas y diez meses, incluyendo colegiado, excepciones y atenciones manuales. Las mediciones corresponden a la misma máquina con dos tamaños de ventana.

| Indicador | Anterior | AIP 2.0 |
| --- | ---: | ---: |
| Docentes cubiertos | 24 | 24 |
| Secciones cubiertas | 9 | 9 |
| Áreas cubiertas | 6 | 6 |
| Combinaciones diferentes cubiertas | 70 | 126 |
| Docentes pendientes | 0 | 0 |
| Máximo de horas mensuales por combinación | 10 | 2 |
| Repeticiones en meses consecutivos | 69 | 0 |
| Horas de atención programadas | 821 | 1125 |
| Conflictos de colegiado | 0 | 0 |
| Asignaciones fuera de horario | 0 | 0 |
| Generación, ventana de 1366 px | 39 ms | 269 ms |
| Generación, ventana de 390 px | 39 ms | 269 ms |

En el caso de regresión, A partía con cuatro horas y B con dos. Con un único bloque disponible y la misma cobertura, la primera versión de AIP 2.0 daba el bloque a A (6/2). La asignación dinámica se lo da a B (4/4).

## Persistencia y reversión

Estadísticas y matriz se calculan a partir del plan, sin persistir una segunda copia del historial. Solo la acción explícita de subir envía un paquete a la nube. Se conserva la lectura del formato anterior. Si el JSON supera 49.000 caracteres, el frontend utiliza gzip y Base64. El paquete anual del escenario ficticio ocupó 11.318 caracteres y se recuperó íntegramente con transporte simulado. Si el navegador no admite compresión o el resultado supera el límite, el plan queda en el dispositivo y la subida se rechaza. Un frontend anterior no interpreta el paquete comprimido. Antes de revertir el frontend, cualquier plan comprimido debe conservarse en un cliente compatible. No se probó la nube institucional.
