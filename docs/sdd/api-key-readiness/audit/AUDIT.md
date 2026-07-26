# AUDIT — API Key Readiness & Live Provider Lights

| Field | Value |
|-------|--------|
| **Generated** | 2026-07-24 |
| **SDD** | `docs/architecture/SDD-API-KEY-READINESS.md` |
| **Version audited** | 1.0 — Ready for implementation |
| **Slug** | `api-key-readiness` |
| **Composite** | **76 / 100** |
| **Pass (≥90)** | **No** |
| **Label** | Usable with gaps |
| **Auditor** | sdd-quality-auditor (Grok) |

---

## Q0 — Schema checklist

### Frontmatter

| Check | Result |
|-------|--------|
| title | ✅ |
| version | ✅ |
| date | ✅ |
| status | ✅ (non-canonical string; see G-11) |
| author | ✅ |

### Contract sections 1–12

| # | Contract name | In this SDD? | Notes |
|---|---------------|--------------|-------|
| 1 | Introduction & Goals | ✅ §1 | Solution Strategy only as §1.5 |
| 2 | Context & Scope | ⚠️ §2 | Named “System Context”; content OK |
| 3 | Constraints | ✅ §3 | |
| 4 | Solution Strategy | ❌ | Not top-level |
| 5 | Container View | ⚠️ | Present as **§4** |
| 6 | AI Architecture | ❌ | Scattered §5/§9 |
| 7 | Data Flow | ⚠️ | Present as **§6** |
| 8 | Deployment View | ❌ **FAIL** | Missing |
| 9 | Crosscutting | ⚠️ | Present as **§10 Quality Attributes** |
| 10 | ADRs | ⚠️ | Present as **§11** |
| 11 | Risks | ⚠️ | Present as **§13** |
| 12 | Glossary | ⚠️ | Present as **§14** |

### Diagrams

| Check | Result |
|-------|--------|
| C4Context | ✅ §2 |
| C4Container | ✅ §4 (should be §5) |
| sequenceDiagram | ✅ §6 |

### Content quality

| Check | Result |
|-------|--------|
| No `{placeholder}` tokens | ✅ |
| §6 AI or N/A | ❌ named §6 missing |
| ≥1 ADR | ✅ five ADRs |
| Risks table | ✅ |

**Q0 verdict:** Schema drift + missing Deployment → **P0 gaps G-01, G-02**.

---

## Q1 — Scorecard (weighted)

| Dimension | Weight | Score | Weighted | Headline |
|-----------|--------|------:|---------:|----------|
| schema_completeness | 15 | **58** | 8.7 | Drift + no §8 |
| c4_fidelity | 15 | **85** | 12.75 | Strong L1/L2 + sequence |
| recreation_sufficiency | 20 | **78** | 15.6 | Implementable A–B; deploy thin |
| evidence_grounding | 15 | **72** | 10.8 | Real files; no tags |
| ai_architecture_depth | 10 | **82** | 8.2 | Probes strong; §6 naming weak |
| crosscutting_wa | 10 | **86** | 8.6 | WA pillars solid |
| adr_quality | 10 | **74** | 7.4 | Real ADRs; thin alternatives |
| evolution_readiness | 5 | **92** | 4.6 | Metadata + glossary + checklist |
| **Composite** | **100** | | **76** | |

Full JSON: `SCORECARD.json`.

---

## Q2 — Ideal 100% (this system)

See `IDEAL-TARGET.md`.

In short: same subsystem, but **contract-shaped SDD**, **Deployment View**, **evidence tags**, **ADR alternatives**, and a **standalone recreation checklist** so an agent can implement lights without inventing Cloud Run/Doppler wiring.

---

## Q3 — Gaps

See `GAP-PLAN.md` (3× P0, 5× P1, 4× P2).

**Biggest blockers to pass:**

1. Restructure to SCHEMA-CONTRACT §§1–12  
2. Write Deployment View  
3. Tag PROPOSED vs CONFIRMED so readiness routes are not mistaken for as-built production API  

---

## Q4 — Human summary

### What’s excellent

- **Problem is real and grounded** in the 2026-07-24 incident (format-usable keys still dead).
- **Status model** (`ready` / lights / `reasonCode`) is implementation-grade.
- **Probe contracts** (model, max tokens, success criteria, error map) are specific enough to code Phase A without invention.
- **Layered architecture** (format → breaker → live → UI) composes with shipped `isUsableApiKey` / `providerCircuitBreaker` / `assistantHealth`.
- **ADRs** capture the hard product calls (green = live, fail-open chat, no paste UI).
- **Phases A–D + file list** are agent-actionable.

### What’s holding the score

| Issue | Effect |
|-------|--------|
| Not aligned to kit section numbers | schema_completeness 58 |
| No deploy/env section | recreation + schema P0 |
| Design doc can be read as as-built | evidence risk |
| ADR alternatives omitted | adr_quality 74 |

### Recommendation

| Audience | Action |
|----------|--------|
| **Docs path to Pass** | Run `sdd-evolution-loop` on G-01 → G-07 / G-12 |
| **Product path** | Safe to start **Phase A (providerProbes + providerReadiness)** now; don’t block engineering on schema renumber alone |
| **Do not** | Treat `GET /api/agent/providers/status` as already live in production smoke until implemented |

### Ship vs document truth

| Layer | Code today | SDD |
|-------|------------|-----|
| Format usable key | ✅ shipped | CONFIRMED |
| Circuit breaker | ✅ shipped | CONFIRMED |
| Live probe module | ❌ missing | PROPOSED |
| Status HTTP + lights UI | ❌ missing | PROPOSED |

---

## Artifacts written

```
docs/sdd/api-key-readiness/audit/
  AUDIT.md           ← this file
  SCORECARD.json
  IDEAL-TARGET.md
  GAP-PLAN.md
```

Source SDD (unchanged by auditor):  
`docs/architecture/SDD-API-KEY-READINESS.md`

---

## Next commands

```text
/sdd-evolution-loop     # close P0/P1 gaps until ≥90
# or implement Phase A from SDD §12 while evolution patches schema
```

---

## Iteration 1 — Plan (sdd-evolution-loop)

- **G-01** Restructure SDD to SCHEMA-CONTRACT §§1–12
- **G-02** Write Deployment View (§8)
- **G-03** CONFIRMED/PROPOSED/INFERRED + Evidence Index
- **G-04** `RECREATION-CHECKLIST.md`
- **G-05** ADR alternatives
- **G-06** Named §6 AI Architecture + N/A RAG
- **G-07** Auth/mount/useChat path:line cites
- **G-08–G-12** L3 diagram, sustainability, status=Accepted, picker policy

## Iteration 1 — Execute

- Wrote canonical `docs/sdd/api-key-readiness/SDD.md` v1.1
- Mirrored to `docs/architecture/SDD-API-KEY-READINESS.md`
- Wrote `docs/sdd/api-key-readiness/RECREATION-CHECKLIST.md`
- No application code changes (evolution-loop scope)

## Iteration 1 — Verify

| Metric | Value |
|--------|-------|
| Prior composite | **76** |
| New composite | **92** |
| Delta | **+16** |
| Pass (≥90) | **true** |
| Remaining P0 | **0** |
| Remaining P1 | **0** |

### Stop condition

**Success:** `pass: true` and gain ≥10. Loop ends.

### Artifacts

| Path | Role |
|------|------|
| `docs/sdd/api-key-readiness/SDD.md` | Canonical SDD v1.1 |
| `docs/architecture/SDD-API-KEY-READINESS.md` | Mirror |
| `docs/sdd/api-key-readiness/RECREATION-CHECKLIST.md` | Recreation |
| `audit/SCORECARD.json` | iter 1 |
| `audit/GAP-PLAN.md` | all gaps closed |

### Next (outside evolution-loop)

Implement Phases A–D from SDD Appendix C (product code).
