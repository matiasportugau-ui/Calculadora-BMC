# OmniCRM Autonomous Transformation Program V2

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22  
**Basis:** Discovery audit SHA `d04a7f4` + [Architecture Review](../discovery/10-architecture-review.md)  
**Status:** Design package — no runtime implementation in this folder

---

## Purpose

Canonical transformation documentation to evolve the current production platform (WhatsApp CRM, MercadoLibre CRM, CRM_Operativo, AI components) into a world-class **AI-Native OmniCRM** platform through reversible, evidence-backed migration.

**Guiding principle:** Evolution over replacement.

---

## Document index

| # | Document | Scope |
|---|----------|-------|
| 01 | [01-executive-summary.md](01-executive-summary.md) | Executive overview, quality gate scores, top risks |
| 02 | [02-target-state.md](02-target-state.md) | Bounded contexts, topology, module layout |
| 03 | [03-domain-model.md](03-domain-model.md) | Entities, lifecycles, invariants |
| 04 | [04-event-model.md](04-event-model.md) | Domain events, idempotency, retry/DLQ |
| 05 | [05-identity-resolution.md](05-identity-resolution.md) | Cross-channel contact resolution |
| 06 | [06-ai-governance.md](06-ai-governance.md) | Prompt/model registry, HITL, safety |
| 07 | [07-automation-engine.md](07-automation-engine.md) | Triggers, conditions, actions |
| 08 | [08-deal-intelligence.md](08-deal-intelligence.md) | Pipeline, forecasting, Sheets bridge |
| 09 | [09-security-model.md](09-security-model.md) | RBAC, threat model, mitigations |
| 10 | [10-observability-model.md](10-observability-model.md) | Logging, metrics, tracing, alerts |
| 11 | [11-testing-strategy.md](11-testing-strategy.md) | Test pyramid, parity, replay |
| 12 | [12-migration-strategy.md](12-migration-strategy.md) | Zero-downtime phased migration |
| 13 | [13-pr-roadmap.md](13-pr-roadmap.md) | Tracks A–H, 32 executable PRs |
| 14 | [14-risk-register.md](14-risk-register.md) | Risk register + top-10 failure modes |
| 15 | [15-success-metrics.md](15-success-metrics.md) | KPIs and target deltas |
| 16 | [16-domain-ownership.md](16-domain-ownership.md) | RACI per bounded context |
| 17 | [17-technical-debt.md](17-technical-debt.md) | Debt register with remediation |
| 18 | [18-evolution-roadmap.md](18-evolution-roadmap.md) | Phases beyond 12-week core |
| 19 | [19-build-vs-buy.md](19-build-vs-buy.md) | Chatwoot, Zendesk, HubSpot, Intercom |
| 20 | [20-operational-readiness.md](20-operational-readiness.md) | Runbooks, gates, deploy checklist |
| 21 | [21-wave-execution.md](21-wave-execution.md) | WAVE 0–N execution model, parallel squads |

**Quality gate:** [SELF-CRITIQUE.md](SELF-CRITIQUE.md)

---

## Architecture Decision Records

| ADR | Title |
|-----|-------|
| [ADR-001](adrs/ADR-001-omni-core.md) | Omni Core data model |
| [ADR-002](adrs/ADR-002-identity-resolution.md) | Identity resolution strategy |
| [ADR-003](adrs/ADR-003-event-model.md) | Event bus and idempotency |
| [ADR-004](adrs/ADR-004-ai-governance.md) | AI governance and agentCore reuse |
| [ADR-005](adrs/ADR-005-automation-engine.md) | Cross-channel automation |
| [ADR-006](adrs/ADR-006-deal-intelligence.md) | Deal intelligence and Sheets authority |
| [ADR-007](adrs/ADR-007-security-model.md) | Security hardening |
| [ADR-008](adrs/ADR-008-observability.md) | OpenTelemetry and correlation IDs |
| [ADR-009](adrs/ADR-009-migration-strategy.md) | Shadow → flip migration |
| [ADR-010](adrs/ADR-010-workspace-strategy.md) | Workspace UX (evolve canales) |

---

## Evidence sources

- [Discovery index](../discovery/README.md)
- [Current system map](../discovery/01-current-system-map.md)
- [Omni gap analysis](../discovery/08-omni-gap-analysis.md)
- [Scorecard](../discovery/09-scorecard.md)
- [Architecture review](../discovery/10-architecture-review.md)
- [OMNI-HUB-ARCHITECTURE.md](../team/OMNI-HUB-ARCHITECTURE.md)
- [omni-hub-schema.sql](../team/omni-hub-schema.sql)

---

## Non-negotiables

1. Idempotent ingest via `(channel, channel_message_id)` + `omni_ingest_dedup`
2. Migration phases: shadow → backfill → read flip → write flip (feature flags)
3. **Sheets authoritative for money** until `OMNI_DEALS_SHEETS_AUTHORITY=0`
4. **Reuse `agentCore`** — no second AI stack
5. WA Pro (`wa_*`) retained for quotes, SLA, operators; omni = cross-channel inbox
