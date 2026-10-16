# Consulta durante revisión de sincronización

Base main `96829312848251fdea6cdb787dfe2a75da2b1314`. Se reutiliza el diagnóstico
del PR96 (`docs/sync-directed-diagnostic.md` en ese PR), sin modificarlo, incorporarlo
ni ejecutarlo sobre producción. Este cambio no contiene código de PR94.

## Causa demostrada y alcance seguro

`review` pausa la edición por diseño. Antes, la barra no distinguía un conflicto
real de un pendiente sin conflicto, ni indicaba módulo, cantidad o motivo. Además,
al consultar otra fecha con sesión activa y trabajo pendiente, se podía ofrecer
Guardar aunque el contexto fuera de solo lectura; el handler podía mostrar
«Guardado» tras un guardado rechazado. Se elimina esa oferta en solo lectura.
Las pestañas y botones de consulta ya eran accesibles; no se atribuye a `main.inert`
un bloqueo inexistente ni se quitan guardas de notas para habilitar la consulta.

La barra ahora muestra el desglose de la conciliación que realmente se ejecutó:
Calificar, Promedios, Asistencia, Identidad histórica, Conclusiones u otro módulo,
total de conflictos y causas. El resumen es efímero, ligado a contexto/token y no
contiene nombres, IDs, claves de notas ni valores académicos. No hace otra lectura
ni crea respaldos. Un conflicto conjunto puede afectar varios módulos; el total
no es la suma de sus cantidades. Un pendiente local sin conflicto se identifica
como tal, con cero conflictos confirmados. El cierre se informa por separado.

**No se habilita edición académica parcial.** Las evidencias cambian resultados
calculados y aportes; las notas directas conservan su prioridad, pero forman parte
del mismo payload que evidencias, sesiones, conclusiones e identidad. La subida
vigente protege todo el área/aula/bimestre con una sola versión CAS, no una versión
independiente por pestaña. No se ha demostrado que permitir edición en una pestaña
aislada sea seguro durante esa revisión. Se detiene cualquier ampliación de edición
parcial: requeriría evidencia del estado real y una propuesta independiente revisada.

### Controles

| Disponibles durante revisión, con datos autorizados | Permanecen protegidos |
| --- | --- |
| Calificar, Promedios, Resumen, Asistencia | Edición de notas, evidencias y conclusiones |
| Consultar sesiones/fechas ya existentes | Agregar/borrar sesión, capacidad o asistencia |
| Selector visual Letras/0–20 y lectura de valores | Masivo/Quitar y competencia trabajada |
| Impresión de Calificar y Promedios, con sus validaciones propias | Guardar/Subir/Recuperar mientras no lo permitan las guardas |
| Revisión explícita y consulta de respaldos existentes | Confirmaciones Tutor sin conexión verificada |

Un periodo cerrado/bloqueado sigue sin admitir edición. No se toca autorización,
lease, CAS, reconciliación, identidad, almacenamiento ni el backend. Las consultas
no seleccionan ganadores ni confirman notas. La navegación puede cambiar una
preferencia de visualización, pero no el contenido académico en conflicto.

## Primera computadora y reproducciones

Las pruebas verifican el almacenamiento académico real de la fixture, no la frase
«nunca abrí el sistema». Con notas/sesiones/base vacías y una nube coherente, la
descarga automática establece la base y queda `connected`, sin review ni subidas.
Una sesión con notas preexistentes, contradicciones de identidad o pendientes no
es una PC vacía. No se introducen resets ni un atajo que ignore esos registros.
No se reprodujo un fallo del motor en la primera descarga válida; no se cambia.

Se prueban por separado: conflicto solo de Promedios con Calificar idéntico,
conflicto solo de Calificar, contradicción histórica, pendiente unilateral sin
conflicto y periodo cerrado. En todos se conservan originales y cero subidas.
La interfaz real en 1366/390 px usa Secundaria 1A EPT III, 28 estudiantes ficticios,
dos sesiones, 56 evidencias y una nota directa. Tras el conflicto de Promedios
se consultan las sesiones y se imprimen ambos registros; no cambian los mapas
académicos ni aparece una oferta de guardar al navegar en solo lectura.

Las fixtures iniciales se corrigieron para respetar versiones CAS distintas y
el contrato completo del registro (incluido el mapa vacío de asistencia). No se
eliminaron validaciones para que pasaran; las guardas históricas admiten únicamente
los hashes exactos del resumen/mensaje y la condición de consulta aprobada.
El primer CI detectó nueve incompatibilidades de fixtures/expectativas previas.
Se conservó «Hay notas diferentes» con el desglose adicional, se evitó evaluar la
guarda en una sesión inexistente y se mantuvo el mensaje reconocido del rechazo
por hash. Los 129 casos de los archivos afectados aprobaron sin eliminar pruebas.
El HEAD corregido requiere una nueva ejecución general de CI por ese fallo.

## Ejecución aislada desde GitHub Desktop

Sin abrir el registro contra el backend real: Fetch origin, seleccionar esta rama,
Repository → Open in terminal. Con Node 24 disponible:

```powershell
node --test --test-name-pattern="Review controls" tests/registro-connection.test.cjs
```

Los tests contienen usuarios y transporte ficticios; no necesitan iniciar sesión,
copiar datos de la escuela, limpiar almacenamiento ni restaurar respaldos.
La regresión de navegador requiere Playwright y Edge/Chromium disponibles; en este
equipo se ejecuta con la biblioteca de herramientas ya instalada:

```powershell
$env:IE_PLAYWRIGHT_MODULE='C:/Users/Jared/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
node tests/review-consultation-browser.cjs
```

El runner abre perfiles temporales en `https://fixture.invalid/`, aborta toda red
externa y cierra sus contextos al terminar. No utiliza el perfil habitual del docente.
Si falta esa biblioteca no probar en producción: usar los resultados adjuntos o
configurar Playwright en un entorno aislado. La suite general final se ejecuta en CI.

Pendiente: revisión independiente del alcance. La causa concreta de los conflictos
de la computadora real aún requiere el diagnóstico autorizado del PR96; no se
puede inferir del respaldo antiguo. No merge, deploy ni operaciones sobre notas reales.
