# Calculadora BMC — Project Instructions

## Vision
Read `docs/VISION.md` — the strategic north star. All dev decisions must align with it.

## Stack
- **Frontend**: React 18 + Vite 7, client-side calculations, CSS-in-JS
- **Backend**: Express 5, Google Sheets API, AI completions (Claude/GPT/Gemini/Grok)
- **Deploy**: Vercel (frontend), Cloud Run (backend optional)
- **Pricing**: Dual-list (venta/web), overrides in localStorage, MATRIZ Google Sheets as authoritative source

## Key Files

| File | Controls | Lines |
|------|----------|-------|
| `src/components/PanelinCalculadoraV3_backup.jsx` | Main UI — wizard, forms, tabs, BOM display | ~2,900 |
| `src/components/RoofPreview.jsx` | Visual roof zone editor — drag-drop SVG, snap-to-grid | ~506 |
| `src/components/FloorPlanEditor.jsx` | Building dimensions input (rectangle only for now) | ~140 |
| `src/data/constants.js` | Product catalog, pricing, panels, SCENARIOS_DEF (unified), BORDER_OPTIONS | ~3,300 |
| `src/data/pricing.js` | Price resolution with overrides + cache | ~133 |
| `src/utils/calculations.js` | Calculation engines (roof, wall, totals) — imports from calc/ modules | ~760 |
| `src/utils/calc/skuResolver.js` | Unified SKU resolution (roof + wall profiles) | ~80 |
| `src/utils/calc/structureDispatch.js` | Distribute fixation points by structure type | ~45 |
| `src/utils/scenarioOrchestrator.js` | Generic scenario execution utility available for scenario flows; calculator component still retains existing branching | ~140 |
| `src/utils/helpers.js` | BOM tables HTML, PDF report, WhatsApp text | ~549 |
| `src/utils/quotationViews.js` | Client-facing PDF templates | ~292 |
| `src/utils/pdfGenerator.js` | html2pdf.js wrapper (margins: 14/12/22/12 mm; CSS @page in helpers.js is not yet aligned) | ~82 |
| `server/routes/bmcDashboard.js` | API MATRIZ sync, push overrides, dashboard finanzas | ~1,400 |
| `public/pdf-preview-demo.html` | REFERENCE design for PDF (target professional layout) | ~291 |

## Commands
```
npm run dev              # Vite dev server (port 5173, HMR)
npm run dev:full         # API (3001) + Vite (5173)
npm run build            # Production build -> dist/
npm run test             # Validation (178 assertions)
npm run lint             # ESLint on src/
npm run gate:local       # Lint + test pre-commit
```

## Architecture
- **Scenarios** are defined in `SCENARIOS_DEF` (constants.js) with visibility + wizard steps unified in one place
- **Calculation orchestration** helpers live in `scenarioOrchestrator.js`; `executeScenario(id, inputs)` exists, but the calculator component is not yet fully switched over from its existing if/else branching
- **SKU resolution** is consolidated in `calc/skuResolver.js` (no duplication)
- **IVA (22%)** applied ONCE at the end by `calcTotalesSinIVA()`
- **All prices** are stored SIN IVA
- **Quantities** use `Math.ceil()` always
- **PDF margins** in `pdfGenerator.js`: 14mm top, 12mm sides, 22mm bottom; CSS `@page` margins in `helpers.js` are currently separate and should not be assumed to match

## Branch
Develop on: `claude/live-calculator-editing-Beqxk`
