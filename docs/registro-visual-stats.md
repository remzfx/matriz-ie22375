# Registro — bloque visual 3, 6, 7 y 10

Base auditada: main `8439fb47259ad8667842f3f9f5a6bd35ae2e5520`, después de fusionar PR #80. Sin notas reales ni consultas a producción.

## Auditoría y diseño

Promedios ya tenía una fila C/B/A/AD, encabezado oscuro continuo, controles masivos y ampliación por conclusiones. La forma circular, ancho fijo del nombre y acumulación de contexto/aviso/controles dificultaban leer y seleccionar. Resumen ya mostraba resultados por competencia, promedio referencial y estadísticas de ese promedio, pero faltaban estadísticas por competencia y sus columnas podían quedar demasiado angostas al imprimir.

El diseño mantiene la estructura académica: botones rectangulares con esquinas de 8 px, 44×44 px, selección con contraste/borde y aria-pressed; separaciones compactas sin reducir el objetivo táctil. Contexto, aviso y conteo se agrupan; la barra masiva y Letras/0–20 comparten fila en PC y usan dos filas compactas en móvil. No se elimina ningún control.

Los nombres completos ocupan una línea en PC y se ajustan sin truncar en móvil. Cada competencia conserva su columna; las que necesitan conclusión se amplían con el criterio existente (Primaria B/C, Secundaria C). La tabla mantiene scroll interno y encabezado oscuro continuo. En móvil se reserva espacio para los cuatro botones al lado del nombre sticky: 120 px de nombre + 182 px de botones/gaps + 12 px de padding, dentro de 316 px disponibles en la fixture de 390 px.

## Estadísticas de lectura

Se reutiliza IERegistroAcademico.statistics y notaCompAlumno: el directo efectivo prevalece; las evidencias se interpretan mediante la lógica actual. Ninguna estadística recalcula ni guarda una nota.

- AD/A/B/C: cantidad y porcentaje sobre estudiantes evaluados de esa competencia. Si no hay evaluados, porcentajes 0; no NaN/Infinity.
- Sin nota: estudiantes matriculados de esa competencia trabajada que todavía no tienen resultado efectivo.
- Conclusiones pendientes: conclusiones obligatorias ausentes según las reglas actuales; se muestra solo el conteo, nunca el contenido.
- Avance: evaluados/matriculados y porcentaje. No equivale a cierre confirmado ni registro completo para SIAGIE.
- No trabajada: etiqueta explícita; no se inventan pendientes ni calificaciones.

Se muestran en Promedios y Resumen para Docente/Admin, usando el alumnado/competencias ya filtrados por la sesión. Al editar una conclusión se actualiza el conteo usando el mismo setter y guardado existente; la actualización estadística no hace un guardado adicional. Los resultados y las conclusiones almacenadas permanecen intactos al renderizar/cambiar la presentación.

## Impresión y PDF

Resumen conserva el botón imprimir/PDF y su función original. Sus reglas de impresión ajustan nombres/competencias sin truncar, repiten encabezados, ocultan controles y el resto de la aplicación para evitar espacio vacío. El resumen usa una página nombrada A4 horizontal y las estadísticas por competencia también se imprimen. La clasificación del promedio referencial sigue siendo informativa y no reemplaza resultados SIAGIE.

Se comprobó visualmente una representación de las reglas reales @media print con datos ficticios; no se exportó un PDF real desde el navegador integrado. Revisar la paginación/márgenes finales en la vista nativa de impresión de Chrome/Edge/Safari antes de producción, especialmente con aulas grandes. El tamaño de papel nombrado depende del soporte del navegador; el ajuste de texto no depende de esa opción.

## Compatibilidad y validación

No cambia aplicarFinalManual, calificarAreaMasiva, quitarFinalManual, quitarAreaMasiva, selector general, cálculos, conclusiones, guardado, cierres, permisos, sincronización ni Apps Script. No cambia A1, B1, B2, students.js, módulos transversales ni Service Worker.

Las regresiones actuales comparan todo el código previo tras excluir únicamente el bloque CSS/HTML nuevo y los hooks estadísticos declarados en registro-visual-snapshot.cjs. Las pruebas nuevas usan fuente actual sin esa normalización y verifican denominadores, cero evaluados, no trabajadas, readonly, impresión, actualización de conclusiones y ausencia de escrituras remotas.

Demostración reproducible aislada:

```powershell
node tests/registro-visual-demo.cjs "$env:TEMP\registro-visual.html"
node tests/registro-visual-demo.cjs "$env:TEMP\registro-visual-print.html" --print-preview
```

Abrir estos HTML locales en un navegador/Live Server. El generador incluye el CSS, render y handlers actuales, con roster/notas exclusivamente ficticios. Red bloqueada por CSP y stub; almacenamiento en memoria. Las confirmaciones masivas se cancelan deliberadamente en la fixture; no son cambios a producción. El modo de impresión aplica las reglas reales de impresión a la pantalla para inspeccionar el contenido sin abrir diálogos del sistema.

Revisión visual realizada en PC 1280×900 y móvil 390×844: EPT (1), Arte y Cultura (2), Comunicación (3), Ciencia y Tecnología (3), Matemática (4), Personal Social Primaria (5). Cuatro controles 44×44 en la misma coordenada vertical, nombres íntegros, ampliación por conclusiones y scroll interno. Documento móvil 375 px de ancho más 15 px de scrollbar, sin desbordamiento horizontal de página. Resumen Admin/Docente y modo cerrado conservan resultados, restricciones y selector de presentación.

No merge ni deploy sin autorización expresa.

Validación local final: 1825 pruebas aprobadas, 0 fallidas/omitidas. Sintaxis: 91 JS/GS y 28 scripts inline. Dependencias locales: 67. git diff --check correcto.
