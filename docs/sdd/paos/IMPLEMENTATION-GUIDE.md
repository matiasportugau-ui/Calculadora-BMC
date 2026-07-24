# Implementation Guide — PAOS G2

Spec: SDD.md v1.0 Accepted · SDD-TARGET.md · ARCHITECT-FINAL.md  
Rule: /calc money SoT. No fine-tune. No silent active when PAOS_ENABLED=1.

## Build order

```text
IMP-PAOS-00  Spec Accepted                          [x]
IMP-PAOS-01  Event Ledger agent_events              [x]
IMP-PAOS-02  Learning Candidate SM + store          [x] memory + PG dual-write
IMP-PAOS-03  Eval on candidate                      [x] offline + money guard
IMP-PAOS-04  Promoter gate Workspace                [x] PAOS_ENABLED=1
IMP-PAOS-05  Promote → Training KB                  [x] PAOS_PROMOTE=1
IMP-PAOS-09  Vertical PoC runbook                   [x]
IMP-PAOS-06  Canary % in Fast Loop                  [ ] P1
IMP-PAOS-07  USER_OVERRIDE unified schema           [ ] P1
IMP-PAOS-08  Privacy redaction productization       [ ] P1
```

## Shipped modules

| Module | Path |
|--------|------|
| Flags | `server/lib/paosConfig.js` |
| Ledger | `server/lib/paosEventLedger.js` · `migrations/agent/002_agent_events.sql` |
| SM | `server/lib/paosCandidateSm.js` |
| Candidates | `server/lib/paosCandidates.js` · `003_learning_candidates.sql` |
| Offline eval | `server/lib/paosEvaluate.js` (money needs calcProvenance) |
| Promote → KB | `server/lib/paosPromote.js` (canary→pending, active→active permanent) |
| Routes | `server/routes/paos.js` |
| Workspace gate | `server/routes/workspace.js` |
| Emit hooks | `trainingKB.appendTrainingSessionEvent`, `toolStats.recordToolCall` |

## Flags (default OFF)

`PAOS_ENABLED=0` `PAOS_PROMOTE=0` `PAOS_CANARY_PCT=0` `PAOS_LEDGER_RETENTION_DAYS=90`

## Tests

```bash
node tests/paosCore.test.js
node tests/paosWorkspaceGate.test.js
node tests/paosPromote.test.js
node tests/paosSddScorecard.test.js
```

## Vertical PoC

```bash
export PAOS_ENABLED=1 PAOS_PROMOTE=1
# 1) POST /api/paos/candidates  { delta: { question, goodAnswer } }
# 2) POST /api/paos/candidates/:id/evaluate  (omit body → offline eval)
# 3) POST /api/paos/candidates/:id/approve { mode: "canary"|"active" }  # superadmin
# 4) canary → KB status pending; active → KB status active permanent
# Workspace CR + PAOS_ENABLED=1 → candidate, never silent active KB
```

## Remaining (optional P1)

- Canary % injection into Fast Loop retrieval
- Stronger USER_OVERRIDE schema unification
- Privacy redaction productization
- Full golden suite process spawn on evaluate (CI remains SoT for goldens)
