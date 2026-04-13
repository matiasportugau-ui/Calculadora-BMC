# Knowledge — RoofPlan Architect

Rol: ISO Drawing Quality Architect. Skills: `roofplan-architect`.

---

## Entradas (leer antes de trabajar)

- `.cursor/skills/roofplan-architect/reference.md` — 100-point scoring rubric.
- `src/utils/roofPlanDrawingTheme.js` — LINE_WEIGHTS, PRINT_THEME, getTheme().
- `src/utils/roofPlanSvgTypography.js` — font tiers (primary, secondary, tertiary).
- `src/utils/roofPlanGeometry.js` — `buildRoofPlanEdges()`, envelope bbox.
- `src/components/RoofPreview.jsx` — 2D SVG viewer, mounting order.
- `src/components/RoofPanelRealisticScene.jsx` — 3D preview, encounter lines, dim overlays.

---

## Salidas (qué produce)

- **ISO score:** 100-point assessment across 7 domains.
- **Drawing improvements:** line weights, typography, symbols, collision fixes.
- **Print/PDF assets:** SVG capture, 3D snapshot, print theme application.
- **New annotation components:** in `src/components/roofPlan/`.
- **Updated PROJECT-STATE:** "Cambios recientes" entry after each change.

---

## Convenciones

- **Coordenadas SVG en metros** — nunca mezclar px y m sin transformación CTM.
- **`data-bmc-layer`** en todo grupo de anotación nuevo.
- **`data-bmc-capture`** para elementos capturables por el pipeline PDF.
- **LINE_WEIGHTS** — siempre referenciar desde `roofPlanDrawingTheme.js`, nunca hardcodear.
- **Font tiers** — usar `dimFontPrimary/Secondary/Tertiary` desde `roofPlanSvgTypography.js`.
- **3D encounter colors** — `ENCOUNTER_COLORS` constante en `RoofPanelRealisticScene.jsx`.
- **Share Tech Mono** — cargada desde Google Fonts en `index.html`.

---

## Decisiones de diseño

| Decisión | Razón |
|----------|-------|
| Share Tech Mono (no DIN 1451) | Más cercana libre disponible en Google Fonts |
| 45° ticks (no flechas) | ISO 129 estándar para dibujo técnico arquitectónico |
| Poché hatch a 0.06 opacity | Visible sin ocultar panel labels |
| AABB collision avoidance | Más rápido que SAT para texto alineado a ejes |
| `preserveDrawingBuffer: true` | Requerido para `canvas.toDataURL()` en WebGL |
| SVG serialize → canvas → PNG | `html2canvas` no maneja SVG complejo correctamente |
| Encounters computed inside 3D scene | Evita prop drilling desde componente raíz |
| Cotas perímetro / cadena / envolvente | Gris grafito (`ROOF_PLAN_DIM_STROKE`, `DIM_THEME.*`), `strokeLinecap`/`strokeLinejoin` redondeados; rojo solo advertencias (corte ✂) |

---

## Handoffs

| Cuando | A quién | Formato |
|--------|---------|---------|
| Cambios BOM/pricing | bmc-calc-specialist | Coordinar fórmulas en `calculations.js` |
| Edits viewer no-ISO (drag, tooltips) | bmc-roof-2d-viewer-specialist | Respetar `data-bmc-layer` |
| Deploy | bmc-deployment | `npm run gate:local:full` antes |
| Actualizar docs | bmc-docs-sync | Entrada en PROJECT-STATE.md |

---

## Referencias

- Agent: `.cursor/agents/roofplan-architect.md`
- Skill: `.cursor/skills/roofplan-architect/SKILL.md`
- Scoring rubric: `.cursor/skills/roofplan-architect/reference.md`
- 2D viewer specialist: `.cursor/agents/bmc-roof-2d-viewer-specialist.md`
- Judge criteria: `docs/team/judge/JUDGE-CRITERIA-POR-AGENTE.md` (sección RoofPlan Architect)
