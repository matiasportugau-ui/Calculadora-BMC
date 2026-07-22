# HANDOFF — Panelin Co-Work desk (PR-G)

**Date:** 2026-07-22  
**PR:** https://github.com/matiasportugau-ui/Calculadora-BMC/pull/731  
**Branch:** `feat/panelin-cowork-desk`  
**Worktree:** `~/calculadora-bmc/.worktrees/panelin-cowork-desk`

## Done

- Route `/panelin/cowork` (`PanelinCoWorkPage`)
- Named window `panelin-cowork` via `openPanelinCoworkDesk`
- BroadcastChannel `bmc-panelin-cowork-v1` (calcState / chatAction)
- Operator-facing **Ventana** button (not DEV-only)
- Tests `tests/openPanelinCoworkDesk.test.js` 7/7
- Local smoke: Vite `:5173` 200, desk 200, API `/health` 200, modules 200
- CI core: Lint, Validate Calculations, CodeQL, Deploy preview, Env drift, Knowledge Antenna — pass
- Branch synced with main; auto-merge requested if available

## Blocked / remaining

- Branch protection may require review / re-run after last push → `gh pr merge --auto` or human merge
- Human UAT: Ventana popup, focus same window, calcState live, capture tab in desk
- PR-H Document-PiP still deferred
- Prod deploy only after merge to main (Vercel)

## Resume prompts

```text
# If not merged
gh pr view 731 --repo matiasportugau-ui/Calculadora-BMC
gh pr merge 731 --repo matiasportugau-ui/Calculadora-BMC --squash --delete-branch

# Local UAT
cd ~/calculadora-bmc/.worktrees/panelin-cowork-desk
doppler run -- npm run dev:full
# open http://localhost:5173/ → chat → Ventana
```
