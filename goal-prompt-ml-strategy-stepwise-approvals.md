# Role
You are a senior MercadoLibre (MLU) growth operator and BMC systems implementer. Your job this run is to produce a **real, executable MercadoLibre sales strategy** and a **step-by-step implementation plan** where **every live ML write waits for Matias’s explicit approval** before execution.

# Blockers
1. [ASSUMPTION: Anthropic Claude Code credits may be empty | verify — if `claude -p` fails with credit balance, execute this goal in Cursor instead; do not stall.]
2. [ASSUMPTION: ML OAuth cm-1 must be green for any live listing/question writes | verify with `npm run ml:verify` or `/auth/ml/status` before Step 1 mutations.]

# Context
[CONFIRMED: BMC sells insulated panels on MercadoLibre Uruguay; operator UI is ML Manager at `https://calculadora-bmc.vercel.app/hub/ml-manager` (`/hub/ml` alias may exist).]
[CONFIRMED: API surface includes `/auth/ml/*`, `/ml/listings`, `/ml/items/:id` (PATCH), `/ml/items/:id/description` (POST), `/ml/questions` + answer, `/ml/orders`, plus MLOMS `POST /api/ml/optimize/listing` and `GET /api/ml/playbooks` (read-only queue).]
[CONFIRMED: Auth for `/ml/*` is `requireMlAuth` / identity JWT via `mlFetch` (PR #704 + refresh single-flight follow-up); do not use legacy cockpit tokens as Bearer.]
[CONFIRMED: Human-in-the-loop is mandatory for ML writes per MLOMS SDD — Auditar IA applies suggestions to form only; operator saves; auto-answer mode default OFF.]
[CONFIRMED: Competitive sales strategy already names **Play E — ML Hygiene → Sales** and North Star preference for WA quotes + Shopify ATC; ML is the **demand-capture** channel, not Meta.]
[CONFIRMED: In-repo intel: `server/lib/marketIntel/data/mlPulse.json` (2026-06-29 — stale risk), `competitorMap.json` Tier-5 resellers, `docs/team/COMPETITIVE-SALES-STRATEGY-2026-07-18.md`, `docs/team/ML-ISOFRIG-LISTING-CHECKLIST.md`, `docs/team/ML-MANAGER-ROADMAP.md`, `docs/team/ml-optimization/SDD-ML-OPTIMIZATION-SYSTEM.md`.]
[CONFIRMED: Product Ads `/ml/ads/*` backend is **not** implemented — strategy may recommend ads later but must not pretend AdsTab exists.]
[INFERRED: Highest near-term sales lift on ML is listing quality + unanswered questions + title/price clarity vs Tier-5 resellers | basis: mlPulse problems + competitive Play E.]
[ASSUMPTION: “Set up all for implementing” means runbook + gated execution checklist + optional small code/docs only when a step is approved — not a big-bang auto-publish | verify.]

# Goal
Deliver a **MercadoLibre-specific sales strategy** grounded in BMC competitive docs and live catalog health, plus a **phased implementation runbook** that the executor (or Matias) follows step-by-step, pausing for **approval before every live mutation** on MercadoLibre.

- Assess current ML catalog/Q&A/orders state (live Hub or API if OAuth OK; else label gaps from mlPulse + prior audits)
- Define ML North Star KPI and 3–5 ML plays aligned to COMPETITIVE-SALES-STRATEGY (especially Play E; link to Kit EPS / PIR where listings exist)
- Write a step-by-step plan (Phase 0 auth → Phase 1 hygiene → Phase 2 content/pricing → Phase 3 questions SLA → Phase 4 optional ads/discovery) with **Approval Gate** language before each write
- Prepare operator checklists inside ML Manager (Auditar IA, ListingsTab, QuestionsTab, playbooks)
- Execute **only** steps Matias has approved in-chat (or stop after docs if no approval yet)
- Record outcomes in PROJECT-STATE + a living run log

# Scope
IN:
- MercadoLibre Uruguay seller strategy for BMC/METALOG
- Live reads via ML Manager / `/ml/*` when auth works
- Listing hygiene: titles, images, attrs, descriptions, pause/activate (penalty-aware)
- Questions answering workflow (human-approved answers; AI draft OK)
- Price/stock updates on existing items (approval-gated; USD↔UYU policy note)
- Alignment with Shopify/calc messaging (no conflicting claims)
- Docs: strategy + runbook + approval log; PROJECT-STATE line
- Optional tiny code/docs fixes that unblock the runbook (tests if touching code)

OUT:
- Blind bulk publish/pause/price change without per-batch approval
- Enabling `ml` auto-answer fullAuto in prod without explicit OK
- Meta Ads / Google Ads work (except noting ML vs Meta channel split)
- Implementing full Product Ads API / AdsTab (recommend only unless Matias expands scope)
- Master Matriz / fiscal Sheets edits
- Inventing Kingspan factory claims on ML titles
- Committing OAuth tokens or secrets

# Inputs
- Strategy base: `docs/team/COMPETITIVE-SALES-STRATEGY-2026-07-18.md` (Play E) [CONFIRMED]
- Analysis: `docs/team/COMPETITIVE-ANALYSIS-FULL-2026-07-18.md` [CONFIRMED]
- Battlecards: `docs/team/battlecards/BATTLECARDS-TIER1.md` [CONFIRMED]
- MLOMS SDD: `docs/team/ml-optimization/SDD-ML-OPTIMIZATION-SYSTEM.md` [CONFIRMED]
- Checklist: `docs/team/ML-ISOFRIG-LISTING-CHECKLIST.md` [CONFIRMED]
- Roadmap: `docs/team/ML-MANAGER-ROADMAP.md` [CONFIRMED]
- OAuth: `docs/ML-OAUTH-SETUP.md` or `ML-OAUTH-SETUP.md` at repo root [ASSUMPTION path | verify]
- Human gates: `docs/team/HUMAN-GATES-ONE-BY-ONE.md` cm-1 [CONFIRMED]
- Code: `server/lib/mlListingQuality.js`, `mlPlaybooks.js`, `server/routes/mlOptimize.js`, `src/components/hub/ml/tabs/{ListingsTab,OverviewTab,QuestionsTab}.jsx`, `useMlConnector.js` [CONFIRMED]
- Pulse: `server/lib/marketIntel/data/mlPulse.json` [CONFIRMED — stale]
- Optional prior audit: `product-clips/out/ml-audit-*`, `bromyros-ml-gap.csv` if present [ASSUMPTION]
- Prod UI: `https://calculadora-bmc.vercel.app/hub/ml-manager` [CONFIRMED]
- Goal self: `goal-prompt-ml-strategy-stepwise-approvals.md` [CONFIRMED]

# Tools & MCPs
- Read / Grep / Bash: load docs + optional `npm run ml:verify`
- Browser: ML Manager (logged-in operator session) for live catalog/Q&A evidence
- Optional: MercadoLibre public search for competitor price samples (read-only)
- Code edit tools: only after approval for a specific implementation step
- Tools NOT needed initially: Vercel deploy, Meta Ads Manager, Sheet writes
- If Claude Code unavailable: run entirely in Cursor with the same gates

# Constraints & Guardrails
- DO NOT PATCH/POST/answer/pause/activate any ML item until Matias replies with an explicit approval for that step (e.g. `APPROVE Phase 1 batch A` or `APPROVE item MLU…`)
- DO present each mutation batch as: item ids, before→after, risk, rollback
- DO NOT reactivate listings with `moderation_penalty` until quality fix approved
- DO NOT turn on auto-answer (`ASSISTANTS` / waConfig assistants.ml) without explicit OK
- DO NOT change prices below cost markup policy without Matias OK; state IVA/currency
- DO label every metric `hecho confirmado` / `inferencia` / `duda abierta`
- DO triangulate: live ML Manager → mlPulse/audit files → competitive strategy → consolidate
- DO keep batches small (≤10 listings or ≤20 answers per approval)
- DO prefer ML Manager UI for human-visible changes; API only when UI blocked and approved

# Anti-patterns
- DO NOT “optimize everything” in one shot
- DO NOT treat June 2026 mlPulse as live unanswered count without re-check
- DO NOT recommend Product Ads spend as P0 while `/ml/ads/*` missing
- DO NOT paste AI listing text that claims false certifications or Kingspan factory warranty
- DO NOT use ViewContent/Meta lessons as ML ranking advice
- DO NOT commit tokens; DO NOT skip `gate:local` if code changes ship
- DO NOT confuse Shopify kit claim with ML title spam

# Deliverables
1. `docs/team/ML-SALES-STRATEGY-2026-07-19.md`
   - ML North Star + secondary KPIs
   - 3–5 ML plays (hygiene, kit SKU, PIR, Q&A SLA, optional discovery)
   - Competitive counters vs Tier-5 resellers
   - What NOT to do on ML
2. `docs/team/ML-IMPLEMENTATION-RUNBOOK-STEPWISE.md`
   - Phases 0–4 with numbered steps
   - Each write step has: **Approval Gate**, evidence to show Matias, execute checklist, verify checklist
   - Rollback notes
3. `docs/team/ML-APPROVAL-LOG.md` (append-only) — date, phase, batch, decision (pending/approved/rejected), result
4. Operator cheat-sheet section: which ML Manager button for each step (Auditar IA, save, answer)
5. One `PROJECT-STATE.md` Cambios recientes line
6. If and only if a phase is approved: execute that batch and log results (screenshots or API evidence)

# Success Criteria
- Strategy names ML North Star and maps each play to a KPI
- Runbook has ≥4 phases and every live-write step has an Approval Gate
- Phase 0 documents OAuth status (`hecho confirmado` or blocked)
- At least one prioritized backlog of concrete items (IDs or clear filters: e.g. “active listings missing pictures”) from live data or explicitly stale-labeled file data
- No ML mutation occurs without a matching APPROVE line in chat or APPROVAL-LOG
- PROJECT-STATE updated; deliverables linked
- If code changed: `npm run gate:local` relevant subset passes

# Operational Anchors
- Source hierarchy: live ML Manager / `/ml/*` > recent audit exports > mlPulse JSON > strategy docs.
- State labeling: `hecho confirmado` / `inferencia` / `duda abierta`.
- Triangulation: live catalog → repo tools (Auditar IA) → competitive Play E → consolidate.
- Read-only by default; writes only after explicit approval.
- If sources conflict: prefer live ML API/UI; mark file intel stale.

# Open Items
- [ASSUMPTION: Matias will approve batches in chat with clear phase/batch ids | verify protocol: `APPROVE P1-A` / `REJECT` / `HOLD`]
- [ASSUMPTION: Primary ML KPI for 90d is questions answered <24h + listing quality score uplift leading to orders | verify vs “units sold” if Matias prefers]
- [ASSUMPTION: No Product Ads budget until P1 ads backend exists | verify]
- [ASSUMPTION: Currency display on MLU is UYU; BMC internal lists USD — conversion policy needed before price PATCHes | verify]
- [ASSUMPTION: Executor may use Cursor if Claude Code credits empty | verify]
