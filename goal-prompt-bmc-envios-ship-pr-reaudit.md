# Role

You are a senior BMC engineer shipping the already-implemented **BMC Envíos** work (U1 packing SoT, U2 quote→ops bridge, Liquid Glass UI, SDD docs) via smoke verification, a clean path-limited PR, and an SDD quality re-audit. You do not expand into U3/P2/P3/P5 product features in this run.

# Context

BMC Envíos unifies wizard **Flete 10/11** (`FleteCotizarPanel`) and **`/logistica`** (`BmcLogisticaApp`). Code for U1/U2 and SDD under `docs/sdd/bmc-envios/` already exist from a prior session. [CONFIRMED: prior goal + files on disk]

Quality audit was **95 pass** before/during doc evolution; evidence INDEX claims U1/U2 CONFIRMED after code. [CONFIRMED: `docs/sdd/bmc-envios/audit/`, `evidence/INDEX.md`]

Working tree is on branch `feat/panelin-workspace-store` with **many unrelated modifications** (WA, panelin-chat-agent SDD, server routes, etc.). [CONFIRMED: git status] You must **not** commit those.

# Goal

Verify Envíos end-to-end in local dev, open a **focused PR** with only Envíos-related files, and re-run **sdd-quality-auditor** on `bmc-envios` aiming for composite **~97–99** with honest residual gaps for U3/P2/P3/P5.

- Smoke `/logistica` glass + strategies and Flete → Cotizar → Enviar a Logística → imported panels
- Run unit tests: fleteEngine + cargoPacking + bridgePayload
- Create clean branch / stage allowlist only; commit; push; open PR
- Re-audit SDD; update audit/* ; do not implement medium-term product backlog

# Scope

**IN:**
- Manual/API smoke notes for Envíos surfaces
- Path-limited git commit + PR for Envíos artifacts only
- SDD re-audit write under `docs/sdd/bmc-envios/audit/`
- Minimal bugfixes if smoke/tests fail on Envíos code only

**OUT:**
- U3 FSM guards implementation
- P2 geocode / Distance Matrix
- P3 CBM non-panel productization
- P5 server ENV persistence
- Unifying column/stack into one geometric model
- Multi-modal / TSP / isochrones
- Live `POST /api/envios/*`
- Deploy to Vercel/Cloud Run production
- Committing unrelated WA/chat/agent/server changes

# Inputs

- Repo: `~/calculadora-bmc`
- SDD: `docs/sdd/bmc-envios/SDD.md`
- TARGET / RECREATION / evidence: `docs/sdd/bmc-envios/`
- Prior goal: `goal-prompt-bmc-envios-u1-u2-sdd100.md`
- Code: `src/utils/logistica/cargoPacking.js`, `bridgePayload.js`, `BmcLogisticaApp.jsx`, `FleteCotizarPanel.jsx`, `src/main.jsx`, `src/styles/bmc-envios-glass.css`, `src/utils/enviosTheme.js`
- Tests: `tests/fleteEngine.test.js`, `tests/cargoPacking.test.js`, `tests/bridgePayload.test.js`
- Prod reference: `https://calculadora-bmc.vercel.app/logistica` (smoke local preferred)
- Platform SDD: `docs/sdd/calculadora-bmc/SDD.md` (deploy/auth only if needed)
- AGENTS.md gates: prefer `npm run gate:local` only if time; **required** unit trio above

# Tools & MCPs

- Bash: git, gh, node tests, optional doppler + dev server
- Read/Edit only for Envíos fixes + audit docs
- Browser/Playwright optional for smoke screenshots
- Tools NOT needed: Sheets mutations, Meta Ads, fiscal MCP, force-push

# Constraints & Guardrails

- DO create/use branch `feat/bmc-envios-u1-u2-sdd` (or similar) and **stage only allowlist paths**.
- DO review `package.json` and `src/main.jsx` diffs before staging — include only Envíos-related hunks.
- DO NOT `git add -A` or commit WA/cockpit/panelin-chat-agent/server noise.
- DO NOT force-push main; DO NOT merge without user request.
- DO NOT change `TARIFAS_LOGISTICAS` commercial numbers.
- DO NOT put glass blur on packing SVG / tables.
- DO use complete sentences in commit/PR descriptions.
- DO keep Spanish operator strings; English code identifiers.
- Secrets: never commit `.env` / Doppler tokens.

# Anti-patterns

- DO NOT claim SDD composite 100 without re-running the auditor rubric honestly.
- DO NOT implement U3 “while we’re here.”
- DO NOT block on Meta pixel env, transportista migrate, or AI provider probe failures in dev logs.
- DO NOT open a mega-PR with the entire dirty workspace.
- DO NOT amend published commits unless user explicitly allows.

# Implementation plan

## Phase A — Verify

1. `cd ~/calculadora-bmc`
2. `node tests/fleteEngine.test.js && node tests/cargoPacking.test.js && node tests/bridgePayload.test.js`
3. Start or reuse `doppler run -- npm run dev:full`
4. Smoke:
   - http://localhost:5173/logistica — glass, tabs, strategy change
   - Calculator → Flete 10/11 → Cotizar flete → Enviar a Logística → confirm stop panels
5. If fail: fix minimal Envíos code; re-run tests

## Phase B — PR

1. `git status` / `git diff` — identify allowlist
2. Branch: prefer from `origin/main` if Envíos files can be applied; else branch from HEAD and stage only allowlist
3. Commit Envíos-only files
4. `git push -u origin HEAD`
5. `gh pr create` with body: summary U1/U2/glass/SDD, test plan, smoke notes, out-of-scope backlog list

## Phase C — Re-audit

1. Read SDD + evidence + RECREATION + code paths for U1/U2
2. Score dimensions per sdd-quality-auditor SCHEMA-CONTRACT
3. Write SCORECARD.json, AUDIT.md append, GAP-PLAN residual (U3, P2, P3, P5, dual engines)
4. If composite improved and audit files dirty: second small commit on same PR or note in PR

# Deliverables

1. Green unit test log (paste or PR body)
2. Smoke checklist filled (pass/fail + 1-line notes)
3. GitHub PR URL for Envíos-only change set
4. Updated `docs/sdd/bmc-envios/audit/{SCORECARD.json,AUDIT.md,GAP-PLAN.md}`
5. Short handoff: score number + residual backlog IDs

# Success Criteria

- [ ] Unit trio EXIT 0
- [ ] Smoke S1–S3 pass or documented blocker with repro
- [ ] PR exists; `gh pr view` files match Envíos allowlist (no WA mega-diff)
- [ ] Auditor composite ≥97 **or** ≥95 with explicit justification if lower
- [ ] GAP-PLAN lists U3/P2/P3/P5 as open product, not as silent omissions
- [ ] No production deploy performed

# Operational Anchors

- Source hierarchy: shipped code + tests > SDD > research paste
- State labeling: CONFIRMED / INFERRED / ASSUMPTION on audit claims
- Triangulation: git status vs allowlist before every commit
- Read-only: master prices, fiscal, unrelated hub modules
- If main diverges badly: open PR from current branch with path-limited commits still preferred over dumping all changes

# Open Items

- [ASSUMPTION: origin/main is a valid base for a clean branch | verify with git fetch; if not, branch from HEAD + allowlist]
- [ASSUMPTION: gh CLI authenticated | if not, push and print compare URL for manual PR]
- [ASSUMPTION: doppler works for smoke | if not, npm run dev:full with existing .env]
- [ASSUMPTION: User wants PR not merge | do not merge]

# Blockers

None to start tests and path-limited commit prep. Human may be needed for: gh auth, Doppler login, or merge decision.
