# Project health snapshot — 2026-05-02

**Run type:** Holistic health (first tracked snapshot after skill creation).  
**Repo cwd:** Calculadora-BMC monorepo.  
**Git:** branch `feat/ml-search-and-price-monitor-schema` (not `main`); HEAD `2f11614` at time of checks. Working tree had pre-existing local edits; health commands were executed on that tree.

---

## Executive summary

Production API smoke against the default Cloud Run base completed with **exit code 0**: `/health`, `/capabilities`, `public_base_url` alignment, **MATRIZ CSV** (`GET /api/actualizar-precios-calculadora`), ML token status, WhatsApp webhook probe (expected 403 without verify token), and `**POST /api/crm/suggest-response`** returned **200** with provider **claude**. Local `**npm run gate:local`** and `**npm run gate:local:full**` both completed **exit code 0**: **384** unit/assertion tests passed; **Vite production build** succeeded. ESLint reported **2 warnings** (0 errors) in `AgentAdminModule.jsx` (exhaustive-deps) and `roofEncounterModel.js` (unused `_dropped`). Canonical doc **Última actualización** in `PROJECT-STATE.md` remained **2026-04-30** until the follow-up edit in this same session; recent narrative there still centers on access-control roadmap, Sheets/CRM fixes, and ML hub work. `**npm run test:contracts`** and `**npm run ml:verify**` were **not** run this snapshot—treat API contract and ML OAuth posture as **unverified** for this run.

---

## Readiness legend (same as skill)

- **100%:** Smoke + gate:local:full green this run, docs aligned, no evidenced blockers for that area.
- **85–99%:** Core checks green; minor gaps (optional checks skipped, lint warnings only).
- **70–84%:** Partial verification or critical checks skipped.
- **50–69%:** Known partial failures or unverified critical path.
- **Below 50%:** Broken path or no safe evidence.

---

## Architecture map table


| Area                            | Responsibility                        | Evidence                                                    | Status                                                     | Readiness % | Objective                           | Impact                     | Next steps                                                  |
| ------------------------------- | ------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- | ----------- | ----------------------------------- | -------------------------- | ----------------------------------------------------------- |
| Frontend Vite SPA               | Calculator UX, hub modules, PDF flows | `src/`, `CLAUDE.md`; `npm run build` OK                     | Prod bundle builds locally; Vercel UI not browsed this run | **90%**     | Ship stable cotizador + hub         | Revenue/ops UX             | Clear 2 ESLint warnings; optional Playwright spot on Vercel |
| Express API                     | Routes, CRM, calc, webhooks           | `server/`; smoke prod all probes OK                         | Public API healthy on probed paths                         | **95%**     | Reliable API for app + integrations | All channels depend on API | Run `test:contracts` when changing routes                   |
| Sheets / MATRIZ / CRM           | Pricing CSV, dashboard reads          | Smoke MATRIZ 200; `PROJECT-STATE` 2026-04-27 Sheets fixes   | MATRIZ endpoint OK from smoke host                         | **92%**     | Single source of pricing truth      | Pricing + CRM consistency  | Keep `BMC_SHEET_SCHEMA`/IDs in env per docs                 |
| ML / Shopify / webhooks         | External commerce                     | Smoke `/auth/ml/status` OK; suggest-response 200            | ML token present in prod; IA path working in smoke         | **88%**     | Answer ML + CRM assist reliably     | Sales velocity             | Run `npm run ml:verify` locally when iterating OAuth        |
| Drive / GCS / PDF               | Quotes persistence                    | Not exercised this run                                      | Unknown file upload this snapshot                          | **75%**     | Durable quote artifacts             | Delivery to client         | Spot-check Drive save on staging when touching PDF          |
| Postgres / Transportista / Omni | Persisted logistics                   | Tests include transportista helpers; no DB migration run    | Logic tests green; DB connectivity not probed              | **80%**     | Correct driver/event persistence    | Field ops                  | Run migrations only when `DATABASE_URL` set for target      |
| Hub / Wolfboard                 | Internal operativa UI                 | `DASHBOARD-INTERFACE-MAP.md` (not re-read in full this run) | Indirect: API slices used by hub healthy in smoke          | **82%**     | Single operativa surface            | Team throughput            | Manual hub smoke on Vercel after risky UI PRs               |
| GPT / MCP / OpenAPI             | External agent surface                | Capabilities OK in smoke; snapshot regen not run            | Manifest served; local MCP not exercised                   | **78%**     | Builder ↔ runtime parity            | AI actions stay safe       | `npm run capabilities:snapshot` after manifest edits        |
| CI / quality                    | Lint, test, build, CI workflows       | gate:local:full green; 2 lint warnings                      | Ready for commit subject to warning policy                 | **88%**     | Green mainline                      | Prevents regressions       | Fix or waive two ESLint warnings                            |
| Docs / team process             | Source of truth                       | `PROJECT-STATE.md` header 2026-04-30 prior to session patch | Rich recent history; roadmap docs referenced in state      | **90%**     | Everyone aligned                    | Reduces rework             | After this snapshot: keep one-line updates per protocol     |


---

## Health checks table


| Command                   | Result this run   | Notes                                                                                                                                      |
| ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run smoke:prod`      | **pass** (exit 0) | Base `https://panelin-calc-q74zutv7dq-uc.a.run.app`; all script checks reported ✓ including MATRIZ CSV and `suggest-response` (claude).    |
| `npm run gate:local`      | **pass** (exit 0) | ESLint: 0 errors, **2 warnings** (see above). Tests: **384 passed**.                                                                       |
| `npm run gate:local:full` | **pass** (exit 0) | Includes `npm run build` (Vite 7); PWA generateSW completed. `version:data` ran in prebuild (updates `src/data/calculatorDataVersion.js`). |
| `npm run test:contracts`  | **skipped**       | Requires API on localhost:3001 — not started this snapshot.                                                                                |
| `npm run ml:verify`       | **skipped**       | Optional local OAuth sanity — not run.                                                                                                     |
| Vercel UI / Playwright    | **skipped**       | No browser E2E this snapshot.                                                                                                              |


---

## Recent developments (from PROJECT-STATE)

Cited from `[docs/team/PROJECT-STATE.md](../PROJECT-STATE.md)` **Cambios recientes** (abbrev.):

- **2026-04-30:** ACCESS-CONTROL roadmap TOC + code-path clarity (`ACCESS-CONTROL-PLAN-VERCEL-CALCULADORA.md`).
- **2026-04-29:** Access control plan consolidated; roadmap Fase 0 (ADR, Area 4 inventory, Supabase checklist, `.env.example` placeholders).
- **2026-04-27:** Sheets endpoints restored + Cloud Run hardening + ML tokens GCS + uuid override; ML Hub inline KB; Agent Admin; ML OAuth PKCE; plan-import E2E; roof desnivel per segment; fiscal tests; PDF templates.

---

## Risks / blockers (evidence-only)

- **Lint warnings (non-blocking):** `AgentAdminModule.jsx` exhaustive-deps; `roofEncounterModel.js` unused `_dropped` — surfaced by `npm run lint` during gate.
- **Unverified this run:** API contract suite and `ml:verify` — gaps could exist without failing smoke/gate.
- **Branch:** Work was on `feat/ml-search-and-price-monitor-schema`, not `main`; interpret “release readiness” conservatively until merged and CI on `main` is green.

---

## References

- Skill: `[.cursor/skills/bmc-holistic-project-health/SKILL.md](../../../.cursor/skills/bmc-holistic-project-health/SKILL.md)`
- Commands: root `[AGENTS.md](../../../AGENTS.md)`

