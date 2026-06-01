# Presupuestación Orchestrator — Implementation Roadmap
**Date**: 2026-05-29  
**Version**: 1.0  
**Status**: Draft — Ready for review  
**Owner**: Matías + Heavy Grok (presupuestacion-orchestrator skill)  
**Context**: Phase 0 successfully landed (2026-05-29). Feature freeze active until ~2026-06-11. New skill `presupuestacion-orchestrator` now live at `~/.grok/skills/presupuestacion-orchestrator/SKILL.md`.

---

## Strategic Objective

Build and operationalize the `presupuestacion-orchestrator` so that the full presupuestación pipeline reaches the SMART targets from the base plan by end of 2026:

- ≥90% of presupuestos with zero manual intervention
- ≥99% accuracy on BOM/pricing vs historical
- ≥40% reduction in time-per-presupuesto

This roadmap translates the approved Architecture Document into a sequenced, realistic execution plan that respects the current **feature freeze** and the broader PRODUCTION-READINESS-PLAN.

---

## Guiding Constraints

- **Feature Freeze** (active ~2026-05-28 → ~2026-06-11): Only stability, observability, hygiene, planning, skill design, documentation, and promptfoo evals. New production code paths that touch pricing/identity/tasks/ERP require explicit exception in PROJECT-STATE.
- **Maximal Reuse**: All LLM usage must go through `aiProviderConfig`. Do not rebuild existing capabilities.
- **Hub-Tasks Dependency**: The Approval Router sub-agent is heavily gated on the 3 remaining infra blockers (OAuth client, PGP key, Cloud Scheduler).
- **100% Quality Bar**: Every major artifact must have promptfoo evals, clear handoff protocols, and be reviewed against the historical agent patterns (0-9 pipeline, Run Scope Gate, explicit artifact handoffs, Judge, etc.).

---

## High-Level Phases

| Phase | Time Window          | Focus                                      | Freeze Status     | Primary Deliverables |
|-------|----------------------|--------------------------------------------|-------------------|----------------------|
| **Phase A** | Now – June 11       | Foundation & Quick Wins (under freeze)    | Fully allowed     | AI surface cleanup, skill hardening, evals, roadmap |
| **Phase B** | June 12 – mid July  | Core Conductor + First 3 Sub-Agents       | Mostly post-freeze| Working conductor + Intake/Context/Pricing sub-agents |
| **Phase C** | Mid July – Aug      | Document Gate + Delivery + Approval Router| Post-freeze       | PDF quality gates + hub-tasks integration |
| **Phase D** | Aug – Sep           | Monitoring, Post-Mortem, Full Loop        | Post-freeze       | Closed-loop automation + observability |
| **Phase E** | Sep – Q4            | Hardening, Self-Improvement, Scale        | Normal velocity   | 90%+ automation target, continuous improvement |

---

## Phase A — Foundation & Quick Wins (Current — June 11)

**Goal**: Make the orchestrator usable and safe while the feature freeze is active. Clear the highest-leverage technical debt that blocks the conductor.

### A1. AI Surface Centralization (Highest ROI)

| Item | Description | Effort | Owner | Status |
|------|-------------|--------|-------|--------|
| A1.1 | Migrate `server/lib/agentCore.js` + callers to `aiProviderConfig` | 1–1.5 days | — | **Priority #1** |
| A1.2 | Add cost logging (`estimateCostUSD` + pino) to `server/routes/wolfboard.js` | 0.5 day | — | High |
| A1.3 | Add cost logging to `server/routes/superAgent.js` | 0.5 day | — | High |
| A1.4 | Unify gateway vs direct paths decision logic into aiProviderConfig | 1 day | — | Medium |
| A1.5 | Update `docs/AI-INTEGRATION-CALCULADORA.md` with new state | 0.5 day | — | Required |

**Why this matters**: The conductor cannot reliably control cost or model quality while major production paths (especially wolfboard batch) bypass the central config.

### A2. Skill & Evaluation Hardening (Allowed under freeze)

- Add 8–10 high-value promptfoo eval cases for the core gates defined in the Architecture Document (Pricing Reviewer, Document Gatekeeper, Approval Router logic).
- Create `evals/` directory inside the skill with realistic test cases + runner script (following agent-forge patterns).
- Refine the orchestrator skill based on first usage sessions.

### A3. Documentation & Planning (Allowed)

- Finalize this roadmap + get sign-off.
- Update `docs/team/AGENTS.md` (add entry for the new orchestrator).
- Create initial Conductor prompt templates for the 4 highest-priority sub-agents (Intake, Context Builder, Pricing Reviewer, Document Gatekeeper).
- Produce a "Presup Flow State Schema" design doc (the data structure the conductor will maintain).

### A4. Hub-Tasks Preparation

- Document exact integration points the orchestrator will use once infra is live (task templates for presup flows, required fields, status transitions).
- Prepare the OPERATOR-CHECKLIST items as a clean handoff for whoever resolves the 3 blockers.

**Exit Criteria for Phase A**:
- All A1 items either done or explicitly scheduled post-freeze with exceptions.
- First promptfoo eval suite for the orchestrator passing.
- This roadmap approved and referenced from PROJECT-STATE.md.

---

## Phase B — Core Conductor + First Sub-Agents (Post-Freeze)

**Goal**: Make the orchestrator actually executable for end-to-end presup flows.

### B1. Conductor Core
- Implement the saga/state machine for a full presup run.
- Implement the Run Scope Gate + Handoff Table logic.
- Cost aggregation and budget enforcement.

### B2. First Wave Sub-Agents
1. Intake & Classification
2. Context Builder (heavily leverages the new embedding cache)
3. Pricing & BOM Reviewer (biggest quality win)

### B3. Quick Integration Wins
- Wire the orchestrator into one high-volume intake path (e.g., wolfboard batch or a new `/api/presup/generate` endpoint).
- Basic telemetry events (`presup_flow_step`, `presup_cost`).

**Target**: By end of Phase B we can run a full presupuestación flow end-to-end in "Ligero" mode with human approval still required at the end.

---

## Phase C — Document Gate + Delivery + Approval Router

- Full Document Gatekeeper with PDF metrics integration.
- Delivery & Sync Coordinator.
- **Approval Router** — first real usage of the hub-tasks module for presup flows.
- Closed-loop: orchestrator creates task → waits for resolution → continues or escalates.

This is the phase where we expect the biggest jump toward the 90% zero-manual target.

---

## Phase D — Monitoring, Post-Mortem & Self-Improvement

- Monitor & Alert sub-agent + real `/hub/monitoring` surface for presup flows.
- Post-Mortem & Learning sub-agent that feeds high-value pairs back into trainingKB.
- Integration with existing Judge / promptfoo harness for continuous prompt improvement.
- First version of autonomous budget and quality tuning.

---

## Phase E — Scale & 100% Target

- Dynamic sub-agent spawning / cloning.
- Event-driven triggers (instead of polling).
- Full self-improvement loop (orchestrator proposes its own prompt improvements).
- Production SLOs and alerting.
- Handover to normal velocity team maintenance.

---

## Quick Wins Summary (Do These First)

| Rank | Item | Phase | Impact on 90%/99% Targets | Freeze Safe? |
|------|------|-------|---------------------------|--------------|
| 1    | Migrate agentCore + add cost logging to wolfboard | A1 | Very High | Partial (some under freeze) |
| 2    | First 3 promptfoo evals for Pricing Reviewer + Document Gate | A2 | High | Yes |
| 3    | Conductor skeleton + Run Scope Gate + Handoff Table | B | High | Mostly post-freeze |
| 4    | Hub-tasks task templates for presup flows | B/C | Very High | Yes (design only) |
| 5    | Basic presup flow telemetry | B | Medium | Post-freeze |

---

## Dependencies & Blockers

**Hard Blockers**:
- Resolution of the 3 hub-tasks infra items (OAuth client, `SUPABASE_PGP_ENCRYPT_KEY`, Cloud Scheduler job).
- Decision on whether we want fully automatic approval in some cases or always human-in-loop.

**Soft Dependencies**:
- Continued health of `aiProviderConfig` as the single source of truth.
- Ongoing discipline on feature freeze (or clean exception process).

---

## Success Metrics per Phase

- **End of Phase A**: All critical AI surfaces use central config + cost visibility. First evals exist.
- **End of Phase B**: Can execute a full presup flow in conductor mode with human approval at the end.
- **End of Phase C**: Approval routing via hub-tasks is live and measurable.
- **End of Phase D**: Real-time visibility into the 5 target KPIs + automated learning loop.
- **End of Phase E**: 90%+ zero-manual runs sustained for 30+ days with <1% accuracy regression.

---

## Recommended Immediate Next Actions (This Week)

1. Review and approve this roadmap + the Architecture Document.
2. Execute A1.1 (agentCore migration) — highest leverage item available right now.
3. Start A2 (promptfoo evals for the core gates) using the new orchestrator skill.
4. Update AGENTS.md and PROJECT-STATE.md with the new orchestrator entry and roadmap link.
5. Schedule the hub-tasks infra resolution work (even if it slips into post-freeze).

---

**This roadmap is intentionally conservative on code changes during the freeze and aggressive on design, evaluation, and AI surface cleanup.**

Once approved, the `presupuestacion-orchestrator` skill itself can be used to drive the detailed work planning for Phase B onward.

---

*Part of the approved 100% Quality Automation Closure Plan — Phase 1 Orchestrator Bootstrap.*