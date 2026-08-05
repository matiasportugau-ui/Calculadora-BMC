# Verification procedure — Workspace store + SPA + Envíos FSM/DnD

## Quick start

```bash
cd ~/calculadora-bmc

# Unit + optional prod curls
PROD=1 bash docs/team/scripts/verify-workspace-envios-store.sh

# Dual prod Logística browser (L1–L7)
SCRATCH=/tmp/e2e-out RUNS=2 node scripts/e2e-prod-logistica-dual.mjs

# Human checklist launcher
bash docs/team/scripts/manual-verify-workspace-envios.sh
```

| Artifact | Path |
|----------|------|
| Filled run | `docs/team/VERIFY-MANUAL-RUN-2026-08-05_054026.md` |
| Dual e2e | `scripts/e2e-prod-logistica-dual.mjs` |
| Auto script | `docs/team/scripts/verify-workspace-envios-store.sh` |
| Manual launcher | `docs/team/scripts/manual-verify-workspace-envios.sh` |

See filled checklist for latest PASS-with-notes results.
