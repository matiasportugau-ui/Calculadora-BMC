# LIVE-DEVTOOLS-NARRATIVE-REPORT — Visor 2D pasos 7–13 + default pendiente

Skills: [live-devtools-transcript-action-plan](../../.cursor/skills/live-devtools-transcript-action-plan/SKILL.md), [live-devtools-narrative-mcp](../../.cursor/skills/live-devtools-narrative-mcp/SKILL.md).

---

## 1. Metadatos

| Campo | Valor |
|--------|--------|
| Fecha (ISO) | 2026-04-04 |
| Base URL | `http://localhost:5173/` |
| Entorno | local |
| Navegador / MCP | `project-0-Calculadora-BMC-chrome-devtools` |
| Participantes | Matías (intención), agente implementación |

## 2. Objetivo de la sesión

- **Goal:** Mantener en los pasos **posteriores a Dimensiones** (Solo techo 8–13 y tramo equivalente en Techo+Fachada) la misma lógica del visor: **2D** (`RoofPreview`) en el panel derecho, **Visualización 3D** colapsada con **«Próximamente»**, visor principal cerrado al entrar al paso. Además, **por defecto** el modo de pendiente **«Largo del panel considera pendiente»** (`incluye_pendiente`).
- **Criterios de éxito:** `ROOF_2D_QUOTE_VISOR_STEP_IDS` cubre `dimensiones` → `proyecto` y pasos de pared en Techo+Fachada hasta `proyecto`; estado inicial y fallbacks de motor alineados a `incluye_pendiente`; tests verdes.

## 3. Línea de tiempo — narrativa del usuario (`U-xx`)

| ID | Orden | ACTION | EXPECT |
|----|-------|--------|--------|
| U-01 | 1 | Paso 8+ del asistente | Misma lógica visor que paso 7 |
| U-02 | 2 | 3D | Cerrada + «Próximamente» hasta desarrollar |
| U-03 | 3 | Área principal del visor | Vista 2D |
| U-04 | 4 | Pendiente | Default «Largo del panel considera pendiente» |

## 4. Evidencia del agente — DevTools / MCP (`E-xx`)

| ID | Tool / fuente | Hallazgo |
|----|----------------|----------|
| E-01 | `navigate_page` → `http://localhost:5173/` | Navegación OK |
| E-02 | `list_console_messages` (error, warn, issue) | 2× **warn** React Router v7 future flags; sin `error` ni `issue` en muestra |
| E-03 | `list_network_requests` (primeros 15) | `GET /` 200; varios `POST /api/vitals` **ERR_ABORTED** (ya observado en informes previos) |

## 5. Cruce narrativa ↔ evidencia

| User ID | Evidence IDs | ¿Coincide? | Notas |
|---------|--------------|------------|--------|
| U-01–U-03 | Código + E-01 | parcial | MCP no recorrió el wizard paso a paso en esta corrida |
| U-04 | Código + `npm test` | sí | `TECHO_INITIAL_VENDEDOR`, orquestador, `calcTechoCompleto` default, tests SUITE 15 |

## 6. Hallazgos priorizados

| ID | Severidad | Título | Resumen |
|----|-----------|--------|---------|
| LDN-2026-04-04-12 | P2 | `/api/vitals` local | POST abortados en carga (E-03); alineado a informes previos |

## 7. Plan de acción (implementado)

1. **`ROOF_2D_QUOTE_VISOR_STEP_IDS`** en [`src/data/constants.js`](../../src/data/constants.js).
2. **`showRoof2dInQuoteVisor`** y **`QuoteVisualVisor`**: usar el set en lugar de solo `dimensiones`.
3. **Default `pendienteModo`:** `incluye_pendiente` en estado inicial, reset y motor (`scenarioOrchestrator`, `calculations.js`); tests en [`tests/validation.js`](../../tests/validation.js) con `calcular_pendiente` explícito donde corresponde.

## 8. Verificación (checklist)

- [x] `npm run lint`
- [x] `npm test` (263 + roofVisualQuoteConsistency)
- [x] MCP: consola/red en carga inicial (E-02, E-03)
- [ ] Wizard completo hasta paso 13 (manual)

## 9. Archivos tocados

- [`src/data/constants.js`](../../src/data/constants.js) — `ROOF_2D_QUOTE_VISOR_STEP_IDS`
- [`src/components/QuoteVisualVisor.jsx`](../../src/components/QuoteVisualVisor.jsx) — layout 2D/3D por pasos del set
- [`src/components/PanelinCalculadoraV3_backup.jsx`](../../src/components/PanelinCalculadoraV3_backup.jsx) — `showRoof2dInQuoteVisor`, `pendienteModo` UI
- [`src/utils/scenarioOrchestrator.js`](../../src/utils/scenarioOrchestrator.js), [`src/utils/calculations.js`](../../src/utils/calculations.js)
- [`tests/validation.js`](../../tests/validation.js)
