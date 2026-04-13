# 04 — Gap analysis vs 2026 top practices

## Executive Findings

Compared to **2026 top-tier spec-driven / multi-agent** practice, this repo is **ahead on operational agent ergonomics** (skills, smoke, capabilities manifest) but **behind on machine-enforced contracts** and **single-source-of-truth generation**. The highest-priority gap is **environment and URL authority** (verified drift in smoke). The second tier is **CI architecture** (separating deterministic PR gates from prod-smoke flakiness). The third tier is **test architecture** (monolithic `validation.js`).

## Evidence Reviewed

Same corpus as `01-system-inventory.md` plus: `.github/workflows/ci.yml` job graph, `scripts/validate-api-contracts.js` permissive branches, `eslint.config.js` ignores, `tests/validation.js` import patterns (header region), `npm run smoke:prod -- --json` output.

## Current State

### Spec-driven development

| 2026 practice | Repo status |
|---------------|------------|
| Spec-first API design | **Partial** — OpenAPI exists for calc; dashboard largely doc-driven |
| Generated clients/servers from spec | **Missing** |
| Schema validation on boundaries | **Partial** — hand checks in `validate-api-contracts.js` |
| Versioned examples/fixtures | **Partial** — some scripts, not uniform |

### Contract testing

| Practice | Status |
|----------|--------|
| Consumer-driven contracts | **No** |
| Record/replay against Sheets | **No** |
| Strict HTTP + JSON shape fail | **Weakened** by `allow503`/`allow404` |

### CI/CD fail-fast

| Practice | Status |
|----------|--------|
| Lint + unit on every PR | **Yes** (`ci.yml`) |
| Contract on every PR without external deps | **No** |
| Prod smoke on every PR | **Yes** — but couples CI to **external** prod + AI + Sheets |

### Drift detection

| Practice | Status |
|----------|--------|
| Manifest vs routes | **Manual** sync comment |
| OpenAPI vs runtime | **No automated diff in CI** |
| Capabilities snapshot | **Script exists** (`capabilities:snapshot`) — not observed as required PR gate in `ci.yml` |

### Multi-agent orchestration

| Practice | Status |
|----------|--------|
| Cursor skills/rules | **Strong** |
| Executable pipelines with schema’d outputs | **Emerging** (`channels-automated`, compass scripts) |
| Human gates documented | **Yes** (`HUMAN-GATES-ONE-BY-ONE.md`, rules) |

### Worktrees / parallelization

| Practice | Status |
|----------|--------|
| Documented worktree policy | **Not found in this audit pass** |
| CODEOWNERS | **Not verified** |

### Automated review

| Practice | Status |
|----------|--------|
| ESLint | **Yes**, limited to `src/` |
| CodeQL / supply chain scanning | **Not evidenced** in workflows read |

### Canon vs operational artifact

| Practice | Status |
|----------|--------|
| `docs/team/PROJECT-STATE.md` as human canon | **Yes** per AGENTS |
| `docs/api/AGENT-CAPABILITIES.json` | **Generated artifact** — good pattern |
| Risk: multiple “canonical URLs” | **Observed** |

## Gap Analysis (prioritized)

1. **P0 — Host / `PUBLIC_BASE_URL` / smoke default alignment** (production-verified inconsistency).
2. **P1 — CI layering:** deterministic PR gates vs prod smoke (reduce false negatives/positives).
3. **P1 — Contract strictness:** remove “404 is OK” from default profile for release branches.
4. **P2 — Route registry SSOT:** manifest + OpenAPI + Express mount from one list.
5. **P2 — Test decomposition:** shrink coupling surface of `tests/validation.js`.
6. **P3 — Type layer:** adopt TypeScript or zod at boundaries for `/calc/*` first.
7. **P3 — Node alignment:** CI 20 vs local 24 policy.

## Master Implementation Plan

Detailed sequencing: **`docs/audit/05-master-implementation-plan.md`**.

## Risks

- Tightening contracts without fixtures may **block legitimate Sheets outages** — mitigate with **profiles** (`strict` vs `integration`).
- Changing smoke defaults may **break CI** until Cloud Run env corrected — treat as **intentional** to expose drift.

## Next Actions

1. Open a **short-lived hardening branch** for URL/smoke alignment (P0).
2. Draft **CI profile matrix** document before editing workflows.
3. Schedule **`tests/validation.js` split** after P0–P1 stabilize (avoid parallel risky refactors).

---

### Finding: CI couples PR success to production AI + Sheets

- **Severity:** Yellow
- **Evidence:** `.github/workflows/ci.yml` — `channels_pipeline` runs after `validate`+`lint`; `scripts/channels-automated-pipeline.mjs` docstring states smoke includes MATRIZ CSV and suggest-response.
- **Impact:** PRs may fail for reasons unrelated to code changes; conversely, prod could be unhealthy while unit tests pass — but different job.
- **Recommendation:** Keep prod smoke, but add **non-prod contract tier** on PR that is deterministic; gate releases with smoke.
- **Verification:** CI dashboard shows two classes of failures with clear labels.

---

## #ZonaDesconocida

- Whether org uses **GitHub Rulesets** requiring specific checks (not visible from repo files alone).
