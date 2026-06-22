# ADR-008: Observability and OpenTelemetry

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** Platform Architecture  
**Related:** [10-observability-model.md](../10-observability-model.md)

---

## Context

Observability scores **50/100 — Functional**:

- pino + pino-http on all requests
- WA metrics `GET /api/wa/metrics`, PDF metrics
- No centralized APM/tracing
- No omni-specific dashboards
- No Vercel cron for omni reconcile

**Evidence:**
- Source: `docs/discovery/09-scorecard.md` §Observability
- Section: No centralized APM/tracing — NOT_FOUND
- Reasoning: `server/index.js` L7–8 pino only

---

## Decision

1. **OpenTelemetry SDK** in Express API (Cloud Run): traces + metrics export to **ASSUMPTION_REQUIRED** GCP Cloud Trace / optional Grafana Cloud
2. **Mandatory correlation IDs** on every omni path:

   | ID | Scope |
   |----|-------|
   | `trace_id` | Request span root |
   | `contact_id` | Contact operations |
   | `conversation_id` | Thread operations |
   | `deal_id` | Deal operations |
   | `automation_id` | Rule execution |
   | `ai_run_id` | AI job record |

3. **Structured logging:** pino child loggers with above fields; propagate `X-Trace-Id` header
4. **`GET /api/omni/metrics`:** ingest rate, duplicate rate, AI job backlog, automation failures
5. **Alerts:** AI cost anomaly, ingest duplicate spike, reconcile drift, DLQ depth
6. **Smoke:** extend `npm run smoke:prod` with omni health when enabled

Start with **metrics + structured logs** before full distributed tracing if OTel export blocked on Cloud Run config.

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **pino-only forever** | No cross-service trace; hard to debug dual-write |
| **Datadog full stack day 1** | Cost; **ASSUMPTION_REQUIRED** budget |
| **Client-side only metrics** | Misses server ingest path |
| **Logs to Sheets** | Anti-pattern |

---

## Consequences

**Positive:**
- End-to-end debug: webhook → normalizer → AI → automation
- SLO definition possible (ingest p99, suggest latency)

**Negative:**
- OTel SDK bundle size; Cloud Run cold start +50ms **ASSUMPTION_REQUIRED**
- Cardinality management for contact_id in metrics labels — use logs for high-cardinality

---

## Risks

| Risk | Mitigation |
|------|------------|
| PII in traces | Redact body/phone in span attributes |
| Cost of trace storage | Sample 10% prod; 100% staging |
| Alert fatigue | Start with 5 critical alerts only |

---

## Rollback Strategy

1. `OTEL_ENABLED=0` — pino-only fallback
2. Metrics endpoint returns 503 when omni disabled
3. No dependency of business logic on tracing

---

## References

- [10-architecture-review.md](../../discovery/10-architecture-review.md) Track H3
- OpenTelemetry semantic conventions for messaging systems
