# Role

You are the **BMC Calculadora roof-module implementation agent** (calc + UI + PDF + MATRIZ pricing). You ship the full roof encounter, sealant, per-zone quotation, and catalog-pricing integration described in this prompt — additive to the existing multizona geometry stack, not a greenfield rewrite.

# Blockers

1. **Business decisions not yet locked** — [CONFIRMED: prior session] The following must be resolved inline during execution (default to additive + MATRIZ-backed; flag `duda abierta` if blocked):
   - **D3** GLDCAM200 web > GLDCAM250 in MATRIZ — use verbatim MATRIZ values unless user overrides.
   - **D4** Canalón EPS vs PIR SKU split (`680X` vs `CAN.ISDC*`) — follow existing `constants.js` + MATRIZ mapping; do not invent SKUs.
   - **GLDCAM30** — [CONFIRMED: BROMYROS export 2026-06-23] SKU does not exist; minimum ISOROOF cámara gotero is **GLDCAM50**. Do not add GLDCAM30.
   - **BBAL / BBEL** — [CONFIRMED: BROMYROS] prices exist; mapping paths not yet in `matrizPreciosMapping.js`. Implement unless explicitly deferred.
   - **Limatesa (LITE3MAL / LITE3MPP)** — [CONFIRMED: user 2026-06-23] limahoya is OK; limatesa is OUT unless a one-line note is added to Open Items — do not implement LITE in this run unless trivial alongside limahoya BOM wiring.

2. **Uncommitted limahoya + BECAM work** — [CONFIRMED: `git status` 2026-06-23] Branch `claude/fix-ml-questions-shape` has local edits to `constants.js`, `matrizPreciosMapping.js`, `server/routes/bmcDashboard.js` (LIHO3MAL/LIHO3MPP + BECAM tab). Include in first commit of this run or re-apply if lost.

# Context

Calculadora BMC (`~/calculadora-bmc`, v3.1.5) is a React 18 + Vite 7 SPA with Express 5 API. The **roof multizona stack already exists**: geometric encounter detection (`src/utils/roofPlanGeometry.js`), encounter state machine with 4 modes (`src/utils/roofEncounterModel.js`: continuo / pretil / cumbrera / desnivel), segment-level BOM toggles (`preview.encounterByPair.segments[]`), 2D viewer (`src/components/RoofPreview.jsx`), and calc motor (`src/utils/calculations.js` → `calcTechoCompleto`).

The **product gap** (from operator sessions and audit) is not missing geometry — it is:

- **Sealants** still under-powered: `calcSelladoresTecho()` emits only silicona 600/300 + cinta butilo; never membrana or espuma PU by encounter type. `calcSelladoresTechoComercial()` uses a hardcoded kit (4+2+4) insufficient for real jobs.
- **Per-zone / per-faldón quotation** collapses in PDF/UI: `mergeZonaResults()` drops per-zone `largoPanel`; PDF template line 800 collapses to one "PANEL DE CUBIERTA · N unid · area m²".
- **Exterior perimeter encounters** (rasante, babeta-muro, limahoya, vuelo/gotero) and **accessory SKUs** need MATRIZ-backed catalog entries and BOM formulas — not just UI taxonomy.
- **Pricing source of truth** is the Google Sheet **MATRIZ de COSTOS y VENTAS 2026** (`BMC_MATRIZ_SHEET_ID` default `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo`), tabs **BROMYROS** (cols G/J/K/R/S) and **BECAM** (cols F/I/J/K/L). `constants.js` is cache only.

Limahoya catalog pricing (**LIHO3MAL / LIHO3MPP**) was added in the current session but **BOM auto-wiring for limahoya encounters is still pending**.

# Goal

Fully implement the roof encounter + sealant + per-zone quotation layer so a multizona techo quote shows **correct accessories and sealants per encounter type**, **per-zone panel lines in UI and PDF**, and **MATRIZ-verified SKUs/prices** — passing local gates without regressing existing multizona geometry tests.

- Wire **limahoya** (and exterior encounter types) from geometry → SKU resolution → BOM lines with linear quantity `L` (m).
- Replace/extend **selladores** engine: suggest quantities by encounter + allow manual override in wizard step `selladores` (preserve existing card UI pattern in `PanelinCalculadoraV3_backup.jsx`).
- Fix **per-zone merge/display**: preserve zone-level `cantPaneles`, `largoProyectado`, panel type/length in BOM groups, quotation preview, and PDF (`src/pdf-templates/bmc-pdf-template.html.js` + `buildQuotationModel` in `src/pdf-templates/index.js`).
- Complete **MATRIZ catalog gaps**: BBAL/BBEL (BROMYROS), verify PGLC100–250 / GLDCAM50/80 alignment; keep LIHO via BECAM tab in API CSV.
- Add/extend **offline tests** in `tests/validation.js` (or dedicated test file) for sealant formulas and per-zone BOM merge.
- Update **`docs/team/PROJECT-STATE.md`** "Cambios recientes" with evidence.

# Scope

**IN:**
- `src/utils/calculations.js` — sealant calc, per-zone merge, encounter-length-driven accessory qty
- `src/utils/roofEncounterModel.js` — additive encounter types / exterior segment helpers (do not break 4 existing modes)
- `src/utils/scenarioOrchestrator.js` — BOM assembly for encounters + sealants
- `src/utils/helpers.js` — `bomToGroups` / merge behavior for multizona
- `src/utils/quotationViews.js` — client visual HTML per-zone spec lines
- `src/pdf-templates/bmc-pdf-template.html.js`, `src/pdf-templates/index.js`, `src/pdf-templates/bmc-pdf.js` — per-zone panel rows
- `src/components/PanelinCalculadoraV3_backup.jsx` — selladores botonera/suggestions (extend existing step 11 pattern)
- `src/data/constants.js`, `src/data/matrizPreciosMapping.js` — SKUs/prices/paths
- `server/routes/bmcDashboard.js` — BECAM tab in `MATRIZ_TAB_COLUMNS` (if not merged)
- `tests/validation.js` (or new `tests/roofEncounters*.js`)
- `docs/team/ux-feedback/ROOF-ENCOUNTER-LOGIC-SPEC.md` — append implementation notes if behavior changes
- `docs/team/PROJECT-STATE.md` — one entry

**OUT:**
- Deploy to Vercel / Cloud Run (local gates only unless user explicitly asks ship)
- Editing master MATRIZ / BECAM sheet cells (read + map only; push-pricing-overrides only if user approves)
- Full refactor of `RoofPreview.jsx` 3D mesh / Shopify visor
- Limatesa (LITE3MAL/LITE3MPP) unless zero-cost alongside limahoya
- Anclajes/fijaciones comparative report (separate track D9)
- Auth / ML Manager / unrelated hub modules on current branch

# Inputs

- Repo root: `/Users/matias/calculadora-bmc` [CONFIRMED]
- Branch at prompt time: `claude/fix-ml-questions-shape` [CONFIRMED: git status 2026-06-23]
- Canonical calculator UI: `src/components/PanelinCalculadoraV3_backup.jsx` [CONFIRMED: CLAUDE.md]
- Calc re-export: `src/PanelinCalculadoraV3.jsx` [CONFIRMED]
- Encounter spec: `docs/team/ux-feedback/ROOF-ENCOUNTER-LOGIC-SPEC.md` [CONFIRMED]
- Taxonomy: `docs/team/ux-feedback/ROOF-ZONAS-PRINCIPAL-Y-ENCUENTROS-TAXONOMY.md` [INFERRED: exists per PROJECT-STATE | verify path]
- Calc techo doc: `docs/CALC-TECHO.md` [CONFIRMED: CLAUDE.md reference]
- MATRIZ hub: `docs/google-sheets-module/MATRIZ-PRECIOS-CALCULADORA.md` [CONFIRMED]
- MATRIZ sheet ID: `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` [CONFIRMED: skill + config default]
- Production API MATRIZ CSV: `GET https://panelin-calc-q74zutv7dq-uc.a.run.app/api/actualizar-precios-calculadora` [CONFIRMED: pulled 2026-06-23]
- Raw exports (local, regenerable): `.runtime/bromyros-raw.csv`, `.runtime/becam-raw.csv` [CONFIRMED: session artifacts]
- LIHO prices BECAM [CONFIRMED: BECAM rows LIHO3MAL/LIHO3MPP]:
  - LIHO3MAL: costo 14.35, venta 15.82, web 20.09, largo 3 m
  - LIHO3MPP: costo 18.60, venta 20.51, web 26.04, largo 3 m
- BBAL/BBEL BROMYROS [CONFIRMED]: BBAL 12.73/15.28/17.82; BBEL 11.19/13.43/15.67 (ex IVA)
- PGLC100–250 + GLDCAM50/80 [CONFIRMED: prod CSV aligned with constants]

# Tools & MCPs

- **Shell**: `npm run gate:local`, `npm run gate:local:full`, `node tests/validation.js`, `npm run matriz:pull-csv`, `curl localhost:3001/health`
- **Read/Grep/Edit**: primary — navigate `calculations.js`, `scenarioOrchestrator.js`, PDF templates
- **Browser MCP** (optional): spot-check wizard selladores step + PDF preview at `http://localhost:5173` after `npm run dev:full`
- **Google Sheets**: via API route only — do not use Drive MCP to edit MATRIZ
- Tools NOT needed: deploy MCP, Shopify, MercadoLibre

# Constraints & Guardrails

- DO NOT treat `src/data/constants.js` as pricing source of truth — always triangulate with MATRIZ CSV or BROMYROS/BECAM export [CONFIRMED: user mandate]
- DO NOT hardcode sheet IDs or production URLs in new code — use `server/config.js` / env [CONFIRMED: AGENTS.md]
- DO NOT break existing 4 encounter modes or `preview.encounterByPair` shape — extend additively [CONFIRMED: ROOF-ENCOUNTER-LOGIC-SPEC]
- DO NOT use `npm audit fix --force` [CONFIRMED: AGENTS.md]
- DO NOT refactor `PanelinCalculadoraV3_backup.jsx` naming away — it is canonical [CONFIRMED: CLAUDE.md]
- DO NOT return HTTP 500 for Sheets failures — 503 or 200 empty [CONFIRMED: API convention]
- DO run `npm run lint` after `src/` edits and `npm test` before declaring done [CONFIRMED: AGENTS.md]
- DO preserve ES module `import`/`export` only in server and src [CONFIRMED]
- Read-only: fiscal tabs, parámetros, automation tabs in MATRIZ — no sheet writes without explicit user approval
- All money in catalog/BOM: **USD ex IVA**; IVA applied once at total via existing `calcTotalesSinIVA` [CONFIRMED: CLAUDE.md]

# Anti-patterns

- DO NOT greenfield a second encounter model — `roofEncounterModel.js` + `roofPlanGeometry.js` already exist; extend them [CONFIRMED: audit lesson from prior session]
- DO NOT map MATRIZ rows by row number without SKU col D validation — duplicate SKUs exist (GLDCAM80, CD80, etc.) [CONFIRMED: BUG-TRIAGE-RAMIRO.md]
- DO NOT collapse multizona BOM to a single panel line in PDF when `q.zonas.length > 1` [CONFIRMED: gap identified in bmc-pdf-template.html.js ~L800]
- DO NOT emit membrana/espuma from `calcSelladoresTechoComercial` hardcoded kit only — wire encounter-driven formulas [CONFIRMED: calculations.js gap]
- DO NOT invent GLDCAM30 or LIHO SKUs — GLDCAM30 absent; LIHO only AL/PP variants above [CONFIRMED: MATRIZ export]
- DO NOT skip `mergeZonaResults` fix while only patching PDF — UI and BOM will stay inconsistent [INFERRED: shared root cause]
- DO NOT commit `.env` or credentials [CONFIRMED]

# Deliverables

- **Code** (atomic commits, English messages `feat:` / `fix:`):
  - Sealant + encounter BOM logic in `src/utils/calculations.js` and/or new `src/utils/roofSealantCalc.js` if file size demands
  - Per-zone merge fix in `mergeZonaResults` / `helpers.js` / `scenarioOrchestrator.js`
  - PDF + quotation view per-zone lines in `src/pdf-templates/*` and `src/utils/quotationViews.js`
  - Catalog: `PERFIL_TECHO.limahoya.*` BOM resolver; BBAL/BBEL paths; BECAM tab if missing
  - UI: selladores suggestions + manual override in `PanelinCalculadoraV3_backup.jsx`
- **Tests**: new assertions in `tests/validation.js` or `tests/roofEncountersSealants.test.js` — at minimum: limahoya qty from length L, multizona zone rows not collapsed, sealant kit includes membrana when babeta-muro encounter flagged
- **Docs**: one bullet block in `docs/team/PROJECT-STATE.md` "Cambios recientes"
- **Optional handoff**: `docs/team/HANDOFF-roof-encounters-full-implement-YYYY-MM-DD.md` if any decision remains `duda abierta`

# Success Criteria

- `npm run gate:local` exits 0 (lint + test + test:api offline) [CONFIRMED: standard gate]
- `npm run gate:local:full` exits 0 if PDF/build templates touched [INFERRED: build validates Vite bundle]
- Offline test case: **2-zone techo** with shared limahoya encounter produces BOM line with SKU LIHO3MAL or LIHO3MPP (by acabado), qty = `ceil(L / 3)` bars or documented formula [INFERRED: standard bar length 3 m]
- Offline test case: multizona result object retains per-zone `cantPaneles` and length metadata (not `largoPanel: undefined` only) [CONFIRMED: mergeZonaResults gap]
- Generated PDF HTML (via `npm run smoke:bmc-pdf` or model builder) shows **one panel spec row per zone** when `zonas.length > 1` [CONFIRMED: user requirement]
- Selladores step shows suggested silicona + membrana + espuma quantities when babeta/cumbrera encounters present; toggling off excludes from BOM [INFERRED: UX spec from session]
- `grep LIHO3MAL src/data/matrizPreciosMapping.js` and BECAM in `MATRIZ_TAB_COLUMNS` — present [CONFIRMED: partial done]
- `npm run matriz:pull-csv` (API up) includes LIHO rows with tab=BECAM [INFERRED: after BECAM tab merge]
- No regression: existing SUITE 32b encounter segment tests in `tests/validation.js` still pass [CONFIRMED: PROJECT-STATE 2026-04-15]

# Operational Anchors

- Source hierarchy: MATRIZ planilla (BROMYROS + BECAM) > repo `constants.js` cache > docs (`CALC-TECHO.md`, `ROOF-ENCOUNTER-LOGIC-SPEC.md`) > stale dashboards
- State labeling in commit messages and PROJECT-STATE: `hecho confirmado` / `inferencia` / `duda abierta`
- Triangulation before any price change: BROMYROS/BECAM export → prod CSV → constants path → test golden case
- Column map BROMYROS: G=costo, J=venta ex IVA, R=web ex IVA, S=web c/IVA [CONFIRMED: bmcDashboard.js 2026-06]
- Column map BECAM: F=costo, I=venta ex IVA, K=web ex IVA, L=web c/IVA [CONFIRMED: session export]
- Implementation strategy: **additive** — new encounter types as extensions to exterior segment BOM in `buildEdgeBOM` / orchestrator, not replacement of `encounterByPair` [CONFIRMED: prior architectural decision]

# Implementation Phases (executor order)

## Phase 0 — Baseline (read-only, ≤30 min)

1. Read `docs/team/ux-feedback/ROOF-ENCOUNTER-LOGIC-SPEC.md`, `docs/CALC-TECHO.md`, `calcSelladoresTecho` + `mergeZonaResults` in `calculations.js`.
2. Confirm uncommitted limahoya/BECAM diff; commit as `feat: matriz BECAM tab + limahoya catalog (LIHO3MAL/LIHO3MPP)` if still unstaged.
3. Run `npm run gate:local` — fix pre-existing failures on branch before feature work.

## Phase 1 — Catalog & MATRIZ (pricing foundation)

1. Add `BBAL` → `PERFIL_TECHO.babeta_adosar_lateral.ISOROOF._all` (or reuse lateral path naming consistent with constants structure) and `BBEL` → lateral empotrar; mirror ISODEC 6828/6865 price equivalence [CONFIRMED: same numbers in MATRIZ].
2. Ensure `PGLC100–250` SKUs in constants match mapping (fix `GLDCAM100` mislabel on ISODEC.100 if still wrong) [CONFIRMED: naming collision in session].
3. Verify BECAM tab in `MATRIZ_TAB_COLUMNS`; run `npm run matriz:pull-csv` with local API.

## Phase 2 — Encounter → accessory BOM

1. Define encounter type → SKU map (cumbrera, babeta sup/lat, limahoya, gotero/vuelo, rasante) using `PERFIL_TECHO` + new `limahoya` paths; limahoya acabado AL vs PP from panel color/finish rule [ASSUMPTION: PP default for prepintado panels | document rule in code comment].
2. Compute linear length `L` per encounter from existing geometry (`findEncounters`, segment t0/t1) [CONFIRMED: roofPlanGeometry.js].
3. Emit perfilería BOM lines with `cant = ceil(L / largo_barra)`; dedupe by SKU in merge step.
4. Wire limahoya when encounter mode or exterior edge type indicates valley (limahoya) — align with taxonomy doc.

## Phase 3 — Sealants engine + UI

1. Create encounter-aware sealant rules (minimum set from session):
   - Silicona: perimeter + encounter joints (existing ratios in `dimensioningFormulas.js` / `SELLADORES_TECHO`)
   - Membrana autoadhesiva: babeta-muro / pretil encounters [INFERRED: product requirement | basis: session gap analysis]
   - Espuma PU: babeta/cumbrera joints [INFERRED: same]
2. Deprecate or gate `calcSelladoresTechoComercial` hardcoded kit behind feature flag or replace with computed kit [INFERRED: cleaner long-term].
3. Extend selladores wizard cards to show suggested vs selected; `excludedItems` pattern already exists [CONFIRMED: PROJECT-STATE 2026-04-09].

## Phase 4 — Per-zone quotation display

1. Fix `mergeZonaResults` to retain array `zonaResults[]` or `byZone` map for display while keeping aggregated totals [CONFIRMED: gap].
2. Update `bomToGroups` labels: `· N paneles × L m` per zone where data exists.
3. PDF: expand section ① / zone appendix so each faldón/zona shows panel type, qty, length, m² — use `q.zonas` + `zoneRows` in `buildQuotationModel` [CONFIRMED: bmc-pdf.js partial support].

## Phase 5 — Verify & document

1. `npm run gate:local:full`
2. `npm run smoke:bmc-pdf` if API available
3. PROJECT-STATE entry + short HANDOFF if blockers remain

# Open Items

- [ASSUMPTION: Limahoya acabado selection rule = PP when panel color is prepintado/teja, else AL | verify before executing — add unit test]
- [ASSUMPTION: Sealant coverage rates (m per tube / m per roll) live in `SELLADORES` / `SELLADORES_TECHO` in constants | verify `metros_cobertura_por_unid` before qty formulas]
- [ASSUMPTION: Executor may split PR into 2–3 commits (catalog → BOM → PDF/UI) | acceptable]
- [ASSUMPTION: Branch `claude/fix-ml-questions-shape` is the working branch | user may want feature branch — confirm only if push/PR requested]
- [CONFIRMED: Limahoya catalog pricing closed — user said "con limahoya estamos ok"]
- [duda abierta: Exact silicone double-meterage rule for cumbrera vs babeta — implement from ROOF-ENCOUNTER session formulas if documented in transcript/docs; else use conservative default and flag]
