---
title: System Design Document — PAOS
version: 1.0
date: 2026-07-24
status: Accepted
author: sdd-architect (final development Spec)
system_slug: paos
related_slug: panelin-ai-agent-platform
source: hybrid-target-plus-as-built-evidence
target_path: /Users/matias/calculadora-bmc
companion_skill: sdd-architect@compatible
research_seal: PAOS-RESEARCH-PROGRAM|v1.0|2026-07-23|ES-UY
development_glory: "G1 complete — G2 implements IMP-PAOS-01..09 from IMPLEMENTATION-GUIDE"
architect_finalized: 2026-07-24
architect_note: "Final development Spec — implement SDD-TARGET + IMPLEMENTATION-GUIDE; do not redesign"
architect_session: "2026-07-24T12:14:39Z finalize-only after evolution STOP at 98"
---

# System Design Document: PAOS

> **PAOS** = Panelin Adaptive Operational System — **supervised** operational learning layer.  
> Tags: **CONFIRMED** | **TARGET** | **INFERRED** | **UNKNOWN**.  
> Parent: [`../panelin-ai-agent-platform/SDD.md`](../panelin-ai-agent-platform/SDD.md).  
> Evidence: [`evidence/as-built-learning-surfaces.md`](evidence/as-built-learning-surfaces.md) · [`evidence/turn-session-telemetry.md`](evidence/turn-session-telemetry.md) · [`evidence/g2-runtime-as-built.md`](evidence/g2-runtime-as-built.md).  
> **Develop this Spec:** [`SDD-TARGET.md`](SDD-TARGET.md) · [`IMPLEMENTATION-GUIDE.md`](IMPLEMENTATION-GUIDE.md) · [`DEVELOPMENT-GLORY.md`](DEVELOPMENT-GLORY.md) · [`ARCHITECT-FINAL.md`](ARCHITECT-FINAL.md).  
> **Audit:** composite **98** PASS (`audit/SCORECARD.json`, re-scored 2026-07-24).

**Vocabulary:** “Self-evolving agent” is **not** a PAOS technical mode. Learning = **component evolution** (prompt, memory/RAG, skill schema, workflow) under HITL — never autonomous weight mutation.

### Development contract (G2 — binding)

| Rule | Requirement |
|------|-------------|
| Money | Only `/calc` engine; never invent prices in Learning Candidates |
| Loop | Fast Loop **read-only** for org rules; Slow Loop owns all learning writes |
| Promote | Eval fail-closed + superadmin HITL; no `drafted → active` |
| Workspace | With `PAOS_ENABLED=1`, knowledge CR must not silent-active permanent |
| Flags | Default `PAOS_*=0` preserves current prod behavior |
| Scope | IMP-PAOS-01→04→09 first; no fine-tune; no mandatory LangGraph |

## 1. Introduction & Goals

### 1.1 Problem Statement

Panelin serves multi-channel commercial AI for BMC Uruguay with Training KB, autolearn, Workspace CR approve, goldens, and partial telemetry. Missing is a **safe closed loop**: corrections → **Learning Candidates** → **oracle-backed offline eval** → **HITL** → **versioned promote** with **canary + rollback**, without unsafe money or global-knowledge mutation.

### 1.2 Goals

| ID | Goal | Priority | Status |
|----|------|----------|--------|
| G1 | Dual-loop Fast never mutates rules mid-turn | High | TARGET |
| G2 | Promotions versioned, evaluable, reversible | High | TARGET |
| G3 | Money-adjacent via `/calc` oracle + goldens | High | TARGET |
| G4 | Unified Event Ledger | High | TARGET (fragments CONFIRMED) |
| G5 | Learning Candidate SM + HITL | High | TARGET |
| G6 | Canary + 1-click rollback | Medium | TARGET |
| G7 | Reuse Training KB / goldens / Workspace | High | TARGET |
| G8 | Spec-driven G2 implementation | High | Accepted Spec |

### 1.3 Stakeholders

| Role | Team | Interest |
|------|------|----------|
| Operador | BMC | Better answers, safe prices |
| Superadmin | BMC | Approve/reject/rollback |
| Engineering | Panelin | Flags, SM, tests |
| Security | BMC | Privacy, audit |

## 2. Context & Scope (C4 Level 1)

```mermaid
C4Context
  title System Context — PAOS
  Person(op, "Operador BMC", "Corrections")
  Person(admin, "Superadmin", "Approve learning")
  Person(eng, "Engineer", "Evals / flags")
  System(paos, "PAOS", "Slow-loop supervised learning")
  System_Ext(panelin, "Panelin Fast Loop", "agentChat / agentCore")
  System_Ext(calc, "Calculadora /calc", "Money oracle")
  System_Ext(kb, "Training KB + RAG", "Active knowledge")
  System_Ext(ws, "Panelin Workspace", "CR propose/approve")
  System_Ext(eval, "Goldens + promptfoo", "Offline regression")
  System_Ext(pg, "Postgres", "Ledger + candidates + tool_calls")
  System_Ext(llm, "LLM providers", "Distill only")
  System_Ext(gcs, "GCS", "training-kb.json mirror")
  Rel(op, panelin, "Chat")
  Rel(op, ws, "Knowledge CR")
  Rel(admin, paos, "Approve / rollback")
  Rel(panelin, kb, "Read active")
  Rel(panelin, calc, "Quote tools")
  Rel(panelin, paos, "Observation events")
  Rel(ws, paos, "Override / CR events")
  Rel(paos, eval, "Offline suite")
  Rel(paos, calc, "Oracle checks")
  Rel(paos, kb, "Versioned promote")
  Rel(paos, pg, "Persist SM")
  Rel(paos, llm, "Extract")
  Rel(kb, gcs, "Cloud Run mirror")
  Rel(eng, eval, "Maintain goldens")
```

### External interfaces

| Interface | Direction | Protocol | Auth | Description |
|-----------|-----------|----------|------|-------------|
| Fast Loop | ← events | in-process | service | Turn/tool signals |
| Workspace CR | ↔ | HTTPS | JWT superadmin | Knowledge approve CONFIRMED |
| Training KB routes | ↔ | HTTPS | Dev mode | CRUD/autolearn CONFIRMED |
| `/calc/*` | → | HTTP loopback | same process | Money oracle |
| Postgres | ↔ | SQL | DATABASE_URL | TARGET ledger; tool_calls CONFIRMED |
| Goldens | → | CLI | CI | `GOLDEN_REQUIRED=1` CONFIRMED |
| LLM extract | → | HTTPS | API keys | Autolearn |
| GCS | ↔ | HTTPS | ADC | KB mirror |

## 3. Constraints

- Stack: Node ESM, Express 5, React 18, Postgres monorepo.
- Money: calculator sole SoT (ADR-003). No PAOS fine-tune (ADR-001).
- HITL for org-wide active (ADR-004). Fast Loop `user_confirmed` unchanged.
- Secrets: Doppler/GSM names only.
- Privacy: redact PII; retention TARGET 90d ledger / 365d candidates; legal **UNKNOWN**.
- Flags TARGET: `PAOS_ENABLED`, `PAOS_PROMOTE`, `PAOS_CANARY_PCT`, `PAOS_LEDGER_RETENTION_DAYS` default safe/off.
- LangGraph optional pattern only (ADR-006).

## 4. Solution Strategy

- Transversal layer in modular monolith + Workspace UI.
- **Dual-loop (ADR-002):** Fast reads **active** knowledge only; Slow async observe → candidate → eval → HITL → canary → promote → rollback.
- Learning units: KB, prompts, skill notes, workflows — not weights.
- Eval: goldens + `/calc`; LLM judge soft-only.
- Persistence: owned Postgres + JSON/GCS KB (ADR-005).

## 5. Container View (C4 Level 2)

```mermaid
C4Container
  title Container diagram — PAOS
  Person(op, "Operador", "Corrections")
  Person(admin, "Superadmin", "Approvals")
  Container_Boundary(fast, "Fast Loop — Panelin") {
    Container(chat, "agentChat / channels", "Node SSE", "Serve")
    Container(core, "agentCore + tools", "Node", "Tool-grounded brain")
    Container(calcC, "/calc", "Node", "Pricing oracle")
  }
  Container_Boundary(paosB, "Slow Loop — PAOS TARGET") {
    Container(ledger, "Event Ledger", "Node+PG", "Append-only")
    Container(distill, "Distiller", "Node", "Delta → candidate")
    Container(cand, "Candidate SM", "Postgres", "States + eval")
    Container(evalR, "Eval Runner", "Node CLI", "Goldens + oracle")
    Container(promoter, "Promoter", "Node", "Versioned KB write")
  }
  Container_Boundary(ui, "Governance") {
    Container(ws, "Workspace", "React", "CR review")
    Container(dev, "Dev / Gym", "React", "Train / autolearn")
  }
  Container_Boundary(data, "Data") {
    ContainerDb(pg, "Postgres", "events, candidates, tool_calls")
    ContainerDb(kbfile, "KB JSON/GCS", "active entries")
    ContainerDb(gold, "agentGolden", "git cases")
  }
  Rel(op, chat, "HTTPS")
  Rel(op, ws, "HTTPS")
  Rel(admin, cand, "approve")
  Rel(chat, core, "in-process")
  Rel(core, calcC, "loopback")
  Rel(chat, ledger, "events")
  Rel(ws, ledger, "overrides")
  Rel(ledger, distill, "async")
  Rel(distill, cand, "write")
  Rel(cand, evalR, "evaluate")
  Rel(evalR, gold, "read")
  Rel(evalR, calcC, "oracle")
  Rel(promoter, kbfile, "promote")
  Rel(promoter, pg, "version pointer")
  Rel(core, kbfile, "read active")
  Rel(core, pg, "tool_calls CONFIRMED")
```

| Container | As-built | Target |
|-----------|----------|--------|
| Training KB | JSON/GCS + routes | + version pointer / canary |
| Autolearn | Extract + pending | Feed Candidate SM |
| Workspace CR | Direct active permanent | Promoter gate when PAOS on |
| Observation | chat_turn JSONL + tool_calls | Unified agent_events |
| Eval | CI goldens | On every promote path |

## 6. AI Architecture — Component View

| Component | Responsibility | Tech | Status |
|-----------|----------------|------|--------|
| Fast Loop brain | Serve; tools; read KB | agentCore / agentChat | CONFIRMED parent |
| Event emitter | Observation | `appendTrainingSessionEvent` + `recordToolCall` CONFIRMED → TARGET ledger | PARTIAL |
| Event Ledger | Append-only | Postgres | TARGET |
| Distiller | Candidate structure | autoLearnExtractor MIN_CONFIDENCE 0.70 CONFIRMED | PARTIAL |
| Candidate SM | States + reports | Postgres | TARGET |
| Eval Runner | Goldens + oracle | agentGolden, /calc | PARTIAL |
| Approval UI | HITL | Workspace + Dev pending | PARTIAL |
| Promoter | Versioned writes | trainingKB | PARTIAL (unsafe path CONFIRMED) |
| Canary / Rollback | Limited roll-out | flags + pointer | TARGET |
| LLM Gateway | Provider chain | parent | CONFIRMED — not money truth |

### LLM strategy
Weights static; distill via existing extract; judge soft-only; money `/calc` only.

### Memory
Episodic: session JSONL CONFIRMED. Semantic: Training KB. Procedural: prompts/goldens. Working: context window.

### Cost model (learning)
Autolearn LLM tokens capped by confidence 0.70 and max pairs; offline eval batched; Fast Loop cost telemetry parent-owned.

## 7. Data Flow

### 7.1 Fast Loop

```mermaid
sequenceDiagram
  participant U as Operador
  participant F as Fast Loop
  participant KB as Active KB
  participant C as /calc
  participant L as Ledger
  U->>F: Message
  F->>KB: Read
  F->>C: Quote tools
  C-->>F: Totals
  F-->>U: Answer
  F->>L: chat_turn / tool events
```

### 7.2 Slow Loop promote (TARGET)

```mermaid
sequenceDiagram
  participant U as Operador
  participant W as Workspace
  participant L as Ledger
  participant D as Distiller
  participant Cand as Candidate SM
  participant E as Eval
  participant A as Superadmin
  participant P as Promoter
  participant KB as Training KB
  U->>W: Correction / CR
  W->>L: USER_OVERRIDE
  L->>D: Delta
  D->>Cand: drafted
  Cand->>E: evaluate
  E-->>Cand: pass/fail
  alt fail
    Cand-->>Cand: rejected_auto
  else pass
    A->>Cand: approve
    Cand->>P: canary
    P->>KB: versioned entry
    A->>P: rollback if regression
  end
```

### 7.3 State machine (TARGET)

```text
detected → drafted → evaluating → pending_approval → canary → active → rolled_back | rejected
```

Illegal: `drafted → active` without eval+approve.

### 7.4 ERD (TARGET)

```mermaid
erDiagram
  AGENT_EVENTS ||--o{ LEARNING_CANDIDATES : may_spawn
  LEARNING_CANDIDATES ||--o{ LEARNING_VERSIONS : promotes
  LEARNING_VERSIONS ||--o| KB_ACTIVE_POINTER : points
  AGENT_EVENTS { uuid id PK string type jsonb payload timestamptz ts }
  LEARNING_CANDIDATES { uuid id PK string state jsonb eval_report }
  LEARNING_VERSIONS { uuid id PK uuid candidate_id jsonb artifact }
  KB_ACTIVE_POINTER { string channel PK uuid version_id string mode }
```

### 7.5 Admin API sketch (TARGET)

See [`openapi-paos-sketch.yaml`](openapi-paos-sketch.yaml). Paths: `/api/paos/candidates`, approve/reject, `/api/paos/versions/{id}/rollback`, `/api/paos/events`, `/api/paos/metrics`.

## 8. Deployment View

```mermaid
C4Deployment
  title Deployment — PAOS on Calculadora-BMC
  Deployment_Node(vercel, "Vercel", "SPA") {
    Container(spa, "calculadora-bmc", "React", "Dev + hub")
    Container(wsui, "panelin-workspace", "React", "CR UI")
  }
  Deployment_Node(cr, "Cloud Run panelin-calc", "API") {
    Container(api, "Express", "Node", "Fast + PAOS TARGET")
    Container(worker, "PAOS worker", "Node", "Async colocate ok")
  }
  Deployment_Node(data, "Data") {
    ContainerDb(pg, "Cloud SQL", "Postgres")
    ContainerDb(gcs, "GCS", "kb/training-kb.json")
  }
  Rel(spa, api, "HTTPS JWT")
  Rel(wsui, api, "HTTPS JWT")
  Rel(api, pg, "SQL")
  Rel(api, gcs, "KB sync")
```

| Concern | Choice | Evidence |
|---------|--------|----------|
| API service | Cloud Run **panelin-calc** us-central1 project chatbot-bmc-live | CONFIRMED OPS / parent SDD |
| Prod API URL | `https://panelin-calc-q74zutv7dq-uc.a.run.app` | CONFIRMED parent SDD |
| Frontend | Vercel calculadora-bmc.vercel.app | CONFIRMED OPS |
| Colocation | Same Express as Fast Loop | TARGET |
| Flags | PAOS_* default 0/safe | TARGET |
| CI | pre-release GOLDEN_REQUIRED=1 | CONFIRMED package.json:106 |

## 9. Crosscutting Concepts

### 9.1 Security
Superadmin promote/rollback; eval fail-closed; no worker auto-activate org-wide; money-adjacent need oracle; PII redaction; retention TARGET 90/365d legal UNKNOWN.

### 9.2 Reliability
Ledger async non-blocking Fast Loop; eval timeout fail-closed; transactional promote.

### 9.3 Performance
Fast Loop unchanged; Slow batch; rate-limit distill.

### 9.4 Observability

| Concern | As-built CONFIRMED | Target |
|---------|-------------------|--------|
| Chat turns | `appendTrainingSessionEvent` chat_turn `agentChat.js:1524-1544` | ledger agent.turn |
| Session JSONL | `trainingKB.js:672-679` data/training-sessions/ | ingest |
| Tools | `recordToolCall` toolStats.js:91 agentTools.js:1410 | ledger agent.tool |
| Train mutations | agentTraining.js train_* events | kb.mutate |
| logAgentTurn.js | **ABSENT** — use table above | do not invent |

### 9.5 Canary SLOs (TARGET)
Golden regression >5% → rollback; override rate +20% vs 7d; any /calc hard fail; min 48h or 50 staff sessions before full.

### 9.6 Cost
Prefer programmatic delta; golden subset on canary; no GPU swarm.

## 10. Architecture Decisions (ADRs)

### ADR-001: No fine-tune in PAOS
**Status**: Accepted  
**Context**: Weight updates forget rules and lack 1-click rollback.  
**Decision**: Application artifacts only.  
**Consequences**: + Reversible. − No RLHF style auto-shift.  
**Alternatives**: Online DPO — rejected v1.

### ADR-002: Dual-loop Fast/Slow
**Status**: Accepted  
**Context**: Mid-turn rule mutation risks mid-quote inconsistency.  
**Decision**: Fast read-only for rules; Slow async learning writes.  
**Consequences**: + Safety. − Not same-turn learning.  
**Alternatives**: Mid-session prompt rewrite — rejected.

### ADR-003: Calc oracle + goldens
**Status**: Accepted  
**Context**: LLM self-judge unreliable for money.  
**Decision**: Money-adjacent need goldens and/or `/calc`; LLM judge never sole.  
**Consequences**: + Trust. − Eval work.  
**Alternatives**: LLM-only judge — rejected.

### ADR-004: HITL for org promote
**Status**: Accepted  
**Context**: Workspace approve writes `status: "active"`, `permanent: true` without eval — `workspace.js:551-558` CONFIRMED.  
**Decision**: Org-wide active requires human after eval; canary staff-only ok.  
**Consequences**: + Governance. − Review load.  
**Alternatives**: Auto-promote high confidence — rejected.

### ADR-005: Owned Postgres ledger/candidates
**Status**: Accepted  
**Context**: Need tombstone/version/audit; already Postgres + tool_calls.  
**Decision**: Own tables; no mandatory memory SaaS v1.  
**Consequences**: + Control. − Build cost.  
**Alternatives**: Letta/Zep SoT — deferred.

### ADR-006: LangGraph pattern not mandate
**Status**: Accepted  
**Context**: Durable multi-day HITL.  
**Decision**: Durable SM in Postgres; LangGraph.js optional.  
**Consequences**: + Avoid lock-in. − Careful SM tests.  
**Alternatives**: Mandate LangGraph — deferred.

## 11. Risks & Technical Debt

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Direct active promote as-built | High | High | IMP-PAOS-04 |
| Distill invents prices | High | Medium | Oracle + autolearn rules |
| Fragmented observation | Medium | High | Event Ledger |
| Privacy over-capture | High | Medium | Redaction + retention |
| Spec wipe / empty slug | High | Observed | Structural test in test:core |
| Premature LangGraph | Medium | Medium | ADR-006 |

## 12. Glossary

| Term | Definition |
|------|------------|
| PAOS | Panelin Adaptive Operational System |
| Fast Loop | Live serve; reads active knowledge only |
| Slow Loop | Observe → candidate → eval → HITL → promote |
| Learning Candidate | Proposed artifact + eval + approval state |
| Event Ledger | Append-only observations |
| Calc oracle | Deterministic `/calc` for money |
| Canary | Limited audience new version |
| Component evolution | Prompt/memory/skill/workflow — not weights |
| Goldens | tests/agentGolden cases |
| HITL | Human-in-the-loop |

## Appendix A — Evidence Index
[`evidence/as-built-learning-surfaces.md`](evidence/as-built-learning-surfaces.md) · [`evidence/turn-session-telemetry.md`](evidence/turn-session-telemetry.md)

## Appendix B — Recreation Checklist
[`RECREATION-CHECKLIST.md`](RECREATION-CHECKLIST.md)
