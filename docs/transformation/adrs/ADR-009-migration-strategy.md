# ADR-009: Migration Strategy (Shadow → Flip)

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** Technical Program Management  
**Related:** [12-migration-strategy.md](../12-migration-strategy.md)

---

## Context

Three parallel models must converge to OmniCRM **without downtime**:

- WA: 18 Postgres migrations, full webhook path
- ML: Sheets-primary via `ml-crm-sync.js`, no message store
- Email/IG/FB: partial ingest or filter-only

Omni runtime **NOT_FOUND** — greenfield layer with legacy adapters.

**Evidence:**
- Source: `docs/discovery/10-architecture-review.md` §4–5
- Section: Phased WA P0–P4, ML M1–M4
- Reasoning: Explicit rollback per phase with feature flags

---

## Decision

**Universal pattern for every channel:**

```
P0 Schema + omniDb
P1 Shadow write (dual-write, legacy authoritative for reads)
P2 Backfill + parity verification
P3 Read flip (feature flag per user/channel)
P4 Write flip (legacy write path deprecated, read-only archive)
```

**Feature flags:**

| Flag | Purpose |
|------|---------|
| `OMNI_WA_SHADOW_WRITE` | WA webhook also writes omni |
| `OMNI_ML_SHADOW_WRITE` | ML sync also writes omni |
| `OMNI_EMAIL_SHADOW_WRITE` | Email ingest also writes omni |
| `VITE_OMNI_INBOX` | UI reads omni API vs Sheets |
| `OMNI_DEALS_SHEETS_AUTHORITY` | Sheets wins on money conflicts |

**Do not** remove inline handlers in PR-1; wrap with shadow write conditional.

**Reject:** Big-bang cutover, wacrm fork as migration vehicle (see ADR-010).

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **Direct cutover weekend** | Message loss risk; no rollback |
| **wacrm fork replace WA** | New stack; violates evolution principle |
| **Sheets-only omni** | Real-time inbox impossible |
| **Stop WA writes, omni only** | Breaks WA Pro quotes/SLA |

---

## Consequences

**Positive:**
- Zero-downtime; operators unaffected when flags off
- Parity tests gate every flip
- 12-week executable PR sequence (Tracks A–H)

**Negative:**
- Long dual-write period (storage, reconcile ops)
- Team must maintain flags discipline

---

## Risks

| Risk | Mitigation |
|------|------------|
| Dual-write drift | Idempotency + nightly reconcile |
| Premature read flip | User-level flag; admin-only first |
| Backfill overload | Batch with rate limit; dry-run first |

---

## Rollback Strategy

| Phase | Rollback |
|-------|----------|
| P0 | Drop schema (no prod data) |
| P1 | Flag off — zero omni writes |
| P2 | Delete omni rows tagged `source=backfill` |
| P3 | `VITE_OMNI_INBOX=0` |
| P4 | Re-enable wa_messages insert |

---

## References

- [12-migration-strategy.md](../12-migration-strategy.md)
- [13-pr-roadmap.md](../13-pr-roadmap.md)
