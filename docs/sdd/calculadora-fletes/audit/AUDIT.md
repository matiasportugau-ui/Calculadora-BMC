# AUDIT — Calculadora de Fletes BMC — 2026-07-19

**SDD:** [`docs/team/SDD-CALCULADORA-FLETES.md`](../../../team/SDD-CALCULADORA-FLETES.md)  
**Auditor:** sdd-quality-auditor  
**Branch (evidence spot-check):** `feat/panelin-build-max-b01-done`  
**Composite:** **72 / 100** — **Usable with gaps** (pass ≥90 → **fail**)

---

## Verdict

The freight SDD is a strong **domain design** document (interview rules, tariffs, packing, ADRs, C4 + sequence). It is **not yet schema-pass / recreation-expert-complete**: section order drifts from the kit contract, **Deployment is missing**, and implementation claims are weakly grounded (no citations; FX documented as BROU while code uses `uy.dolarapi.com`).

Code for the feature **does exist** on disk (`fleteEngine.js`, `cargoPacking.js`, `FleteCotizarPanel.jsx`, `brouFx.js`, `tests/fleteEngine.test.js`) — the gap is documentation fidelity, not absence of product.

---

## Q0 — Schema checklist (binary)

| Check | Result |
|-------|--------|
| Frontmatter title/version/date/status/author | Pass |
| §1–5 present | Pass |
| §6 AI Architecture (named) | **Fail** — Component View + nested N/A |
| §7 Data Flow | **Fail** — Domain Rules occupies §7 |
| §8 Deployment View | **Fail** — absent |
| §9 Crosscutting | Partial — titled Quality attributes |
| §10 ADRs / §11 Risks | Pass |
| §12 Glossary | **Fail** — Glossary is §13 |
| C4Context + C4Container + sequence | Pass |
| No `{placeholder}` / AI N/A / ≥1 ADR / risks table | Pass |

Any schema fail → P0 gaps in [`GAP-PLAN.md`](./GAP-PLAN.md).

---

## Q1 — Scorecard (weighted)

| Dimension | Weight | Score | Weighted |
|-----------|--------|------:|---------:|
| schema_completeness | 15 | 55 | 8.25 |
| c4_fidelity | 15 | 85 | 12.75 |
| recreation_sufficiency | 20 | 72 | 14.40 |
| evidence_grounding | 15 | 55 | 8.25 |
| ai_architecture_depth | 10 | 90 | 9.00 |
| crosscutting_wa | 10 | 75 | 7.50 |
| adr_quality | 10 | 82 | 8.20 |
| evolution_readiness | 5 | 78 | 3.90 |
| **Composite** | 100 | | **72** |

Full JSON: [`SCORECARD.json`](./SCORECARD.json).

---

## Q2 — Ideal for this system

See [`IDEAL-TARGET.md`](./IDEAL-TARGET.md): contract-ordered SDD, Appendix for domain rules, deploy = SPA/Vercel + FX truth, evidence index, recreation checklist, status As-Built.

---

## Q3 — Top gaps (priority)

1. **P0** Add Deployment View; renumber to SCHEMA-CONTRACT 1–12; Domain Rules → appendix  
2. **P0** Evidence citations + fix FX BROU vs `dolarapi_uy` drift  
3. **P1** Tick real DoD items; recreation checklist; ADR alternatives + FX ADR; status As-Built  

---

## What is already good

- Clear problem, goals, out-of-scope  
- C4 L1/L2 + Cotizar flete sequence  
- Dense, operator-usable tariff/packing tables  
- Six real ADRs (shared packing, constants, UI thin, PDF, especial, FX rounding)  
- Correct AI N/A for v1  
- Open questions honestly track Costa −10% / locality map  

---

## Out of scope of this audit

- Rewriting application code  
- Running Dropbox freight corpus reconciliation (separate goal; Grok SDD artifacts were missing on prior branches)  
- Declaring product DoD green without re-running tests in this pass (spot-check paths only)

---

## Next

1. Close P0 via `sdd-evolution-loop` / reverse-engineer on this SDD  
2. Re-run `/sdd-quality-auditor` expecting composite ≥90  
3. Optional: human confirm FX product intent (official BROU vs dolarapi mirror)
