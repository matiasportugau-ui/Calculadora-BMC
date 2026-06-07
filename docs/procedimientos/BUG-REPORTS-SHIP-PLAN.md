# Bug Reports Ship — Autonomous Goal Plan

**Condition (done when):** BUG_REPORTS tab exists → `main` pushed → prod smoke green + one real `POST /api/bugs/report` succeeds.

**Orchestrator:** `node scripts/bug-reports-ship-goal.mjs`  
**Logs:** `.runtime/goals/bug-reports-ship.log`  
**State:** `.runtime/goals/bug-reports-ship-state.json`

---

## Step 1 — Sheet bootstrap (automated)

| Item | Detail |
|------|--------|
| Script | `scripts/setup-bug-reports-tab.mjs` |
| Requires | `BMC_SHEET_ID`, `GOOGLE_APPLICATION_CREDENTIALS` |
| Action | Create tab `BUG_REPORTS` (or `BMC_BUG_REPORTS_TAB`) + 13 headers |
| Idempotent | Yes — skips if tab/headers already exist |

**Headers (A:M):** id, timestamp, shortDescription, details, severity, url, userAgent, capturedAt, context, status, source, authMode, screenshotUrl

---

## Step 2 — Push (automated)

| Item | Detail |
|------|--------|
| Action | `git push origin main` if allowed; else **PR path** (`ship/bug-reports-YYYYMMDD` → `gh pr create` → wait checks → merge) |
| Current batch | 8 commits (bug-reports + prior worktree/audit/oauth) |
| Triggers | GitHub CI → on success → Cloud Run + Vercel deploy workflows |

**Protected `main`:** orchestrator auto-creates PR and attempts squash merge when checks pass. If branch protection requires human approval, goal pauses at `step2` with `prUrl` in state until merged — re-run goal after merge.

---

## Step 3 — Verify prod (automated, polls until done)

| Phase | Action | Timeout |
|-------|--------|---------|
| 3a | Poll `gh run` for **CI — Panelin Calculadora BMC** until `success` | 45 min |
| 3b | Poll deploy workflows (API + Vercel) — best effort | included |
| 3c | `npm run smoke:prod -- --json` against prod API | — |
| 3d | `POST /api/bugs/report` smoke payload → expect `{ ok: true, id }` | — |

**Prod API default:** `https://panelin-calc-q74zutv7dq-uc.a.run.app`  
Override: `BMC_API_BASE` or `SMOKE_BASE_URL`

---

## Human gates (may block)

| Gate | Symptom | Fix |
|------|---------|-----|
| Sheets SA lacks Editor on BMC sheet | Step 1 fails | Share sheet with service account |
| No local SA JSON + ADC without Sheets scope | Step 1 **skipped**; goal continues | Create tab manually in [BMC crm_automatizado](https://docs.google.com/spreadsheets/d/1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg/edit) or fix `GOOGLE_APPLICATION_CREDENTIALS` |
| `git push` auth | Step 2 fails | `gh auth login` / SSH key |
| CI red | Step 3 aborts | Fix CI, re-run orchestrator |
| Vercel secrets missing | Deploy skipped; API may still update | Check Actions logs |
| `BMC_SHEET_ID` unset on Cloud Run | POST 503 in prod | `npm run ml:cloud-run` / sync env |

**Resilience:** Step 1 failure due to auth → orchestrator logs `skipped_human_gate` and still runs Steps 2–3. Final POST smoke confirms whether prod is actually ready.

---

## Run

```bash
# Foreground
npm run bug-reports:ship

# Background (recommended)
npm run bug-reports:ship:bg

# Monitor
tail -f .runtime/goals/bug-reports-ship.log
cat .runtime/goals/bug-reports-ship-state.json
```

---

## Success artifacts

- Row in `BUG_REPORTS` with id `BUG-…` from smoke POST
- `bug-reports-ship-state.json` → `"status": "completed"`
- Prod: 🐛 Reportar button on https://calculadora-bmc.vercel.app (after Vercel deploy)