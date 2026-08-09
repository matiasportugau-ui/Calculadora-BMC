# Handoff — 2026-08-09 3D Logística glory + closeout

**Current branch (local when closed)**: `feat/pea-live-e2e-pr` (PEA WIP — unrelated to this campaign)

**Production tip (`origin/main`)**: `3b858b6e` — `fix(logistica): cab facing wrong way (nose toward bed) (#962)`

**Uncommitted changes (this campaign)**:
- none for logística work — all campaign PRs merged to `main`
- local PEA branch may still have unrelated WIP (`workers/` untracked, PEA PR #967 open)

**Blockers**:
- none for the 3D logística campaign
- optional human T6: confirm cab lights click still feels right after #962 lighting bump (Playwright auto-click was inconclusive)

**Next prompt to resume exactly**:
"Continue from here: production logistica is live at https://calculadora-bmc.vercel.app/logistica on main tip 3b858b6e (#953 CSP, #955 adjunto proxy-first, #960 multi-format parser, #962 cab −X + brighter lights). Sandbox SDD+source is committed/pushed at matiasportugau-ui/3d-logistic-viewer (private). Do NOT re-port TruckVisual. Optional next: (1) human T6 cab-lights check, (2) merge only intentional open logística drafts if still needed (#961/#963/#965 are separate bugfix drafts), (3) leave PEA #967 alone unless that is the focus."

**Key files touched (this campaign)**:

Calculadora-BMC (merged):
- `vercel.json` — CSP `connect-src` Drive/Dropbox (+ googleusercontent / dl.dropboxusercontent) — #953
- `src/utils/logistica/adjuntoInfer.js` + BmcLogisticaApp wiring + tests — #955
- `src/components/TruckVisual.jsx` cab nose −X contract — #962
- `src/components/logistica/LogisticaCargoScene3d.jsx` brighter work lights — #962
- `tests/cspAdjuntoConnectSrc.test.js`, `tests/adjuntoInfer.test.js`, `tests/truckVisualOrientation.test.js`

Sandbox (`~/Projects/3d-logistic-viewer`, private GH):
- `docs/sdd/3d-logistic-viewer/**` — SDD, SCORECARD (~95), GAP-PLAN, evidence, glory handoff
- `src/components/viewer/*`, `src/lib/packing.ts`, `src/lib/trucks.ts` — reference viewer (not prod surface)
- `goal-prompt-3d-logistic-viewer-asbuilt-sdd.md`

**Merged PRs (campaign)**:

| PR | Title | Merge SHA |
|----|--------|-----------|
| #953 | CSP connect-src Dropbox/Drive adjuntos | `e0a15607` |
| #955 | Adjunto proxy-first + clearer errors | `5f709554` |
| #960 | Multi-format PDF/ENCARGO autocarga parser | `ba4c0660` |
| #962 | Cab orientation (−X nose) + lighting | `3b858b6e` |

**Not merged (intentionally left alone)**:
- #967 PEA offline stack (open, different campaign)
- Draft cursor bugfix PRs (#961, #963, #964, #965, #966)
- Dependabot opens
- Historical fidelity PR if still open outside this list

**Prod surface**:
- URL: https://calculadora-bmc.vercel.app/logistica
- App shell: `BmcLogisticaApp` + `TruckVisual` / `LogisticaCargoScene3d` (not the Grok sandbox deploy)
- Live checks done this session: CSP headers include Drive/Dropbox; bundle shows adjunto proxy strings; tip includes cab fix

**Current state reference**:
- See `docs/team/PROJECT-STATE.md`
- Sandbox glory: `~/Projects/3d-logistic-viewer/docs/sdd/3d-logistic-viewer/GLORY-HANDOFF.md`
- Prod ship evidence: `~/Projects/3d-logistic-viewer/docs/sdd/3d-logistic-viewer/evidence/production-ship-status-2026-08-09.md`
