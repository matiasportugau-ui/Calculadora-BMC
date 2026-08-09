# Role

PEA **M2b executor** — Gym console + durable grant store (L3 escalate only) + `pea_explain_gap` read-only tool. Flags default OFF. No L3 implementer, no M2c ratchet gate.

# Context

[CONFIRMED: M2a closed — gap ingest, ArchitectRuntime mock, Critic, `npm run test:pea` green.]

[CONFIRMED: M2b = IMP-PEA-08 + IMP-PEA-09 per `IMPLEMENTATION-GUIDE.md`.]

[CONFIRMED: Module 6 — `pea_explain_gap` read-only + soft internal hint; must not block quote/calc tools.]

[CONFIRMED: L3 `POST /pea/packets/:id/implement` stays 403 until M4; M2b may create `pea.grants` rows on Escalate (max_level=3).]

Working directory: `/Users/matias/calculadora-bmc`.

# Goal

Ship operator-facing PEA review surface and Panelin narration: list gaps/packets, Approve/Reject/Escalate, grant persistence + audit, `pea_explain_gap` tool with offline goldens.

# Scope

**IN:** `server/lib/pea/grants.js`, `packetReview.js`, `explainGap.js`, `auditEvents.js`; extend `server/routes/pea.js`; `pea_explain_gap` in `agentTools.js`; minimal Hub UI `/hub/pea`; tests; PROJECT-STATE.

**OUT:** M2c ratchet on Accept, L3 implement adapters, staging (IMP-10), prod `PEA_ENABLED=1`, real LLM in CI.

# Deliverables

1. **API** — `POST /api/pea/packets/:id/accept|reject|escalate`; `POST /api/pea/grants` (max_level≤3); `POST /api/pea/grants/:id/revoke`; audit rows on grant/packet actions
2. **Console** — `/hub/pea`: gaps list, packet detail, Approve/Reject/Escalate (JWT via `useBmcAuth`)
3. **`pea_explain_gap`** — AGENT_TOOLS entry; narrates gap/packet from DB; never invents prices
4. **Tests** — `peaExplainGap.test.js`, `peaGrants.test.js`, extend `test:pea`
5. **Docs** — PROJECT-STATE Cambios recientes line

# Success Criteria

- `npm run test:pea` green
- Explain tool returns narrative without price fields when packet has no calc provenance
- Escalate creates grant row + audit event; implement route still 403
- Console loads gaps when `PEA_ENABLED=1` locally

# Stop rule

Do not start M2c until M2b tests pass. Do not enable prod flags.
