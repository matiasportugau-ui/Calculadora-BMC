# Architect improvements — Calculadora BMC (post-SDD)

Greenfield-style **product/architecture** recommendations derived from as-built SDD v0.2.  
These are **not** documentation gaps; they are evolution candidates for the system itself.

**Status:** Proposed (human prioritization required)  
**Source:** sdd-architect lens after reverse-engineer + audit pass (92)

---

## Priority map

| ID | Theme | Impact | Effort | Dependency |
|----|-------|--------|--------|------------|
| A1 | Split calculator mega-component | High maintainability | High | Tests/validation goldens |
| A2 | Unify secret surfaces (Doppler → GCP/Vercel sync) | Medium reliability | Medium | Ops auth |
| A3 | Contract-first Sheets mapper CI | High correctness | Medium | `test:contracts` always-on — **partial: pre-deploy hard-fails when API up** (2026-07-19) |
| A4 | Cloud Run min-instance / PDF warm path | Medium UX | Low–Med | Cost budget |
| A5 | C4 L3 agent sandbox + tool allowlist | High safety | Medium | assistantRegistry |
| A6 | Extract pricing package shared client/server | Medium DRY | Medium | calc routes + SPA |

---

## A1 — Calculator modularization

**Problem:** `PanelinCalculadoraV3_backup.jsx` ~8k LOC is a change risk hotspot (§11).

**Target architecture:**

```
src/features/calculator/
  ui/ (panels, forms)
  state/ (quote model hooks)
  export/ (PDF/WA adapters)
  roof-plan/ (existing 2D/3D modules)
```

Keep filename re-export for stability (ADR-003) until migration complete.

**Acceptance:** feature slices <800 LOC; `tests/validation.js` green; no pricing drift vs goldens.

---

## A2 — Secret sync

**Problem:** Doppler (local) vs Vercel env vs GCP Secret Manager (prod) drift risk.

**Target:** single publish pipeline (scripted re-pull) + `gate:secrets` in CI weekly; document in §8.

**Acceptance:** `missingConfig: []` on `/health` after every deploy; drift job fails PR if keys diverge.

---

## A3 — Sheets contract ratchet

**Problem:** Schema drift is top operational risk.

**Target:** expand live contracts for every hub critical path; fail deploy on contract red.

**Acceptance:** `npm run test:contracts` in pre-deploy; zero silent empty UI for known tabs.

---

## A4 — PDF cold-start

**Problem:** Playwright on Cloud Run can cold-start slowly.

**Target:** min instances 1 for peak hours **or** async job queue for PDF with status URL.

**Acceptance:** p95 PDF < agreed SLO (measure first via RUM/logs).

---

## A5 — Agent tool sandbox

**Problem:** `agentTools.js` is large (~2.3k LOC); blast radius of tool_use is high.

**Target:** explicit allowlist per assistant key; deny-by-default for write tools; human gate for CRM writes.

**Acceptance:** matrix assistant × tools in SDD §6; tests for deny paths.

---

## A6 — Shared pricing package

**Problem:** Dual surfaces (SPA pure calc + server `/calc`) must stay identical.

**Target:** `packages/pricing` or `src/shared/pricing` imported by Vite and Express (already partially aligned via loopback).

**Acceptance:** single module for `LISTA_ACTIVA` / `calcTotalesSinIVA`; server does not reimplement catalog math.

---

## What not to do (anti-patterns)

- Microservices split of calc/chat/CRM **before** modularization inside monolith.
- Disabling ASSISTANTS_ACTIVE / grants to green smoke.
- Hardcoding sheet IDs to “fix” local.
- Force-push main or secret commits.

---

## Suggested sequence

1. A3 (contracts) — lowest risk, high signal  
2. A6 (shared pricing) — before large UI refactors  
3. A1 (calculator slices) — multi-PR  
4. A5 (tool sandbox) — with AI feature work  
5. A2 + A4 — ops/cost trade-offs with human gate  
