# Product Vision — Calculadora BMC

## Mission

Transform the quotation calculator into a **visual building configurator** where users
design their roof/walls, see the result in 3D with real prices, and get a contract-grade
quotation in seconds — so intuitive it doesn't need assistance.

## Current State (April 2026)

### What Works
- 5 quotation scenarios (unified in SCENARIOS_DEF with visibility + wizard steps)
- Pure JS calculation engine with modular helpers (calc/skuResolver, calc/structureDispatch)
- Scenario orchestrator module (`scenarioOrchestrator.js`) implemented and ready for runtime wiring
- RoofPreview with drag-drop zones (2D SVG, pointer capture, snap-to-grid)
- Complete panel catalog: 7 families, multiple thicknesses/colors
- PDF A4 export with professional margins (14/12/22/12mm) + WhatsApp text
- Dual pricing (venta/web) with localStorage overrides
- Google Drive integration for save/load quotations
- AI backend (Claude/GPT/Gemini/Grok) + 7 endpoints for external agents
- CI/CD: lint + test + build on GitHub Actions

### What's Missing
- FloorPlanEditor is basic (rectangle only, 3 number inputs)
- No 3D visualization (2D SVG only)
- No product comparison side-by-side
- Price sync from MATRIZ is manual (CSV export/import)
- No price sanity validation (cost < selling, large jumps)
- In-app AI chat exists, but still lacks production-grade persistence/policy/traceability controls
- No audit trail for price changes

## The 5 Pillars

### Pillar 1: Bulletproof Quotation Engine (Commercial Contract)
- Calculation trace system ("why 22 fixation points?") — `trace: true` in inputs
- Tests for every calculation formula with Vitest
- Price versioning in each quotation (hash of active prices)
- Contract-grade PDF with legal terms and version tracking

### Pillar 2: Persistent & Reliable Pricing
- Auto-sync from Google Sheets MATRIZ on app startup
- Validation: cost < selling < web, alert on >20% jumps
- Unmapped SKUs must warn (currently silently skipped)
- Audit trail: who changed what price, when
- Server-side price cache with TTL (not just client localStorage)

### Pillar 3: Visual Building Configurator (2D + 3D)
- **2D**: Evolve FloorPlanEditor → L-shapes, polygons, draggable walls
- **3D**: New Building3DPreview with Three.js — isometric, panels with real color/texture
- Linked: edit in 2D → 3D updates in real-time
- Floating prices per zone
- Change product → 3D updates instantly with new color

### Pillar 4: User-Friendly Experience
- Wizard for ALL scenarios (currently only solo_techo uses wizard in vendedor mode)
- Comparison mode: select 2-3 options, see prices side-by-side
- Quick presets ("Economy roof", "Premium insulated wall")
- Client-facing mode: simplified view the seller shares
- Progressive disclosure

### Pillar 5: AI Assistant (Future, after Pillars 3-4)
- Chat sidebar connected to server/lib/aiCompletion.js
- NL → quotation: "Need a 200m² white roof, moderate budget"
- AI recommends options by climate zone
- Voice input (Web Speech API)

## Development Priority (Confirmed)

| # | What | Effort |
|---|------|--------|
| 1 | Live dev environment (Vite HMR + Vercel deploy) | Small |
| 2 | Enhanced FloorPlanEditor (L-shapes, polygons, drag walls) | Medium |
| 3 | 3D isometric building preview (Three.js, linked to 2D) | Large |
| 4 | UX overhaul (wizard all scenarios, comparison, presets) | Medium |
| 5 | Pricing reliability (auto-sync, validation, audit trail) | Medium |
| 6 | AI assistant in app | Medium |

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                FRONTEND (Vite + React)                │
│                                                       │
│  ┌────────────┐  ┌────────────┐  ┌─────────────────┐ │
│  │ FloorPlan  │  │ RoofPreview│  │ Building3D      │ │
│  │ Editor 2D  │←→│ drag-drop  │←→│ Preview (Three) │ │
│  │ polygons   │  │ SVG zones  │  │ colors/textures │ │
│  └─────┬──────┘  └─────┬──────┘  └───────┬─────────┘ │
│        └───────┬────────┘                │            │
│           ┌────▼─────┐            ┌──────▼──────┐     │
│           │ Scenario │            │  Product    │     │
│           │ Orchestr.│            │  Comparison │     │
│           └────┬─────┘            └─────────────┘     │
│           ┌────▼─────────┐  ┌──────────────────┐     │
│           │ Calc Engine  │  │ PDF Generator    │     │
│           │ (modular +   │  │ (professional    │     │
│           │  JSDoc)      │  │  contract-grade) │     │
│           └────┬─────────┘  └──────────────────┘     │
│           ┌────▼─────────────┐                        │
│           │ Pricing (auto-   │                        │
│           │ sync + validated)│                        │
│           └────┬─────────────┘                        │
├────────────────┼─────────────────────────────────────┤
│                │      BACKEND (Express)               │
│           ┌────▼────┐  ┌─────────┐  ┌──────────┐    │
│           │ MATRIZ  │  │ AI      │  │ Audit    │    │
│           │ Sync    │  │ Multi-  │  │ Trail    │    │
│           │ (Sheets)│  │ Provider│  │ (prices) │    │
│           └─────────┘  └─────────┘  └──────────┘    │
└──────────────────────────────────────────────────────┘
```
