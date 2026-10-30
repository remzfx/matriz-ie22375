# PR #118 — Bimestre sin padrón propio

Base original: `a4610797d77ee3cf76b018fa61690b8d14f6cfb2`. Ajuste SIN_PADRON desde `f62fdffc84ce94de1f57289eb76d531fa1fe0d27`.

## Causa y alcance

La ruta visible solo rechazaba `padronInicializado=false` en consultas históricas cerradas. En un periodo abierto podía pintar la base actual como padrón del periodo, activar el cliente N2 y llegar al error ROSTER. La lectura de precarga ya exigía padrón inicializado.

Se modifica únicamente Registro (`registro.html`, `registro-notas2-ui.js`), sin modificar Apps Script, students.js, motor N2, CAS ni datos persistidos.

- Toda aplicación visible o fallback local del padrón exige `padronInicializado=true`. Una respuesta protegida con false se presenta como «No hay padrón registrado para este bimestre» y no inicia loadnotas2 ni lecturas académicas de ese periodo.
- La ausencia se recuerda solo en memoria y por sesión/permisos/configuración del periodo. No caduca automáticamente durante la sesión; se invalida por un nuevo padrón inicializado/versionado, cambio de sesión/configuración o el botón existente «Reintentar padrón» del diagnóstico. No hay nuevos sondeos, caché persistente ni reintentos automáticos añadidos.
- Una caché positiva anterior no invalida una ausencia más reciente confirmada por el servidor. Un cache-hit de ausencia también invalida la aplicación de una solicitud anterior todavía en vuelo.
- Los candidatos de la cola 2B excluyen periodos ausentes; sus intentos de padrón ausente pueden reanudarse tras invalidación. No se crea otro coordinador.
- ROSTER se presenta como «Padrón del bimestre no verificado», bloquea ese contexto y permite revalidarlo, sin etiquetarlo como error de servidor ni conceder permisos. Se conserva la concesión aún válida de otros bimestres. Los fallos explícitos de sesión/conexión y los conflictos conservan su prioridad; la disponibilidad del padrón no se confunde con autenticación.
- Una respuesta offline basada en BASE_ACTUAL no confirma existencia ni ausencia. Los errores reales de red siguen siendo errores; no se memorizan como ausencia.
- Consulta histórica y pantallas del contexto ausente no recuperan datos de otro periodo. Los originales, borradores, sesiones académicas y asistencias permanecen intactos.

## Pruebas diferenciales

12 pruebas nuevas aprobadas: IV fallback actual; ausencia temporal y cero loadnotas2; inicialización posterior/reintento; invalidación por tiempo/sesión/configuración/versionado; I/II/III disponibles; red real simulada; ROSTER separado de servidor; caché positiva vieja; solicitudes fuera de orden; conservación de la concesión de III y borrador; offline sin prueba de padrón.

89 pruebas existentes únicas de los cargadores de padrón, lectura histórica, feedback y normalización se ejecutaron por sus dependencias modificadas. Se actualizó únicamente el texto esperado por la prueba histórica que rechazaba BASE_ACTUAL: ahora exige la frase solicitada. Se mantuvieron las aserciones de rechazo y conservación de notas. Dos pruebas que extraen beforeApply cargan ahora también la función real missingRoster con un contexto sin ausencia; sus comprobaciones de caducidad y memoria no cambian. El normalizador histórico retira solo el diff exacto; los tests funcionales usan producción sin normalizar.

Navegador Edge aislado con DOM, cargador, controlador, N2 y cola reales: un caso aprobado; IV sin padrón recibió una lectura protegida, cero lecturas académicas y ninguna repetición al reabrir. Después de inicializar el padrón ficticio y reintentar, apareció la tabla y se habilitó la edición autorizada. Retornos a I/II/III correctos. Cero escrituras, solicitudes externas y errores de página.

Sintaxis: 278 JS/GS y 36 scripts inline; 90 dependencias locales; diff correcto. Se reutiliza el CI de la base (3322 aprobadas) para componentes intactos y se exige CI del nuevo SHA; no se ejecuta la suite completa local ni simulaciones masivas.

## Límites y reversión

Sin consultas institucionales ni certificación del backend desplegado. Una inicialización remota sin notificación no es observable de inmediato: se ofrece el reintento explícito existente y se conserva SIN_PADRON hasta recibir confirmación protegida, sin sondeos automáticos. El reintento vuelve a consultar el servidor; nunca concede autorización por la memoria negativa.

PR #118 DRAFT, sin merge ni deploy. Reversión: revertir este commit; no es necesaria ninguna operación sobre datos, almacenamiento o cachés personales.

## Simplificación SIN_PADRON

Una respuesta protegida con padronInicializado=false finaliza normalmente la carga, sin pasar por catch de error. readStatus expone SIN_PADRON sin error, pending ni blocking; el panel muestra el mensaje solicitado y la nubecita «Sin padrón» en gris informativo, sin animación. Se retiran también los indicadores de comparativo anteriores. ROSTER no degrada una ausencia ya confirmada.

El reintento conserva SIN_PADRON mientras consulta y no utiliza una copia positiva antigua para abrir notas. Solo una confirmación protegida positiva lo elimina. Una respuesta incompleta o una caída de red nunca confirma ausencia. No hay cambios en guardado, CAS, permisos, notas o borradores.

Cuatro pruebas nuevas: estado informativo terminal; diez minutos sin reactivar consultas; reintento con copia antigua; respuesta incompleta. Quince pruebas existentes relacionadas reutilizadas/reejecutadas diferencialmente (12 del caso de padrón, 2 normalizadores y 1 histórico), manteniendo rechazo y conservación de datos. El navegador aislado confirma el texto exacto, cero spinners visibles, cero lecturas académicas de IV ausente y recuperación normal tras inicializar; cero escrituras y solicitudes externas. CI completo automático del nuevo SHA requerido; sin suite completa local ni pruebas masivas.
