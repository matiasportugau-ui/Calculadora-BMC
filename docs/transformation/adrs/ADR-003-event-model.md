# ADR-003: Event Model and Internal Bus

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** Platform Architecture  
**Related:** [04-event-model.md](../04-event-model.md)

---

## Context

Channel handlers write independently today with no shared event contract:

- WA webhook → `server/index.js` L812–962 (Postgres + Sheets inline)
- ML webhook → `syncMLCRM`
- Email → `bmcDashboard.js` ingest (Sheets only)

No omni normalizer, no unified `message.ingested` event, no cross-channel automation triggers.

**Evidence:**
- Source: `docs/discovery/08-omni-gap-analysis.md` §Layer 2 Omni Normalizer
- Section: NOT_FOUND — entire normalizer layer absent
- Reasoning: Per-channel handlers with no shared type

---

## Decision

**Phase 1:** In-process event bus after `normalizer.normalizeAndPersist()` succeeds:

```
Adapter → Normalizer → DB commit → emit(domainEvent) → subscribers (AI, Automation, Deals)
```

**Phase 2 (optional):** `omni_outbox` table for async workers when throughput exceeds in-process capacity (threshold: **ASSUMPTION_REQUIRED** >500 msg/min sustained).

**Idempotency:** `omni_ingest_dedup(idempotency_key PRIMARY KEY)` before any side effects.

**Event catalog:** Minimum 16 domain events (see [04-event-model.md](../04-event-model.md)).

Do **not** introduce Kafka/PubSub in v1 — operational simplicity for single Cloud Run instance + in-process workers (same pattern as `waEnricherWorker.js`).

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **Kafka/PubSub now** | Over-engineering for current volume; ops burden |
| **Synchronous-only (no events)** | Blocks automation and AI orchestrator decoupling |
| **Sheets as event log** | Latency, no ordering guarantees, not suitable for real-time |
| **Database triggers only** | Hard to version; poor observability |

---

## Consequences

**Positive:**
- Enables AI orchestrator, automation engine, deal intelligence as subscribers
- Idempotent ingest prevents duplicate messages on webhook retry
- Same deployment unit — no new infrastructure

**Negative:**
- In-process bus lost on process crash before subscriber runs — mitigated by `omni_ai_jobs` pending queue
- Horizontal scaling requires outbox (Phase 2)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Subscriber failure after DB commit | Retry via job table; dead letter after N attempts |
| Event ordering | Per-conversation serialization key |
| Duplicate events on replay | Idempotency at consumer via `omni_automation_runs(action_id)` |

---

## Rollback Strategy

1. Disable event emission flag `OMNI_EVENT_BUS_ENABLED=0` — normalizer still persists
2. Subscribers become no-ops; legacy per-channel AI paths remain
3. Outbox table droppable if never populated

---

## References

- [10-architecture-review.md](../../discovery/10-architecture-review.md) §1.4–1.5, §6.2
