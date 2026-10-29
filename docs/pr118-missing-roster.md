# PR #118 — Bimestre sin padrón propio

Base: `a4610797d77ee3cf76b018fa61690b8d14f6cfb2`.

## Causa y alcance

La ruta visible solo rechazaba `padronInicializado=false` en consultas históricas cerradas. En un periodo abierto podía pintar la base actual como padrón del periodo, activar el cliente N2 y llegar al error ROSTER. La lectura de precarga ya exigía padrón inicializado.

Se modifica únicamente Registro (`registro.html`, `registro-notas2-ui.js`), sin modificar Apps Script, students.js, motor N2, CAS ni datos persistidos.

- Toda aplicación visible o fallback local del padrón exige `padronInicializado=true`. Una respuesta protegida con false se presenta como «Bimestre sin padrón inicializado» y no inicia loadnotas2 ni lecturas académicas de ese periodo.
- La ausencia se recuerda solo en memoria y por sesión/permisos/configuración del periodo. Caduca a los 60 segundos y se invalida por un nuevo padrón inicializado/versionado, cambio de sesión/configuración o el botón existente «Reintentar padrón» del diagnóstico. No hay nuevos sondeos, caché persistente ni reintentos automáticos añadidos.
- Una caché positiva anterior no invalida una ausencia más reciente confirmada por el servidor. Un cache-hit de ausencia también invalida la aplicación de una solicitud anterior todavía en vuelo.
- Los candidatos de la cola 2B excluyen periodos ausentes; sus intentos de padrón ausente pueden reanudarse tras invalidación. No se crea otro coordinador.
- ROSTER se presenta como «Padrón del bimestre no verificado», bloquea ese contexto y permite revalidarlo, sin etiquetarlo como error de servidor ni conceder permisos. Se conserva la concesión aún válida de otros bimestres. Los fallos explícitos de sesión/conexión y los conflictos conservan su prioridad; la disponibilidad del padrón no se confunde con autenticación.
- Una respuesta offline basada en BASE_ACTUAL no confirma existencia ni ausencia. Los errores reales de red siguen siendo errores; no se memorizan como ausencia.
- Consulta histórica y pantallas del contexto ausente no recuperan datos de otro periodo. Los originales, borradores, sesiones académicas y asistencias permanecen intactos.

## Pruebas diferenciales

12 pruebas nuevas aprobadas: IV fallback actual; ausencia temporal y cero loadnotas2; inicialización posterior/reintento; invalidación por tiempo/sesión/configuración/versionado; I/II/III disponibles; red real simulada; ROSTER separado de servidor; caché positiva vieja; solicitudes fuera de orden; conservación de la concesión de III y borrador; offline sin prueba de padrón.

87 pruebas existentes únicas de los cargadores de padrón, lectura histórica, feedback y normalización se ejecutaron por sus dependencias modificadas. Se actualizó únicamente el texto esperado por la prueba histórica que rechazaba BASE_ACTUAL: ahora exige la frase solicitada. Se mantuvieron las aserciones de rechazo y conservación de notas. El normalizador histórico retira solo el diff exacto; los tests funcionales usan producción sin normalizar.

Navegador Edge aislado con DOM, cargador, controlador, N2 y cola reales: un caso aprobado; IV sin padrón recibió una lectura protegida, cero lecturas académicas y ninguna repetición al reabrir. Después de inicializar el padrón ficticio y reintentar, apareció la tabla y se habilitó la edición autorizada. Retornos a I/II/III correctos. Cero escrituras, solicitudes externas y errores de página.

Sintaxis: 278 JS/GS y 36 scripts inline; 90 dependencias locales; diff correcto. Se reutiliza el CI de la base (3322 aprobadas) para componentes intactos y se exige CI del nuevo SHA; no se ejecuta la suite completa local ni simulaciones masivas.

## Límites y reversión

Sin consultas institucionales ni certificación del backend desplegado. Una inicialización remota sin notificación no es observable de inmediato: se ofrece reintento explícito y caducidad máxima de 60 segundos de la ausencia memorizada. El reintento vuelve a consultar el servidor; nunca concede autorización por la memoria negativa.

PR #118 DRAFT, sin merge ni deploy. Reversión: revertir este commit; no es necesaria ninguna operación sobre datos, almacenamiento o cachés personales.
