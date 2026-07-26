# Development Glory — panelin-ai-agent-platform

**Conductor:** development-glory + `/goal 100% implementation`  
**Date:** 2026-07-26  
**Repo:** `/Users/matias/calculadora-bmc`  
**Slug:** `panelin-ai-agent-platform`

---

## G0 — Goal lock

| Field | Value |
|-------|-------|
| Path | `~/calculadora-bmc` |
| Mode | Existing |
| Success metric | **100% implementable residual** of IMPLEMENTATION-GUIDE + SDD pass ≥90 |
| Slug | `panelin-ai-agent-platform` |

---

## G1 — Document

| Item | Status |
|------|--------|
| SDD | **v1.4** (+ §6.3b hybrid + hub cost notes) |
| IMPLEMENTATION-GUIDE | IMP-06/10/12/13/14 checkboxes updated |
| GAP-PLAN | Reflects code pack + honest ops leftovers |

---

## G2 — Implement (this pass)

| IMP | Deliverable |
|-----|-------------|
| **06** | `agentObsRing` + `GET /api/agent/obs-summary` + Admin tab **Costo & latencia** |
| **12** | p50/p95/ttft from same ring |
| **10** | `hybridRetrieve.js` + `RAG_HYBRID*` flags (default OFF) wired in `agentChat` |
| **13** | `promptsSha` boot + obs payload |
| **14** | `toolTiers` + `tools-manifest?tier=` |
| Tests | `agentObsRing`, `hybridRetrieve`, `toolTiers`, `promptsSha` in `test:agent` |

**Not implemented (blocked / process):**

- IMP-04 RAG **prod enable** (credentials + embed)  
- IMP-05 full Training KB weekly Gym  
- IMP-15 promptfoo optional  
- Multi-day cross-revision p95 (ops)

---

## G3 — Verify build

| Gate | Result |
|------|--------|
| `npm run test:agent` | **PASS** (exit 0, ~110s) including new unit tests |
| Prior prod health / tools 55 / PAOS | Still valid (code not deployed yet) |

**Deploy:** not run (glory does not ship unless asked).

---

## G4 / G5 — Docs score

| Field | Value |
|-------|-------|
| Composite | **98** pass true |
| P0/P1 docs | **0** |
| Evolution | N/A this pass (product code) |

---

## Definition of done for “100% implementation”

| Layer | Status |
|-------|--------|
| All code-complete IMP residual without human secrets | **DONE** this pass |
| Ops enable RAG + multi-day baselines | **HANDOFF** |
| Provider billing healthy | **HANDOFF** (Grok OK; OpenAI/Claude ops) |

---

## Ship handoff (when user asks)

```bash
cd ~/calculadora-bmc
# review + commit new server/lib + routes + AgentAdminModule + tests
# then ship skill → Cloud Run so /api/agent/obs-summary is live
```

## Next prompt

```text
Ship panelin-ai-agent-platform obs-summary + tool tiers to prod,
then run smoke GET /api/agent/obs-summary and tools-manifest?tier=quote.
Ops: OpenAI billing + optional RAG precheck.
```
