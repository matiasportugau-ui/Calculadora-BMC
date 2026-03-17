# Update Report — v3.1.0

**Date:** 2026-03-10
**Previous version:** 3.0.0
**Commits analyzed:** 5 committed + 3 files with uncommitted changes

## Summary

Version 3.1.0 introduces a roof slope calculation engine (pendiente), multi-zone techo support, a 1/2/4-aguas roof type selector, waste (descarte) tracking, BOM category toggles with per-item exclusion, an internal report generator, and a visual SVG-based border configurator. All changes are backward-compatible — no existing APIs, SKUs, or formula outputs were altered for existing inputs. All 63 validation tests pass.

## Changes by Category

### 🟢 New Features

1. **Pendiente engine** — `calcFactorPendiente(grados)` and `calcLargoReal()` adjust all techo calculations by slope angle. `calcTechoCompleto` accepts optional `pendiente` parameter (default 0). Preset angles: 3°, 10°, 15°, 25°. Files: `calculations.js`, `constants.js`, `PanelinCalculadoraV3.jsx`.

2. **Multi-zone techo** — `techo.zonas[]` replaces single `largo/ancho`. Each zone calculates independently; results are merged via `mergeZonaResults()`. UI supports add/remove zone buttons. File: `PanelinCalculadoraV3.jsx`.

3. **Tipo de aguas** — New `TIPO_AGUAS` constant with 1-agua, 2-aguas (enabled), 4-aguas (disabled/WIP). 2-aguas splits ancho in half, runs `calcTechoCompleto` twice with modified borders (auto-assigns cumbrera). SVG illustrations per type. Files: `constants.js`, `PanelinCalculadoraV3.jsx`.

4. **Descarte tracking** — `calcPanelesTecho()` now returns `descarte: { anchoM, areaM2, porcentaje }`. Displayed as warning banner in UI and included in PDF output. Files: `calculations.js`, `PanelinCalculadoraV3.jsx`, `helpers.js`.

5. **BOM category toggles** — `CATEGORIAS_BOM` and `CATEGORIA_TO_GROUPS` constants. UI pill-buttons toggle categories (Paneles, Fijaciones, Perfilería, Selladores, Servicios). Files: `constants.js`, `PanelinCalculadoraV3.jsx`.

6. **Item exclusion** — Per-item "X" button removes individual BOM items. Excluded items panel with "Restaurar" per item and "Restaurar todos". File: `PanelinCalculadoraV3.jsx`.

7. **Internal report** — `generateInternalHTML()` produces a detailed PDF with user inputs, applied formulas, excluded items, overrides, and autoportancia status. "Interno" button added to action bar. Files: `helpers.js`, `PanelinCalculadoraV3.jsx`.

8. **Canalón as border option** — Canalón moved from toggle (`inclCanalon`) to "Frente Inf" border selector option. Soporte canalón auto-calculated when selected. Files: `constants.js`, `calculations.js`.

9. **Visual border selector** — `RoofBorderSelector` replaces text-based `BorderConfigurator`. SVG roof diagram with clickable edges and popover option menus. Disabled sides for 2-aguas mode. File: `PanelinCalculadoraV3.jsx`.

10. **`normalizarMedida()`** — New utility for panels↔meters input normalization. File: `calculations.js`.

11. **Mobile responsive** — `MobileBottomBar` component with sticky total, WA and PDF buttons. CSS media queries for `≤900px`. File: `PanelinCalculadoraV3.jsx`.

### 🔧 Bug Fixes

12. **Autoportancia null-safe** — Changed `autoportancia.ok` to `autoportancia ?? ...` with nullish coalescing to prevent runtime errors. File: `PanelinCalculadoraV3.jsx`.

### ♻️ Refactors

13. **Step navigation removed** — `STEP_SECTIONS` step-based tabs eliminated. All sections rendered in single scrollable left panel. Files: `constants.js`, `PanelinCalculadoraV3.jsx`.

14. **Border label renaming** — "Frente" → "Frente Inf", "Fondo" → "Frente Sup" for clarity with pendiente/aguas context. File: `calculations.js`.

15. **Autoportancia warnings simplified** — Largo min/max warnings now derived from `largoReal` (with pendiente) instead of duplicated checks. File: `calculations.js`.

16. **`mergeZonaResults()`** — Centralized zone-combination logic extracted from inline code. File: `PanelinCalculadoraV3.jsx`.

17. **Border familia filtering** — `gotero_frontal_greca` restricted to ISOROOF panels via `familias` field on options. Files: `constants.js`, `PanelinCalculadoraV3.jsx`.

18. **Default border change** — `fondo` default changed from `gotero_frontal` to `gotero_lateral`. File: `constants.js`.

### 🎨 UI/Style

19. **Auto-scroll** — Section refs (`panelRef`, `dimensionesRef`, `bordesRef`, `opcionesRef`) with `scrollIntoView`. File: `PanelinCalculadoraV3.jsx`.

20. **PDF enhancements** — Dimensions section, descarte section, and lista precios info added to print HTML. File: `helpers.js`.

21. **Action column widened** — `72px` (from `56px`) to accommodate exclude button. File: `PanelinCalculadoraV3.jsx`.

22. **`categorias` added to Step 1** — Panel step now includes `categorias` in `STEP_SECTIONS[1]`. File: `constants.js`.

## Risk Assessment

| Area | Risk | Mitigation |
|------|------|------------|
| Multi-zone fijaciones merging | High | Index-based merge assumes matching item arrays — test with zones that have different border configs |
| 2-aguas calculation | High | Splits ancho/2 and runs engine twice — validate against real 2-aguas quotations from BMC |
| Pendiente cascade | Medium | `largoReal` affects panel count, fijaciones, perfileria — verify at 25° and 45° extremes |
| Canalón migration | Medium | Old `inclCanalon` toggle path removed — ensure no saved states reference old toggle |
| Category filtering order | Low | Filters apply after overrides — excluded categories still calculated but hidden from view |

## Regression Checklist

- [x] Techo calculations produce same results for existing scenarios (pendiente=0, single zone)
- [x] Pared calculations produce same results for existing scenarios
- [x] Prices resolve correctly for both venta and web lists
- [ ] PDF generation works with new dimensions/descarte sections
- [ ] WhatsApp copy works
- [ ] BOM groups display correctly with category toggles
- [x] All 63 validation tests pass

## Recommended Testing

1. **Pendiente engine** — Create a techo quotation with 15° pendiente, verify largo real = largo × 1/cos(15°) ≈ largo × 1.0353
2. **Multi-zone** — Add 2+ zones, verify total panels = sum of individual zone panels
3. **2-aguas** — Select 2-aguas with 10m ancho, verify each faldón uses 5m ancho and cumbrera is auto-assigned
4. **Descarte** — Set ancho that doesn't divide evenly by panel width, verify descarte percentages
5. **Category toggles** — Disable "Fijaciones", verify those items disappear from BOM and total recalculates
6. **Item exclusion** — Exclude an item, verify total adjusts, restore it, verify it returns
7. **Internal report** — Click "Interno" button, verify PDF opens with formulas and inputs sections
8. **Mobile** — Resize to <900px, verify bottom bar appears and desktop actions hide
9. **Canalón** — Select "Canalón" in Frente Inf border, verify canalón + soporte appear in BOM
10. **SVG border selector** — Click each edge, verify popover shows correct options for panel familia
