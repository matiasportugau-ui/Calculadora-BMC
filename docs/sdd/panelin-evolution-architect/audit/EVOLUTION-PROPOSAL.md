# EVOLUTION-PROPOSAL — PEA concept (post-audit + external research)

**Date:** 2026-08-09  
**Inputs:** SDD v1.0 audit composite **82**; Module 0 Q&A hesitation; external systems below.  
**Goal:** Help decide Module 0 and evolve the Spec before runtime spend.

---

## 1. Why “two brains” felt uncertain (fair critique)

| Worry | Valid? | Reality check |
|-------|--------|----------------|
| Too much bureaucracy (gaps nobody reviews) | Yes | Spec already lists “packet theater” risk |
| Duplicating Cursor/OpenCode | Partially | L1–L2 diagnosis ≠ coding agent; L3+ *is* those tools |
| One agent would be simpler | Emotionally yes | Threat-model merge (CRM money + bash) is the real cost |
| PAOS already “learns” | Partial | PAOS = knowledge; most gaps are harness/code |

**Verdict:** Doubt the *shape* of evolution targets, not the need for a slow loop.

---

## 2. What the best external systems actually do

| System | Core idea | What PEA should steal | What PEA should *not* copy |
|--------|-----------|----------------------|----------------------------|
| **[Kitchen Loop](https://arxiv.org/html/2603.25697)** (2026) | Spec surface + synthetic user ×1000 + unbeatable tests + drift pause | Anchor every EvolutionPacket to **Spec/golden/oracle**; measure drift; pause autonomy on regression | Full autonomous PR flood without HITL (you rejected silent autonomy) |
| **[Reflexloop](https://github.com/nayyarsan/reflexloop)** | Critique session → threshold (≥3) → refine **prompts/skills** in git | Threshold before expensive Architect; evolve **harness** (prompts/tools/goldens) as first-class | Auto-commit prompt changes without your grant |
| **[Prime Agent /refine](https://www.primeintellect.ai/blog/prime-agent)** | CRUD smallest edit on prompts/skills/memory/subagents from trajectory | Prefer **minimal harness patch** over big code redesign when that fixes the gap | Unbounded self-CRUD of whole agent |
| **Reflexion** (Shinn et al.; prod writeups) | Generate → evaluate → reflect → regenerate; persist episodic memory | **Critic** before `ready_for_review`; store reflections per fingerprint | In-memory-only reflections |
| **[OpenHands SDK](https://docs.openhands.dev/sdk/arch/agent)** | Event-sourced log; stuck detection; security analyzer pre-action | Event log for analysis_runs; stuck/doom detection; security gate before L3 actions | Running their full SDK in Cloud Run as PEA core |
| **Polaris** (Gödel / policy repair) | Failures → abstract reusable strategies → small tested policy patches | Fingerprint → **strategy card** reusable on similar gaps | Recursive self-mod of model weights |
| **OpenCode** (anomalyco) | Client/server coding agent; permissions; explore/plan | Patterns for L3+ ExecutionRunner + permission rulesets | Treating OpenCode as “the model” or prod Bun runtime |

### Pattern consensus (industry)

```text
Failure/gap
  → persist + dedupe + threshold
  → retrieve evidence (spec, tests, traces)
  → diagnose
  → prefer smallest durable fix:
        (1) harness/policy/prompt/golden
        (2) knowledge (PAOS)
        (3) product/code PR
  → critic / oracle / tests
  → HITL or explicit grant
  → ratchet so recurrence is cheaper
```

PEA v1.0 already has: persist, dedupe, preflight, explore/plan, HITL ladder.  
PEA v1.0 is weak on: **threshold**, **critic**, **harness-first evolution**, **spec-anchored packets**.

---

## 3. Proposed evolution of the concept (not a rewrite of dual-loop)

### Keep (confirmed)

- Fast Panelin ≠ Slow evolution loop  
- AnalysisPreflight + PEA budget isolation  
- Durable grants L3–L5  
- Postgres outbox/jobs  
- OpenCode as ExecutionRunner later  

### Change (ADR-010 draft): three evolution **lanes**, one PEA runtime

```text
                    ┌─ Lane H — Harness (prompts, tool schemas, goldens, sensors)
 Gap / failure ──► PEA ─┼─ Lane K — Knowledge (bridge → PAOS candidate)
                    └─ Lane C — Code/product (EvolutionPacket → PR via runner)
```

| Lane | Default autonomy | When |
|------|------------------|------|
| **H Harness** | L2 design + optional L3 PR on `.cursor`/prompts/goldens with grant | Repeated tool misuse, hedge patterns, missing golden |
| **K Knowledge** | Hand off to PAOS SM (no code PR) | Org Q&A / commercial tip |
| **C Code** | L2 packet; L3+ only with grant + staging | Missing capability, bug, architecture change |

**This resolves Module 0:** you still have **two runtimes** (Panelin + PEA), but PEA is not “always a coding agent.” Often it should behave like Reflexloop/Prime refine (harness), sometimes like PAOS (knowledge), sometimes like OpenCode (code).

### Add (ADR-009 draft): Critic before ready_for_review

```text
explore → plan → Critic(packet, evidence, goldens/SDD)
                 ├─ pass → ready_for_review
                 └─ fail → revise once or DECOMPOSE
```

Critic checks: Spec citation present? Money claims require `/calc` provenance? Blast radius stated? Ratchet plan non-empty?

### Add: Threshold gate (Reflexloop-style)

Before AUTO_RUN L1–L2 spend:

- `occurrences >= N` (default 3) **OR**  
- `severity >= high` **OR**  
- explicit human “diagnose now”

Stops burning $0.50 on one-off noise.

### Add: Spec-anchored packet (Kitchen Loop)

Every EvolutionPacket **must** reference ≥1 of:

- SDD section / TARGET id  
- Golden case id  
- `test:fitness` / harness sensor  
- Tool id from SideEffectRegistry  

No free-floating architecture essay.

### Soften: default evolution preference order

When multiple lanes apply: **H → K → C** (smallest durable fix first). Code PR is last resort, not the brand identity of PEA.

---

## 4. Alternatives if you reject “two brains”

| Choice | Meaning | When it wins |
|--------|---------|--------------|
| **A′ Multi-lane PEA (recommended)** | Two runtimes; three lanes | Your case: commercial agent + private improvement |
| **B Mega-agent** | Panelin also codes | Only if you accept money+bash same process and stronger sandbox |
| **C External only** | Gaps → GitHub Issue → human Cursor | If you won’t staff Gym HITL |
| **D PAOS-only** | Knowledge loop only | If almost all gaps are conversational tips (they’re not) |
| **E Kitchen-first** | Spec + synthetic ops user before PEA Architect | If you want quality gates before any LLM diagnosis spend |

**Recommendation:** **A′** (evolve A, don’t abandon it). Closest to Kitchen + Reflexloop + your HCS/PAOS investment.

---

## 5. Spec patches to reach ≥90 (doc) then build

Ordered with audit gaps:

1. **Contracts P0** — schemas + DDL + OpenAPI + RECREATION-CHECKLIST (G-01..04)  
2. **ADR-009 Critic + ADR-010 Lanes** (G-06, G-07, G-12)  
3. Fingerprint + worker lock (G-05, G-11)  
4. Evidence citations + live probe (G-08, G-09)  
5. Re-score auditor  
6. Runtime M1 (preflight + jobs) only after pass **or** written waiver  

---

## 6. Decisions — LOCKED

| Module | Choice | Spec |
|--------|--------|------|
| 0 | **A′** multi-lane H→K→C + Critic + threshold | v1.1 → ADR-009/010 |
| 1 | **1a** unified **ArchitectRuntime** | **v1.2** → ADR-001 revised |
| 2 | **sí** L0–L5, default max L2, durable grants L3+ | confirmed (ADR-002) |
| 3 | **sí** GapEvents + fingerprint/dedupe | confirmed |
| 4 | **sí** explore→plan→Critic + lanes H→K→C | confirmed |
| 5 | **5a** PEA≠PAOS + Lane K bridge | confirmed (ADR-005) |
| 6 | **sí** pea_explain_gap + soft internal hint | confirmed |
| 7 | **deferred** permissions+doom-loop after MVP (M3 platform) | confirmed |
| 8 | **MVP L0–L2 no staging; M4 staging→L3 adapters (OpenCode last)** | confirmed |
| 9 | **sí** ratchet obligatorio al cerrar (golden\|sensor\|provenance) | confirmed |
| 10 | **10a** MVP L0–L2 cuts M0→M2c; human ratchet on Accept; L3/staging/OpenCode/permissions out | confirmed |

## 7. Q&A complete — build order

```text
M0  P0 contracts → re-score ≥90
M1  Preflight + pea.* + outbox/jobs (flags off)
M2a GapEvents + threshold + ArchitectRuntime → packet + Critic
M2b Console + pea_explain_gap + grant store (L3 disabled)
M2c Accept requires ≥1 ratchet link (manual)
—— later ——
M3  SideEffectRegistry + Principal + permissions/doom-loop
M4  Staging → L3 adapters (manual→native→Cursor→OpenCode)
```
