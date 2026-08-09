# RECREATION-CHECKLIST — BMC Envíos

**System:** BMC Envíos (Quote Flete 10/11 + `/logistica`)  
**SDD:** [`SDD.md`](./SDD.md)  
**Last verified:** 2026-08-05 (glory re-audit F1–F6)  
**Scope:** Rebuild / operate **as-built** module inside `calculadora-bmc`. Residual OPEN: P3 CBM, P2b Matrix/TSP, P5b autosave (P2/P5 MVP shipped).

Legend: `[x]` done / verified · `[ ]` open · `N/A` justified

---

## 0. Prerequisites

- [x] Repo: `calculadora-bmc` (git root)
- [x] Node 24.x, `npm install` (or existing `node_modules`)
- [x] Secrets: Doppler `bmc-backend/prd` + `bmc-frontend/prd` **or** local `.env` for `dev:full`
- [x] Platform SDD available: `docs/sdd/calculadora-bmc/SDD.md` (deploy/auth SoT)

---

## 1. Local run

- [x] Start: `cd ~/calculadora-bmc && doppler run -- npm run dev:full`
- [x] Vite: `http://localhost:5173/`
- [x] API: `http://localhost:3001/`
- [x] Hard refresh after CSS changes: `Cmd+Shift+R`

---

## 2. Surfaces (as-built)

| Check | Status | How |
|-------|--------|-----|
| Ops shell loads | [x] | Open `/logistica` — class `envios-app`, header chrome |
| Quote panel in wizard | [x] | Calculator → scenario with Flete step → **Flete 10/11** · `FleteCotizarPanel` |
| Liquid Glass CSS loaded | [x] | `src/main.jsx` imports `bmc-glass.css` + `bmc-envios-glass.css` |
| Module nav | [x] | Link to Logística in `BmcModuleNav` |

---

## 3. Domain kernel (as-built)

| Check | Status | Evidence |
|-------|--------|----------|
| Tarifas block exists | [x] | `src/data/constants.js` `TARIFAS_LOGISTICAS` |
| Quote engine | [x] | `src/utils/fleteEngine.js` `quoteFreight` / `quoteFreightFromWizard` |
| Packing used by quote | [x] | `fleteEngine` → `cargoPacking` **column** engine |
| Packing used by ops | [x] | `BmcLogisticaApp` imports shared `placeCargo` **stack** engine (no local function) |
| FX helper | [x] | `brouFx.js` → `uy.dolarapi.com`, integer USD |
| Unit tests quote | [x] | `tests/fleteEngine.test.js` |
| Unit tests packing + bridge | [x] | `tests/cargoPacking.test.js`, `tests/bridgePayload.test.js` |

---

## 4. Design system

| Check | Status | Path |
|-------|--------|------|
| DESIGN-UI specs | [x] | `docs/sdd/bmc-envios/DESIGN-UI.md` |
| Tokens JS | [x] | `src/utils/enviosTheme.js` |
| Ops uses ENV_T | [x] | `BmcLogisticaApp` imports `ENV_T` |
| Quote uses CSS classes | [x] | `.envios-quote`, `.envios-summary`, `.envios-btn-primary` |
| Glass on chrome only | [x] | Spec: no blur on packing SVG / dense forms |

---

## 5. Integrations (as-built)

| Check | Status | Notes |
|-------|--------|-------|
| Ventas Sheets for ops | [x] partial | `GET /api/ventas?logistica=1` when credentials set |
| Auth for `/logistica` | [x] | Route under `Shell` **without** `RequireGrant` module gate (`App.jsx` ~451–458); session via platform cookie/dev-login |
| PDF extract (ops) | [x] optional | Prototype lib under `docs/.../logistica-carga-prototype` — Vite dynamic import warn OK |
| Maps / geocode MVP | [x] | `geocode.js` + Geocodificar button + POST `/api/envios/geocode` |
| Durable drafts P5 | [x] | Save/Load nube + `envios_drafts` + PUT/GET `/api/envios/drafts/:id` |
| Distance Matrix / TSP | N/A | Roadmap P2b |
| Autosave cloud | N/A | Roadmap P5b |

---

## 6. Deploy (inherits platform)

| Check | Status | Notes |
|-------|--------|-------|
| Frontend host | [x] | Vercel SPA — same project as calculadora |
| API host | [x] | Cloud Run `panelin-calc` |
| Prod ops URL | [x] | `https://calculadora-bmc.vercel.app/logistica` |
| Secrets names | [x] | Doppler/GSM — no values in SDD; see platform SDD |
| Envíos-only microservice | N/A | Intentionally none |

---

## 7. Product unification

| Check | Status | TARGET id |
|-------|--------|-----------|
| Single packing SoT | [x] **DONE** | U1 |
| Quote → ENV bridge | [x] **DONE** | U2 |
| Evidence zero dual placeCargo in app | [x] **DONE** | U1 |
| pickColumnRow 1-fila tariffs | [x] **DONE** | #840 |
| FSM guards enforced | [ ] **OPEN** | U3 |

---

## 7b. Ops UX Wave F1–F6 (as-built)

| Check | Status | Evidence |
|-------|--------|----------|
| F1 collapsible stops | [x] | `ui.collapsedStopIds`, chevron UI |
| F2 Ventas haystack + chips | [x] | `ventasSearch.js`, `coordinationStatus.js` |
| F3a stop reorder DnD | [x] | `stopReorder.js`, handle ⠿ |
| F3b Remito Simple + volumes | [x] | `remitoPackageMetrics.js`, `.remito-simple-page` |
| F4 3D labels + cabin | [x] | `sPed`/`sCli`, `LogisticaCargoScene3d` Html + TruckCabin |
| F5 fila A/B override | [x] | `packageDrop.js`, DiagramPanel buttons |
| F6 plan carga print | [x] | `loadPlanPrintModel.js`, Plan carga view |
| Pure tests in suite | [x] | nine envios-related `tests/*.test.js` |

---

## 8. Agent recreation test (doc pass)

- [x] Agent can state zone tariff table from SDD domain appendix without inventing rates  
- [x] Agent knows dual packing column/stack is intentional (ADR-001)  
- [x] Agent can run local verify commands from SDD §8  
- [x] Agent does not implement multi-modal CBM as Core  
- [x] Agent can list F1–F6 modules under `src/utils/logistica/`  

---

## Sign-off

| Role | Date | Note |
|------|------|------|
| sdd-evolution-loop | 2026-08-04 | Checklist created |
| glory re-audit | 2026-08-05 | F1–F6 + U1/U2 as-built; SDD v1.4 |
| Human | | Re-run envios unit tests after tariff edits |
