# Master Prompt — Fix "Error al cargar el resumen" on ML Manager (root cause + resilience)

> This file is both the approved **plan** and the **`/set-goal` master prompt**. It is self-contained and pipe-ready for a downstream Claude Code `/goal` session. Language: English (executor performs better in English). Every non-trivial claim is tagged `[CONFIRMED]` / `[INFERRED]` / `[ASSUMPTION]`.

---

## Context (why this change)

The ML Manager dashboard at `/hub/ml-manager` → **Resumen** tab shows a red blanket error:

> *"Error al cargar el resumen. Verificá la conexión con Mercado Libre."*

…**while the top-right badge says "● Cuenta conectada" (green)** — a self-contradiction visible in the source screenshot. `[CONFIRMED: from screenshot /Users/matias/.claude/jobs/850a91d1/tmp/error_resumen.png]`

Root analysis from code (read-only exploration of `/Users/matias/calculadora-bmc`):

- The Resumen tab (`src/components/hub/ml/tabs/OverviewTab.jsx:27-40`) fires **4 parallel** React Query calls — `/ml/users/me`, `/ml/listings`, `/ml/questions`, `/ml/orders` — then:
  ```js
  const anyError = me.error || listings.error || questions.error || orders.error;
  if (anyError) return <div>…Error al cargar el resumen. Verificá la conexión con Mercado Libre.</div>;
  ```
  `[CONFIRMED]` So **any single** failed call blanks the whole tab and blames the connection.
- The "Cuenta conectada" badge is driven by `useConnectorStatus()` → `GET /auth/ml/status` (`server/index.js:337-355`), which **only checks that a token exists** — it never calls Mercado Libre. `[CONFIRMED]` So the badge being green tells us nothing about whether the data calls work.
- Both the ML Manager re-cabling (PR #412) and the GCS token-store identity fix (commit `03f00b1`) shipped **today, 2026-06-23**. `[CONFIRMED: memory + commit history reported by exploration]` A freshly-introduced backend failure on one of the 4 endpoints is therefore the prime suspect — but the exact failing call + status is **not determinable from code alone**; it needs the live prod network response or Cloud Run logs. `[INFERRED | basis: error is swallowed client-side; only prod telemetry reveals which call + status]`

Intended outcome: the Resumen tab loads real data in prod again; when a single section fails it degrades gracefully and shows the *actual* error/status instead of a misleading connection warning.

---

## Role

You are a senior full-stack engineer fixing a production bug in the BMC calculator (`~/calculadora-bmc`: React 18 + Vite 7 SPA frontend + Express 5 API, deployed to Vercel (frontend) + Cloud Run service `panelin-calc` in GCP project `chatbot-bmc-live`, region `us-central1`). `[CONFIRMED: memory reference-bmc-cloud-run]` You diagnose against live prod evidence before editing, make the smallest correct change, and verify end-to-end in prod.

## Goal

**One sentence:** Make `/hub/ml-manager` → Resumen load successfully in production by fixing the actual failing `/ml/*` backend call, and harden `OverviewTab` so a single failure degrades gracefully and surfaces the real error instead of blaming the ML connection.

Expansion:
- Reproduce in prod and identify **which** of the 4 calls fails and with **what** status + payload.
- Fix the backend root cause (token/scope/seller-id/route/GCS — whichever the evidence shows).
- Refactor `OverviewTab` to render per-section (partial success) and show the specific failing call + its real status/message.
- Keep the "Cuenta conectada" badge meaning honest, or note the gap.
- Ship: gates → commit → push → verify prod.

## Scope

**IN:**
- Diagnose + fix the failing ML Manager Resumen path (backend `server/` + frontend `src/components/hub/ml/`).
- Per-section error resilience and honest error messaging in `OverviewTab.jsx`.
- Verification in prod.

**OUT (do NOT touch unless evidence forces it):**
- The OAuth login/callback flow (`/auth/ml/start`, `/auth/ml/callback`) — unless diagnosis proves the token itself is the cause.
- The GCS token-store identity fix from commit `03f00b1` (already landed today). `[CONFIRMED]`
- Other Hub modules, the Calculadora, Tareas, Analytics, etc.
- Rotating/re-issuing ML OAuth tokens or changing OAuth scopes **without explicit confirmation** (see Constraints).

## Constraints & Guardrails

- `[CONFIRMED]` **Git safety:** `cd ~/calculadora-bmc` and confirm it's a git root before any git command. Never run git from `~`. Read its `AGENTS.md` first.
- `[CONFIRMED]` **Secrets via Doppler:** local dev runs `doppler run -- npm run dev`. Production backend reads secrets from **GCP Secret Manager** (`chatbot-bmc-live`), frontend from Vercel env. Do not paste secrets into code or logs.
- `[CONFIRMED]` **Read-only ML scope by default:** the Resumen tab only reads (users/me, listings, questions, orders). Do not introduce write calls. Do not modify ML OAuth scopes or trigger a token refresh/re-auth without explicit user confirmation — a bad refresh can revoke the working `refresh_token`.
- `[INFERRED]` **Diagnose before edit:** capture the failing call's status + payload from prod (Network tab or Cloud Run logs) before changing backend code. Do not guess-patch all 4 handlers.
- **Smallest correct change.** Match surrounding code style. No new deps unless unavoidable.
- `[CONFIRMED: CLAUDE.md]` When setting any env var via CLI, use `printf '%s'` not `echo` (trailing-newline trap).
- Do not deploy to prod from this session beyond the normal `git push` → CI pipeline; let CI deploy Vercel + Cloud Run.

## Inputs (paths, IDs, URLs the executor needs)

**Source screenshot:** `/Users/matias/.claude/jobs/850a91d1/tmp/error_resumen.png` (and original on `~/Desktop`). `[CONFIRMED]`

**Frontend (`~/calculadora-bmc`):** `[CONFIRMED — file paths/lines verified by exploration]`
- `src/App.jsx:199-210` — route `/hub/ml-manager`.
- `src/components/hub/ml/MlManagerModule.jsx:10-15,32-58` — tabs + connection badge (`status.data?.ok === true`).
- `src/components/hub/ml/tabs/OverviewTab.jsx:27-40` — **the error message + `anyError` blanket logic (primary frontend edit target)**.
- `src/components/hub/ml/hooks/useMlConnector.js` — `useConnectorStatus`, `useUserMe`, `useListings`, `useQuestions`, `useOrders` (note `retry: 0` on status + useUserMe).
- `src/components/hub/ml/utils/mlFetch.js` — fetch helper (`credentials: 'include'`, throws `Error` with `.status` + `.payload`).
- `src/utils/calcApiBase.js` — `getCalcApiBase()` (prod uses `VITE_API_URL` or `window.location.origin`).

**Backend (`~/calculadora-bmc/server`):** `[CONFIRMED]`
- `server/index.js:337-355` — `GET /auth/ml/status` (token-existence only; no ML call).
- `server/index.js:357-363` — `GET /ml/users/me`.
- `server/index.js:373-381` — `GET /ml/listings` (uses `resolveSellerId` → `/users/{id}/items/search`).
- `server/index.js:421-469` — `GET /ml/questions` (param allowlist; `api_version=4`, `site_id=MLU`).
- `server/index.js:495-529` — `GET /ml/orders` (param allowlist; `seller={id}`).
- `server/index.js:1151-1167` — global error handler → `{ ok:false, error, details }`.
- `server/mercadoLibreClient.js` — `ensureValidToken()` (106-136), `requestWithRetries()` (138-187), `resolveSellerId()` (207-229).
- `server/tokenStore.js` — GCS store via `Compute()` identity (commit `03f00b1`); bucket `gs://bmc-ml-tokens` (`ML_TOKEN_GCS_BUCKET`), object `ml-tokens.enc`.

**Prod / infra:** `[CONFIRMED: memory]`
- Frontend prod: `https://calculadora-bmc.vercel.app` → `/hub/ml-manager`.
- Backend: Cloud Run `panelin-calc` (frontend `panelin-calc-web`), project `chatbot-bmc-live`, `us-central1`.
- ML token bucket: `gs://bmc-ml-tokens`. Secrets: GCP Secret Manager in `chatbot-bmc-live`.
- ML config: `ML_SITE_ID=MLU`, `ML_API_BASE=https://api.mercadolibre.com`, `ML_CLIENT_ID` default `742811153438318`. `[CONFIRMED: server/config.js per exploration]`

## Tools & MCPs

- **Bash** — git, `npm run` gates, `gcloud` (Cloud Run logs), `doppler run`.
- **Playwright MCP** (`mcp__playwright__*`) — open prod `/hub/ml-manager`, log into the Hub, open the Resumen tab, capture `browser_network_requests` to see which `/ml/*` call returns what status + body. This is the fastest path to the real error. `[INFERRED]`
  - Alternative: `gcloud run services logs read panelin-calc --project chatbot-bmc-live --region us-central1` to read the global-error-handler output (`err`, `path`, `payload`). `[INFERRED]`
- **Read / Grep / Edit** — code.
- BMC gates: `npm run gate:local` (lint+test), `pre-deploy`, `smoke:prod`. `[CONFIRMED: WORKSPACE.md]`

## Anti-patterns (do NOT do)

- ❌ Patching all 4 backend handlers blindly without first identifying the failing call. `[INFERRED]`
- ❌ Assuming it's an OAuth/connection problem because the message says so — the badge proves a token exists; the failure is downstream. `[CONFIRMED]`
- ❌ Triggering a token refresh / re-running `/auth/ml/start` as a "fix" before confirming the token is actually the cause — risks revoking a working `refresh_token`. `[CONFIRMED: refresh logic in mercadoLibreClient.js]`
- ❌ Removing the `anyError` check without giving the user a real per-section failure signal (don't silently hide failures either). `[INFERRED]`
- ❌ `echo` for env vars (use `printf '%s'`). `[CONFIRMED: CLAUDE.md]`
- ❌ Shipping `[ASSUMPTION]` tags un-resolved — exhaust memory, AGENTS.md, PROJECT-STATE.md, and the actual code/logs first. `[CONFIRMED: memory feedback-no-assumptions]`
- ❌ Running git from `~`. `[CONFIRMED]`

## Deliverables (artifacts with destinations)

1. **Diagnosis note** — which `/ml/*` call fails, exact HTTP status + payload (from prod Network tab or Cloud Run logs), and the root cause. (State it in the session; optionally append to `docs/team/PROJECT-STATE.md`.)
2. **Backend fix** — minimal change in `server/index.js` and/or `server/mercadoLibreClient.js` / `server/tokenStore.js` addressing the confirmed root cause.
3. **Frontend hardening** — `src/components/hub/ml/tabs/OverviewTab.jsx` refactored to:
   - render each section (me / listings / questions / orders) independently (partial success), and
   - when a section fails, show that section's **real** status/message (from `err.status` / `err.payload`), not a blanket "verify connection".
   - Optionally reword the badge or empty/error copy so it stops contradicting "Cuenta conectada".
4. **Green gates** — `npm run gate:local` passing locally.
5. **Commit + push** — conventional prefix (`fix:`), pushed so CI deploys Vercel + Cloud Run.
6. **Prod verification** — Resumen loads in prod (Playwright screenshot as evidence).
7. **Handoff/bitácora line** per BMC convention (`docs/team/BITACORA-MATIAS.md`). `[CONFIRMED: memory feedback-bitacora-system]`

## Success Criteria (verifiable)

- [ ] The specific failing call + status is identified and quoted from prod evidence (not inferred).
- [ ] After deploy, `/hub/ml-manager` → Resumen renders real summary data in prod (verified via Playwright). `[CONFIRMED: route exists]`
- [ ] Simulating a single-endpoint failure shows that section's real error + the other 3 sections still render (no blanket blank). `[INFERRED]`
- [ ] The misleading "Verificá la conexión con Mercado Libre" no longer appears when the connection is actually valid.
- [ ] `npm run gate:local` passes; CI is green; `npm run smoke:prod` passes if applicable.
- [ ] No new ML write calls or scope/token changes introduced.

## Operational Anchors (BMC conventions inherited)

- **Source hierarchy / triangulate:** planilla → repo → docs → consolidate; never trust one source. `[CONFIRMED: CLAUDE.md]`
- **Route to repo:** all work inside `~/calculadora-bmc`; load its `AGENTS.md` + `docs/team/PROJECT-STATE.md` first. `[CONFIRMED]`
- **Ship loop:** Fix → Deploy → Verify; document before shipping. `[CONFIRMED: memory feedback-documentation-quality-check]`
- **Secrets:** Doppler local / GCP Secret Manager prod / Vercel frontend. `[CONFIRMED]`
- **Session closeout:** write branch, uncommitted files, blockers, next prompt at end. `[CONFIRMED: CLAUDE.md]`

## Open Items / Assumptions to verify before executing

- `[ASSUMPTION: the failing call is a backend /ml/* endpoint, not a frontend base-URL/CORS issue | verify: first Network-tab capture in prod — confirm the request reaches the backend and the status code]`
- `[ASSUMPTION: PR #412 + commit 03f00b1 shipped 2026-06-23 are already deployed to prod | verify: check Cloud Run revision + Vercel deployment timestamps; if not deployed, the "fix" may already exist and just needs a redeploy]`
- `[ASSUMPTION: prod Hub login is available to the executor via Playwright (Google OAuth) | verify: if login is blocked, fall back to Cloud Run logs for diagnosis]` — if blocked, this is a human-gated step: stop and request access per the External-Blockers rule. `[CONFIRMED: CLAUDE.md external-blockers]`
- Likely root-cause shortlist to check against evidence, in order: (1) one endpoint's `resolveSellerId` failing (questions/orders need seller id); (2) a 429 rate-limit on one call (`retry:0` makes it fatal); (3) token scope/expiry surfacing only on data calls; (4) GCS token read still failing post-fix on one path. `[INFERRED]`

## Verification (how to test end-to-end)

1. **Repro + diagnose:** Playwright → `https://calculadora-bmc.vercel.app/hub/ml-manager`, log in, open Resumen, `browser_network_requests` → record each `/ml/*` status + body. Cross-check with `gcloud run services logs read panelin-calc`.
2. **Local fix loop:** `cd ~/calculadora-bmc && doppler run -- npm run dev`; reproduce locally if possible; apply fix.
3. **Gate:** `npm run gate:local`.
4. **Ship:** `fix:` commit → push → watch CI (`gh run`) → Cloud Run + Vercel deploy.
5. **Prod verify:** re-open Resumen in prod via Playwright; screenshot showing data loaded; confirm partial-failure resilience by inspecting one section.
6. **`npm run smoke:prod`** if present.

---

### Pipe-ready hint (for after plan approval)
Because plan mode restricts writes to this file, the set-goal `.md` could not be saved to cwd. After approval, either execute directly, or copy this file's body to `~/calculadora-bmc/goal-prompt-fix-ml-resumen.md` and run: `claude /goal < goal-prompt-fix-ml-resumen.md`.
