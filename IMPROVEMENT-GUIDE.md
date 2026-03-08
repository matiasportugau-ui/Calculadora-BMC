# Improvement Guide — Calculadora BMC Panelin v3.0

**Companion to:** `EVALUATION-REPORT.md`
**Priority levels:** P0 (critical/bug fix), P1 (high impact), P2 (medium), P3 (nice to have)

---

## Quick Wins (can be done today)

### FIX-1: Flete bug — user value ignored (P0)

The flete `StepperInput` value is never used. The BOM always uses `SERVICIOS.flete` price instead.

**File:** `src/PanelinCalculadoraV3.jsx`, lines 1044-1047

**Current code (broken):**
```javascript
if (flete > 0) {
  const puFlete = p(SERVICIOS.flete);
  g.push({ title: "SERVICIOS", items: [{ label: SERVICIOS.flete.label, sku: "FLETE", cant: 1, unidad: "servicio", pu: puFlete, total: puFlete }] });
}
```

**Fix:**
```javascript
if (flete > 0) {
  g.push({ title: "SERVICIOS", items: [{ label: SERVICIOS.flete.label, sku: "FLETE", cant: 1, unidad: "servicio", pu: flete, total: flete }] });
}
```

---

### FIX-2: Remove side effect from `useMemo` (P0)

**File:** `src/PanelinCalculadoraV3.jsx`, line 1007

**Current code (broken):**
```javascript
const results = useMemo(() => {
  setListaPrecios(listaPrecios);
  const sc = scenario;
  // ...
}, [listaPrecios, scenario, techo, pared, camara, flete]);
```

**Fix:** Pass `listaPrecios` as a parameter to calculation functions instead of using the global. For a minimal fix, move the side effect to the existing `useEffect`:

```javascript
// The useEffect on line 968 already syncs it — remove line 1007 entirely
const results = useMemo(() => {
  const sc = scenario;
  // ... rest of calculation
}, [listaPrecios, scenario, techo, pared, camara, flete]);
```

For a proper long-term fix, make `p()` accept `listaPrecios` as a parameter (see Improvement 4 below).

---

### FIX-3: Add clipboard error handling (P1)

**File:** `src/PanelinCalculadoraV3.jsx`, line 1068

**Fix:**
```javascript
navigator.clipboard.writeText(txt)
  .then(() => showToast("Copiado al portapapeles"))
  .catch(() => showToast("No se pudo copiar. Copiá manualmente."));
```

---

### FIX-4: Remove unused imports and dead code (P1)

**File:** `src/PanelinCalculadoraV3.jsx`

Replace line 7:
```javascript
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
```

Replace lines 8-12:
```javascript
import {
  ChevronDown, ChevronUp, Printer, Trash2, Copy, Check,
  AlertTriangle, CheckCircle, Info, Minus, Plus, FileText
} from "lucide-react";
```

Also:
- Remove `getActivePanel` (lines 974-978) — it's never called
- Remove `pIVA` (line 62) — it's never called
- Remove `overrides`, `onOverride`, `onRevert` from `TableGroup` parameters (line 844)

---

### FIX-5: Unify scenario labels (P2)

Create a single mapping:

```javascript
const SCENARIO_LABELS = {
  solo_techo: "Solo Techo",
  solo_fachada: "Solo Fachada",
  techo_fachada: "Techo + Fachada",
  camara_frig: "Cámara Frigorífica",
};
```

Use `SCENARIO_LABELS[scenario]` in both `generatePrintHTML` and `buildWhatsAppText`.

---

## Improvement Plan

### Improvement 1: Add proper testing infrastructure (P1)

#### Step 1 — Install Vitest

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:legacy": "node tests/validation.js"
  }
}
```

Create `vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

#### Step 2 — Extract engine functions for testability

Move calculation logic to a separate module:

```
src/
├── engine/
│   ├── pricing.js          # p(), pIVA(), calcTotalesSinIVA()
│   ├── techo.js            # calcTechoCompleto and sub-functions
│   ├── pared.js            # calcParedCompleto and sub-functions
│   ├── data.js             # PANELS_TECHO, PANELS_PARED, FIJACIONES, etc.
│   └── index.js            # Re-exports
├── PanelinCalculadoraV3.jsx
└── ...
```

#### Step 3 — Write unit tests for engine functions

```
tests/
├── validation.js            # Keep legacy tests
├── engine/
│   ├── pricing.test.js      # p() with all edge cases
│   ├── techo.test.js        # calcTechoCompleto, calcPanelesTecho, etc.
│   ├── pared.test.js        # calcParedCompleto, calcFijacionesPared, etc.
│   └── totals.test.js       # calcTotalesSinIVA
└── components/
    └── Calculator.test.jsx  # Component render tests
```

**Example: testing the real `calcPanelesTecho`:**

```javascript
import { describe, it, expect } from 'vitest';
import { calcPanelesTecho, PANELS_TECHO, setListaPrecios } from '../src/engine';

describe('calcPanelesTecho', () => {
  beforeEach(() => setListaPrecios('web'));

  it('calculates ISODEC EPS 100mm, 6.5x5.6m', () => {
    const result = calcPanelesTecho(PANELS_TECHO.ISODEC_EPS, 100, 6.5, 5.6);
    expect(result.cantPaneles).toBe(5);
    expect(result.areaTotal).toBeCloseTo(36.4, 1);
    expect(result.costoPaneles).toBeCloseTo(1673.31, 0);
  });

  it('returns null for invalid espesor', () => {
    const result = calcPanelesTecho(PANELS_TECHO.ISODEC_EPS, 999, 6.5, 5.6);
    expect(result).toBeNull();
  });

  it('handles zero width', () => {
    const result = calcPanelesTecho(PANELS_TECHO.ISODEC_EPS, 100, 6.5, 0);
    expect(result.cantPaneles).toBe(0);
  });
});
```

#### Step 4 — Add component tests

```javascript
import { render, screen } from '@testing-library/react';
import PanelinCalculadoraV3 from '../src/PanelinCalculadoraV3';

describe('PanelinCalculadoraV3', () => {
  it('renders without crashing', () => {
    render(<PanelinCalculadoraV3 />);
    expect(screen.getByText('BMC Uruguay')).toBeDefined();
  });

  it('shows 4 scenario cards', () => {
    render(<PanelinCalculadoraV3 />);
    expect(screen.getByText('Solo Techo')).toBeDefined();
    expect(screen.getByText('Solo Fachada')).toBeDefined();
    expect(screen.getByText('Techo + Fachada')).toBeDefined();
    expect(screen.getByText('Cámara Frigorífica')).toBeDefined();
  });
});
```

---

### Improvement 2: Add ESLint configuration (P1)

```bash
npm install -D eslint @eslint/js eslint-plugin-react eslint-plugin-react-hooks
```

Create `eslint.config.js`:
```javascript
import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        alert: 'readonly',
        setTimeout: 'readonly',
        console: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
```

Update CI to use real ESLint:
```yaml
- name: Lint
  run: npx eslint src/
```

---

### Improvement 3: Add missing Vite project files (P1)

The project has `vite` in devDependencies but is missing `index.html` and `vite.config.js`, which means `npm run dev` and `npm run build` fail.

**Create `vite.config.js`:**
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

**Create `index.html`:**
```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Calculadora BMC Uruguay</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

**Create `src/main.jsx`:**
```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import PanelinCalculadoraV3 from './PanelinCalculadoraV3';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PanelinCalculadoraV3 />
  </React.StrictMode>
);
```

---

### Improvement 4: Eliminate global mutable state (P1)

Replace the global `LISTA_ACTIVA` + `p()` pattern with a pure function:

```javascript
// Before (impure — depends on global)
let LISTA_ACTIVA = "web";
function p(item) {
  if (!item) return 0;
  if (LISTA_ACTIVA === "venta") return item.venta || item.web || 0;
  return item.web || item.venta || 0;
}

// After (pure — receives lista as parameter)
function p(item, lista = "web") {
  if (!item) return 0;
  if (lista === "venta") return item.venta || item.web || 0;
  return item.web || item.venta || 0;
}
```

This requires updating all callers to pass `listaPrecios`, but makes the engine fully pure and testable without setup/teardown.

**Migration strategy:** If changing all callers at once is too risky, create a wrapper:

```javascript
function createPricer(lista) {
  return (item) => {
    if (!item) return 0;
    if (lista === "venta") return item.venta || item.web || 0;
    return item.web || item.venta || 0;
  };
}

// In useMemo:
const results = useMemo(() => {
  const price = createPricer(listaPrecios);
  // pass `price` to all calc functions
}, [listaPrecios, ...]);
```

---

### Improvement 5: Add input validation (P2)

Add a validation layer before calculations:

```javascript
function validateTechoInputs(inputs) {
  const errors = [];
  if (!inputs.familia) errors.push("Seleccioná una familia de panel");
  if (!inputs.espesor) errors.push("Seleccioná un espesor");
  if (inputs.largo <= 0) errors.push("El largo debe ser mayor a 0");
  if (inputs.ancho <= 0) errors.push("El ancho debe ser mayor a 0");
  if (inputs.largo > 20) errors.push("Largo máximo: 20m");
  if (inputs.ancho > 20) errors.push("Ancho máximo: 20m");
  return errors;
}
```

Call it before `calcTechoCompleto` and show errors in the UI.

---

### Improvement 6: Improve accessibility (P2)

#### 6a. Add proper labels to inputs

```jsx
// Before
<div style={labelS}>Largo (m)</div>
<input type="number" value={value} ... />

// After
<label htmlFor="largo" style={labelS}>Largo (m)</label>
<input id="largo" type="number" value={value} ... />
```

#### 6b. Add ARIA to CustomSelect

```jsx
<div role="listbox" aria-label={label} ...>
  {options.map(opt => (
    <div
      role="option"
      aria-selected={opt.value === value}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onChange(opt.value); }}
      ...
    >
```

#### 6c. Add focus ring styles

```javascript
const focusRing = {
  outline: 'none',
  boxShadow: `0 0 0 3px ${C.primarySoft}`,
};
```

Apply via `onFocus`/`onBlur` state or CSS `:focus-visible` (requires a style element).

#### 6d. Add aria-labels to icon-only elements

```jsx
<span aria-label="Escenario: Solo Techo" role="img">🏠</span>
```

---

### Improvement 7: Split the monolith (P2)

Proposed file structure:

```
src/
├── main.jsx                        # Entry point
├── PanelinCalculadoraV3.jsx        # Main component (state + layout only)
├── data/
│   ├── panels.js                   # PANELS_TECHO, PANELS_PARED
│   ├── fijaciones.js               # FIJACIONES
│   ├── selladores.js               # SELLADORES
│   ├── perfileria.js               # PERFIL_TECHO, PERFIL_PARED
│   ├── servicios.js                # SERVICIOS
│   └── scenarios.js                # SCENARIOS_DEF, VIS, BORDER_OPTIONS
├── engine/
│   ├── pricing.js                  # p(), calcTotalesSinIVA()
│   ├── techo.js                    # calcTechoCompleto + helpers
│   ├── pared.js                    # calcParedCompleto + helpers
│   └── bom.js                      # bomToGroups, applyOverrides
├── components/
│   ├── ui/
│   │   ├── AnimNum.jsx
│   │   ├── CustomSelect.jsx
│   │   ├── StepperInput.jsx
│   │   ├── SegmentedControl.jsx
│   │   ├── Toggle.jsx
│   │   ├── KPICard.jsx
│   │   ├── ColorChips.jsx
│   │   ├── AlertBanner.jsx
│   │   ├── Toast.jsx
│   │   └── TableGroup.jsx
│   ├── BorderConfigurator.jsx
│   ├── ScenarioSelector.jsx
│   └── ProjectForm.jsx
├── export/
│   ├── pdf.js                      # generatePrintHTML, openPrintWindow
│   └── whatsapp.js                 # buildWhatsAppText
└── styles/
    └── tokens.js                   # C, FONT, SHC, SHI, TR, TN, COLOR_HEX
```

**Note:** This improvement is optional if Claude.ai artifact compatibility must be preserved (single-file constraint). Consider maintaining both a single-file artifact version and a modular development version.

---

### Improvement 8: Add TypeScript (P3)

Rename `.jsx` to `.tsx` and add type definitions:

```typescript
interface PanelData {
  label: string;
  sub: string;
  tipo: "techo" | "pared";
  au: number;
  lmin: number;
  lmax: number;
  sist: "varilla_tuerca" | "caballete_tornillo" | "anclaje_tornillo";
  fam: string;
  esp: Record<number, EspesorData>;
  col: string[];
  colNotes?: Record<string, string>;
  colMax?: Record<string, number>;
  colMinArea?: Record<string, number>;
}

interface EspesorData {
  venta: number;
  web: number;
  costo: number;
  ap: number | null;
}

interface CalcResult {
  paneles: PanelResult;
  fijaciones: FijacionResult;
  perfileria: PerfilResult;
  selladores: SelladorResult;
  totales: TotalesResult;
  warnings: string[];
  allItems: BOMItem[];
  error?: string;
}
```

Install TypeScript:
```bash
npm install -D typescript @types/react @types/react-dom
```

---

### Improvement 9: Replace `document.write` (P2)

```javascript
// Before
function openPrintWindow(html) {
  const w = window.open("", "_blank", "width=800,height=1100");
  if (!w) { alert("Habilitá popups para imprimir."); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// After — using srcdoc on an iframe, or Blob URL
function openPrintWindow(html) {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=800,height=1100");
  if (!w) {
    URL.revokeObjectURL(url);
    alert("Habilitá popups para imprimir.");
    return;
  }
  w.addEventListener('afterprint', () => URL.revokeObjectURL(url));
  setTimeout(() => w.print(), 500);
}
```

---

### Improvement 10: Enhance CI pipeline (P2)

```yaml
name: CI — Panelin Calculadora BMC

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  validate:
    name: Validate & Lint & Build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Lint
        run: npx eslint src/

      - name: Run legacy validation tests
        run: node tests/validation.js

      - name: Run unit tests
        run: npx vitest run --reporter=verbose

      - name: Build
        run: npx vite build

      - name: Audit dependencies
        run: npm audit --production
        continue-on-error: true
```

---

## Priority Roadmap

### Phase 1 — Bug fixes (1 day)
- [ ] FIX-1: Flete bug
- [ ] FIX-2: useMemo side effect
- [ ] FIX-3: Clipboard error handling
- [ ] FIX-4: Remove unused code
- [ ] FIX-5: Unify scenario labels

### Phase 2 — Foundation (2-3 days)
- [ ] Improvement 3: Add missing Vite files (index.html, vite.config.js, main.jsx)
- [ ] Improvement 2: Install and configure ESLint
- [ ] Improvement 1 (steps 1-2): Install Vitest + extract engine functions
- [ ] Improvement 4: Eliminate global state

### Phase 3 — Testing (2-3 days)
- [ ] Improvement 1 (steps 3-4): Write unit + component tests
- [ ] Improvement 5: Add input validation
- [ ] Improvement 10: Enhance CI pipeline

### Phase 4 — Polish (3-5 days)
- [ ] Improvement 6: Accessibility improvements
- [ ] Improvement 7: Split monolith (if artifact constraint is lifted)
- [ ] Improvement 9: Replace document.write

### Phase 5 — Advanced (optional)
- [ ] Improvement 8: TypeScript migration

---

## How to Test Changes

### Run the existing tests:
```bash
node tests/validation.js
```

### Run CI checks locally:
```bash
# Check that the JSX file parses
node -e "require('fs').readFileSync('src/PanelinCalculadoraV3.jsx', 'utf8')"

# After ESLint is set up:
npx eslint src/

# After Vitest is set up:
npx vitest run

# After Vite files are added:
npx vite build
```

### Manual testing checklist:

1. **Pricing toggle:** Switch between "Precio BMC" and "Precio Web" — all prices should update.
2. **Scenario switching:** Select each of the 4 scenarios — relevant sections should show/hide.
3. **Panel selection:** Choose a panel family and espesor — results should appear on the right.
4. **Dimensions:** Change largo/ancho/alto/perimetro — totals should recalculate.
5. **Borders:** Configure each border — perfileria section should update.
6. **Aberturas:** Add/remove openings — panel area should subtract.
7. **Flete:** Change the flete amount — the SERVICIOS line should reflect the new value.
8. **PDF:** Click Imprimir — a popup should open with formatted quotation.
9. **WhatsApp:** Click WhatsApp — text should be copied to clipboard.
10. **Reset:** Click Limpiar — all fields should reset.
