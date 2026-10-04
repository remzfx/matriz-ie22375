# AGENTS.md — I.E. 22375 Santa Rosa

## Objetivo del proyecto

Este repositorio contiene el sistema académico de la **I.E. N.° 22375 “Santa Rosa” — San José de los Molinos, Ica**.

El sistema ya está en uso. Prioriza **estabilidad, compatibilidad y conservación de datos** sobre reescrituras grandes.

## Stack actual

- Frontend: HTML + CSS/Tailwind + JavaScript puro
- Hosting: GitHub Pages
- Backend: Google Apps Script
- Datos: Google Sheets + localStorage/sessionStorage
- Dominio: biblioteca360.com / matriz.biblioteca360.com

No introducir frameworks ni reemplazar la arquitectura actual salvo pedido explícito.

## Archivos principales

- `index.html`: login y selección de módulos
- `admin.html`: docentes, accesos, bimestres y configuración
- `registro.html`: Registro auxiliar, notas, competencias, capacidades, asistencia y resúmenes
- `primaria.html`: Matriz consolidada Primaria
- `secundaria.html`: Matriz consolidada Secundaria
- `auxiliar.html`: asistencia/QR
- `photochecks.html`: fotochecks QR
- `aula_innovacion.html`: AIP
- `bd_oficial_2026.json`: base oficial de estudiantes
- Apps Script: sincronización con Google Sheets y acciones de nube

Antes de editar, leer siempre la versión actual desde `main`.

## Reglas de negocio críticas

### Admin es la fuente de verdad

La configuración hecha en Admin debe gobernar los demás módulos.

No hardcodear como reglas permanentes:
- permisos de docentes
- aulas
- áreas
- bimestres
- cantidad de estudiantes

Un fallback nunca debe sobreescribir una configuración válida de Admin/nube.

### Permisos docentes

Cada docente tiene cuenta individual.

Primaria:
- solo ve los grados asignados.

Secundaria:
- debe existir relación exacta **área → aula(s)**.
- No tratar `areas` y `aulas` como conjuntos independientes.

Estructura preferida:

```js
{
  user,
  pass,
  nombre,
  nivel: "secundaria",
  areas: ["Matemática", "Ciencia y Tecnología"],
  aulas: ["1|A", "1|B", "2|A", "2|B", "5|ÚNICA"],
  asignaciones: {
    "Matemática": ["1|A", "1|B", "2|A", "2|B"],
    "Ciencia y Tecnología": ["5|ÚNICA"]
  }
}
```

Ese ejemplo es solo ilustrativo. No hardcodearlo globalmente.

Si el docente selecciona 5° Única y allí solo tiene Ciencia y Tecnología, Matemática no debe aparecer.

Aplicar la misma lógica área→aula en:
- sesión de login
- Registro auxiliar
- Matriz Secundaria
- Comparativo
- futuros módulos docentes

Mantener compatibilidad con registros antiguos sin `asignaciones`, pero preferir migración desde Admin.

### Bimestres

Admin controla el estado:
- `abierto`
- `cerrado`
- `bloqueado`

Reglas:
- Registro auxiliar del docente: solo bimestres permitidos por Admin deben ser seleccionables/editables.
- Matrices consolidadas: bimestres cerrados/bloqueados pueden consultarse, pero deben quedar **solo lectura**.
- El backend debe rechazar escrituras a bimestres no abiertos.
- No inventar estados locales si existe configuración válida de Admin/nube.

### Cantidad de estudiantes

No es un campo manual.

Debe calcularse desde la base oficial según:
- nivel
- grado
- sección

Mostrarla solo como dato informativo.

No permitir edición manual ni dejar que registros antiguos de matriz reemplacen el total oficial.

### Categorías de logro

Etiquetas visibles:
- C = Inicio
- B = Proceso
- A = Logrado
- AD = Destacado

La clave interna `previsto` puede existir por compatibilidad. No renombrar claves almacenadas sin migración.

## Rendimiento

Preferir **render local inmediato + actualización de nube en segundo plano**.

La interfaz debe pintar de inmediato usando:
- datos embebidos
- última caché válida
- sesión actual

Luego refrescar la nube asincrónicamente.

Evitar bloquear toda la pantalla con `await fetch(...)` antes de mostrar:
- docente
- grado
- sección
- estudiantes
- áreas

si esos datos ya existen localmente.

Login:
- usar caché temporal de docentes
- refrescar si está vencida
- conservar fallback compatible con Safari/iPhone

## Móvil

El sistema se usa frecuentemente en teléfonos.

En móvil:
- objetivos táctiles de al menos ~44 px
- evitar paneles sticky que quiten demasiado espacio
- permitir que el contenido académico gane pantalla al hacer scroll
- filas de muchos botones pueden desplazarse horizontalmente
- centrar texto horizontal y verticalmente
- no mostrar controles vacíos mientras se espera la nube

Desktop puede conservar comportamiento sticky cuando sea útil.

## Apps Script

Cuando se cambie backend:

1. Mantener la URL de implementación existente cuando sea posible.
2. Actualizar la implementación existente con una nueva versión.
3. Preservar acciones y payloads existentes.
4. Añadir rutas sin romper las anteriores.
5. Probar GET/JSONP y POST cuando haya problemas cross-origin/móvil.
6. Evitar llamadas innecesarias a Sheets.

Cuando se entregue Apps Script al usuario, entregar el **código completo y compacto**, no solo un parche.

Flujo preferido del usuario:
- Ctrl+A
- reemplazar todo
- guardar
- nueva versión de la implementación

No expandir el script a miles de líneas por reformateo innecesario.

## Seguridad y datos

No exponer en documentación, logs, PRs o pruebas:
- contraseñas
- DNI
- listados completos de estudiantes
- otros datos personales

No agregar nuevas credenciales en texto plano al repositorio.

No borrar o resetear silenciosamente:
- estudiantes
- permisos docentes
- IDs
- claves de localStorage
- estados de bimestre
- esquemas de Sheets

Cuando cambie un esquema, mantener compatibilidad y migrar deliberadamente.

## Forma de trabajo

Para cada cambio:

1. Entender/reproducir el comportamiento actual.
2. Leer los archivos relevantes desde `main`.
3. Identificar la causa raíz.
4. Hacer el cambio coherente más pequeño posible.
5. Evitar refactors no relacionados.
6. Conservar compatibilidad.
7. Validar sintaxis JavaScript de scripts inline modificados.
8. Revisar consumidores cuando cambie un esquema compartido.
9. Preferir branch + PR + merge.
10. Releer `main` después del merge.

No reportar un arreglo como terminado hasta verificar que está realmente en `main`.

## Cambios que requieren revisión cruzada

Asignación docente:
- `admin.html`
- `index.html`
- `registro.html`
- `secundaria.html`

Bimestres:
- `admin.html`
- `registro.html`
- `primaria.html`
- `secundaria.html`
- guards del Apps Script

Base de estudiantes:
- Registro
- Matriz Primaria
- Matriz Secundaria
- flujo de importación de Admin

## Escenarios mínimos de regresión

### Docente de Secundaria con varias áreas

Ejemplo:
- Área A → 1A, 1B
- Área B → 5U

Verificar:
- 1A muestra solo Área A
- 5U muestra solo Área B
- Registro y Matriz se comportan igual

### Bimestres

Verificar:
- abierto = editable
- cerrado/bloqueado = consulta donde corresponda, sin edición
- backend rechaza escrituras no autorizadas

### Estudiantes

Verificar:
- el total cambia por aula
- no es editable
- proviene de la base oficial

### Móvil

Verificar:
- no aparecen cabeceras vacías mientras carga nube
- botones superiores son tocables
- paneles sticky no ocultan el trabajo principal

## Lenguaje de interfaz

La interfaz es en español.

Usar terminología escolar:
- Bimestre
- Grado
- Sección
- Área
- Docente responsable
- Estudiantes
- Registro auxiliar
- Matriz consolidada
- Solo lectura

## Filosofía

Preferir:
- estable
- incremental
- comprensible
- reversible
- compatible

sobre:
- reescrituras grandes
- abstracciones innecesarias
- cambios simultáneos difíciles de verificar

La migración futura a una arquitectura más robusta puede hacerse después. La prioridad actual es estabilizar el flujo de producción existente.
