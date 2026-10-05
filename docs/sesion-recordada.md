# Estrategia mínima para «Recordar sesión»

El token firmado continúa venciendo a las **12 horas**. La casilla «Recordar sesión en este equipo» conserva el perfil solo hasta ese vencimiento; no convierte el navegador en una autoridad ni permite un login local.

Para dar continuidad al día siguiente, el cambio futuro mínimo recomendado es una **revalidación silenciosa** mediante un identificador de sesión revocable, aleatorio, rotatorio y almacenado de forma segura por el backend. Al abrir el sistema, el navegador presentaría ese identificador a una ruta dedicada; el servidor comprobaría usuario, revocación y `permisosVersion`, rotaría el identificador y emitiría un nuevo token corto. Un fallo debe volver al login normal y nunca aceptar la caché como autenticación.

No se amplía ahora la vida del token: hacerlo aumentaría la ventana de uso de un equipo perdido o compartido y retrasaría la aplicación de una revocación. La caché de estudiantes sigue limitada por la expiración firmada del token actual.
