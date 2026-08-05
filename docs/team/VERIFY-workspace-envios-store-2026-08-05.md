# Verification procedure — Workspace store + SPA + Envíos FSM/DnD

**Status (2026-08-05):** **FULL PASS · persisted on main** (#875 / `6537cae0`)  
**Filled run:** [`VERIFY-MANUAL-RUN-2026-08-05_054026.md`](./VERIFY-MANUAL-RUN-2026-08-05_054026.md) · Overall **PASS**  
**Closeout:** [`HANDOFF-2026-08-05-verify-workspace-envios-complete.md`](./HANDOFF-2026-08-05-verify-workspace-envios-complete.md)

## Quick start

```bash
cd ~/calculadora-bmc
git checkout main && git pull

# Unit + optional prod curls
PROD=1 npm run verify:workspace-envios

# Dual Logística browser (L1–L7) — Vite on :5173 recommended for ?e2e=1 hook
RUNS=2 LOGISTICA_URL=http://127.0.0.1:5173/logistica npm run verify:logistica-dual

# Store SPA CRUD (API :3001 + SPA :3100 with NEXT_PUBLIC_BMC_API_BASE)
BMC_API_BASE=http://127.0.0.1:3001 \
STORE_URL=http://127.0.0.1:3100/workspace/store \
  npm run verify:store-spa-local

# Human checklist launcher
npm run verify:manual-workspace-envios
```

| Artifact | Path |
|----------|------|
| Filled run (PASS) | `docs/team/VERIFY-MANUAL-RUN-2026-08-05_054026.md` |
| Dual Logística e2e | `scripts/e2e-prod-logistica-dual.mjs` |
| Store SPA e2e | `scripts/e2e-store-spa-local.mjs` |
| Auto script | `docs/team/scripts/verify-workspace-envios-store.sh` |
| Manual launcher | `docs/team/scripts/manual-verify-workspace-envios.sh` |

## Scope covered

| Area | Result |
|------|--------|
| Store API (#831) | Prod health 200; routes auth-gated |
| Envíos U1/U2 (#832) + FSM/DnD (#857) | Dual L1–L7 PASS |
| SPA store wire (Panelin-Workspace #4) | S0–S6 PASS (local full stack) |
| CORS | `:3100` + `panelin-workspace.vercel.app` |

## Residual (optional, not blocking PASS)

- Vercel Panelin-Workspace: `NEXT_PUBLIC_BMC_API_BASE=https://calculadora-bmc.vercel.app` for cloud SPA CRUD without local API.