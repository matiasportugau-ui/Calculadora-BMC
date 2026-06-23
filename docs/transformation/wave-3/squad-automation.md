# Squad Automation — F1–F4

**Owner:** CRM Architect (`bmc-orchestrator`)  
**ADR:** [ADR-005](../adrs/ADR-005-automation-engine.md)

---

## Items

| ID | Deliverable | Files | Flag |
|----|-------------|-------|------|
| F1 | Rules schema + CRUD | `omni_automation_rules`, routes in `omni.js` | `OMNI_AUTOMATION_ENABLED` |
| F2 | Evaluator on `message.ingested` | `automationEngine.js` | flag off |
| F3 | `wa_rules` migration parity | `scripts/omni-migrate-wa-rules.mjs` | disable omni rules |
| F4 | Simulate + approval queue | `POST /api/omni/automation/simulate` | disable high-risk rules |

**Order:** F1 → F2 → (F3 ∥ F4)

---

## Condition DSL

JSON `all` / `any` / `none` arrays with `{ field, op, value }` — see [07-automation-engine.md](../07-automation-engine.md) §5.

Actions v1: `tag_conversation`, `set_priority`, `enqueue_ai_job`, `set_conversation_status`.

---

## Tests

- `tests/omniAutomationConditions.test.js`
- `tests/omniWaRulesParity.test.js` (offline structure)

---

## Rollback

```bash
OMNI_AUTOMATION_ENABLED=0
```

`wa_rules` remains authoritative for WA until explicit deprecation.
