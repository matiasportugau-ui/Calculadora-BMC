# Role
You are a senior full-stack engineer on Calculadora BMC responsible for restoring per-user Google Drive folder configuration for **all authenticated internal users** by eliminating the `503 drive_config_unavailable` failure on `POST /api/drive/config`.

# Blockers
1. **Production `DATABASE_URL` access is required** to apply the missing Postgres migration. [CONFIRMED: `docs/team/PROJECT-STATE.md` lists "aplicar la migración contra DATABASE_URL" as pending setup.] Use Doppler (`bmc-backend/prd`) or an operator-provided connection string — do not invent credentials.
2. If prod migration cannot be applied in this session, ship at minimum: clearer operator runbook, pre-deploy check, and a user-facing error message — but the systemic fix for all users is the migration.

# Context
[CONFIRMED: The UI screenshot shows `drive config 503: {"ok":false,"error":"drive_config_unavailable"}` when a logged-in user (Matías Portugau, `matias.portugau@gmail.com`) tries to save a Drive folder from the "Drive" tab in the calculator.]

[CONFIRMED: `server/routes/driveConfig.js` returns `503` + `drive_config_unavailable` **only** when Postgres raises error code `42P01` (relation does not exist) on `INSERT INTO identity.user_drive_config`. GET degrades gracefully to `{ ok: true, config: null }` when the table is absent — so users can open the tab but cannot persist folder choice.]

[CONFIRMED: The required table is defined in `supabase/migrations/20260624000001_user_drive_config.sql`, applied idempotently by `scripts/identity-golive-apply.sh` (which also runs `20260601000001_identity_init.sql`). `docs/team/PROJECT-STATE.md` (2026-06-24 entry) documents this feature and explicitly marks migration apply as **pending**.]

[INFERRED: Production Cloud Run `panelin-calc` has `DATABASE_URL` configured via Secret Manager | basis: `.github/workflows/deploy-calc-api.yml` sets `DATABASE_URL=DATABASE_URL:latest`; identity/Omni/WA features already use the same pool via `getWaPool(config.databaseUrl)`.]

[INFERRED: This is **not** a Google OAuth / `VITE_GOOGLE_CLIENT_ID` issue | basis: OAuth and folder browser work (user reached folder selection); failure happens on BMC identity JWT → `/api/drive/config` POST after client-side validation.]

# Goal
Make per-user Drive folder configuration work for every authenticated BMC user in production (and local dev with DB), with no `drive_config_unavailable` on save.

- Diagnose whether prod Postgres lacks `identity.user_drive_config` (expected root cause)
- Apply the idempotent migration to the production `DATABASE_URL`
- Verify `GET`/`POST /api/drive/config` end-to-end with a real BMC JWT against prod API
- Harden ops so the migration is not skipped on future deploys (script, pre-deploy check, or CI smoke)
- Improve user-facing error copy if migration/table is still missing (Spanish, actionable for operators)
- Update `docs/team/PROJECT-STATE.md` "Cambios recientes" when done

# Scope
IN:
- Postgres migration `supabase/migrations/20260624000001_user_drive_config.sql`
- Apply scripts: `scripts/identity-golive-apply.sh`, `scripts/identity-golive.sh`
- API route: `server/routes/driveConfig.js` (`GET`/`POST /api/drive/config`)
- Frontend: `src/utils/driveConfigApi.js`, `src/components/DriveFolderConfig.jsx`, `src/components/GoogleDrivePanel.jsx`
- Tests: `tests/drive-config-routes.test.js`
- Ops: Doppler prod `DATABASE_URL`, Cloud Run service `panelin-calc` (us-central1)
- Docs: `docs/team/PROJECT-STATE.md`, optionally `docs/master-plans/user-identity-GOLIVE.md`

OUT:
- Google OAuth client setup / `VITE_GOOGLE_CLIENT_ID` (separate concern — only touch if POST succeeds but Drive upload fails)
- Phase 2 consolidated "all users' quotes" view
- Firestore (explicitly replaced by Postgres per PROJECT-STATE)
- Unrelated identity phases (MFA, Sheets sync tab creation) unless blocked by migration apply

# Inputs
- Repo: `/Users/matias/calculadora-bmc` (package `calculadora-bmc`, v3.1.5) [CONFIRMED]
- Prod API: `https://panelin-calc-q74zutv7dq-uc.a.run.app` or canonical URL from `npm run smoke:prod` / `PUBLIC_BASE_URL` [ASSUMPTION: verify current Cloud Run URL before curl | verify before executing]
- Prod frontend: `https://calculadora-bmc.vercel.app` [CONFIRMED]
- Migration: `supabase/migrations/20260624000001_user_drive_config.sql` [CONFIRMED]
- Apply script: `scripts/identity-golive-apply.sh` [CONFIRMED]
- Route handler: `server/routes/driveConfig.js` lines 68–96 (503 on `42P01`) [CONFIRMED]
- Test contract: `tests/drive-config-routes.test.js` describe "migration not yet applied (42P01)" [CONFIRMED]
- Supabase project (identity schema): `htnwozvopveibwppyjhg` per migration header [CONFIRMED]
- Secrets source: Doppler `bmc-backend/prd` for `DATABASE_URL` [CONFIRMED per workspace CLAUDE.md]
- Screenshot evidence: user on Drive tab, BMC login OK, folder picker attempted, POST 503 [CONFIRMED from user report]

# Tools & MCPs
- **bash / psql**: apply migration; verify `\d identity.user_drive_config` or `select count(*) from pg_tables where schemaname='identity' and tablename='user_drive_config'`
- **doppler CLI**: `doppler run --project bmc-backend --config prd -- bash scripts/identity-golive-apply.sh` [INFERRED pattern | verify Doppler project names]
- **curl / fetch**: prod `GET /health`, authenticated `GET/POST /api/drive/config`
- **node**: `node tests/drive-config-routes.test.js` (offline route tests)
- **npm**: `npm run gate:local`, `npm run test:api` if touching server routes; `npm run smoke:prod` for prod health
- **Read skill**: `.cursor/skills/bmc-google-drive-oauth/SKILL.md` — only if OAuth symptoms appear after DB fix
- **Read skill**: `.cursor/skills/bmc-calculadora-deploy-from-cursor/SKILL.md` — if code changes require redeploy
- Tools NOT needed: Vercel redeploy (unless frontend error-message change), Google Sheets MCP, ML OAuth

# Constraints & Guardrails
- DO NOT commit secrets (`.env`, `DATABASE_URL`, JWT tokens, Doppler dumps)
- DO NOT run destructive SQL (`DROP`, `TRUNCATE`) on production — migration is `CREATE TABLE IF NOT EXISTS` only
- DO NOT hardcode Sheet IDs, Cloud Run URLs, or API tokens in code
- DO apply migration idempotently via existing script; prefer `identity-golive-apply.sh` over ad-hoc SQL
- DO verify with authenticated POST after migration — GET returning `config: null` is not sufficient proof
- DO update `docs/team/PROJECT-STATE.md` "Cambios recientes" after any behavior/ops change
- DO run `npm run gate:local` before commit if code changes are made
- Read-only by default: master price sheets, fiscal data, parámetros tabs

# Anti-patterns
- DO NOT treat `panelin-api-642127786762` as the live API — zombie service [CONFIRMED anti-pattern]
- DO NOT assume the bug is missing `VITE_GOOGLE_CLIENT_ID` — that produces client-side OAuth errors, not `drive_config_unavailable` [INFERRED from code path]
- DO NOT return 500 for Sheets-like semantics on this route — existing contract uses 503 for unavailable config store
- DO NOT skip prod migration and only fix local — user asked "for all users" (production impact)
- DO NOT re-run full `identity_init.sql` destructively — script is idempotent but verify no manual edits to prod schema outside the script
- DO NOT store OAuth state in-memory (unrelated but standing BMC anti-pattern)

# Deliverables
- **Ops (primary):** `identity.user_drive_config` table present in prod Postgres (evidence: psql query output or script success log)
- **Verification log:** successful authenticated `POST /api/drive/config` → `200` + `{ ok: true, config: { folderId, folderName, valid: true } }` against prod API
- **Optional code hardening (if warranted):**
  - `scripts/identity-golive-preflight.mjs` or `npm run pre-deploy` check for table existence
  - `package.json` npm script alias e.g. `identity:golive:apply` → `bash scripts/identity-golive-apply.sh`
  - `src/components/DriveFolderConfig.jsx` — map `drive_config_unavailable` to Spanish operator message ("Falta migración de base de datos — contactá al admin")
- **Tests:** existing `tests/drive-config-routes.test.js` still green; add preflight test only if new check script is added
- **Docs:** entry in `docs/team/PROJECT-STATE.md` "Cambios recientes" documenting migration applied + verified
- **Commit/PR:** only if code/docs changed; migration apply alone may be ops-only with doc update

# Success Criteria
- [ ] `psql "$DATABASE_URL" -c "\d identity.user_drive_config"` succeeds on **production** DB (or equivalent count query returns 1)
- [ ] From prod frontend or curl with valid BMC JWT: `POST /api/drive/config` with `{ folderId, folderName }` returns **200**, not 503
- [ ] Same user can reload Drive tab: `GET /api/drive/config` returns saved folder (not permanently `null` after POST)
- [ ] `node tests/drive-config-routes.test.js` passes locally
- [ ] If code touched: `npm run gate:local` green
- [ ] Manual UAT: Matías (or test comprador account) selects/creates folder → "Carpeta configurada" → "Guardar cotización actual en Drive" no longer blocked by config 503
- [ ] `docs/team/PROJECT-STATE.md` updated; pending "aplicar migración" item closed or marked done

# Operational Anchors
- Source hierarchy: planilla validada (operativa) > repos vigentes (lógica) > docs (documental) > dashboards viejos (auxiliar)
- State labeling: mark findings `hecho confirmado`, `inferencia`, or `duda abierta`
- Triangulation for this task:
  - **Repo:** `driveConfig.js` + test `42P01` → POST 503 `drive_config_unavailable` [CONFIRMED authoritative for error semantics]
  - **Docs:** `PROJECT-STATE.md` 2026-06-24 → migration pending [CONFIRMED authoritative for ops gap]
  - **Planilla:** not involved (Postgres identity schema, not Sheets)
- Most authoritative for root cause: **repo + PROJECT-STATE** agree — missing migration

# Open Items
- [ASSUMPTION: Prod Postgres never had `20260624000001_user_drive_config.sql` applied | verify with `\d identity.user_drive_config` or POST repro before migrating]
- [ASSUMPTION: Executor has Doppler access to `bmc-backend/prd` DATABASE_URL | verify before executing]
- [ASSUMPTION: Canonical prod API base is the current Cloud Run URL from deploy workflow / smoke script | verify with `curl …/health`]
- [ASSUMPTION: No secondary cause (e.g. wrong schema search_path) — if migration applied but 503 persists, inspect full Postgres error in Cloud Run logs, not only `42P01` branch]
- None of the above block starting diagnosis — first step is read-only verification queries
