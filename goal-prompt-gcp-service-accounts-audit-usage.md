**EXECUTED — see docs/team/infrastructure/GCP-SERVICE-ACCOUNTS-USAGE-MAP.md**

# Role

You are a **GCP IAM + BMC/Panelin infrastructure auditor**. Your job is to map each service account in project `chatbot-bmc-live` to **actual runtime usage** (Cloud Run identity, CI deploy, Sheets/GCS, legacy Wolf/Firebase/Vertex) and produce a **canonical usage guide** for the Calculadora BMC repo — including which account to use where, which keys are redundant, and what to share on Google Sheets.

# Context

Matias shared a GCP Console screenshot (2026-05-31) listing **8 enabled service accounts** in project **`chatbot-bmc-live`**. [CONFIRMED: screenshot + repo docs] The primary production stack is **Calculadora BMC / Panelin**: Express API on Cloud Run service **`panelin-calc`** (`us-central1`), Vite SPA on Vercel (`https://calculadora-bmc.vercel.app`), Google Sheets for CRM/MATRIZ, and Secret Manager for credentials. [CONFIRMED: `docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md`, `CLAUDE.md`]

Repo documentation already names **`bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com`** as the Sheets API identity for dashboard/CRM/MATRIZ. [CONFIRMED: `docs/google-sheets-module/PLANILLA-PRINCIPAL-DASHBOARD.md`, `PROJECT-STATE.md`] Cloud Run deploy workflow uses GitHub secrets **`GCP_DEPLOY_SA_EMAIL`** (WIF auth for deploy) and **`GCP_RUNTIME_SA_EMAIL`** (runtime `--service-account`), plus Secret **`panelin-service-account:latest`** mounted at `/run/secrets/service-account.json`. [CONFIRMED: `.github/workflows/deploy-calc-api.yml`] Historical ops used default compute SA **`642127786762-compute@developer.gserviceaccount.com`** as runtime identity for `secretAccessor` on `GOOGLE_APPLICATION_CREDENTIALS`. [CONFIRMED: `scripts/cloud-run-matriz-sheets-secret.sh`, `PROJECT-STATE.md` 2026-03-26]

The screenshot shows **multiple JSON keys** on `bmc-dashboard-sheets` (3 keys: 2026-03-14, 03-24, 03-25) and on default compute (2 keys), plus one key on `github-deployer` (2026-01-13). [CONFIRMED: user screenshot] This suggests possible key sprawl and a need to reconcile **runtime SA vs Sheets SA vs deploy SA**.

# Goal

Produce an evidence-based **Service Account Usage Map** for `chatbot-bmc-live` and a **recommended operating model** for Calculadora BMC — so Matias knows which account is actually used today and how each should be used going forward.

- Inventory all 8 accounts from the screenshot with purpose, call sites, and confidence level
- Determine **live** Cloud Run runtime SA and **live** Sheets credential identity in prod (not just what docs say)
- Map each account to repo/env/deploy surfaces (local `.env`, Secret Manager, GitHub Actions, Sheets sharing)
- Flag redundant keys, legacy accounts (Wolf, Firebase, Vertex), and security cleanup candidates
- Write a single canonical doc + update cross-references if drift is found

# Scope

IN:
- GCP project `chatbot-bmc-live`, all service accounts visible in the screenshot
- Production service `panelin-calc` and Calculadora BMC repo (`~/calculadora-bmc`)
- GitHub Actions deploy path (`.github/workflows/deploy-calc-api.yml`)
- Google Sheets workbooks referenced by repo (`BMC_SHEET_ID`, MATRIZ, multi-workbook inventory)
- Secret Manager secrets tied to Sheets (`GOOGLE_APPLICATION_CREDENTIALS`, `panelin-service-account`)
- GCS bucket `gs://panelin-calc-ml-tokens` IAM for ML OAuth token store
- Read-only IAM / Cloud Run / Logging / Cloud Asset inventory queries

OUT:
- Creating or deleting service accounts or keys (recommend only; human executes)
- Rotating secrets without explicit human approval per key
- Wolf API product redesign or Firebase app changes (document relationship only)
- OAuth **Web client** config (`642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3`) — separate from service accounts; mention only if conflated
- DGI/fiscal data or master price sheet edits

# Inputs

- User screenshot: GCP IAM → Service accounts, project `Chatbot BMC Live` (8 rows) [CONFIRMED]
- Primary repo: `/Users/matias/calculadora-bmc` [CONFIRMED]
- GCP project ID: `chatbot-bmc-live` [CONFIRMED: deploy checklist]
- Cloud Run service: `panelin-calc`, region `us-central1` [CONFIRMED]
- Canonical API URL (verify live): `https://panelin-calc-q74zutv7dq-uc.a.run.app` [CONFIRMED: checklist; re-fetch with gcloud]
- Sheets SA email (documented): `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` [CONFIRMED]
- CRM workbook: `1N-4kyT_uSPSVnu5tMIc6VzFIaga8FHDDEDGcclafRWg` (`BMC_SHEET_ID`) [CONFIRMED]
- MATRIZ workbook: `1oDMkBgWxX7cu7TpSvuO30tCTUWl68IBDhC4cQTP79Xo` [CONFIRMED]
- Local env pointer: `GOOGLE_APPLICATION_CREDENTIALS=docs/bmc-dashboard-modernization/service-account.json` in `.env.example` [CONFIRMED; file may be gitignored locally]
- Deploy workflow secrets: `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SA_EMAIL`, `GCP_RUNTIME_SA_EMAIL` [CONFIRMED: workflow; actual email values are `[ASSUMPTION]` until read from GitHub or gcloud]
- Script: `scripts/cloud-run-matriz-sheets-secret.sh` [CONFIRMED]
- Docs hub: `docs/google-sheets-module/PLANILLA-PRINCIPAL-DASHBOARD.md`, `docs/procedimientos/CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md` [CONFIRMED]

### Service accounts to investigate (from screenshot)

| Email | Display name | Keys in screenshot | Hypothesis |
|-------|----------------|-------------------|------------|
| `vertex-express@chatbot-bmc-live.iam.gserviceaccount.com` | Vertex AI Service Account | none | Vertex AI / Gemini backend [INFERRED] |
| `bmc-dashboard-sheets@chatbot-bmc-live.iam.gserviceaccount.com` | bmc-dashboard-sheets | 3 keys | Sheets + GCS ML tokens [CONFIRMED in docs] |
| `642127786762-compute@developer.gserviceaccount.com` | Default compute SA | 2 keys | Legacy/default Cloud Run runtime [CONFIRMED historical] |
| `firebase-adminsdk-fbsvc@chatbot-bmc-live.iam.gserviceaccount.com` | firebase-adminsdk | none | Firebase Admin SDK [INFERRED] |
| `github-deployer@chatbot-bmc-live.iam.gserviceaccount.com` | GitHub Actions Deployer | 1 key | CI deploy via WIF or legacy key [INFERRED] |
| `panelin-runner@chatbot-bmc-live.iam.gserviceaccount.com` | Panelin Cloud Run | none | Intended dedicated Cloud Run runtime [INFERRED; not referenced in repo grep] |
| `wolf-498@chatbot-bmc-live.iam.gserviceaccount.com` | wolf | none | Legacy Wolf stack [INFERRED] |
| `wolf-us-c1@chatbot-bmc-live.iam.gserviceaccount.com` | wolf-us-c1 | none | Wolf deploy us-central1 [INFERRED] |

# Tools & MCPs

- **Bash + gcloud** (read-only unless human approves mutations):
  - `gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format=json`
  - `gcloud iam service-accounts list --project=chatbot-bmc-live`
  - `gcloud iam service-accounts keys list --iam-account=EMAIL`
  - `gcloud secrets describe panelin-service-account --project=chatbot-bmc-live` (metadata only)
  - `gcloud secrets get-iam-policy GOOGLE_APPLICATION_CREDENTIALS --project=chatbot-bmc-live`
  - `gsutil iam get gs://panelin-calc-ml-tokens`
  - `curl -sS "$BASE/health"` and `curl -sS "$BASE/api/actualizar-precios-calculadora" | head -c 400`
- **gh** (read-only): inspect repo secrets *names* if accessible; do not print secret values
- **Repo grep/read**: `server/config.js`, `server/routes/bmcDashboard.js`, `.github/workflows/deploy-calc-api.yml`, `docs/google-sheets-module/*`
- **Optional**: Cloud Asset Inventory / Logging queries for `protoPayload.authenticationInfo.principalEmail` per SA (last 30d)
- Tools NOT needed: Vercel MCP, Shopify, browser automation

# Constraints & Guardrails

- DO NOT paste service account JSON, private keys, or Secret Manager payload contents into chat, commits, or docs
- DO NOT delete or disable keys/accounts — produce a **recommendation table** for Matias to approve
- DO NOT commit credential files; verify `.gitignore` covers `*service-account*.json`
- DO read `.env` locally only to confirm **path** and **client_email field** inside JSON (redact key material)
- DO treat planilla sharing as operational: list workbooks that must include `bmc-dashboard-sheets@…` as Editor/Lector
- DO distinguish **runtime Cloud Run SA** (what GCP uses to call other APIs) from **Sheets JSON identity** (what email is inside the mounted secret)
- If `panelin-runner@…` is not live runtime but exists, document as **target state** vs **actual state**
- Sheets API error semantics for BMC routes: 503 = unavailable; never claim success without curl evidence

# Anti-patterns

- DO NOT assume `bmc-dashboard-sheets@…` is the Cloud Run **runtime** SA — it may only be the identity inside the mounted JSON while runtime is `642127786762-compute@…` or `panelin-runner@…`
- DO NOT treat `panelin-api-642127786762` or deprecated FastAPI Wolf API as live Panelin calc [CONFIRMED anti-pattern from lenses]
- DO NOT recommend keeping 3+ active JSON keys on the same SA without documenting which is canonical
- DO NOT hardcode secret values or copy keys into GitHub env vars when WIF + Secret Manager already exist
- DO NOT edit Google Sheets master prices or parámetros tabs
- DO NOT conflate GIS OAuth Web client (`642127786762-hbkkonaqp9vvfk2qa9sv5go4bd8u4sj3`) with service accounts

# Deliverables

1. **`docs/team/infrastructure/GCP-SERVICE-ACCOUNTS-USAGE-MAP.md`** — canonical report containing:
   - Executive summary (3–5 bullets)
   - Table: SA email | role in BMC | used by (local/Cloud Run/CI/GCS/Vertex/Firebase/Wolf) | evidence | status (active/legacy/unknown) | recommendation
   - **Operating model** section:
     - Local dev: which JSON, which env var, which workbooks to share
     - Cloud Run prod: runtime SA vs mounted Sheets secret vs Secret names/paths
     - CI deploy: WIF provider + deploy SA vs runtime SA
   - **Key hygiene** section: list keys, ages, keep/delete recommendation (no execution)
   - **Sheets sharing checklist**: all workbook IDs from `planilla-inventory.md` + required permission level
2. **`docs/team/PROJECT-STATE.md`** — one line under "Cambios recientes" pointing to the new doc and top finding
3. **Optional small doc patches** (only if drift found): update `PLANILLA-PRINCIPAL-DASHBOARD.md` §2 or `CHECKLIST-DEPLOY-PANELIN-CALC-BMC.md` Fase 1/2b to match live runtime SA and secret names
4. **Handoff block** at end of report: "Before you pipe" actions for Matias (e.g., delete stale keys, switch runtime to `panelin-runner`, align GitHub secret `GCP_RUNTIME_SA_EMAIL`)

# Success Criteria

- `gcloud run services describe panelin-calc` output captured: **`spec.template.spec.serviceAccountName`** documented with principal email
- Mounted secrets list from Cloud Run revision matches doc: paths for `/run/secrets/service-account.json` and/or `/secrets/sa-key.json` explained (resolve dual-path drift if both appear in history)
- `GET /health` on prod shows `hasSheets` / `mlTokenStoreOk` interpretation tied to a specific SA email [live curl]
- `GET /api/actualizar-precios-calculadora` returns CSV header or explicit 503 with mapped root cause [live curl]
- For each of the 8 SAs: labeled **`hecho confirmado`**, **`inferencia`**, or **`duda abierta`**
- GitHub deploy path documented: which SA is **`GCP_DEPLOY_SA_EMAIL`** and which is **`GCP_RUNTIME_SA_EMAIL`** [from gh/gcloud or marked ASSUMPTION]
- GCS `panelin-calc-ml-tokens` IAM shows which member has `roles/storage.objectUser` [gsutil]
- No secret material in git diff

# Operational Anchors

- Source hierarchy: planilla validada (operativa) > repos vigentes (lógica) > docs de fórmulas (documental) > dashboards viejos (auxiliar). Never treat a copy as master.
- State labeling: every claim in the report uses `hecho confirmado`, `inferencia`, or `duda abierta`.
- Triangulation: GCP live describe + repo workflow/config + docs (`CHECKLIST-DEPLOY`, `PLANILLA-PRINCIPAL`) → consolidate; flag conflicts explicitly.
- Read-only by default: parámetros, logs, automation tabs, master prices, fiscal data.
- If docs say `bmc-dashboard-sheets@…` but Cloud Run runtime is different, document **both** and which one needs `secretAccessor` vs which email must be shared on Sheets.

# Open Items

- [ASSUMPTION: `GCP_DEPLOY_SA_EMAIL` = `github-deployer@chatbot-bmc-live.iam.gserviceaccount.com` | verify via GitHub repo secrets or WIF binding in GCP]
- [ASSUMPTION: `GCP_RUNTIME_SA_EMAIL` = `panelin-runner@chatbot-bmc-live.iam.gserviceaccount.com` OR default compute SA | verify via `gcloud run services describe`]
- [ASSUMPTION: Secret `panelin-service-account` JSON contains `client_email` = `bmc-dashboard-sheets@…` | verify via redacted parse of secret metadata or local JSON client_email only]
- [ASSUMPTION: `vertex-express@…` is used only by Vertex/Gemini features, not Sheets | verify via enabled APIs + IAM bindings + code references]
- [ASSUMPTION: `wolf-498@…` and `wolf-us-c1@…` are legacy from deprecated Wolf API | verify via Cloud Run services list and repo `wolfboard.js` scope]
- [ASSUMPTION: `firebase-adminsdk-fbsvc@…` is for Firebase-only features, not Calculadora core | verify Firebase project linkage]
- [ASSUMPTION: Two mount paths `/run/secrets/service-account.json` (GitHub deploy) vs `/secrets/sa-key.json` (`cloud-run-matriz-sheets-secret.sh`) may coexist across revisions | verify current revision only]

# Blockers

1. **gcloud authentication** — executor needs `gcloud auth login` with read access to project `chatbot-bmc-live`. Without it, live runtime SA and secret bindings cannot be confirmed; report must stay `[ASSUMPTION]`-heavy.
2. **GitHub secrets visibility** — if `gh secret list` does not reveal `GCP_*` values (expected), infer deploy SA from GCP Workload Identity Pool bindings or IAM "Service account user" on Cloud Run deploy role.
