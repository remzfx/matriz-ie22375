# PR #75 — Guía de pruebas de integración aisladas

**Estado:** no autorizado para producción. Este documento describe qué comprobar en una COPIA; no constituye una orden de desplegar o fusionar.

## Reglas innegociables

- El propietario del sistema efectúa cualquier despliegue o fusión desde GitHub/Apps Script y da la autorización expresa.
- No alterar la implementación pública de Apps Script, ni la hoja oficial, ni el sitio publicado para ejecutar estas pruebas.
- Probar con una copia privada de Google Sheets y un proyecto/implementación Apps Script de prueba vinculado exclusivamente a esa copia.
- Las páginas de prueba `admin.html` y `auxiliar.html` deben apuntar a la URL de la **implementación de prueba**; el código fuente normalmente apunta a producción. No visitar una página de prueba que aún use `CLOUD_API_URL` de producción para experimentar con escrituras.
- No cargar información identificable de estudiantes en repositorios públicos, capturas públicas ni comentarios del PR.
- No asumir que las pruebas sintéticas en GitHub Actions equivalen a una prueba real de Google Apps Script/Sheets.

## Matriz de escenarios — copia exclusivamente

| Caso | Procedimiento | Resultado esperado |
| --- | --- | --- |
| 1. Autorización y estado inicial | Abrir Auxiliar antes de configurar `ASISTENCIA_PERIODOS` | Solo lectura, sin cambios en asistencia |
| 2. Independencia | Cambiar cierre de asistencia del III, sin tocar notas | Se rechaza `saveasis` si está cerrado; `savereg` sigue su propia configuración |
| 3. Lectura tras cierre | Registrar marca en bimestre abierto, cerrar y volver a consultar | Se ve la marca histórica; no se altera al cerrar |
| 4. Traslado entre padrones | Usar un estudiante en II y ausente en `PADRON_III` | Su marca del II continúa en el II; no figura para marcar en el III |
| 5. Matrícula vigente | Comparar III con padrón certificado | No usar `BASE_ACTUAL`; cuando corresponda a la misma fuente oficial, 257 secundaria y 146 primaria |
| 6. Actualización padrón III | Sincronizar nuevo padrón en la copia | No elimina registros de días o bimestres anteriores |
| 7. Conflicto dos dispositivos | Abrir misma marca en 2 móviles, editar en ambos y subir | Versionado CAS; sin sobreescritura silenciosa |
| 8. Cierre con local pendiente | Crear marca local, cerrar en Admin de prueba y subir | Backend rechaza; la marca local se conserva para revisión |
| 9. QR y carga masiva | Con cierre confirmado y permiso, registrar varias marcas | Registros con identidad y nombre oficial; sin duplicados |
| 10. Aulas y niveles | Entrar como auxiliar de Primaria y Secundaria separadamente | Cada cuenta solo ve/escribe niveles autorizados |
| 11. Historial previo v1 | Cargar filas antiguas de `AsistenciaIngreso` sin año ni bimestre y consultar por fecha/nivel | Aparecen únicamente en «Archivo anterior (solo lectura)» y no se mezclan con el padrón moderno |
| 12. Seguridad histórica | Intentar combinar `historico=1` con un bimestre, o leer otro nivel | Solicitud rechazada o alcance restringido, sin escrituras |
| 13. Teléfono sin conexión | Fallar red de forma controlada y volver a entrar | No se confirma falsamente una sincronización; marcas locales permanecen |
| 14. Retrocompatibilidad | Comparar registros reales representativos antes/después en copia | Ninguna fila histórica se borra, reescribe ni asigna artificialmente a un bimestre |
| 15. Estadística del día | Seleccionar fecha, nivel y bimestre en Auxiliar; actualizar resumen | Presentes, faltas, tardanzas, justificadas y sin registrar suman exactamente el padrón oficial |
| 16. Ejemplo de 257 alumnos | Registrar sintéticamente 250/3/4 para el día 11; 230/20/7 para el 12; 230/14/13 para el 13 | Tabla y gráfico mensual muestran las tres fechas sin confundir tardanzas con faltas |
| 17. Registros parciales | Marcar una parte del padrón y consultar antes de subir otras marcas | La diferencia se muestra «Sin registrar», no como falta ni justificación |
| 18. Estadística en bimestre cerrado | Cerrar asistencia del bimestre en la copia y volver a consultar estadísticas | Conserva consulta histórica; sin autorizaciones de escritura |
| 19. Permisos estadísticos | Auxiliar de Primaria intenta consultar estadísticas de Secundaria | Se rechaza la consulta; API devuelve solo agregados, nunca nombres o códigos de estudiantes |
| 20. Integridad y anomalías | Duplicar deliberadamente una fila de prueba y consultar | No cuenta dos veces a un estudiante; presenta aviso de duplicados para revisión |

| 21. Photochecks usa padrón III | Seleccionar III en Photochecks en la copia y comparar con la lista de Asistencia | Ambos muestran los mismos estudiantes vigentes de ese bimestre; ningún traslado entra desde BASE_ACTUAL |
| 22. Padrón no confirmado | Simular fallo del servidor, caché offline y bimestre sin PADRON confirmado | Generar aula, generar nivel e imprimir quedan bloqueados; no se reutilizan carnets anteriores |
| 23. QR e impresión | Abrir `preview-photochecks-pr75.html` local y después probar el módulo con alumnos ficticios en copia | QR visible, compatible con lector Auxiliar, diseño institucional y A4 dos por fila, opción Guardar como PDF |
| 24. Cambiar bimestre | Generar carnet de muestra en III, cambiar a IV y esperar respuesta de copia | Se limpia la vista y no se imprime un carnet de III atribuido a IV |

## Prueba segura del lector QR en iPhone (sin registrar)

**No probar con datos escolares en producción antes de una autorización.** Realizarla en una implementación aislada, o después de una publicación expresamente aprobada.

1. Abre Safari en iPhone, navega al sitio HTTPS de prueba y entra al módulo Asistencia con una cuenta autorizada. La app Cámara nativa no registra asistencia: este QR tiene formato de texto escolar.
2. Muestra el photocheck QR en otra pantalla o impreso. No puede leerse con la cámara un QR que esté en la misma pantalla del iPhone.
3. Pulsa «Probar lector QR (sin registrar)», concede permiso de cámara y espera «Cámara activa en MODO PRUEBA».
4. Enfoca el QR a 15–25 cm. El mensaje «Prueba correcta» confirma que se leyó; un QR de alumno ficticio también se decodifica, pero no coincide con el padrón.
5. Comprueba que los conteos y registros locales/de nube siguen iguales. En modo prueba no se llama a setRec ni subirUnoNube.
6. Si no carga el lector, verifica internet (la librería de lectura aún depende de Html5Qrcode externo). Si hay problemas de permisos, revísalos en Safari/Ajustes. Si la página no es HTTPS, no se puede solicitar la cámara.
7. Cierra la cámara. El botón «Escanear QR» sin la palabra Probar SÍ registra asistencia si el bimestre está abierto: no usarlo para diagnóstico con datos reales.

Las pruebas automáticas solo comprueban el código; hace falta validar físicamente Safari/iPhone en un sitio seguro.
## Criterios para solicitar aprobación final

1. La CI del último commit del PR pasa sin errores.
2. Los 24 escenarios de integración anteriores se verifican en copia con evidencia mínima sin datos personales.
3. Los padrones por bimestre consultados se verifican contra su fuente oficial.
4. Se dispone de respaldo independiente de Sheets y del Apps Script actual.
5. El propietario autoriza explícitamente la secuencia y ejecuta los despliegues. Hasta entonces, PR en borrador, sin fusión y sin despliegue.
