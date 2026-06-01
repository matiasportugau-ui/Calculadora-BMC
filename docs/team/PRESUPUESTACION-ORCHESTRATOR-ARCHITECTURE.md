# Presupuestación Orchestrator — Architecture Document
**Date**: 2026-05-29  
**Status**: Draft for review (Heavy Grok synthesis)  
**Based on**: 
- `plan_cierre_automatizacion_100_quality.md` (Dropbox base)
- Approved session plan (Phase 0 complete, Phase 1 bootstrap)
- `goal-prompt-presupuestacion-orchestrator-100.md`
- `HANDOFF-2026-05-29.md`
- Parallel research from three explore sub-agents (Hub/Tasks, AI Surface, Historical Patterns)

---

## 1. Executive Summary

The goal is to build a **Grok 4.3-powered `presupuestacion-orchestrator`** skill that drives the full presupuestación pipeline toward the 100% automation targets:

- 90%+ of presupuestos with zero manual intervention
- 99%+ accuracy on BOM / pricing vs historical baseline
- 40%+ reduction in time-per-presupuesto

**Key Design Decision (after deep research)**:
The orchestrator will be a **lightweight Conductor** that owns end-to-end flow control, cost/quality guardrails, and sub-agent delegation. It will **not** re-implement core capabilities (calculation, PDF generation, AI calling, sync logic). Instead, it will orchestrate and gate the existing strong primitives, with the `hub-tasks` module becoming the primary human-in-the-loop approval mechanism once its infra blockers are cleared.

This approach respects the active **feature freeze** (planning + skill scaffolding now, heavy implementation post ~2026-06-11 or with explicit exception).

---

## 2. Context & Current State (Post Phase 0)

### Major Wins from Phase 0 (May 2026)
- `server/lib/aiProviderConfig.js` is now the single source of truth for providers, models, allowlists, and cost estimation.
- Critical bugs fixed in `aiCompletion.js` (scope) and `trainingKB.js` (embedding cache).
- `autoLearnExtractor.js` improved with BMC-domain focus + semantic dedup.
- PDF pipeline stabilized (simple-carbon default + versioning + `/api/pdf/metrics` live in prod).
- Working tree clean after 3 atomic commits.

### Current Maturity Assessment
- Overall presup pipeline: ~55-65% automated (pre-orchestrator).
- AI layer: Partially centralized (big gaps remain in `agentCore.js`, `wolfboard.js`, `superAgent.js`).
- Hub + Tasks: Excellent design and substantial code, but **infra-blocked** (OAuth client, secrets, Cloud Scheduler). Not yet integrated into presup flows.
- Historical strength: Extremely mature multi-agent culture (0-9 phased conductor model, MATPROMT, Run Scope Gate, explicit handoffs, Judge-driven improvement loops).

---

## 3. Guiding Principles (Synthesized from Research)

These principles are non-negotiable for the orchestrator:

1. **Conductor + Specialist Model** (not a flat team)
   - One conductor owns the saga and routing.
   - Specialists are narrow, verb-led, and single-responsibility.

2. **Reuse Over Reinvention**
   - All LLM calls must eventually route through `aiProviderConfig`.
   - Calculation → delegate to `agentTools` + calc engine.
   - PDF → delegate to `pdfGenerator` + new metrics.
   - Approval/ERP sync → become the primary user of the `hub-tasks` module.

3. **Explicit Artifact-Based Handoffs**
   - Never "tell the next agent". Always produce a concrete artifact + update a handoff table.

4. **Cost & Quality as First-Class Citizens**
   - Every step must be measurable (cost via `estimateCostUSD`, quality via gates + promptfoo evals).
   - The conductor can enforce budgets and halt expensive paths.

5. **Feature Freeze Discipline**
   - Skill design, architecture docs, promptfoo evals, and scaffolding = allowed now.
   - New production wiring and complex sub-agent logic = post-freeze or with exception.

6. **Adopt Proven Project Patterns**
   - 0-9 phased pipeline
   - Run Scope Gate (Profundo / Ligero / N/A)
   - MATPROMT-style tailored prompts for deep work
   - Judge + historical tracking
   - Literal next prompts + closed improvement loop (Paso 9)

---

## 4. High-Level Architecture

### Conductor Role
**Name**: `presupuestacion-orchestrator` (the skill itself acts as the conductor)

**Core Responsibilities**:
- Maintains the state of an individual presupuestación "run" (saga).
- Decides the execution plan using Run Scope Gate logic.
- Enforces global guardrails (cost caps, quality thresholds, human gates).
- Routes work to the appropriate specialist sub-agents.
- Aggregates telemetry for the KPIs in the base plan.
- Owns the handoff table and improvement loop.

### Specialist Sub-Agents (Initial Set)

These can be implemented as:
- Separate skills in `~/.grok/skills/`
- Or as prompt bundles inside the main orchestrator skill (initial approach for speed)

| Sub-Agent | Verb-Led Role | Primary Inputs | Primary Outputs | Key Existing Systems It Uses | Quality Gate |
|-----------|---------------|----------------|-----------------|------------------------------|--------------|
| **Intake & Classification** | Classify incoming presupuestación request and extract intent | Raw request (chat, WA, ML, batch, manual) | Structured intent + initial context | agentChat patterns, wolfboard | Intent confidence > threshold |
| **Context Builder** | Assemble rich, relevant context | Intent + quote data | RAG results + relevant KB examples + historical similar cases | rag.js, trainingKB (cached), embeddings | Semantic relevance score |
| **Pricing & BOM Reviewer** | Review calculations for anomalies and optimization | Context + calc payload | Reviewed payload + flags + recommendations | agentTools (calc), calculations engine | Anomaly score + price sanity checks |
| **Document Gatekeeper** | Validate PDF output quality | Reviewed payload + generated PDF | Pass/fail + issues list + suggested fixes | pdfGenerator, `/api/pdf/metrics`, templates | Completeness + visual/layout rules |
| **Delivery & Sync Coordinator** | Handle delivery and initial sync | Approved document | Delivery confirmations + sync status | WA libs, CRM dual-write, Drive | Delivery success + sync confirmation |
| **Approval Router** | Create and monitor human approval tasks | Delivery artifacts | Task created + resolution status | hub-tasks module (when unblocked) | Task resolution or timeout policy |
| **Post-Mortem & Learning** | Extract value and improve system | Full run trace + outcome | Learning pairs + cost summary + improvement suggestions | autoLearnExtractor, trainingKB | Learning value score |
| **Monitor & Alert** | Track flow health and trigger alerts | Telemetry events | KPI updates + alerts | New telemetry layer + existing logs | KPI thresholds |

**Conductor owns**:
- The overall DAG / saga state machine
- Decision to invoke which sub-agents and in what mode (Profundo / Ligero)
- Cost aggregation and budget enforcement
- Human gate decisions when policy requires it
- Final run closure and Paso 9 handoff

---

## 5. Handoff & Communication Protocol

**Mandatory Rules** (drawn from historical patterns):
- Every handoff from Conductor → Specialist (or between specialists) must produce a concrete artifact (markdown file or structured JSON in a known location).
- The Conductor maintains a living **Handoff Table** (similar to the orchestrator agent in the project).
- All handoffs include: `from`, `to`, `purpose`, `input_artifact_path`, `expected_output`, `deadline`, `quality_criteria`.
- Specialists must return both the output artifact **and** a short "handoff note" with confidence and open issues.

This pattern has proven extremely effective in the project's full-team runs.

---

## 6. Integration Strategy

### Immediate Leverage (Post Phase 0)
- **All LLM calls** inside the orchestrator and its sub-agents must use `aiProviderConfig.resolveModel()` + `estimateCostUSD()`.
- **Quick wins** (allowed under freeze):
  - Migrate `agentCore.js` to use central config.
  - Add cost logging to `wolfboard.js` and `superAgent.js`.
  - Create thin wrapper `presupFlowCall()` that forces observability.

### Hub-Tasks Integration (High Priority)
Once the 3 infra blockers are resolved:
- The orchestrator becomes the primary **creator** of approval tasks for presup flows.
- Task status changes become events the orchestrator can react to (closed-loop automation).
- This is the main mechanism for achieving the "90%+ zero manual intervention" goal while keeping humans in control of final approval.

---

## 7. Observability, Cost & Quality Guardrails

**Required Capabilities** (must be designed into the skill):
- Per-run cost tracking (sum of all `estimateCostUSD` calls).
- Per-step latency and success/failure.
- Quality gates at critical boundaries (pricing review, document gate, approval).
- Integration with `promptfoo` skill for regression testing of prompts used by sub-agents.
- Export of run traces for Judge-style evaluation.

**Target Metrics** (from base plan):
- Time per presupuestación (avg + p95)
- % of runs requiring manual intervention
- Accuracy vs historical baseline
- Total cost per run
- Conflict rate in hub-tasks (once integrated)

---

## 8. Phased Rollout (Respecting Feature Freeze)

**Now (under freeze)**:
- This architecture document
- Full `presupuestacion-orchestrator` skill design + examples
- Promptfoo eval suite for core paths
- Identification of quick-win migrations (agentCore, wolfboard cost logging)
- Detailed implementation roadmap with freeze vs post-freeze items

**Post-freeze or with exception**:
- Actual wiring of orchestrator into intake points
- Creation of first real sub-agent prompts/skills
- Integration with hub-tasks (once infra is live)
- Production monitoring dashboard

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|----------|
| Feature freeze blocks meaningful progress | High | Medium | Focus on skill design + evals + docs now; clear "post-freeze" roadmap |
| Fragmented AI surfaces make orchestration hard | Medium | High | Prioritize migration of `agentCore` + wolfboard as early post-freeze work |
| hub-tasks infra stays blocked | Medium | High | Design orchestrator to work with manual task creation as fallback |
| Over-engineering the first version | Medium | Medium | Start with 4-5 core sub-agents + strong conductor; expand later |
| Cost explosion from many LLM calls | Medium | Medium | Conductor-level budget enforcement + cheap/fast model defaults via aiProviderConfig |

---

## 10. Open Questions & Assumptions

**Assumptions**:
- User has (or will have) access to Grok 4.3 heavy reasoning for the orchestrator.
- The three hub-tasks infra blockers will be resolved within the next 4-6 weeks.
- The project wants to keep humans in the final approval loop for the foreseeable future (orchestrator creates + monitors tasks rather than fully auto-approving).

**Open Questions** (to be resolved before or during skill writing):
1. Should sub-agents live as separate Grok skills or as prompt modules inside the main orchestrator skill initially?
2. What is the exact schema for the "presup run state" object the conductor will maintain?
3. How aggressive should the initial cost budgets be?
4. Should we introduce a "Presup Flow" event bus (lightweight) or rely on polling + handoffs?

---

## 11. Recommended Next Steps

1. Review and refine this architecture document.
2. Once approved, proceed to writing `~/.grok/skills/presupuestacion-orchestrator/SKILL.md` using the agent-forge methodology (tight roles, real examples, restrictions, evals).
3. In parallel or immediately after: Create the first promptfoo eval cases for the most critical gates.
4. Update `docs/team/AGENTS.md` with the new orchestrator.
5. Produce the detailed implementation roadmap with clear freeze boundaries.

---

**Document Status**: Ready for review and iteration.

This represents the synthesis a high-reasoning Grok would produce after parallel research before writing the actual skill implementation.

---

*Generated as part of Heavy Grok execution of the approved 100% automation closure plan.*