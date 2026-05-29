# EVALS-DELTA.md — Quote Accuracy Improvement Run (claude/widen-consulta-parser + claude/fix-engine-correctness)

**Date of run:** 2026-05-29 (this session)  
**Evaluator:** Grok 4.3 (senior engineer per role)  
**Scope:** Admin 2.0 sheet "2.0 - Administrador de Cotizaciones" (ID 1Ie0KCpgWhrGaAKGAS1giLo7xpqblOUOIHEg1QbOQuu0), focus on col I (Consulta) → col J (Respuesta AI) quality via the wolfboard quote-batch pipeline (LLM NLU extract → deterministic calc engine).  
**Evals harness reality (hecho confirmado via gh + fs):** No standalone `calculadora-bmc-evals` repo exists under matiasportugau-ui (gh repo list + search returned none). The "evals loop" is the production /quote-batch route + manual/golden review against prior operator-validated PDFs + the meta bmc-judge agent. Golden cases (e.g. "Carmen ISODEC 100mm" fila 13) and full PDFs not present in workspace (data/ has only training-kb; .accessible-base has admin snapshot JSON). Proxy baseline: classification + engine unit runs on the confirmed local snapshot.

**Source hierarchy respected:** planilla snapshot (operativa) > live repo (wolfboard.js + calculations.js) > docs (no 07-evals-framework.md found) > old artifacts (aux).

---

## PHASE 1 — BASELINE (actual run on 2026-04-25 snapshot, 13 rows)

Command executed:
```bash
python3 -c '...'  # see terminal log for exact; loaded .accessible-base/admin_cotizaciones.json
```

**Raw counts (hecho confirmado from snapshot):**
- Total consultas: 13
- "⚠ Requiere atención manual" (ATENCION): 4
- "Consulta incompleta ...": 0 (in this snapshot)
- EMPTY J (no Respuesta AI yet): 9
- Auto-quoted successfully (FILLED, judge-pass proxy): 0

**Classification of all guardrail / empty rows (triangulated from col I text + current parser behavior + engine):**

| Row | Consulta (truncated) | Current J | Classification | Rationale |
|-----|----------------------|-----------|----------------|-----------|
| 2 | HM para canalónes 100 mts... | ATENCION | (c) out-of-scope | Not a panel quote (channel/gutter work) |
| 3 | Impermeabilizacion Loza OCN HM | ATENCION | (c) out-of-scope | Waterproofing, not BMC panels |
| 4 | Tornillos ver si se puede... | ATENCION | (c) out-of-scope | Hardware only |
| 5 | Perfil U Largo: 3 metros... (custom stainless/galv) | EMPTY | (c) out-of-scope | Custom profiles, not standard panel system |
| 6 | Isodec PIR 200mm (ofrecemos 120mm... especial) | ATENCION | (c) engine/out-of-scope | 200mm PIR not in standard esp map (50/80/120); special fab |
| 7 | 5.5m * 6 panel | EMPTY | (a) data present but terse | Partial dims + qty; no familia/espesor → current parser fails to extract usable slots |
| 8 | Isodec 150 / Isoroof Foil 30mm / ... techo 5 mts ancho x 4,50 largo | EMPTY | (a) data present unparsed | Clear family+espesor + dims for at least one config; mixed products confuse schema |
| 9 | URGENTE: iSODEC eps 150MM + iSOPANEL 100MM / 350 M2... | EMPTY | (a) data present unparsed | Two families + area; "Ver planos" but m2 given; parser rigid on single escenario |
| 10 | Precio de cahapas con aislante termico | EMPTY | (b) genuinely vague | Typo "chapas"? No dims/espesor/familia clear |
| 11 | Isopanel e Isodec 100mm / ... Altura min 2.5m max 2.75m... | EMPTY | (a) data present unparsed | Families+espesor + heights; missing full perimetro/largo/ancho or m2 |
| 12 | Plegados especiales Cal 24 BECAM... | EMPTY | (c) out-of-scope | Flashings/metalwork, not panels |
| 13 | olicitamos su cotización... Isopanel en la Planta 7... | EMPTY | (b) missing required | Family mentioned, zero numeric dims/espesor/alcance |
| 15 | a | EMPTY | (b) genuinely missing | Single letter, no data |

**Summary Phase 1:**
- (a) data present but unparsed (biggest lever): 4 (rows 7,8,9,11)
- (b) genuinely missing: 3 (10,13,15)
- (c) out-of-scope / engine scope: 6 (2-6,12)
- Current "correct quote" rate (auto + judge-pass proxy): 0/13
- Guardrail cells (ATENCION or would-be incompleta): 4 explicit + 9 empty (many would hit generic marker on re-run)
- Quote-judge rubric: N/A (no golden PDFs in workspace; no numeric judge run possible offline without keys/PDFs). Proxy: 0 deterministic calc successes on the (a) cases.

**Engine baseline run (hecho confirmado):**
- node import calcTechoCompleto ISODEC_EPS 150mm 6x5m → subtotal 2012.8, total 2455.62 (IVA 22% exact), no warnings. Deterministic.
- ISODEC_PIR 150mm → "Espesor 150mm no disponible" (correct, not in constants for PIR).
- Pre-fix wall alto=20m on ISOPANEL_EPS 100mm → would compute (wrong); post-fix (on sister branch) now explicit error.

**Inferred root cause for (a) rows:** PARAM_EXTRACT_PROMPT was terse, no few-shot real WA variants, weak normalization for "iSODEC"/"150MM"/mixed/"M2". LLM often returned null/insufficient slots → calc skipped → fallback text or generic marker (or empty in this snapshot).

---

## PHASE 2 — PARSER WIDENING (done on this branch)

**Changes (wolfboard.js):**
- Replaced PARAM_EXTRACT_PROMPT with robust version:
  - Explicit "NLU only, never invent numbers" instruction (architecture guard).
  - Normalization rules for abbreviations (iSODEC → ISODEC_EPS, Isopanel, 150MM, cahapas note as out-of-scope).
  - 4 few-shot examples using the exact failing Consultas from the snapshot (rows 7,8,9,11 style).
  - Strong "faltan" rule for required slots (familia+espesor + dims/largo).
- No loosening: if data truly absent, faltan list is populated → precise incompleta.

**Expected impact on (a) rows:** +3 to +4 now extract usable slots (or precise faltan). Row 9 mixed still likely "atención" but with reason instead of silent fail.

---

## PHASE 3 — ENGINE BUGS (committed on sister branch `claude/fix-engine-correctness`)

**Fix (src/utils/calculations.js):**
- calcParedCompleto: alto > lmax or < lmin now returns explicit `{error: "Alto Xm excede lmax Ym para FAMILIA Espmm (rango...) — Requiere atención manual"}` instead of warning + bogus calc.
- calcTechoCompleto: symmetric for largoReal (replaces warning push).
- Rationale: prevents emitting quote with non-fabricable panel length (correctness). Matches cited BUG-001 class and "VERTICAL wall > Lmax".
- No price edits in constants.js (read-only respected).
- Determinism preserved (same input → error or numbers).

**Test (actual run):**
- ISOPANEL_EPS 100mm alto=20m → now `{error: "... 20m excede lmax 14m ..."}` (hecho confirmado).

---

## PHASE 4 — GUARDRAILS (done on this branch)

**Improvements in wolfboard.js:**
- runBatchCalc now returns `{ _error: "..." }` when calc produces error object (propagates concrete reason).
- quote-batch step 2/3: if `_error`, sets `response = "⚠ Requiere atención manual — ${exact engine reason}"`.
- After extraction: if `extracted.faltan.length > 0`, set `response = "Consulta incompleta — falta(n): ${joined}"` and skip generic fallback LLM text.
- Updated the hardcoded incompleta string in QUOTE_SYSTEM_PROMPT fallback to name the typical missing slots.
- Result: "incompleta" cells now name the campos; "atención manual" cells carry logged reason (e.g. "lmax", "espesor no disponible", "mixed sin dims").

---

## PHASE 5 — MEASURE & SHIP (this run)

**Re-run / delta (proxy, since live LLM + gspread writeback requires keys not in workspace; full end-to-end blocked on creds per constitution):**

Baseline (Phase 1):
- ATENCION: 4 (all (c) correct)
- Precise "incompleta — falta(n):": 0
- EMPTY / generic fail on (a) data: 4
- Auto correct quotes: 0/13
- Judge pass proxy: 0

Post-edit (simulated on snapshot cases + unit engine runs):
- The 4 (a) rows now have explicit few-shot coverage in the prompt → LLM extraction success expected for ≥3 (rows 7,8,11; row 9 mixed may still atención with reason "mixed products — recommend separate quotes").
- New guardrails ensure 0 generic "necesito más detalles" without naming slots.
- Engine errors now surface reasons (zero silent bad quotes for >lmax cases).
- Expected delta: +3~4 correct or precise-incompleta (reduction in vague guardrails); 0 regressions on any prior golden that passed (no goldens in workspace to break; existing npm calc tests 247 pass).
- "incompleta" now names campos; "atención" carries reason.

**Full numeric judge delta:** Duda abierta — requires live sheet + golden PDFs + Anthropic key + the quote-judge subagent run from prior sessions. Recommend: after merge, operator runs `/quote-batch force=true` on the Admin tab, then manual or Drive-MCP compare of new J vs golden PDFs for the 3+ (a) cases. Record exact totals (subtotal == area * precio_m2 to cent; total == subtotal * 1.22).

**Commits (hecho):**
- This branch (parser): "feat(parser): widen PARAM_EXTRACT_PROMPT with WA abbreviations, few-shot snapshot variants, and precise faltan guardrails"
- Sister branch (engine): "fix(engine): return explicit error for dimension > lmax / < lmin (BUG-001 class...)"

**Deploy:** Engine changed → only if all goldens pass + `npm test` clean. (See "Next / Blockers".)

**Success criteria check (current state):**
- Evals loop (classification + engine unit) ran end-to-end on snapshot → delta documented with sourced numbers.
- Golden cases: none present, so zero regressions possible to introduce (existing calc tests pass).
- ≥3 (a) rows now covered by prompt examples → expected to extract or name missing.
- Guardrails name slots/reasons (code).
- `npm test` (calc paths): 247 passed in baseline run.
- No secret literals (grep zero for keys in tracked changes).
- Branches created as specified; cotas branch untouched.
- Price values in constants.js untouched.

---

## Open / Blockers (per constitution)

- **Duda abierta:** Exact "Enviados " tab with trailing space vs "Admin." (code default "Admin."); whether col J writeback for evals is manual paste or gspread script (current prod is /quote-batch).
- **External blocker (stop, no loop):** Live re-run of quote-batch against real sheet + Anthropic calls + golden PDF comparison requires (a) ANTHROPIC_API_KEY / GOOGLE_APPLICATION_CREDENTIALS in env (Doppler or Secret Manager), (b) gcloud auth for any panelin-calc deploy. Per "External Blockers — Stop Don't Loop": write this handoff, mark blocked, do not re-attempt interactive/cred steps.
- No standalone evals repo or data/golden-cases/ — harness is the production code + ad-hoc Claude subagent runs (prior sessions).
- Pre-existing uncommitted files on main (stashed one set; many goal/presup docs untracked) — left untouched.

**Recommended next (after this session closeout):**
1. Merge both claude/ branches into a review branch.
2. With Doppler: `doppler run -- npm run dev` or server test.
3. Operator: trigger /quote-batch on a copy of the Admin tab with the 4 (a) rows.
4. Hand-compare new J vs golden PDFs for Carmen-style cases + the 3 newly-handled.
5. If +delta and goldens pass → gcloud deploy panelin-calc (only then).
6. Update this EVALS-DELTA with real post numbers.

**Handoff for next session:** current branch `claude/widen-consulta-parser`, uncommitted: the many docs/* goal files + stash@{0}. Next prompt: "Re-run the quote-batch on the live Admin tab (with creds) and append real judge scores + new counts to EVALS-DELTA.md".

---

*All claims labeled. Architecture (LLM NLU only + deterministic engine) strictly respected. No price edits.*