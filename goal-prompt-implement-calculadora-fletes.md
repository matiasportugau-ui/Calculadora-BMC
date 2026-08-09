# Role

You are a senior Calculadora BMC engineer implementing the freight (flete) quotation engine and wizard UX defined in the approved SDD. You write pure JS + React against the existing Vite/Express stack, reuse `/logistica` packing, and ship offline tests. You do not deploy unless explicitly asked.

# Context

[CONFIRMED: Spec lives at `docs/team/SDD-CALCULADORA-FLETES.md` v0.2 (2026-07-17), from interview cases 1–32.]
[CONFIRMED: Wizard freight step is still manual today — `flete` + `fleteCosto` state in `src/components/PanelinCalculadoraV3_backup.jsx`; PDF/BOM already emit a single SERVICIOS line `FLETE` with `pu/total = flete`.]
[CONFIRMED: Legacy catalog price `SERVICIOS.flete` in `src/data/constants.js` is venta 240 / web 252 / costo 180 — not the new zone engine.]
[CONFIRMED: Config already has `fleteDefault` ≈ 280 in `src/components/ConfigPanel.jsx`.]
[CONFIRMED: Logistics packing surface exists: `src/utils/bmcLogisticaCargo.js`, `src/utils/logistica/loadCharacteristics.js`, `src/components/BmcLogisticaApp.jsx`, route `/logistica`.]
[CONFIRMED: Active branch context when this prompt was built: `feat/finanzas-password-gate` — create/switch to a dedicated feature branch before coding unless user already did.]
[INFERRED: Primary goal is **implement SDD delivery phases P0→P3** (engine + UI + packing wire + FX), not redesign PDF | basis: SDD DoD + UX decisions.]
[CONFIRMED: No live BROU FX helper found under a clear `brou` rate API for UYU→USD in calc UI; banco parsers use BROU for statements only — FX integration may need a small new fetch/cache or reuse an existing FX util if discovered during triangulation.]

# Goal

Implement v1 **Cotizar flete** so the Flete wizard step (10/11) can auto-suggest USD sale + internal cost from project destination + panel BOM + `/logistica` packing, while keeping current manual fields and PDF line `Flete — USD X` unchanged in shape.

- Add `TARIFAS_LOGISTICAS` (or equivalent clearly named block) in `src/data/constants.js` per SDD §7.9.
- Implement pure `fleteEngine` (zone classify → pack → tariff → integer USD) with unit tests covering SDD DoD cases.
- Wire UI: keep existing FLETE / costo interno inputs; add **Cotizar flete** that prefills both and shows an operator summary (zone, rows A/B, vehicle class).
- Sync destination: project data ↔ address entry on Flete step.
- Reuse `/logistica` packing library (do not fork stacking rules); align ISOROOF inverted pairs and package counts.
- Convert UYU costs/sales with BROU-of-the-day FX to integer USD; degrade to manual if FX unavailable.
- Update `docs/team/PROJECT-STATE.md` Cambios recientes when behavior ships; keep SDD open questions listed, do not invent answers.

# Scope

IN:
- `TARIFAS_LOGISTICAS` + pure freight engine + tests
- Wizard Flete step UX: Cotizar flete + summary + editable prefills
- Shared use of logistics packing (`bmcLogisticaCargo` / logistica utils)
- Zone rules: retiro, ciudad_costa, mvd, canelones, maldonado_corredor, especial (manual)
- Agent `setFlete` remains compatible (numeric USD sale)

OUT:
- Admin UI / Google Sheet tariff editor
- Auto-pricing for far interior (especial stays manual)
- Crane / wait / weekend surcharges
- Freight-only accessory loads (panels-first)
- PDF breakdown of freight (client still sees single amount)
- Production deploy / Cloud Run / Vercel (unless user later asks)
- Changing IVA model (freight remains pre-VAT USD in totals as today)

# Inputs

- [CONFIRMED] Spec: `docs/team/SDD-CALCULADORA-FLETES.md`
- [CONFIRMED] Wizard: `src/components/PanelinCalculadoraV3_backup.jsx` (`flete`, `fleteCosto`, `proyecto`, BOM/`results`)
- [CONFIRMED] Prices/services: `src/data/constants.js` (`SERVICIOS.flete`)
- [CONFIRMED] Logistics packing: `src/utils/bmcLogisticaCargo.js`, `src/utils/logistica/loadCharacteristics.js`, `src/components/BmcLogisticaApp.jsx`
- [CONFIRMED] Config default: `src/components/ConfigPanel.jsx` (`fleteDefault`)
- [CONFIRMED] Calc API still accepts body `flete` number: `server/routes/calc.js` — keep contract
- [CONFIRMED] Agent tool `setFlete`: `server/routes/agentVoice.js`, `server/lib/agentTools.js`
- [INFERRED] New module path: `src/utils/fleteEngine.js` (or `src/utils/fletes/*`) | basis: SDD container view
- [ASSUMPTION: BROU FX source for browser/API | verify before executing] — discover existing FX util or add minimal cached fetch; do not hardcode a fake rate silently
- Repo root: `/Users/matias/calculadora-bmc`

# Tools & MCPs

- Bash / Read / Edit / Grep / Glob: required for code + tests
- `node tests/<new>.js` (standalone test style of this repo) + `npm run lint` on `src/` touches
- Prefer `npm run gate:local` before claiming done if changes span engine + UI
- Browser / Playwright: optional smoke of wizard step only if local stack already up (`:5173` / `:3001`)
- Tools NOT needed: Vercel deploy MCP, Sheets MCP, Shopify, fiscal DGI tools

# Constraints & Guardrails

- DO implement against SDD as source of truth; if code and SDD conflict on height, surface conflict (logistics `MAX_H = 2.5` vs SDD legal **2.4 m**) and prefer **2.4 m** for freight capacity unless packing lib cannot without larger refactor — document choice in PROJECT-STATE.
- DO keep Flete step layout; only add Cotizar flete + compact summary.
- DO leave sale/cost fields editable after quote.
- DO round final USD amounts to integers.
- DO compute `%` base as **full quotation without freight line** (`max(zoneMin, 10% * cotizacionSinFlete)` for MVD/Canelones).
- DO NOT hardcode sheet IDs, tokens, or prod URLs.
- DO NOT use `npm audit fix --force`.
- DO NOT invent tariff numbers beyond SDD §7; mark TBD open questions as especial/manual.
- DO NOT change PDF to show freight breakdown.
- DO NOT commit unless the user explicitly asks.
- DO update `docs/team/PROJECT-STATE.md` Cambios recientes when feature lands in the working tree.
- ES modules only (`import`/`export`).

# Anti-patterns

- DO NOT duplicate a second packing engine with different stack math than `/logistica`.
- DO NOT treat `SERVICIOS.flete` 240/252 as the new zone engine (legacy catalog; new block is `TARIFAS_LOGISTICAS`).
- DO NOT double-count freight in BOM groups (existing code already special-cases `flete: 0` in some paths — preserve).
- DO NOT put circular dependency where freight % includes the freight line itself.
- DO NOT use `require()`.
- DO NOT treat zombie services or unrelated Cloud Run names as part of this feature.
- DO NOT rewrite the entire wizard for this feature.

# Deliverables

1. `src/data/constants.js` — `TARIFAS_LOGISTICAS` block (well labeled, easy to edit)
2. `src/utils/fleteEngine.js` (or `src/utils/fletes/*`) — zone + tariff + FX glue; packing via shared logistica utils
3. `tests/fleteEngine.test.js` (or similar) — offline cases from SDD DoD
4. UI in `PanelinCalculadoraV3_backup.jsx` (and any small presentational extract if needed): button **Cotizar flete**, summary, prefills `flete` + `fleteCosto`
5. Destination sync: project address/depto ↔ Flete step input
6. `docs/team/PROJECT-STATE.md` — Cambios recientes entry
7. Optional short note in SDD changelog if implementation decisions close an open question (only if verified)

# Success Criteria

- [ ] Retiro planta → sale USD 0
- [ ] Maldonado corridor, ≤8 m, 1 row → sale USD 280
- [ ] Ciudad de la Costa, ≤8 m, 1 row → sale USD 252
- [ ] Maldonado corridor, ≤8 m, 2 rows → sale = round((18000+3000)/BROU) integer USD; cost prefilled from 18000/BROU
- [ ] Panels >8 m → remolque sale from UYU 28000 / BROU; cost from UYU 24000 / BROU
- [ ] 12–14 m truck on corridor → ≈ USD 650 sale
- [ ] MVD → `max(150, round(0.10 * quoteWithoutFreight))`
- [ ] Canelones (non-Costa) → `max(220, round(0.10 * quoteWithoutFreight))`
- [ ] Far interior / unknown → especial: no invented auto price; operator keeps manual
- [ ] Cotizar flete shows summary (zone / rows / vehicle) and prefills editable fields
- [ ] PDF/BOM still a single FLETE money line (no breakdown)
- [ ] Offline unit tests green for the above; `npm run lint` clean on touched `src/`
- [ ] PROJECT-STATE updated

# Operational Anchors

- Source hierarchy: SDD (business rules) > current repo packing (`/logistica`) > legacy `SERVICIOS.flete` docs. Never invent tariffs.
- State labeling: mark unresolved map-of-localities / Costa scaling for full truck as `duda abierta` if not in SDD.
- Triangulation: SDD → `bmcLogisticaCargo` / loadCharacteristics → wizard flete state → consolidate.
- Read-only: do not edit master price sheets or fiscal modules for this task.
- If packing export surface is insufficient for freight (e.g. only UI-bound), extract a pure function used by both Logistica and fleteEngine rather than importing React components.

# Open Items

- [ASSUMPTION: Ciudad de la Costa −10% applies only to 1-row USD 280 case in v1; full-truck/remolque/12–14 m for Costa follow Maldonado UYU math or especial | verify before executing — SDD §14 Q1]
- [ASSUMPTION: Locality→zone map can start with department/heuristics + `proyecto.direccion` string matching; exhaustive locality list not in SDD | verify before executing]
- [ASSUMPTION: BROU FX endpoint/helper will be discovered or a thin client added with cache + manual fallback | verify before executing]
- [ASSUMPTION: Legal stack height for freight is 2.4 m even if logistics `MAX_H` is 2.5 | verify before executing — reconcile with packing lib]
- [ASSUMPTION: Cost UYU for 12–14 m truck unknown; only sale ≈650 — leave cost empty or especial | verify before executing]
- [ASSUMPTION: Feature branch name e.g. `feat/calculadora-fletes` from current base | verify before executing]

# Suggested execution order

1. Read SDD end-to-end + inventory packing exports.
2. Add `TARIFAS_LOGISTICAS` + pure engine + tests (P0) with mocked FX.
3. Wire Cotizar flete UI + summary + destination sync (P1).
4. Connect real packing (P2); reconcile 2.4 vs 2.5.
5. Wire BROU FX + cost prefill (P3); degrade gracefully.
6. Lint/tests + PROJECT-STATE; stop (no commit/PR unless asked).
