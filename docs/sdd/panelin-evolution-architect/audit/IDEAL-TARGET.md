# Ideal 100% — Panelin Evolution Architect (PEA)

## Target composite: 100 (pass ≥90) — **current 92 PASS**

## System class

Target Spec for an **AI evolution / slow-loop agent platform** embedded in a commercial monolith (not yet As-Built).

## Must-have artifacts

- [x] `SDD.md` (12 sections) — v1.2.1
- [x] `RECREATION-CHECKLIST.md` (M0; live-probe N/A until human)
- [x] `contracts/schemas/` — GapEvent, Gap, EvolutionPacket, Grant, AnalysisRun
- [x] `contracts/openapi-pea.yaml` — `/api/pea/*`
- [x] `migrations/pea/*.sql` — `001_pea_core.sql`
- [x] `evidence/` with path:line for AuthZ/budget/queue claims (partial G-08)
- [ ] `evidence/live-probe.md` (IMP-PEA-00) — template only; human ops

## Section-specific ideal

### §5 Containers
- [x] Worker topology locked (ADR-011 1C)
- [x] C4Component for Architect (§6.0)

### §6 AI
- [x] EvolutionPacket JSON Schema
- [x] Critic before `ready_for_review`
- [x] Evolution lanes H/K/C
- [ ] Prompt registry `pea:*` phases wired (M1+ runtime)

### §8 Deployment
- [x] Single chosen worker path documented
- [ ] Migrate command in CI (M1)
- [ ] Env matrix prod vs staging (M4 staging)
- [x] `PEA_*=0` default

### §9 Crosscutting
- [ ] PII field denylist operational (G-10 P2)
- [x] Grant TTL in schema (`expires_at`)

## Acceptance test

"A developer with repo access can implement M1 (preflight + pea schema + jobs) and M2 (GapEvent → packet) using only this SDD + contracts + checklist, without inventing API shapes, in &lt;2 days for M1 and &lt;1 week for M2."

**M0 assessment:** **Met for design/contracts.** Runtime not required for this test at M0.

## What 100% does *not* require

- Runtime shipped in prod  
- OpenCode integrated  
- Staging already built (must be *specified* and gated)
