# PR #80 — auditoría de loadperiodos

Fuente revisada: HEAD f3247e6a449a0692a7ac0d0d1a8e947f6ece3f8d. Auditoría local con backend simulado; no se consultó producción ni se modificó Apps Script.

## Autorización y exposición

`doGet` no incluye loadperiodos en rolesLectura. `doPost` delega esta acción a doGet antes de los guards de escritura. Por tanto GET y POST devuelven PERIODOS sin sesión, incluso con token ausente/inválido. El token que envía B2 no protege esta consulta. No depende de permisos docentes ni de permisosVersion.

La ruta filtra filas por clave PERIODOS; no devuelve DOCENTE_ACCESOS, AUXILIAR_ACCESOS, alumnos, notas ni el resto de ConfigSistema. El objeto normal guardado por Admin contiene anio y bimestres I–IV con abierto/cerrado/bloqueado, más ts de respuesta. Es información institucional consultable públicamente en el diseño vigente. Esto no autoriza a leer loadreg/loadstudents ni a escribir: esas rutas mantienen sus controles propios y saveperiodos exige token Admin.

Hallazgo separado de endurecimiento: PERIODOS se devuelve íntegro; saveperiodos almacena body.periodos sin lista blanca. Si alguna integración/Admin guardara campos privados adicionales en ese objeto, también quedarían expuestos públicamente. La prueba usa solo un marcador ficticio para demostrarlo; no afirma que producción contenga campos privados. Las propiedades de filas distintas no se exponen. Además asegurarConfig_ crea la hoja/cabecera si falta: la lectura no es estrictamente libre de escrituras de inicialización en ese supuesto; con ConfigSistema existente no escribe.

## Contexto aplicable a B2

El esquema actual es institucional: PERIODOS.bimestres[bimestre], compartido por Primaria y Secundaria. No tiene cierres por nivel/grado/sección/área. Los parámetros de aula enviados por B2 no cambian esta respuesta. ObtenerPeriodosConfig_ selecciona la misma fila PERIODOS de mayor ts (última en empate) que loadperiodos; bimestreAbierto_ consulta ese mismo mapa para ambos niveles. ASISTENCIA_PERIODOS es un circuito distinto y no se confunde con el académico.

Ambas matrices leen esa configuración en cargarPeriodosAdminMatriz y guardan el estado institucional en ie22375_periodos_cloud_v1. B2 consulta de nuevo el servidor al abrir y al aplicar; usa únicamente el bimestre del contexto capturado. Solo permite aplicar si el estado es exactamente abierto y el contexto/token siguen intactos. Null, ausente, desconocido, cerrado o bloqueado impiden aplicar. La prevalidación de la matriz sigue siendo conservadora: una caché cerrada puede exigir refrescar antes de abrir, pero una caché abierta no permite aplicar si servidor confirma cierre.

## Corrección propuesta por separado — NO implementada

1. Definir/validar un DTO con solo anio y bimestres I–IV, y devolver ese DTO en loadperiodos. Validar esos campos al guardar, conservando deliberadamente cualquier dato histórico interno que no deba ser público. Evitar inicializar hojas desde una consulta pública; si falta configuración, responder null.
2. Si se decide que los estados de calendario también deben ser privados, añadir loadperiodos al mapa rolesLectura y migrar conjuntamente todos los consumidores GET sin token encontrados (Admin, Registro, ambas matrices y students-migration.js) a lectura protegida POST/bridge con token en cuerpo. No basta con añadir el guard: rompería consumidores existentes. Determinar roles lectores por cada consumidor antes de cambiarlo.
3. Esta propuesta necesitaría su revisión independiente y nueva versión de Apps Script con autorización expresa. No forma parte de B2 ni se desplegó.

Demostración reproducible: abrir docs/demos/b2-import.html con Live Server. Carga el importador real y contratos simulados, con CSP connect-src none, sin datos reales ni persistencia. Probar escritorio y viewport 390 px, Primaria/Secundaria, selección de reemplazos divergentes, scroll horizontal, cancelar y confirmar. La confirmación aplica únicamente al objeto ficticio en memoria; el contador de escrituras remotas debe seguir en cero. Solo la demo representa window.confirm con un diálogo HTML y su misma pregunta/resultado booleano, porque el diálogo JavaScript nativo bloqueó el navegador integrado durante la comprobación. Producción conserva window.confirm y todas sus validaciones.

Comprobación visual realizada: escritorio 1280×900 y móvil 390×844. En móvil, tabla 960 px, contenedor visible 288 px, scroll horizontal interno 0–672 px y ancho de documento 375 px (15 px de scrollbar vertical): no desborda el viewport. Apertura mantiene el contexto visible. Reemplazo divergente inicia sin seleccionar; Cancelar y cancelar confirmación conservan los conteos. Confirmar aplica cinco competencias completas, deja pendientes sin aplicar y muestra una aplicación, cero escrituras remotas y fuente intacta. Primaria 6° Única y Secundaria 2° A usan el bimestre III de la fixture institucional. Los tres cambios de presentación del importador no alteran el código académico ni las validaciones de lectura/aplicación.

Validación final local: 1809 pruebas aprobadas, 0 fallidas/omitidas. Sintaxis de 88 JS/GS y 28 scripts inline; 67 dependencias locales verificadas. git diff --check correcto. Apps Script, Registro, conciliación A1 y adaptador transversal B1 permanecen idénticos al HEAD previamente revisado.
