# Bug Fix Proposals — Calculadora BMC Panelin v3.0

**Author:** Agent A — The Bug Fixer
**Date:** 2026-03-08
**Scope:** Surgical, minimum-impact fixes only. No refactors, no restructuring.

---

## Summary

| # | Title | Severity | Risk | File(s) |
|---|-------|----------|------|---------|
| 1 | Price list switch doesn't update calculations | **HIGH** | Safe | `PanelinCalculadoraV3.jsx` |
| 2 | `techo_fachada` BOM missing all pared sections | **HIGH** | Moderate | `PanelinCalculadoraV3.jsx` |
| 3 | `camara_frig` BOM missing techo fijaciones & selladores | **HIGH** | Moderate | `PanelinCalculadoraV3.jsx` |
| 4 | `camara_frig` techo silently fails for espesors 50/80 | **HIGH** | Moderate | `PanelinCalculadoraV3.jsx` |
| 5 | Clipboard API unhandled rejection | **MEDIUM** | Safe | `PanelinCalculadoraV3.jsx` |
| 6 | Reset button doesn't reset flete, scenario, or collapsed groups | **MEDIUM** | Safe | `PanelinCalculadoraV3.jsx` |
| 7 | Pared "Pts fijación" KPI always shows 0 | **LOW** | Safe | `calculations.js` |
| 8 | Scenario labels inconsistent between PDF and WhatsApp | **LOW** | Safe | `helpers.js` |
| 9 | StepperInput buttons missing `disabled` attribute | **LOW** | Safe | `PanelinCalculadoraV3.jsx` |

---

## FIX-1: Price list switch doesn't update calculations

### FIX-1: Price list switch doesn't recalculate results

**Severity:** HIGH
**Risk:** Safe
**What's broken:** The `results` useMemo depends on `[scenario, techo, pared, camara]` but NOT on `listaPrecios`. The pricing function `p()` reads the global `LISTA_ACTIVA`, which is updated by a `useEffect` when `listaPrecios` changes. However, since `listaPrecios` is not in the useMemo dependency array, switching between "Precio BMC" and "Precio Web" does NOT trigger a recalculation. All prices remain stale until the user changes some other input (scenario, dimensions, etc.).

**User impact:** User toggles the price list and sees NO change in the quotation. Prices shown may be from the wrong list. If the user prints or sends a WhatsApp quote without touching another input, they deliver the wrong price.

**Location:** `src/components/PanelinCalculadoraV3.jsx`, line 309

**Current code:**

```javascript
  }, [scenario, techo, pared, camara]);
```

**Proposed fix:**

```javascript
  }, [scenario, techo, pared, camara, listaPrecios]);
```

**Rationale:** Adding `listaPrecios` to the dependency array ensures that when the user changes the price list, `results` is recomputed. Since `results` feeds into `groups` (which depends on `results`) and `grandTotal` (which depends on `groups`), the entire pricing chain updates automatically.

---

## FIX-2: `techo_fachada` BOM missing all pared sections

### FIX-2: Combined techo+fachada scenario shows incomplete BOM and understated total

**Severity:** HIGH
**Risk:** Moderate
**What's broken:** In the `techo_fachada` branch, the result is constructed as `{ ...rT, paredResult: rP, allItems, totales, warnings }`. The spread of `rT` exposes techo-specific keys (`fijaciones`, `perfileria`, `selladores`) at the top level, but all pared-specific keys (`perfilesU`, `esquineros`, `perfilesExtra`, `sellador`, and pared `fijaciones`) are buried inside `paredResult` where `bomToGroups` never looks for them.

As a result, the BOM table is missing:
- **PERFILES U** (pared base + coronation profiles)
- **ESQUINEROS** (exterior/interior corner profiles)
- **PERFILERÍA PARED** (K2 + G2 joint profiles)
- **SELLADORES** from pared (membrana, espuma PU, etc.)
- **FIJACIONES** from pared (anclajes, tornillos T2, remaches)

Since `grandTotal` is computed from `groups` (not `results.totales`), the displayed total is **dramatically understated** — it only includes techo costs.

Additionally, when only `rP` is available (user selected pared family first, no techo family yet), `...rT` spreads `null` which results in no keys at all — even `result.paneles` is undefined, so the PANELES group is skipped despite panel items existing in `allItems`.

**User impact:** In "Techo + Fachada" mode, the quotation PDF and on-screen total are missing thousands of dollars of pared materials. Customer receives a severely underpriced quote.

**Location:** `src/components/PanelinCalculadoraV3.jsx`, lines 291–296

**Current code:**

```javascript
      if (sc === "techo_fachada") {
        const rT = techo.familia && techo.espesor ? calcTechoCompleto(techo) : null;
        const rP = pared.familia && pared.espesor ? calcParedCompleto(pared) : null;
        if (!rT && !rP) return null;
        const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return { ...rT, paredResult: rP, allItems, totales, warnings: [...(rT?.warnings || []), ...(rP?.warnings || [])] };
      }
```

**Proposed fix:**

```javascript
      if (sc === "techo_fachada") {
        const rT = techo.familia && techo.espesor ? calcTechoCompleto(techo) : null;
        const rP = pared.familia && pared.espesor ? calcParedCompleto(pared) : null;
        if (!rT && !rP) return null;
        const allItems = [...(rT?.allItems || []), ...(rP?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return {
          paneles: rT?.paneles || rP?.paneles,
          autoportancia: rT?.autoportancia,
          fijaciones: {
            items: [...(rT?.fijaciones?.items || []), ...(rP?.fijaciones?.items || [])],
            total: +((rT?.fijaciones?.total || 0) + (rP?.fijaciones?.total || 0)).toFixed(2),
            puntosFijacion: rT?.fijaciones?.puntosFijacion || 0,
          },
          perfileria: rT?.perfileria,
          perfilesU: rP?.perfilesU,
          esquineros: rP?.esquineros,
          perfilesExtra: rP?.perfilesExtra,
          selladores: rT?.selladores,
          sellador: rP?.sellador,
          paredResult: rP,
          allItems, totales,
          warnings: [...(rT?.warnings || []), ...(rP?.warnings || [])],
        };
      }
```

**Rationale:** By explicitly assigning every key that `bomToGroups` looks for, we guarantee all BOM sections appear. The `fijaciones` are merged since both techo and pared produce fijaciones items. Using explicit keys instead of spread also handles the `rT=null` edge case correctly — `rP?.paneles` will be used as fallback.

---

## FIX-3: `camara_frig` BOM missing techo fijaciones & selladores

### FIX-3: Cámara frigorífica BOM missing techo fasteners and sealants

**Severity:** HIGH
**Risk:** Moderate
**What's broken:** Same structural issue as FIX-2 but for `camara_frig`. The result is `{ ...rP, techoResult: rT, ... }`. The spread of `rP` exposes pared keys, but techo-specific keys (`fijaciones` from techo, `selladores` from techo) are buried in `techoResult`. The pared `fijaciones` overwrites any techo `fijaciones` that might have been there. The techo `selladores` (siliconas + cintas for roof panels) are not found by `bomToGroups` since it looks for `result.selladores`, which was not spread from `rP` (pared uses key `sellador`, not `selladores`).

Missing from BOM:
- Techo **fijaciones** (varillas, tuercas, arandelas for ceiling panels)
- Techo **selladores** (siliconas + cintas for ceiling panel joints)

**User impact:** Cámara frigorífica quotes are missing ceiling fasteners and sealants. Quote is understated.

**Location:** `src/components/PanelinCalculadoraV3.jsx`, lines 298–306

**Current code:**

```javascript
      if (sc === "camara_frig") {
        if (!pared.familia || !pared.espesor) return null;
        const perim = 2 * (camara.largo_int + camara.ancho_int);
        const rP = calcParedCompleto({ ...pared, perimetro: perim, alto: camara.alto_int, numEsqExt: 4, numEsqInt: 0 });
        const rT = calcTechoCompleto({ familia: pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS", espesor: pared.espesor, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal", borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: pared.color });
        const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return { ...rP, techoResult: rT, allItems, totales, warnings: [...(rP?.warnings || []), ...(rT?.warnings || [])] };
      }
```

**Proposed fix:**

```javascript
      if (sc === "camara_frig") {
        if (!pared.familia || !pared.espesor) return null;
        const perim = 2 * (camara.largo_int + camara.ancho_int);
        const rP = calcParedCompleto({ ...pared, perimetro: perim, alto: camara.alto_int, numEsqExt: 4, numEsqInt: 0 });
        const techoFam = pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS";
        const techoPanel = PANELS_TECHO[techoFam];
        let techoEsp = pared.espesor;
        if (!techoPanel.esp[techoEsp]) {
          const available = Object.keys(techoPanel.esp).map(Number).sort((a, b) => a - b);
          techoEsp = available.reduce((best, e) => Math.abs(e - pared.espesor) < Math.abs(best - pared.espesor) ? e : best);
        }
        const rT = calcTechoCompleto({ familia: techoFam, espesor: techoEsp, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal", borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: pared.color });
        const allItems = [...(rP?.allItems || []), ...(rT?.allItems || [])];
        const totales = calcTotalesSinIVA(allItems);
        return {
          paneles: rP?.paneles,
          fijaciones: {
            items: [...(rP?.fijaciones?.items || []), ...(rT?.fijaciones?.items || [])],
            total: +((rP?.fijaciones?.total || 0) + (rT?.fijaciones?.total || 0)).toFixed(2),
          },
          perfileria: rT?.perfileria,
          perfilesU: rP?.perfilesU,
          esquineros: rP?.esquineros,
          perfilesExtra: rP?.perfilesExtra,
          selladores: rT?.selladores,
          sellador: rP?.sellador,
          techoResult: rT,
          allItems, totales,
          warnings: [...(rP?.warnings || []), ...(rT?.warnings || [])],
        };
      }
```

**Rationale:** This fix does two things: (a) explicitly exposes all keys for `bomToGroups` (same pattern as FIX-2), and (b) incorporates FIX-4's espesor mapping to prevent the techo calculation from silently failing (see FIX-4 below for detailed explanation).

---

## FIX-4: `camara_frig` techo silently fails for espesors 50/80

### FIX-4: Cámara ceiling calculation silently fails for incompatible espesors

**Severity:** HIGH
**Risk:** Moderate
**What's broken:** For `camara_frig`, the techo calculation uses `pared.espesor` directly with the `ISODEC_EPS` family. But ISODEC_EPS only supports espesors 100, 150, 200, 250. When the user selects ISOWALL_PIR (espesors 50, 80, 100) or ISOPANEL_EPS with espesor 50, the techo calculation receives an unsupported espesor and returns `{ error: "Espesor 50mm no disponible" }`. This error result has no `allItems`, so the ceiling panels, fijaciones, and selladores are silently dropped from the quote.

Affected combinations:
- ISOPANEL_EPS + 50mm → techo fails (ISODEC_EPS has no 50mm)
- ISOWALL_PIR + 50mm → techo fails
- ISOWALL_PIR + 80mm → techo fails

**User impact:** Cámara frigorífica quotes with 50mm or 80mm panels are missing the entire ceiling — panels, fasteners, and sealants. No error is shown to the user.

**Location:** `src/components/PanelinCalculadoraV3.jsx`, line 302

**Current code:**

```javascript
        const rT = calcTechoCompleto({ familia: pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS", espesor: pared.espesor, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal", borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: pared.color });
```

**Proposed fix:** (already incorporated into FIX-3 above — the relevant extract is the espesor mapping logic)

```javascript
        const techoFam = pared.familia in PANELS_TECHO ? pared.familia : "ISODEC_EPS";
        const techoPanel = PANELS_TECHO[techoFam];
        let techoEsp = pared.espesor;
        if (!techoPanel.esp[techoEsp]) {
          const available = Object.keys(techoPanel.esp).map(Number).sort((a, b) => a - b);
          techoEsp = available.reduce((best, e) => Math.abs(e - pared.espesor) < Math.abs(best - pared.espesor) ? e : best);
        }
        const rT = calcTechoCompleto({ familia: techoFam, espesor: techoEsp, largo: camara.largo_int, ancho: camara.ancho_int, tipoEst: "metal", borders: { frente: "none", fondo: "none", latIzq: "none", latDer: "none" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true }, color: pared.color });
```

**Rationale:** Maps the pared espesor to the closest available ISODEC_EPS espesor. For example: 50→100, 80→100, 100→100, 150→150, etc. This ensures the techo calculation always succeeds.

---

## FIX-5: Clipboard API unhandled rejection

### FIX-5: WhatsApp copy crashes silently on clipboard permission denial

**Severity:** MEDIUM
**Risk:** Safe
**What's broken:** The `navigator.clipboard.writeText()` call has a `.then()` but no `.catch()`. If the clipboard API is unavailable (HTTP context, permission denied, or iframe sandbox), the promise rejects unhandled. In strict environments, this logs a console error; in some browsers it can trigger an unhandled promise rejection warning visible to the user.

**User impact:** User clicks "WhatsApp" button, nothing happens, no feedback. They don't know the copy failed.

**Location:** `src/components/PanelinCalculadoraV3.jsx`, line 339

**Current code:**

```javascript
    navigator.clipboard.writeText(txt).then(() => showToast("Copiado al portapapeles"));
```

**Proposed fix:**

```javascript
    navigator.clipboard.writeText(txt)
      .then(() => showToast("Copiado al portapapeles"))
      .catch(() => showToast("No se pudo copiar. Copiá manualmente."));
```

---

## FIX-6: Reset button doesn't reset flete, scenario, or collapsed groups

### FIX-6: "Limpiar" button leaves several state values dirty

**Severity:** MEDIUM
**Risk:** Safe
**What's broken:** `handleReset` resets `techo`, `pared`, `camara`, `overrides`, and `activeStep`, but does NOT reset:
- `flete` (stays at user-modified value instead of default 280)
- `scenario` (stays on current scenario instead of default `solo_techo`)
- `collapsedGroups` (BOM sections stay collapsed)
- `showTransp` (transparency panel stays open)

**User impact:** User clicks "Limpiar" expecting a clean slate, but the flete amount, scenario selection, and UI collapse state persist from the previous quotation, leading to confusion.

**Location:** `src/components/PanelinCalculadoraV3.jsx`, lines 354–360

**Current code:**

```javascript
  const handleReset = () => {
    setTecho({ familia: "", espesor: "", color: "Blanco", largo: 6.0, ancho: 5.0, tipoEst: "metal", ptsHorm: 0, borders: { frente: "gotero_frontal", fondo: "gotero_frontal", latIzq: "gotero_lateral", latDer: "gotero_lateral" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true } });
    setPared({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
    setCamara({ largo_int: 6, ancho_int: 4, alto_int: 3 });
    setOverrides({});
    setActiveStep(0);
  };
```

**Proposed fix:**

```javascript
  const handleReset = () => {
    setTecho({ familia: "", espesor: "", color: "Blanco", largo: 6.0, ancho: 5.0, tipoEst: "metal", ptsHorm: 0, borders: { frente: "gotero_frontal", fondo: "gotero_frontal", latIzq: "gotero_lateral", latDer: "gotero_lateral" }, opciones: { inclCanalon: false, inclGotSup: false, inclSell: true } });
    setPared({ familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40, numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false });
    setCamara({ largo_int: 6, ancho_int: 4, alto_int: 3 });
    setFlete(280);
    setScenario("solo_techo");
    setOverrides({});
    setCollapsedGroups({});
    setShowTransp(false);
    setActiveStep(0);
  };
```

---

## FIX-7: Pared "Pts fijación" KPI always shows 0

### FIX-7: `calcFijacionesPared` doesn't return a fixation point count

**Severity:** LOW
**Risk:** Safe
**What's broken:** The KPI card for "Pts fijación" reads `results?.fijaciones?.puntosFijacion`. The techo fixation functions (`calcFijacionesVarilla`, `calcFijacionesCaballete`) return `puntosFijacion` in their result, but `calcFijacionesPared` only returns `{ items, total }` — no `puntosFijacion`. So for `solo_fachada` and `camara_frig` scenarios, this KPI always shows 0.

**User impact:** The "Pts fijación" KPI always reads "—" or 0 for pared-only scenarios, providing no useful information.

**Location:** `src/utils/calculations.js`, lines 278–279

**Current code:**

```javascript
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
```

**Proposed fix:**

```javascript
  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), puntosFijacion: anclajes };
```

**Rationale:** For pared, the most meaningful "fixation point" metric is the number of floor anchors (`anclajes`), which is already computed on line 260. Returning it gives the KPI card something useful to display.

---

## FIX-8: Scenario labels inconsistent between PDF and WhatsApp

### FIX-8: Print says "Techo" while WhatsApp says "Solo techo" for the same scenario

**Severity:** LOW
**Risk:** Safe
**What's broken:** `generatePrintHTML` and `buildWhatsAppText` each define their own scenario label map with different values:
- Print: `solo_techo → "Techo"`, `solo_fachada → "Fachada"`
- WhatsApp: `solo_techo → "Solo techo"`, `solo_fachada → "Solo fachada"`

**User impact:** Minor branding inconsistency — the printed PDF and WhatsApp message use different names for the same scenario.

**Location:** `src/utils/helpers.js`, lines 50 and 89

**Current code (line 50 — print):**

```javascript
  const scenarioLabel = { solo_techo: "Techo", solo_fachada: "Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
```

**Current code (line 89 — WhatsApp):**

```javascript
  const scenarioLabel = { solo_techo: "Solo techo", solo_fachada: "Solo fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
```

**Proposed fix (line 50 — print):**

```javascript
  const scenarioLabel = { solo_techo: "Solo Techo", solo_fachada: "Solo Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
```

**Proposed fix (line 89 — WhatsApp):**

```javascript
  const scenarioLabel = { solo_techo: "Solo Techo", solo_fachada: "Solo Fachada", techo_fachada: "Techo + Fachada", camara_frig: "Cámara Frigorífica" }[scenario] || scenario;
```

**Rationale:** Unify to "Solo Techo" / "Solo Fachada" which matches the labels used in `SCENARIOS_DEF` in `constants.js`.

---

## FIX-9: StepperInput buttons missing `disabled` attribute

### FIX-9: Stepper +/- buttons are visually disabled but not functionally disabled

**Severity:** LOW
**Risk:** Safe
**What's broken:** When the stepper value is at min or max, the buttons get `opacity: 0.4` and `cursor: "not-allowed"` styling, but no actual `disabled` HTML attribute. The `bump()` function guards against out-of-range values so no functional harm occurs, but screen readers and keyboard users see the buttons as actionable. Clicking them also triggers the browser's button click feedback (focus ring, etc.) even though nothing happens.

**User impact:** Accessibility issue — screen readers announce the buttons as clickable when they are not. Minor UX annoyance from click feedback on no-op actions.

**Location:** `src/components/PanelinCalculadoraV3.jsx`, lines 78 and 81

**Current code:**

```javascript
        <button style={btnS(value <= min)} onClick={() => bump(-1)}><Minus size={14} color={C.tp} /></button>
```

```javascript
        <button style={btnS(value >= max)} onClick={() => bump(1)}><Plus size={14} color={C.tp} /></button>
```

**Proposed fix:**

```javascript
        <button style={btnS(value <= min)} onClick={() => bump(-1)} disabled={value <= min}><Minus size={14} color={C.tp} /></button>
```

```javascript
        <button style={btnS(value >= max)} onClick={() => bump(1)} disabled={value >= max}><Plus size={14} color={C.tp} /></button>
```

---

## Newly Discovered Issues (not in IMPROVEMENT-GUIDE.md)

The following bugs were **not** identified in the existing improvement guide. FIX-1, FIX-2, FIX-3, FIX-4, and FIX-7 are new discoveries from this analysis.

### Bugs from the guide that are already fixed in the current codebase

The IMPROVEMENT-GUIDE.md references fixes against an earlier monolithic version of the file. In the current multi-file codebase:

- **FIX-1 (guide)** — Flete bug: **Already fixed.** The current component code at line 317 uses `flete` (the user state value) directly, not `p(SERVICIOS.flete)`.
- **FIX-2 (guide)** — `useMemo` side effect (`setListaPrecios` inside `useMemo`): **Already fixed.** The current code uses a proper `useEffect` on line 248 and does not call `setListaPrecios` inside the `useMemo`.
- **FIX-4 (guide)** — Unused imports: **Already fixed.** The current multi-file structure has clean imports. `RotateCcw` and `Edit3` are properly used in `TableGroup`.

### Design limitation noted (not a surgical fix)

**`techo_fachada` single panel selector limitation:** In the "Techo + Fachada" scenario, the UI has a single panel family selector that is bound to `pared.familia`. When a user selects a techo panel family (e.g., ISODEC_EPS), `setFamilia` correctly sets `techo.familia`, but the dropdown's displayed value remains bound to `pared.familia` — making the selection appear to not work. Similarly, the espesor selector only updates `pared.espesor` in this scenario. This is a design issue that would require adding a second panel selector for techo, which goes beyond a surgical fix.

---

## Recommended Fix Order

1. **FIX-1** (Safe, 1-line change, highest impact) — Apply first
2. **FIX-5** (Safe, 1-line change) — Apply alongside FIX-1
3. **FIX-6** (Safe, add 4 lines) — Apply alongside FIX-1
4. **FIX-9** (Safe, add 2 attributes) — Apply alongside FIX-1
5. **FIX-8** (Safe, 2-line change) — Apply alongside FIX-1
6. **FIX-7** (Safe, 1-line change in calculations.js) — Apply alongside FIX-1
7. **FIX-2** (Moderate, restructures result object) — Test thoroughly
8. **FIX-3 + FIX-4** (Moderate, combined fix) — Test with all espesor combinations

### Testing after applying fixes

After applying all fixes, run the existing test suite and verify manually:

```bash
node tests/validation.js
```

**Manual test checklist for the fixes:**

1. **FIX-1:** Switch price list "Precio BMC" ↔ "Precio Web" — all prices and totals must update immediately.
2. **FIX-2:** Select "Techo + Fachada", configure both techo and pared panels — BOM must show PERFILES U, ESQUINEROS, PERFILERÍA PARED, and both sets of SELLADORES and FIJACIONES.
3. **FIX-3/4:** Select "Cámara Frigorífica" with ISOWALL_PIR 80mm — techo ceiling must appear in the BOM. Try 50mm too.
4. **FIX-5:** Test WhatsApp copy in an HTTP (non-HTTPS) context or with clipboard permissions denied — should show "No se pudo copiar" toast.
5. **FIX-6:** Click "Limpiar" — flete should reset to 280, scenario to "Solo Techo".
6. **FIX-7:** Select "Solo Fachada" — "Pts fijación" KPI should show the anchor count, not 0.
7. **FIX-8:** Compare PDF and WhatsApp scenario labels — they should match.
8. **FIX-9:** Tab to a stepper at min value — minus button should not receive focus (disabled).
