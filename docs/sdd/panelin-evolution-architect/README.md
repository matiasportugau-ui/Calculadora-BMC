# SDD — Panelin Evolution Architect (PEA)

**Slug:** `panelin-evolution-architect` (alias **PEA**)  
**Status:** Target Spec **v1.2** (2026-08-09) — A′ lanes + Critic + threshold; Module 1 = **ArchitectRuntime** (1a)  
**Purpose:** Full specification for a private evolution brain beside Panelin: GapEvent → preflight → explore/plan → EvolutionPacket → HITL grants → optional implement (Cursor/OpenCode later).  
**Parent:** [`../panelin-ai-agent-platform/`](../panelin-ai-agent-platform/) · Sibling learning: [`../paos/`](../paos/) (knowledge ≠ code evolution)

## Start here

| Doc | Use |
|-----|-----|
| [`SDD.md`](SDD.md) | Full Spec §1–12 (SoT for build) |
| [`SDD-TARGET.md`](SDD-TARGET.md) | North-star capabilities T1–T14 |
| [`IMPLEMENTATION-GUIDE.md`](IMPLEMENTATION-GUIDE.md) | Ordered IMP-PEA-XX path |
| [`contracts/`](contracts/) | Machine-readable policy seals |
| [`ADRs/`](ADRs/) | Architecture decisions |

## Locked product decisions

| Decision | Value |
|----------|--------|
| Integration | Native PEA in Calculadora; OpenCode/Cursor = L3+ **implementer adapters** |
| Default autonomy | **L0–L5 ladder**; default max **L2**; L3–L5 only with durable grant (Module 2 locked) |
| Runtime | Single **ArchitectRuntime** (models = phase config; not dual router/runner) |
| Cost | AnalysisPreflight mandatory; PEA budget separate from Panelin/Omni |
| Queue MVP | PostgreSQL outbox + `pea_jobs` (pattern from `omni_ai_jobs`); no Pub/Sub yet |
| Persist | Schema `pea.*` in PostgreSQL — not Git/Sheets/chat |
| Staging | Treat as **absent** until proven; required for L3+ / write replay |
| Module 7 | Permissions + doom-loop **after** MVP (M3); not blocking M1–M2 |
| Module 8 | MVP L0–L2 **no staging**; M4 staging → L3 adapters (OpenCode last) |
| Module 9 | Ratchet **obligatorio** al cerrar (≥1 golden \| sensor \| provenance) |
| Module 10 | **10a** MVP = M0→M2c (L0–L2); ratchet humano en Accept; L3/staging/OpenCode fuera |

## Relationship to PAOS (Module 5 locked = **5a**)

| | PAOS | PEA |
|--|------|-----|
| Learns | Org knowledge (Training KB) | Harness / product / code (EvolutionPacket) |
| Money | `/calc` oracle on promote | Architect must not invent prices; calc gaps → product fix |
| Autonomy | HITL promote | Explicit grant ladder L0–L5 |
| Mid-turn | Fast loop never writes org KB | Fast loop never opens PRs |
| Bridge | Receives Lane **K** candidates from PEA | Does **not** own PAOS promote SM |
| Ingest | May share GapEvent/session signals | Shared observation; separate promote |

## Audit (2026-08-09)

| Artifact | Result |
|----------|--------|
| [`audit/SCORECARD.json`](audit/SCORECARD.json) | Composite **82** — fail ≥90 |
| [`audit/AUDIT.md`](audit/AUDIT.md) | Human summary |
| [`audit/GAP-PLAN.md`](audit/GAP-PLAN.md) | P0 schemas/DDL/OpenAPI |
| [`audit/EVOLUTION-PROPOSAL.md`](audit/EVOLUTION-PROPOSAL.md) | External research → lanes H/K/C |

## Next command for agents

```text
1. Q&A locked — read audit/EVOLUTION-PROPOSAL.md §6–7
2. M0: close GAP-PLAN P0 (schemas/DDL/OpenAPI/RECREATION-CHECKLIST) → re-score ≥90
3. Then M1 IMP-PEA-02/03 (preflight + pea_jobs); PEA_*=0
4. Do not implement L3+/OpenCode/staging until M4
```
