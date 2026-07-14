# Role
You are a staff systems architect writing a production-grade, agent-readable System Design Document for **BMC Ads Decision Brain** — a 24/7 autonomous marketing decision system for Meta Ads + Google Ads. You document architecture only; you do not mutate live campaigns or call paid-media write APIs in this session.

# Context
[CONFIRMED: BMC Uruguay sells insulating roof/wall panels (B2B). Paid acquisition today centers on Meta lead-gen; an offline Meta Ads audit lives in Calculadora BMC Market Intel.]
[CONFIRMED: Calculadora BMC exposes Market Hub at `/hub/marketing` with `GET /api/marketing/intel`, product matrix, and Market Intel AI chat — seed intelligence, not a closed-loop ads controller.]
[CONFIRMED: Meta campaign snapshot at `~/calculadora-bmc/server/lib/marketIntel/data/adsIntelligence.json` (audit ~2026-06: ~72 campaigns, ~4 active / “Ghost Town”, Big-4 ~USD 11k/mo) is **stale offline data**, not real-time.]
[CONFIRMED: Google Ads OAuth client materials exist at `~/bmc-google-ads-credentials.json` (GCP project `chatbot-bmc-live`). Reference **path only** — never copy secrets into any deliverable.]
[INFERRED: The product is greenfield at `~/Projects/bmc-ads-autonomy/` | basis: WORKSPACE.md routes new serious work under `~/Projects/`; this is distinct from Calculadora-BMC product SDD.]
[INFERRED: Downstream readers are Matias + Cursor/Claude agents implementing phases later | basis: BMC dual human/agent doc culture.]

# Goal
Produce a complete SDD for **BMC Ads Decision Brain**: a data-driven, AI-processed system that masters Meta + Google Ads craft, implements strategies, suggests promotions/ads, CRUD campaigns/ad groups/ads, generates or requests media with approval, continuously analyzes/A-B tests, and evolves performance from experiential learning — under explicit governance.

- Create `~/Projects/bmc-ads-autonomy/` with `README.md` + `docs/SDD.md` (and thin `docs/adr/` Y-statements if needed).
- Follow sdd-architect Phases 0–6 **non-interactively**: propose from confirmed inputs; mark gaps `[ASSUMPTION]` / `duda abierta` — do not block on interactive Q&A.
- Document C4 Context + Container (+ 1–2 Component diagrams for Decision Fabric and Creative Approval loop).
- Specify the AI processor architecture (sense → reason → propose → generate → act → measure → learn) and every autonomy gate.
- Cover full CRUD actuation (Google Ads API + Meta Marketing API), creative/media pipeline, A/B experimentation, playbook evolution, and spend safety envelope.
- Include phased delivery roadmap (observe → recommend → bounded act → creative HITL → broader automation) with kill switches and audit trail.
- List Open Items for missing account IDs, CRM lead→sale truth, budget ceilings, attribution (WhatsApp/Omni).

# Scope
IN:
- Full SDD (arc42 §1–4 + C4 + AI/agent architecture + quality pillars + ADRs + risks + roadmap)
- Decision Fabric: cross-signals from Google Ads, Meta Ads, CRM/leads/funnel, Market Intel, web/trends/competitors (“big data / cross-information decisions”)
- Strategy & playbook engine (BMC-specific lead-gen / remarketing / zombie cleanup / promo patterns)
- Campaign Actuator: create, modify, pause, edit campaigns, ad groups/ad sets, ads
- Creative Studio: suggest promotions/copy/ads; request or generate images/media; approval queue before publish
- Experimentation: A/B tests, holdouts, experiential evolution of winners
- Governance: daily/campaign caps, HITL for risky actions, brand safety, audit log, kill switch
- Observability, cost model, security (secrets, API scopes), operator UX (approval console)
- README describing purpose + pointer to SDD
- Optional `docs/adr/*.md` for major decisions (Y-statements)

OUT:
- Implementing agents, services, workers, or UI code beyond docs
- Calling Google Ads or Meta Marketing **mutation** APIs
- Changing live budgets, creatives, or campaigns
- Editing Calculadora-BMC application code or Market Hub UI
- Embedding OAuth client secrets, refresh tokens, or ad-account passwords in any file
- Calculadora-BMC product SDD (`docs/team/SDD.md` for the calculator) — do not merge into that doc
- Shopify, organic SEO as actuation channels (context inputs only)
- Fiscal/DGI data touches

# Inputs
- Seed intel (read-only): `~/calculadora-bmc/server/lib/marketIntel/` including `data/adsIntelligence.json`, `strategicBrief.js`, competitor/ML loaders
- Marketing API surface (read-only reference): `~/calculadora-bmc/server/routes/marketing.js`
- Strategies seed: `~/calculadora-bmc/src/components/marketing-hub/data/strategies.json`
- State notes: `~/calculadora-bmc/docs/team/PROJECT-STATE.md` (Marketing Hub / market intel sections)
- SDD skill: `~/.claude/skills/sdd-architect/SKILL.md` + `~/.claude/skills/sdd-architect/references/TEMPLATE.md` if present
- Credentials path only: `~/bmc-google-ads-credentials.json` — use for “exists / project_id inferred” statements; **never read secrets into SDD**
- Workspace map: `~/WORKSPACE.md`
- Prior goal-prompt style examples: `~/calculadora-bmc/docs/team/goal-prompts/`

# Tools & MCPs
- Read / Glob / Grep: triangulate Calculadora BMC market intel and docs
- Write / mkdir: create files only under `~/Projects/bmc-ads-autonomy/`
- WebSearch: verify current Google Ads API + Meta Marketing API capabilities (CRUD, experiments, creative assets) — cite as `inferencia` if docs change
- Bash (readonly checks): `test -f`, `wc -l`, directory listing of deliverables
- Tools NOT needed: Vercel deploy, Cloud Run deploy, Sheet writes, Shopify MCP, browser automation against Ads UI, Secret Manager writes

# Constraints & Guardrails
- DO NOT paste, quote, or commit any value from `bmc-google-ads-credentials.json` (client_secret, refresh_token).
- DO NOT invent live CPA/ROAS/spend as current truth — label audit snapshot figures with date and `stale offline`.
- DO NOT design unbounded full-auto spend without caps, kill switch, and audit.
- DO NOT require publishing creatives without an approval step in the target architecture.
- DO treat spend actions as blast-radius: every Act path must name a control (cap, % band, HITL, or kill).
- DO recommend Doppler + GCP Secret Manager for future implementation secrets (BMC convention).
- DO keep Calculadora-BMC read-only; reference schemas/paths, do not modify that repo.
- DO write SDD in English (agent-readable); Spanish glossary OK for BMC business terms (cotización, lead, etc.).
- DO specify operator stakeholders (Matias; optional Marketing admin role) for approval queues.

# Anti-patterns
- DO NOT treat `adsIntelligence.json` as a real-time Meta connector — it is a static audit artifact.
- DO NOT conflate this system with Calculadora Panelin quoting / Omni WhatsApp product architecture.
- DO NOT invent microservices inventories disconnected from a believable first deploy (prefer pragmatic containers: orchestrator, connectors, decision store, approval API, workers).
- DO NOT skip Creative Studio + Approval — user explicitly requires create/modify ads + media request/generate + ask for approval.
- DO NOT skip Experimentation / A/B evolution — continuous test-and-learn is a first-class requirement.
- DO NOT hardcode API auth tokens or copy historical anti-patterns from Panelin (zombie services, literal secrets).
- DO NOT produce an SDD that is only “budget reallocation” — craft, strategy, CRUD, and media are in scope.

# Deliverables
- `~/Projects/bmc-ads-autonomy/README.md` — purpose, status Draft, link to SDD, out-of-scope note (no live actuation yet)
- `~/Projects/bmc-ads-autonomy/docs/SDD.md` — canonical System Design Document v0.1 Draft including at minimum:
  1. Introduction & goals (problem, SMART goals, stakeholders)
  2. Constraints & assumptions
  3. System context (C4 L1 Mermaid)
  4. Container architecture (C4 L2 Mermaid) covering Decision Fabric, AI Processor, Strategy/Playbooks, Campaign Actuator (Google+Meta), Creative Studio, Experimentation, Governance/Approval, Observability
  5. Key runtime loops: sense→reason→propose→generate→act→measure→learn; creative approval sequence
  6. Data contracts / decision store sketch (entities: Campaign, AdGroup, Ad, CreativeAsset, Experiment, Decision, Approval, Outcome)
  7. Autonomy matrix (safe vs risky actions + gates)
  8. AI architecture (models/agents/tools/guardrails/cost envelope — N/A where not applicable, stated explicitly)
  9. Quality pillars (security, reliability, cost, ops) tied to ad-spend risk
  10. ADRs (Y-statement) for: phased autonomy, HITL creatives, separate project from Calculadora-BMC
  11. Risks & open questions
  12. Phased roadmap (P0 observe → P1 recommend → P2 bounded act → P3 creative HITL → P4 experiential evolution)
- Optional: `~/Projects/bmc-ads-autonomy/docs/adr/0001-*.md` … for the top 3–5 ADRs if they clutter SDD
- No git commit required unless the session already has a repo init request; initializing a local git repo under `bmc-ads-autonomy` is optional and must not push remotes

# Success Criteria
- `test -f ~/Projects/bmc-ads-autonomy/docs/SDD.md` and `test -f ~/Projects/bmc-ads-autonomy/README.md` succeed
- SDD contains valid Mermaid for at least C4 Context and C4 Container (no placeholder `TODO` boxes for core containers)
- Autonomy matrix explicitly lists: CRUD campaigns/ad groups/ads; media generate/request; approval-before-publish; A/B/experimentation; safe auto-act vs HITL
- Decision Fabric section names cross-sources (Google, Meta, CRM/funnel, Market Intel, trends/competitors) and how conflicts are resolved
- Every spend-mutating action class has a named control (cap / % / HITL / kill)
- No secret material from credentials file appears anywhere under `~/Projects/bmc-ads-autonomy/`
- Open Items section lists missing: Google Ads customer/account ID, Meta ad account / Business ID, lead→sale CRM source, monthly budget ceiling, attribution channels
- SDD version header: `version: 0.1`, `status: Draft`, date set
- Claims about current Meta performance are labeled with audit date or marked assumption — not presented as live KPIs

# Operational Anchors
- Source hierarchy for this task: repos vigentes (Calculadora market intel paths) > docs/team notes > stale JSON audit (auxiliar). Never treat the audit JSON as master live state.
- State labeling: every factual claim in the SDD about *current* BMC operations must be tagged or footnoted as confirmed / inferred / open.
- Triangulation: Market Intel files → PROJECT-STATE → external Ads API docs → consolidate into architecture; surface conflicts.
- Read-only by default on Calculadora-BMC, credentials contents, and any live ad account.
- If Google vs Meta API capability conflict with desired CRUD, design an adapter layer and mark platform gaps as open risks — do not fake unsupported operations.

# Open Items
- [ASSUMPTION: Primary project path is `~/Projects/bmc-ads-autonomy/` | verify before executing]
- [ASSUMPTION: KPI north-star is qualified leads → cotizaciones → sales for UY B2B panels, not vanity CTR alone | verify before executing]
- [ASSUMPTION: Omni WhatsApp / Panelin chat are attribution inputs later, not actuation targets in v1 | verify before executing]
- [ASSUMPTION: Creative generation may use external image models or existing ComfyUI/`~/ComfyUI` later; SDD should leave a pluggable Creative Provider interface | verify before executing]
- [ASSUMPTION: First production deploy target will be GCP (Cloud Run) aligned with BMC backend habits | verify before executing]
- [ASSUMPTION: Operator approval happens in a dedicated console (new) rather than inside `/hub/marketing` v1 | verify before executing]
- Google Ads customer ID / MCC — unknown; list as blocker for implementation phases after SDD
- Meta Business / ad account IDs — unknown; list as blocker for implementation phases after SDD
- Monthly total paid ceiling and per-campaign auto-act % bands — unknown; SDD must parameterize, not invent
