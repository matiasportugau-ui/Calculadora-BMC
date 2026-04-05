# Agent Manual — Full Specification (Calculadora-BMC workspace)

**Repository:** Calculadora-BMC / Panelin (Node API + Vite/React + operational docs).  
**Audience:** Staff+ engineers reviewing *how* AI-assisted work is structured—not a runtime product spec for end users.  
**Companion:** [`DEVELOPMENT-TEAM-TECHNICAL-EXPORT.md`](./DEVELOPMENT-TEAM-TECHNICAL-EXPORT.md) (process architecture, §2 roster, propagation).  
**Canonical team roster:** [`PROJECT-TEAM-FULL-COVERAGE.md`](./PROJECT-TEAM-FULL-COVERAGE.md) §2 (N = row count; never hardcode a fixed “headcount”).  
**Snapshot date:** 2026-04-05.

**Terminal “Matrix” briefing (monospace, box-drawing, for `cat` / demos):** [`AGENT-PRESENTATION-MATRIX.txt`](./AGENT-PRESENTATION-MATRIX.txt)

---

## 1. Executive summary

This workspace defines **three coupled layers**:

| Layer | Purpose | Location |
|-------|---------|----------|
| **A. Canonical roles** | Who must be considered in a “full team” run; business responsibilities | `docs/team/PROJECT-TEAM-FULL-COVERAGE.md` §2 |
| **B. Cursor agent definitions** | Delegation profiles (when to invoke, boundaries, primary sources) | `.cursor/agents/*.md` |
| **C. Skills** | Repeatable procedures, scripts, checklists | `.cursor/skills/<id>/SKILL.md` |

**Critical invariant:** Layer A is the **source of truth for membership**. Layer B may include specialists **not** listed in §2 (on-demand). Layer C backs both; many §2 roles map 1:1 to a skill folder name.

**Global engineering contract:** [`AGENTS.md`](../../AGENTS.md) at repo root (ES modules, no hardcoded sheet IDs, Sheets error semantics `503` vs empty `200`, lint/test gates, npm command table).

---

## 2. How agents are invoked in practice

1. **Explicit instruction** — User or lead model says “use the X agent” or pastes context from `.cursor/agents/<name>.md`.
2. **Cursor Task / subagent** — Where enabled, `subagent_type` routes to the same conceptual profile (see §6).
3. **Rules + skills** — `.cursor/rules/*.mdc` trigger guidance; hooks may inject `SKILL.md` by file/bash pattern (see Vercel/Cursor plugin docs if applicable).
4. **Orchestrator playbook** — `bmc-dashboard-team-orchestrator` defines ordered steps 0–9 and which **skills** to call per step.

**No central registry executable at runtime:** compliance is **documentation + convention**.

---

## 3. Complete catalog — `.cursor/agents/*.md`

All agent definition files under `.cursor/agents/` (excluding non-markdown assets). For each: **machine id** (`name` in front matter where valid), **human intent** (`description`), **primary artifacts**, **paired skill(s)** if obvious.

| `name` (id) | File | Trigger / intent (from spec) | Typical outputs / paths |
|-------------|------|------------------------------|-------------------------|
| `bmc-capabilities-reviewer` | `bmc-capabilities-reviewer.md` | Audit what the BMC stack can do today; recommend exploitation (no code edits by default) | Recommendations; may reference `GET …/api/server-export`, `DASHBOARD-VISUAL-MAP`, `IA.md` |
| `bmc-dashboard-audit-full` | `bmc-dashboard-audit-full.md` | Run **Audit Runner → Debug Reviewer** sequentially | `.cursor/bmc-audit/latest-report.md`, `DEBUG-REPORT.md`, `debug-export/*` |
| `bmc-dashboard-audit-runner` | `bmc-dashboard-audit-runner.md` | Deep audit: stack, `run_audit.sh`, endpoint probes | `.cursor/bmc-audit/latest-report.md`, `handoff.json` |
| `bmc-dashboard-automation` | `bmc-dashboard-automation.md` | Apps Script Phases 1–2, triggers, `Code.gs`, `sheets-api-server.js`, IMPLEMENTATION | Edits under `docs/bmc-dashboard-modernization/` |
| `bmc-dashboard-debug-reviewer` | `bmc-dashboard-debug-reviewer.md` | Post-audit: parse issues, logs, structured export | `DEBUG-REPORT.md`, `debug-export/issues.md` |
| `bmc-dashboard-ia-reviewer` | `bmc-dashboard-ia-reviewer.md` | IA/flow review of dashboard modules (no implementation) | Structured review memo |
| `bmc-dashboard-netuy-hosting` | `bmc-dashboard-netuy-hosting.md` | Deploy dashboard to Netuy VPS: PM2/systemd, nginx, TLS | Runbooks; skill `bmc-dashboard-netuy-hosting` |
| `bmc-dashboard-setup` | `bmc-dashboard-setup.md` | Onboarding: real data, `.env`, SA, `npm run bmc-dashboard`, Apps Script P1–2 | Checklists; minimal `.env` / script fixes |
| `bmc-dashboard-team-orchestrator` | `bmc-dashboard-team-orchestrator.md` | Full team run: order, §2 inclusion, Run Scope Gate, handoffs | `PROJECT-STATE` updates; MATPROMT bundle path; step 9 loop |
| `bmc-docs-and-repos-organizer` | `bmc-docs-and-repos-organizer.md` | `docs/` hygiene, READMEs, indices; handoff to Repo Sync | Hub links; gap list; **does not** invent API/Sheets truth |
| `bmc-repo-sync-agent` | `bmc-repo-sync-agent.md` | Mirror artifacts to `bmc-dashboard-2.0` + `bmc-development-team` | Sync report; uses skill `bmc-repo-sync-agent` |
| `bmc-roof-2d-viewer-specialist` | `bmc-roof-2d-viewer-specialist.md` | SVG roof/structure viewer: `RoofPreview`, cotas, fijación, BOM hover | `src/components/RoofPreview.jsx`, `roofPlan/*`, `calculations.js` parity |
| `bmc-telegram-architecture-scout` | `bmc-telegram-architecture-scout.md` | Per-run Telegram discovery + decision memo | `docs/team/telegram/TELEGRAM-RUN-*.md`, `WATCHLIST.md` |
| `cloudrun-diagnostics-agent` | `cloudrun-diagnostics-agent.md` | Cloud Run `panelin-calc` diagnostics (REST, scripts, Console) | Diagnostic report; skill `cloudrun-diagnostics-reporter` |
| `live-jsx-dev` | `live-jsx-dev.md` | Live Vite+HMR for standalone JSX from arbitrary path | Local preview workflow; **must not** rewrite `main.jsx`/`App.jsx` per spec |
| `mac-performance-agent` | `mac-performance-agent.md` | macOS performance triage; safe-first | Skill `mac-performance-optimizer`; may hand off to disk skills |
| `matprompt-agent` | `matprompt-agent.md` | MATPROMT: per-role prompt bundles + DELTA mid-run | `docs/team/MATPROMT-FULL-RUN-PROMPTS.md` or `matprompt/MATPROMT-RUN-*.md` |
| `shopify-integration-v4` | `shopify-integration-v4.md` | Shopify replacement for ML flow: OAuth PKCE, webhooks, Sheets, Cloud Run | Architecture + implementation across `server/`, Sheets, admin UX |
| `sim-reviewer-agent` | `sim-reviewer-agent.md` | SIM-REV: post-SIM audit vs backlog | `docs/team/panelsim/reports/SIM-REV-REVIEW-*.md` |

**Note:** `bmc-dashboard-team-orchestrator.md` front matter in repo may show YAML quirks; the **H1 body** and §2 references remain authoritative for behavior.

---

## 4. Per-agent specification sheets (condensed)

The following expands **objectives, hard constraints, and source-of-truth files** for each agent. For full prose, open the linked file.

### 4.1 `bmc-capabilities-reviewer`

- **Objective:** Inventory endpoints, UI, scripts, hosting; propose prioritized leverage (workflows, automation).
- **Constraint:** Default stance is **review-only** (no implementation unless user expands scope).
- **Sources:** Live export if available, `DASHBOARD-VISUAL-MAP`, `IA.md`, `NGROK-USAGE.md`.

### 4.2 `bmc-dashboard-audit-runner` / `bmc-dashboard-debug-reviewer` / `bmc-dashboard-audit-full`

- **Objective:** Deterministic deep audit → structured debug export.
- **Prerequisite:** API healthy on `:3001` (or stack per script).
- **Pipeline:** `run_audit.sh` → parse → `DEBUG-REPORT.md` + severity buckets.
- **One-shot:** `.cursor/skills/bmc-dashboard-audit-runner/scripts/run_audit_then_debug.sh`.

### 4.3 `bmc-dashboard-automation`

- **Objective:** Maintain Apps Script + Phase 3 `sheets-api-server.js` alignment with `IMPLEMENTATION.md`.
- **Sensitive:** Workbook ID and formulas documented in agent body—verify against current org policy before sharing externally.

### 4.4 `bmc-dashboard-ia-reviewer`

- **Objective:** IA/navigation recommendations for main business frontend; assess Invoque Panelin placement.
- **Constraint:** **No file edits** in review mode; mark uncertainty explicitly.

### 4.5 `bmc-dashboard-netuy-hosting` / `bmc-dashboard-setup`

- **Objectives:** Production-like dashboard hosting (VPS) vs local/real-data onboarding (`.env`, SA, triggers).
- **Skills:** `bmc-dashboard-netuy-hosting`, `bmc-dashboard-one-click-setup` (related).

### 4.6 `bmc-dashboard-team-orchestrator`

- **Objective:** Run **all** §2 roles in a full team run with **Run Scope Gate** (Deep/Light/N/A—not “skip silently”).
- **Key docs:** `FULL-TEAM-RUN-DEFINITION.md`, `RUN-SCOPE-GATE.md`, `PROJECT-STATE.md`, `PROMPT-FOR-EQUIPO-COMPLETO.md`, `IMPROVEMENT-BACKLOG-BY-AGENT.md`.
- **Outputs:** Step 8 state update; step 9 improvement loop.

### 4.7 `bmc-docs-and-repos-organizer`

- **Objective:** Discoverability under `docs/`; fix broken links; README/index hygiene.
- **Anti-scope:** Does not replace Mapping, Contract, or Sheets Structure; does not silently edit `PROJECT-STATE` without user intent.

### 4.8 `bmc-repo-sync-agent`

- **Objective:** After runs, sync dashboard repo + team artifacts repo (`BMC_DASHBOARD_2_REPO`, `BMC_DEVELOPMENT_TEAM_REPO` when defined).

### 4.9 `bmc-roof-2d-viewer-specialist`

- **Objective:** Honest **presentation** of geometry + BOM hints in SVG (meters); align with `computeRoofEstructuraHintsByGi`.
- **Hard limits:** Not normative CAD; Uruguay/LATAM naming ok; must not invent code compliance.
- **Regression surface:** `tests/validation.js`, `server/routes/calc.js` copy for formulas.

### 4.10 `bmc-telegram-architecture-scout`

- **Objective:** Discovery + allowed scanning + implementation decision memo; uses `WATCHLIST.md`.

### 4.11 `cloudrun-diagnostics-agent`

- **Objective:** Full `panelin-calc` state; prefer REST/script over brittle CLI patterns documented in skill.

### 4.12 `live-jsx-dev`

- **Objective:** Fast HMR for ad-hoc JSX paths; **never** break main app wiring (`PanelinCalculadoraV3` entry).

### 4.13 `mac-performance-agent`

- **Objective:** Ordered, safe macOS triage; combine with disk recovery skills when ENOSPC.

### 4.14 `matprompt-agent`

- **Objective:** Actionable per-role bundles + DELTA; align with Parallel/Serial and Orchestrator.

### 4.15 `shopify-integration-v4`

- **Objective:** End-to-end Shopify Q&A/quotes with Sheets + LLM/rules + scheduler (UTC-3); security (HMAC, PKCE).

### 4.16 `sim-reviewer-agent`

- **Objective:** SIM-REV report contrasting SIM work vs backlog; **not** a substitute for Judge.

---

## 5. Skills registry (`.cursor/skills/`)

**Count:** 51 skill packages (folder = skill id). Each should expose `SKILL.md` as entrypoint.

### 5.1 By domain (taxonomy)

| Domain | Skill ids |
|--------|-----------|
| **Team / process** | `ai-interactive-team`, `bmc-project-team-sync`, `bmc-parallel-serial-agent`, `matprompt`, `bmc-team-judge`, `bmc-implementation-plan-reporter`, `bmc-docs-and-repos-organizer`, `bmc-repo-sync-agent` |
| **Sheets / mapping** | `google-sheets-mapping-agent`, `bmc-planilla-dashboard-mapper`, `bmc-sheets-structure-editor`, `actualizar-precios-calculadora` |
| **Dashboard** | `bmc-dashboard-design-best-practices`, `bmc-dashboard-one-click-setup`, `bmc-dashboard-audit-runner`, `bmc-dashboard-debug-reviewer`, `super-agente-bmc-dashboard`, `bmc-dashboard-netuy-hosting` |
| **Calculator / product** | `bmc-calculadora-specialist`, `bmc-calculadora-deploy-from-cursor`, `panelin-calculadora-knowledge-planner` |
| **API / contract / GPT** | `bmc-api-contract-validator`, `panelin-gpt-cloud-system`, `panelin-gpt-artifacts-regenerator`, `panelin-drift-risk-closure`, `openai-gpt-builder-integration`, `implement-gpt-operativo-plan`, `panelin-repo-solution-miner` |
| **Integrations** | `bmc-mercadolibre-api`, `shopify-integration-v4`, `browser-agent-orchestration`, `panelsim-email-inbox` |
| **Infra / diagnostics** | `networks-development-agent`, `cloudrun-diagnostics-reporter`, `bmc-dependencies-service-mapper` |
| **Security / fiscal / billing** | `bmc-security-reviewer`, `bmc-dgi-impositivo`, `billing-error-review` |
| **UX / feedback / media** | `navigation-user-feedback`, `live-devtools-narrative-mcp`, `live-devtools-transcript-action-plan`, `user-session-video-to-backlog`, `local-browser-live-preview`, `voice-say-last-answer` |
| **Platform / editor** | `panelin-live-editor`, `expert-debug-autonomous`, `intent-solution-product-reviewer` |
| **macOS / disk** | `mac-performance-optimizer`, `drive-space-optimizer`, `disk-space-recovery-resume` |
| **Telegram** | `bmc-telegram-architecture-scout` |

### 5.2 Skill ↔ §2 role mapping (high level)

Not every skill is a §2 row; transversal skills are listed in `PROJECT-TEAM-FULL-COVERAGE.md` §2.2. For the full role↔skill table, see the **Orchestrator** agent file or §2 in `PROJECT-TEAM-FULL-COVERAGE.md`.

---

## 6. Cursor Task `subagent_type` registry (BMC-related)

When the Cursor **Task** tool is enabled, additional **named subagents** may be available (IDs vary by workspace configuration). Typical BMC-aligned types include:

`bmc-orchestrator`, `bmc-calc-specialist`, `bmc-deployment`, `bmc-docs-sync`, `bmc-fiscal`, `bmc-judge`, `bmc-panelin-chat`, `bmc-security`, `bmc-sheets-mapping`, `bmc-roof-2d-viewer-specialist`, `bmc-api-contract`, `cloudrun-diagnostics-agent`, `live-jsx-dev`, `mac-performance-agent`, `matprompt-agent`, `shopify-integration-v4`, `sim-reviewer-agent`, `uruguay-tax-investigator`, `atlas-agent`, …

**Rule:** Task aliases **do not replace** §2; they are **routing helpers**. If a type is missing in your Cursor build, fall back to explicit `.cursor/agents/*.md` + skill read.

---

## 7. Operational dependencies (engineering)

| Dependency | Detail |
|------------|--------|
| **Node / npm** | Scripts in `package.json`; `type: module` |
| **Ports** | API **3001**, Vite **5173**, optional dashboard **3849** (per docs) |
| **Env** | `.env` from `.env.example`; never commit secrets |
| **Quality gates** | `npm run lint` (after `src/` edits), `npm test`, `npm run gate:local:full` before commit |
| **API contracts** | `npm run test:contracts` with API up |
| **Disk** | `predev` / `prebuild` run `disk:precheck`; overrides documented in `AGENTS.md` |

---

## 8. Evaluation layer (Judge)

- **Criteria per role:** [`judge/JUDGE-CRITERIA-POR-AGENTE.md`](./judge/JUDGE-CRITERIA-POR-AGENTE.md)
- **Outputs:** `judge/JUDGE-REPORT-RUN-*.md`, `judge/JUDGE-REPORT-HISTORICO.md`
- **Philosophy:** Continuous improvement; explicit N/A when a role did not participate.

---

## 9. Governance: adding or changing agents

Follow **`PROJECT-TEAM-FULL-COVERAGE.md` §2.3** whenever promoting a skill to a **numbered** team member:

1. Add §2 row (Rol, Skills, Área, Responsabilidad).  
2. Add Judge criteria section.  
3. Update Orchestrator steps if needed.  
4. Add `.cursor/agents/<name>.md` and/or `.cursor/skills/<id>/`.  
5. Update `IMPROVEMENT-BACKLOG-BY-AGENT.md`, `PROJECT-STATE.md`, sibling repos if synced.

**Skills-only (transversal):** §2.2 + document when they apply; no §2 row until promoted.

---

## 10. Quick navigation index

| Need | Read first |
|------|------------|
| Who is on the team? | `PROJECT-TEAM-FULL-COVERAGE.md` §2 |
| What did we last change? | `PROJECT-STATE.md` |
| How full runs work | `FULL-TEAM-RUN-DEFINITION.md`, Orchestrator agent |
| API + code rules | `AGENTS.md` |
| This manual vs process export | **This file** = per-agent specs + skill taxonomy; **DEVELOPMENT-TEAM-TECHNICAL-EXPORT** = process architecture |
| Matrix-style terminal deck | `AGENT-PRESENTATION-MATRIX.txt` (green: `printf '\033[32;1m'; cat …; printf '\033[0m'`). Regenerar bloque **Skills developed in full** desde frontmatter: `npm run team:agent-matrix-skills` |

---

*End of manual. Maintain this file when `.cursor/agents/` or §2 roster changes materially.*
