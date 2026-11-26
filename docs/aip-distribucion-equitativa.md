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

## Rondas continuas de Secundaria

El PR #129 podía asignar un segundo bloque a una combinación aun cuando otras seguían pendientes. Además, el relleno descartaba automáticamente meses consecutivos. Este cambio convierte la cobertura de la ronda en una restricción. Se extraen parejas de horas consecutivas en una misma fecha y con la misma identidad académica, sin cruzar el recreo ni contar horas aisladas. Estas horas siguen formando parte de los acumulados y del límite mensual. Los bloques históricos repetidos antes del cierre quedan visibles como anomalías, sin crédito anticipado.

Cada pasada del optimizador conserva la búsqueda acotada y las reasignaciones del PR #129. Dentro de una ronda solo se permite una asignación por combinación. Se considera la cantidad de combinaciones pendientes cubiertas, la cobertura institucional, la escasez, la equidad acumulada, la atención más antigua, la rotación y el balance entre quincenas. Cuando es posible cerrar una ronda, se exploran prefijos cronológicos para adelantar el cierre. Cualquier atención de la siguiente ronda debe comenzar después del último tramo del cierre. Una validación separada reconstruye las rondas y comprueba cada asignación propuesta antes de aplicar el calendario. Si una regeneración invalida un crédito posterior conservado, se detiene y solicita regenerar conjuntamente los meses afectados.

El universo usa el horario institucional vigente y no se reduce cuando se desmarca un curso de un mes. El PIP puede autorizar o revertir una exclusión por año e identidad desde Estadísticas AIP, con confirmación y motivo. El paquete solo agrega estos metadatos, nunca copias de rondas. El backend conserva sus permisos actuales para sincronizar el paquete AIP. La comprobación de edición de exclusiones actúa en la interfaz con el perfil PIP vigente.

### Repetición del escenario del PR #129

Se sirvieron el HTML y los módulos del SHA de integración `0697074` y los del motor por rondas en Edge. Ambos usaron los mismos 24 docentes, 9 secciones, 6 cursos y 10 meses ficticios.

| Indicador | PR #129 | Rondas |
| --- | ---: | ---: |
| Docentes / cursos / secciones | 24 / 6 / 9 | 24 / 6 / 9 |
| Combinaciones con horas programadas | 126 | 126 |
| Universo objetivo / pendientes de ronda | 181 / 56 | 181 / 56 |
| Rondas completas | 0 | 0 |
| Atención pedagógica | 1125 h | 251 h |
| Soporte | 259 h | 696 h |
| Mantenimiento | 0 h | 437 h |
| Máximo mensual por combinación | 2 h | 2 h |
| Repeticiones entre meses consecutivos | 0 | 0 |
| Bloques repetidos sin crédito de ronda | 437 | 0 |
| Conflictos de Colegiado / fuera de horario | 0 / 0 | 0 / 0 |
| Tiempo de generación | 280 ms | 408–424 ms |

En esta prueba, 125 combinaciones tienen bloques completos y otra tiene una hora manual aislada. La reducción de 874 horas programadas corresponde a los 437 bloques que antes se repetían con la primera ronda abierta. En el caso independiente con dos combinaciones compatibles, el PR #129 programa 4 horas en marzo y abril, y el motor por rondas programa 8 y cierra dos rondas. Al retirar el par consecutivo de una combinación, la segunda ronda queda bloqueada. También se probó el cierre de 60/60 con un segundo bloque válido ese mismo día, el bloqueo con 59/60 y 12 rondas sucesivas sin un tope artificial.

La búsqueda no certifica que sea imposible mejorar la cobertura de un calendario dado. La comprobación de compatibilidad y persistencia usa datos ficticios y transporte simulado. Las horas nominales de los tramos históricos se muestran según la configuración pedagógica vigente.
