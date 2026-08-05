# HANDOFF — WA Media Richness 100% (shipped)

**Date:** 2026-08-05  
**Status:** **SHIPPED to main + prod**

| Item | Value |
|------|--------|
| PR | [#847](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/847) **MERGED** |
| Merge SHA | `ff312646` |
| Cloud Run rev | `panelin-calc-00934-lp5` |
| Deploy run | [30988402352](https://github.com/matiasportugau-ui/Calculadora-BMC/actions/runs/30988402352) success |

## Prod acceptance (post-deploy)

| Check | Result |
|-------|--------|
| health | 200 |
| media unauth | **401** (route exists; not 404) |
| media auth (Deli) | **302** signed redirect |
| junk upload magic | **400** `not_audio_junk` |

## Residual (not ship blockers)

- G8 real Spanish STT needs operator play-in-WA for Ogg bytes (CDN 410 historical)
- Extension Mode C polish / Mode O out of scope

## Ship path used (BMC-safe)

branch → PR → green required CI (Lint/Validate/Env drift) → merge → `deploy-calc-api` workflow_run → curl verify. No dirty-tree deploy.
