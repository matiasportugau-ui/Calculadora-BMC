# Architecture Proposal — Calculadora BMC Modularization

**Author:** Agent B — The Architect  
**Date:** March 8, 2026  
**Scope:** Full restructuring plan for Panelin Calculadora BMC v3.0  
**Constraint:** Must produce BOTH modular dev code AND a single-file Claude.ai artifact

---

## 1. Current State Analysis

The codebase has already been partially split from the original ~1,366-line monolith into three modules:

```
src/
├── main.jsx                              # ReactDOM entry point
├── App.jsx                               # Thin wrapper
├── PanelinCalculadoraV3.jsx              # Re-export shim
├── data/constants.js                     # Design tokens + pricing engine + all data (~330 lines)
├── utils/calculations.js                 # Techo + pared calculation engines (~360 lines)
├── utils/helpers.js                      # BOM overrides, PDF/print, WhatsApp (~94 lines)
└── components/PanelinCalculadoraV3.jsx   # Main React component (~643 lines)
```

### Remaining problems

| Problem | Severity | Location |
|---|---|---|
| Global mutable state (`LISTA_ACTIVA`, `p()`, `setListaPrecios`) | High | `data/constants.js:30-38` |
| All 11 UI sub-components live in the main component file | Medium | `components/PanelinCalculadoraV3.jsx:42-227` |
| 12 `useState` calls with no grouping or reducer | Medium | `components/PanelinCalculadoraV3.jsx:234-246` |
| `constants.js` mixes design tokens, pricing, data, and UI config | Medium | `data/constants.js` (4 concerns in 1 file) |
| Calculation engine imports `p()` (impure global) directly | High | `utils/calculations.js` (every calc function) |
| CSS injection side-effect at module load time | Low | `components/PanelinCalculadoraV3.jsx:29-38` |

---

## 2. Proposed Architecture

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                             │
│  main.jsx ──▶ App.jsx ──▶ PanelinCalculadoraV3                  │
│                                                                 │
│  scripts/bundle-artifact.js ──▶ single-file artifact.jsx        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│   COMPONENTS     │ │   ENGINE     │ │   DATA           │
│                  │ │              │ │                  │
│ ui/              │ │ pricing.js   │ │ panels.js        │
│  AnimNum         │ │  createPricer│ │ fijaciones.js    │
│  CustomSelect    │ │              │ │ selladores.js    │
│  StepperInput    │ │ techo.js     │ │ perfileria.js    │
│  SegmentedCtrl   │ │  calcTecho*  │ │ servicios.js     │
│  Toggle          │ │              │ │ scenarios.js     │
│  KPICard         │ │ pared.js     │ │                  │
│  ColorChips      │ │  calcPared*  │ │ tokens.js        │
│  AlertBanner     │ │              │ │  C, FONT, SHC…   │
│  Toast           │ │ bom.js       │ │                  │
│  TableGroup      │ │  bomToGroups │ └──────────────────┘
│                  │ │  applyOvrds  │
│ BorderConfig     │ │              │ ┌──────────────────┐
│ ScenarioSelect   │ │ totals.js    │ │   EXPORT         │
│ ProjectForm      │ │  calcTotales │ │                  │
│ PanelSelector    │ │              │ │ pdf.js           │
│                  │ └──────┬───────┘ │ whatsapp.js      │
│ Calculator.jsx   │        │         └──────────────────┘
│  (main comp.)    │◀───────┘
│  useCalcState()  │◀─── hooks/useCalculatorState.js
│                  │◀─── hooks/useCalculatorActions.js
└──────────────────┘
```

### 2.2 Data Flow (no globals)

```
                   listaPrecios (React state: "web" | "venta")
                        │
                        ▼
               ┌─────────────────┐
               │  createPricer() │  Returns: (item) => number
               │  Pure factory   │  No side effects
               └────────┬────────┘
                        │ price = pricer(item)
                        ▼
  ┌──────────────────────────────────────────┐
  │        useMemo(() => {                   │
  │          const price = createPricer(lp); │
  │          return calcTecho(inputs, price); │
  │        }, [listaPrecios, inputs])         │
  └──────────────────────────────────────────┘
                        │
                        ▼
              results ──▶ bomToGroups() ──▶ <TableGroup />
```

### 2.3 Proposed File Structure

```
src/
├── main.jsx                          # ReactDOM entry
├── App.jsx                           # Thin wrapper
│
├── data/
│   ├── tokens.js                     # C, FONT, SHC, SHI, TR, TN, COLOR_HEX
│   ├── panels.js                     # PANELS_TECHO, PANELS_PARED
│   ├── fijaciones.js                 # FIJACIONES
│   ├── selladores.js                 # SELLADORES
│   ├── perfileria.js                 # PERFIL_TECHO, PERFIL_PARED
│   ├── servicios.js                  # SERVICIOS
│   ├── scenarios.js                  # SCENARIOS_DEF, VIS, OBRA_PRESETS,
│   │                                #   BORDER_OPTIONS, STEP_SECTIONS
│   └── index.js                      # Re-exports everything
│
├── engine/
│   ├── pricing.js                    # createPricer(), IVA, IVA_MULT
│   ├── techo.js                      # calcTechoCompleto + sub-functions
│   ├── pared.js                      # calcParedCompleto + sub-functions
│   ├── bom.js                        # bomToGroups, applyOverrides, createLineId
│   ├── totals.js                     # calcTotalesSinIVA
│   └── index.js                      # Re-exports
│
├── hooks/
│   ├── useCalculatorState.js         # useReducer-based state management
│   └── useCalculatorActions.js       # Derived computations & handlers
│
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
│   ├── ProjectForm.jsx
│   ├── PanelSelector.jsx
│   └── Calculator.jsx               # Main orchestrator (replaces monolith)
│
├── export/
│   ├── pdf.js                        # generatePrintHTML, openPrintWindow
│   └── whatsapp.js                   # buildWhatsAppText
│
└── styles/
    └── keyframes.js                  # CSS injection logic
```

---

## 3. Solving the Global Mutable State Problem

### 3.1 Current Problem

```javascript
// data/constants.js — CURRENT (impure)
export let LISTA_ACTIVA = "web";

export function p(item) {
  if (!item) return 0;
  if (LISTA_ACTIVA === "venta") return item.venta || item.web || 0;
  return item.web || item.venta || 0;
}

export function setListaPrecios(lista) { LISTA_ACTIVA = lista; }
```

This creates several issues:
- **Hidden coupling**: Every calc function uses `p()` but doesn't declare `listaPrecios` as an input
- **Testing fragility**: Tests must call `setListaPrecios()` in `beforeEach` or results are non-deterministic
- **React anti-pattern**: The `useEffect` syncing `listaPrecios` state to a module global is a time-bomb in concurrent mode
- **Stale reads**: In React 18's automatic batching, `p()` may read stale `LISTA_ACTIVA`

### 3.2 Solution: Pure Pricer Factory

```javascript
// engine/pricing.js — PROPOSED (pure)
export const IVA = 0.22;
export const IVA_MULT = 1.22;

export function createPricer(lista = "web") {
  return function price(item) {
    if (!item) return 0;
    if (lista === "venta") return item.venta || item.web || 0;
    return item.web || item.venta || 0;
  };
}

export function priceWithIVA(pricer) {
  return (item) => +(pricer(item) * IVA_MULT).toFixed(2);
}
```

### 3.3 Migration: How All Callers Change

Every engine function currently calls `p(item)` directly. The migration adds a `price` parameter:

**Before:**
```javascript
export function calcPanelesTecho(panel, espesor, largo, ancho) {
  const espData = panel.esp[espesor];
  const precioM2 = p(espData);            // ← hidden global dependency
  // ...
}
```

**After:**
```javascript
export function calcPanelesTecho(panel, espesor, largo, ancho, price) {
  const espData = panel.esp[espesor];
  const precioM2 = price(espData);         // ← explicit, injected, pure
  // ...
}
```

The call site in the React component becomes:

```javascript
const results = useMemo(() => {
  const price = createPricer(listaPrecios);
  return calcTechoCompleto(techo, price);
}, [listaPrecios, techo]);
```

### 3.4 Backward Compatibility Shim

To avoid a big-bang migration, keep a compatibility layer in `data/constants.js`:

```javascript
// Backward-compatible shim — remove once all callers migrated
import { createPricer } from '../engine/pricing.js';
let _activePricer = createPricer("web");
export function p(item) { return _activePricer(item); }
export function setListaPrecios(lista) { _activePricer = createPricer(lista); }
```

---

## 4. State Management Improvement

### 4.1 Current Problem: useState Soup

The main component has 12 independent `useState` calls:

```javascript
const [listaPrecios, setLP] = useState("web");
const [scenario, setScenario] = useState("solo_techo");
const [proyecto, setProyecto] = useState({ tipoCliente: "empresa", nombre: "", ... });
const [techo, setTecho] = useState({ familia: "", espesor: "", ... });
const [pared, setPared] = useState({ familia: "", espesor: "", ... });
const [camara, setCamara] = useState({ largo_int: 6, ... });
const [flete, setFlete] = useState(280);
const [overrides, setOverrides] = useState({});
const [collapsedGroups, setCollapsedGroups] = useState({});
const [toast, setToast] = useState(null);
const [activeStep, setActiveStep] = useState(0);
const [showTransp, setShowTransp] = useState(false);
```

Problems: (a) the `handleReset` function must manually reconstruct every initial value; (b) related state updates (e.g., `uT` + `uP` for `tipoEst`) are not atomic; (c) there's no way to serialize/restore a full calculator snapshot.

### 4.2 Solution: useReducer with Typed Actions

```javascript
// hooks/useCalculatorState.js

const INITIAL_STATE = {
  listaPrecios: "web",
  scenario: "solo_techo",
  proyecto: {
    tipoCliente: "empresa", nombre: "", rut: "", telefono: "",
    direccion: "", descripcion: "", refInterna: "",
    fecha: new Date().toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }),
  },
  techo: {
    familia: "", espesor: "", color: "Blanco", largo: 6.0, ancho: 5.0,
    tipoEst: "metal", ptsHorm: 0,
    borders: { frente: "gotero_frontal", fondo: "gotero_frontal", latIzq: "gotero_lateral", latDer: "gotero_lateral" },
    opciones: { inclCanalon: false, inclGotSup: false, inclSell: true },
  },
  pared: {
    familia: "", espesor: "", color: "Blanco", alto: 3.5, perimetro: 40,
    numEsqExt: 4, numEsqInt: 0, aberturas: [], tipoEst: "metal", inclSell: true, incl5852: false,
  },
  camara: { largo_int: 6, ancho_int: 4, alto_int: 3 },
  flete: 280,
  overrides: {},

  // UI-only state (not part of the calculation domain)
  collapsedGroups: {},
  activeStep: 0,
  showTransp: false,
};

function calcReducer(state, action) {
  switch (action.type) {
    case "SET_LISTA":
      return { ...state, listaPrecios: action.payload };
    case "SET_SCENARIO":
      return { ...state, scenario: action.payload };
    case "UPDATE_TECHO":
      return { ...state, techo: { ...state.techo, ...action.payload } };
    case "UPDATE_PARED":
      return { ...state, pared: { ...state.pared, ...action.payload } };
    case "UPDATE_PROYECTO":
      return { ...state, proyecto: { ...state.proyecto, ...action.payload } };
    case "UPDATE_CAMARA":
      return { ...state, camara: { ...state.camara, ...action.payload } };
    case "SET_FLETE":
      return { ...state, flete: action.payload };
    case "SET_OVERRIDE":
      return { ...state, overrides: { ...state.overrides, [action.lineId]: { field: action.field, value: action.value } } };
    case "REVERT_OVERRIDE": {
      const next = { ...state.overrides };
      delete next[action.lineId];
      return { ...state, overrides: next };
    }
    case "SET_FAMILIA": {
      const { panelData, familyKey } = action;
      const firstEsp = Number(Object.keys(panelData.esp)[0]);
      if (panelData.tipo === "techo")
        return { ...state, techo: { ...state.techo, familia: familyKey, espesor: firstEsp } };
      return { ...state, pared: { ...state.pared, familia: familyKey, espesor: firstEsp } };
    }
    case "TOGGLE_GROUP":
      return { ...state, collapsedGroups: { ...state.collapsedGroups, [action.title]: !state.collapsedGroups[action.title] } };
    case "SET_STEP":
      return { ...state, activeStep: action.payload };
    case "TOGGLE_TRANSP":
      return { ...state, showTransp: !state.showTransp };
    case "RESET":
      return { ...INITIAL_STATE };
    default:
      return state;
  }
}

export { INITIAL_STATE, calcReducer };
```

**Benefits:**
- `RESET` action is a single dispatch (no 8 separate setter calls)
- `SET_FAMILIA` atomically updates both `familia` and `espesor` in one render
- State is serializable — can be saved/restored (future: URL params or localStorage)
- Reducer is testable independently of React

---

## 5. Example Extracted Modules (Complete Code)

### 5.1 Module: `engine/pricing.js`

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// engine/pricing.js — Pure pricing functions (no globals)
// ═══════════════════════════════════════════════════════════════════════════

export const IVA = 0.22;
export const IVA_MULT = 1.22;

/**
 * Creates a pricing function bound to the given price list.
 * Returns a pure function: (item) => number.
 *
 * @param {"web" | "venta"} lista - Which price list to use
 * @returns {(item: {web?: number, venta?: number} | null) => number}
 */
export function createPricer(lista = "web") {
  return function price(item) {
    if (!item) return 0;
    if (lista === "venta") return item.venta || item.web || 0;
    return item.web || item.venta || 0;
  };
}

/**
 * Wraps a pricer to return prices including IVA.
 * @param {Function} pricer - A function returned by createPricer
 * @returns {(item: object) => number}
 */
export function priceWithIVA(pricer) {
  return (item) => +(pricer(item) * IVA_MULT).toFixed(2);
}

/**
 * Calculate grand totals from an array of BOM items.
 * All items are assumed pre-VAT. IVA is applied once at the end.
 *
 * @param {Array<{total: number}>} allItems
 * @returns {{subtotalSinIVA: number, iva: number, totalFinal: number}}
 */
export function calcTotalesSinIVA(allItems) {
  const sumSinIVA = allItems.reduce((s, i) => s + (i.total || 0), 0);
  const subtotalSinIVA = +sumSinIVA.toFixed(2);
  const iva = +(subtotalSinIVA * IVA).toFixed(2);
  const totalConIVA = +(subtotalSinIVA + iva).toFixed(2);
  return { subtotalSinIVA, iva, totalFinal: totalConIVA };
}

export const fmtPrice = (n) =>
  Number(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
```

### 5.2 Module: `components/ui/StepperInput.jsx`

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// components/ui/StepperInput.jsx — Numeric input with +/- buttons
// ═══════════════════════════════════════════════════════════════════════════

import { Minus, Plus } from "lucide-react";
import { C, FONT, TR, TN, SHI } from "../../data/tokens.js";

export default function StepperInput({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  unit = "",
  decimals = 2,
}) {
  const bump = (dir) => {
    const next = parseFloat((value + dir * step).toFixed(decimals));
    if (next >= min && next <= max) onChange(next);
  };

  const btnStyle = (disabled) => ({
    width: 32,
    height: 32,
    borderRadius: 8,
    border: `1.5px solid ${C.border}`,
    background: C.surface,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.4 : 1,
    transition: TR,
    flexShrink: 0,
  });

  const inputStyle = {
    width: 80,
    textAlign: "center",
    borderRadius: 10,
    border: `1.5px solid ${C.border}`,
    padding: "6px 8px",
    fontSize: 14,
    fontWeight: 500,
    background: C.surface,
    color: C.tp,
    outline: "none",
    boxShadow: SHI,
    transition: TR,
    fontFamily: FONT,
    ...TN,
  };

  const handleBlur = (e) => {
    const v = parseFloat(e.target.value);
    onChange(isNaN(v) ? min : Math.min(max, Math.max(min, v)));
  };

  return (
    <div style={{ fontFamily: FONT }}>
      {label && (
        <label
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: C.ts,
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          style={btnStyle(value <= min)}
          onClick={() => bump(-1)}
          aria-label={`Decrease ${label || "value"}`}
        >
          <Minus size={14} color={C.tp} />
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          onBlur={handleBlur}
          style={inputStyle}
          aria-label={label}
        />
        <button
          style={btnStyle(value >= max)}
          onClick={() => bump(1)}
          aria-label={`Increase ${label || "value"}`}
        >
          <Plus size={14} color={C.tp} />
        </button>
        {unit && (
          <span style={{ fontSize: 13, color: C.ts, marginLeft: 2 }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
```

### 5.3 Module: `engine/techo.js` (with pure `price` parameter)

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// engine/techo.js — Roof calculation engine (pure functions)
// ═══════════════════════════════════════════════════════════════════════════

import { PANELS_TECHO, FIJACIONES, SELLADORES } from "../data/panels.js";
import { PERFIL_TECHO } from "../data/perfileria.js";
import { calcTotalesSinIVA } from "./pricing.js";

// ── Profile Resolver ────────────────────────────────────────────────────

export function resolveSKU_techo(tipo, familiaP, espesor) {
  const byTipo = PERFIL_TECHO[tipo];
  if (!byTipo) return null;
  const byFam = byTipo[familiaP];
  if (!byFam) return null;
  if (byFam[espesor]) return { ...byFam[espesor] };
  if (byFam._all) return { ...byFam._all };
  return null;
}

// ── Panel Calculations ──────────────────────────────────────────────────

export function calcPanelesTecho(panel, espesor, largo, ancho, price) {
  const espData = panel.esp[espesor];
  if (!espData) return null;
  const cantPaneles = Math.ceil(ancho / panel.au);
  const anchoTotal = cantPaneles * panel.au;
  const areaTotal = +(cantPaneles * largo * panel.au).toFixed(2);
  const precioM2 = price(espData);
  const costoPaneles = +(precioM2 * areaTotal).toFixed(2);
  return { cantPaneles, areaTotal, anchoTotal, costoPaneles, precioM2 };
}

// ── Autoportancia ───────────────────────────────────────────────────────

export function calcAutoportancia(panel, espesor, largo) {
  const espData = panel.esp[espesor];
  if (!espData || espData.ap == null) {
    return { ok: true, apoyos: null, maxSpan: null, largoMinOK: true, largoMaxOK: true };
  }
  const maxSpan = espData.ap;
  const apoyos = Math.ceil((largo / maxSpan) + 1);
  const ok = largo <= maxSpan;
  const largoMinOK = largo >= (panel.lmin || 0);
  const largoMaxOK = largo <= (panel.lmax || Infinity);
  return { ok, apoyos, maxSpan, largoMinOK, largoMaxOK };
}

// ── Fasteners: Varilla System ───────────────────────────────────────────

export function calcFijacionesVarilla(cantP, apoyos, largo, tipoEst, ptsHorm, price) {
  const puntosFijacion = Math.ceil(((cantP * apoyos) * 2) + (largo * 2 / 2.5));
  const varillas = Math.ceil(puntosFijacion / 4);

  let pMetal, pH;
  if (tipoEst === "metal") { pMetal = puntosFijacion; pH = 0; }
  else if (tipoEst === "hormigon") { pMetal = 0; pH = puntosFijacion; }
  else { pH = Math.min(ptsHorm || 0, puntosFijacion); pMetal = puntosFijacion - pH; }

  const tuercas = (pMetal * 2) + (pH * 1);
  const tacos = pH;
  const items = [];

  const puVar = price(FIJACIONES.varilla_38);
  items.push({ label: FIJACIONES.varilla_38.label, sku: "varilla_38", cant: varillas, unidad: "unid", pu: puVar, total: +(varillas * puVar).toFixed(2) });

  const puTuer = price(FIJACIONES.tuerca_38);
  items.push({ label: FIJACIONES.tuerca_38.label, sku: "tuerca_38", cant: tuercas, unidad: "unid", pu: puTuer, total: +(tuercas * puTuer).toFixed(2) });

  if (tacos > 0) {
    const puTaco = price(FIJACIONES.taco_expansivo);
    items.push({ label: FIJACIONES.taco_expansivo.label, sku: "taco_expansivo", cant: tacos, unidad: "unid", pu: puTaco, total: +(tacos * puTaco).toFixed(2) });
  }

  const puArand = price(FIJACIONES.arandela_carrocero);
  items.push({ label: FIJACIONES.arandela_carrocero.label, sku: "arandela_carrocero", cant: puntosFijacion, unidad: "unid", pu: puArand, total: +(puntosFijacion * puArand).toFixed(2) });

  const puPP = price(FIJACIONES.arandela_pp);
  items.push({ label: FIJACIONES.arandela_pp.label, sku: "arandela_pp", cant: puntosFijacion, unidad: "unid", pu: puPP, total: +(puntosFijacion * puPP).toFixed(2) });

  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), puntosFijacion };
}

// ── Fasteners: Caballete System ─────────────────────────────────────────

export function calcFijacionesCaballete(cantP, largo, price) {
  const caballetes = Math.ceil((cantP * 3 * (largo / 2.9 + 1)) + ((largo * 2) / 0.3));
  const tornillosAguja = caballetes * 2;
  const items = [];

  const puCab = price(FIJACIONES.caballete);
  items.push({ label: FIJACIONES.caballete.label, sku: "caballete", cant: caballetes, unidad: "unid", pu: puCab, total: +(caballetes * puCab).toFixed(2) });

  const paquetesAguja = Math.ceil(tornillosAguja / 100);
  const puAguja = price(FIJACIONES.tornillo_aguja);
  items.push({ label: FIJACIONES.tornillo_aguja.label, sku: "tornillo_aguja", cant: paquetesAguja, unidad: "x100", pu: puAguja, total: +(paquetesAguja * puAguja).toFixed(2) });

  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), puntosFijacion: caballetes };
}

// ── Roof Profiles ───────────────────────────────────────────────────────

export function calcPerfileriaTecho(borders, cantP, largo, anchoTotal, familiaP, espesor, opciones, price) {
  const items = [];
  let totalML = 0;

  const addPerfil = (label, tipo, dim) => {
    const resolved = resolveSKU_techo(tipo, familiaP, espesor);
    if (!resolved) return;
    const precio = price(resolved);
    const pzas = Math.ceil(dim / resolved.largo);
    const ml = pzas * resolved.largo;
    totalML += ml;
    items.push({ label, sku: resolved.sku, tipo, cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2), ml: +ml.toFixed(2) });
  };

  if (borders.frente && borders.frente !== "none") addPerfil("Frente: " + borders.frente, borders.frente, anchoTotal);
  if (borders.fondo && borders.fondo !== "none") addPerfil("Fondo: " + borders.fondo, borders.fondo, anchoTotal);
  if (borders.latIzq && borders.latIzq !== "none") addPerfil("Lat.Izq: " + borders.latIzq, borders.latIzq, largo);
  if (borders.latDer && borders.latDer !== "none") addPerfil("Lat.Der: " + borders.latDer, borders.latDer, largo);

  if (opciones?.inclGotSup) {
    const gs = resolveSKU_techo("gotero_superior", familiaP, espesor);
    if (gs) {
      const precio = price(gs);
      const pzas = Math.ceil(anchoTotal / gs.largo);
      totalML += pzas * gs.largo;
      items.push({ label: "Gotero superior", sku: gs.sku, tipo: "gotero_superior", cant: pzas, unidad: "unid", pu: precio, total: +(pzas * precio).toFixed(2) });
    }
  }

  if (opciones?.inclCanalon) {
    const canData = resolveSKU_techo("canalon", familiaP, espesor);
    if (canData) {
      const precioCan = price(canData);
      const pzasCan = Math.ceil(anchoTotal / canData.largo);
      totalML += pzasCan * canData.largo;
      items.push({ label: "Canalón", sku: canData.sku, tipo: "canalon", cant: pzasCan, unidad: "unid", pu: precioCan, total: +(pzasCan * precioCan).toFixed(2) });
    }
    const sopData = resolveSKU_techo("soporte_canalon", familiaP, espesor);
    if (sopData) {
      const mlSoportes = (cantP + 1) * 0.30;
      const barrasSoporte = Math.ceil(mlSoportes / sopData.largo);
      const precioSop = price(sopData);
      items.push({ label: "Soporte canalón", sku: sopData.sku, tipo: "soporte_canalon", cant: barrasSoporte, unidad: "unid", pu: precioSop, total: +(barrasSoporte * precioSop).toFixed(2) });
    }
  }

  if (totalML > 0) {
    const fijPerf = Math.ceil(totalML / 0.30);
    const paquetesT1 = Math.ceil(fijPerf / 100);
    const puT1 = price(FIJACIONES.tornillo_t1);
    items.push({ label: FIJACIONES.tornillo_t1.label, sku: "tornillo_t1", tipo: "fijacion_perfileria", cant: paquetesT1, unidad: "x100", pu: puT1, total: +(paquetesT1 * puT1).toFixed(2) });
  }

  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2), totalML: +totalML.toFixed(2) };
}

// ── Sealants ────────────────────────────────────────────────────────────

export function calcSelladoresTecho(cantP, price) {
  const items = [];
  const siliconas = Math.ceil(cantP * 0.5);
  const puSil = price(SELLADORES.silicona);
  items.push({ label: SELLADORES.silicona.label, sku: "silicona", cant: siliconas, unidad: "unid", pu: puSil, total: +(siliconas * puSil).toFixed(2) });

  const cintas = Math.ceil(cantP / 10);
  const puCinta = price(SELLADORES.cinta_butilo);
  items.push({ label: SELLADORES.cinta_butilo.label, sku: "cinta_butilo", cant: cintas, unidad: "unid", pu: puCinta, total: +(cintas * puCinta).toFixed(2) });

  const total = items.reduce((s, i) => s + i.total, 0);
  return { items, total: +total.toFixed(2) };
}

// ── Integration: Full Roof Calculation ──────────────────────────────────

export function calcTechoCompleto(inputs, price) {
  const { familia, espesor, largo, ancho, tipoEst, ptsHorm, borders, opciones, color } = inputs;
  const panel = PANELS_TECHO[familia];
  if (!panel) return { error: `Familia "${familia}" no encontrada` };
  const espData = panel.esp[espesor];
  if (!espData) return { error: `Espesor ${espesor}mm no disponible` };

  const warnings = [];
  if (color) {
    if (!panel.col.includes(color)) warnings.push(`Color "${color}" no disponible para ${familia}`);
    if (panel.colMax?.[color] && espesor > panel.colMax[color]) warnings.push(`Color ${color} solo hasta ${panel.colMax[color]}mm`);
  }

  const paneles = calcPanelesTecho(panel, espesor, largo, ancho, price);
  if (!paneles) return { error: "Error calculando paneles" };

  if (color && panel.colMinArea?.[color] && paneles.areaTotal < panel.colMinArea[color]) {
    warnings.push(`Color ${color} requiere mín. ${panel.colMinArea[color]} m² (cotizado: ${paneles.areaTotal.toFixed(1)} m²)`);
  }

  const autoportancia = calcAutoportancia(panel, espesor, largo);
  if (!autoportancia.ok) warnings.push(`Largo ${largo}m excede autoportancia máx ${autoportancia.maxSpan}m. Requiere ${autoportancia.apoyos} apoyos.`);
  if (!autoportancia.largoMinOK) warnings.push(`Largo ${largo}m < mínimo ${panel.lmin}m`);
  if (!autoportancia.largoMaxOK) warnings.push(`Largo ${largo}m > máximo fabricable ${panel.lmax}m`);

  let fijaciones;
  if (panel.sist === "varilla_tuerca") {
    fijaciones = calcFijacionesVarilla(paneles.cantPaneles, autoportancia.apoyos || 2, largo, tipoEst || "metal", ptsHorm || 0, price);
  } else {
    fijaciones = calcFijacionesCaballete(paneles.cantPaneles, largo, price);
  }

  const perfileria = calcPerfileriaTecho(
    borders || { frente: "none", fondo: "none", latIzq: "none", latDer: "none" },
    paneles.cantPaneles, largo, paneles.anchoTotal, panel.fam, espesor,
    opciones || {}, price,
  );

  let selladores = { items: [], total: 0 };
  if (!opciones || opciones.inclSell !== false) selladores = calcSelladoresTecho(paneles.cantPaneles, price);

  const panelItem = {
    label: panel.label + ` ${espesor}mm`,
    sku: `${familia}-${espesor}`,
    cant: paneles.areaTotal,
    unidad: "m²",
    pu: paneles.precioM2,
    total: paneles.costoPaneles,
  };

  const allItems = [panelItem, ...fijaciones.items, ...perfileria.items, ...selladores.items];
  const totales = calcTotalesSinIVA(allItems);

  return { paneles, autoportancia, fijaciones, perfileria, selladores, totales, warnings, allItems };
}
```

---

## 6. Migration Strategy (Step by Step)

### Phase 1 — Extract Data (Risk: Low, Breakage: None)

Split `data/constants.js` into focused files. This is purely mechanical — no logic changes.

| Step | Action | Details |
|---|---|---|
| 1a | Create `data/tokens.js` | Move `C`, `FONT`, `SHC`, `SHI`, `TR`, `TN`, `COLOR_HEX` |
| 1b | Create `data/panels.js` | Move `PANELS_TECHO`, `PANELS_PARED`, `FIJACIONES`, `SELLADORES` |
| 1c | Create `data/perfileria.js` | Move `PERFIL_TECHO`, `PERFIL_PARED` |
| 1d | Create `data/servicios.js` | Move `SERVICIOS` |
| 1e | Create `data/scenarios.js` | Move `SCENARIOS_DEF`, `VIS`, `OBRA_PRESETS`, `BORDER_OPTIONS`, `STEP_SECTIONS` |
| 1f | Create `data/index.js` | Re-export everything so existing imports still work |
| 1g | Update `data/constants.js` | Becomes `export * from './index.js'` (backward-compat shim) |

**Why first:** Zero risk, zero logic changes, just file splitting. All existing imports via `data/constants.js` continue to work.

### Phase 2 — Extract UI Components (Risk: Low)

Move each UI component from `components/PanelinCalculadoraV3.jsx` into its own file.

| Step | Action |
|---|---|
| 2a | Create `components/ui/AnimNum.jsx` |
| 2b | Create `components/ui/CustomSelect.jsx` |
| 2c | Create `components/ui/StepperInput.jsx` |
| 2d | Create `components/ui/SegmentedControl.jsx` |
| 2e | Create `components/ui/Toggle.jsx` |
| 2f | Create `components/ui/KPICard.jsx` |
| 2g | Create `components/ui/ColorChips.jsx` |
| 2h | Create `components/ui/AlertBanner.jsx` |
| 2i | Create `components/ui/Toast.jsx` |
| 2j | Create `components/ui/TableGroup.jsx` |
| 2k | Create `components/BorderConfigurator.jsx` |
| 2l | Replace inline definitions in main component with imports |

**Why second:** These are leaf components with zero cross-dependencies. Moving them does not change any business logic.

### Phase 3 — Purify the Pricing Engine (Risk: Medium)

| Step | Action |
|---|---|
| 3a | Create `engine/pricing.js` with `createPricer()` |
| 3b | Add `price` parameter to every function in `utils/calculations.js` |
| 3c | Update `calcTechoCompleto` and `calcParedCompleto` signatures |
| 3d | Update the main component's `useMemo` to use `createPricer(listaPrecios)` |
| 3e | Remove `LISTA_ACTIVA`, `setListaPrecios`, `p()` from `data/constants.js` |
| 3f | Remove the `useEffect(() => { setListaPrecios(listaPrecios) })` |
| 3g | Update tests to use `createPricer()` instead of setting a global |

**Why third:** This is the single highest-value refactor. It eliminates the most dangerous pattern in the codebase. But it touches every calc function signature, so data + UI must be stable first.

### Phase 4 — State Management (Risk: Medium)

| Step | Action |
|---|---|
| 4a | Create `hooks/useCalculatorState.js` with reducer |
| 4b | Replace 12 `useState` calls with `useReducer(calcReducer, INITIAL_STATE)` |
| 4c | Replace handler functions with `dispatch()` calls |
| 4d | Extract `handlePrint`, `handleCopyWA` into `hooks/useCalculatorActions.js` |

### Phase 5 — Split Remaining Engine (Risk: Low)

| Step | Action |
|---|---|
| 5a | Create `engine/techo.js` from roof functions in `utils/calculations.js` |
| 5b | Create `engine/pared.js` from wall functions |
| 5c | Move BOM helpers to `engine/bom.js` |
| 5d | Move export utilities to `export/pdf.js` and `export/whatsapp.js` |
| 5e | Delete `utils/calculations.js` and `utils/helpers.js` (replaced) |

### Phase 6 — Build Pipeline (Risk: Low)

Set up the dual-output build (see Section 7 below).

---

## 7. Build Strategy: Dual Output (Modular + Single-File Artifact)

### 7.1 The Constraint

The project must continue to work as a single-file Claude.ai artifact — a self-contained `.jsx` file that can be pasted into Claude's artifact viewer with zero build step and zero imports beyond `react` and `lucide-react`.

### 7.2 Solution: Vite Library Mode + Custom Bundler Script

Use a separate Vite config for artifact bundling that inlines all modules into a single file.

**Add to `package.json`:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:artifact": "vite build --config vite.artifact.config.js",
    "test": "node tests/validation.js"
  }
}
```

**Create `vite.artifact.config.js`:**
```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/components/Calculator.jsx"),
      formats: ["es"],
      fileName: () => "PanelinCalculadoraV3.artifact.jsx",
    },
    rollupOptions: {
      external: ["react", "react-dom", "lucide-react"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "lucide-react": "lucideReact",
        },
        inlineDynamicImports: true,
      },
    },
    outDir: "dist/artifact",
    minify: false,
    target: "esnext",
  },
});
```

This produces a single `dist/artifact/PanelinCalculadoraV3.artifact.jsx` file with all internal modules inlined but `react` and `lucide-react` kept as external imports — exactly what Claude.ai artifacts expect.

### 7.3 Alternative: Simple Concatenation Script

For maximum control over the artifact output (readable, not bundled), create a Node.js script:

**`scripts/bundle-artifact.js`:**
```javascript
#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MODULE_ORDER = [
  "src/data/tokens.js",
  "src/data/panels.js",
  "src/data/perfileria.js",
  "src/data/servicios.js",
  "src/data/scenarios.js",
  "src/engine/pricing.js",
  "src/engine/techo.js",
  "src/engine/pared.js",
  "src/engine/bom.js",
  "src/export/pdf.js",
  "src/export/whatsapp.js",
  "src/styles/keyframes.js",
  "src/components/ui/AnimNum.jsx",
  "src/components/ui/CustomSelect.jsx",
  "src/components/ui/StepperInput.jsx",
  "src/components/ui/SegmentedControl.jsx",
  "src/components/ui/Toggle.jsx",
  "src/components/ui/KPICard.jsx",
  "src/components/ui/ColorChips.jsx",
  "src/components/ui/AlertBanner.jsx",
  "src/components/ui/Toast.jsx",
  "src/components/ui/TableGroup.jsx",
  "src/components/BorderConfigurator.jsx",
  "src/components/Calculator.jsx",
];

function stripImportsExports(code, filename) {
  let result = code
    .replace(/^import\s+.*from\s+['"]\.\//gm, "// [bundled] ")
    .replace(/^import\s+.*from\s+['"]\.\.\//gm, "// [bundled] ")
    .replace(/^export\s+default\s+/gm, "")
    .replace(/^export\s+(?:const|let|function|class)\s+/gm, (match) =>
      match.replace("export ", "")
    )
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, "");
  return `// ── ${filename} ──\n${result}\n`;
}

const header = `// ═══════════════════════════════════════════════════════════════════════════
// PanelinCalculadoraV3.jsx — Claude.ai Artifact (auto-generated)
// BMC Uruguay · Calculadora de Cotización v3.0
// Generated: ${new Date().toISOString()}
// DO NOT EDIT — modify the modular source files instead.
// ═══════════════════════════════════════════════════════════════════════════

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronUp, Printer, Trash2, Copy, Check,
  AlertTriangle, CheckCircle, Info, Minus, Plus, FileText,
  RotateCcw, Edit3
} from "lucide-react";

`;

let body = "";
for (const file of MODULE_ORDER) {
  const code = readFileSync(resolve(ROOT, file), "utf8");
  body += stripImportsExports(code, file);
}

const footer = `\nexport default PanelinCalculadoraV3;\n`;

writeFileSync(
  resolve(ROOT, "dist/artifact/PanelinCalculadoraV3.artifact.jsx"),
  header + body + footer,
);

console.log("Artifact generated: dist/artifact/PanelinCalculadoraV3.artifact.jsx");
```

### 7.4 Which Approach to Use?

| Approach | Pros | Cons |
|---|---|---|
| **Vite library mode** | Automatic, handles JSX transform, tree-shaking | Output is bundled (less readable), needs config |
| **Concatenation script** | Full control, readable output, preserves section comments | Manual ordering, fragile if imports change |

**Recommendation:** Use **Vite library mode** for CI (guarantees the artifact compiles), and the **concatenation script** for generating human-readable artifacts to paste into Claude.ai. Add both to the `package.json` scripts.

```json
{
  "scripts": {
    "build:artifact": "vite build --config vite.artifact.config.js",
    "build:artifact:readable": "node scripts/bundle-artifact.js"
  }
}
```

---

## 8. Testing the Refactored Engine

The pure `price` parameter makes testing dramatically simpler:

```javascript
// tests/engine/techo.test.js
import { describe, it, expect } from "vitest";
import { createPricer } from "../../src/engine/pricing.js";
import { calcPanelesTecho, calcTechoCompleto } from "../../src/engine/techo.js";
import { PANELS_TECHO } from "../../src/data/panels.js";

describe("calcPanelesTecho", () => {
  const price = createPricer("web");

  it("calculates ISODEC EPS 100mm, 6.5x5.6m", () => {
    const result = calcPanelesTecho(PANELS_TECHO.ISODEC_EPS, 100, 6.5, 5.6, price);
    expect(result.cantPaneles).toBe(5);
    expect(result.areaTotal).toBeCloseTo(36.4, 1);
    expect(result.costoPaneles).toBeCloseTo(1673.31, 0);
  });

  it("returns null for invalid espesor", () => {
    expect(calcPanelesTecho(PANELS_TECHO.ISODEC_EPS, 999, 6.5, 5.6, price)).toBeNull();
  });

  it("produces different results for venta vs web", () => {
    const priceVenta = createPricer("venta");
    const web = calcPanelesTecho(PANELS_TECHO.ISODEC_EPS, 100, 6.5, 5.6, price);
    const venta = calcPanelesTecho(PANELS_TECHO.ISODEC_EPS, 100, 6.5, 5.6, priceVenta);
    expect(venta.costoPaneles).toBeLessThan(web.costoPaneles);
  });
});
```

No `beforeEach` / `afterEach` state setup. No global mutation. Each test is independent.

---

## 9. Summary: Before vs. After

| Aspect | Before (Current) | After (Proposed) |
|---|---|---|
| **Files** | 3 source files + 1 re-export | ~25 focused modules |
| **Largest file** | 643 lines (component) | ~200 lines (Calculator.jsx orchestrator) |
| **Global state** | `LISTA_ACTIVA` module-level `let` | None — `createPricer()` is pure |
| **State management** | 12 independent `useState` | 1 `useReducer` with typed actions |
| **Testability** | Requires global setup (`setListaPrecios`) | Zero setup — inject `price` function |
| **UI components** | 11 components in 1 file | 11 files in `components/ui/` |
| **Single-file artifact** | Manual copy of the monolith | Automated via `npm run build:artifact` |
| **Reset logic** | Manually reconstruct 8 initial values | `dispatch({ type: "RESET" })` |

### Risk Assessment

| Phase | Risk | Mitigation |
|---|---|---|
| 1 — Data split | Very low | Pure file split, re-export shim |
| 2 — UI extraction | Low | Leaf components, no cross-deps |
| 3 — Pricing purification | Medium | Backward-compat shim during transition |
| 4 — useReducer | Medium | Keep old handlers as dispatch wrappers initially |
| 5 — Engine split | Low | Already partially done |
| 6 — Build pipeline | Low | Additive — doesn't change dev workflow |

---

## 10. Recommended Execution Order

1. **Start with Phase 3 (pricing purification)** — highest value, eliminates the most dangerous pattern
2. Then Phase 1 (data split) — easy win, reduces `constants.js` cognitive load
3. Then Phase 2 (UI extraction) — makes the main component readable
4. Then Phase 6 (build pipeline) — ensures artifact generation is automated
5. Then Phase 4 (useReducer) — optional but improves long-term maintainability
6. Phase 5 last — the `calculations.js` / `helpers.js` split is already decent

Each phase is independently deployable and backward-compatible. No phase requires completing another first (except Phase 6 depends on having a stable module graph).
