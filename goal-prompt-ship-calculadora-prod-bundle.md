# Role

You are the **BMC Calculadora production ship agent**. Your job is to consolidate every in-flight calculator and hub modification on branch `feat/ml-manager-integrated`, pass local gates, merge to `main`, deploy frontend + API to production, and verify end-to-end — without breaking MATRIZ pricing, auth, or Cloud Run secrets.

# Blockers

1. **Uncommitted working tree** — [CONFIRMED: `git status` 2026-06-22] 14 modified files + 15 untracked paths (Omni runtime, drive archive, calculator UX) are NOT on any commit yet. Must be committed (or explicitly split) before deploy.
2. **Branch not on `main`** — [CONFIRMED: branch `feat/ml-manager-integrated` is 2 commits ahead of `origin/main`; uncommitted delta is additional.] Production deploy typically flows from `main` via CI (`deploy-calc-api.yml`, Vercel auto-deploy).
3. **Omni Core DB migration (conditional)** — [INFERRED: `npm run omni:migrate` requires `DATABASE_URL` | basis: `server/migrations/omni/` + PROJECT-STATE entry]. Shadow-write flags default OFF — migration is safe but optional for this ship if flags stay OFF. Verify prod Postgres before enabling any `OMNI_*_SHADOW_WRITE=1`.
4. **Drive auto-archive env** — [ASSUMPTION: `DRIVE_QUOTE_FOLDER_ID` + service-account Editor on folder are set in prod Cloud Run | verify before executing]. Without it, archive is best-effort no-op; local PDF download still works.
5. **Human gates (do not block calculator ship, but document)** — [CONFIRMED: PROJECT-STATE] Google Tasks Calendar scope, Meta WA webhook, some GSM-only secrets (`WHATSAPP_ACCESS_TOKEN`, etc.) remain operator tasks — OUT of scope unless deploy workflow changes.

# Context

Calculadora BMC (`calculadora-bmc`, v3.1.5) is a React 18 + Vite 7 SPA with Express 5 API on Cloud Run (`panelin-calc`, `chatbot-bmc-live`, `us-central1`). Canonical production narrative: Cloud Run unified SPA+API ([`docs/calculadora/CANONICAL-PRODUCTION.md`](docs/calculadora/CANONICAL-PRODUCTION.md)); Vercel (`https://calculadora-bmc.vercel.app`) remains active secondary frontend.

The team has been working on **calculator UX (navigation + blocker removal)**, **ML Manager hub**, **Drive auto-archive for quotes**, and **Omni Core WAVE 1+2 (shadow writes OFF)**. As of 2026-06-22:

- Branch: `feat/ml-manager-integrated` @ `d04a7f4` (2 commits ahead of `origin/main`)
- Working tree: ~678 LOC changed across 14 tracked files + substantial untracked Omni/discovery docs
- PROJECT-STATE last updated 2026-06-22 documents Omni + Drive archive as recent work

# Goal

Ship to production **all calculator and hub modifications currently on `feat/ml-manager-integrated` plus the uncommitted working tree**, with navigation improvements live, wizard blockers removed, ML Manager routable, Drive auto-archive wired, and Omni Core deployed in **shadow-off safe mode**.

- Reconcile staged + unstaged changes into clean atomic commit(s) on the feature branch
- Run `npm run gate:local:full` and fix any failures
- Open PR to `main`, get it mergeable, merge (or ship via approved deploy path)
- Deploy API to Cloud Run `panelin-calc` and frontend to production (Vercel and/or Cloud Run unified per team decision)
- Run `npm run smoke:prod` and manual spot-checks on calculator wizard + `/hub/ml`
- Update `docs/team/PROJECT-STATE.md` "Cambios recientes" with ship evidence

# Scope

**IN:**
- All modifications enumerated in § Modification Inventory below
- Local gates: lint, test, build (`gate:local:full`)
- Production smoke: health, MATRIZ CSV, capabilities, Google Client ID bundle check
- PR creation, merge to `main`, CI-triggered deploy
- Post-deploy verification of calculator wizard nav, PDF gating, ML Manager route
- PROJECT-STATE propagation entry

**OUT:**
- Enabling Omni shadow writes in production (`OMNI_*_SHADOW_WRITE=1`) — deploy code only, flags stay OFF
- Running Omni backfills in production (`omni:backfill-*`) unless explicitly approved
- Operator-only gates: Meta WA webhook, Google Tasks Calendar OAuth scope, API_AUTH_TOKEN rotation
- Editing master price sheets, parámetros tabs, or fiscal data
- `npm audit fix --force`
- Branch cleanup / archival of stale PRs
- Full OmniCRM UI flip (Sheets → omni inbox) — design-only docs ship as code, not user-facing flip

# Modification Inventory

## A. Committed on branch (2 commits ahead of `origin/main`) — ML Manager + deploy guard

| # | Area | Files / routes | What changed |
|---|------|----------------|--------------|
| A1 | **ML Manager dashboard** | `src/components/hub/ml/MlManagerModule.jsx`, `tabs/*`, `hooks/useMlConnector.js`, `utils/mlFetch.js` | Full ML Manager UI: Overview, Listings, Messages, Shipments, Ads, Analytics tabs |
| A2 | **Hub routing** | `src/App.jsx` | Routes `/hub/ml` and `/hub/ml-manager` → `MlManagerModule` (lazy) |
| A3 | **Hub launcher** | `src/components/BmcWolfboardHub.jsx` [INFERRED: link exists per grep] | Entry card/link to `/hub/ml` |
| A4 | **Module nav** | `src/components/BmcModuleNav.jsx` [INFERRED: pathname match `/hub/ml`] | Nav highlights ML Manager routes |
| A5 | **Vercel deploy guard** | `.github/workflows/deploy-vercel.yml` | Post-deploy smoke fails if `VITE_GOOGLE_CLIENT_ID` not embedded in bundle (prevents `tokeninfo_aud_mismatch`) |
| A6 | **Env docs** | `.env.example`, `docs/team/PROJECT-STATE.md`, `src/data/calculatorDataVersion.js` | Parity notes + version bump |

## B. Uncommitted — Calculator UX: navigation + blocker removal

| # | Area | Files | What changed |
|---|------|-------|--------------|
| B1 | **Wizard edge navigation (all breakpoints)** | `src/styles/bmc-mobile.css`, `PanelinCalculadoraV3_backup.jsx` | Replaced phone-only fixed arrows with `.bmc-wizard-shell` grid + sticky side nav (prev/next) on phone/tablet/desktop |
| B2 | **Wizard step accessibility** | `PanelinCalculadoraV3_backup.jsx` | `maxReachedStep` tracks furthest step reached; users can jump back to unlocked steps |
| B3 | **Remove "bordes" step blocker** | `PanelinCalculadoraV3_backup.jsx` `isStepValid("bordes")` | Perimeter accessories optional — wizard advances without completing 2D border plant |
| B4 | **SegmentedControl confirm gesture** | `PanelinCalculadoraV3_backup.jsx` | Double-click (or click when already selected) confirms and advances via `onOptionDoubleClick` |
| B5 | **Dropdown auto-advance** | `PanelinCalculadoraV3_backup.jsx` | Select fields dispatch `bmc-wizard-next` when `advanceOnChange` set |
| B6 | **Identity gate removed** | `PanelinCalculadoraV3_backup.jsx` ~L2707 | Comment: "Identity gate disabled — calculator fully usable without login" |
| B7 | **PDF export gating (quality guard, not blocker)** | `src/utils/projectFile.js`, `PanelinCalculadoraV3_backup.jsx` | New helpers: `isProyectoDatosObligatoriosCompletos`, `getProyectoCamposObligatoriosFaltantes`, `getProyectoPdfBlockReason`; PDF/WA buttons disabled until proyecto has razón social/RUT or nombre + teléfono + dirección; toast + jump to proyecto step |
| B8 | **Mobile bottom bar PDF state** | `MobileBottomBar` in `PanelinCalculadoraV3_backup.jsx` | `pdfReady` / `pdfBlockedTitle` props wire PDF disable + tooltip |

## C. Uncommitted — Drive auto-archive (company shared folder)

| # | Area | Files | What changed |
|---|------|-------|--------------|
| C1 | **Server archive endpoint** | `server/routes/quoteDriveArchive.js`, mount in `server/index.js` | `POST /api/quotes/drive-archive` — PDF + `.bmc.json` to shared folder |
| C2 | **Drive upload lib** | `server/lib/driveUpload.js` (+181 LOC) | Folder structure: `cliente → código cotización → files`; service-account upload |
| C3 | **Frontend archive client** | `src/utils/companyDriveArchive.js` | `archiveQuotationToCompanyDrive()` best-effort after PDF export |
| C4 | **Calculator integration** | `PanelinCalculadoraV3_backup.jsx` | `persistExportToCompanyDrive` on PDF enriquecido, PDF cliente, export presupuesto; removed personal-OAuth `saveQuotation` import path for manual Drive |
| C5 | **Env** | `.env.example` | `DRIVE_QUOTE_FOLDER_ID` comment updated for shared BMC folder |

## D. Uncommitted — Omni Core WAVE 1+2 (safe deploy: flags OFF)

| # | Area | Files | What changed |
|---|------|-------|--------------|
| D1 | **Omni lib** | `server/lib/omni/*` | DDL helpers, identity, normalize/persist, Zod types, WA/ML/email shadow adapters |
| D2 | **Omni routes** | `server/routes/omni.js`, mount `/api/omni/*` | Health, conversations, messages, read, reply |
| D3 | **Shadow hooks** | `server/index.js`, `server/routes/wa.js`, `server/ml-crm-sync.js` | WA webhook + ML sync mirror when flags ON |
| D4 | **Config flags** | `server/config.js`, `.env.example` | `OMNI_WA_SHADOW_WRITE`, `OMNI_ML_SHADOW_WRITE`, `OMNI_EMAIL_SHADOW_WRITE`, `OMNI_EVENT_BUS_ENABLED` — all default `false` |
| D5 | **Migrations + scripts** | `server/migrations/omni/`, `scripts/omni-migrate.mjs`, `omni-backfill-*.mjs` | `npm run omni:migrate`, backfill CLIs |
| D6 | **Tests** | `tests/omni*.test.js`, `package.json` `test:core` + `test:omni:parity` | Offline omni unit tests |
| D7 | **Contract validator** | `scripts/validate-api-contracts.js` | Omni health endpoint registered |
| D8 | **Design docs (no runtime impact)** | `docs/transformation/*`, `docs/discovery/*` | ADR-001…010, wave execution doc — ship as documentation |

## E. Uncommitted — Misc

| # | Area | Files | What changed |
|---|------|-------|--------------|
| E1 | **Validation tests** | `tests/validation.js` | Adjustments for project validation helpers |
| E2 | **Dashboard** | `server/routes/bmcDashboard.js` | Minor (+15 LOC) — review diff before ship |
| E3 | **PROJECT-STATE** | `docs/team/PROJECT-STATE.md` | Entries for Omni + Drive archive (partially written) |

# Inputs

- Repo: `/Users/matias/calculadora-bmc` [CONFIRMED]
- Branch: `feat/ml-manager-integrated` @ `d04a7f4` [CONFIRMED]
- Base for PR: `origin/main` [CONFIRMED]
- Production frontend: `https://calculadora-bmc.vercel.app` [CONFIRMED: AGENTS.md]
- Production API: Cloud Run `panelin-calc`, project `chatbot-bmc-live`, region `us-central1` [CONFIRMED: deploy skill]
- Canonical component: `src/components/PanelinCalculadoraV3_backup.jsx` [CONFIRMED: CLAUDE.md]
- Deploy checklists: `docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`, `.cursor/skills/bmc-calculadora-deploy-from-cursor/SKILL.md` [CONFIRMED]
- Required Cloud Run secrets manifest: `.github/required-cloud-run-secrets.txt` [CONFIRMED: PROJECT-STATE gate0 entry]
- Google OAuth client: `642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3.apps.googleusercontent.com` [CONFIRMED: PROJECT-STATE 2026-06-21]

# Tools & MCPs

- **Bash / file tools**: gate, build, git, smoke scripts
- **Vercel MCP** (optional): confirm production deployment URL and env vars — do not expose secrets in chat
- **gcloud CLI**: Cloud Run deploy URL, revision inspect — requires authenticated session (human gate if missing)
- **gh CLI**: PR create, merge status, CI checks
- **Browser / smoke**: manual wizard nav verification on prod URL
- **NOT needed for this ship**: Sheets edits, Shopify mutations, Omni backfill against prod DB

# Constraints & Guardrails

- DO NOT commit `.env` or credential JSON files
- DO NOT enable `OMNI_*_SHADOW_WRITE=1` in production without explicit approval + `omni:migrate` verified
- DO NOT run `npm audit fix --force`
- DO NOT omit any secret from `--set-secrets` on Cloud Run deploy (regression wipes IA/ML keys — see PROJECT-STATE 2026-06-11 gate0)
- DO NOT hardcode sheet IDs, tokens, or production URLs — use `config.*` / env
- DO NOT force-push `main`
- DO run `npm run gate:local:full` before any PR marked ready
- DO run `npm run smoke:prod` after deploy; MATRIZ CSV check is critical
- DO verify `VITE_GOOGLE_CLIENT_ID` parity with `GOOGLE_OAUTH_CLIENT_ID` on Cloud Run after Vercel deploy
- DO update PROJECT-STATE "Cambios recientes" after successful ship
- Read-only: master price sheets, parámetros tabs, fiscal/DGI data

# Anti-patterns

- DO NOT treat `panelin-api-642127786762` as live — zombie service
- DO NOT skip MATRIZ smoke (`GET /api/actualizar-precios-calculadora`) — silent pricing outage
- DO NOT deploy API without checking `.github/required-cloud-run-secrets.txt` against workflow `--set-secrets`
- DO NOT assume uncommitted work is already in prod — verify git SHA on `/version` or `/capabilities` post-deploy
- DO NOT block calculator ship on Omni backfill or shadow-write enablement
- DO NOT use personal Google Drive OAuth for quote archive when company folder + service account is the new canonical path
- DO NOT merge with failing CI or red `gate:local:full`

# Deliverables

1. **Clean commit(s)** on feature branch grouping: (1) calculator UX + mobile nav, (2) Drive archive, (3) Omni Core runtime, (4) ML Manager if not already committed, (5) docs/PROJECT-STATE
2. **Pull request** to `main` with summary table mirroring § Modification Inventory + test plan
3. **Merged `main`** with green CI
4. **Production deploy** — Cloud Run revision + Vercel production build (document which surfaces were updated)
5. **Smoke evidence** — paste or save output of `npm run smoke:prod` (passing)
6. **Manual verification notes** — wizard prev/next on desktop + mobile width; PDF blocked until proyecto complete; `/hub/ml` loads; optional Drive archive toast
7. **PROJECT-STATE entry** — `docs/team/PROJECT-STATE.md` "Cambios recientes" with date, commits, deploy revision, verification status

# Success Criteria

- [ ] `npm run gate:local:full` exits 0 on the branch merged to `main`
- [ ] `npm run smoke:prod` exits 0 including MATRIZ CSV (not skipped)
- [ ] `GET /health` on prod returns `ok: true`
- [ ] `https://calculadora-bmc.vercel.app/` (or Cloud Run `/calculadora/`) loads calculator without login wall
- [ ] Wizard shows sticky left/right nav arrows on viewport ≥640px and phone; "bordes" step does not block advance
- [ ] PDF Cliente button disabled with tooltip when proyecto missing teléfono/dirección; enabled when complete
- [ ] `/hub/ml` renders ML Manager dashboard (Overview tab visible)
- [ ] `POST /api/quotes/drive-archive` returns structured response (200 or graceful error if folder unset — not 500 crash)
- [ ] `GET /api/omni/health` returns 200 with flags showing shadow writes OFF (or 503 if DB unreachable — document)
- [ ] No new secrets leaked in git diff
- [ ] PROJECT-STATE updated with ship record

# Operational Anchors

- Source hierarchy: planilla validada (operativa) > repos vigentes (lógica) > docs de fórmulas (documental) > dashboards viejos (auxiliar). Never treat a copy as master.
- State labeling: mark findings `hecho confirmado`, `inferencia`, or `duda abierta` in handoff notes.
- Triangulation: planilla → repo → documentation → consolidate.
- Deploy order: local gate → PR → merge → API deploy (secrets intact) → frontend deploy → smoke prod → manual UX spot-check.
- If Vercel + Cloud Run dual deploy: confirm which URL operators use; run smoke against canonical API base.

# Open Items

- [ASSUMPTION: Production deploy target is Vercel frontend + Cloud Run API (mode A) | verify before executing — team doc also describes Cloud Run unified mode B]
- [ASSUMPTION: `DRIVE_QUOTE_FOLDER_ID` already provisioned in Cloud Run prod | verify in GSM/env before expecting archive success]
- [ASSUMPTION: User wants ALL uncommitted work shipped together, not split into separate PRs | if scope too large, split: UX+Drive first, Omni second]
- [ASSUMPTION: `feat/ml-manager-integrated` is the correct integration branch | verify no parallel work on `main` (local main is 3 commits ahead of origin — check for divergence)]
- [ASSUMPTION: Omni migration not required for prod deploy while shadow flags OFF | confirm `/api/omni/health` degrades gracefully without tables]

# Execution Sequence (recommended)

1. `git status` + review diffs for secrets and accidental debug code
2. Stage and commit in logical groups with conventional messages (`feat(calc):`, `feat(drive):`, `feat(omni):`, `feat(hub):`)
3. `npm run gate:local:full` — fix until green
4. Push branch, open PR to `main` with inventory + test plan
5. Address review / CI failures
6. Merge PR
7. Confirm CI deploy workflows complete (Vercel + Cloud Run)
8. `npm run smoke:prod`
9. Manual UX checks (wizard nav, PDF gate, `/hub/ml`)
10. Update PROJECT-STATE
11. Report: commits SHAs, deploy revision/URL, smoke output summary, any remaining operator gates
