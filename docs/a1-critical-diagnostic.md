# Auditoría crítica A1 — fase diagnóstica

Este documento conserva los hallazgos del HEAD diagnóstico `68200806318b668adb0ea3f59b26cb6fbb7c7c4b`. La corrección posterior autorizada y sus regresiones se describen en [segunda fase](a1-causal-correction.md); las observaciones siguientes no representan el comportamiento corregido ni una validación en producción.

Base: `61c9d188b6736032d30c5a7b8f8e37423e9824b7` (main, PR #81 fusionado).
No se ejecutaron lecturas ni escrituras de producción. Solo documentos y pruebas nuevas; código funcional, A1/B1/B2, interfaz, Apps Script y almacenamiento real permanecen intactos.

## Conclusión y límites

**Defecto reproducido:** una carga idéntica en base/local/remoto puede generar conflictos recurrentes cuando contiene dos claves inequívocas del mismo estudiante (ID y nombre histórico) con valores diferentes. Reapertura y selección del conjunto remoto idéntico no eliminan el conflicto. Esto explica un mecanismo compatible con el incidente, pero **no confirma la causa de 1.º A**: no se inspeccionaron sus registros ni se tiene una captura anterior/posterior autorizada. No se ha demostrado pérdida de notas oficiales.

**No se reprodujo sobrescritura silenciosa de una nota local pendiente** en los escenarios ejecutados. Se compararon notas, conclusiones, base y recuperación, no solo avisos. Esto no constituye una garantía universal frente a registros históricos desconocidos, almacenamiento corrupto o fallos de disco.

## Evidencia del código

- `registro-reconcile.js:54–120`: primero concilia por ruta usando la base causal. Después `identityGroups` compara todas las representaciones de ambos conjuntos; no consulta la base ni comprueba que los conjuntos completos sean idénticos. Con ID=A y alias=C en los tres estados, añade un conflicto pese a no existir edición concurrente.
- `registro-reconcile.js:139–160`: relaciona nombre/código con ID únicamente mediante padrón y aliases inequívocos; mantiene el prefijo completo del contexto. La precaución contra identidades ambiguas es necesaria y no debe eliminarse.
- `student-identity.js:24–46`: lectura efectiva prefiere ID/código; una clave antigua por nombre puede seguir almacenada aunque no sea la nota visible. Dos valores almacenados no equivalen automáticamente a dos ediciones recientes.
- `registro-reconcile.js:8–19`: ignora timestamps y referencias numéricas cuando `origen === 'letra'`. No equipara un registro histórico sin `origen` con uno marcado letra. `registro-academic-model.js:99` conserva su propia canonicalización para versionado. No hay fundamento para convertir todos los números en letras: 12 y 13 exactos deben seguir siendo diferentes.
- `registro.html:907–926`: `loadStore`/`saveStore` leen y escriben el objeto completo, incluido `academicSync`, en almacenamiento. La base no desaparece por cerrar normalmente la sesión en la simulación; una máquina nueva carece de historial causal hasta confirmar una lectura.
- `registro.html:2956, 2987–3058`: `basePayload`, `baseline`, `version`, recuperación y tentativa se conservan por contexto. Aplicar conciliación reemplaza solo el contexto y no usa el antiguo merge por timestamps. Cancelar no actualiza la base ni envía notas.
- `registro.html:1039–1134`: descarga no realiza POST académico; subida requiere versión leída y decisión explícita, conserva tentativa y no repite automáticamente un conflicto. Controla token/contexto y cambios locales posteriores. `apps-script/Codigo.js:2044–2057` rechaza versiones académicas obsoletas y mantiene comparación canónica/idempotencia. Backend inspeccionado, no modificado.

## Escenarios y resultados

`tests/a1-diagnostic-sessions.test.cjs` ejecuta funciones actuales de Registro extraídas del HTML y módulos actuales; almacenamiento JSON en memoria y servidor ficticio con CAS. Cada reapertura crea un VM nuevo y ejecuta `loadStore` real; no existe petición externa. El informe de completitud de área y la captura DOM se aíslan: estas pruebas no sustituyen las de inputs, permisos, transversales y validación backend existentes.

| Escenario | Resultado observado |
| --- | --- |
| A: Docente sube, Admin baja, ambos reabren y vuelven a bajar | Una escritura explícita; misma nota, versión y base; sin conflictos para claves estables |
| B: local 18 pendiente, nube 15 más conclusión nueva | 18 local conservado, 15 nube intacto, conclusión recibida y dirty=true tras reapertura |
| C: local 18 / remoto 12 / base 15 | Cancelación conserva los tres estados; nueva descarga vuelve a exigir decisión |
| C: dos dispositivos con 18 y 12 | Segundo dispositivo conserva 12 y exige resolución frente a 18 confirmado |
| D: base=local=remoto, ID 15 y nombre antiguo C | Conflicto falso recurrente, sin modificación de valores ni POST al cancelar |
| D: aceptar conjunto remoto idéntico y reabrir | Conflicto reaparece; se conservan ambas representaciones |
| D: referencias letras, históricos y números exactos | Letras B referenciales 12/13 se comparan iguales; sin origen difiere; números exactos 12/13 difieren |
| E: estudiante, sección, área, bimestre y competencia diferentes | Registros separados conservados; sin contaminación del dato objetivo |
| F: resolver, reabrir, recuperar borrador | Recuperación restaura local anterior, guarda trabajo sustituido como respaldo y no escribe nube |
| G: nube cambia después de preparar subida | CAS rechaza; base 15, local 18 y remoto 12 permanecen separados |

Los dos casos titulados `Diagnostic D` de conflicto recurrente **documentan el fallo actual**, no certifican su corrección. Una futura solución autorizada debe invertir esas expectativas y añadir casos que sigan detectando divergencias reales.

## Cobertura anterior y riesgos

Las pruebas existentes `academic-reconciliation-a1.test.cjs` sí comprueban contenido para cambios locales disjuntos, cancelación, CAS rechazado, respuesta perdida, modificaciones durante la lectura/subida y recuperación. También ejecutan el backend ficticio real para CAS, cierres y revocación. No se debilitaron.

Su fixture `client()` usa `estudiantes=()=>[]` y reemplaza `saveStore`; por ello esos casos no detectaban el grupo ID/nombre de un alumno conocido ni demostraban persistencia JSON entre sesiones. Las pruebas nuevas agregan padrón ficticio, identidad real y load/save reales. `reconcile-fixture.cjs:mockUpload` aísla otros consumidores con un plan simulado: esos tests no deben presentarse como validación del conciliador completo.

Riesgo confirmado: bloqueo reiterado y decisiones innecesarias. Un usuario que seleccione masivamente remoto/local ante un conflicto genuino podría reemplazar trabajo con una versión no deseada; sería una resolución explícita, no una sobrescritura silenciosa demostrada. El respaldo es acotado a una conciliación por contexto, no un historial ilimitado. Reiniciar/borrar almacenamiento o aceptar conflictos en masa puede eliminar posibilidades de recuperación y no es una contención segura.

## Propuesta de corrección separada — requiere autorización

1. Comparar grupos de identidad como conjuntos causales completos: base/local/remoto. Si no cambió ninguna representación, conservarlas y no solicitar decisión. Si solo cambió un conjunto, aplicar las reglas de tres vías sin inferir antigüedad por timestamp.
2. Mantener conflictos explícitos cuando ambos lados cambien el resultado efectivo o haya asociación ambigua. Preservar representaciones históricas y respaldo; no migrar, borrar ni renombrar notas automáticamente. Verificar también cambios sobre aliases y borrados/tombstones.
3. Para históricos sin `origen`, definir equivalencias solo si puede probarse que son referencias de letra; no inferirlo únicamente porque 12 pertenece a B. Una pérdida de precisión numérica no debe ocultarse.
4. Añadir pruebas de no conflicto con conjunto idéntico, cambio unilateral, conflicto efectivo bilateral, alias ambiguo, deletions, cierres, reapertura, CAS y recuperación. Mantener los contratos backend y B1/B2.

No se implementó ninguna de estas propuestas.

## Contención y recuperación segura propuesta para 1.º A

Procedimiento documental, **no ejecutado**:

1. Suspender temporalmente Subir Nube y las decisiones masivas de esa aula. No borrar caché, reinstalar, limpiar localStorage ni cerrar pestañas con cambios/transversales pendientes.
2. Con autorización y manejo privado, preservar una copia íntegra de cada borrador de ambos equipos, `academicSync`/recovery/attempt, sesión/contexto sin credenciales, y una copia de solo lectura del registro remoto y su versión. No adjuntar notas/identificadores reales al PR, logs o conversaciones públicas. Si no existe herramienta autorizada para preservar el borrador, solicitar asistencia antes de tocarlo.
3. Comparar por nivel+bimestre+grado+sección+área+competencia+identidad estable. Distinguir nota efectiva, evidencia, conclusión, clave histórica y cambio pendiente. No ordenar/asociar alumnos por posición o nombre ambiguo.
4. Si todos los conjuntos son idénticos y solo difieren internamente los aliases antiguos, cancelar y conservarlos; esperar corrección revisada. Repetir descarga o elegir remotamente el mismo conjunto no resuelve este defecto.
5. Si hay discrepancia real, acordar alumno/competencia por alumno/competencia con el responsable; conservar ambas versiones y conclusiones. Nunca elegir todo remoto/local para salir del aviso. Recuperar borrador únicamente tras preservar el estado actual y comprobar contexto.
6. Tras autorización de la corrección y validación independiente, leer versión actual antes de cada subida explícita. Si CAS rechaza, detenerse y revisar, sin reintentos automáticos. Validar descarga y reapertura en ambos equipos y comparar resultados efectivos antes de dar por recuperada la sincronización.

## Verificación

Validación local: **2115 pruebas aprobadas**, cero fallos, omitidas o TODO; incluye 10 escenarios nuevos. `node scripts/check-source.cjs`: 109 archivos JS/GS, 28 scripts inline y 67 dependencias locales. `git diff --check` y revisión del diff preparado sin errores. CI se consigna en el PR al terminar. Este documento no declara corregido el incidente de producción ni autoriza merge/deploy.
