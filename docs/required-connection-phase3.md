# Fase 3 — conexión obligatoria de Registro

Base: main 112b30450326d1588dbe506e1039606e8aa1d885, después de PR90/91. No implica despliegue ni aceptación integral (fase4).

- Controlador efímero por sesión/contexto; conexión real exige lectura protegida loadreg, protocolo de identidad de fase2, conciliación A1 satisfactoria y periodo abierto verificado con loadperiodos. navigator.onLine solo acelera la pausa, nunca concede edición.
- Se reutilizan la descarga automática y resolución manual existentes. Una PC limpia adopta la nube; pendientes quedan intactos y requieren revisión; un conflicto real usa A1. No se cambian CAS, identidad, respaldo previo al reemplazo, esquema, permisos ni escrituras del backend.
- Verificación cada 120 s en pestaña visible, autorización local máxima 150 s; reintento tras 15/30/60 s, con deduplicación. Hasta el siguiente chequeo no puede detectarse instantáneamente una caída del servidor sin evento offline. Cambiar contexto/sesión o perder conexión invalida respuestas en vuelo.
- Antes de pausar se conserva localmente el campo iniciado usando el flujo existente. No se repinta al perder conexión. Si falla esa conservación se mantiene la pausa sin aplicar una lectura encima: conservar la pestaña y revisar almacenamiento/respaldos.
- Guardar de la barra es exclusivamente local, incluidos aportes transversales: no invoca su save. Subir Nube continúa siendo manual. El método interno B1 conserva compatibilidad para sus consumidores explícitos; no hay envío en timers ni reconexión.
- Tutor verifica su propia aula/bimestre mediante loadtransversales existente. Una decisión pendiente nunca se reemplaza; cambios de versión/aportes exigen la revisión/recarga ya existente. Mientras se pausa, también se bloquean confirmaciones transversales antes de iniciar POST.
- Estados de conexión separados del estado de sincronización; aviso compacto, animación con reduced-motion y controles táctiles. Navegación/consulta sin overlay. Consultar respaldos abre solo lectura por cuenta/contexto, sin restauración ni subida cuando edición está pausada.

## Validación focalizada

274 pruebas de conexión + regresiones directas aprobadas (A1/B1, identidad, lecturas, respaldos, Tutor, asistencia, guardas históricas). Nuevas pruebas usan datos/transportes ficticios; no se repiten auditorías PR90/91.

Runner tests/registro-connection-browser.cjs: con IE_PLAYWRIGHT_MODULE disponible, interfaz real en 1366 y 390 px, corte aislado del navegador, PC limpia recibe versión remota, campo numérico iniciado se conserva, conflicto concurrente no pisa local, revisión cancelada sigue pausada, cero POST académicos. No desconecta ningún servicio real.

La suite general se ejecutará una sola vez en CI del HEAD final. Las guardas históricas permiten solo hashes exactos del diff de conexión; no se eliminan pruebas de seguridad. El controlador está embebido byte a byte en registro.html: no agrega una descarga JS ni datos privados a CacheStorage.

## Dependencias y riesgo de despliegue

PR90/91 están fusionados pero NO desplegados. Backend aprobado primero (Codigo.js + AcademicIdentity.js), frontend después, solo con autorización y aceptación fase4. El protocolo anterior no habilita edición en el cliente nuevo. Este PR no cambia backend ni requiere otra versión de Apps Script adicional a las fases aprobadas.

Las pestañas/clientes anteriores conservan sus reglas hasta actualizar; no se puede afirmar protección global por fusionar este PR. El heartbeat introduce lecturas razonables y una pausa breve al verificar; cuotas/servicio inaccesible mantienen modo consulta. Una falla local al proteger una entrada exige conservar la pestaña; no borrar caché ni respaldos. La consulta de respaldos sigue sujeta a existencia/cuota/caducidad previa.

NO MERGE. NO DEPLOY. Sin datos reales, limpieza o migración de registros.

CI inicial: 2507/2508; se detectó una lectura redundante al recibir visibilidad sin perder la verificación vigente. Se eliminó el forzado de ese evento (una pausa previa ya invalida la conexión). La regresión de rendimiento y fase3 aprobó 35/35; se requiere CI del HEAD corregido. No se ejecutó ninguna suite completa local ni se repitieron auditorías.
