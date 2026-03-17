# Dashboard: edición en vivo mientras probás

Cómo tener el dashboard **corriendo** y **editable en vivo** mientras lo testeas (sin reiniciar el servidor a cada cambio).

---

## 1. Dejar todo corriendo con un solo comando

Desde la raíz del repo:

```bash
npm run dev:full
```

Esto levanta:

- **API** (puerto 3001): backend con `/api/*` y servido del dashboard en `/finanzas`.
- **Vite** (puerto 5173): app React (calculadora + pestaña Finanzas).

Abrí **http://localhost:5173**, entrá a la pestaña **Finanzas** y el dashboard se carga en el iframe.

**Variante con reinicio automático del API** al cambiar código del servidor:

```bash
npm run dev:full:watch
```

---

## 2. Edición en vivo del dashboard (HTML/CSS/JS)

El dashboard está en **`docs/bmc-dashboard-modernization/dashboard/`**:

- `index.html` — estructura, secciones, enlaces a CSS/JS.
- `styles.css` — estilos (colores, layout, tablas, botones).
- `app.js` — lógica: fetch a `/api/*`, pintado de tablas, botones (Actualizar, Marcar entregado, etc.).

En **desarrollo** (cuando corrés con `npm run dev` o `npm run dev:full`):

1. El iframe de Finanzas carga la URL con **`?dev=1`**, que activa el **live reload**.
2. El servidor envía **`Cache-Control: no-store`** para los estáticos de `/finanzas`, así el navegador no usa cache.
3. Un script en el dashboard **pregunta cada 2 segundos** al endpoint `GET /api/dev/dashboard-mtime` (mtime de `index.html`, `app.js`, `styles.css`). Si detecta cambio, hace **recarga automática** del iframe.

**Flujo de trabajo:**

1. Dejá corriendo `npm run dev:full`.
2. Abrí la app en http://localhost:5173 y entrá a **Finanzas**.
3. Editá en el repo los archivos del dashboard (`index.html`, `app.js`, `styles.css`).
4. Guardá; en unos segundos el iframe se recarga solo y ves los cambios.

Si no usás el iframe desde la app, podés abrir el dashboard directo con live reload en:

**http://localhost:3001/finanzas?dev=1**

(requiere que el API esté corriendo en 3001).

---

## 3. Editar la hoja como “base de datos”

El dashboard **lee y escribe** en Google Sheets vía la API del backend:

- **Lectura:** `GET /api/cotizaciones`, `/api/proximas-entregas`, `/api/kpi-financiero`, etc.
- **Escritura:** por ejemplo `POST /api/marcar-entregado` (mueve a Ventas realizadas y entregadas).

Mientras testeas:

- Cambios en **código** del dashboard (HTML/CSS/JS) → live reload (o F5).
- Cambios **en la planilla** (datos) → el dashboard los muestra al hacer “Actualizar” o en la próxima carga; no hace falta reiniciar nada. La hoja es la fuente de verdad.

---

## 4. Skills y agentes útiles

| Recurso | Uso |
|--------|-----|
| **Agente `bmc-dashboard-setup`** | Configurar uso del dashboard con datos reales (`.env`, cuenta de servicio, Phase 1 y 2 en Apps Script). Invocá cuando necesites revisar o armar el entorno. |
| **Agente `bmc-dashboard-automation`** | Trabajar en Code.gs, triggers, estructura de hojas, `IMPLEMENTATION.md`, y el servidor de API/dashboard. |
| **Skill `panelin-live-editor`** | Misma idea de “editar y refrescar” pero para el **Panelin Evolution** (~/.panelin-evolution/viewer/). Para el dashboard BMC usá este flujo (edit + live reload con `?dev=1`). |

Para pedidos del tipo “cambiar el dashboard”, “agregar un botón”, “cambiar colores”: describí el cambio; el agente puede editar `index.html`, `styles.css` o `app.js` y con el live reload ves el resultado al guardar.

---

## 5. Resumen rápido

| Objetivo | Comando / URL |
|----------|----------------|
| Levantar app + API | `npm run dev:full` |
| App en el navegador | http://localhost:5173 → pestaña Finanzas |
| Dashboard con live reload (directo) | http://localhost:3001/finanzas?dev=1 |
| Archivos a editar para el dashboard | `docs/bmc-dashboard-modernization/dashboard/index.html`, `app.js`, `styles.css` |
