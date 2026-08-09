# development-glory — PAOS

| Phase | Status |
|-------|--------|
| G0 Goal lock | Done |
| G1 Document | Done — SDD Accepted |
| G2 Implement | **Functional complete** (flags default OFF in code; prod env ON) |
| G3 Verify | Unit + e2e module suite green |
| G4 Score | **97 PASS** (re-audit; was 98 — G-DOC drift) |
| G5 | Docs closed |

## Functional loop (flags on)

create candidate → offline eval (money guard) → approve canary/active → Training KB entry; Workspace gate no silent active.

## Production — LIVE 2026-07-24

| Item | Status |
|------|--------|
| PR #777 | Merged to main |
| Image | `panelin-calc:48153e9d…` on rev **panelin-calc-00886-g5f** |
| Traffic | **100% LATEST** (was stuck on 00877 pre-PAOS) |
| Env | `PAOS_ENABLED=1` `PAOS_PROMOTE=1` `PAOS_CANARY_PCT=0` `PAOS_LEDGER_RETENTION_DAYS=90` |
| Probe | `GET /api/paos/health` → **200** `enabled:true` `promote:true` |

```json
{"ok":true,"paos":{"enabled":true,"promote":true,"canaryPct":0,"ledgerRetentionDays":90},"ledger":{"memoryCount":0,"retentionDays":90,"enabled":true}}
```

**Deploy note:** GHA `Deploy Calculator API` may still fail **post-deploy smoke** on `/api/crm/suggest-response` (AI provider quota/keys). That is unrelated to PAOS. After image push, confirm traffic is LATEST (`gcloud run services update-traffic panelin-calc --to-latest`) if health 404s while new revisions exist.
