# Squad Agents — I1–I4

| PR | Deliverable | Files |
|----|-------------|-------|
| I1 | HITL suggestions API | `orchestrator/suggestions.js`, accept/reject routes |
| I2 | classify + suggest workers | `aiWorker.js` (extends WAVE 3 E1/E2) |
| I3 | Automation engine v1 | `automationEngine.js` (+ `create_deal` action) |
| I4 | Internal AI run + omni context | `POST /api/internal/omni/ai/run`, kbBridge in suggest |

**Flags:** `OMNI_AI_ORCHESTRATOR_ENABLED`, `OMNI_EVENT_BUS_ENABLED`, `OMNI_AUTOMATION_ENABLED`.

**Rollback:** `OMNI_AI_ORCHESTRATOR_ENABLED=0` → legacy waEnricher + suggestResponse.
