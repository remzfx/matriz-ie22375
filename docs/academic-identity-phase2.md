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
ya usen la identidad canónica del padrón. Conserva las claves/valores originales
sustituidos o retirados y las claves añadidas, asociados a la versión anterior.
meta.academicHistory mantiene los cambios recientes y, cuando corresponde, una
referencia verificable a bloques anteriores en la hoja privada RegistroHistorialAcademico. Conserva sesiones originales cuando
cambian. Descarta cualquier historial suministrado por el cliente y mantiene el
historial almacenado. El archivo remoto completo es privado de Admin; las lecturas y
confirmaciones docentes reciben un marcador vacío, sin divulgar claves históricas
que pudieran pertenecer a otros contextos. Un cliente anterior no puede escribir sobre un registro que
ya tiene este historial: debe actualizarse. No cambia permisos ni notas por sí solo.

El historial no se trunca. Si su JSON supera 8 000 caracteres o la fila activa
supera 47 000, esa subida manual guarda sus antecedentes intactos en bloques
inmutables de RegistroHistorialAcademico y mantiene una referencia pequeña en la
celda activa. Los bloques incluyen contexto, versión anterior, orden de partes y
SHA-256; cada fragmento es texto literal con prefijo j: (no una fórmula) y menos de
30 000 caracteres, sin separar pares Unicode. La referencia encadena el bloque
anterior, sin copiar otra vez sus datos. No hay barrido, script de migración ni
reubicación de otras filas: solo la subida manual actual, después de permisos,
cierre y CAS. Desplegar o descargar no crea la hoja ni archiva nada.

Se verifica el bloque completo antes de publicar su referencia y se guarda la fila
académica en una sola llamada setValues. Un reintento explícito reutiliza un bloque
completo ya verificado; los bloques incompletos o no vinculados no se borran ni se
presentan como versiones confirmadas. Si falla el archivo, la fila activa anterior
permanece intacta y el cliente conserva el borrador; no hay reintento automático.
Se comprueba el último bloque referenciado en las escrituras posteriores. El
historial entrante del navegador nunca sustituye el almacenado; un cliente legado
tampoco puede introducir una referencia falsa al crear un registro.

leerHistorialAcademico_(clave, history) es un helper privado SOLO DE LECTURA para
mantenimiento y recuperación revisada por el propietario del Spreadsheet: recorre
y verifica la cadena completa y devuelve las diferencias en orden. No es una ruta
GET/POST, no restaura notas y no modifica Sheets. Una referencia inválida, un bloque
ausente o alterado producen un error, nunca una recuperación aparentemente completa.
El archivo completo permanece privado de Admin/propietario; los docentes reciben
únicamente notas vigentes y el marcador histórico vacío compatible con PR91.

Reproducción sintética del head 873c331: aula de 30 estudiantes, cuatro competencias
y conclusiones; primera fila 36 768 caracteres, segunda subida bloqueada por el
historial. Con la corrección: 60/60 subidas, celda activa máxima 36 980 caracteres,
59 versiones originales recuperables; también se prueban 100 ediciones de una sola
celda, historia reciente inline más bloques anteriores, fallos parciales, corrupción,
CAS, respuesta perdida y descarga automática sin subir. No se usaron datos reales.

El límite de 49 000 sigue protegiendo el contenido académico vigente. No se puede
prometer capacidad infinita: cuotas/espacio de Sheets o un archivo inaccesible aún
pueden pausar conservadoramente la subida. Las cadenas muy extensas pueden requerir
lectura por partes en mantenimiento por límites de ejecución; sus bloques quedan
conservados. No se autoriza borrar datos para liberar espacio.

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
5. Reversión: conservar RegistroHistorialAcademico y las referencias, además de los
   respaldos. No revertir ciegamente el lector/verificador del archivo a un backend
   que no lo comprende; preparar una restauración revisada por versión si hiciera falta.
   Revertir frontend conservando respaldos. Mantener la guarda del backend
   contra clientes anteriores en filas con historial; revertirla a ciegas permitiría
   perder ese historial. Una restauración de identidades requiere propuesta revisada,
   versión CAS y autorización específica. No se ejecuta en esta fase.

Riesgos pendientes: nombres históricos sin evidencia oficial; correcciones de ID sin
tabla oficial de equivalencias; cuotas/capacidad del archivo privado y tamaño del
contenido vigente (no del historial acumulado); dispositivos
con JS antiguo deben actualizarse antes de escribir filas ya confirmadas con Fase2.
Fase 3 (conexión obligatoria) no se implementa en este PR.
