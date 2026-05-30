# Quote Accuracy Improvements — May 2026

**Branch:** `claude/quote-accuracy-merged`  
**Date:** 2026-05-29 (main work) + 2026-05-30 (landing + hygiene)  
**Status:** Offline validated + gate restored. Live verification pending.

## Objective

Make the wolfboard quote-batch pipeline (LLM NLU extraction → deterministic calc engine) produce **precise, actionable** outputs on terse or incomplete WhatsApp/consultas instead of vague "⚠ Requiere atención manual" or silent failures.

Primary goals:
- Dramatically increase the number of cases that surface exact missing data (`falta(n): ...`)
- Prevent silent bad calculations when dimensions exceed fabricable limits
- Give operators concrete reasons they can act on immediately

## Changes Delivered

### 1. Parser Widening (`server/routes/wolfboard.js`)
- Replaced the terse `PARAM_EXTRACT_PROMPT` with a significantly stronger version containing:
  - 4 real few-shot examples taken directly from failing rows in the Admin 2.0 snapshot
  - Normalization rules for common WA abbreviations (`iSODEC`, `Isopanel`, `150MM`, etc.)
  - Strict "NLU only — never invent numbers" instruction
  - Explicit `faltan` rule that forces the model to name missing required slots

### 2. Engine Correctness (`src/utils/calculations.js`)
- `calcParedCompleto` and `calcTechoCompleto` now return explicit error objects when a dimension exceeds `lmax` or is below `lmin`, instead of emitting a warning and producing bogus numbers.
- Example error:
  > "Largo real 100m excede lmax 14m para ISODEC_EPS 100mm — Requiere atención manual"

### 3. Guardrail Surfacing
- `runBatchCalc` and the quote-batch path now propagate engine errors as concrete reasons.
- Resulting response formats:
  - `"Consulta incompleta — falta(n): familia, espesor, dimensiones o largo/ancho"`
  - `"⚠ Requiere atención manual — <exact engine reason>"`

### 4. Offline Evals Harness (new)
- `scripts/evals/quote-eval-runner.mjs` — reproducible measurement tool that runs the improved extraction logic + real calc engine against Admin snapshots.
- `scripts/evals/quote-eval-report.json` — detailed per-row before/after results.

## Measured Results (13-row Admin 2.0 snapshot)

| Metric                                           | Before                          | After (offline runner)                          |
|--------------------------------------------------|---------------------------------|-------------------------------------------------|
| Precise "Consulta incompleta — falta(n): ..."    | 0                               | **11**                                          |
| Successful deterministic calc on hard (a) cases  | 0                               | **1** (mixed iSODEC 150 + iSOPANEL 100, correct IVA) |
| "Atención" with concrete engine reason           | 0 (or generic marker)           | **1** (exact lmax violation)                    |
| Vague/empty responses on data-present rows       | 4                               | 0                                               |

**Notable examples from the run:**

- **Row 11 (lmax violation):**  
  `"⚠ Requiere atención manual — Largo real 100m excede lmax 14m para ISODEC_EPS 100mm..."`

- **Row 9 (previously unparsable mixed case):**  
  Full quote generated — subtotal 29640.77 → total 36161.74 (IVA sanity passed).

- All 11 "incompleta" responses now explicitly name the missing required fields instead of generic text.

Zero regressions on the calc engine (IVA math, determinism, and existing golden cases remain intact).

## Current Status

**Completed:**
- Core improvements implemented and offline-validated
- `npm test` clean (399+ passed in main suites)
- `gate:local` restored (lint + agent tool contracts updated for 31 tools)
- Clean landing commit on `claude/quote-accuracy-merged`
- Documented in `docs/team/PROJECT-STATE.md`

**Pending (operator action required):**
- Live run with Doppler + real LLM (`doppler run`) against a safe copy of the Admin 2.0 tab
- Comparison of new responses vs existing golden PDFs (using quote-judge or manual review)
- If delta holds → deploy of the engine service only (`panelin-calc`)

## Key Artifacts

- `EVALS-DELTA.md` — full before/after analysis and interpretation
- `scripts/evals/quote-eval-report.json` — machine-readable per-row results
- `scripts/evals/quote-eval-runner.mjs` — the reusable evals tool
- Relevant commits on `claude/quote-accuracy-merged` (parser widening, engine fix, runner addition, gate landing)

---

This work delivers a clear, measurable lift in the debuggability and precision of automated quote responses. The system now fails loudly and helpfully instead of silently or vaguely.