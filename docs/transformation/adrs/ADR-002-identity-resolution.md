# ADR-002: Identity Resolution Strategy

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** CRM Architecture  
**Related:** [05-identity-resolution.md](../05-identity-resolution.md)

---

## Context

Contacts are fragmented across channels:

- WA uses `phone` / `chat_id` in `wa_*`
- ML uses ML user id embedded in Sheets observaciones
- Email uses ingest API → Sheets only
- IG/FB use `surface.js` labels only — no Graph API

`clientes.customers` + `clientes.customer_identities` schema exists with only `GET /api/clientes/customers` wired.

**Evidence:**
- Source: `docs/discovery/08-omni-gap-analysis.md` §Layer 3 Identity Resolution
- Section: PARTIAL — engine + merge logic missing
- Reasoning: No cross-link table at runtime

---

## Decision

Implement **sparse unique key resolution** on `omni_contacts`:

| Channel | Key column | integration_uuid pattern |
|---------|------------|--------------------------|
| WhatsApp | `wa_phone` E.164 | `wa:+59899123456` |
| MercadoLibre | `ml_user_id` | `ml:123456789` |
| Email | `email` (normalized) | `email:sha256(lower)` |
| Instagram/Facebook | `meta_psid` (future) | `meta:psid:{id}` |
| Extension | `chrome_ext_contact_id` | `ext:{id}` |

**Merge policy:** Soft-merge via `merged_into_contact_id`; survivor row unions channel IDs; audit in `omni_audit_log` + `clientes.customer_field_provenance` pattern.

**Bridge:** `omni_contacts.clientes_customer_id` FK → `clientes.customers(id)` — do not merge schemas.

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **Sheets row as primary ID** | Not stable for real-time messaging; row numbers shift |
| **clientes.* as sole contact store** | 360 model optimized for scoring, not message ingest |
| **Hard delete on merge** | Loses audit trail; irreversible |
| **Manual merge only** | Does not scale; blocks automation |

---

## Consequences

**Positive:**
- O(1) lookup per channel via sparse unique indexes
- Reversible merges for operator correction
- Provenance preserved for conflict audit

**Negative:**
- Confidence scoring adds complexity
- False-positive merges require admin review queue

---

## Risks

| Risk | Mitigation |
|------|------------|
| Same phone, different ML buyer | Confidence model; manual review below threshold |
| Email hash collision (theoretical) | Use full email + secondary signals |
| Merge during active conversation | Transaction lock on contact_id; event `contact.merged` notifies consumers |

---

## Rollback Strategy

1. Un-merge: restore `merged_into_contact_id = NULL` from audit `old_values`
2. Disable auto-merge; require manual admin action only
3. Re-point conversations via audit log entity_id mapping

---

## References

- [10-architecture-review.md](../../discovery/10-architecture-review.md) §2.3–2.5
