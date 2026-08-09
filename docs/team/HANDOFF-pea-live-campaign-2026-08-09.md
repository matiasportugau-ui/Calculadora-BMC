# PEA live campaign — handoff (oleada 0 complete)

**Date:** 2026-08-09  
**Branch:** `fix/logistica-csp-adjunto-connect-src` (merge PEA work via dedicated PR recommended)

## Completed in repo (agent)

- Oleada 0: `test:pea` in gate:local + CI; contract validator PEA routes; deploy/env PEA vars
- Code: `architectLlm.js`, `nativeAdapter.js`, `piiDenylist.js`, `pea-live-probe.mjs`
- Docs: RECREATION as-built, SDD Appendix C, GAP-PLAN G-10 closed, ADR-012, runbooks, 9 goal-prompts

## Human next (blocking prod)

1. **Phase 1:** Run `npm run pea:live-probe` against prod; fill `live-probe.md`
2. **Phase 2:** Provision staging per `staging-topology-runbook.md`
3. **Phase 3:** Prod migrate + conservative flags per `prod-flag-ladder.md`

## Commands

```bash
npm run gate:local:full
npm run test:pea
DATABASE_URL=... node scripts/pea-apply-migration.mjs
```

## Goal prompt entry

`/goal` with `docs/team/goal-prompts/goal-prompt-pea-live-orchestrator.md`
