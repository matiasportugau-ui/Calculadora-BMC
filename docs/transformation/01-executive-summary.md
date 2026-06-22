# 01 — Executive Summary

**Program:** EXPORT_SEAL::OMNICRM_AUTONOMOUS_TRANSFORMATION_PROGRAM_V2  
**Date:** 2026-06-22  
**Repository:** calculadora-bmc (SHA `d04a7f4` at discovery)  
**Audience:** Leadership, TPM, principal engineers

---

## 1. Mission

Transform the existing production platform — WhatsApp CRM, MercadoLibre CRM, CRM_Operativo (Sheets), and AI components — into a **world-class AI-Native OmniCRM** through **evolution, not replacement**, with reversible migrations and evidence-backed design.

**This package:** 20 design documents + 10 ADRs under `docs/transformation/`. **No code** in this deliverable.

---

## 2. Current state (evidence-based)

| Dimension | Score | Summary |
|-----------|-------|---------|
| **Overall omni-readiness** | **~40/100** | Strong WA/ML via Sheets + wa_*; omni layer not started |
| WhatsApp | 75 | Production webhook, Postgres, cockpit |
| MercadoLibre | 75 | OAuth, webhook, CRM sync |
| Email / IG / FB | 25 each | Partial or filter-only |
| OmniHub | 25 | Architecture + SQL only |
| AI | 50 | agentCore shared; no omni orchestrator |
| Security | 50 | Strong auth; open suggest-response |
| Frontend | 50 | Three fragmented workspaces |
| Observability | 50 | pino only; no APM |

**Evidence:**
- Source: `docs/discovery/09-scorecard.md` §Aggregate readiness
- Reasoning: Functional multi-channel via Sheets; unified omni layer DOCUMENTED_ONLY

**Critical finding:** Three parallel CRM models (`wa_*`, CRM_Operativo, `clientes.*`) create migration risk and operator friction.

---

## 3. Target state (12-month vision)

Single **operational message graph** (`omni_*`) fed by an **Omni Normalizer**, with:

- **Identity Resolution** across WA, ML, Email, IG, FB
- **Event-driven** AI orchestration (reuse agentCore), automation, and deal intelligence
- **Omni Workspace** by evolving `/hub/canales` (not a parallel `/hub/omni`)
- **Legacy retained:** WA Pro (quotes/SLA), Sheets (money authority 90d), calculator chat

Target aggregate omni-readiness: **≥92/100** by week 28 (see [18-evolution-roadmap.md](18-evolution-roadmap.md)).

---

## 4. Strategic decisions (ADR index)

| ADR | Decision |
|-----|----------|
| [001](adrs/ADR-001-omni-core.md) | omni_* = inbox graph; not replace Sheets/WA Pro |
| [002](adrs/ADR-002-identity-resolution.md) | Sparse keys + soft-merge + clientes bridge |
| [003](adrs/ADR-003-event-model.md) | In-process bus + idempotency table |
| [004](adrs/ADR-004-ai-governance.md) | Reuse agentCore + registries + HITL |
| [005](adrs/ADR-005-automation-engine.md) | omni_automation_rules generalizing wa_rules |
| [006](adrs/ADR-006-deal-intelligence.md) | omni_deals + Sheets-first for money |
| [007](adrs/ADR-007-security-model.md) | Close open routes; SSRF; prompt safety |
| [008](adrs/ADR-008-observability.md) | OTel + mandatory correlation IDs |
| [009](adrs/ADR-009-migration-strategy.md) | Shadow → backfill → read flip → write flip |
| [010](adrs/ADR-010-workspace-strategy.md) | Evolve canales; defer wacrm fork |

---

## 5. Execution path (12 weeks)

| Weeks | Milestone |
|-------|-----------|
| 1–4 | Foundation + WA shadow + security H1 |
| 5–8 | ML omni + APIs + inbox list UI |
| 9–12 | AI/automation/deals + thread reply + metrics |

**32 PRs** across tracks A–H — detail in [13-pr-roadmap.md](13-pr-roadmap.md).

**Non-negotiables:**
1. Idempotent ingest
2. Feature flags default OFF
3. Sheets wins on money conflicts (90d)
4. No second AI stack
5. Zero-downtime migration

---

## 6. Top 5 risks

| # | Risk | Mitigation | Owner |
|---|------|------------|-------|
| 1 | Dual-write drift | Idempotency + nightly reconcile | Platform |
| 2 | Contact merge errors | Soft-merge + review queue | Identity/CRM |
| 3 | AI cost spike | Rate limits; skip low-signal classify | AI |
| 4 | Sheets/omni money conflict | Sheets authority policy + audit | Finance/CRM |
| 5 | Scope creep in PRs | ≤500 LOC; flags; no UI before D1 | TPM |

Full register: [14-risk-register.md](14-risk-register.md)

---

## 7. Build vs buy

Recommendation: **Build omni layer on calculadora-bmc** — no wholesale replacement with Chatwoot/HubSpot/Zendesk. MercadoLibre integration and calculator coupling are decisive. Analysis: [19-build-vs-buy.md](19-build-vs-buy.md).

---

## 8. Quality gate (current → target)

| Category | Current | Target | Gap summary |
|----------|---------|--------|-------------|
| Architecture | 40 | 100 | omni_* not in runtime |
| Migration | 35 | 100 | No shadow write yet |
| Security | 50 | 100 | Open suggest-response; no SSRF |
| AI Governance | 45 | 100 | No registry/jobs |
| Observability | 50 | 100 | No OTel |
| Scalability | 55 | 100 | Sheets queue bottleneck |
| Maintainability | 45 | 100 | Three parallel models |
| Developer Experience | 60 | 100 | Doc/code drift |
| Operational Excellence | 55 | 100 | No omni smoke/reconcile |
| Business Value | 65 | 100 | WA/ML work; no unified inbox |

**Detail and remediation per gap:** [15-success-metrics.md](15-success-metrics.md)

---

## 9. Investment estimate

**ASSUMPTION_REQUIRED:**

| Resource | 12-week core |
|----------|--------------|
| Engineering | 1–2 FTE backend + 0.5 FTE frontend |
| Infra | Existing Cloud Run + Postgres — marginal cost |
| AI API | +$200–500/mo omni classify/suggest **estimate** |
| External SaaS | $0 if build path |

---

## 10. Next actions

1. **Approve ADRs 001–010** (Proposed status)
2. **Execute A1** — omni migrations package
3. **Parallel H1** — auth on suggest-response
4. **Assign owners** — [16-domain-ownership.md](16-domain-ownership.md)
5. **Operational prep** — [20-operational-readiness.md](20-operational-readiness.md)

---

## Document map

Start here → [README.md](README.md) → [02-target-state.md](02-target-state.md) → [12-migration-strategy.md](12-migration-strategy.md) → [13-pr-roadmap.md](13-pr-roadmap.md)
