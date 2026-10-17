# Instrucciones Compartidas para Agentes de Desarrollo — I.E. 22375 Santa Rosa

Este documento establece el protocolo operativo obligatorio y la guía técnica para todos los agentes de desarrollo (Antigravity, Codex y otros) que colaboren en el repositorio `remzfx/matriz-ie22375`.

---

## 1. Protección de producción

- **Datos protegidos e históricos:** Nunca modificar calificaciones, asistencias, padrones ni otros datos reales. Proteger explícitamente los datos académicos históricos y los snapshots de periodos anteriores; queda estrictamente prohibida cualquier sobrescritura o eliminación no autorizada de información académica.
- **Backend intacto:** Nunca ejecutar pruebas de escritura contra el backend de producción (Google Apps Script / Google Sheets en producción).
- **Operaciones restringidas:** Nunca ejecutar `deploy`, `merge`, `push`, restauraciones o borrados sin autorización explícita para esa operación específica.
- **Seguridad y privacidad:** No modificar ni exponer contraseñas, DNI, listados completos de estudiantes, tokens, URLs privadas ni configuraciones sensibles en código, logs, documentación ni pruebas.

---

## 2. Desarrollo y reglas de negocio

- **Ramas autorizadas:** Trabajar única y exclusivamente en las ramas asignadas y autorizadas para la tarea.
- **Control de ramas y cambios locales:** Verificar siempre `git status` antes de cambiar de rama. No descartar, forzar ni sobrescribir cambios locales pendientes de trabajo.
- **Datos de prueba:** Utilizar únicamente datos ficticios y entornos simulados para pruebas y validaciones.
- **Calidad de solución:** Priorizar soluciones estructurales y definitivas sobre parches o paliativos acumulativos.
- **Conciliación y resolución de conflictos:** Ninguna conciliación puede elegir automáticamente entre calificaciones contradictorias. Preservar de forma íntegra el almacenamiento local, los mecanismos de recuperación (borradores/recovery), la identidad académica del estudiante y las versiones CAS (Compare-And-Swap).
- **Alcance acotado:** No modificar código, estilos ni configuraciones ajenas a la tarea asignada.
- **Reglas de negocio del sistema:**
  - *Admin es la fuente de verdad:* Las configuraciones de bimestres, permisos, asignaciones y base de datos gobernadas desde Admin tienen prioridad sobre cualquier valor local o fallback. No hardcodear permisos, aulas, áreas, bimestres ni total de estudiantes.
  - *Relación área → aula en Secundaria:* Respetar la asignación estricta por aula (`asignaciones[área] = [aulas]`). No tratar `areas` y `aulas` como conjuntos independientes:
    ```js
    {
      user, pass, nombre, nivel: "secundaria",
      areas: ["Matemática", "Ciencia y Tecnología"],
      aulas: ["1|A", "1|B", "5|ÚNICA"],
      asignaciones: {
        "Matemática": ["1|A", "1|B"],
        "Ciencia y Tecnología": ["5|ÚNICA"]
      }
    }
    ```
    Si el docente selecciona 5° Única y allí solo tiene Ciencia y Tecnología, Matemática no debe aparecer.
  - *Bimestres:* Respetar los estados `abierto` (editable), `cerrado` y `bloqueado` (solo lectura). En matrices consolidadas, los periodos cerrados/bloqueados se consultan en solo lectura. El backend debe rechazar escrituras fuera de periodos abiertos.
  - *Estudiantes:* La cantidad de estudiantes proviene de la base oficial según nivel, grado y sección; es un dato informativo y no un campo de edición manual.
  - *Categorías de logro:* C (Inicio), B (Proceso), A (Logrado), AD (Destacado). Mantener compatibilidad con claves internas históricas (`previsto`).
  - *Rendimiento y render local condicionado:* Priorizar render local inmediato para agilidad visual, pero esto **no autoriza** edición ni sincronización de escritura sin verificar primero los permisos del docente/usuario, el periodo académico habilitado y el estado de conexión.

---

## 3. Validación

- **Pruebas automáticas y CI:** Ejecutar siempre las pruebas automatizadas pertinentes y el CI completo cuando corresponda antes de dar por concluida una tarea.
- **Criterio de aprobación:** Un CI exitoso es un requisito indispensable, pero no sustituye la revisión independiente humana y técnica.
- **Transparencia:** Informar con exactitud los resultados reales de las pruebas, incluyendo fallos, advertencias o regresiones detectadas.
- **Criterio de resolución:** No afirmar que un problema de producción está resuelto basándose únicamente en pruebas sintéticas locales.
- **Integridad de tests:** Queda estrictamente prohibido eliminar, comentar o debilitar pruebas existentes para forzar un CI exitoso.

---

## 4. Integración

- **Tamaño de cambios:** Preparar cambios atómicos, pequeños, coherentes y fácilmente revisables.
- **Pull Requests:** Crear PR en estado **DRAFT** únicamente cuando sea autorizado explícitamente.
- **Merge restringido:** Prohibido fusionar ramas con `main` sin autorización explícita.
- **Despliegues:** El despliegue a producción queda reservado de forma exclusiva al responsable del proyecto.

---

## 5. Estado actual

> [!NOTE]
> Los estados de los PR son referencias temporales. Antes de comenzar cualquier tarea, verificar en GitHub el estado, rama y HEAD vigentes. No asumir que esta sección está actualizada.

- **PR #94 (Impresión):** Pendiente.
- **PR #96 (Diagnóstico de sincronización):** DRAFT.
- **PR #97 (Consulta durante conflictos):** DRAFT y CI aprobado.
- **Investigación prioritaria:** Diferencias entre Calificar, Promedios y conciliación de notas.
- **Función futura:** *Procesar a Promedios* — **todavía no implementarla**.

---

## 6. Coordinación entre agentes

- **Concurrencia de ramas:** Antigravity, Codex y otros agentes no deben modificar simultáneamente la misma rama de Git.
- **Transparencia y reporte:** Cada agente debe comunicar con precisión:
  - Rama de trabajo.
  - Hash del último commit.
  - Lista de archivos modificados.
  - Pruebas ejecutadas y su resultado.
- **Respeto al trabajo en curso:** No alterar, sobreescribir ni revertir trabajos o borradores pendientes de otro agente sin instrucción expresa del responsable del proyecto.

---

## 7. Arquitectura y mapa del sistema

### Stack técnico
- **Frontend:** HTML + CSS/Tailwind + JavaScript puro (Vanilla JS, sin frameworks).
- **Hosting:** GitHub Pages (`biblioteca360.com` / `matriz.biblioteca360.com`).
- **Backend:** Google Apps Script.
- **Datos:** Google Sheets + localStorage / sessionStorage.

### Módulos y archivos principales
- `index.html`: Login y selector de módulos docentes y administrativos.
- `admin.html`: Administración de docentes, credenciales, accesos, bimestres y configuración general.
- `registro.html`: Registro auxiliar docente (calificaciones, competencias, capacidades, asistencia, resúmenes, borradores locales y recuperación).
- `primaria.html`: Matriz consolidada de Primaria.
- `secundaria.html`: Matriz consolidada de Secundaria.
- `auxiliar.html`: Control de asistencia por QR y lectores móviles.
- `photochecks.html`: Emisión y visualización de fotochecks con código QR.
- `aula_innovacion.html`: Registro de asistencia y control de Aula de Innovación Pedagógica (AIP).
- `students.js`: Carga protegida y caché temporal de estudiantes por sesión.
- Hoja privada `EstudiantesBase`: Base oficial y respaldo administrados desde Admin.
- `apps-script/`: Código fuente del backend en Google Apps Script.

---

## 8. Criterios técnicos de implementación

### Interfaz móvil
- Objetivos táctiles de al menos ~44 px.
- Evitar paneles sticky que reduzcan excesivamente el área visible en pantallas pequeñas.
- Permitir que el contenido académico gane pantalla al desplazarse.
- Permitir scroll horizontal en filas de botones densas; centrar contenido táctil.

### Backend Google Apps Script
- El código fuente se mantiene versionado en GitHub (directorio `apps-script/`).
- Los cambios se preparan mediante ramas y PR revisables.
- El merge requiere autorización explícita.
- El despliegue de Apps Script lo realiza de forma exclusiva el responsable del proyecto mediante el procedimiento autorizado desde GitHub.
- Queda estrictamente prohibido ejecutar despliegues automáticamente o de forma manual no autorizada.
- Preservar acciones, payloads y compatibilidad de endpoints existentes; añadir rutas sin romper contratos previos.
- Validar compatibilidad de transporte (GET/JSONP vs POST) ante problemas de CORS o restricciones móviles.

### Revisión cruzada obligatoria
- **Asignación docente:** verificar impacto en `admin.html`, `index.html`, `registro.html` y `secundaria.html`.
- **Bimestres:** verificar impacto en `admin.html`, `registro.html`, `primaria.html`, `secundaria.html` y los guards de Apps Script.
- **Estudiantes:** verificar coherencia en `registro.html`, matrices consolidadas y flujo de importación en Admin.

### Escenarios mínimos de regresión
1. **Docente de Secundaria con varias áreas:** comprobar que cada aula muestre exclusivamente el área asignada (`1A` $\rightarrow$ Área A, `5U` $\rightarrow$ Área B) y coincida entre Registro y Matriz.
2. **Bimestres cerrado/bloqueado:** comprobar que los formularios queden en solo lectura y que el backend rechace escrituras no permitidas.
3. **Padrones oficiales:** comprobar que el recuento provenga de la base oficial por aula y no permita edición manual.
4. **Móvil:** verificar que los controles táctiles sean accesibles y no se generen bloqueos visuales en espera de la red.

---

## 9. Terminología y filosofía

- **Lenguaje escolar oficial (en español):** Bimestre, Grado, Sección, Área, Docente responsable, Estudiantes, Registro auxiliar, Matriz consolidada, Solo lectura.
- **Filosofía de desarrollo:** Priorizar lo estable, incremental, comprensible, reversible y compatible sobre reescrituras grandes o abstracciones prematuras.
