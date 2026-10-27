# Autorización de sesión y precarga progresiva de Registro

## Alcance y causa

La preparación comienza automáticamente al abrir **Registro**, según la aclaración del responsable; no se precarga desde el Hub ni se transfieren buffers entre páginas. Se reutiliza la única cola de la Etapa 2B.

Antes, `academicstate` acreditaba token/generación pero no enumeraba un alcance reutilizable. El controlador solo recordaba autorizaciones por contexto. Una reserva lista no eliminaba la comprobación autenticada de la primera visita. La medición anterior, con latencia ficticia de 3500 ms, mostró unos 3610–3620 ms hasta la tabla.

## Extensión opcional del contrato

El cliente puede enviar `contextAuthorization: 1` en la petición existente `academicstate`. La respuesta anterior permanece idéntica cuando no se solicita este campo. Para un docente válido y una generación no bloqueada, el servidor añade:

```json
{
  "contextAuthorization": {
    "schema": 1,
    "user": "synthetic",
    "role": "docente",
    "nivel": "secundaria",
    "permisosVersion": 1000,
    "issuedAt": 1000000,
    "expiresAt": 1150000,
    "epoch": null,
    "contexts": ["secundaria||III||3||A||Matemática"]
  }
}
```

Ejemplo sintético. No incluye token, contraseña, nombres de estudiantes ni notas. No constituye un nuevo token para el servidor: las rutas de lectura y escritura continúan autenticando el token original y comprobando sus permisos.

- El servidor utiliza el perfil vigente, el catálogo ordinario, las asignaciones exactas y la misma regla `puedeLeerContexto_`. Solo incluye bimestres abiertos; excluye Tutor/Transversales. No construye permisos nuevos por combinar áreas/aulas no asignadas.
- La duración máxima es 150 segundos y nunca supera el vencimiento del token. El cliente cuenta conservadoramente desde el inicio de la petición; la latencia no prolonga la vigencia.
- El alcance se conserva exclusivamente en memoria, vinculado al token/usuario/rol, perfil/asignaciones, versión de permisos, backend y generación. No se escribe en localStorage, IndexedDB ni borradores.
- Navegar no renueva la autorización. El controlador conserva el plazo original y programa la verificación antes de su vencimiento.
- Guardar y las comprobaciones forzadas siempre pasan por la validación autenticada real. CAS, permisos y cierres siguen comprobándose en Apps Script al leer/escribir; `Notas2.js` no cambia.
- Una reserva vuelve a comprobar su plazo de autorización antes de aplicarse. Si caduca durante la espera, no se publica y se conserva el trabajo local.
- Revocación detectada, desconexión/error o cambios de identidad/perfil/generación impiden reutilizar el alcance. Las reservas se invalidan sin borrar notas ni borradores.

La lectura del alcance no crea hojas: el lector de periodos admite una modalidad estrictamente de lectura para este contrato; sus consumidores anteriores conservan su comportamiento.

## Cola y presentación

Se mantienen concurrencia de fondo 1, separación 500 ms, reservas de 5 minutos, presupuesto global 16 MiB, 2 intentos por contexto, 192 lecturas y 256 contextos admitidos. El alcance también se incluye en el presupuesto estimado de memoria. No hay subidas automáticas.

Se conservan perfiles autorizados y padrones independientes por bimestre. Un padrón ausente no se sustituye por otro periodo. Un aula legacy no detiene la preparación de otras aulas; sus respuestas históricas siguen siendo de consulta y no se adoptan ni escriben.

El estado distingue `prepared` (reserva/cliente y autorización vigentes), `preparing`, `unavailable` y `local` (trabajo protegido). Una copia preparada no se presenta como garantía de última versión de otra computadora: el mensaje recuerda que Guardar revalidará la versión. Consultar la disponibilidad solo examina la reserva solicitada y no poda las de otros bimestres mientras cambia el padrón visible.

Se evita una reconstrucción duplicada después de `load()` únicamente cuando el evento del motor ya renderizó el mismo `viewStamp`. Se mantienen el renderizado necesario al habilitar controles y todos los filtros/guardas existentes.

## Validación diferencial

Código de producción real con datos, relojes/transportes y servicios Sheets ficticios. Sin solicitudes institucionales ni perfiles reales.

- Backend: alcance exacto Primaria/Secundaria, aislamiento área/aula, periodos cerrados, caducidad/revocación, generación bloqueada, contrato antiguo y cero escrituras incluso sin ConfigSistema.
- Cliente/controlador: plazo compartido no renovable al navegar, actor/rol/permisos/época inválidos, perfil modificado, respuesta tardía, publicación después de caducidad y fallback sin alcance.
- Dos PCs simuladas: misma autorización de consulta no evita el rechazo CAS; el segundo borrador permanece íntegro.
- Navegador: Primaria/Secundaria, 1366/390, 18 contextos con tres bimestres y 24 con cuatro, dos áreas, aula con descarga en vuelo, recorrido 3.º A → 4.º A → 5.º A → 3.º A y cambio de bimestre. Pendientes conservados durante desconexión/reconexión, rechazo CAS y cancelación de recuperación, revocación y cero escrituras automáticas.
- Las pruebas usan la misma cola, motor, controlador, DOM, estudiantes y transporte de generación. El backend ficticio devuelve la extensión; las pruebas GAS ejecutan por separado el código real del contrato sobre servicios simulados.

Mediciones locales con 3500 ms de latencia ficticia en la autorización inicial:

| Perfil/viewport | Periodos | Contextos (visible + fondo) | Padrones adicionales | Preparación tras liberar la primera lectura retenida | Cambios preparados |
|---|---:|---:|---:|---:|---:|
| Secundaria 1366 | 3 | 18 (1 + 17) | 2 | 8,11 s | 163–225 ms |
| Secundaria 390 | 4 | 24 (1 + 23) | 3 | 11,15 s | 158–223 ms |
| Primaria 390 | 3 | 18 (1 + 17) | 2 | 8,10 s | 200–267 ms |

En cada recorrido se evitaron cuatro primeras comprobaciones foreground, sin consultas académicas adicionales para las aulas preparadas. La autorización inicial siguió tardando 3,5 s: no se ocultó ni eliminó. La retención máxima estimada fue de 1,61 MB, incluyendo el alcance y padrones. El ensayo final estrecho de la última guarda de publicación obtuvo 156–239 ms y mantuvo los borradores tras reconectar. Los tiempos incluyen datos ficticios y no predicen Apps Script real. Se conservan dos verificaciones de generación por lectura de fondo: no se cuentan como evitadas.

Pruebas finales focalizadas: 71 aprobadas; batería diferencial previa de los componentes modificados: 167 aprobadas. Tres escenarios amplios de navegador, uno final de publicación y dos de fallback sin alcance aprobados; cero escrituras académicas automáticas. La única escritura intentada por escenario de CAS fue explícita y ficticia.

El runner `tests/notas2-session-authorization-browser.cjs` usa `IE_PLAYWRIGHT_MODULE`. Resultados finales y CI del mismo SHA se registran en el PR. No se repite manualmente la suite completa; la ejecuta el CI obligatorio.

## Dependencias, publicación y reversión

**No se ha desplegado ni certificado el backend efectivo.** La optimización exige el nuevo campo opcional de `academicstate`. Con un backend anterior, el frontend conserva la comprobación por contexto y puede seguir esperando la red; no presupone la existencia de la extensión.

Después de la autorización de integración, el orden compatible es backend candidato primero, verificando el código/versionado del proyecto e implementación existentes, y frontend completo después. No crear otra implementación ni cambiar su URL. Esta entrega no ejecuta esas operaciones ni solicitudes autenticadas de producción.

Los cuatro scripts/archivos de producción modificados deben publicarse coherentemente. El PR sigue usando su versión estática v29 aún no publicada; no se cambia la política del Service Worker ni se limpia almacenamiento de usuarios.

Reversión: retirar la optimización del frontend, conservando la ruta autenticada anterior; el contrato backend es aditivo y puede permanecer. No hay esquema académico nuevo, migración ni limpieza que revertir. Revertir código no restaura datos escritos posteriormente.

Limitaciones: la revocación no observada no puede notificarse sin una consulta; el plazo máximo y las revalidaciones obligatorias limitan esa ventana. Guardar nunca omite la autorización remota ni CAS. Equipos lentos, reservas vencidas, padrones faltantes, registros históricos o presupuestos agotados pueden requerir una lectura/validación de red. La meta de 300 ms se mide localmente con datos ficticios y no garantiza latencias reales.

Sin merge, despliegue, cambios de permisos institucionales ni escrituras académicas reales.
