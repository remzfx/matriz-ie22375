# PR84 — estabilización posterior a PR83

Base: `e3243fe74a0aee6981f8173835f4cb183b3622df`. Datos y transporte ficticios en pruebas.

- Borradores: omitir subconjuntos; buscar información recuperable en respaldos anteriores. Un valor sustituido en un respaldo posterior no vuelve a ofrecerse como una recuperación pendiente. La comparación muestra el reemplazo completo antes de confirmar; se mantiene el respaldo y Deshacer.
- Persistencia: clave por cuenta y rol; renovación del token conserva el trabajo de la misma cuenta. Registrar escrituras verificadas propias evita confundir la inicialización del baseline con cambios externos. Una discrepancia entre pestañas bloquea lectura/escritura; no se resuelve sobrescribiendo.
- Cambio de cuenta: bloquear operaciones de la pestaña anterior y ocultar su vista académica; reabrir Registro para usar la nueva cuenta.
- Migración: no atribuir automáticamente la clave compartida anterior a quien entre primero. Conservarla íntegra. Mostrar aviso; solo Admin puede revisar y recuperar notas/evidencias del contexto seleccionado mediante comparación, confirmación y respaldo verificado. No importar el baseline/CAS anterior. La asistencia actual se conserva. El original conserva también la asistencia histórica; no se migra automáticamente.
- Sincronización: después de recuperar, calcular si quedan diferencias reales; asistencia local pendiente y aportes transversales siguen indicándose.
- Presentación: explicar que Cal procede de Calificar y que la nota directa de Promedios tiene prioridad. No modificar cálculo, traslado automático, funciones académicas ni exportación.

Las copias inline evitan introducir una dependencia de red nueva. Apps Script, Sheets, Service Worker y contratos A1/B1/B2 no cambian. El normalizador histórico admite únicamente los wrappers de persistencia y textos exactos autorizados; las funciones académicas conservan comparación contra la base.

## Validación manual mínima (solo aula y datos ficticios)

1. Cuenta A: seis notas, respaldo intermedio de dos → no ofrecer ese subconjunto. Un respaldo anterior con una séptima nota ausente → ofrecer comparación. Cancelar conserva seis; confirmar y Deshacer recupera las seis.
2. Dos pestañas de A: guardar en una; la otra debe bloquear el guardado hasta revisar/reabrir, conservando su trabajo en memoria. Cuenta B no debe ver ni enviar las notas locales de A. Volver a A recupera su almacenamiento.
3. Datos de la versión anterior: verificar aviso; docente no puede importarlos. Admin revisa solo el contexto seleccionado, cancela sin cambios o confirma con respaldo. Comprobar Deshacer y que la clave antigua sigue intacta.
4. Recuperar nube ficticia con treinta evidencias y sin finales directos: mostrar 30/30, explicación Cal y estado actualizado. Una asistencia local distinta debe continuar pendiente. Repetir visualmente en móvil.

## Límites conservados

- No es posible determinar automáticamente el propietario de los datos antiguos compartidos: requiere revisión de Admin. Durante la transición puede verse un registro local nuevo vacío hasta recuperar nube o revisar datos anteriores; no significa que se hayan borrado.
- localStorage/IndexedDB comparten origen y dispositivo; la separación evita contaminación accidental entre cuentas, no sustituye perfiles separados del navegador ni protege frente a acceso deliberado al almacenamiento.
- Cuota/almacenamiento bloqueado cancela recuperación y advierte; no eliminar datos para liberar espacio automáticamente.
- Los aportes transversales pendientes continúan fuera del respaldo académico de emergencia y mantienen su advertencia existente.
- No hay merge, deploy, subida académica automática ni uso de datos oficiales.
