# Auditoría final del PR #81

Referencia de producción revisada: `0d20b1483bc13ce23d7b5337490d772a8e6315f3`.
El run 38608454594 y la reproducción local dieron 2089 pruebas: 2077 aprobadas y 12 fallidas.
La estabilización cambia exclusivamente pruebas y este informe. Ningún archivo de producción cambia.

## Causa de los doce fallos

| Prueba | Causa y corrección |
|---|---|
| B2 demonstration isolates all data/transport/persistence | Snapshot histórico conservaba el antiguo emplazamiento del botón comparativo. Normalizar únicamente ese movimiento aprobado. |
| Apart from two presentation strings and CSS | Misma diferencia de markup histórico. |
| B2 matrix wiring | Misma diferencia de markup; mantener las comprobaciones originales de permisos y contratos. |
| Promedios fit a single compact row | El indicador histórico ahora está alineado al inicio, no centrado. Normalizar esta regla exacta solo en snapshots antiguos. |
| Print CSS is scoped only to Promedios | La comparación global anterior también incluía presentación de pantalla. Comparar markup/scripts normalizados y mantener las comprobaciones explícitas de CSS de impresión. |
| 38px Promedios buttons | El tamaño aprobado es ahora 34px, con texto de 12px y radio de 9px. Actualizar dimensiones y comprobaciones de espacio. |
| Refinement is CSS-only | Movimiento aprobado del comparativo fuera del bloque auxiliar. |
| This adjustment changes production CSS only | Misma diferencia de markup histórico. |
| Entire production change is CSS only | Misma diferencia de markup histórico. |
| Unselected academic decisions | Expectativa anterior de 38px; comprobar los 34px actuales. |
| Rectangular touch controls and responsive names | Dimensiones antiguas y prohibición de cualquier recorte: el diseño aprobado limita el nombre en pantalla a dos líneas. Permitir únicamente esa regla y el selector compacto; la impresión conserva texto completo. |
| Entire original source unchanged outside presentation | Alineación nueva del histórico fuera del bloque CSS visual; normalizar exclusivamente esa regla para la comparación antigua. |

No se eliminó ninguna prueba. No se alteraron las expectativas de autenticación, autorización, revocación, cierres, identidades, conciliación, ni almacenamiento. Las normalizaciones históricas no se usan en las 16 nuevas pruebas de auditoría: estas leen los archivos actuales directamente y comparan también todo el código de producción con el HEAD revisado.

## Cobertura de regresiones

- Guardado: controles ligados al contexto, conclusiones por competencia, selección reversible/tombstones, borrador conservado ante cancelación y fallo de conexión, aportes transversales pendientes.
- A1: conciliación de tres versiones, decisiones explícitas en conflictos, asistencia compartida preservada, cambios realizados durante petición conservados, sin reenvío automático por respuesta perdida.
- Permisos: backend simulado real, relación exacta área/aula en Secundaria, grados en Primaria, token ausente/vencido/alterado/revocado, filtros manipulados y escrituras cerradas rechazadas.
- Historia I–IV: carga protegida, padrón propio verificado, rechazo del fallback BASE_ACTUAL en consulta cerrada, aislamiento de borradores y respuestas atrasadas/token cambiado; sin mezclar estudiantes ni periodos.
- Cierres: suites académicas y de asistencia independientes. No se modifica su política vigente.
- B1/B2: guardado unificado y importación confirmada conservan sus pruebas funcionales y comparaciones de contratos.
- Impresión: enrutamiento independiente Calificar/Promedios/Resumen/Asistencia, nombres y conclusiones completos/escapados, estadísticas, aulas sintéticas de 30/40 estudiantes, encabezados repetibles y reglas A4 horizontal.
- Interfaz: cinco áreas reales de catálogo con 1–5 competencias, cuarenta estudiantes ficticios, contexto abierto/cerrado y cero mutaciones/escrituras durante renderizado; numeración, dos líneas en pantalla, comparativo en cabecera, alineación desde C y conclusiones compactas.

## Límites y reversión

Las pruebas de interfaz ejecutan los renderizadores reales en un DOM simulado y validan estructura/CSS; no son evidencia de geometría ni paginación nativa de un navegador. El entorno anterior no pudo abrir el navegador de impresión (Crashpad/loopback). No se afirma validación física de PDF. Las fixtures aisladas existentes siguen disponibles para imprimir sin red ni datos oficiales.

La consulta histórica sigue limitada al esquema anual actual; no incorpora un archivo multi-año. Un padrón cerrado no inicializado o una identidad ambigua no se reconstruyen desde borradores locales.

Reversión: revertir únicamente el commit de esta estabilización devuelve las expectativas anteriores y el CI fallido, sin cambiar comportamiento ni datos de producción. No requiere despliegue coordinado ni migración.

Validación final: 2105 pruebas aprobadas, 0 fallidas, 0 omitidas; `node scripts/check-source.cjs` y `git diff --check`. El resultado del CI se registra en la descripción del PR para el SHA publicado exacto.
