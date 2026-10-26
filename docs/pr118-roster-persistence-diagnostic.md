# PR #118: persistencia local de padrones — diagnóstico focalizado

## Evidencia demostrada con datos ficticios

`pintarPadronInmediato()` asigna `bdEstudiantes` y `padronBimestre` antes de
`recordarPadron(base); saveStore()`. Su `catch` sustituye cualquier excepción
por el mismo mensaje «No se pudo conservar el padrón local», sin conservar
la causa. Por tanto, mostrar estudiantes y ese error es compatible.

En Notas2, `saveStore()` delega en `IERegistroNotas2UI.persist()`:

- Lee la clave de Registro separada por cuenta mediante `registroLocal.read()`.
- Interpreta el JSON anterior una sola vez por instancia del adaptador.
- Conserva los datos académicos anteriores y persiste únicamente cambios en
  asistencia, fechas y estados de asistencia. No guarda el padrón completo.
- `registroLocal` rechaza cambios de cuenta y modificaciones de otra pestaña;
  verifica la escritura y no acepta sobrescrituras silenciosas.

Las seis reproducciones nuevas reutilizan las fixtures existentes y las
funciones reales. Demuestran:

1. I → II → III → I funciona; los alias se acumulan por identidad/aula sin
   crear una copia del Registro por bimestre ni escribir notas en disco/nube.
2. `SecurityError` de lectura, JSON ilegible, modificación concurrente y
   `QuotaExceededError` al escribir asistencia producen exactamente el mismo
   aviso en I y III. Se conservan el disco anterior y los cambios en memoria;
   ninguna reproducción realiza una petición de escritura remota.
3. Dos almacenes de origen independientes no comparten datos aunque la cuenta
   y el nombre de la clave sean iguales. Esta prueba modela el aislamiento;
   no inspecciona el navegador afectado.

La caché real de `students.js` es otra operación: guarda entradas por ámbito
`PADRON_I`, etc., ligadas al token, en memoria/sessionStorage/localStorage.
Captura sus propios fallos de escritura; no emite este aviso. Varios padrones
pueden aumentar el uso de almacenamiento, pero eso no demuestra una cuota
agotada en el equipo reportado. La incorporación posterior de I/II desde
Admin no demuestra corrupción remota ni exige volver a subirlos.

## Origen y límite del diagnóstico

Live Server (`http://localhost:puerto` o `http://127.0.0.1:puerto`) y el dominio
publicado tienen almacenes diferentes. Cambiar protocolo, host, puerto o perfil
puede cambiar el almacén disponible. No se han abierto perfiles reales ni
consultado sus claves, tamaños o contenido; no se certifica una excepción
concreta del dispositivo a partir del texto genérico.

Falta recoger **solo** la URL/origen sin credenciales y el nombre, mensaje y
pila de la excepción original: en el depurador, pausar en excepciones
capturadas dentro del bloque `try` de `pintarPadronInmediato`. No copiar
contenido del almacenamiento, padrones, nombres, notas ni tokens.

## Riesgo y siguiente paso

La caché visible no certifica persistencia. Los cambios académicos nuevos de
Notas2 en memoria no pasan a persistir por esta llamada: no cerrar, recargar,
limpiar almacenamiento ni reemplazar datos para intentar resolver el aviso.
No se ha demostrado pérdida efectiva de borradores ni que su almacenamiento
independiente haya fallado; tampoco se garantiza su recuperación sin comprobarlo.

No se cambia código de producción mientras falte identificar la excepción
del equipo. Corregir después únicamente la causa reproducida; conservar las
guardas de cuenta/pestañas y no recomendar liberar espacio mediante borrado de
datos institucionales. Este diagnóstico no modifica ni vuelve a subir padrones.

Validación focalizada: **53 aprobadas, 0 fallidas, 0 omitidas**; sintaxis de
234 JS/GS y 36 scripts inline, 90 dependencias y `git diff --check` correctos.
Sin merge, deploy ni operaciones institucionales. PR #118 continúa DRAFT.
