# 05 — Master implementation plan (spec-driven / multi-agent 2026)

## Executive Findings

Evolution to **top-tier 2026 spec-driven multi-agent** operations should proceed in **short, verifiable phases**: first **eliminate host authority drift** (already proven in prod smoke), then **split CI into deterministic vs prod integration**, then **introduce a route/registry SSOT**, and only then expand **schema/type enforcement** and **generated OpenAPI**. Parallel work should use a **git worktree** or **`contracts/ci` branch** to avoid coupling risky infra changes with product features.

## Evidence Reviewed

Cross-reference: `docs/audit/01-system-inventory.md`, `02-production-local-state.md`, `03-spec-driven-assessment.md`, `04-gap-analysis-2026.md`, `docs/audit/audit-summary.json`, and smoke JSON from audit session.

## Current State

- Maturity: **Level 2 (spec-anchored)** per `03-spec-driven-assessment.md`.
- Production: **subset verified** via smoke; **URL inconsistency verified**.
- CI: **lint + tests + build** on PR; **prod smoke** in separate job.

## Gap Analysis

See `04-gap-analysis-2026.md`. Highest ROI gaps: **URL SSOT**, **CI layering**, **contract strictness**, **route registry**.

## Master Implementation Plan

### Phase 0 — Canonical hosts & smoke truth (P0)

- **Objective:** One authoritative production API hostname reflected in `PUBLIC_BASE_URL`, smoke default, OpenAPI `servers`, and GPT Actions.
- **Deliverables (verifiable):**
  - Smoke JSON: `public_base_url` check **ok: true** without `--base`.
  - `docs/openapi-calc.yaml` `servers[0].url` matches canonical host.
  - Short doc: `docs/audit/host-authority.md` (optional but recommended).
- **Concrete changes:**
  - Update `scripts/smoke-prod-api.mjs` `DEFAULT_BASE` OR fix Cloud Run env `PUBLIC_BASE_URL` (decision belongs to infra owner — document decision).
  - Search/replace stale hostname references under `docs/` and scripts with caution + review.
- **Dependencies:** Cloud Run console access; possibly OAuth app redirect URI updates in Mercado Libre dev portal.
- **Acceptance criteria:**
  - `npm run smoke:prod` passes with aligned `public_base_url`.
  - `/capabilities` JSON `discovery` URLs use same origin as smoke base.
- **Risks:** OAuth redirect misconfiguration if URLs changed incorrectly.
- **Quick win:** **Fail smoke** on `public_base_url` mismatch: today `scripts/smoke-prod-api.mjs` records the check as `ok: false` but **explicitly avoids** `criticalFail` (commented line); enable failure via flag or uncomment after URL alignment.

### Phase 1 — CI layering: deterministic vs prod integration (P1)

- **Objective:** Every PR gets **fast, deterministic** signal; release/main gets **prod integration**.
- **Deliverables:**
  - `.github/workflows/ci.yml` updated with `contract:local` job OR `npm run test:contracts` against ephemeral server with **fixtures** / **mock Sheets** mode (if feasible).
  - Clear naming: `validate` vs `prod_smoke`.
- **Concrete changes:**
  - Introduce `npm run test:contracts:ci` wrapper that starts server with **test env** and hits only non-Sheets routes OR uses recorded fixtures.
  - Keep `channels_pipeline` on `main` / nightly / manual as appropriate (team policy).
- **Dependencies:** Engineering time to craft minimal env; possibly feature flags in server boot.
- **Acceptance criteria:**
  - PR job does not call live `suggest-response` unless labeled `integration`.
- **Risks:** Over-mocking hides real integration bugs — mitigate with **scheduled** full smoke.

### Phase 2 — Contract profiles: strict vs degraded (P1)

- **Objective:** Stop “green” passes on **404** for existing routes in strict mode.
- **Deliverables:** `CONTRACT_PROFILE=strict|dev` implemented in `scripts/validate-api-contracts.js`.
- **Concrete changes:** Gate `allow404` behind profile; default `dev` locally, `strict` in CI release workflow.
- **Acceptance criteria:** Intentional removal of route fails strict profile.
- **Risks:** Temporary flakiness until server boot process standardized.

### Phase 3 — Route registry SSOT (P2)

- **Objective:** `DASHBOARD_ROUTES`, OpenAPI paths (where applicable), and Express router mounting share one registry.
- **Deliverables:** `server/routeRegistry.js` (name indicative) consumed by `bmcDashboard.js` + `agentCapabilitiesManifest.js`.
- **Acceptance criteria:** Adding route updates manifest automatically.
- **Risks:** Refactor touches large file `server/routes/bmcDashboard.js` — use worktree + focused PR.

### Phase 4 — Schema-first for `/calc/*` (P3)

- **Objective:** Move toward Level 4 for calculator boundary.
- **Options (pick one in planning session):**
  - **Zod** parse/validate request+response in `server/routes/calc.js` + export types to JSDoc; or
  - **TypeScript** migration for `server/routes/calc.js` only.
- **Deliverables:** `npm run calc:schemas:check` (name indicative) in CI.
- **Acceptance criteria:** Invalid payload fails with stable 400 JSON shape.

### Phase 5 — Multi-agent artifact schema (P3)

- **Objective:** Machine-validate outputs of `channels:automated`, `project:compass`, etc.
- **Deliverables:** JSON Schema + `ajv` validation script; store exemplars in `docs/team/schemas/examples/`.
- **Acceptance criteria:** Invalid pipeline JSON fails with actionable error.

## Risks

- **Process risk:** Too many CI gates → developer friction — mitigate with profiles + fast path.
- **Tech risk:** Big-bang TS migration — avoid; prefer **boundary-first**.

## Next Actions

1. **Decision log:** record canonical hostname + rationale in `docs/team/PROJECT-STATE.md` “Cambios recientes” when fixed (team protocol).
2. **Branching recommendation:** execute Phase 0–2 in **`chore/contracts-ci-hardening`** or **git worktree** to keep `main` releasable.
3. **Measure:** track **smoke flake rate** and **mean time to diagnose** URL issues (simple counter in CI logs).

---

## #ZonaDesconocida

- Org-level GitHub settings for **required checks** and **branch protection** patterns.
