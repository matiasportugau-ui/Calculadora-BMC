# Prompt: AI Agent Team — Full Improvement Plan (BMC Dashboard)

Use this prompt to brief an AI agent team that will (1) expand context on each module’s “universe,” then (2) investigate, discuss, and (3) present a full step-by-step improvement plan for the BMC Dashboard.

---

## Objective

An AI agent team must:

1. **Expand context** on the “universe” of each dashboard module (scope, data, tech, users, and pain points).
2. **Investigate** current state, gaps, and dependencies across modules.
3. **Discuss** tradeoffs, conflicts, and priorities as a team.
4. **Deliver** a single, step-by-step full improvement plan with clear ownership and order.

**Inputs:**  
- `docs/bmc-dashboard-modernization/BMC-DASHBOARD-IA-REVIEW-REPORT.md`  
- `docs/bmc-dashboard-modernization/DASHBOARD-VISUAL-MAP.md` (and .html)  
- `docs/bmc-dashboard-modernization/DASHBOARD-EVALUATION-REPORT.md`  
- Repo code and docs for each module (routes, components, sheets, env).

**Output:**  
- Phase 1: One **context brief** per module (“universe” doc).  
- Phase 2: **Investigation notes** and **discussion summary** (findings, conflicts, priorities).  
- Phase 3: **Full improvement plan** — ordered steps, owners, dependencies, and success criteria.

---

## Team composition (by universe)

Assign one “universe” per agent (or one agent per universe in sequence). Each agent is responsible for that module’s context expansion and, later, for contributing to the improvement plan from that perspective.

| Agent / Role | Universe (module) | Focus |
|--------------|-------------------|--------|
| **Agent Cotizaciones** | Cotizaciones | Calculadora (Vite 5173), quote builder, list/admin, Master_Cotizaciones, CRM_Operativo, /api/cotizaciones, Google Drive, PanelinCalculadoraV3, legacyQuote, calcRouter. |
| **Agent Operaciones** | Operaciones | Próximas entregas, coordinación logística, audit log, marcar-entregado, Sheets flows (Master, CRM), /api/proximas-entregas, /api/coordinacion-logistica, /api/audit, /api/marcar-entregado. |
| **Agent Finanzas** | Finanzas | KPIs financieros, pagos pendientes, metas de ventas, /api/kpi-financiero, /api/pagos-pendientes, /api/metas-ventas, Sheets Pagos_Pendientes, Metas_Ventas, Finanzas UI at 3001/finanzas. |
| **Agent Ventas** | Ventas | Ventas 2.0 (planned), pipeline, “Ventas realizadas y entregadas” sheet, any ML/Shopify or sales-channel integration referenced in repo. |
| **Agent Invoque Panelin** | Invoque Panelin | GPT/OpenAI-powered agent module: placement (standalone + transversal), actions, instructions, integration points with other modules. |
| **Agent Shell & Infra** | Shell / Entry / Infra | Single entry URL, nav, ports (5173, 3001, 3849), ngrok, favicon, root route, dashboard shell, SPA vs multi-app. |

**Optional:** A **Facilitator** agent that only reads Phase 1 briefs, runs Phase 2 discussion, and synthesizes Phase 3. If you have a single agent, it should play all roles in sequence (expand each universe, then investigate, then discuss, then write the plan).

**Extended responsibilities:** The agent is also in charge of (1) **connecting all dependencies** and (2) **mapping all services** so they work perfectly; (3) **reporting** and (4) **generating implementation plans** for the Solution team and Coding team workflow. Use skills: `.cursor/skills/bmc-dependencies-service-mapper/` (dependencies + service map) and `.cursor/skills/bmc-implementation-plan-reporter/` (reports + implementation plan for Solution/Coding teams).

---

## Phase 1 — Expand context on each module’s universe

**Rule:** Before any improvement plan, every agent must produce a **context brief** for its universe. No skipping this step.

For each **Universe (module)** above, the responsible agent must:

1. **Read** the IA report, visual map, evaluation report, and the repo artifacts that belong to that module (routes, components, env vars, sheet names).
2. **Produce** a short **Universe brief** (one document per module) that includes:
   - **Scope:** What this module is supposed to do (from docs and code).
   - **Data:** Which Sheets, APIs, env vars, and data flows it uses.
   - **Tech:** Entry points (URLs, ports), stack (React, static HTML, Express routes), key files.
   - **Users / personas:** Who uses it and for what (if inferable; otherwise “to be defined”).
   - **Current pain points:** Bugs, missing data, unclear flows, naming confusion, or gaps mentioned in the IA report or evaluation.
   - **Dependencies:** What this module needs from other modules or from Shell/Infra (e.g. “Cotizaciones needs a link from Shell to open Calculadora”).
   - **Uncertainties:** What is still unknown or not in the repo (mark explicitly).

**Output:**  
- `docs/bmc-dashboard-modernization/context-briefs/` (or equivalent):  
  - `01-universe-cotizaciones.md`  
  - `02-universe-operaciones.md`  
  - `03-universe-finanzas.md`  
  - `04-universe-ventas.md`  
  - `05-universe-invoque-panelin.md`  
  - `06-universe-shell-infra.md`  

**Handoff:** After Phase 1, every agent (or the single agent) has a clear picture of each “universe.” Phase 2 uses these briefs as the shared context.

---

## Phase 2 — Investigate, discuss, align

**Input:** All Phase 1 universe briefs + IA report + visual map + evaluation report.

**Tasks:**

1. **Investigate**
   - Cross-read all universe briefs.
   - List **gaps** (missing flows, duplicate concepts, naming collisions) between modules.
   - List **dependencies** (e.g. Shell must expose nav; Operaciones and Finanzas share Sheets; Invoque Panelin needs hooks in Cotizaciones/Operaciones/Finanzas).
   - List **conflicts** (e.g. two entry points for “dashboard,” KPI vs Finanzas scope, Cotizaciones = data vs section).
   - Map each **prioritized improvement** from the IA report (§7) to the right universe(s) and to implementation order.

2. **Discuss**
   - For each conflict: propose a resolution (e.g. “Dashboard” = whole product; “Finanzas” = section; KPI = sub-area of Finanzas).
   - For each dependency: agree on which module “owns” the contract (e.g. Shell owns nav; bmcDashboard owns Sheets API).
   - For Invoque Panelin: confirm hybrid (standalone section + transversal) and which modules get the first transversal entry points.
   - Order improvements by: (a) unblocking other work, (b) user impact, (c) implementation complexity.

3. **Produce**
   - **Investigation summary:** Gaps, dependencies, conflicts (with references to universe briefs).
   - **Discussion summary:** Resolutions, ownership, and agreed priorities (short bullets or table).

**Output:**  
- `docs/bmc-dashboard-modernization/02-investigation-and-discussion.md` (or split into `02a-investigation.md` and `02b-discussion-summary.md`).

**Handoff:** Phase 3 consumes the investigation + discussion to write the step-by-step plan.

---

## Phase 3 — Full improvement plan (step by step)

**Input:** Phase 1 briefs + Phase 2 investigation and discussion + IA report.

**Task:** Write one **full improvement plan** document that:

1. **States goals**
   - BMC Dashboard as the single main business frontend.
   - Clear IA and navigation (Inicio | Cotizaciones | Operaciones | Finanzas | Ventas | Invoque Panelin).
   - One primary entry URL; no naming overload; Invoque Panelin hybrid.

2. **Lists steps in order**
   - Each step: **ID**, **Title**, **Owner (universe)**, **Description**, **Dependencies** (other step IDs), **Acceptance criteria**, **Impact (H/M/L)**, **Complexity (H/M/L)**.
   - Order steps so that dependencies are respected (e.g. “Define IA” before “Implement nav”; “Favicon and root route” early).

3. **Groups steps into waves** (optional but useful)
   - **Wave 1 — Foundation:** IA doc, naming resolution, single entry, favicon/root fix.
   - **Wave 2 — Shell & nav:** Shell app or SPA with nav, routes to each module.
   - **Wave 3 — Module alignment:** Per-module fixes (e.g. Cotizaciones vs Operaciones links, Finanzas/KPI scope).
   - **Wave 4 — Invoque Panelin:** Standalone section + transversal entry points.
   - **Wave 5 — Polish & ops:** Observability, error UX, ngrok/logging.

4. **Adds a short “How to use this plan”**
   - E.g. “Execute steps in order; complete a wave before starting the next unless a step explicitly allows parallel work.”

**Output:**  
- `docs/bmc-dashboard-modernization/FULL-IMPROVEMENT-PLAN.md`

**Format (example step):**

```markdown
## Step 1.1 — Define and document BMC Dashboard IA
- **Owner:** Shell & Infra (with input from all modules)
- **Description:** Add a single source of truth for sections and hierarchy (e.g. IA.md or extend DASHBOARD-VISUAL-MAP). Include: Inicio, Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin; KPI under Finanzas.
- **Depends on:** —
- **Acceptance:** IA doc in repo; agreed section names and hierarchy.
- **Impact:** H | **Complexity:** M
```

---

## Execution instructions (for the human or orchestrator)

1. **Run Phase 1**  
   For each universe (Cotizaciones, Operaciones, Finanzas, Ventas, Invoque Panelin, Shell & Infra), run the agent responsible for that universe with this prompt:

   > You are [Agent X]. Your universe is [module]. Follow Phase 1 of the prompt in `docs/bmc-dashboard-modernization/PROMPT-AGENT-TEAM-FULL-IMPROVEMENT-PLAN.md`. Using the IA report, visual map, evaluation report, and repo code/docs for your module, produce the Universe brief for [module]. Save it as `docs/bmc-dashboard-modernization/context-briefs/0X-universe-[module].md`. Do not skip: scope, data, tech, users, pain points, dependencies, uncertainties.

2. **Run Phase 2**  
   Run the Facilitator (or the same agent with all briefs in context):

   > You are the Facilitator. Read all context briefs in `docs/bmc-dashboard-modernization/context-briefs/` and the IA report. Follow Phase 2 of PROMPT-AGENT-TEAM-FULL-IMPROVEMENT-PLAN.md. Produce the investigation summary and discussion summary. Save as `docs/bmc-dashboard-modernization/02-investigation-and-discussion.md`.

3. **Run Phase 3**  
   Run the Facilitator (or the same agent):

   > You are the Facilitator. Read all Phase 1 briefs and Phase 2 output. Follow Phase 3 of PROMPT-AGENT-TEAM-FULL-IMPROVEMENT-PLAN.md. Produce the full step-by-step improvement plan. Save as `docs/bmc-dashboard-modernization/FULL-IMPROVEMENT-PLAN.md`.

**Single-agent variant:**  
One agent runs all three phases in order: first write all six universe briefs (Phase 1), then write investigation + discussion (Phase 2), then write FULL-IMPROVEMENT-PLAN.md (Phase 3). Keep each phase’s output before starting the next.

---

## Constraints (reminder for all agents)

- **Do not implement** code or config in this exercise; only investigate, discuss, and document the plan.
- **Do not assume** facts that are not in the repo or the provided docs; mark uncertainties in briefs and plan.
- **Cite sources:** When a finding comes from the IA report, visual map, or a universe brief, say which doc/section.
- **One plan:** The final deliverable is one improvement plan; optional separate files for briefs and discussion are allowed, but the executable plan is a single, ordered list of steps.

---

## Extended agent responsibilities (dependencies, services, reporting, implementation plan)

The agent team is also in charge of:

1. **Connect all dependencies** — Document and align every module's dependencies (APIs, env, Sheets, other modules) so the system works end-to-end.
2. **Map all services** — Produce a clear map of all services (Express routes, Vite app, Sheets API, external integrations): contracts, entry points, health checks, so they work perfectly together.
3. **Report** — Generate reports for the Solution team and the Coding team: status, gaps, risks, handoff summaries.
4. **Implementation plan for Solution and Coding team workflow** — Turn the full improvement plan into actionable plans: task breakdown by team (Solution vs Coding), ownership, order, acceptance criteria, handoff points.

| Responsibility | Skill | Use when |
|----------------|--------|----------|
| Connect dependencies, map services | `.cursor/skills/bmc-dependencies-service-mapper/` | Dependency wiring, service inventory, map all services, validate integration points. |
| Report + implementation plan (Solution / Coding) | `.cursor/skills/bmc-implementation-plan-reporter/` | Generate reports, handoffs, implementation plan for Solution and Coding team workflow. |
| Map planillas + dashboard interface | `.cursor/skills/bmc-planilla-dashboard-mapper/` | Map both sheets/templates and dashboard UI; produce plan and proposal before implementation; understand where each element lives. |
| Dashboard design (best practices, time-saving UX) | `.cursor/skills/bmc-dashboard-design-best-practices/` | Research similar dashboards, review against BMC needs, implement aesthetic and functional design with time-saving as main task. |

Run these after Phase 2 or Phase 3; use context briefs and FULL-IMPROVEMENT-PLAN.md as input. For planilla + dashboard mapping, **always generate or use the plan and proposal** (`docs/bmc-dashboard-modernization/PLAN-PROPOSAL-PLANILLA-DASHBOARD-MAPPING.md`) before implementing the mapping.

**Orchestration:** To run this agent **as a Team** (all skills in order with handoffs), use the **BMC Dashboard Team Orchestrator**: `.cursor/agents/bmc-dashboard-team-orchestrator.md`. See `docs/bmc-dashboard-modernization/TEAM-ORCHESTRATION.md` for full run, partial run, or single-role invocation.

---

## Reference: modules and key artifacts (from IA report)

| Module | Key artifacts (repo) |
|--------|----------------------|
| Cotizaciones | `src/components/PanelinCalculadoraV3*.jsx`, `server/routes/legacyQuote.js`, calc router, Master_Cotizaciones, CRM_Operativo, GoogleDrivePanel, Vite 5173 |
| Operaciones | bmcDashboard routes: proximas-entregas, coordinacion-logistica, audit, marcar-entregado; Sheets: Master, CRM, AUDIT_LOG; Finanzas UI blocks |
| Finanzas | bmcDashboard: kpi-financiero, pagos-pendientes, metas-ventas; Sheets: Pagos_Pendientes, Metas_Ventas; Finanzas UI at 3001/finanzas |
| Ventas | Ventas 2.0 (planned), “Ventas realizadas y entregadas” sheet, shopify/ML if applicable |
| Invoque Panelin | GPT/OpenAI agent; no current implementation in map; recommended hybrid (section + transversal) |
| Shell & Infra | Entry URL, ngrok, ports 5173/3001/3849, favicon, root route, nav shell, `server/index.js`, dashboard static |

Use this prompt to run the agent team and generate the context briefs, investigation, discussion, and full improvement plan.
