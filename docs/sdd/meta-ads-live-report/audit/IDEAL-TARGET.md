# Ideal 100% — Meta Ads Live Report

## Target composite: 100 (pass ≥90)

## System class

**Greenfield feature slice** inside an existing modular monolith (Calculadora BMC Marketing Hub): operator admin UI + Express APIs + grounded LLM analyst + multi-source Meta Ads data.

Ideal is **not** a full platform SDD for all of calculadora-bmc — it is expert-complete documentation of **this feature** so a new engineer (or agent) can implement PR1–PR3 without critical invention.

## Must-have artifacts

| Artifact | Ideal state |
|----------|-------------|
| `SDD.md` | Sections 1–12; Draft→Accepted after PR1 lands as-built notes |
| `TARGET.md` | Present (done) |
| `RECREATION-CHECKLIST.md` | All implementable items `[x]` or justified `N/A` |
| `evidence/` | Index of CONFIRMED host patterns (SSE chat, marketing auth, ads Google parity) with path:line |
| `diagrams/` | Optional exported Mermaid; syntax verified renderable |
| API contract | OpenAPI snippet or JSON Schema for `MetaAdsReport` + error envelope |
| Fixture contract | Documented shape of `metaAdsFixture.json` (or embedded schema) |
| Setup | `META-ADS-SETUP.md` outline for PR3 (scopes, system user, account id) |

## Section-specific ideal

### §1 Goals
SMART goals with acceptance criteria tied to PR1/PR2 checkboxes (already strong).

### §2 Context
C4Context renders in GitHub/mermaid.live; every external interface has **auth mechanism** and **env var names**.

### §3 Constraints
Stack locks + secret names (done). Ideal adds: Graph API version (e.g. v21.0), rate-limit budget, currency lock USD.

### §4 Strategy
Phases PR1–4 (done). Ideal adds dependency graph (PR2 blocked by PR1 report_hash).

### §5 Containers
Exact file paths per container (e.g. `server/lib/marketIntel/metaAdsReport.js`). Mount: `app.use` or extend `marketing.js`.

### §6 AI
Ideal adds: primary model via agentCore defaults, system prompt path, SSE event types (`text|error|meta|done`), validation algorithm pseudocode, optional promptfoo case names.

### §7 Data flow
Ideal adds: error/retry path sequence; range enum mapping to date_start/date_stop.

### §8 Deployment
Ideal adds: local commands (`doppler run -- npm run dev`), which Cloud Run service name pattern, how to smoke `GET .../report?source=demo`, no C4Deployment required if table is complete with runbook.

### §9 Crosscutting
Ideal adds: rate limit numbers, log field schema example, alert when `freshness=error` for live mode 3×/hour.

### §10 ADRs
Current quality is near-ideal (≥8 strong ADRs).

### §11 Risks
Ideal links each High risk to a PR mitigation owner.

### §12 Glossary
Done; ideal adds Meta Insights field aliases (spend, actions, cost_per_action_type).

## Acceptance test (recreation)

> A developer with repo access and admin JWT can implement **PR1** (fixture + snapshot report + tab UI) in **&lt;1 day** using only `SDD.md` + `RECREATION-CHECKLIST.md` + cited host files, and pass: Demo mode shows all 8 zones; Snapshot badge never says LIVE; `gate:local` green.

> Same developer can implement **PR2** AI in **&lt;0.5 day** with prompt rules + insights schema without inventing endpoints.

## Pass bar (≥90) for this system

Minimum to mark **Pass** without full 100:

1. Full `MetaAdsReport` JSON Schema (or TypeScript interface) in SDD or linked file  
2. `RECREATION-CHECKLIST.md` for PR1  
3. Evidence tags + path:line for 5+ host integration claims  
4. Mermaid syntax verified (no invalid C4 keywords)  
5. File tree + route mount + example curl for demo report  

That package should push composite from ~82 → **≥90**.
