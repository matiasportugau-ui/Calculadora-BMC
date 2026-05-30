# Handoff — Cotizar Button + Presup Orchestrator split (2026-05-30)

**Date:** 2026-05-30  
**Branch:** `wip/cotizar-and-presup` (7 atomic commits replacing monolithic `f09fde1`)  
**Focus:** Organize cotizar-button docs/Apps Script and presup-orchestrator Phase A artifacts.

## Commits in this split

1. `docs(google-sheets): add Cotizar Button specification hub`
2. `feat(apps-script): add cotizar-button sidebar scaffold (Fase 1)`
3. `docs(team): add presupuestacion orchestrator architecture and roadmap`
4. `test(promptfoo): add presup orchestrator gate evals (Phase A starter)`
5. `docs(team): add 2026-05-29 session handoffs` (this commit)
6. `docs: update PROJECT-STATE for cotizar-button and Phase A evals`
7. `chore(cursor): add workspace bootstrap and setup docs`

## What is ready

- **Cotizar Button:** Full spec in `docs/google-sheets-module/COTIZAR-BUTTON-*`; canonical Apps Script in `scripts/apps-script/cotizar-button/Code.gs` + `Sidebar.html`; iteration snapshots in `archive/`.
- **Presup orchestrator:** Architecture + roadmap committed; promptfoo starter in `evals/promptfoo/` pointing at `server/prompts/presup-orchestrator/`.
- **Backend endpoint (already on merge base):** `POST /api/internal/presup/run` via `server/routes/internal/presupOrchestrator.js`.

## Blockers / pending

- `CONFIG` in `Code.gs`: column numbers after `setupCotizarColumns`, real `BACKEND_BASE_URL`, `PDF_DRIVE_FOLDER_ID`.
- PDF generation from Apps Script is still placeholder — needs wiring to orchestrator artifacts.
- promptfoo evals require `ANTHROPIC_API_KEY` in `.env` (not part of `gate:local`).
- **Not merged:** `claude/quote-accuracy-merged` (intentionally separate).

## Literal next prompt

"On branch `wip/cotizar-and-presup`, read `docs/team/HANDOFF-2026-05-30-cotizar-presup-split.md` and `scripts/apps-script/cotizar-button/README.md`. Complete CONFIG in Code.gs with real column indices from Admin 2.0, set BACKEND_BASE_URL to panelin-calc, and smoke-test Sidebar → `POST /api/internal/presup/run` with one real Consulta row. Then expand promptfoo to 4–6 cases from real Spanish consultas. Do not touch `claude/quote-accuracy-merged`."

---
*Written per session closeout after atomic split of wip/cotizar-and-presup.*
