# RECREATION-CHECKLIST — BMC Envíos

**System:** BMC Envíos (Quote Flete 10/11 + `/logistica`)  
**SDD:** [`SDD.md`](./SDD.md)  
**Last verified:** 2026-08-04 (evolution-loop iter 1)  
**Scope:** Rebuild / operate **as-built hybrid** module inside `calculadora-bmc`. Items marked **OPEN** are product backlog (U1/U2), not doc failures.

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
| Maps / geocode | N/A Core | Roadmap P2 |
| `/api/envios/*` HTTP | N/A | **NOT DEPLOYED** — OpenAPI sketch only |

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

## 7. Product unification (target — OPEN)

| Check | Status | TARGET id |
|-------|--------|-----------|
| Single packing SoT (ops uses `cargoPacking.js`) | [x] **DONE** | U1 |
| Quote → ENV bridge payload | [x] **DONE** | U2 |
| FSM guards enforced in UI | [ ] **OPEN** | U3 |
| Evidence of zero dual placeCargo | [x] **DONE** | U1 verify |

These OPEN items **do not** block reading/operating as-built; they block “fully unified product recreation.”

---

## 8. Agent recreation test (doc pass)

- [x] Agent can state zone tariff table from Appendix A without inventing rates  
- [x] Agent knows dual packing risk and U1  
- [x] Agent can run local verify commands from SDD §8  
- [x] Agent does not implement multi-modal CBM as Core  

---

## Sign-off

| Role | Date | Note |
|------|------|------|
| sdd-evolution-loop | 2026-08-04 | Checklist created; as-built verified via path:line evidence |
| Human | | Re-run `npm test -- fleteEngine` after tariff edits |
