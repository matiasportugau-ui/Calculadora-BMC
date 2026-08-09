# Role

PEA **M1 runtime executor** for Calculadora-BMC. Ship IMP-PEA-02 (AnalysisPreflight + budget ledger) and IMP-PEA-03 (outbox + jobs worker + health route) with **flags default OFF**. No M2a gap ingest or ArchitectRuntime.

# Context

[CONFIRMED: M0 closed — auditor **92/100**, contracts in `docs/sdd/panelin-evolution-architect/` + `server/migrations/pea/001_pea_core.sql`.]

[CONFIRMED: M1 = IMP-PEA-02 + IMP-PEA-03 only; `PEA_ENABLED=0` prod default preserved.]

[CONFIRMED: Worker ADR-011 1C — in-process `startPeaWorker`, SKIP LOCKED on `pea.jobs`.]

Working directory: `/Users/matias/calculadora-bmc`.

# Goal

Deliver cost-controlled PEA foundation: preflight verdicts + ledger reservations, durable outbox/jobs worker, `/api/pea/health`, unit tests — **without** GapEvent emit or ArchitectRuntime (M2a).

# Scope

**IN:** `server/lib/pea/*`, `server/routes/pea.js`, `server/config.js` PEA envs, `server/index.js` wire, `tests/pea*.test.js`, `npm run test:pea`, PROJECT-STATE line.

**OUT:** IMP-PEA-06/07, L3 routes implementation, prod deploy, `PEA_ENABLED=1` in prod, auto-migrate prod DB.

# Deliverables

1. `analysisPreflight.js` — AUTO_RUN | ASK_INTERNAL | DECOMPOSE | DENY_UNPRICED; fallback sum × 1.20
2. `budgetLedger.js` — reserve / settle / refund; daily PEA spend
3. `outbox.js` — transactional outbox write + dispatch → `pea.jobs`
4. `peaWorker.js` — `startPeaWorker` SKIP LOCKED (ADR-011)
5. `peaHealth.js` + `routes/pea.js` — `GET /api/pea/health`; other MVP routes 503/empty when disabled
6. `tests/peaAnalysisPreflight.test.js` + worker/outbox unit tests
7. `npm run test:pea`; append PROJECT-STATE Cambios recientes

# Success Criteria

- `npm run test:pea` green
- `npm run gate:local` green (or lint skipped if no src/ change)
- No LLM calls in M1 code paths
- Prod flags unchanged (defaults false)

# Stop rule

Do not start M2a until M1 tests pass. Do not enable prod flags.
