# ADR-010: Workspace Strategy (Evolve Canales)

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** Frontend Architecture, CRM Architecture  
**Related:** [02-target-state.md](../02-target-state.md), [18-evolution-roadmap.md](../18-evolution-roadmap.md)

---

## Context

**Three separate workspaces today:**

| Route | Data | Status |
|-------|------|--------|
| `/hub/canales` | Sheets unified-queue | IMPLEMENTED |
| `/hub/wa` | wa_* API | IMPLEMENTED |
| `/hub/ml` | Sheets ml-queue | IMPLEMENTED |
| `/hub/wa-inbox` | — | NOT_FOUND |
| `/hub/ml-manager` | Partial ML API | PARTIAL |

**Conflict:** [WACRM-FORK-DECISION.md](../../team/WACRM-FORK-DECISION.md) proposes embedding wacrm Inbox under `src/components/hub/wa-inbox/`. [10-architecture-review.md](../../discovery/10-architecture-review.md) §9.2 recommends **Option A: evolve `/hub/canales`**.

**Evidence:**
- Source: `docs/discovery/09-scorecard.md` §Frontend
- Section: Three workspaces, no omni-native UI
- Reasoning: UX fragmentation blocks operator efficiency

---

## Decision

**Option A — Evolve `/hub/canales` into Omni Workspace:**

```
/hub/canales                    → Omni Home (inbox all channels)
/hub/canales/contacts/:id       → Contact 360 sidebar
/hub/canales/deals              → Pipeline kanban (Phase 4)
/hub/wa                         → WA Pro unchanged (settings, quotes, operators)
/hub/ml-manager                 → ML ops dashboard unchanged
```

**Defer wacrm fork** to Phase 3+ **only if** omni thread UX fails parity after G2 (thread + reply). May **borrow UI patterns** from wacrm (3-pane layout) without Supabase dependency.

**Feature flag:** `VITE_OMNI_INBOX=1` toggles omni API vs legacy Sheets queue.

**Reject:** New `/hub/omni/*` route tree (navigation churn); full wacrm embed (parallel auth/RLS stack).

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **New `/hub/omni/*`** | Duplicate nav; confuses operators |
| **Full wacrm embed** | Supabase RLS parallel stack; security hardening debt |
| **Replace canales with ml-manager** | ML-only; ignores WA |
| **Keep Sheets queue forever** | No thread view; no real-time |

---

## Consequences

**Positive:**
- Single operator home for cross-channel work
- Less route churn; existing grants `canales` module reused
- Legacy deep-links via `properties.legacy`

**Negative:**
- canales component grows — mitigate with sub-routes and lazy load
- Phase 2 stub `WaInboxPanel.jsx` may be superseded not reused

---

## Risks

| Risk | Mitigation |
|------|------------|
| Regression on Sheets queue | Flag off = zero change |
| Thread UX inferior to wacrm | Benchmark; fork decision gate at week 6 |
| Bundle size | Code-split omni panels |

---

## Rollback Strategy

1. `VITE_OMNI_INBOX=0` — immediate revert to Sheets queue
2. Remove omni sub-routes; canales unchanged
3. wacrm fork remains optional future path — no sunk cost in P0–P2

---

## References

- [10-architecture-review.md](../../discovery/10-architecture-review.md) §9
- [WACRM-FORK-DECISION.md](../../team/WACRM-FORK-DECISION.md) — deferred
