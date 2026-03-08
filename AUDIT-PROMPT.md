# TASK: Comprehensive Panelin Calculadora BMC v3.0 Status Report & Variable Audit

You are auditing the **Panelin Calculadora BMC v3.0** — a professional quotation calculator for thermal/acoustic insulation panels built for BMC Uruguay (METALOG SAS).

## OBJECTIVE

Produce a **full situation report** auditing every variable, constant, state, and data flow in the application. The report must be exhaustive, evidence-based, and actionable.

---

## PROJECT CONTEXT

**Stack:** React 18 + Vite 5 + lucide-react (icons only)
**Architecture:** Single-file calculator with modular extraction to:
- `src/data/constants.js` (330 lines) — Design tokens, pricing engine, all static data
- `src/utils/calculations.js` (360 lines) — Pure calculation functions
- `src/utils/helpers.js` (94 lines) — BOM utilities, PDF/WhatsApp generators
- `src/components/PanelinCalculadoraV3.jsx` (643 lines) — Main React component

**Business Logic:**
- Generates Bills of Materials (BOM) for roof and wall insulation panels
- 5 roof families (ISODEC EPS/PIR, ISOROOF 3G/FOIL/PLUS) + 2 wall families (ISOPANEL EPS, ISOWALL PIR)
- Dual pricing: BMC direct (`venta`) vs Shopify web (`web`)
- 22% IVA applied ONCE at final total
- 4 scenarios: Solo Techo, Solo Fachada, Techo+Fachada, Cámara Frigorífica

---

## 1. COMPLETE VARIABLE INVENTORY

Audit ALL variables in the codebase organized by file and scope:

### A. `src/data/constants.js` — Static Configuration

| Category | Variables to Audit | Expected Audit Points |
|----------|-------------------|----------------------|
| Design Tokens | `C`, `FONT`, `SHC`, `SHI`, `TR`, `TN`, `COLOR_HEX` | Usage count, consistency, any unused tokens |
| Pricing Engine | `IVA`, `IVA_MULT`, `LISTA_ACTIVA`, `p()`, `pIVA()`, `setListaPrecios()` | Correctness of 22% IVA logic, proper delegation |
| Panel Data | `PANELS_TECHO` (5 families), `PANELS_PARED` (2 families) | Price integrity, espesor coverage, au/lmin/lmax validity |
| Fijaciones | `FIJACIONES` (12 items) | Price anomalies (venta vs web), unit consistency |
| Selladores | `SELLADORES` (4 items) | Coverage for techo vs pared scenarios |
| Perfilería | `PERFIL_TECHO` (10 types), `PERFIL_PARED` (6 types) | SKU uniqueness, price consistency by espesor |
| Servicios | `SERVICIOS.flete` | Whether user input overrides catalog price correctly |
| UI Config | `SCENARIOS_DEF`, `VIS`, `OBRA_PRESETS`, `BORDER_OPTIONS`, `STEP_SECTIONS` | Complete mapping, scenario → visibility rules |

For each variable report:
- Current value/structure
- Where it's consumed
- Any anomalies (unused, duplicated, inconsistent)

### B. `src/utils/calculations.js` — Calculation Engine

Audit all 17 exported functions:

**Techo Engine:**
1. `resolveSKU_techo(tipo, familiaP, espesor)` — Profile SKU resolution
2. `calcPanelesTecho(panel, espesor, largo, ancho)` — Panel count & area
3. `calcAutoportancia(panel, espesor, largo)` — Self-supporting span check
4. `calcFijacionesVarilla(cantP, apoyos, largo, tipoEst, ptsHorm)` — Varilla+tuerca system
5. `calcFijacionesCaballete(cantP, largo)` — Caballete+tornillo system
6. `calcPerfileriaTecho(borders, cantP, largo, anchoTotal, familiaP, espesor, opciones)` — Border profiles
7. `calcSelladoresTecho(cantP)` — Silicona + cinta
8. `calcTechoCompleto(inputs)` — Orchestrator

**Pared Engine:**
9. `resolvePerfilPared(tipo, familia, espesor)` — Wall profile SKU resolution
10. `calcPanelesPared(panel, espesor, alto, perimetro, aberturas)` — Wall panels with deductions
11. `calcPerfilesU(panel, espesor, perimetro)` — U base + corona profiles
12. `calcEsquineros(alto, numExt, numInt)` — Corner profiles
13. `calcFijacionesPared(panel, espesor, cantP, alto, perimetro, tipoEst)` — Wall fasteners
14. `calcPerfilesParedExtra(panel, espesor, cantP, alto, opts)` — K2, G2, 5852 profiles
15. `calcSelladorPared(perimetro, cantPaneles, alto)` — Wall sealants
16. `calcParedCompleto(inputs)` — Orchestrator

**Shared:**
17. `calcTotalesSinIVA(allItems)` — Final totals with IVA

For each function report:
- Formula correctness (cite the actual calculation)
- Edge cases handled/unhandled
- Dependencies on constants
- Any bugs or inconsistencies found

### C. `src/utils/helpers.js` — BOM & Output Utilities

| Function | Purpose | Audit Points |
|----------|---------|--------------|
| `createLineId(groupTitle, idx)` | Generate unique line IDs | Format: `TITLE-idx` |
| `applyOverrides(groups, overrides)` | Apply user edits to BOM | Recalculates `total` correctly |
| `bomToGroups(result)` | Transform engine output to BOM groups | Section mapping completeness |
| `fmtPrice(n)` | Format currency | Locale consistency |
| `generatePrintHTML(data)` | Create A4 PDF HTML | All fields included, XSS escaping |
| `buildWhatsAppText(data)` | WhatsApp-formatted text | Field coverage |
| `openPrintWindow(html)` | Trigger print dialog | Popup blocker handling |

### D. `src/components/PanelinCalculadoraV3.jsx` — React State

Audit ALL 12 useState hooks:

| State Variable | Initial Value | Purpose |
|----------------|---------------|---------|
| `listaPrecios` | `"web"` | Price list selection (web/venta) |
| `scenario` | `"solo_techo"` | Current work scenario |
| `proyecto` | `{tipoCliente, nombre, rut, telefono, direccion, descripcion, refInterna, fecha}` | Client/project data |
| `techo` | `{familia, espesor, color, largo, ancho, tipoEst, ptsHorm, borders, opciones}` | Roof configuration |
| `pared` | `{familia, espesor, color, alto, perimetro, numEsqExt, numEsqInt, aberturas, tipoEst, inclSell, incl5852}` | Wall configuration |
| `camara` | `{largo_int, ancho_int, alto_int}` | Cold room dimensions |
| `flete` | `280` | Freight cost (user-editable) |
| `overrides` | `{}` | BOM line overrides: `{lineId: {field, value}}` |
| `collapsedGroups` | `{}` | UI collapse state |
| `toast` | `null` | Notification message |
| `activeStep` | `0` | Progress tab index (0-3) |
| `showTransp` | `false` | Transparency panel toggle |

### E. Derived State (useMemo)

| Computed Variable | Dependencies | Purpose |
|-------------------|--------------|---------|
| `vis` | `scenario` | Visibility rules from `VIS[scenario]` |
| `scenarioDef` | `scenario` | Scenario definition from `SCENARIOS_DEF` |
| `familyOptions` | `scenarioDef` | Available panel families for dropdown |
| `currentFamilia` | `scenarioDef`, `techo.familia`, `pared.familia` | Currently selected family |
| `activePanelData` | `currentFamilia` | Full panel object from PANELS_* |
| `espesorOptions` | `activePanelData` | Available thicknesses for dropdown |
| `currentEspesor` | `scenarioDef`, `techo.espesor`, `pared.espesor` | Currently selected thickness |
| `currentColor` | `scenarioDef`, `techo.color`, `pared.color` | Currently selected color |
| `results` | `scenario`, `techo`, `pared`, `camara` | Engine calculation output |
| `groups` | `results`, `overrides`, `flete` | BOM groups with overrides applied |
| `grandTotal` | `groups` | Final totals with VAT |

---

## 2. DATA FLOW AUDIT

Trace these critical paths:

### Path A: Price Resolution
```
LISTA_ACTIVA → p(item) → precioM2 → costoPaneles → subtotalSinIVA → iva → totalFinal
```
Verify: IVA is applied ONCE at the end, never per-line.

### Path B: Panel Selection → BOM
```
scenario → familyOptions → setFamilia(fam) → techo/pared state → results (useMemo) → groups (useMemo) → TableGroup render
```
Verify: Family change correctly resets espesor to first available.

### Path C: Override System
```
User click → startEdit() → editingCell state → commitEdit() → handleOverride() → overrides state → applyOverrides() → recalculated groups → grandTotal
```
Verify: Override handlers are wired to TableGroup props.

### Path D: Flete Custom Value
```
flete state (user input) → groups useMemo → BOM SERVICIOS group → grandTotal
```
Verify: User-entered flete value is used, NOT `p(SERVICIOS.flete)`.

---

## 3. SCENARIO MATRIX AUDIT

For each scenario, verify:

| Scenario | hasTecho | hasPared | Families | Borders | Esquineros | Autoportancia | canalGot | p5852 |
|----------|----------|----------|----------|---------|------------|---------------|----------|-------|
| solo_techo | ✅ | ❌ | ISODEC_EPS/PIR, ISOROOF_* | ✅ | ❌ | ✅ | ✅ | ❌ |
| solo_fachada | ❌ | ✅ | ISOPANEL_EPS, ISOWALL_PIR | ❌ | ✅ | ❌ | ❌ | ✅ |
| techo_fachada | ✅ | ✅ | All 7 families | ✅ | ✅ | ✅ | ✅ | ✅ |
| camara_frig | ❌ | ✅ | ISOPANEL_EPS, ISOWALL_PIR | ❌ | ✅ | ❌ | ❌ | ❌ |

For each scenario report:
- VIS flags match expected behavior
- Panel selector shows correct families
- BOM includes correct sections
- KPIs show relevant metrics

---

## 4. KNOWN ISSUES STATUS CHECK

Verify current status of each identified issue:

| ID | Description | Check Location |
|----|-------------|----------------|
| BUG-01 | Flete state disconnected from BOM | `groups` useMemo in component, verify flete state is used |
| BUG-02 | Progress tabs cosmetic only | Check `STEP_SECTIONS` usage with `activeStep` |
| BUG-03 | Override UI unimplemented | Check `TableGroup` props at render: `onOverride`, `onRevert` |
| BUG-04 | G2 formula incorrect | `calcPerfilesParedExtra()` — should be `(cantP-1) * ceil(alto/largo)` |
| BUG-05 | SKU inconsistencies | List all duplicate SKUs with different prices |
| BUG-06 | Pricing anomalies (web < venta) | `tuerca_38`, `arandela_carrocero`, `anclaje_h` |
| CQ-01 | techo_fachada KPIs show only roof | `kpiArea` derivation ignores `paredResult` |
| CQ-02 | Panel selector broken in techo_fachada | `currentFamilia` logic |
| CQ-03 | PDF/WhatsApp shows single panel | `generatePrintHTML()` only references one panel |
| CQ-04 | setFamilia doesn't reset espesor properly | Cross-family incompatible espesores |

---

## 5. FORMULA VERIFICATION

Verify these specific calculations:

### Fijaciones Varilla (ISODEC families)
```javascript
puntos_fijacion = ceil((cantPaneles × apoyos × 2) + (largo × 2 / 2.5))
varillas = ceil(puntos_fijacion / 4)
```

### Fijaciones Caballete (ISOROOF families)
```javascript
caballetes = ceil((cantP × 3 × (largo / 2.9 + 1)) + (largo × 2 / 0.3))
tornillosAguja = caballetes × 2
paquetesAguja = ceil(tornillosAguja / 100)
```

### Soporte Canalón
```javascript
ml_soportes = (cantPaneles + 1) × 0.30
barras_soporte = ceil(ml_soportes / largo_perfil)
```

### Fijaciones Pared
```javascript
anclajes = ceil(anchoTotal / 0.30)  // kit cada 0.30m
tornillosT2 = ceil(areaNeta × 5.5)  // 5.5/m² para metal
remaches = ceil(cantP × 2)          // 2 por panel
```

### Selladores Pared
```javascript
juntasV = cantPaneles - 1
mlJuntas = (juntasV × alto) + (perimetro × 2)
siliconas = ceil(mlJuntas / 8)
cintas = ceil(mlJuntas / 22.5)
rollosMembrana = ceil(perimetro / 10)
espumas = rollosMembrana × 2
```

---

## 6. OUTPUT FORMAT

Produce a structured report with:

### A. Executive Summary
- Overall health score (1-10)
- Critical blockers for production
- Top 3 immediate action items

### B. Variable Inventory Table
Complete table of all variables by file with:
- Name
- Type
- Initial/Default value
- Consumer count
- Status (OK / ANOMALY / UNUSED)

### C. Data Flow Diagram
ASCII diagram showing state → calculation → render flow

### D. Issue Registry
All bugs with:
- Current status (FIXED / OPEN / PARTIAL)
- Evidence (line numbers, code snippets)
- Fix recommendation

### E. Formula Audit Results
Each formula with:
- Expected behavior
- Actual implementation
- Verdict (CORRECT / INCORRECT / EDGE_CASE_MISSING)

### F. Test Coverage Gap Analysis
- Untested functions
- Recommended test cases

### G. Prioritized Recommendations
1. Critical fixes (blocking production)
2. High priority (affects UX significantly)
3. Medium priority (code quality)
4. Low priority (nice to have)

---

## FILES TO READ

Read these files in order and analyze completely:

1. `src/data/constants.js` — All 330 lines
2. `src/utils/calculations.js` — All 360 lines
3. `src/utils/helpers.js` — All 94 lines
4. `src/components/PanelinCalculadoraV3.jsx` — All 643 lines
5. `tests/validation.js` — Test coverage reference
6. `EVALUATION_REPORT.md` — Previous audit reference

---

## CONSTRAINTS

- Do NOT make assumptions — cite specific line numbers and code
- Report actual current state, not expected state
- Flag any discrepancies between documentation and code
- Total scope: ~1,400 lines of source code, ~200+ variables
- Use evidence-based verdicts only
