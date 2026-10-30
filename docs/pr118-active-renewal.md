# PR #118 — renovación periódica y bloqueo de controles

Base: `06227151383b357f0018e5eb0f4249411c729b01`.
Solo reloj, cuenta, controles y transporte ficticios. No se consultó producción.

## Resultado y límite

**No se certifica resuelto el bloqueo periódico reportado sin cambio de contexto.**
Tres renovaciones consecutivas sobre el adaptador N2 y controlador reales, con
latencias de 4 y 7 segundos, mantienen `canEdit()` y los controles habilitados
durante `checking`. No basta observar ese estado para atribuirle el bloqueo.

Sí se demostró y corrigió una carrera al cambiar contexto durante una renovación:
el `finally` de la petición anterior inicia la verificación del nuevo contexto;
otro llamador, que esperaba la misma petición anterior, continúa sin comprobar
esa nueva petición en curso y la duplica. La segunda reemplaza el epoch de la
primera y descarta su respuesta válida. Con transporte serializado, esto prolonga
el bloqueo necesario para autorizar el contexto nuevo.

## Corrección mínima

En `check()`, volver a examinar `flight` después de cada espera: `if(flight)` pasa
a `while(flight)`. Se aplica idénticamente a `registro-connection.js` y su copia
inline en `registro.html`. Un llamador se une a la nueva petición del mismo
binding; una revisión explícita conserva su recorrido. No se cambia ningún
intervalo, margen, lease, autorización, permiso, cierre, CAS, renderer o escritor.

## Cronología normal, latencia de 4 segundos

| Momento (s) | Operación/estado | validUntil (s) | canEdit |
|---|---|---|---|
| 0 | Primera comprobación / checking | 0 | false |
| 4 | connected | 150 | true |
| 120 | Renovación / checking | 150 | true |
| 124 | connected | 270 | true |
| 240 | Renovación / checking | 270 | true |
| 244 | connected | 390 | true |
| 360 | Renovación / checking | 390 | true |
| 364 | connected | 510 | true |

Se conserva el plazo anterior durante la petición y se renueva solo tras la
respuesta válida. El margen observado es 30 segundos; 4/7 segundos terminan
antes de su vencimiento. Ningún `watchLease` vence durante esas renovaciones.
Los tiempos son del reloj sintético, no mediciones del servicio institucional.

## Diferencial de la carrera corregida

Transporte serializado ficticio de 4 segundos por comprobación:

| Evento | Antes | Después |
|---|---:|---:|
| Cambio A→B con renovación pendiente | 124 s | 124 s |
| B autorizado | 136 s | 132 s |
| Espera de autorización de B | 12 s | 8 s |
| Comprobaciones totales, incluida inicial | 4 | 3 |

Las sesiones estables mantienen cuatro `academicstate` y cuatro consultas de
periodos (inicial + tres renovaciones), una descarga académica inicial y cero
escrituras. No se agregan solicitudes ni se renueva usando solo la caché.

## Pausas que permanecen protegidas

- Error de servidor: checking a los 120 s sigue editable; error a los 124 s pasa
  a server y pausa; el reintento existente a los 139 s termina a los 143 s y
  recupera edición. Las notas y conclusiones pendientes permanecen intactas.
  Este patrón reproduce el síntoma, pero no prueba su causa en el equipo real.
- Revocación: session permanece bloqueado para la misma sesión, sin reintentos
  de autenticación ni pérdida de valores introducidos.
- Vencimiento real: prueba aislada del controlador con respuesta retenida hasta
  165 s; `watchLease` pausa exactamente a los 150 s. La nueva respuesta puede
  autorizar de nuevo desde 165 s, nunca retroactivamente. Esto no modifica ni
  simula como éxito el timeout HTTP existente del adaptador.
- Cambio de contexto: la respuesta anterior no concede acceso al contexto nuevo.

Para atribuir el bloqueo sin navegación falta identificar qué transición real
ocurre: error del verificador, vencimiento, cierre o invalidación de binding.
No se sustituye esa evidencia por una suposición ni se modifican plazos para
ocultar el síntoma. No se añaden logs de alumnos, notas, tokens o almacenamientos.

## Verificación diferencial

Siete pruebas nuevas aprobadas, incluida la comparación antes/después contra el
SHA base. Tres regresiones existentes directamente afectadas reejecutadas:
deduplicación, heartbeat real y coincidencia del controlador inline. Se reutilizan
los otros 3269 resultados previos durante el desarrollo. Sintaxis/dependencias y
diff correctos; la suite completa corresponde únicamente al CI automático.
No se repiten backend, CAS, asistencia ni simulaciones de carga de docentes.

La lista histórica normaliza solo la línea literal corregida; las mutaciones
de guardas y resultados quedan visibles. No hay cambio visual, limpieza de
almacenamiento, guardado automático, merge, deploy u operación institucional.
La carrera está corregida; la incidencia general permanece abierta para revisión.
