# Auditoría de estudiantes — bloque 4

Fuentes inspeccionadas: todos los HTML/JS/JSON y rutas de Apps Script de `main`, incluyendo definiciones, lectores de localStorage y consumidores reales. No se encontró hoja/ruta previa de base de estudiantes. No se registran nombres reales en esta auditoría.

| Consumidor | Fuente anterior | Fuente del PR |
| --- | --- | --- |
| Admin | `BD_EMPOTRADA`; edición en almacenamiento local; restauración desde copia empotrada | POST `loadstudents`; edición/importación como borrador; guardar/inicializar/restaurar solo Admin en Sheets |
| Registro | `BD_EMP`; prefería la base local compartida de Admin | POST `loadstudents` con alcance del token; espera la lista antes de pintar contextos |
| Primaria | Totales locales/importados de matrices; sin lista de nombres | POST `loadstudents`; conteo de la base oficial por grado/sección |
| Secundaria | JSON público y caché local persistente del nivel completo | POST `loadstudents`; conteo por aula de la respuesta autorizada |
| Auxiliar | JSON público y fallback de la base local compartida | POST `loadstudents`; conserva alcance de todo el colegio para asistencia/QR |
| Photochecks | JSON público; fallback local compartido; heurística por apellido para niveles | POST `loadstudents`; conserva gate Admin; niveles del servidor; QR local sin enviar nombres a un generador externo |

Index y AIP/PIP no consumen listas de alumnos. Los datos de asistencia/notas ya protegidos mantienen sus rutas y estructuras: este PR no los modifica ni convierte esas lecturas en fuentes alternativas de alumnos.

Se identificaron tres copias públicas con nombres: listas empotradas en Admin/Registro y el JSON oficial. Admin y Registro coincidían entre sí; el JSON tenía una fila menos en Secundaria. No se decidió qué fila era vigente ni se fusionaron listas: la importación inicial requiere revisión de Admin y conserva el respaldo privado elegido. La copia original de restauración se extrajo a un archivo local fuera del repositorio para no perderla durante la retirada.

Se revisaron los formatos vigentes de permisos. Primaria usa `grados`. Secundaria usa `asignaciones` área → aulas; se da prioridad a ese mapa sobre `areas`/`aulas`. El fallback legado explícito sin mapa conserva los permisos ya admitidos por las rutas existentes. El nuevo lector reutiliza las funciones de alcance del servidor sin modificar permisos ni el diseño de tokens.

La búsqueda global posterior no encuentra nombres originales en archivos HTML/JS/JSON de producción, ni consumidores activos de la base estática. Las pruebas de ausencia cubren nombres de símbolos/rutas antiguas; las pruebas funcionales usan únicamente alumnos sintéticos. Se mantienen las exportaciones/importaciones privadas de estudiantes en Admin.
