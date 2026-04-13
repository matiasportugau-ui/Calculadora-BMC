# 06 — Local extraction playbook (evidence bundle for audits)

## Executive Findings

Reproducible audits require a **fixed command bundle** that captures **repo state**, **toolchain versions**, **local gates**, and **targeted production probes** — without leaking secrets. This playbook standardizes extraction for future runs and for automation input (e.g. feeding `docs/audit/audit-summary.json`).

## Evidence Reviewed

Commands and scripts already present in repo: `package.json` scripts, `AGENTS.md` table, `scripts/smoke-prod-api.mjs`, `scripts/validate-api-contracts.js`, `npm run capabilities:snapshot`, `git` commands.

## Current State

No prior `docs/audit/` folder existed; this playbook is **new** as of audit **2026-04-13**.

## Gap Analysis

Missing prior standardization caused audits to rely on ad-hoc evidence (e.g. scattered runtime logs). This file closes that gap for **future** runs.

## Master Implementation Plan

Optional automation: add `npm run audit:bundle` wrapping the steps below (not implemented in this audit per instructions).

## Risks

- Accidental **secret exfiltration** if users paste `.env` into reports — **never** commit `.env`.
- **Prod smoke** hits live systems — rate-limit / coordinate with team.

## Next Actions

1. Run this playbook on a **clean** checkout before major releases.
2. Attach outputs to `docs/audit/archive/YYYY-MM-DD/` (create policy if desired).

---

## Playbook — commands (copy/paste friendly)

> Run from repo root: `/Users/matias/Panelin calc loca/Calculadora-BMC` (adjust path).

### A) Repo identity

```bash
git status -sb
git branch --show-current
git log -1 --oneline
node -v
npm -v
```

### B) Static inventory (no secrets)

```bash
ls -la .github/workflows
ls -la .cursor/rules
wc -l tests/validation.js
```

### C) Local deterministic gates (may require disk/cpu time)

```bash
npm run lint
npm test
npm run build
```

> If `disk:precheck` blocks: follow repo disk recovery skill; do not mass-delete without approval.

### D) API contracts (requires local API)

Terminal 1:

```bash
npm run start:api
```

Terminal 2:

```bash
BMC_API_BASE=http://localhost:3001 node scripts/validate-api-contracts.js
npm run pre-deploy
```

> `pre-deploy` loads `.env` if present — **do not** publish console output if it echoes sensitive values.

### E) Production smoke (network; no secrets required for default script)

```bash
npm run smoke:prod -- --json
```

Optional strict base:

```bash
BMC_API_BASE=https://YOUR-CANONICAL-HOST.run.app npm run smoke:prod -- --json
```

### F) Capabilities snapshot regeneration (writes tracked JSON; use consciously)

```bash
npm run capabilities:snapshot
git diff -- docs/api/AGENT-CAPABILITIES.json
```

### G) OpenAPI / manifest cross-check (manual, quick)

```bash
rg "servers:" -n docs/openapi-calc.yaml | head
node -e "fetch(process.env.BMC_API_BASE+'/capabilities').then(r=>r.json()).then(j=>console.log(j.discovery||j)).catch(e=>console.error(e))" # set BMC_API_BASE
```

## Redaction rules

- Replace **tokens**, **API keys**, and **Bearer** values with `REDACTED`.
- Keep **URLs**, **HTTP status codes**, and **JSON shapes** intact.

---

## #ZonaDesconocida

- Whether future automation should upload bundles to **GCS** or **GitHub Actions artifacts** (org policy).
