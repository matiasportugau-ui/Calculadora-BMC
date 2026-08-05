# Role

You are a senior full-stack engineer on **Calculadora BMC / Panelin** implementing the **BMC Envíos** unification backlog: single packing source of truth (U1), quote→ops bridge (U2), then SDD evidence re-score toward **composite 100**. You execute in Claude Code / terminal with full repo access under `~/calculadora-bmc`. You do not redesign logistics as a multi-modal courier SaaS.

# Context

BMC Envíos is one product with two surfaces: **Quote** (wizard Flete 10/11 · `FleteCotizarPanel`) and **Ops** (`/logistica` · `BmcLogisticaApp`). Spec-Driven SoT: `docs/sdd/bmc-envios/SDD.md` v1.1 status **As-Built Hybrid**. Quality audit after evolution-loop: **composite 95 / 100 pass**; residual to 100 is product U1/U2. [CONFIRMED: `docs/sdd/bmc-envios/audit/SCORECARD.json`, `GAP-PLAN.md`]

**Dual packing (must fix U1):**
- Quote uses `src/utils/logistica/cargoPacking.js` `placeCargo` (export ~L93). [CONFIRMED]
- Ops implements a **local** richer `placeCargo` in `BmcLogisticaApp.jsx` ~L765 with `strategy` (`balanced` | `compact` | `doorPriority`) and layout options. [CONFIRMED]
- SDD ADR-001 requires one packing SoT; evidence E-04/E-05 document the drift. [CONFIRMED: `docs/sdd/bmc-envios/evidence/INDEX.md`]

**Already done (do not re-do):** Liquid Glass DESIGN-UI + `bmc-envios-glass.css` + `enviosTheme.js` (U5); SDD kit schema + RECREATION-CHECKLIST + audit pass 95 (U7). [CONFIRMED]

**Local stack:** React 18 + Vite SPA, Express 5 API, Doppler secrets. Dev: `doppler run -- npm run dev:full` → Vite `:5173`, API `:3001`. [CONFIRMED]

# Goal

Ship **U1 (single packing SoT)** and **U2 (quote→ops bridge)** so quote and `/logistica` share one packing engine and operators can hand off a quoted load into ENV without re-keying panel dims; then update SDD evidence and re-score so documentation composite approaches **100**.

- U1: Promote ops packing strategies into `src/utils/logistica/` (extend `cargoPacking.js` or sibling modules); delete local `placeCargo` / `buildPkgs` / strategy helpers from `BmcLogisticaApp.jsx`; keep quote `fleteEngine` working.
- U1 tests: golden packing cases for balanced/compact/doorPriority + freight occupancy still green (`tests/fleteEngine.test.js` + new packing tests).
- U2: Define `buildBridgePayload` (schemaVersion 1) + import into `/logistica` (session/localStorage/query) + CTA on quote surface (“Enviar a Logística”).
- Docs: retag evidence E-04/E-05/E-18; check TARGET U1/U2; run mental or `/sdd-quality-auditor` notes in handoff.
- Verify: `gate:local` (or lint + unit tests) green; manual smoke `/logistica` + Flete step.

# Scope

**IN:**
- `src/utils/logistica/**` packing kernel expansion
- `src/components/BmcLogisticaApp.jsx` thin consumer
- `src/utils/fleteEngine.js` only if API surface of packing changes (keep quote behavior stable)
- `src/components/FleteCotizarPanel.jsx` bridge CTA
- New bridge module e.g. `src/utils/logistica/bridgePayload.js` (or under `src/utils/envios/`)
- Tests under `tests/`
- Doc updates: `docs/sdd/bmc-envios/{TARGET.md,evidence/INDEX.md,RECREATION-CHECKLIST.md,SDD.md}` changelog only as needed

**OUT:**
- Multi-modal CBM / sea / air pricing as Core [CONFIRMED: SDD out of scope]
- Distance Matrix, isochrones, TSP (roadmap P2–P4)
- New microservice or Postgres shipments table (P5)
- Full FSM server enforcement (U3 partial OK only if trivial; not required for this goal)
- Rewriting entire wizard theme or PDF layout
- Deploy to production / Vercel / Cloud Run unless user explicitly asks after green local
- Changing master price sheets, fiscal data, or unrelated hub modules
- Inventing `POST /api/envios/*` HTTP (sketch only; pure JS bridge is enough) [CONFIRMED: Appendix D NOT DEPLOYED]

# Inputs

| Input | Path / note |
|-------|-------------|
| SDD SoT | `docs/sdd/bmc-envios/SDD.md` [CONFIRMED] |
| TARGET DoD | `docs/sdd/bmc-envios/TARGET.md` U1–U2 [CONFIRMED] |
| Evidence | `docs/sdd/bmc-envios/evidence/INDEX.md` [CONFIRMED] |
| DESIGN-UI (do not break glass rules) | `docs/sdd/bmc-envios/DESIGN-UI.md` [CONFIRMED] |
| Ops packing (source of strategy richness) | `src/components/BmcLogisticaApp.jsx` ~L598–L930 [CONFIRMED] |
| Kernel packing (quote SoT) | `src/utils/logistica/cargoPacking.js` [CONFIRMED] |
| Quote engine | `src/utils/fleteEngine.js` [CONFIRMED] |
| Tariffs | `src/data/constants.js` `TARIFAS_LOGISTICAS` [CONFIRMED] |
| Quote UI | `src/components/FleteCotizarPanel.jsx` [CONFIRMED] |
| Plan export | `src/utils/bmcLogisticaBedView.js` [CONFIRMED] |
| Tests | `tests/fleteEngine.test.js` [CONFIRMED] |
| AGENTS / gates | `AGENTS.md`, `npm run gate:local` [CONFIRMED] |
| Prod reference URL | `https://calculadora-bmc.vercel.app/logistica` [CONFIRMED] |

# Tools & MCPs

- **Read / Edit / Grep / Glob** — primary code work
- **Bash** — `npm test` / vitest, `npm run lint`, `npm run gate:local` (or `gate:local` subset if disk/time)
- **Optional:** Playwright/browser for smoke `/logistica` + Flete step
- Tools NOT needed: Sheets mutations, Meta Ads, deploy CLI (unless user unlocks), fiscal MCPs

# Constraints & Guardrails

- DO work only inside `~/calculadora-bmc` git root — never treat `$HOME` as the repo.
- DO NOT invent zone tariffs or change `TARIFAS_LOGISTICAS` values unless a test forces a pure bugfix (prefer leave tariffs).
- DO NOT put `backdrop-filter` on packing diagrams, stop tables, or dense form fields (Liquid Glass chrome only). [CONFIRMED: DESIGN-UI]
- DO NOT break quote behavior for zones: retiro=0, MVD/Canelones %, Maldonado 1-fila 280, Costa 252, especial manual. [CONFIRMED: SDD Appendix A / fleteEngine]
- DO keep ES modules, no new UI frameworks (no Tailwind/shadcn install).
- DO NOT commit secrets, `.env`, or Doppler tokens.
- DO run tests before claiming U1 done.
- DO prefer one PR-sized commit message set; do not force-push main.
- DO preserve ops features: strategies balanced/compact/doorPriority, manual layout if present, 3D lazy scene, localStorage key `bmc-logistica-online-v2`.
- DO use Spanish for operator-facing copy; English for code identifiers.
- DO update evidence INDEX when dual packing is gone (E-04/E-05).

# Anti-patterns

- DO NOT leave two `placeCargo` functions “for later”.
- DO NOT make ops call quote-only packing without porting strategies (would regress UX).
- DO NOT duplicate MAX_P / height rules in three places after the merge.
- DO NOT implement full courier CBM research doc as Core.
- DO NOT claim SDD score 100 without re-audit after code lands.
- DO NOT block on transportista migrate / Meta pixel / AI provider probe noise from `dev:full` logs.
- DO NOT use `echo` for secrets; do not `npm audit fix --force`.
- DO NOT expand scope to rewrite `BmcLogisticaApp` architecture wholesale (thin adapter only).

# Implementation plan (execute in order)

## Phase A — U1 packing kernel

1. Diff ops local packing vs `cargoPacking.js`: API shape (`stops`, `trL`, `strategy`, `layoutOptions`), package model, return shape (`placed`, `rowH`, `warns`, `stacksByRow`, `stopUnloadOrder`, …).
2. Extend kernel so **one module** supports:
   - Quote path: current `placeCargo(stops, trL, { maxH })` used by `fleteEngine` + `classifyVehicleOccupancy` (must remain stable).
   - Ops path: `placeCargo(stops, trL, strategy, layoutOptions)` or unified options object — choose one public API; adapt callers.
3. Port `buildPkgs`, strategy scoring, stack layout from ops into `src/utils/logistica/` (split files OK: e.g. `cargoPacking.js` + `cargoStrategies.js`).
4. Replace ops local functions with imports; delete dead local packing code.
5. Add `tests/cargoPacking.test.js` (or similar): at least balanced vs compact difference smoke + height 2.4m hard stop + empty stops.
6. Ensure `tests/fleteEngine.test.js` still passes.

## Phase B — U2 bridge

1. Implement `buildBridgePayload({ schemaVersion: 1, source, panels, quote, proyectoRef, createdAt })` per SDD Appendix D / TARGET.
2. Persist handoff: e.g. `sessionStorage` key `bmc-envios-bridge-v1` and/or query `?importBridge=1`.
3. On `/logistica` mount: detect payload → create/update stops + optional info fields + clear or keep payload once.
4. Quote UI: button **“Enviar a Logística”** after successful auto quote (and allow after manual override if panels exist); navigate to `/logistica`.
5. Keep Liquid Glass classes for CTA (`.envios-btn-primary` or `.envios-btn-glass`).
6. Unit test payload round-trip pure functions.

## Phase C — Docs + score path

1. Update `evidence/INDEX.md`: E-04/E-05 single SoT CONFIRMED; E-18 bridge CONFIRMED with path:line.
2. Checkboxes in `RECREATION-CHECKLIST.md` §7 U1/U2 → `[x]`.
3. `TARGET.md` mark U1/U2 done.
4. Short SDD changelog 1.2 note (do not rewrite whole SDD).
5. Optionally re-run schema checklist mentally; note expected composite **~97–100** for human `/sdd-quality-auditor`.

## Phase D — Verify

1. `npx eslint` on touched files / `npm run lint` if affordable.
2. Unit tests packing + flete + bridge.
3. Manual: `/logistica` strategies still switch; quote Cotizar flete still numbers; bridge import path once.
4. Write session note in `docs/team/PROJECT-STATE.md` Cambios recientes **only if** project rules require (one line).

# Deliverables

1. Kernel packing with strategies — `src/utils/logistica/*` (no dual placeCargo in app)
2. `BmcLogisticaApp.jsx` thin consumer
3. Bridge module + FleteCotizarPanel CTA + logistica import
4. Tests: packing + bridge (+ flete still green)
5. Doc updates: evidence INDEX, RECREATION-CHECKLIST, TARGET, SDD changelog
6. Terminal summary: files changed, test results, residual risks

# Success Criteria

- [ ] `rg -n "function placeCargo" src/components/BmcLogisticaApp.jsx` → **0 matches**
- [ ] `rg -n "export function placeCargo" src/utils/logistica` → ≥1
- [ ] `tests/fleteEngine.test.js` green
- [ ] New packing tests green (strategies covered)
- [ ] Bridge: quote → navigate → ops shows imported panels/destino without re-type
- [ ] Maldonado 1-fila quote still **USD 280** for same fixture as existing tests
- [ ] No glass blur on SVG packing surfaces
- [ ] Evidence E-18 CONFIRMED; U1/U2 checklist boxes checked
- [ ] `npm run gate:local` green **or** explicit documented skip with lint+unit green if gate blocked by unrelated env

# Operational Anchors

- Source hierarchy: **code + tests** > SDD (contracts) > research paste (roadmap only). Never invent tariffs from research CBM factors for panels.
- State labeling: mark claims `CONFIRMED` / `INFERRED` / `ASSUMPTION` in the final summary.
- Triangulation: `fleteEngine` + `cargoPacking` + SDD Appendix A must agree on zones and occupancy classes.
- Read-only by default on: production secrets, master price sheets, unrelated hub modules, fiscal data.
- If ops packing and quote packing semantics conflict during merge: **prefer preserving quote tariff fixtures** and ops strategy UX; surface conflicts in summary.

# Open Items

- [ASSUMPTION: Unified `placeCargo` options object can wrap both `(opts)` and `(strategy, layoutOptions)` without breaking fleteEngine | verify by running flete tests]
- [ASSUMPTION: Bridge via sessionStorage is acceptable for Core (no server shipment ID until P5) | matches SDD ADR-007 alternatives]
- [ASSUMPTION: Vitest is the test runner (`npx vitest run …`) | confirm package.json scripts if filter differs]
- [ASSUMPTION: User wants U1+U2 in one goal run toward SDD 100 | if time-box tight, complete U1 fully before U2]

# Blockers

None for starting U1. Do not wait on Doppler OAuth (use existing token), Meta pixel env, transportista migrate, or AI provider probes.

---

## Handoff to /goal

```bash
cd ~/calculadora-bmc
# Claude Code:
claude -p < goal-prompt-bmc-envios-u1-u2-sdd100.md
# or: /goal with this file as the completion condition document
```

**Completion condition for /goal skill:** All Success Criteria checkboxes true; dual `placeCargo` eliminated; bridge round-trip works; evidence INDEX updated.
