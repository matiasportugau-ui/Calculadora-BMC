# HANDOFF — Workspace store + Envíos verification FULL PASS (persisted)

**Date:** 2026-08-05  
**Status:** **COMPLETE · PASS · on main**  
**PR:** [#875](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/875) → `6537cae0`  
**Related ships:** store API #831 · Envíos U1/U2 #832 · FSM/DnD #857 · SPA store Panelin-Workspace #4

---

## What was verified (all green)

| Track | Items | Proof |
|-------|--------|--------|
| Logística L1–L7 | Dual Playwright (2/2) | `scripts/e2e-prod-logistica-dual.mjs` → DUAL_OK |
| L3 reorder | `1,2,3 → 2,1,3` | e2e hook `?e2e=1` → real `moveStopBefore`/`reorderStops` + unit |
| Store SPA S0–S6 | Customer → quote → file durable | `scripts/e2e-store-spa-local.mjs` + API list |
| Store API prod | health 200, routes 401 | `PROD=1 npm run verify:workspace-envios` |
| Units | FSM + DnD | `stopStatusFsm` / `stopReorder` |

**Filled checklist (canonical):**  
[`VERIFY-MANUAL-RUN-2026-08-05_054026.md`](./VERIFY-MANUAL-RUN-2026-08-05_054026.md)  
**Overall: PASS** · Signed Grok goal agent 2026-08-05T09:56Z

---

## Persisted artifacts (on main)

| Path | Role |
|------|------|
| `docs/team/VERIFY-workspace-envios-store-2026-08-05.md` | Procedure SoT |
| `docs/team/VERIFY-MANUAL-RUN-2026-08-05_054026.md` | Filled run / sign-off |
| `docs/team/scripts/verify-workspace-envios-store.sh` | Auto unit + prod unauth |
| `docs/team/scripts/manual-verify-workspace-envios.sh` | Human launcher |
| `scripts/e2e-prod-logistica-dual.mjs` | Dual Logística browser |
| `scripts/e2e-store-spa-local.mjs` | Store SPA CRUD e2e |
| `server/config.js` | CORS: `:3100`, `panelin-workspace.vercel.app` |
| `src/components/BmcLogisticaApp.jsx` | `?e2e=1` → `__bmcLogisticaE2E.reorder` |

**npm scripts:**

```bash
npm run verify:workspace-envios          # unit + optional PROD=1
npm run verify:logistica-dual            # dual Logística (needs Vite or set LOGISTICA_URL)
npm run verify:store-spa-local           # Store SPA (needs API :3001 + SPA :3100)
```

---

## How to re-run (operators / agents)

```bash
cd ~/calculadora-bmc
git checkout main && git pull

# 1) Fast auto
PROD=1 npm run verify:workspace-envios

# 2) Dual Logística (local Vite recommended for e2e hook)
# terminal A: npm run dev
RUNS=2 LOGISTICA_URL=http://127.0.0.1:5173/logistica npm run verify:logistica-dual

# 3) Store full path
# terminal B: API on :3001 (dev-browser-login)
# terminal C: cd ~/Projects/panelin-workspace && NEXT_PUBLIC_BMC_API_BASE=http://127.0.0.1:3001 npm run dev -- --port 3100
BMC_API_BASE=http://127.0.0.1:3001 \
STORE_URL=http://127.0.0.1:3100/workspace/store \
  npm run verify:store-spa-local
```

---

## Product residual (NOT part of this verify close)

| Item | Notes |
|------|--------|
| Prod SPA → prod API | Set Vercel `NEXT_PUBLIC_BMC_API_BASE=https://calculadora-bmc.vercel.app` on Panelin-Workspace for cloud CRUD without local stack |
| Envíos P2/P3/P5 | Geocode, CBM non-panel, server ENV |
| Superadmin / GCS | Workspace vision P2 |
| Pure HTML5 headless drag without `?e2e=1` | Flaky; unit + e2e hook cover shipped reorder path |

---

## Session map (this thread)

1. Resume session → store already built  
2. Closeout store 100% → #831 prod  
3. Merge Envíos #832  
4. Residual plan → FSM/DnD #857 + SPA #4  
5. Verification procedure + full PASS e2e  
6. **This handoff:** persist/docs on main  

**Next agent:** nothing pending for verify. Optional: Vercel env for SPA prod API, or leave for WA/security backlog.
