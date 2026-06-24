# ADR-006: Deal Intelligence and Sheets Authority

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** CRM Architecture, Finance  
**Related:** [08-deal-intelligence.md](../08-deal-intelligence.md)

---

## Context

Deal state lives in **Google Sheets CRM_Operativo** today:

- `Monto estimado USD`, `Estado`, `Fecha próxima acción`, col AH (quote link)
- No `omni_deals` Postgres table at runtime

**Evidence:**
- Source: `docs/discovery/08-omni-gap-analysis.md` §Layer 7 Deal Intelligence
- Section: PARTIAL — structured deal model absent
- Reasoning: omni_deals NOT_FOUND; Sheets columns are implicit pipeline

---

## Decision

1. Introduce `omni_deals` as **operational pipeline** in Postgres
2. **Sheets-first for money for 90 days:** `OMNI_DEALS_SHEETS_AUTHORITY=1` (default)
   - Conflicts on `value_usd` / stage → **Sheets wins**
3. Dual-write: omni deal changes async sync to CRM row via `sync-crm` action
4. Stage machine: `lead → qualified → proposal → negotiation → closed_won | closed_lost`
5. Intelligence jobs on `message.ingested` with category `cotizacion` → extract value, upsert deal
6. Revenue attribution: `source_channel`, `source_conversation_id` on every deal

Flip authority only after parity verification + finance sign-off.

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **Sheets-only forever** | No real-time pipeline UI; no cross-channel deal graph |
| **Omni-first immediately** | Finance/commercial team uses Sheets; breaking change |
| **Replace with HubSpot** | See [19-build-vs-buy.md](../19-build-vs-buy.md); ML integration gap |
| **Deals in clientes.* only** | clientes is 360; deals need pipeline semantics |

---

## Consequences

**Positive:**
- Kanban pipeline UI (`/hub/canales/deals`) backed by Postgres
- AI can propose deal updates with HITL before Sheets sync
- Forecasting from omni_deals history

**Negative:**
- Dual-write reconciliation required
- Operators must understand two sources during transition

---

## Risks

| Risk | Mitigation |
|------|------------|
| Monto mismatch omni vs Sheets | Nightly reconcile job; alert on delta > 1% |
| Deal created without CRM row | Automation action `sync_crm_row` mandatory for qualified+ |
| Lost deal on Sheets delete | Soft-link via `properties.crm.row`; audit log |

---

## Rollback Strategy

1. Disable deal extract jobs
2. UI reads Sheets pipeline only (`VITE_OMNI_DEALS=0`)
3. omni_deals retained as read-only archive

---

## References

- [10-architecture-review.md](../../discovery/10-architecture-review.md) §8
- [google-sheets-module/README.md](../../google-sheets-module/README.md)
