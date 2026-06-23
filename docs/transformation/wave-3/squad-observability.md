# Squad Observability — K1–K4

**Owner:** Platform Architect (`bmc-deployment`, `cloudrun-diagnostics-agent`)  
**ADR:** [ADR-008](../adrs/ADR-008-observability.md)

---

## Items

| ID | Deliverable | Files | Flag |
|----|-------------|-------|------|
| K1 | Correlation IDs | `trace_id` in normalizer + `server/lib/omni/trace.js` | additive |
| K2 | Metrics endpoint | `GET /api/omni/metrics`, `omniMetrics.js` | 503 if DB off |
| K3 | OTel hooks | `server/lib/omni/otel.js` | `OTEL_ENABLED=0` |
| K4 | Smoke + alerts doc | `scripts/smoke-omni.mjs`, FF-010 in L1 catalog | skip prod |

**Order:** K1 → K2 → (K3 ∥ K4)

---

## Mandatory IDs

`trace_id`, `contact_id`, `conversation_id`, `message_id`, `ai_run_id`, `automation_id` in pino child loggers on omni paths.

---

## Core metrics

See [10-observability-model.md](../10-observability-model.md) §5: ingest_total, ai_jobs_pending, automation_executions_total.

---

## Commands

```bash
npm run smoke:omni
curl -H "Authorization: Bearer $API_AUTH_TOKEN" http://localhost:3001/api/omni/metrics
```
