# Asignaciones por área en Primaria — PR #61

Base: `main` en `1f5457bedfe751cad6e2e8d7adeb15f791e8f602`. La fuente administrativa sigue siendo `DOCENTE_ACCESOS`. No se crea una base paralela ni se cambia el esquema de notas.

## Administración y compatibilidad

Admin conserva la selección de grados y permite seleccionar áreas de Primaria y marcar los grados/aulas correspondientes a cada área. El mapa tiene el formato compartido `asignaciones[area] = ["1|ÚNICA", ...]`. Educación Física requiere asignación explícita; un especialista puede asignarla a sus seis grados y un titular puede seleccionar sus áreas regulares sin EF.

El formato antiguo sin mapa, incluido `{}` que guardaba el formulario anterior de Primaria, equivale a sus grados y las áreas curriculares regulares existentes excepto Educación Física. Editar una cuenta antigua prepara ese mapa en el formulario; solo Guardar modifica la configuración administrativa. Un mapa no vacío es autoritativo: no concede otras áreas por fallback. Mapas malformados no conceden acceso. Las asignaciones se limitan a los grados seleccionados y a sección Única.

## Sesión y autorización

El login de Primaria entrega grados efectivos, áreas, aulas y asignaciones. La firma HMAC y la expiración de 12 horas permanecen sin cambios. `savedoc` sigue incrementando permisosVersion y revocando sesiones anteriores.

`autorizarEscritura_()` y `puedeLeerContexto_()` exigen área, grado y sección de la asignación efectiva. Se aplican a RegistroNotas y EstadosAreas, incluidas las lecturas `loadreg`, `loadnivel` y `load`, y escrituras `savereg`/`saveArea`. Admin conserva acceso total. La lectura de estudiantes exige al menos una asignación efectiva en esa aula; conserva el bridge, token exacto, padrones y caché de estudiantes. Secundaria conserva su rama de autorización existente.

## Registro y matriz

Registro filtra las áreas de Primaria por el aula seleccionada y limita los grados. El titular no ve EF; el especialista ve solo las áreas asignadas. La identificación docente desde Admin también respeta área/aula.

La matriz resuelve el nombre oficial por nivel, grado, sección y área. Cada envío exige el docente confirmado del área enviada. Con ninguna área seleccionada, el nombre visual usa la primera área permitida; la subida de áreas con avance incluye únicamente las autorizadas. La exportación docente filtra una copia por áreas y aulas; Admin conserva la exportación total y los datos locales históricos no se modifican. El Service Worker v8 retira versiones estáticas anteriores.

## Historial, validación y entrega

Las claves `nivel | bimestre | grado | sección | área` se mantienen. No se mueven ni reescriben notas existentes, incluidas las de Educación Física. Las reglas de bimestre, SIAGIE, Auxiliar y autorización de Admin permanecen.

Validación: **587 pruebas aprobadas, 0 fallidas** en `node --test tests/*.test.cjs`. La revisión independiente ejecutó las 24 regresiones nuevas y confirmó las correcciones de subida del especialista y exportación filtrada, sin hallazgos pendientes.

El Apps Script completo está en `apps-script/Codigo.js`. **No merge ni deploy en este PR.** Después del merge aprobado requerirá una nueva versión de la implementación existente de Apps Script, manteniendo su URL. La validación de producción queda pendiente de ese paso autorizado.
