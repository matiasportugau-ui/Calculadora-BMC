# UX Proposals — Agent D (The UX Innovator)

**Project:** Calculadora BMC Panelin v3.0  
**Date:** March 8, 2026  
**Status:** All 5 proposals implemented with working code

---

## Summary

| # | Feature | User Value | Effort | Priority | Files Changed |
|---|---------|-----------|--------|----------|---------------|
| 1 | Quotation History & Comparison | Save/recall/compare quotes across sessions | Medium | **Must-have** | `QuotationHistory.jsx` (new), `PanelinCalculadoraV3.jsx` |
| 2 | Discount System | Apply commercial discounts (0-30%) with full PDF/WA integration | Small | **Must-have** | `PanelinCalculadoraV3.jsx`, `helpers.js` |
| 3 | Quick-Copy BOM Line Items | Copy individual line items to clipboard for WhatsApp discussions | Small | **Nice-to-have** | `PanelinCalculadoraV3.jsx` |
| 4 | Price Breakdown Pie Chart | Visual cost distribution by BOM section | Medium | **Nice-to-have** | `PriceBreakdownChart.jsx` (new), `PanelinCalculadoraV3.jsx` |
| 5 | Smart Defaults by Scenario | One-click typical configuration per scenario | Small | **Nice-to-have** | `constants.js`, `PanelinCalculadoraV3.jsx` |

---

## Proposal 1: Quotation History & Comparison

### User Value
A salesperson creates multiple quotes daily — different panel families, espesores, dimensions, and client configurations. Currently, switching parameters destroys the previous quote. With history, the sales team can:
- **Save** any quotation to localStorage (persists across browser sessions)
- **Load** a saved quote to instantly restore all inputs + overrides
- **Compare** two quotes side-by-side with highlighted differences and a delta summary
- **Delete** outdated quotes (max 30 stored)

This is the #1 most requested feature for any quoting tool. It turns a one-shot calculator into a persistent sales workspace.

### Implementation
**New file:** `src/components/QuotationHistory.jsx` (~155 lines)

The component is a slide-in panel from the right edge with:
- **QuoteCard**: Compact cards showing client name, date, scenario, panel type, and total. Action buttons for Load, Compare, and Delete.
- **CompareView**: Side-by-side grid comparing two quotes on client, scenario, panel, subtotal, IVA, and total. Highlights cells that differ with a yellow background. Shows an absolute USD difference at the bottom.

**Integration into main component:**
- Header gets **"Historial"** button (with count badge) and **"Guardar"** button
- State: `savedQuotes` (initialized from localStorage), `showHistory` flag
- `handleSaveQuote` serializes all calculator state (proyecto, scenario, techo, pared, camara, flete, discount, overrides, grandTotal, panel info)
- `handleLoadQuote` restores all state from a saved quote
- `handleDeleteQuote` removes from state + localStorage

### Effort: **Medium** (~3 hours)
### Priority: **Must-have**

---

## Proposal 2: Discount System

### User Value
Sales teams **always** negotiate. The current calculator has no way to apply a discount — the salesperson must manually compute discounted prices and communicate them separately from the PDF. This creates errors and looks unprofessional.

With the discount system:
- A **slider + numeric input** (0-30%) in the Options tab lets the salesperson set a global discount
- The discount is shown as a **green line** in the totals section: "Descuento 15% → −USD 1,234.56"
- IVA is recalculated on the **discounted subtotal** (correct Uruguayan tax treatment)
- The discount appears in the **PDF** and **WhatsApp** exports automatically
- A real-time "Ahorro para el cliente" badge motivates the sale

### Implementation
**State:** `discountPct` (integer 0-30)

**Grand total computation** (modified `useMemo`):
```javascript
if (discountPct > 0) {
  const descuento = +(raw.subtotalSinIVA * discountPct / 100).toFixed(2);
  const subtotalConDescuento = +(raw.subtotalSinIVA - descuento).toFixed(2);
  const iva = +(subtotalConDescuento * 0.22).toFixed(2);
  return { subtotalSinIVA: raw.subtotalSinIVA, descuento, subtotalConDescuento, iva,
    totalFinal: +(subtotalConDescuento + iva).toFixed(2), discountPct };
}
```

**PDF integration** (in `helpers.js`): Conditional row in totals table when `totals.descuento > 0`.

**WhatsApp integration**: Adds a discount line with tag emoji when discount > 0.

### UI
- Range slider (0-30) with accent color matching the brand
- Numeric input for precise entry
- Green success badge showing "Ahorro para el cliente: −USD X"
- Green line in dark totals card with minus sign

### Effort: **Small** (~1.5 hours)
### Priority: **Must-have**

---

## Proposal 3: Quick-Copy BOM Line Items

### User Value
When a salesperson is discussing a quotation over WhatsApp, the client often asks "how much for just the panels?" or "what's the fastener cost?". Currently, the salesperson must manually type out individual line items. With quick-copy:
- Each BOM row gets a **clipboard icon** in the Actions column
- One click copies a formatted string: `"ISODEC EPS 100mm: 33.6 m² × $45.97 = $1,544.59"`
- A toast confirms "Línea copiada"
- Perfect for pasting into WhatsApp, email, or notes

### Implementation
**Handler** added to main component:
```javascript
const handleCopyLine = useCallback((item) => {
  const cantStr = typeof item.cant === "number"
    ? (item.cant % 1 === 0 ? String(item.cant) : item.cant.toFixed(2)) : item.cant;
  const text = `${item.label}: ${cantStr} ${item.unidad} × $${fmtPrice(item.pu)} = $${fmtPrice(item.total)}`;
  navigator.clipboard.writeText(text).then(() => showToast("Línea copiada"));
}, []);
```

**TableGroup** modified to accept `onCopyLine` prop and render a `<Clipboard>` icon button for each row.

### Effort: **Small** (~30 minutes)
### Priority: **Nice-to-have** (but high impact per effort)

---

## Proposal 4: Price Breakdown Pie Chart

### User Value
Sales presentations benefit from visuals. When showing a quote to a client, a donut chart that breaks down costs by category (Panels, Fasteners, Profiles, Sealants, Freight) helps:
- **Justify the price**: "70% of your cost is panels — that's the quality insulation"
- **Identify savings**: "Sealants are only 3%, not worth cutting there"
- **Build trust**: Transparency in cost structure shows professionalism
- **Interactive**: Hovering a segment highlights it and shows exact % and USD amount

### Implementation
**New file:** `src/components/PriceBreakdownChart.jsx` (~120 lines)

Pure SVG donut chart, no dependencies:
- Computes arc paths from BOM group subtotals
- 8-color palette matching the app's design language
- Hover state: segment grows by 4px, center shows % and amount
- Legend with colored dots and percentage labels
- Fully responsive within its container

The chart is placed **above the totals card** in the right panel.

### Effort: **Medium** (~2 hours)
### Priority: **Nice-to-have** (delightful for presentations)

---

## Proposal 5: Smart Defaults by Scenario

### User Value
A new salesperson opening the calculator must manually select a panel family, espesor, dimensions, colors, etc. — even for the most common configurations. Smart defaults solve this by:
- Showing a **"Configuración rápida"** banner when the scenario changes
- One click applies the **most common configuration** for that scenario
- The salesperson can then fine-tune from a working starting point instead of a blank slate
- Reduces time-to-first-quote from ~60 seconds to ~10 seconds

### Defaults defined
| Scenario | Default Configuration |
|---|---|
| Solo Techo | ISODEC EPS 100mm, 6×5m, Blanco, metal structure |
| Solo Fachada | ISOPANEL EPS 100mm, 3.5m alto, 40m perimeter, 4 corners |
| Techo + Fachada | ISODEC EPS 100mm 10×8m + ISOPANEL EPS 100mm 4m×36m |
| Cámara Frigorífica | ISOPANEL EPS 100mm, 6×4×3m |

### Implementation
**Data** added to `constants.js`:
```javascript
export const SMART_DEFAULTS = {
  solo_techo: {
    label: "Techo típico — Vivienda 6×5m, ISODEC EPS 100mm",
    techo: { familia: "ISODEC_EPS", espesor: 100, ... },
  },
  // ... one entry per scenario
};
```

**UI**: A dismissible banner with lightning bolt icon appears when the scenario changes. "Aplicar" button calls `handleApplySmartDefaults` which spreads the default values into the existing state. The user can dismiss with "×" if they prefer manual entry.

### Effort: **Small** (~1 hour)
### Priority: **Nice-to-have** (great for onboarding new salespeople)

---

## Files Changed

| File | Change Type | Lines Added |
|---|---|---|
| `src/components/QuotationHistory.jsx` | **New** | ~155 |
| `src/components/PriceBreakdownChart.jsx` | **New** | ~120 |
| `src/components/PanelinCalculadoraV3.jsx` | Modified | ~100 |
| `src/utils/helpers.js` | Modified | ~8 |
| `src/data/constants.js` | Modified | ~25 |

## Verification

- Build: `npx vite build` passes
- Lint: `npm run lint` passes (0 errors)
- Tests: `npm test` passes (103/103 tests)

---

*Proposals by Agent D — The UX Innovator*
