# HANDOFF — Workspace SPA wire + Envíos U3/DnD (single-run goal)

**Date:** 2026-08-05  
**Branches:** `feat/envios-u3-fsm-dnd` (calculadora-bmc) · panelin-workspace local changes (companion)

## Done

### Envíos (calculadora-bmc)

| Item | Path |
|------|------|
| DnD drag-down fix (#846 intent) | `src/utils/logistica/stopReorder.js` |
| Tests | `tests/stopReorder.test.js` (drag down + adjacent) |
| G-U3 FSM | `src/utils/logistica/stopStatusFsm.js` |
| UI wire | `BmcLogisticaApp.jsx` status select + disabled options |
| FSM tests | `tests/stopStatusFsm.test.js` |
| GAP-PLAN | G-U3 marked done |

### Workspace SPA (panelin-workspace)

| Item | Path |
|------|------|
| Types Customer/Quote | `src/lib/models/index.ts` |
| API list/create | `src/lib/bmc-bridge/workspaceApi.ts` |
| Zustand hydrate + create* | `src/lib/store/workspaceStore.ts` |
| UI MVP | `/workspace/store` · `StoreView.tsx` |
| Nav | AppSidebar “Store (clientes)” |

## Verify

```bash
cd ~/calculadora-bmc
node tests/stopReorder.test.js
node tests/stopStatusFsm.test.js
node --test tests/cargoPacking.test.js tests/bridgePayload.test.js

# SPA (manual / with BMC auth)
cd ~/Projects/panelin-workspace && npm run dev
# open /workspace/store → create customer → quote → file
```

## Non-goals (still open)

G-P5 server ENV · geocode · CBM non-panel · Superadmin · GCS upload · full mockup stepper/CR
