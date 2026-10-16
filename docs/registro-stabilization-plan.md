# Estabilización del Registro — fases dependientes, PR DRAFT separados

Base: main a5be5a91185fc3621994f99eeb90cddef4af9847, después del PR #89.
Reutiliza A1/B1/CAS, el almacenamiento por propietario y los respaldos existentes.
No autoriza merge, deploy, escrituras, migración ni limpieza de datos oficiales.

## Arquitectura y dependencias

| Fase | Responsabilidad y entrega | Dependencia / aceptación |
|---|---|---|
| 1 — lecturas y respaldos | Barrera antes de A1 y cualquier recuperación: ausencia inesperada, JSON corrupto, forma incompleta, versión regresiva o misma versión con contenido diferente no reemplazan datos. Respaldos pre-reemplazo verificados y acotados. | PR independiente desde main. Dispositivo limpio recibe versión válida; local/base/respaldo intactos ante fallo. |
| 2 — identidad académica | Resolvedor compartido para alumno ID/código desde padrón del bimestre y equivalencias de competencia explícitas/versionadas. Proyección canónica activa única, originales e historial preservados. Revisión explícita de valores/modos contradictorios. | Sobre fase 1 aprobada; otro PR. Plan dry-run e idempotencia/CAS; cero migraciones automáticas en producción. |
| 3 — conexión y estados | Edición requiere verificación del contexto/propietario/sesión contra servidor; offline/fallo la pausa, conserva borrador y consulta/navegación. Reconexión verifica antes de habilitar. | Sobre fases 1–2; otro PR. Sustituye expresamente la política local-first anterior, no se mezcla en fase 1. |
| 4 — aceptación | Dos computadoras ficticias, sin notas oficiales: actualización de una limpia, borrador pendiente, identidad histórica, concurrentes, timeout, respuesta perdida, permisos/cierres y reconexión. | Sobre las tres fases; PR de aceptación sin nuevas funcionalidades. |

Guardar sigue siendo persistencia local; la subida académica sigue siendo manual.
La descarga automática inicia al abrir un contexto autorizado: no equivale a una subida.
Los flujos transversales vigentes requieren pruebas propias antes de cualquier cambio;
ninguna fase debe introducir una subida académica de fondo.
Cada PR tendrá su diff aislado; si se preparan en cadena, el segundo apunta inicialmente
a la rama previa y se reorienta/actualiza desde main solo después de su autorización.
La aprobación de una fase no habilita desplegar el conjunto incompleto.

## Fase 1 implementada en esta rama

`validateRemote` no reemplaza A1: valida primero el transporte/contenido. Una primera
lectura genuinamente nueva puede ser vacía. Tras una versión verificada, fila ausente,
retroceso, omisión de un campo con datos, vaciado global sin tombstones o contenido
distinto bajo la misma versión son errores recuperables: local/base/backups quedan intactos.
Las rutas legacy dispersas se admiten en su primera lectura si su forma es válida.
Una base antigua con versión y baseline canónico pero sin basePayload también se verifica;
si ese baseline es ilegible, no autoriza reemplazar datos.
El backend devuelve READ_CORRUPT al leer JSON ilegible/raíz inválida de una fila autorizada;
no devuelve un falso registro vacío y no repara la hoja. La lectura usa last - 1 filas
tras la cabecera: no intenta interpretar una fila fantasma posterior al último registro.

Para diferencias parciales, A1 recibe reviewAbsence: la ausencia física de un dato conocido
sin tombstone requiere decisión explícita, en lugar de interpretarla automáticamente
como una orden de borrado. Se mantiene el soporte a tombstones, permisos, concurrencia
y asistencia compartida. Ningún timestamp elige una nota contradictoria.

Antes de aplicar un plan distinto del local se conserva una copia pre-reemplazo, base y
versión en readBackups del contexto/propietario (máximo tres entradas distintas), además
del slot recovery existente. Son datos exclusivamente locales; no forman parte del payload
enviado a Sheets. Una lectura idéntica no reemplaza el respaldo útil. La persistencia se
relee antes de continuar; si falla por cuota/verificación no se aplica el reemplazo.
La recuperación existente mantiene su confirmación y respaldo IndexedDB de siete días.
No se presenta este archivo local como respaldo institucional permanente o cifrado.

## Riesgos y compatibilidad

- La desaparición física de notas de clientes antiguos puede requerir revisión aunque
  fuera intencional. Es una pausa conservadora, no una recuperación forzada. Una fila
  totalmente vacía/incompleta conocida se bloquea hasta revisar su integridad; no añadir
  un botón que salte la barrera o el CAS.
- readBackups es un archivo local acotado, sujeto a cuota/perfil del navegador. Puede
  detener una actualización válida si no se confirma el respaldo: debe conservarse el
  dispositivo abierto y resolver almacenamiento sin borrar el borrador.
- Fase 1 no consolida identidades ni cambia la política offline. No declarar terminada
  la estabilización antes de revisar y aceptar fases 2–4.
- No se infiere que una respuesta válida pruebe por sí sola la intención de cada borrado.
  Por eso las ausencias parciales van al diálogo existente de decisiones A1.

## Despliegue compatible propuesto — no ejecutado

1. Revisar/autorizar PR y CI; respaldar privadamente fuentes y versión de Apps Script.
2. Backend primero: nuevo READ_CORRUPT es un error compatible con el frontend existente;
   no cambia rutas, autenticación, formato de RegistroNotas ni escrituras.
3. Frontend después: las barreras trabajan también con backend anterior; no necesitan
   una bandera de cliente para autorizar reemplazos. Los módulos inline/referencia son iguales.
4. Prueba sintética aislada antes de uso institucional, sin recuperar ni subir datos reales.
5. Reversión: revertir el PR y restaurar la versión anterior del backend si fuera necesario.
   Los respaldos locales adicionales se ignoran por clientes previos; no hay migración de hoja.
   La reversión retira barreras protectoras y debe evaluarse antes de volver a operar.

## Pruebas y criterios

Casos específicos en registro-read-integrity.test.cjs: raíz/mapas/valores inválidos,
fila nueva y ausente conocida, rollback/misma versión, letras frente a referencias,
lectura incompleta/vacía, tombstones, reapertura, desaparición parcial, actualización
limpia, backup persistente/acotado, cuota, borrador/conclusión concurrentes y backend
corrupto simulado. Las suites existentes conservan A1/B1/CAS, propietario, cierres y
asistencia. Los snapshots históricos solo excluyen el diff exacto probado de esta fase.
Ejecutar específicas durante la edición y una suite completa final; CI valida el HEAD publicado.
