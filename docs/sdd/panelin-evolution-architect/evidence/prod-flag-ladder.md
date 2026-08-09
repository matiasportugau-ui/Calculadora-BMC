# Prod flag ladder — PEA oleadas 3 & 7

Conservative prod flip order. **Never skip steps.**

## Oleada 3 — L0–L2 observe (mock architect)

Apply migrations first: `node scripts/pea-apply-migration.mjs` (prod `DATABASE_URL`, snapshot backup).

| Variable | Value |
|----------|-------|
| `PEA_ENABLED` | `1` |
| `PEA_WORKER_ENABLED` | `1` |
| `PEA_AUTO_DIAGNOSE` | `0` |
| `PEA_ARCHITECT_MOCK` | `1` |
| `PEA_RATCHET_REQUIRED` | `1` |
| `PEA_IMPLEMENT_ENABLED` | `0` |
| `PEA_SIDE_EFFECT_ENFORCE` | `0` |
| `PEA_DOOM_LOOP_GUARD` | `1` |

Verify: `/hub/pea`, `npm run smoke:prod`, update `live-probe.md`.

## Oleada 7 — progressive autonomy

| Step | Change | Prerequisite |
|------|--------|--------------|
| 7a | `PEA_ARCHITECT_MOCK=0` | Staging LLM green ≥7 days |
| 7b | `PEA_AUTO_DIAGNOSE=1` + budget cap | p50 GapEvent→packet OK |
| 7c | `PEA_SIDE_EFFECT_ENFORCE=1` | bmc-security sign-off |
| 7d | L3 prod implement | **Not recommended** until staging native E2E ≥3 |

Set GitHub vars in `.github/workflows/deploy-calc-api.yml` (already wired); redeploy Cloud Run after each step.

## Rollback

Set `PEA_ENABLED=0` + redeploy. Schema remains; no data loss on gaps table.
