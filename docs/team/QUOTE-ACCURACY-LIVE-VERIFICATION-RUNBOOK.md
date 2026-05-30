# Quote Accuracy — Live Verification Runbook

**Goal**: Validate the real-world accuracy improvements from the `claude/quote-accuracy-merged` changes using actual LLM calls and golden data.

**Priority**: Highest (this is the only step with Very High business and technical impact).

---

## Prerequisites (Must Have)

- Doppler configured with access to the required secrets for this environment.
- `ANTHROPIC_API_KEY` (or equivalent LLM key) available via Doppler.
- Google credentials / access to make a safe copy of the Admin 2.0 sheet.
- The golden PDFs for the test cases (especially "Carmen ISODEC" and the other (a) rows from the snapshot).
- The 4 (a) rows identified in the offline snapshot (rows 7, 8, 9, 11).

**Safety Rule**: Never run against the live production Admin tab on the first try. Always use a dedicated copy.

---

## Step-by-Step Execution

### 1. Prepare a Safe Test Environment

1. Duplicate the "2.0 - Administrador de Cotizaciones" tab (or the entire workbook) into a test copy.
2. Copy the 4 hard (a) rows from the original snapshot into this test copy (rows 7, 8, 9, 11).
3. Note the exact row numbers in the test copy.

### 2. Start the Backend with Real Credentials

```bash
doppler run -- npm run start:api
```

Or, if you prefer the full dev stack:

```bash
doppler run -- npm run dev:full
```

Verify that the server is using real LLM keys (check logs for key loading).

### 3. Trigger the Quote Batch

**Preferred method (most realistic):**
- Open the Admin UI against the test copy.
- Select the 4 test rows.
- Enable `force=true`.
- Run the batch (or call the equivalent `/api/wolfboard/quote-batch` or internal endpoint).

**Alternative (direct API):**
Use the production `/quote-batch` endpoint (or the wolfboard route) pointing at your test copy.

### 4. Capture Results

After the batch completes:
- Export or note the new values in column J for the 4 test rows.
- Record the exact response text for each.

### 5. Compare Against Golden PDFs

For each of the 4 rows:

1. Compare the new AI response against the corresponding golden PDF (operator-validated).
2. Use one of these methods:
   - Manual side-by-side review
   - Drive-MCP or quote-judge subagent
   - Structured checklist (see below)

**Mandatory Numeric Sanity Checks** (must pass for the row to count as success):

- `subtotal == area_m2 × precio_m2` (to the cent)
- `total == subtotal × 1.22` (IVA 22%)

### 6. Record Results

Update the following files:

- `EVALS-DELTA.md` → Add a new section "Live Verification — [DATE]" with per-row results.
- `docs/team/QUOTE-ACCURACY-2026-05-29-DELTA.md` → Update the "Pending" section with real numbers.

**What to record per row**:
- New response text (or summary)
- Whether it was precise "incompleta — falta(n)" or concrete engine reason
- Numeric sanity result (pass/fail + actual numbers)
- Comparison to golden PDF (better / same / worse / still bad)
- Judge score (if using quote-judge)

### 7. Decision Gate

Only proceed to deploy if **all** of the following are true:

- Clear improvement in precision vs the offline baseline.
- All tested golden cases still pass numeric sanity.
- No regressions on the Carmen-style hard cases.
- The gain is material enough to justify the change.

If any of the above are not met → document the gaps and decide whether to iterate on prompts/engine or pause.

---

## Exact Commands Reference

**Start backend with secrets:**
```bash
doppler run -- npm run start:api
```

**Trigger batch (example via UI or known endpoint):**
Use the Admin UI with `force=true` on the test copy, or call the wolfboard quote-batch endpoint directly.

**After results:**
Manually or via script compare against the golden PDFs located in the team's Drive (ask for the folder if you don't have it).

---

## External Blockers Protocol

If at any point you are blocked by missing:
- Doppler secrets
- ANTHROPIC_API_KEY
- Golden PDFs
- Access to a safe Admin copy

**Do not loop.**  
Immediately write a short handoff note (in the style of previous HANDOFF-*.md files) and stop.

---

## Success Criteria for This Run

- At least 2–3 of the 4 (a) rows show clearly better, actionable outputs.
- Numeric sanity holds on all compared cases.
- At least one concrete example where the new behavior would have saved operator time vs the old vague "atención".

If we hit these, the initiative has proven production value.

---

**Next after successful verification:**
- Update `EVALS-DELTA.md` and the Delta summary.
- Proceed to engine-only deploy of `panelin-calc` (only the changed code).
- Monitor the first real batch runs in production.

---

*Created as direct execution of the highest-impact recommendation from the plan review.*