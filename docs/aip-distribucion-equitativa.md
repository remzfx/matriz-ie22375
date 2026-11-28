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

## Inicio dinámico y cierre temprano de rondas

En el PR #130 la búsqueda de prefijos solo adelantaba rondas completas. Una ronda incompleta podía conservar asignaciones tardías favorecidas por el equilibrio entre quincenas. Ahora el motor busca primero la mejor cobertura que encuentra con todas las oportunidades disponibles. Luego busca un prefijo más temprano que conserve o mejore esa cobertura, tanto si la ronda se completa como si sigue abierta. Conserva la mejor solución encontrada y usa las reasignaciones existentes. Dentro de un prefijo, adelantar las asignaciones precede a escasez, cobertura por docente, curso y sección, equidad, tiempo sin atención y rotación. El cálculo por quincenas se retira. La búsqueda acotada no certifica cobertura ni fechas óptimas en términos matemáticos.

En Secundaria, marzo a diciembre define los meses habilitados. La fecha y las horas de inicio se obtienen de las oportunidades que resultan de los meses marcados, el horario docente, la plantilla PIP, los cursos y las restricciones del calendario. Una oportunidad temprana se conserva cuando es compatible con la cobertura que encuentra el motor. Enero y febrero se mantienen en el calendario y en los acumulados, sin acreditar rondas ni regenerarse automáticamente en Secundaria. La operación de Primaria conserva sus meses y reglas.

Estadísticas muestra los créditos acumulados por mes, rondas cerradas, horas de atención, Soporte, Mantenimiento y los dos universos de cobertura. El informe de generación asigna un motivo a cada tramo de Soporte y Mantenimiento y distingue un tramo incompatible de una oportunidad compatible que la búsqueda no asignó. Si una regeneración deja sin crédito un bloque posterior conservado, indica los meses concretos que requieren regeneración conjunta.

### Mismo calendario ficticio del PR #130

| Medida | PR #130 | Cierre temprano |
| --- | ---: | ---: |
| Combinaciones acreditadas en marzo | 13 | 57 |
| Combinaciones acreditadas hasta abril | 27 | 112 |
| Combinaciones acreditadas hasta mayo | 39 | 125 |
| Último bloque acreditado de la primera ronda | 22 dic. | 22 may. |
| Cobertura al terminar / rondas cerradas | 125 de 181 / 0 | 125 de 181 / 0 |
| Horas programadas en marzo / total anual | 26 / 251 | 114 / 251 |
| Horas de Soporte / Mantenimiento | 696 / 437 | 696 / 437 |
| Repeticiones dentro de una ronda / colisiones con Colegiado | 0 / 0 | 0 / 0 |
| Tiempo de generación en Edge | 419 ms | 417–432 ms |

Las 56 combinaciones pendientes siguen bloqueando el inicio de la segunda ronda. La hora programada en febrero explica la diferencia entre 250 horas escolares de atención y 251 horas acumuladas. En el escenario completamente compatible de dos combinaciones se cierran diez rondas desde marzo hasta diciembre con 40 horas. Los casos de inicio dinámico cambian plantilla y horario. El primero llega al miércoles 25 de marzo en las horas 5–6 después de restricciones de calendario y un bloqueo. El segundo llega al jueves 21 de mayo en las horas 1–2 tras omitir abril por curso desmarcado, una fecha de vacaciones y una reserva de Colegiado. Estas fechas son datos de las pruebas.

### Vista previa local aislada

Abre la rama en VS Code. Desde la terminal del repositorio ejecuta `node tests/aip-distribucion-browser.cjs --preview` con Playwright disponible y Edge instalado. Si Playwright está instalado fuera del repositorio, configura `IE_PLAYWRIGHT_MODULE` con su ruta. La vista previa carga la página real con un año ficticio, intercepta las solicitudes de nube y bloquea recursos externos. Para aplicar Tailwind, indica una copia local de `tailwindcss.js` en `IE_AIP_TAILWIND`; sin ella se aplica un respaldo mínimo de estilos. En Plan del mes, abre marzo o abril y revisa «Motivos de Soporte y Mantenimiento». En Estadísticas AIP consulta «Cobertura acumulada y horas de Secundaria». Cierra Edge para terminar.

### Plantilla semanal y regeneración

La vista previa carga la plantilla solicitada como dato ficticio, con 6 horas en Primaria y 24 en Secundaria antes de las reservas de Colegiado. Redibuja la cuadrícula con esa configuración y la guarda en el perfil aislado. Los botones de la plantilla modifican la misma configuración que usa el generador y que viaja en el paquete AIP.

Ambos niveles filtran las horas automáticas por la disponibilidad semanal y comprueban grupos, Soporte y Mantenimiento en el borrador antes de guardar. Si una asignación incumple la plantilla, se conserva el plan previo. Cerrar una hora deja en gris sus asignaciones automáticas en el calendario y las aparta de las estadísticas vigentes. Al regenerar se retiran del mes seleccionado. El historial almacenado de otros meses y las excepciones manuales protegidas se conservan.

La vista previa usa un horario ficticio de 9 secciones y 6 áreas con un responsable estable por curso y sección. Hay docentes que imparten más de un área y atienden varias secciones en tramos distintos. Con la plantilla de 30 horas, el escenario anual acreditó las 54 combinaciones, completó tres rondas y alcanzó 52 de 54 combinaciones en la cuarta. Se verificaron cero cruces docentes y un máximo de dos horas por curso y sección en cada mes. La comparación histórica de rendimiento conserva su conjunto de datos original.

### Personalizaciones del calendario y Colegiado

Las personalizaciones del calendario se guardan en la fecha, nivel y hora correspondientes. Vacío guarda una celda explícita y Colegiado asignado desde el calendario se guarda como `colegiado-manual`. La recurrencia y su rotación se mantienen por separado. La misma resolución se usa para el calendario, las ocurrencias recurrentes efectivas, las estadísticas y la generación. Una edición individual reemplaza una sola hora. Una nueva edición de columna reemplaza sus horas pedagógicas y conserva el manejo visual del recreo.

**Restablecer programación original** quita la personalización de la hora o columna. **Limpiar** retira todas las personalizaciones del mes. Guardar, recargar y sincronizar usan el mismo paquete AIP, sin un registro adicional de excepciones. Los feriados globales mantienen su tratamiento preexistente.

### Reasignación adaptativa de bloques

La comparación utiliza el merge del PR #132 (`a4f0e4d`) y las mismas entradas para ambos motores. Cada curso y sección tiene un responsable estable. En el caso de ocho combinaciones, el calendario disponible admite las ocho, pero la búsqueda anterior terminaba con siete. Llegar al bloque libre exige mover varias asignaciones consecutivas. En el calendario anual de 54 combinaciones, las siete pendientes pertenecían a la cuarta ronda. Con una combinación adicional que solo tiene un tramo aislado, las 54 compatibles quedan acreditadas y la primera ronda queda abierta.

Después de la optimización existente, la nueva búsqueda recorre primero las combinaciones pendientes con menos bloques. Intenta liberar cada bloque desplazando únicamente asignaciones automáticas de su propuesta, y revierte toda la cadena si no logra recolocarlas. Conserva la selección de prefijos tempranos, el cierre de rondas al 100 %, los límites mensuales y el calendario protegido. La búsqueda por prefijo tiene una profundidad de hasta ocho y un presupuesto finito, por lo que puede quedar una solución mejor sin explorar.

Hora AIP libre permite asignaciones automáticas dentro de la plantilla vigente. Si el generador usa esa hora, el plan conserva la apertura como parte de la asignación para poder restaurarla antes de regenerar. Vacío, los bloqueos, los demás ajustes protegidos y los colegiados efectivos siguen fuera de la búsqueda. El informe distingue el total institucional, las combinaciones sin oportunidad anual y las que quedan pendientes pese a tener alguna.

| Escenario ficticio | Institucionales / compatibles / sin oportunidad | Bloques impedidos por ajustes, base → nuevo | Horas pedagógicas, base → nuevo | Rondas cerradas, base → nuevo | Soporte / Mantenimiento, base → nuevo |
| --- | ---: | ---: | ---: | ---: | ---: |
| Cadena concentrada en abril y mayo | 8 / 8 / 0 | 343 → 343 | 14 → 16 | 0 → 1 | 2 / 2 → 1 / 1 |
| Cuatro ventanas entre abril y octubre | 8 / 8 / 0 | 319 → 319 | 62 → 64 | 3 → 4 | 5 / 5 → 4 / 4 |
| Anual con restricciones variadas | 54 / 54 / 0 | 10 → 9 | 418 → 418 | 3 → 3 | 379 / 91 → 379 / 92 |
| Anual con un curso sin par anual | 55 / 54 / 1 | 10 → 9 | 108 → 108 | 0 → 0 | 534 / 246 → 534 / 247 |

Los bloques impedidos se cuentan por fecha y hora de inicio, comparando con el mismo calendario sin ajustes locales. La reapertura deja disponible un bloque en los dos casos anuales. La columna de horas de Soporte y Mantenimiento incluye ese tramo reabierto, que en la muestra quedó como mantenimiento. No se detectaron casos de asignación directa omitida según el diagnóstico de tramos sobrantes. En la cadena sí se recuperó una atención a través de varias reasignaciones.

En el caso de continuidad, el primer cierre se adelantó del 1 de junio al 8 de mayo y la cuarta ronda cerró el 23 de octubre. Las horas pedagógicas de abril y mayo pasaron de 8 y 6 a 8 y 8. En el escenario anual con restricciones se conservaron los totales de marzo a diciembre: 66, 24, 16, 60, 42, 40, 52, 22, 52 y 44. El límite de dos horas, el orden de las rondas y la ausencia de conflictos se comprobaron en ambos tamaños de pantalla. El escenario anual tomó aproximadamente 0,8 s en Edge en el equipo de prueba.
