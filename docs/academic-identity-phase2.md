# Fase 2 — identidad académica (DRAFT, sin despliegue)

Base: main c6a8d3a8291d042f214529534d7d358e9b48fae5 (PR #90).
No se presupone que producción tenga siquiera el backend de la fase 1.

## Lectura y autoridad

`academic-identity.js` y su copia de Apps Script son el mismo resolvedor puro,
comprobado byte a byte. Contexto + competencia del catálogo + identidad SIAGIE
(ID, código y nombre actual inequívoco) forman la clave activa. No se utiliza
posición C1/C2, similitud de texto ni timestamp para decidir vigencia. La tabla
de equivalencias de competencias es explícita y versionada; inicialmente solo
contiene la variante de capitalización de «Construye su identidad».

Las equivalencias se verifican con el padrón autorizado del bimestre. Un alias
de nombre enviado por un navegador no prueba una relación histórica. Un nombre
anterior sin ID/código comprobable necesita revisión del padrón; no se une por
suposición. Se mantienen las claves no resueltas originales, sin asignarlas a
otro estudiante. Registro no usa studentAliases como autoridad de visualización.

La barrera de lecturas de PR #90 se ejecuta sobre el payload ORIGINAL antes de
proyectar. A1 compara proyecciones de base/local/remoto; una base causal permite
identificar una única representación editada. Las discrepancias sin esa evidencia
se presentan como candidatos concretos, nunca «PC vacía» frente a todo el conjunto.
Una PC limpia sigue una versión remota inequívoca. Omisiones conocidas siguen
requiriendo revisión; asistencia conserva su conciliación independiente.

basePayload, readBackups, recovery y los respaldos IndexedDB conservan originales.
La recuperación voluntaria también proyecta y se detiene ante identidad ambigua.
Guardar sigue siendo local. La descarga automática nunca llama a savereg.

## Confirmación manual y conservación

No hay endpoint ni tarea de migración. La proyección no modifica Sheets. La única
escritura continúa siendo Subir Nube manual, con modelo académico, versión CAS,
autorización y cierres existentes. El backend anuncia identidadAcademica:1; un
frontend nuevo conserva el borrador y rechaza enviar el protocolo a un backend
anterior. Para confirmar nuevas identidades se exige PADRON del bimestre real,
sin BASE_ACTUAL como prueba histórica de equivalencia.

Al confirmar manualmente un registro, el servidor valida que los mapas enviados
ya usen la identidad canónica del padrón. Conserva en meta.academicHistory del
mismo registro las claves/valores originales sustituidos o retirados y las claves
añadidas, asociados a la versión anterior. Conserva sesiones originales cuando
cambian. Descarta cualquier historial suministrado por el cliente y mantiene el
historial almacenado. El archivo remoto completo es privado de Admin; las lecturas y
confirmaciones docentes reciben un marcador vacío, sin divulgar claves históricas
que pudieran pertenecer a otros contextos. Un cliente anterior no puede escribir sobre un registro que
ya tiene este historial: debe actualizarse. No cambia permisos ni notas por sí solo.

El historial no se trunca. Si supera el límite seguro de 49 000 caracteres, se
rechaza la subida íntegramente antes de escribir, conservando la fila y el borrador.
Este límite exige una solución posterior de archivo privado antes de historiales
muy grandes; no se autoriza borrar datos para liberar espacio.

## Propuesta de migración, solo simulación

`IEAcademicIdentity.dryRun` entrega original, propuesta, ambigüedades y claves no
verificables. `simulate` y `reverse` solo devuelven copias en memoria; comprueban
la base exacta, son idempotentes y rechazan modificaciones inesperadas. No acceden
a red ni almacenamiento. No existe botón para aplicarlos a producción. Las notas
contradictorias nunca producen una propuesta aplicable automáticamente.

## Dependencias, rollout y reversión (no ejecutados)

1. Revisar DRAFT, CI y pruebas sintéticas; autorizar cada merge/despliegue aparte.
2. Conservar una copia privada de fuentes y la versión previa del backend. Desplegar
   conjuntamente Codigo.js y AcademicIdentity.js, incluyendo las barreras del PR90.
   No se inicializan padrones ni migran filas durante despliegue.
3. Frontend después: SW21 precachea el nuevo resolvedor y los recursos acoplados;
   conserva network-first, siete días, exclusión de datos privados y fallback seguro.
4. Verificar primero con transporte/hojas ficticios. Antes de una confirmación manual
   real, revisar ambigüedades y la existencia del padrón autorizado del bimestre.
5. Reversión: revertir frontend conservando respaldos. Mantener la guarda del backend
   contra clientes anteriores en filas con historial; revertirla a ciegas permitiría
   perder ese historial. Una restauración de identidades requiere propuesta revisada,
   versión CAS y autorización específica. No se ejecuta en esta fase.

Riesgos pendientes: nombres históricos sin evidencia oficial; correcciones de ID sin
tabla oficial de equivalencias; límite de celda con historial extenso; dispositivos
con JS antiguo deben actualizarse antes de escribir filas ya confirmadas con Fase2.
Fase 3 (conexión obligatoria) no se implementa en este PR.
