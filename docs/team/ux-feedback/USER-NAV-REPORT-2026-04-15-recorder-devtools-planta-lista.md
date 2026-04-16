# Informe de navegación — Calculadora BMC (Recorder + narrativa DevTools)

**URLs:** [http://localhost:5173/](http://localhost:5173/) (sesión grabada); referencia prod [https://calculadora-bmc.vercel.app](https://calculadora-bmc.vercel.app)  
**Fecha sesión / grabación:** 2026-04-15 (título export: *Recording 15/4/2026 at 11:12:34 p.m.*)  
**Fuentes:** JSON del **Chrome DevTools Recorder** (pasos reproducibles) + narración en vivo (planta 2D, lista de precios, escenario techo).

---

## Checklist previo

- [x] URL base (`localhost:5173` en el Recorder)
- [x] Texto fuente: narración del usuario (chat) + pasos del Recorder (apéndice)
- [ ] Capturas de pantalla dedicadas para este informe (no aportadas; varios hallazgos 2D con **NEEDS_CONFIRMATION** visual)
- [ ] Build / commit local exacto (opcional)

---

## Meta

| Campo | Valor |
|-------|--------|
| **Fecha** | 2026-04-15 |
| **URL desplegada** | `http://localhost:5173/` (grabación); prod arriba para contraste |
| **Alcance de la sesión** | Calculadora — **solo techo**; lista **Precio BMC**; **ISODEC EPS 100 mm**; color **Blanco**; dimensiones **10** / **09**; interacción con **planta 2D** (SVG) |
| **Dispositivo / navegador** | Viewport Recorder **1847×1455**, `deviceScaleFactor` 1; navegador **NEEDS_CONFIRMATION** |
| **Build / commit** | **NEEDS_CONFIRMATION** |

---

## Resumen ejecutivo

- El Recorder documenta un recorrido **local** coherente con cotización de techo: **Precio BMC** → **ISODEC EPS** → **100 mm** → **Blanco** → campos numéricos **10** y **09** (Enter) → varios **clics** sobre el **SVG** de vista previa (`#:r3:` en la grabación).
- En **narración**, el usuario pide que la elección de **lista de precios** no sea “un paso más” del asistente: una vez cerrado el presupuesto, poder **cambiar de lista con rapidez** sin fricción.
- En **planta 2D**, el usuario exige **cero solapamientos** entre leyendas: título **“PLANTA”** vs **flecha norte**; y la **barra de escala** vs la **cinta de anchos útiles / cadena mm (AU)**. En código se avanzó un parche (ver backlog **NAV-2026-04-15-05**).
- Los selectores del Recorder dependen de IDs **MUI** (`:r1:`, `:r3:`): **frágiles** para replay o E2E sin `data-testid` o roles estables.

---

## Mapa de sesión (orden según Recorder + narración)

1. **setViewport** 1847×1455.
2. **navigate** → `http://localhost:5173/` (título documentado: *Calculadora BMC*).
3. **Doble clic** en icono / botón dentro del contenedor del paso (selectores bajo `#:r1:`) — alineado a “abrir / avanzar” en el asistente (**NEEDS_CONFIRMATION** de paso exacto).
4. **Clic / doble clic** en **Precio BMC** (lista BMC).
5. **Doble clic** en **ISODEC EPS** y en **Seleccionar 100 mm**.
6. **Clic** en bloque de UI (fila 6 del layout en `#:r1:`) — posible **solo techo** / tipo de agua / contador (**NEEDS_CONFIRMATION**).
7. **Doble clic** en **Blanco** (color).
8. **Campo 1 → `10`**, Enter; **Campo 2 → `09`**, Enter (narrativa: largo **10 m**, ancho de “puente” **9 m**, **9 paneles**; el Recorder no distingue si el segundo campo es **ancho** o **cantidad de paneles**).
9. **Clics** repetidos en el **mismo SVG** de vista previa (coords distintas): trabajo sobre **planta 2D**.

---

## Hallazgos

| ID | Tipo | Severidad | Ruta / pantalla | Evidencia | Comportamiento actual | Comportamiento esperado |
|----|------|-----------|-----------------|-----------|----------------------|-------------------------|
| NAV-2026-04-15-01 | UX | **P1** | Paso inicial / asistente — **lista de precios** | Narración + pasos Recorder (`aria/Precio BMC`) | La lista aparece en el flujo temprano; el usuario teme que sea **un paso obligatorio** extra. | Tras presupuesto **completo**, poder **alternar lista** (p. ej. BMC vs web) **en un gesto**, sin rehacer todo el wizard; si sigue al inicio, que quede **claro** que es opcional o con **valor recordado**. |
| NAV-2026-04-15-02 | UX | P1 | Misma | Narración | **NEEDS_CONFIRMATION:** ¿la lista debe **omitirse** del wizard y vivir solo en **resumen / BOM**? | Definición de producto explícita + criterios de aceptación acordados con Matias. |
| NAV-2026-04-15-03 | UX | P2 | Planta 2D — lectura ISO | Narración (“nada superpuesto”) | En la sesión observado: solape **título / norte** y **escala / cadena AU**. | Capas de cota y leyenda **siempre separadas** (márgenes dinámicos o colisión AABB ya usada en cadena). |
| NAV-2026-04-15-04 | missing / tooling | P2 | Recorder / QA | JSON Recorder | Selectores `#:r1:`, `#:r3:` y `nth-of-type` **rotan** entre builds. | `data-testid` estable o contrato de roles en pasos críticos; ejemplo de replay en docs de QA. |
| NAV-2026-04-15-05 | UX (corrección en curso) | P2 | `RoofPreview` + `OrientationMark` + `ScaleBar` | Narración + código (2026-04-15) | Superposiciones en planta. | **Implementado en repo:** `OrientationMark` separa **PLANTA** y **N** horizontalmente; `svgFrame` + banda inferior reubica la **escala** bajo la cadena. **Verificación:** reproducir escenario del Recorder en local y confirmar visualmente (captura para cerrar NEEDS_CONFIRMATION). |

**P0 en este informe:** ninguno (riesgo de producto P1 concentrado en lista de precios; resto P2 o verificación).

**Leyenda tipos:** según plantilla (`bug` \| `missing` \| `UX` \| `copy` \| `performance`).

---

## Propagación (por hallazgo o bloque temático)

| ID / tema | `src/` | `server/` | `docs/` | Sheets / datos | env / secrets | deploy (Vercel / Cloud Run) | Notas |
|-----------|--------|-----------|---------|------------------|---------------|----------------------------|--------|
| NAV-01, NAV-02 | `PanelinCalculadoraV3_backup.jsx` (pasos wizard, `listaPrecios` / estado cotización), posible panel resumen | Si el cambio de lista **recalcula** desde API/MATRIZ, rutas en `server/routes/calc.js` o equivalente | `ux-feedback` (este informe), README calculadora | Precios por lista en MATRIZ / constantes según diseño actual | — | Sin cambio de host si solo UX local | Alinear con skill calculadora / constantes si el switch afecta CSV o endpoint. |
| NAV-03, NAV-05 | `RoofPreview.jsx`, `roofPlan/OrientationMark.jsx`, `roofPlan/ScaleBar.jsx`, `RoofPlanDimensions.jsx` (`PanelChainDimensions`) | — | `docs/team/knowledge/RoofPlanArchitect.md` (opcional) | — | — | — | Ver captura post-fix; ampliar tests visuales solo si hay harness. |
| NAV-04 | Mismos + convención `data-testid` en botones de paso | — | `ux-feedback`, guía QA | — | — | — | Coordinar con quien mantenga Playwright si existe. |

Referencia equipo: `docs/team/PROJECT-TEAM-FULL-COVERAGE.md`.

---

## Backlog para implementación (ordenado)

### NAV-2026-04-15-01 — Cambio rápido de lista de precios post-cotización

- **Prioridad:** P1  
- **Pasos sugeridos:**
  1. **Producto:** decidir si la lista **sigue** en el wizard, se **mueve** a resumen, o **ambas** (default recordado + cambio en resumen).
  2. **Implementación:** control único (select / segmentado) en pantalla de **totales** o barra superior que llame al mismo pipeline que `listaPrecios` hoy, sin invalidar geometría ya cargada salvo que las reglas lo exijan.
  3. **Copy:** una línea que diga que el cambio **recalcula** precios (si aplica) y no borra medidas.
  4. **Tests:** unitario o integración mínima: mismo escenario, dos listas, diff en total esperado acorde a datos de prueba.
- **Criterios de aceptación:** Con presupuesto ya armado (mismo techo que en la sesión), el usuario cambia de lista en **≤2 interacciones** y ve totales actualizados en **<1 s** en local sin errores de consola.
- **Depende de:** NAV-02 (definición explícita).

### NAV-2026-04-15-02 — Cerrar decisión de producto (lista al inicio vs solo al final)

- **Prioridad:** P1  
- **Pasos sugeridos:** workshop 15 min; anotar decisión en `PROJECT-STATE` o doc de flujo cotización.
- **Criterios de aceptación:** Criterio único documentado; backlog NAV-01 ajustado o cancelado según decisión.
- **Depende de:** ninguna.

### NAV-2026-04-15-05 — Verificación visual post-fix planta (PLANTA / N / escala / cadena AU)

- **Prioridad:** P2  
- **Pasos sugeridos:**
  1. Reproducir Recorder en `main` tras merge del fix de solapes.
  2. Capturar **una** pantalla con cotas activas y cadena mm visible.
  3. Archivar PNG en `docs/team/ux-feedback/assets/2026-04-15/` y enlazar aquí (sustituir NEEDS_CONFIRMATION).
- **Criterios de aceptación:** En la captura, **ninguna** intersección visible entre (a) texto PLANTA y marca N, (b) barra de escala y líneas/etiquetas de cadena AU al zoom por defecto del usuario.
- **Depende de:** despliegue local con cambios en `RoofPreview` / `OrientationMark` / `ScaleBar`.

### NAV-2026-04-15-04 — Estabilizar selectores para Recorder / E2E

- **Prioridad:** P2  
- **Pasos sugeridos:** añadir `data-testid` a botón lista precios, contenedor planta SVG, inputs de dimensiones clave; documentar en README dev.
- **Criterios de aceptación:** Export nuevo del Recorder con **≥80%** de pasos usando `aria/` o `data-testid` sin `#:r1:`.
- **Depende de:** ninguna.

---

## Riesgos y preguntas abiertas

- **NAV-2026-04-15-02:** Sin decisión de producto, cualquier implementación de NAV-01 puede contradecir expectativas comerciales (lista fija en cotización oficial).
- **Campo `09`:** el Recorder no prueba si es **ancho (m)** o **cantidad de paneles**; validar con el usuario o con captura del paso en UI.
- **Doble clic** frecuente en la grabación: ¿indica **control que no responde al primer clic** o hábito del usuario? Si persiste en prod, abrir hallazgo aparte con evidencia de consola/red.
- Gates humanos (OAuth, Meta, correo): **no aplican** a este informe.

---

## Apéndice — narración relevante (resumen, no literal)

> Configuración “solo techo”; agua; lista **Precio BMC**; no querer un paso extra por la lista — al terminar el presupuesto, cambiar de lista rápido. **ISODEC EPS** 100 mm; largo panel **10 m**; ancho “puente” **9 m**; **9 paneles**. En planta 2D: título **“Planta”** separado de la flecha **norte**; nunca superposiciones; la **barra de escala** no debe tapar el ancho útil / cadena de paneles.

---

## Apéndice — Chrome DevTools Recorder (estructura)

Título exportado: **Recording 15/4/2026 at 11:12:34 p.m.**  
Tipos de paso observados: `setViewport`, `navigate`, `doubleClick`, `click`, `change`, `keyDown`/`keyUp` (Enter).  
Elementos con nombre accesible citados en la grabación: **Precio BMC**, **ISODEC EPS**, **Seleccionar 100 mm**, **Blanco**.  
Valores de formulario: **`10`**, **`09`**.  
Destino principal de clics finales: **SVG** bajo contenedor `#:r3:` (vista previa techo).

> El JSON completo puede guardarse en `docs/team/ux-feedback/` o en `Documents/` del usuario; el archivo local reportado vacío en una verificación previa debe **regenerarse** si se desea adjuntar evidencia binaria.
