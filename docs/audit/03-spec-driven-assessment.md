# 03 — Spec-driven maturity assessment

## Executive Findings

The project exhibits **strong documentation and operational rituals** (AGENTS, skills, smoke, pre-deploy) and possesses **explicit spec artifacts** (OpenAPI YAML, capabilities manifest, contract validator). However, enforcement is **partially soft**: contract checks tolerate **404/503**, **CI does not run `validate-api-contracts` in the primary `validate` job**, and there is **no compile-time schema layer** (TypeScript / zod / OpenAPI-driven codegen). Maturity is assessed at **Level 2 — spec-anchored**, with **partial Level 3** behaviors limited to **production smoke** in the **`channels_pipeline`** job.

## Evidence Reviewed

- `docs/openapi-calc.yaml` — formal OpenAPI 3.1 document for calculator API.
- `docs/openapi-email-gpt.yaml` — scoped OpenAPI for email GPT.
- `server/agentCapabilitiesManifest.js` — `DASHBOARD_ROUTES` + manifest composition; comment says keep in sync with `bmcDashboard.js`.
- `scripts/validate-api-contracts.js` — imperative checks; `allow503`, `allow404` branches.
- `.github/workflows/ci.yml` — jobs: `validate` (tests+build), `lint`, `channels_pipeline` (runs `channels-automated`), `knowledge_antenna`.
- `scripts/channels-automated-pipeline.mjs` — wraps `smoke-prod-api.mjs --json`.
- `npm run smoke:prod -- --json` — evidence of live prod checks (audit session).
- `AGENTS.md` — explicit guidance: route changes → `start:api` + `test:contracts`.

## Current State

### Rubric mapping

| Level | Definition (audit interpretation) | Evidence in repo |
|-------|-----------------------------------|-------------------|
| 0 — ad hoc | No shared specs | **Does not apply** — OpenAPI + manifest exist |
| 1 — doc-driven | Narrative docs drive work | **Yes** — large `docs/team/*`, `AGENTS.md` |
| 2 — spec-anchored | Specs exist and guide integration | **Yes** — `docs/openapi-calc.yaml`, `/capabilities`, GPT actions |
| 3 — spec-validated | Automated validation on meaningful cadence | **Partial** — prod smoke in CI; local contract script exists but not in `validate` job |
| 4 — spec-enforced | CI fails on drift automatically | **Not met** — OpenAPI not diffed against runtime; soft passes |
| 5 — spec as SSOT | Generated handlers/clients from spec | **Not met** |

**Declared maturity:** **Level 2 (spec-anchored)** with **partial Level 3** for production-only checks.

### Strengths

- **Discoverability:** `/capabilities` is a pragmatic “agent contract” for tools and humans.
- **OpenAPI for GPT:** explicit YAML for external consumers.
- **Smoke tests** include **business-critical MATRIZ CSV** shape checks (`scripts/smoke-prod-api.mjs`).
- **Pre-deploy script** attempts health + `.env` presence + contract validation (`scripts/pre-deploy-check.sh`).

### Weaknesses

- **No single generated OpenAPI** from code; **manual duplication** risk between YAML, `gptActions.js`, and routers.
- **Contract validator** is **not** JSON Schema–backed; checks are **hand-written** if/keys.
- **404 as pass** for `/api/kpi-report` documents operational tolerance that **masks** “server not restarted” class bugs (`validate-api-contracts.js`).

## Gap Analysis

| Gap | Severity | Why it blocks higher maturity |
|-----|----------|-------------------------------|
| Contract tests not in default PR validate job | Yellow | PRs can merge with API drift until smoke pipeline |
| Soft pass on 503/404 | Yellow | Outages / skew look “green” |
| No TS/types | Yellow | No structural SSOT in language types |
| Multi-host drift | Red | Spec consumers see inconsistent `base_url` |

## Master Implementation Plan

See **`docs/audit/05-master-implementation-plan.md`** — Phases 1–3 address CI enforcement, OpenAPI authority, and registry SSOT.

## Risks

- **False confidence:** teams believe “contracts pass” while checks intentionally skip failures.
- **GPT drift:** Builder may point to stale host from OpenAPI `servers` while runtime uses another.

## Next Actions

1. Add **`openapi:diff`** or **`capabilities:diff`** CI step comparing snapshot to runtime (with pinned base).
2. Promote **`test:contracts`** into **`validate`** job using **mocked** or **recorded** fixtures to remove Sheets coupling where possible.
3. Document **explicit maturity target** (e.g. “aim Level 3 by Qx”) in `PROJECT-STATE.md` when team agrees.

---

### Finding: Capabilities route list is manually duplicated

- **Severity:** Yellow
- **Evidence:** `server/agentCapabilitiesManifest.js` comment: “Keep in sync with `server/routes/bmcDashboard.js`”.
- **Impact:** Dashboard discovery drifts from actual routes over time.
- **Recommendation:** Generate list from router metadata or integration test that fails if a new `/api/*` route is not registered.
- **Verification:** Adding a dummy route in `bmcDashboard.js` fails CI until manifest updated.

### Finding: Contract validator allows 404 for kpi-report

- **Severity:** Yellow
- **Evidence:** `scripts/validate-api-contracts.js` — `allow404: true` with comment “route exists; 404 = server not restarted after deploy”.
- **Impact:** CI/local checks can hide deployment/version skew.
- **Recommendation:** Split into **strict** vs **degraded** profiles; default strict in release branches.
- **Verification:** `CONTRACT_MODE=strict` fails on 404.

---

## #ZonaDesconocida

- Whether **GPT Builder** currently points to the same host as `docs/openapi-calc.yaml` `servers[0].url` (requires OpenAI Builder UI inspection).
