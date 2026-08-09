# G2 runtime as-built (post-implementation evidence)

**Date:** 2026-07-24 · Tags: CONFIRMED

| Capability | Status | Evidence |
|------------|--------|----------|
| Flags default OFF | CONFIRMED | `server/lib/paosConfig.js` — `PAOS_ENABLED`/`PAOS_PROMOTE` default false |
| Event ledger memory + PG | CONFIRMED | `server/lib/paosEventLedger.js`; migration `002_agent_events.sql` |
| Session emit → ledger | CONFIRMED | `trainingKB.appendTrainingSessionEvent` dynamic import paosEventLedger |
| Tool emit → ledger | CONFIRMED | `toolStats.recordToolCall` dynamic import |
| Candidate SM | CONFIRMED | `paosCandidateSm.js` — blocks drafted→active |
| Candidate store + dual-write | CONFIRMED | `paosCandidates.js`; migration `003_learning_candidates.sql` |
| Offline eval + money guard | CONFIRMED | `paosEvaluate.js` — requires calcProvenance for price-like deltas |
| Promote → Training KB | CONFIRMED | `paosPromote.js` — canary→pending, active→active permanent |
| Admin routes | CONFIRMED | `server/routes/paos.js` mounted `server/index.js` createPaosRouter |
| Workspace gate | CONFIRMED | `workspace.js` PAOS_ENABLED=1 → candidate, no silent active |
| Unit tests | CONFIRMED | `tests/paosCore.test.js`, `paosWorkspaceGate.test.js`, `paosPromote.test.js` |

## Still TARGET / P1 (not CONFIRMED product)

| Item | Note |
|------|------|
| Canary % in Fast Loop | Flag exists; not wired into retrieval |
| Full golden subprocess on evaluate | Offline structural/money only; CI goldens separate |
| Privacy redaction productization | Defaults only |
| Legal retention sign-off | Human |
