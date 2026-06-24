# ADR-001: Omni Core Data Model

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** Platform Architecture  
**Related:** [02-target-state.md](../02-target-state.md), [03-domain-model.md](../03-domain-model.md)

---

## Context

The platform runs **three parallel CRM models** today:

| Model | Role | Status |
|-------|------|--------|
| `wa_*` Postgres | WA runtime (messages, suggestions, quotes) | IMPLEMENTED |
| `CRM_Operativo` Sheets | Commercial truth, ML/WA queues | IMPLEMENTED |
| `clientes.*` Postgres | 360 customer graph | PARTIAL |

The target OmniCRM design (`omni_contacts`, `omni_conversations`, `omni_messages`, `omni_deals`) exists only as DDL in `docs/team/omni-hub-schema.sql` with **zero runtime** in `server/`.

**Evidence:**
- Source: `docs/discovery/04-database-map.md` §Special focus omni_*
- Section: omni_* DOCUMENTED_ONLY
- Reasoning: Grep `omni_` under `server/` returns NOT_FOUND

---

## Decision

Introduce `public.omni_*` tables as the **operational inbox + message graph** — the canonical cross-channel threading layer. Do **not** replace:

- `wa_*` for WA Pro (quotes, SLA, operators, consent)
- `CRM_Operativo` for commercial records and money (short/medium term)
- `clientes.*` as 360 bridge (FK link, not merge)

Omni Core owns: normalize → identity resolve → persist → query via `/api/omni/*`.

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **Replace Sheets with omni_* immediately** | Sheets is production truth for Monto/Estado; finance team dependency |
| **Extend wa_* for all channels** | WA-specific schema; ML has no Postgres store |
| **Merge everything into clientes.* only** | clientes is 360/scoring; inbox needs high-write message throughput |
| **Big-bang cutover** | Unacceptable downtime and rollback risk |

---

## Consequences

**Positive:**
- Single query surface for cross-channel inbox
- Clear separation: operational graph vs commercial ledger vs WA Pro ops
- Aligns with frozen `OMNI-HUB-ARCHITECTURE.md` Layer 3 Aggregator

**Negative:**
- Dual-write window increases storage and reconciliation complexity
- Operators may see two UIs during transition (`/hub/canales` Sheets vs omni API)

**Neutral:**
- Schema namespace `public.omni_*` matches existing WA flat-table pattern

---

## Risks

| Risk | Mitigation |
|------|------------|
| Data drift between wa_* and omni_* | Idempotency keys + nightly reconcile |
| Scope creep into Sheets replacement | Explicit non-goal in ADR; Sheets-first for deals 90d |
| Migration DDL errors | Feature-flagged shadow write before read flip |

---

## Rollback Strategy

1. **P0:** Drop omni schema if no production writes occurred
2. **P1+:** Disable `OMNI_*_SHADOW_WRITE` flags — legacy paths unchanged
3. **P3+:** Re-enable dual write; omni rows tagged `source=backfill` for selective delete

---

## References

- [10-architecture-review.md](../../discovery/10-architecture-review.md) §0, §2
- [omni-hub-schema.sql](../../team/omni-hub-schema.sql)
