# A1 — Conciliación académica segura

Base revisada: `2806f4d19afdfc7f5e9967c1a4e04b138088eed0` (main después del PR #77).
Alcance: Nube Bajar/Subir de Registro. Ningún cambio en Apps Script, Sheets, autorización,
cierres, fórmulas, SIAGIE ni política de conclusiones: B/C en Primaria, C en Secundaria.
Los otros nueve bloques quedan pendientes.

## Problema reproducido

La descarga anterior comparaba timestamps; la subida solo comparaba la versión remota
con un resumen local. Dos dispositivos podían tener cambios disjuntos o distintos sobre
la misma calificación y quedar bloqueados, o perder un cambio por un reloj adelantado.
La prueba ficticia Comunicación, 1.º A, III contiene 30 alumnos y 90 resultados: una nota
divergente requiere elección, otra nota remota se conserva, junto con evidencia,
conclusión específica, conclusión histórica y una eliminación. También se prueba el
cliente real contra un Apps Script ejecutado en VM y hojas exclusivamente en memoria.

## Comportamiento

- `registro-reconcile.js` compara base causal confirmada, borrador y lectura remota nueva.
  Ignora timestamps para elegir contenido, pero conserva los registros originales.
- Solo fusiona automáticamente modificaciones de datos distintos y cambios de un solo
  lado respecto a la base. Cambios divergentes y eliminación contra edición se detienen.
- Asistencia, fechas y estados son compartidos por aula/bimestre: la versión de un área no demuestra su causalidad. Diferencias presentes en ambos lados requieren elección explícita, aunque coincidan con la base del área. Ausencias no borran marcas/fechas locales. Una fecha eliminada frente a marcas activas se decide con sus marcas como conjunto. No se elige por timestamps.
- El diálogo muestra estudiante, orden/identidad oficial, competencia, tipo de dato y alternativas legibles; las claves y valores originales quedan en detalles técnicos colapsados. Todo se renderiza mediante texto DOM.
- El diálogo exige una decisión Este dispositivo/Nube por conflicto; no preselecciona
  ganador. Cancelar no escribe. Utiliza texto DOM, foco acotado y Escape.
- Sesiones/fechas eliminadas frente a evidencias/marcas nuevas se resuelven conjuntamente;
  no quedan notas ocultas por una sesión eliminada automáticamente.
- Los identificadores estables y aliases inequívocos detectan representaciones históricas
  distintas. No migra ni renombra claves. Homónimos/códigos ambiguos no se asignan por
  aproximación ni por orden del padrón.
- Un registro histórico sin base causal solicita revisión cuando ambos lados difieren;
  no inventa una base usando el reloj o el estado actual del formulario.
- Conserva el borrador anterior y la lectura remota antes de enviar. El contenido local
  solo se concilia tras una descarga protegida confirmada o confirmación de la subida.
  Recuperar borrador anterior a conciliación restaura únicamente el contexto actual,
  con confirmación, conservando el trabajo sustituido como respaldo. La recuperación académica no restaura ni sustituye asistencia compartida, fechas o sus estados. No escribe en nube.
- El POST utiliza la versión recién leída y el lock/CAS ya existente en el servidor.
  Un CONFLICT no avanza la base causal ni reintenta escrituras automáticamente.
- Antes del POST conserva el intento. Si se pierde su respuesta, una nueva acción explícita
  lee el servidor: contenido canónico coincidente y versión posterior permiten confirmar
  el resultado sin duplicar el POST. Si no coincide, se vuelve a conciliar explícitamente.
- Doble clic no duplica peticiones. Cambio de token/contexto/borrador descarta respuestas
  atrasadas. Ediciones durante el envío permanecen locales y pendientes; se capturan
  también campos numéricos todavía sin blur antes de aplicar una respuesta.
- La validación integral existente continúa intacta. Un área local incompleta puede
  requerir primero Nube Bajar para incorporar los datos remotos antes de Nube Subir.

## Validación y límites

Suite: 1.716 pruebas, 1.716 aprobadas, 0 fallidas, 0 omitidas. 75 regresiones A1 (16 añadidas tras revisión).
Incluye cliente, diálogo DOM, Apps Script simulado, permisos, cierre, revocación,
concurrencia, pérdida de respuesta, cancelación, tombstones, asistencia y claves históricas.
Las pruebas anteriores se adaptan al módulo y SW; las comparaciones históricas de
presentación siguen comparando todo fuera de los puntos de sincronización A1.

Los respaldos usan el almacenamiento local existente, acotados a un contexto y un
intento. Aumenta su tamaño: si el navegador rechaza la persistencia, se detiene la subida
y conserva el trabajo en memoria. No cerrar ni limpiar el navegador ante ese aviso.
No protege frente a la eliminación deliberada del almacenamiento del navegador.
No se conservan indefinidamente todas las versiones: el respaldo recuperable es el último.

La asistencia puede requerir más decisiones explícitas porque las copias por área no tienen una versión común de aula. Esta intervención protege el borrador conocido; no unifica las copias de asistencia del servidor ni puede descubrir cambios de otras áreas que aún no se hayan leído. Esa limitación requiere revisión futura del contrato, fuera de A1.

Cada sincronización agrega una lectura protegida para disponer de una versión fresca.
La latencia de Apps Script puede seguir retrasando la operación; no se autoriza escritura
offline ni se añaden reintentos de POST. Un resultado desconocido se verifica leyendo.
No hay migración destructiva ni escrituras de prueba en producción.

La comprobación visual real del nuevo diálogo queda pendiente: el navegador Edge
headless disponible no pudo iniciarse en el sandbox. Sí pasan las pruebas de selección,
cancelación, foco y texto DOM. Revisar desktop y móvil con información ficticia.

## Comprobación estrictamente necesaria antes de autorizar publicación

1. Ejecutar `node --test tests/*.test.cjs`, `node scripts/check-source.cjs` y
   `git diff --check`; comprobar CI para el SHA exacto del PR.
2. En una copia aislada con alumnos ficticios, abrir Comunicación 1.º A III en dos
   perfiles. Editar datos diferentes y conciliar; luego editar la misma nota en ambos.
   Revisar ambas decisiones y Cancelar; comprobar el respaldo recuperable. Cambiar de área con una copia remota de asistencia antigua, revisar la fecha/marks como conjunto y verificar que recuperar notas conserva la asistencia actual.
3. Interrumpir la respuesta de una subida, comprobar que el trabajo sigue local y que
   la siguiente acción consulta antes de decidir si necesita otro POST.
4. Escribir mientras llega una respuesta; verificar que la nota posterior sigue pendiente.
   Comprobar eliminación concurrente de una sesión/fecha y bloqueo del bimestre cerrado.
5. Revisar el diálogo en 1366×768 y ~390 px: scroll, texto largo, radios, Cancelar y foco.

## Plan compatible y recuperable — no ejecutado

No hay actualización coordinada del backend: reutiliza el contrato vigente
`soportaModeloAcademico`, `version`, `CONFLICT` y canonicalización del main revisado.
No ejecutar Deploy Apps Script ni modificar Sheets.

Después de revisión y autorización, publicar juntos `registro.html`,
`registro-reconcile.js` y `sw.js`. SW v20 precachea la nueva dependencia y mantiene
network-first, siete días, exclusión privada y prohibición de HTML como fallback JS.
La falta del módulo o un backend incompatible bloquea el envío; no hay bypass legacy.
Confirmar en una sesión de prueba aislada los tres recursos del mismo SHA antes de usarlo.
Cerrar pestañas antiguas al cambiar versión para evitar dos clientes sobre el mismo
localStorage (limitación preexistente; el CAS sigue protegiendo las escrituras remotas).

Reversión, solo autorizada: revertir el commit A1; incrementar nuevamente SW (v21 o
superior) manteniendo los recursos del frontend restaurado para expulsar v20.
No borrar `store.academicSync`, borradores ni respaldos. El frontend anterior ignora los
campos adicionales. Exportar/conservar el borrador en la copia aislada antes de revertir
si se necesita recuperar una elección. No requiere revertir datos ni backend.
