# Evaluation Report — Calculadora BMC Panelin v3.0

**Date:** 2026-03-05
**Scope:** Full codebase analysis — architecture, code quality, tests, CI, security, performance

---

## 1. Project Overview

| Attribute       | Detail |
|-----------------|--------|
| **Name**        | Calculadora BMC — Panelin v3.0 |
| **Purpose**     | Real-time quotation calculator for insulation panels (roof + wall) for BMC Uruguay / METALOG SAS |
| **Tech stack**  | React 18, Vite 5, lucide-react |
| **Architecture**| Single-file React monolith (`src/PanelinCalculadoraV3.jsx`, ~1 366 lines) |
| **State mgmt**  | React `useState` + `useMemo` (no external state library) |
| **Styling**     | Inline styles with design tokens (no CSS files, no Tailwind) |
| **Data**        | Hardcoded pricing data (no external APIs, no localStorage) |
| **Tests**       | `tests/validation.js` — 31 assertions across 8 suites, all passing |
| **CI/CD**       | GitHub Actions: validation tests + structural lint checks |

### Panel Families

- **Roof:** ISODEC EPS, ISODEC PIR, ISOROOF 3G, ISOROOF FOIL, ISOROOF PLUS
- **Wall:** ISOPANEL EPS, ISOWALL PIR

### 4 Scenarios

1. Solo Techo (roof only)
2. Solo Fachada (wall only)
3. Techo + Fachada (combined)
4. Camara Frigorifica (cold storage)

---

## 2. Scorecard

| Category | Score | Grade | Notes |
|----------|-------|-------|-------|
| **Functionality** | 9/10 | A | Complete calculation engines for roof and wall. Flete bug reduces score. |
| **Code Organization** | 6/10 | C+ | All logic in one 1 366-line file. Well-sectioned with comments, but violates separation of concerns. |
| **Test Coverage** | 4/10 | D | 31 tests pass, but they re-implement logic instead of testing the real code. No React component tests. |
| **Type Safety** | 2/10 | F | Pure JavaScript, no TypeScript, no PropTypes. Complex objects have no validation. |
| **Error Handling** | 5/10 | C | Engine functions return `{ error }` objects, but clipboard/print have no error handling. Inconsistent null vs error patterns. |
| **Security** | 7/10 | B | XSS escaping present, no localStorage/APIs. Bank details and RUT hardcoded in source. `document.write` usage. |
| **Performance** | 8/10 | B+ | Adequate for current data size. `useMemo` used for calculations. Object-based dependencies could cause unnecessary recalculations. |
| **Accessibility** | 3/10 | D- | No ARIA attributes, no semantic HTML, no keyboard navigation for custom components, no contrast verification. |
| **Documentation** | 9/10 | A | Excellent `docs/` folder with architecture, API reference, deployment guide, changelog. |
| **CI/CD** | 5/10 | C | Runs tests and structural checks but no real ESLint, no build verification, no deployment pipeline. |
| **Overall** | **5.8/10** | **C+** | Functional product with good domain logic, held back by monolithic architecture, weak tests, and no type safety. |

---

## 3. Bugs Found

### BUG-1: Flete value ignored (HIGH)

The user can adjust the flete amount via `StepperInput` (default: 280 USD), but the BOM always uses the hardcoded `SERVICIOS.flete` price (240 venta / 252 web) instead of the user's input.

**Location:** `src/PanelinCalculadoraV3.jsx`, lines 1044-1047

```javascript
if (flete > 0) {
  const puFlete = p(SERVICIOS.flete);  // Always 240 or 252, ignores user's flete value
  g.push({ title: "SERVICIOS", items: [{ label: SERVICIOS.flete.label, sku: "FLETE", cant: 1, unidad: "servicio", pu: puFlete, total: puFlete }] });
}
```

**Impact:** Customers see an editable flete field but the quoted price is always wrong.

### BUG-2: Side effect inside `useMemo` (MEDIUM)

`setListaPrecios(listaPrecios)` is called inside `useMemo`, which mutates the global `LISTA_ACTIVA`. This is a React anti-pattern and can cause race conditions or stale values.

**Location:** `src/PanelinCalculadoraV3.jsx`, line 1007

```javascript
const results = useMemo(() => {
  setListaPrecios(listaPrecios); // side effect in useMemo!
  ...
}, [listaPrecios, scenario, techo, pared, camara, flete]);
```

### BUG-3: Clipboard error unhandled (MEDIUM)

`navigator.clipboard.writeText()` has no `.catch()` handler. On browsers without clipboard API or when permissions are denied, the app silently fails.

**Location:** `src/PanelinCalculadoraV3.jsx`, line 1068

```javascript
navigator.clipboard.writeText(txt).then(() => showToast("Copiado al portapapeles"));
// Missing .catch()
```

### BUG-4: Scenario label inconsistency (LOW)

The scenario labels differ between PDF and WhatsApp generators:

| Scenario | PDF label | WhatsApp label |
|----------|-----------|----------------|
| solo_techo | "Techo" | "Solo techo" |
| solo_fachada | "Fachada" | "Solo fachada" |

---

## 4. Code Quality Issues

### 4.1 Global mutable state

`LISTA_ACTIVA` is a module-level `let` variable mutated via `setListaPrecios()`. This breaks React's unidirectional data flow and makes the pricing engine impure (its output depends on hidden global state).

```javascript
let LISTA_ACTIVA = "web";  // line 55

function p(item) {
  if (LISTA_ACTIVA === "venta") return item.venta || item.web || 0;
  return item.web || item.venta || 0;
}
```

### 4.2 Unused imports and dead code

| Item | Type | Location |
|------|------|----------|
| `useReducer` | Unused import | line 7 |
| `RotateCcw` | Unused import | line 11 |
| `Edit3` | Unused import | line 11 |
| `Home` | Unused import | line 11 |
| `Layers` | Unused import | line 11 |
| `Grid` | Unused import | line 11 |
| `Snowflake` | Unused import | line 11 |
| `getActivePanel` | Unused callback | line 974 |
| `pIVA()` | Defined but never called | line 62 |
| `TableGroup` props `overrides`, `onOverride`, `onRevert` | Declared but unused | line 844 |

### 4.3 Monolithic file structure

1 366 lines in one file with 8 sections mixing:
- Data constants (pricing)
- Business logic (calculation engines)
- UI components (13 components)
- PDF/WhatsApp generation
- Main application component

### 4.4 Inline styles everywhere

All styling is done via JavaScript objects. While this is intentional for Claude.ai artifact compatibility, it makes the code harder to read, prevents pseudo-selectors (`:hover`, `:focus`), and eliminates CSS caching.

### 4.5 No input validation

User inputs like `largo`, `ancho`, `alto`, `perimetro` flow directly into calculations with minimal validation. Negative values, NaN, or extremely large numbers are not guarded against consistently.

---

## 5. Test Analysis

### Current state: 31 passing tests across 8 suites

| Suite | Tests | Coverage |
|-------|-------|----------|
| Pricing Engine | 5 | `p()`, IVA calculation |
| Panel Calculations | 7 | Panel count, area, cost |
| Autoportancia | 3 | Span check, support count |
| Fijaciones Techo | 4 | Fastener point calculation |
| Fijaciones Pared | 5 | Anchor, T2, rivet counts |
| Soporte Canalon | 4 | Channel support bars |
| Perfileria Pared | 1 | K2 joint count |
| Selladores Pared | 2 | Membrane rolls, PU foam |

### Critical gaps

1. **Tests don't import the real code.** `tests/validation.js` re-implements `p()`, `LISTA_ACTIVA`, and IVA logic locally. If the source changes but tests don't, tests pass while the app is broken.
2. **No component tests.** No rendering tests for any of the 13 UI components.
3. **No integration tests.** `calcTechoCompleto()` and `calcParedCompleto()` are never tested as units.
4. **No edge case tests.** Zero-area, negative values, missing panels, empty aberturas, unknown familia, unknown espesor.
5. **No PDF/WhatsApp output tests.** No tests for `generatePrintHTML()` or `buildWhatsAppText()`.
6. **No test framework.** Uses raw `console.log` + `process.exit(1)`. No Jest, Vitest, or equivalent.
7. **No ESLint config.** `package.json` has `"lint": "eslint src/"` but no `.eslintrc` or `eslint.config.js` exists.

---

## 6. Security Analysis

### Strengths
- XSS protection: `esc()` function escapes `&`, `<`, `>` in PDF output
- No external API calls
- No localStorage/sessionStorage (by design)
- No user authentication data

### Concerns

| # | Issue | Severity | Detail |
|---|-------|----------|--------|
| S1 | Bank details in source | Medium | RUT `120403630012`, account `110520638-00002` hardcoded in JSX. Anyone with repo access sees them. |
| S2 | `document.write` | Low | Used in `openPrintWindow()`. Blocked by CSP `unsafe-inline` policies. |
| S3 | No CSP headers | Low | No Content Security Policy defined. |
| S4 | `window.open` popup reliance | Low | Many browsers block popups by default. |

---

## 7. Performance Analysis

### Strengths
- `useMemo` prevents unnecessary recalculations
- Small data set (< 50 pricing items) — no virtualization needed
- No external API latency

### Concerns

| # | Issue | Impact | Detail |
|---|-------|--------|--------|
| P1 | Object reference equality | Medium | `techo` and `pared` are objects in `useMemo` dependency arrays. Any nested change (e.g., a single border update) creates a new object reference, triggering full recalculation. |
| P2 | CSS keyframe injection | Low | Keyframes are injected into `<head>` on every component mount if not already present. |
| P3 | No code splitting | Low | Single-file architecture prevents lazy loading, but file is small enough (~1 366 lines) that this is acceptable. |

---

## 8. Accessibility Audit

| # | Issue | WCAG | Detail |
|---|-------|------|--------|
| A1 | No ARIA roles | 4.1.2 | `CustomSelect` dropdown has no `role="listbox"` / `role="option"`. |
| A2 | No labels on inputs | 1.3.1 | `<input>` elements use visual labels (`<div>`) instead of `<label>` with `htmlFor`. |
| A3 | No keyboard navigation | 2.1.1 | `CustomSelect` dropdown, `ColorChips`, `SegmentedControl` cannot be navigated with keyboard. |
| A4 | No focus indicators | 2.4.7 | Custom buttons suppress outline with `outline: "none"` and provide no visible focus ring. |
| A5 | Color contrast unchecked | 1.4.3 | Secondary text uses `#6E6E73` on `#FFFFFF` (4.3:1, barely passing for normal text, fails for small text). |
| A6 | No screen reader text | 1.1.1 | Emoji icons (e.g., scenario cards) have no `aria-label` alternatives. |

---

## 9. CI/CD Analysis

### Current pipeline (`.github/workflows/ci.yml`)

1. **validate** job: runs `node tests/validation.js`
2. **lint** job: custom Node script that checks structural patterns in the JSX file

### Gaps

| # | Gap | Impact |
|---|-----|--------|
| C1 | No ESLint execution | The `npm run lint` script references ESLint but it's not installed and no config exists. CI uses a custom grep-like check instead. |
| C2 | No build verification | `vite build` is never run in CI. A broken import or syntax error in JSX would not be caught. |
| C3 | No dependency audit | `npm audit` is not run. Vulnerable dependencies would go undetected. |
| C4 | No code coverage | No coverage tool configured. |
| C5 | Missing `index.html` and `vite.config.js` | `npm run build` and `npm run dev` will fail because these files don't exist in the repo. |

---

## 10. Dependency Analysis

| Package | Version | Status | Notes |
|---------|---------|--------|-------|
| react | ^18.2.0 | OK | Stable LTS |
| react-dom | ^18.2.0 | OK | Matches react |
| lucide-react | ^0.263.1 | Outdated | Current is 0.400+. Over 100 minor versions behind. |
| vite | ^5.0.0 | OK | Major 5 is current |
| @vitejs/plugin-react | ^4.0.0 | OK | Matches Vite 5 |

---

## 11. Summary of Findings

### What works well
1. Comprehensive domain logic for both roof and wall calculations
2. Clean separation of engine sections (§1-§8) with clear comments
3. Excellent documentation in `docs/`
4. Dual pricing system (`venta`/`web`) with single `p()` resolver
5. Modern, polished UI design with Apple-inspired design tokens
6. PDF and WhatsApp export functionality
7. CI pipeline with structural validation

### What needs improvement
1. **Architecture:** Single-file monolith should be split into modules
2. **Testing:** Tests don't use the real code; zero component/integration tests
3. **Type safety:** No TypeScript, no PropTypes, no runtime validation
4. **Bugs:** Flete value ignored, side effect in useMemo, clipboard error
5. **Accessibility:** Almost completely absent
6. **CI/CD:** No real linting, no build verification, missing project setup files
7. **Dead code:** 7 unused imports, 1 unused function, 3 unused props
