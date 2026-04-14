---
name: cloud-agent-repo-starter
description: >
  Minimal runbook for Cloud agents on Calculadora-BMC: install, env, start API + Vite,
  lint/test/build gates, contract tests, smoke prod, feature toggles via env vars,
  and where to look next. Use when bootstrapping a fresh agent session or verifying CI locally.
---

# Cloud agent — Calculadora BMC repo starter

Fast path to **install**, **run**, and **test** this monorepo (Vite React `src/`, Express `server/`, Node scripts). Canonical command table: root **`AGENTS.md`**.

---

## 0. First minutes (any task)

1. **Node:** use **Node 20** (matches CI `.github/workflows/ci.yml`).
2. **Dependencies:** `npm ci` (CI) or `npm install` (local flexibility).
3. **Env file:** `npm run env:ensure` — copies **`.env.example` → `.env`** once if `.env` is missing; **does not overwrite** an existing `.env`.
4. **Secrets:** this repo has **no interactive “login”** for the app. You configure **`.env`** (and optionally `GOOGLE_APPLICATION_CREDENTIALS` path to a service-account JSON). **Never commit** `.env` or credential files.
5. **Disk:** `npm run dev` / `npm run build` run **`disk:precheck`** first. If it fails with low space, follow workspace rule **disk-space-recovery** (user approval before bulk deletes).

---

## 1. Run the stack

| Goal | Command | URLs |
|------|---------|------|
| API only | `npm run start:api` | `http://localhost:3001` — `GET /health` |
| Vite only | `npm run dev` | `http://localhost:5173` |
| API + Vite (typical) | `npm run dev:full` | API **:3001**, Vite **:5173** |
| Same, shell wrapper | `./run_full_stack.sh` | same |

**Frontend → API:** in dev, the SPA defaults to **`http://localhost:3001`** (see `src/utils/calcApiBase.js`). Override with **`VITE_API_URL`** at build time if the UI is not served from Vite dev.

---

## 2. “Feature flags” and toggles (env, not LaunchDarkly)

There is **no central feature-flag service**. Behavior is controlled by **environment variables** (server: `.env` / `process.env`; client: **`VITE_*`** only, baked at build time).

| Area | Variables (examples) | Effect |
|------|----------------------|--------|
| SPA API base | `VITE_API_URL`, `VITE_SAME_ORIGIN_API` | Where the browser calls the API (`calcApiBase.js`) |
| Google Drive picker (client) | `VITE_GOOGLE_CLIENT_ID` | Drive integration; warn if missing |
| Authenticated UI → API | `VITE_BMC_API_AUTH_TOKEN` | Must match server **`API_AUTH_TOKEN`** for cockpit / pricing editor flows |
| Skip disk guard | `BMC_DISK_PRECHECK_SKIP=1` | Local only if precheck blocks in constrained VMs |
| Smoke / contracts base URL | `BMC_API_BASE`, `SMOKE_BASE_URL` | Point scripts at local API or prod |

**Mocking:** for unit logic, tests import **`src/utils/*.js`** directly (no flag). For HTTP, run the server with **minimal `.env`** and use **503 / empty `data`** semantics as documented in **`AGENTS.md`** (Sheets unavailable ≠ throw unhandled 500 in routes).

---

## 3. By codebase area — test workflows

### 3.1 Calculator + shared `src/utils` (BOM, pricing, roof helpers)

| Step | Command |
|------|---------|
| Unit + integration scripts | `npm test` → runs `tests/validation.js` and `tests/roofVisualQuoteConsistency.js` |
| Lint UI | `npm run lint` (eslint **`src/`** only) |
| Production bundle | `npm run build` |

**After touching `src/`:** `npm run lint` → `npm test` → `npm run build` (or `npm run gate:local:full`).

### 3.2 `server/` — API, `/api/*`, `/calc/*`, webhooks

| Step | Command |
|------|---------|
| Start API | `npm run start:api` |
| Contract shape check | `npm run test:contracts` (needs server; hits **`BMC_API_BASE`** or `http://localhost:3001`) |
| Smoke against **public** API | `npm run smoke:prod` — optional `SMOKE_SKIP_MATRIZ=1` / `-- --skip-matriz` if MATRIZ is flaky |

**OAuth / ML / Shopify / WhatsApp:** flows need real credentials in `.env` and often **human steps** (see `docs/ML-OAUTH-SETUP.md`, `docs/team/HUMAN-GATES-ONE-BY-ONE.md`). Do not assert “logged in” without evidence from `/health` or the relevant status route.

### 3.3 Dashboard / Finanzas (Sheets-backed routes)

Same server as 3.2. **Contract validation** is the fastest automated check after editing **`server/routes/bmcDashboard.js`**. Deeper audit: **`scripts/run_audit.sh`** / skills **bmc-dashboard-audit-runner** (heavy).

### 3.4 Chat / Panelin assistant

| Step | Command |
|------|---------|
| Chat hardening tests | `npm run test:chat` → `tests/chat-hardening.js` |

Requires API + keys only if tests call live models (see test file / server routes).

### 3.5 Transportista (Postgres)

| Step | Command |
|------|---------|
| Migrations | `npm run transportista:migrate` — needs **`DATABASE_URL`** |

### 3.6 Optional / heavy pipelines

Use only when the task needs them: `npm run panelsim:session`, `npm run pre-deploy`, `npm run smoke:prod`, `npm run channels:automated`, Knowledge Antenna (`npm run knowledge:run`), etc. Details in **`AGENTS.md`**.

---

## 4. Recommended gates (map to CI)

| CI / use case | Command |
|---------------|---------|
| PR-style quick gate | `npm run gate:local` → **lint + test** |
| Before commit with UI changes | `npm run gate:local:full` → **lint + test + build** |
| Match validate job | `npm ci && node tests/validation.js && npm run build` |

---

## 5. Updating this skill when you learn something new

1. **Add the trick here** in the smallest section that fits (by area §3 or env §2), with the **exact npm script name** and any **env var**.
2. If the workflow is **official** for humans too, add or link a line in root **`AGENTS.md`** (single source for long tables).
3. If it changes **CI behavior**, update **`.github/workflows/ci.yml`** in the same PR.
4. For **disc-only** or **one-off** debugging notes, prefer a short doc under `docs/team/orientation/` and link one line from this skill — keep **`SKILL.md`** minimal.

---

## 6. Pointers

- **Project status:** `docs/team/PROJECT-STATE.md`
- **Sheet / dashboard contracts:** `docs/google-sheets-module/`, `docs/bmc-dashboard-modernization/DASHBOARD-INTERFACE-MAP.md`
- **Deploy / smoke:** `.cursor/skills/bmc-calculadora-deploy-from-cursor/SKILL.md`
