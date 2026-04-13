# 02 — Production vs local state

## Executive Findings

**Production (API on Cloud Run)** was **verified** for core health, capabilities, MATRIZ CSV export, ML token presence, and CRM AI suggest-response using `npm run smoke:prod -- --json` on **2026-04-13**. A **material drift signal** was captured: **`public_base_url` reported by `/capabilities` does not match the default smoke base URL**, even though both hosts returned 200 for exercised checks. **Local full stack** was **not** started during this audit session; local state is inferred from configs and prior `.runtime` logs present in workspace history, not re-executed here.

## Evidence Reviewed

- `npm run smoke:prod -- --json` output (captured in audit session): `ok: true` with detailed `checks` array; `public_base_url` check `ok: false` with explicit note comparing `panelin-calc-q74zutv7dq-uc.a.run.app` vs `panelin-calc-642127786762.us-central1.run.app`.
- `scripts/smoke-prod-api.mjs` — `DEFAULT_BASE` constant and behavior description in header comments.
- `scripts/smoke-prod-api.mjs` — `public_base_url` validation logic (read during audit).
- `server/agentCapabilitiesManifest.js` — uses `config.publicBaseUrl` from env (`server/config.js`).
- `vite.config.js` — dev proxy to `localhost:3001`.
- `src/utils/calcApiBase.js` — build-time and runtime API base resolution.
- `.env.example` — documents `VITE_API_URL`, `VITE_SAME_ORIGIN_API`, `PUBLIC_BASE_URL`.
- Shell: `git status -sb` on branch `claude/live-calculator-editing-Beqxk`.

## Current State

### 1) Repo state

- Active branch: **`claude/live-calculator-editing-Beqxk`** (not `main`).
- Untracked: `.codex/`, `docs/team/ux-feedback/panelin-pro-lamina-mockup.png` (per `git status -sb` at audit time).
- `package.json` version **3.1.5**.

### 2) Local development (expected behavior from code)

- **Vite dev:** `http://localhost:5173` with `/api` and `/calc` proxied to **`http://localhost:3001`** (`vite.config.js`).
- **API:** `npm run start:api` → `server/index.js`, default **PORT 3001** (`server/config.js`).
- **`getCalcApiBase()`:** in `import.meta.env.DEV`, defaults API to `http://localhost:3001` unless `VITE_API_URL` set (`src/utils/calcApiBase.js`).

### 3) Production — verified vs inferred

| Aspect | Status | Notes |
|--------|--------|------|
| Cloud Run API liveness (`/health`) | **Verified** | HTTP 200 in smoke JSON |
| Capabilities manifest | **Verified** | HTTP 200 |
| MATRIZ CSV endpoint | **Verified** | 200 + CSV shape per smoke helper |
| ML token | **Verified** | `/auth/ml/status` returned 200 (token present) in this run |
| CRM AI suggest | **Verified** | POST returned 200; smoke text noted `grok` |
| `public_base_url` consistency | **Verified mismatch** | Flagged by smoke with `ok: false` on that sub-check while overall `ok: true` |
| Vercel SPA env (`VITE_*`) | **No verificado** | Not available from repo alone |
| WhatsApp HMAC secret presence | **No verificado** | Requires runtime env inspection |

### 4) Local vs production differences (architectural)

- **Origin model:** local dev relies on **Vite proxy same-origin** to API; production Vercel typically needs explicit **`VITE_API_URL`** to Cloud Run unless same-origin bundle is used.
- **OAuth redirect:** `PUBLIC_BASE_URL` and ML redirect URIs must match the **actual** browser-facing API host; multi-host situation increases misconfiguration risk.

### 5) Drift between documentation, contracts, and code

- **Hosts:** `docs/openapi-calc.yaml` `servers[0].url` uses `https://panelin-calc-642127786762.us-central1.run.app` (read from file header region); `/capabilities` at smoke time advertised a **different** `public_base_url` (see smoke output). **Code/runtime wins for truth**; docs/scripts can lag.
- **Policy vs implementation:** “No hardcoded sheet IDs” vs default MATRIZ id in `server/config.js` (see inventory finding).

### 6) Critical dependencies / fragility

- **Sheets availability:** many `/api/*` routes degrade to **503** semantics per `AGENTS.md`; contract script often treats 503 as pass — hides outages from “contract OK” narrative.
- **External AI in CI:** `channels_pipeline` invokes prod `suggest-response` — **CI availability coupled to provider keys and quotas**.

## Gap Analysis

Primary gap is **environment authority**: multiple URLs are “valid enough” to pass health checks while still being **inconsistent for OAuth, GPT Actions, and agent discovery**. Secondary gap is **lack of recorded local attestations** in this audit (gate/build not re-run).

## Master Implementation Plan

See **`docs/audit/05-master-implementation-plan.md`** — Phase 0 specifically addresses host authority and smoke alignment.

## Risks

- **Red-class (verified):** `public_base_url` mismatch while services respond — agents may cache wrong URLs.
- **Yellow-class:** Vercel build without `VITE_API_URL` / `VITE_SAME_ORIGIN_API` may ship a SPA pointing at **`http://localhost:3001`** per `getCalcApiBase()` fallback path for non-dev builds.

## Next Actions

1. Pick **one** canonical API hostname for: smoke default, OpenAPI `servers`, `PUBLIC_BASE_URL` in prod, and GPT Actions.
2. Update smoke to **fail** when `public_base_url` mismatches (or gate with `SMOKE_STRICT_BASE=1`).
3. Run **`npm run gate:local:full`** on a clean CI-like Node version and record output in next audit revision.

---

### Finding: public_base_url / smoke base drift

- **Severity:** Red
- **Evidence:**
  - `npm run smoke:prod -- --json` — check object `path: "public_base_url"`, `ok: false`, note lists two different `*.run.app` hosts.
  - `scripts/smoke-prod-api.mjs` — `DEFAULT_BASE` uses `642127786762` host (read from file).
  - `scripts/smoke-prod-api.mjs` — on `!baseMatch`, code path **does not** set `criticalFail` (comment: “No falla el job: solo alerta de drift”; optional `criticalFail = true` is commented out).
- **Impact:** OAuth redirect URIs, GPT Actions server URL, and human operational docs may diverge silently.
- **Recommendation:** Align `PUBLIC_BASE_URL` on the live Cloud Run service that is intended canonical; update `DEFAULT_BASE` + OpenAPI + any hardcoded URLs; add CI assertion.
- **Verification:** Smoke `public_base_url` check `ok: true` without `--base` override **and** CI fails on drift once smoke is hardened (uncomment or equivalent flag).

### Finding: Production SPA configuration not attestable from repo

- **Severity:** Yellow
- **Evidence:** `getCalcApiBase()` behavior for production bundles (`src/utils/calcApiBase.js`).
- **Impact:** Worst case: broken client pointing to localhost.
- **Recommendation:** Add runtime console warning in prod if API base resolves to localhost; enforce Vercel env checks in `npm run pre-deploy` for `VITE_API_URL` when deploying Vercel.
- **Verification:** Lighthouse/network trace from `calculadora-bmc.vercel.app` shows API calls to Cloud Run host, not localhost.

---

## #ZonaDesconocida

- Whether **both** Cloud Run URLs route to the same revision/service user-data plane.
- Actual **Vercel** environment variable set for the latest production deployment.
