# Fase 4: validación y preparación, SIN despliegue

Base validada: `99b762eb69b7c3839981eec6019f2269c719d632` (main después de PR92).
Este PR agrega pruebas y este procedimiento; ningún archivo de producción cambia.
No se supone que producción tenga PR90, PR91 ni PR92. No se consultaron cuentas,
calificaciones, Sheets ni almacenamiento de producción.

## Evidencia y cobertura reutilizada

| Condición | Evidencia sintética |
| --- | --- |
| A confirma A, después B; PC nueva y PC antigua limpia recuperan solo B | `academic-identity-roundtrip.test.cjs`, primer caso, cliente real y handlers Apps Script sobre Sheets en memoria |
| Dos dispositivos divergen; revisión explícita antes de editar; reabrir sin conflicto falso | `phase4-integral.test.cjs`, primer caso; A1 real + backend real + controlador de conexión |
| Sin evento offline; servidor deja de contestar; B confirma mientras A espera | `phase4-integral.test.cjs`, segundo caso, reloj determinista y lectura protegida real al reconectar |
| Desconexión conserva campo iniciado, pausa y exige revisión tras cambio remoto | `registro-connection-browser.cjs`, interfaz real 1366/390 px, 30 estudiantes ficticios |
| Guardar local, un Subir explícito, navegación Calificar/Promedios/Asistencia | `phase4-browser.cjs`, mismas resoluciones, DOM/persistencia reales y transporte ficticio CAS |
| Vacío/corrupto/incompleto/antiguo, respaldo local no verificable | `registro-read-integrity.test.cjs` |
| Equivalencias históricas y contradicciones sin autoridad | `academic-identity.test.cjs`, `academic-identity-roundtrip.test.cjs` |
| CAS concurrente y respuesta de subida perdida | `academic-reconciliation-a1.test.cjs`, `academic-history.test.cjs` (incluye cliente real y PC nueva) |
| Archivo histórico ausente/corrupto/parcial; recuperación íntegra | `academic-history.test.cjs` |
| Usuario cambiado, sesión revocada/vencida, cierre, respuesta tardía, fallo conservando campo | `registro-session-lifecycle.test.cjs`, `registro-connection.test.cjs`, `backend-read-auth.test.cjs`, `backend-write-auth.test.cjs` |
| Padrones por periodo, identidad estable, traslado y claves históricas | `registro-roster-identity.test.cjs`, `academic-roster-display-order.test.cjs`, `students-enrollment-roster.test.cjs` |
| Conclusiones, asistencia, B1 y TIC/Gestiona, Tutor pausado | regresiones existentes `registro-unified-save-b1`, `registro-transversales-integracion`, `tutor-transversales`, `registro-connection`, asistencia y conclusiones en suite CI |

Solo dos casos nuevos de integración Node; no se duplican pruebas unitarias de
fases aprobadas. En la primera ejecución, 89/90 aprobaron: el caso nuevo intentaba
consultar un diálogo inexistente en una descarga limpia. Se corrigió la aserción
para exigir cero diálogos; ambos casos nuevos aprobaron. No fue un fallo de producto.
Los dos runners de navegador aprobaron en 1366 y 390 px. Tutor se verifica mediante
su controlador/DOM sintético existente; no se afirma validación visual del panel Tutor
en un navegador de producción. La batería general única corresponde al CI de este PR.

### Ventana de conectividad: límite explícito

Sin evento offline, puede continuar una autorización previamente verificada hasta
el próximo chequeo visible (120 s). Al iniciar esa lectura se pausa la edición,
incluso si la respuesta tarda. La autorización vence a los 150 s si el temporizador
no se ejecuta; `canEdit()` lo comprueba al operar. Temporizadores de pestañas en
segundo plano pueden retrasarse: no se promete detección instantánea ni edición
offline segura ilimitada. Reintentos de lectura 15/30/60 s; nunca reintentan subidas.
Timeout, lectura pendiente, error, cierre o sesión rechazada no generan confirmación
de éxito. Solo respuesta confirmada o lectura causal verificable reconoce una subida
cuya respuesta se perdió. Guardar local nunca significa «actualizado en nube».

## Procedimiento propuesto (requiere autorizaciones posteriores)

### 1. Fijar versiones y respaldar en privado

- Revisión y autorización expresa separadas para merge y despliegue. No ejecutar
  el workflow manual `deploy-apps-script.yml` durante esta validación.
- Objetivo de código: **árbol completo** de main `99b762eb69b7c3839981eec6019f2269c719d632`,
  que contiene conjuntamente fases 1–3. Este PR no introduce código desplegable.
  Si cambia cualquier fuente después de esta validación, revisar ese delta antes
  de usar el veredicto. No mezclar frontend nuevo con backend anterior.
- Registrar privadamente ID y número de versión del Web App existente, fuentes
  completas previas, manifiesto/configuración y revisión del frontend realmente
  desplegado. No suponer que coinciden con main.
- El propietario debe hacer copia privada nativa completa del Spreadsheet y fuentes,
  con todas las hojas, especialmente RegistroNotas, RegistroHistorialAcademico si
  existe, ConfigSistema, padrones y sus referencias; incluir propiedades/configuración
  necesarias sin publicarlas en PR/logs. Restringir acceso igual que el original.
- Verificar en copia aislada: inventario/conteo de filas, claves/versiones académicas,
  referencias y cadena de historia mediante el lector privado de solo lectura
  `leerHistorialAcademico_`. Una copia descargada parcial/CSV no es respaldo suficiente.
  Registrar huellas/verificación solo en custodia privada. Ensayar recuperación en
  esa copia y sin destinos/credenciales de producción. Si no puede verificarse, parar.
- Cada equipo con trabajo pendiente debe conservar su pestaña/almacenamiento y
  respaldos por cuenta. No limpiar caché, localStorage o IndexedDB para actualizar.
  Una copia de Sheets no protege borradores aún no subidos. No exigir subirlos para
  completar el respaldo ni sustituirlos por una descarga.

### 2. Backend primero, por el responsable

- Desplegar juntos `apps-script/Codigo.js` y `apps-script/AcademicIdentity.js` del
  objetivo anterior, preservando los demás archivos y el manifiesto revisado.
  Git blobs verificables (independientes de CRLF):
  - Codigo.js: `d7ff702be3c5d6a8836f1997d18f930fdf5a9b52`.
  - AcademicIdentity.js: `11a52e98e41ee708f49ea9b2572676f7879a69ee`.
- Nueva versión de la implementación existente; preservar URL, propiedades HMAC,
  permisos y acceso a la BD. No ejecutar inicializadores, migraciones ni restauración.
  Publicar fuentes no debe crear ni mover historial: solo una subida manual posterior
  autorizada puede archivarlo. Anotar la nueva versión, sin datos privados.
- Verificar antes el protocolo y los puentes con proyecto/hojas de ensayo. En
  producción, únicamente lecturas autorizadas existentes para comprobar
  `identidadAcademica:1`, sesión y periodos; ningún savereg ni confirmación Tutor.
  Un error de identidad/padrón no se «resuelve» recurriendo a BASE_ACTUAL.

### 3. Frontend y compatibilidad

- Publicar el árbol frontend exacto solo después del backend verificado. El controlador
  de conexión y su adaptador están embebidos en registro.html; no se publica un HTML
  aislado omitiendo los JS acoplados.
- SW aprobado: v21, blob `780ed0a92946860528b156634fab0412ec77a8e7`,
  network-first con respaldo estático limitado a siete días; no almacena datos privados.
  No se necesita cambiarlo en fase4. La misma versión de SW no fuerza a reemplazar
  páginas ya abiertas: coordinar recarga normal con borradores preservados.
- Verificar en DevTools la revisión recibida del HTML/JS y el controlador activo.
  No usar «borrar datos del sitio». Una pestaña antigua no adquiere las protecciones
  nuevas automáticamente. Backend conserva la guarda frente a clientes antiguos
  en filas con historial; rechazo significa actualizar, nunca quitar esa guarda.

### 4. Comprobación posterior mínima, sin editar notas oficiales

Responsable: acceso normal Admin y un docente autorizado; comprobar contexto,
periodo y cantidad del padrón, descarga automática y modo consulta cerrado; comparar
una muestra visual privada con la fuente sin Guardar/Subir/Quitar/Recuperar. Verificar
por red que no ocurre POST académico automático. Probar corte/reconexión y confirmaciones
exclusivamente en entorno ficticio. No pedir pruebas destructivas a una profesora.
Lecturas de producción y validación de permisos reales requieren autorización del
responsable; no fueron realizadas por Codex.

### 5. Detener y revertir con conservación

Detener ante CI fallido, versión desconocida, copia no recuperable, backend sin
protocolo, padrón ausente/ambiguo, nota ausente, alerta local, corrupción histórica,
subida inesperada, periodo/rol incorrecto, edición tras lease vencida o falso éxito.
Pausar operación docente; conservar pestañas, borradores, fuentes y evidencia privada;
no borrar almacenamiento ni «probar otra subida» sobre datos oficiales.

Reversión por responsable autorizado: conservar también instantánea privada del
estado fallido y toda escritura posterior al respaldo. Si falla frontend, restaurar
la revisión frontend previamente registrada solo tras revisar compatibilidad con
backend/guardas; si no es compatible, mantener consulta/pausa, no forzar escrituras.
**No volver ciegamente al backend anterior a PR91**: podría ignorar el archivo y
perder trazabilidad. Mantener lector/verificador y protección de historia del backend
aprobado; preparar corrección compatible o restauración selectiva revisada y con CAS.
Nunca borrar RegistroHistorialAcademico, bloques huérfanos, referencias ni originales.
Restaurar una copia entera de Sheets sobre producción podría eliminar nuevas notas:
requiere plan de diferencias, respaldo actual, autorización específica y ensayo
aislado; no forma parte de este despliegue. No hay migración/restauración automática.

## Criterio de aptitud

APTO técnicamente solo si CI final pasa, las fuentes desplegables permanecen exactas
y se acepta el límite de detección descrito. No equivale a autorización de despliegue:
son condiciones previas la revisión independiente, autorización del responsable,
respaldo privado recuperable, identificación del estado real, backend primero y
actualización de clientes. Cuotas de Sheets/archivo, almacenamiento local fallido,
identidades sin evidencia y clientes antiguos continúan siendo riesgos conservadores
de pausa, no motivos para omitir protecciones. Si falta una condición operativa,
NO APTO para ejecutar el despliegue en ese momento.
