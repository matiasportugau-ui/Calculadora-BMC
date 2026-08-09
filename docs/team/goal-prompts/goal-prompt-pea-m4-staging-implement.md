# Role

PEA **M4 executor** — Staging topology + replay + manual L3 implementer (IMP-PEA-10, 11, 12 partial, 13 full writer deferred). No OpenCode. Prod outbound OFF.

# Context

[CONFIRMED: M3 Principal/registry wired.]

[CONFIRMED: L3 implement requires grant ≥3 + staging guard; manual adapter first.]

Working directory: `/Users/matias/calculadora-bmc`.

# Goal

Ship `GET /api/environment`, staging guard, replay job, manual implementer (goal-prompt file), enable implement route behind flags+grant.

# Scope

**IN:** `environment` route, `stagingGuard.js`, `replayJob.js`, `manualAdapter.js`, `implementGapJob.js`, migration 003 job types, implement API, staging config test script, tests.

**OUT:** Cloud Run staging deploy, native gh PR adapter, OpenCode, prod `PEA_ENABLED=1`.

# Success Criteria

- `npm run test:pea` green
- Implement 403 on prod env without staging flag
- Implement with grant+staging writes goal-prompt artifact
