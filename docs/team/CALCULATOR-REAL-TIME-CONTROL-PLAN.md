# Calculator Real-Time Control & Modification Plan

**Objetivo:** Full control over Calculadora BMC development with automatic, real-time application of modifications (variables, logic, prices, design) — by you or a dedicated calculator team.

**Fecha:** 2026-03-19

---

## 1. Current State

| Layer | Location | Today |
|------|----------|-------|
| **Prices** | `src/data/constants.js` | Hardcoded (PANELS_TECHO, PANELS_PARED, FIJACIONES, SELLADORES, PERFIL_*) |
| **Logic** | `src/utils/calculations.js`, `helpers.js` | Code-only |
| **Design** | `src/data/constants.js` (C, FONT, SHC, etc.) | Design tokens in code |
| **Deploy** | Vercel | Git push → build → deploy |
| **Dev** | `npm run dev` (port 5173) | Vite HMR = instant refresh on file save |

---

## 2. What You Want

- **Full control** — You decide what changes go live
- **Automatic edition** — Modifications apply without manual file hunting
- **Real-time** — See changes immediately while developing
- **Scope** — Variables, logic, prices, design
- **Team** — Optionally a special team for calculator modifications

---

## 3. Implementation Options

### Option A: Live Dev + Natural Language Edits (Fastest to implement)

**How it works:**
1. Run `npm run dev` — Vite serves at localhost:5173 with hot reload
2. You describe changes in natural language: *"Change ISODEC EPS 100mm web price to 48.50"*
3. Agent (Cursor + bmc-calculadora-specialist) edits `constants.js` or `calculations.js`
4. Vite HMR refreshes the browser in ~1 second
5. You review → commit → deploy when ready

**Pros:** No new infra; works today; full control; you approve every change  
**Cons:** Requires Cursor/agent; edits are in code (not a Sheet)

**Setup:** Create a dedicated Cursor rule or skill for "Calculator Modifications" that:
- Reads `src/data/constants.js`, `calculations.js`, `helpers.js`
- Applies edits per your natural language request
- Runs `npm run lint` after changes

---

### Option B: Google Sheet as Source of Truth for Prices

**How it works:**
1. New tab: **Lista_Precios_Calculadora** (or use existing Parametros) in a BMC workbook
2. Columns: `sku`, `espesor`, `venta`, `web`, `costo`, `ap`
3. Calculator fetches prices at build time or runtime via API
4. You edit the Sheet → prices update without redeploy (if runtime fetch)

**Pros:** Non-devs can edit prices; single source of truth; audit trail  
**Cons:** Need API endpoint, caching, fallback if Sheet down; logic still in code

**Setup:**
- Add GET `/api/calculadora-precios` in bmcDashboard.js
- Read Sheet → return JSON
- Calculator: fetch on load, merge with defaults

---

### Option C: Dedicated Calculator Team (Agents)

**How it works:**
1. Define a **Calculator Modifications** sub-team: Calc Specialist + Design + Mapping
2. Single prompt: *"Invoque calculator team: update ISOROOF 3G 50mm pricing and add a new panel family"*
3. Orquestador invokes Calc Specialist, Design (if UI changes), Mapping (if Sheets affected)
4. Changes applied in one run; you review and commit

**Pros:** Structured workflow; multiple agents can collaborate; documented in PROJECT-STATE  
**Cons:** More setup; full team run is heavier than single-agent edits

**Setup:**
- Add "Calculator Modifications" to PROJECT-TEAM-FULL-COVERAGE §4
- Create `docs/team/knowledge/Calc-Modifications.md` with workflow
- Optional: `run_calculator_modifications.sh` that invokes only Calc + Design

---

### Option D: Hybrid (Recommended)

Combine A + B + C:

| What | Where | How |
|------|-------|-----|
| **Prices** | Google Sheet (Lista_Precios_Calculadora) | Runtime fetch; fallback to constants.js |
| **Logic** | Code (calculations.js) | Agent edits via natural language |
| **Design** | Code (constants.js C, FONT) | Agent edits via natural language |
| **Workflow** | `npm run dev` + Cursor | Live edits → HMR → you commit |
| **Team** | Calc Specialist + optional Design | Invoke when needed |

**Flow:**
1. **Daily:** You describe changes → Agent edits → Vite refreshes → you review
2. **Prices:** Edit Sheet → API serves new prices → no redeploy for price-only changes
3. **Bigger changes:** "Invoque calculator team" → structured run

---

## 4. Concrete Steps

### Phase 1 (Quick win — 1–2 days)

1. **Create Cursor rule** `.cursor/rules/calculator-modifications.mdc`:
   - When user says "modify calculator", "change price", "update calculadora", "edit panel pricing"
   - Read constants.js, calculations.js
   - Apply edits; run lint after

2. **Document** in `docs/team/knowledge/Calc.md`:
   - "Calculator modifications: describe in natural language; agent edits constants.js / calculations.js"

3. **Verify** live dev flow:
   - `npm run dev` → edit constants.js manually → confirm HMR works

### Phase 2 (Sheet-driven prices — 3–5 days)

1. **Create tab** Lista_Precios_Calculadora in BMC crm_automatizado (or Parametros)
2. **Add API** GET `/api/calculadora-precios` in bmcDashboard.js
3. **Update calculator** to fetch prices on load; fallback to constants.js if 503
4. **Document** in planilla-inventory.md

### Phase 3 (Calculator team — optional)

1. **Add** "Calculator Modifications" to PROJECT-TEAM-FULL-COVERAGE
2. **Script** `run_calculator_modifications.sh` that invokes Calc + Design only
3. **Log** for Calc: "Log for Calc: [change description]"

---

## 5. Real-Time Guarantee

| Scenario | Real-time? | How |
|----------|------------|-----|
| **Local dev** | Yes | Vite HMR ~1s |
| **Price change (Sheet)** | Yes (if runtime fetch) | Refresh page; no redeploy |
| **Logic/design change** | Yes (local) | Edit → HMR → refresh |
| **Production** | After deploy | Git push → Vercel build → live |

---

## 6. Control Points

- **You approve** every code change (git commit)
- **Sheet edits** — you control who has edit access to Lista_Precios_Calculadora
- **Agent edits** — only applied when you run the agent; you review diff before commit
- **Deploy** — Vercel deploys from your repo; you control branches

---

## 7. Workflow: Log de interacción + modificaciones integradas

**Flujo implementado (2026-03-19):**

1. **Corré** `npm run dev` (o `npm run dev:full` para guardar en archivo)
2. **Interactuá** con la calculadora (escenario, panel, espesor, dimensiones, etc.)
3. **Exportá el log** — panel "Log interacción" (esquina inferior izquierda):
   - **"Copiar para Cursor"** — formato listo para pegar (recomendado)
   - **"Solo JSON"** — log crudo
   - **"Guardar en archivo"** — escribe en `docs/team/calculator-logs/` (requiere `npm run dev:full`)
4. **Pegá en el chat** + escribí tu modificación en la plantilla
5. **El agente** lee el log (con stateSnapshot y summary) y aplica los cambios integrados

**Formato del log exportado:**
```json
{
  "sessionStarted": "2026-03-19T...",
  "url": "http://localhost:5173",
  "summary": "Escenario: solo_techo · Lista: web · Techo: ISODEC_EPS 100mm Blanco · Zonas: 6×5",
  "stateSnapshot": { "scenario": "solo_techo", "techo": {...}, "pared": {...}, ... },
  "actions": [
    { "t": 1234567890, "type": "change", "target": "scenario", "prev": "solo_techo", "next": "solo_fachada" }
  ]
}
```

**Ejemplo de prompt (formato "Copiar para Cursor"):**
> El bloque ya incluye la plantilla. Completá "Descripción de lo que quiero cambiar" y pegá en el chat.

---

## 8. Next Steps

1. Decide: Option A only, or A+B+C (Hybrid)
2. Phase 1: Create calculator-modifications rule (I can do this now)
3. Phase 2: Only if you want Sheet-driven prices
4. Phase 3: Only if you want a dedicated calculator team

---

## References

- [bmc-calculadora-specialist](.cursor/skills/bmc-calculadora-specialist/SKILL.md)
- [Calc.md](knowledge/Calc.md)
- [planilla-inventory.md](../google-sheets-module/planilla-inventory.md)
- [DASHBOARD-INTERFACE-MAP.md](../bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md).
