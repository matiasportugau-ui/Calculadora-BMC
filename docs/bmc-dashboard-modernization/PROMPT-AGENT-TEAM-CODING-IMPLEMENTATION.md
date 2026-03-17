# Prompt: AI Agent Team — Coding & Implementation (BMC Dashboard)

Use this prompt to brief an AI agent **Coding and Developing** team that will (1) expand context on **issues and solutions** from the development universes, (2) discuss and refine each solution into a **best implementation path**, and (3) **execute** the plan (code, config, docs).

---

## Objective

The Coding/Developing team must:

1. **Expand context** on issues and solutions using the **development universes** (context briefs) and the existing improvement plan.
2. **Judge each proposed solution** — feasibility, risk, effort — and refine until the implementation path is optimal.
3. **Present** the refined, step-by-step implementation path (with any merged, reordered, or split steps).
4. **Execute** the plan: implement code, config, and docs in dependency order; verify acceptance criteria.

**Inputs:**

- `docs/bmc-dashboard-modernization/context-briefs/` (01–06 universe briefs)
- `docs/bmc-dashboard-modernization/FULL-IMPROVEMENT-PLAN.md`
- `docs/bmc-dashboard-modernization/02-investigation-and-discussion.md`
- `docs/bmc-dashboard-modernization/BMC-DASHBOARD-IA-REVIEW-REPORT.md`
- Repo code: `server/`, `src/`, `docs/bmc-dashboard-modernization/`, `.cursor/SETUP DASHBOARD /`

**Output:**

- **Phase 1:** Issues-and-solutions brief (per wave or per step): what each step fixes, which files/touchpoints, risks.
- **Phase 2:** Refined implementation path (IMPLEMENTATION-PATH.md): judged solutions, optional merges/splits, final order.
- **Phase 3:** Executed changes (commits or patch set): docs, code, config; verification notes.

---

## Team composition (development roles)

| Role | Focus | Delivers |
|------|--------|----------|
| **Shell & Infra** | Entry URL, nav, favicon, root route, IA doc, primary URL doc | server/index.js, dashboard static, IA.md, README/setup |
| **Cotizaciones** | Calculadora component naming, link from shell to builder | App.jsx, component rename, docs |
| **Operaciones / Finanzas** | Dashboard UI: tabs/hash for Op vs Fin, KPI as sub-area, error/loading | dashboard/*.html, *.js, *.css |
| **Invoque Panelin** | Placeholder in nav, IA text, transversal spec | IA doc, nav placeholder |
| **Facilitator / Lead** | Refines path, orders steps, runs verification | IMPLEMENTATION-PATH.md, execution log |

**Single-agent variant:** One agent performs Phase 1 (expand context), Phase 2 (refine path), and Phase 3 (execute) in sequence. Execute wave-by-wave; verify after each step or wave.

---

## Phase 1 — Expand context on issues and solutions

**Rule:** Before implementing, the team must expand context on **what each step fixes** and **where** it touches the codebase. Use the development universes (context briefs) and FULL-IMPROVEMENT-PLAN.

For each **wave** (or each step that will be implemented first):

1. **Read** the relevant universe brief(s) and the plan step(s).
2. **Produce** an **issues-and-solutions brief** that includes:
   - **Issue:** What gap or problem this step addresses (cite context brief + plan).
   - **Solution (as stated):** The plan’s description of the step.
   - **Touchpoints:** Exact files, routes, env vars, or docs to create/change.
   - **Risks:** What could break (e.g. existing links, env, deploy).
   - **Acceptance (concrete):** How to verify (e.g. “curl GET / returns 302 to /finanzas”, “IA.md exists and lists 6 sections”).
   - **Dependencies:** Other steps that must be done first (from plan).

**Output:**

- `docs/bmc-dashboard-modernization/implementation/01-issues-and-solutions-brief.md` (or one file per wave: `01-wave1-brief.md`, etc.).

**Handoff:** Phase 2 uses this brief to judge and refine each solution.

---

## Phase 2 — Judge solutions and set best implementation path

**Input:** Phase 1 issues-and-solutions brief(s), FULL-IMPROVEMENT-PLAN, context briefs.

**Tasks:**

1. **Judge each step** (from the plan) that will be executed:
   - **Feasibility:** Can we do it with current repo state? (Y/N + note)
   - **Risk:** Low / Medium / High (and why)
   - **Effort:** S / M / L (small / medium / large)
   - **Improvement:** Should we merge with another step? Split? Reorder? (e.g. “Do 1.1 and 1.2 together”; “Do 1.4 before 1.3 to unblock ngrok testing”)

2. **Refine the path:**
   - Reorder steps only when dependencies allow (e.g. 1.4 can run before 1.3).
   - Merge steps that share the same touchpoints (e.g. “Add Invoque Panelin to IA” + “Add to nav” if both are one shell change).
   - Split steps only if one is too large (e.g. “Implement shell” → “Add shell HTML” then “Add nav links”).
   - Mark any step as **defer** if it depends on external or out-of-scope work.

3. **Produce the implementation path:**
   - Ordered list of **concrete tasks** (each task = one or more plan steps, or a split).
   - Per task: ID, title, touchpoints, acceptance, owner (universe), estimated effort.
   - Note any **blockers** or **assumptions** (e.g. “Assumes dashboard static lives in docs/bmc-dashboard-modernization/dashboard/”).

**Output:**

- `docs/bmc-dashboard-modernization/implementation/IMPLEMENTATION-PATH.md`

**Handoff:** Phase 3 executes tasks in this order.

---

## Phase 3 — Execute

**Input:** IMPLEMENTATION-PATH.md, repo code and docs.

**Tasks:**

1. **Execute tasks in order.** For each task:
   - Implement (create or edit files: docs, code, config).
   - Run local checks if applicable (e.g. `npm run dev`, curl to / and /favicon.ico).
   - Verify acceptance criteria; note any deviation (e.g. “Favicon: 204 instead of 200, acceptable per plan”).

2. **Log execution:**
   - What was done (files changed, key edits).
   - What was skipped or deferred and why.
   - Any follow-up (e.g. “Step 2.1: shell nav — partial; link-only nav done, full SPA shell deferred”).

3. **Do not:**
   - Break existing behavior without documenting (e.g. if a route changes, update any README or map that references it).
   - Assume env or secrets; use placeholders or .env.example where needed.
   - Implement out-of-scope features (e.g. full Invoque Panelin backend); placeholders only where the plan says “placeholder.”

**Output:**

- Code and doc changes in the repo.
- `docs/bmc-dashboard-modernization/implementation/EXECUTION-LOG.md` (or append to IMPLEMENTATION-PATH.md under “Execution log”).

---

## Execution instructions (for human or orchestrator)

1. **Run Phase 1:**  
   “Using context briefs (01–06), FULL-IMPROVEMENT-PLAN, and 02-investigation-and-discussion, expand context on issues and solutions for Wave 1 (and optionally Wave 2). Produce the issues-and-solutions brief. Save under `docs/bmc-dashboard-modernization/implementation/`.”

2. **Run Phase 2:**  
   “Using the issues-and-solutions brief and FULL-IMPROVEMENT-PLAN, judge each solution (feasibility, risk, effort). Refine the implementation path (reorder, merge, split, defer). Produce IMPLEMENTATION-PATH.md.”

3. **Run Phase 3:**  
   “Using IMPLEMENTATION-PATH.md, execute the first N tasks (e.g. Wave 1 + first tasks of Wave 2). Implement code and docs; verify acceptance; write EXECUTION-LOG.md.”

**Single-agent variant:** One agent runs Phase 1 → Phase 2 → Phase 3 in sequence. Prefer completing Wave 1 fully before starting Wave 2.

---

## Constraints

- **Stay within plan scope:** Implement only what FULL-IMPROVEMENT-PLAN describes; no feature creep.
- **Cite sources:** When changing a file, reference the plan step ID (e.g. “Step 1.1”, “Wave 1”).
- **Verifiable acceptance:** Every task must have a concrete way to verify (file exists, route returns X, nav shows Y).
- **Reversibility:** Prefer additive changes (new files, new routes); if modifying existing behavior, document the change so it can be reverted or reviewed.

---

## Reference: plan steps (from FULL-IMPROVEMENT-PLAN)

| Wave | Steps | Key deliverables |
|------|--------|-------------------|
| 1 | 1.1 IA doc, 1.2 Naming, 1.3 Primary URL doc, 1.4 Favicon/root | IA.md, doc updates, favicon, root/favicon routes |
| 2 | 2.1 Shell + nav, 2.2 Wire Cotizaciones, 2.3 Operaciones/Finanzas labels | Shell HTML/JS, nav, links |
| 3 | 3.1 User flow doc, 3.2 Component naming, 3.3 KPI under Finanzas | User-flow doc, App.jsx + rename, dashboard UI/docs |
| 4 | 4.1 Invoque Panelin in IA + nav, 4.2 Transversal spec | IA + nav placeholder, doc |
| 5 | 5.1 Error/loading verify, 5.2 Health/deploy verify, 5.3 3849 vs 3001 | Verification, docs |

Use this prompt to run the Coding/Developing team and produce the issues-and-solutions brief, the refined implementation path, and the executed changes.
