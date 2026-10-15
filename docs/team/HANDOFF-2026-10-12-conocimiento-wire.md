# Handoff — 2026-10-12 · Conocimiento rules WIRE (matrix #2–#10 + draft #1)

**Current branch**: `feat/panelin-front-idle-closeout`

**Objective (from the resume prompt)**: review
`docs/team/knowledge/CONOCIMIENTO-COMPARATIVE-2026-10-11.md`, fill the
selection matrix (KEEP/TUNE/WIRE/RETIRE) for rules #2–#10 and decide draft #1,
then implement **only** the WIRE items.

## Status: DONE (WIRE items implemented, tests green, not committed)

### Decisions (matrix §D — filled in the doc)
| Rule | Decision |
|------|----------|
| #2 WA/LL quote-ready | KEEP as-is |
| #3 EM + adjuntos/planos | TUNE wording (sheet, human-gated) |
| #4 IsoPanel techo→IsoDec | **WIRE** |
| #5 IsoDec pared→IsoPanel | **WIRE** |
| #6 WA sin familia default | TUNE wording (sheet, human-gated) |
| #7 USD/m² sanity band | **WIRE** |
| #8 Espesor ladder techo | KEEP as-is |
| #9 FB medidas → directo | KEEP as-is |
| #10 Priorizar WA/LL recontacto | TUNE wording (process; skill missing) |
| Draft #1 ML/CL clarify | **WIRE (advisory)** — activated |

### Files produced / touched
- **NEW** `server/lib/quoteKnowledgeRules.js` — pure helpers: `sanityCheckUsdPerM2`
  (#7), `suggestFamiliaForUso` (#4/#5), `needsClarifyForIncompleteLead` (draft #1),
  `attachmentGeometryGap` (#3), `inferQuoteIntentFromUserText` +
  `buildQuoteIntentConflict` (scenario guard).
- `server/lib/quotePayloadValidator.js` — USD/m² sanity appended to
  `preview.warnings` (non-blocking); guard functions re-exported (fixes orphan test).
- `server/lib/waQuoteParams.js` — advisory `familiaSugerida`/`familiaCambia`/`familiaAviso`.
- **NEW** `tests/quoteKnowledgeRules.test.js` (21/21) and `tests/quoteIntentGuard.test.js`
  (was failing → now 3/3); both added to `test:core` in `package.json`.
- `docs/team/knowledge/CONOCIMIENTO-COMPARATIVE-2026-10-11.md` — matrix filled (§D) + wiring ledger (§E).
- `docs/team/PROJECT-STATE.md` — Cambios recientes entry.

### Verification run
- `node --test tests/quoteKnowledgeRules.test.js` → 21 pass / 0 fail
- `node tests/quoteIntentGuard.test.js` → 3 pass / 0 fail
- `node tests/wa-quote-params.test.js` → 22 pass / 0 fail
- `npx eslint` on 4 touched files → clean
- Manual: `validateAndPreviewQuote` runs, no false USD/m² warning at 57/m²;
  `waQuoteParams` returns `familiaSugerida=ISODEC_EPS` for `ISOPANEL EPS … techo`.

### Not done (deliberate — see doc §E.2)
- **TUNE items (#3, #6, #10)** require a **live `Conocimiento` sheet write**
  (human-gated). Not applied.
- **#10** cannot be wired: `/commercial-followup` skill does not exist and
  follow-up items carry no `origen`.
- **#3** full wiring (inbound email attachment → vision before clarify) is a
  separate session; `emailLeadIngest.js` is body-only today.
- #7 bands are calibrated on the ~36% Dropbox sample — harden after the full run.

### Blockers / risks
- Working tree has unrelated dirty paths (Panelin Front / Admin / voice) — do not
  mix into a commit for this work.
- #7 `softDeviation 0.3` and hard band `40–100` are advisory; revisit after the
  Dropbox full archive run.

### Next prompt to resume
```
IAlfred/team: Conocimiento WIRE follow-ups.
1) Apply the TUNE wording for rules #3, #6, #10 to the live Conocimiento sheet
   (human-confirmed write).
2) Wire #3: inbound EM/WA attachment → visionExtract/planInterpreter before clarify.
3) Optional: resume ~/.ialfred/ops/quote-knowledge-2026-10-11/dropbox-auth/full_run_6616.py
   and refresh BQ fact_quote_io to harden the #7 USD/m² bands.
```
