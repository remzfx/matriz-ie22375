# PR #118 — Restauración de controles y estado visible

Base: `d50e37c13cb3d6062af81b17b2d03d6c0a7c974f`. Validación ficticia, sin consultas institucionales.

## Causas comprobadas en el repositorio

1. `registro.html:1624–1627`, `sincronizarEdicionRegistro()`, bloqueaba controles antes de que `paint()` registrase su estado original en `pausedControls`. Al recuperar `canEdit=true`, restauraba el valor ya bloqueado. Se captura el estado previo mediante el mismo WeakMap, antes de imponer la pausa.
2. `registro-notas2-ui.js:278`: la pérdida temporal del padrón hacía que `get()` devolviera null y cambiaba `viewStamp`; se reconstruía el DOM del mismo contexto, sustituyendo campos en edición. Se conserva el DOM exclusivamente durante una transición de padrón del mismo binding, sin errores ni conflicto. Cambiar contexto o perder autorización fuera de esa transición conserva el tratamiento restrictivo anterior.
3. `paint()` podía mostrar verde con conexión marcada connected aunque faltara una concesión efectiva. El indicador ahora distingue carga del padrón, verificación real y ausencia de concesión. Al iniciar y terminar la verificación autenticada se actualiza también la nubecita; antes solo se actualizaba el aviso. El aviso compacto ya no se oculta cuando siguen visibles las filas pero falta temporalmente el cliente autorizado.

No se modifica `canEdit`, vigencia, comprobación autenticada, motor N2, versiones, CAS, escrituras ni almacenamiento. Los controles ya bloqueados por competencia inactiva o conclusión restringida conservan su bloqueo.

## Indicador único

Se mantiene el mismo botón semántico, diagnóstico y estados. Se añade texto legible y se integra en el pie existente, aprovechando su observador de altura para evitar tapar notas. No se añade otro diagnóstico, temporizador ni petición. Los errores y conflictos mantienen prioridad.

## Pruebas diferenciales

- Seis regresiones nuevas: orden HTML/paint, restauración tras concesión, pausas sucesivas, contexto ajeno, falta de autorización fuera de transición y estado visible del padrón. Los dos primeros defectos y el falso verde se reprodujeron antes de corregir.
- 23 pruebas existentes de renovación/feedback reejecutadas por cambiar `paint()` y presentación. Total diferencial: 29 aprobadas, 0 fallidas. Las expectativas históricas se normalizan con sustituciones exactas y únicas; las pruebas de ejecución consumen los módulos reales sin normalizar.
- Dos perfiles de navegador real, 1366 y 390 px: control y foco conservados; I→II→III→I y III→IV→III; caducidad y recuperación autenticada con latencia de 3000 ms; renovación normal; desconexión/reconexión; competencia inactiva. Transporte y datos ficticios, red externa bloqueada.
- Recuperación tras caducidad: 3017 ms (1366 px) y 3010 ms (390 px), con latencia ficticia de 3000 ms; el control continúa bloqueado hasta la respuesta válida. Recuperación del mismo padrón sin petición: síncrona, mismo nodo y foco. Siete visitas por perfil con reservas/autorización preparadas: cero `academicstate`/`loadnotas2` adicionales; una `loadstudents` y una `loadtplstatus` por visita. Cero escrituras y cero solicitudes externas.
- La fixture bloquea Tailwind remoto; se reproduce explícitamente la regla fija del pie. Comprobación visual puntual adicional: botón de 44 px de alto, dentro del pie y del viewport a 1366/390 px. Las capturas son evidencia aislada del componente, no del diseño integral de BeQuiet.
- Sintaxis: 270 archivos JS/GS y 36 scripts inline. 90 dependencias locales. `git diff --check` correcto.
- Se reutiliza la evidencia de 3.304 pruebas del CI de d50; 23 de esas pruebas son las diferencialmente reejecutadas. No se ejecuta otra batería completa local ni simulaciones de concurrencia. El CI del nuevo SHA debe certificar la integración completa.

## Límites

«Verificando datos…» aparece en `registro.html` histórico (`d64a693`), pero no en los recursos actuales revisados; su sustitución consta en `6cb0d5f`. No identifica qué versión está ejecutando BeQuiet ni prueba un fallo de caché. No se han borrado cachés ni solicitado recuperación de notas.

El defecto de restauración está demostrado; no se afirma que explique todas las pérdidas de concesión observadas en BeQuiet. El estado real de sus recursos, su backend efectivo y la desaparición del incidente allí continúan pendientes. No se certifica Google Sheets mediante transporte simulado. Se conserva IERegistroEditTrace existente; no se crea un diagnóstico paralelo.

Reversión: revertir únicamente este commit, sin operaciones sobre datos, perfiles o cachés. PR permanece DRAFT; sin merge ni deploy.
