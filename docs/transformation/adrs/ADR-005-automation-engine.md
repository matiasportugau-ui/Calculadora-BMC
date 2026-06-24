# ADR-005: Cross-Channel Automation Engine

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** CRM Architecture  
**Related:** [07-automation-engine.md](../07-automation-engine.md)

---

## Context

Automation is siloed:

| System | Scope | Status |
|--------|-------|--------|
| `wa_rules` | WA only | IMPLEMENTED |
| CRM cockpit approval | Sheets rows | IMPLEMENTED |
| ML auto-mode | `.ml-automode.json` file | IMPLEMENTED |
| `clientes.automation_rules` | Schema only | NOT wired |

**Evidence:**
- Source: `docs/discovery/08-omni-gap-analysis.md` §Layer 6 Automation Engine
- Section: PARTIAL — no unified rules engine
- Reasoning: Rule duplication across WA/ML/Sheets

---

## Decision

Introduce `omni_automation_rules` + `omni_automation_runs`:

- **Trigger:** domain events (`message.ingested`, `conversation.status_changed`, `deal.stage_changed`)
- **Conditions:** JSON DSL (channel, body_ai_category, tags, priority_gte, monto_gte, etc.)
- **Actions:** tag, set_priority, assign_owner, enqueue_ai_job, create_deal, sync_crm_row, webhook_outbound
- **Versioning:** immutable rule versions; `enabled` flag per version
- **Simulation:** dry-run against historical message without side effects
- **Approval:** high-risk actions (auto-send, deal stage → closed_won) require operator approval workflow

Migrate `wa_rules` via one-time SQL insert with `conditions.channel = 'wa'`.

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **Keep siloed wa_rules + ML file** | No cross-channel rules; operator configures 3 places |
| **Sheets Apps Script automation** | Not versioned; no audit; latency |
| **External workflow engine (Zapier/n8n)** | Secrets, latency, no omni event access |
| **Hardcoded automation in handlers** | Unmaintainable; no simulation |

---

## Consequences

**Positive:**
- Single rule admin for "if cotización on any channel → create deal"
- Audit trail via `omni_automation_runs`
- Simulation reduces production incidents

**Negative:**
- JSON DSL learning curve for operators
- Migration must preserve WA rule behavior exactly (parity tests)

---

## Risks

| Risk | Mitigation |
|------|------------|
| Runaway rule loops | Max actions per event; circuit breaker |
| Wrong auto-tag on bad classify | Require confidence_gte in conditions |
| Sheets sync action failure | Retry + DLQ; do not block message ingest |

---

## Rollback Strategy

1. Disable all omni rules (`enabled=false` globally)
2. WA rules table remains authoritative for WA until explicit deprecation flag
3. Automation runs table retained for audit

---

## References

- [10-architecture-review.md](../../discovery/10-architecture-review.md) §7
