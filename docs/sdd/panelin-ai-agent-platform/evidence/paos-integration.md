# Evidence — PAOS platform integration

**Date:** 2026-07-26  
**Parent SDD:** `../SDD.md` §6.5 · ADR-008  
**Child Spec:** `../../paos/SDD.md`

## Prod probe

```bash
curl -sS "https://panelin-calc-q74zutv7dq-uc.a.run.app/api/paos/health"
```

**CONFIRMED response (2026-07-26):**

```json
{
  "ok": true,
  "paos": {
    "enabled": true,
    "promote": true,
    "canaryPct": 0,
    "ledgerRetentionDays": 90
  },
  "ledger": {
    "memoryCount": 1,
    "retentionDays": 90,
    "enabled": true
  }
}
```

## Code SoT (CONFIRMED)

| Module | Path |
|--------|------|
| Flags | `server/lib/paosConfig.js` |
| Candidates SM | `server/lib/paosCandidates.js` |
| Evaluate | `server/lib/paosEvaluate.js` |
| Promote → KB | `server/lib/paosPromote.js` |
| Ledger | `server/lib/paosEventLedger.js` |
| Routes | `server/routes/paos.js` |
| Tests | `tests/paos*.test.js` |

## Env names (values REDACTED)

`PAOS_ENABLED`, `PAOS_PROMOTE`, `PAOS_CANARY_PCT`, `PAOS_LEDGER_RETENTION_DAYS`

Code defaults: flags **OFF** if unset (`paosConfig.js`). Prod may set ON with canary 0.

## Auth

| Route | Gate |
|-------|------|
| `GET /api/paos/health` | public |
| `GET /api/paos/flags` | `requireUser` |
| candidates / events / metrics / promote | user / superadmin |

## Scope boundary

Platform SDD documents **integration only**. Full dual-loop design, IMP-PAOS-*, and child ADRs live under `docs/sdd/paos/`.
