# IMPROVEMENTS-ROADMAP.md

**Project:** Calculadora-BMC  
**Date:** 2026-06-07  
**Based on:** TECH-DEBT-REGISTER.md (scored items), SECURITY-AUDIT, CODE-REVIEW-AUDIT, confirmed session issues.

## Phase 0 — Critical (Do Immediately, max 3 items)

1. **Make webhook secrets mandatory in production + remove silent skip**  
   Description: whatsappSignature.js and mlSignature.js currently return ok+skipped when secret absent. Webhook handlers only warn.  
   Effort: 3-5 days  
   Business value: Closes direct forgery vector for ML questions and WA messages (high risk, confirmed in transcript and code).  
   Owner: Backend + Security  
   Dependencies: Update tests, startup validation in config, prod secret rotation.

2. **Persist OAuth state (replace in-memory Map)**  
   Description: `oauthStates = new Map()` in server/index.js breaks on multi-replica Cloud Run / restarts. Affects multiple OAuth flows.  
   Effort: 1 week  
   Business value: Reliable logins and channel OAuth for operators; eliminates class of "works locally, fails in prod" bugs.  
   Owner: Backend  
   Dependencies: Reuse/extend tasks.oauth_state or identity tables.

3. **Fix test runner + add coverage baseline**  
   Description: Single giant `&&` chain in package.json; zero coverage visibility.  
   Effort: 3-5 days  
   Business value: Trustworthy gates, visibility into pricing/auth regressions, faster safe iteration.  
   Owner: CI owner  
   Dependencies: None (quick win).

## Phase 1 — Next 3 Months (5–8 items)

- Decompose server/index.js monolith (extract at least webhook processors + one major worker into dedicated modules). Priority from debt register (score 30).
- Delete/archive "docs 2/" + create canonical docs INDEX + archiving policy for handoffs/goal-prompts (debt score 21).
- Enforce relax-dev-auth strictly (only dev, loud warning) + document attack surface.
- Upgrade react-router (or add redirect guard) to close moderate open-redirect vuln.
- Add explicit positive/negative HMAC tests for both signature libs and gate them.
- Promote key browser flows (admin cotizaciones, calculator wizard, PDF) into scheduled smoke that can fail the pipeline.
- Finish remaining GCP Secret Manager / IAM Phase 1 items (per PROJECT-STATE).
- Standardize logging to pino everywhere in server/ (remove remaining console.* in agent paths).

## Phase 2 — Next 6 Months (5–8 items)

- Define and extract stable "core calc + quotes + identity" service boundary (or clear internal contracts) so AI/channel surfaces can evolve independently.
- Replace Sheets as sole high-volume runtime store for operator data with stronger dual-write + Supabase where appropriate (keep for pricing/MATRIZ and business editing).
- Implement basic per-route rate limiting on public/agent surfaces (budgeting exists for chat; generalize).
- Add bundle-size + lazy-load regression tests for hub modules.
- Full WebKit/Safari + mobile visual regression for calculator + admin cotizaciones (recent crash was a warning).
- Consolidate sub-packages (shop-chat-agent) decision: extract to sibling repo or lock behind strict interface + version.
- Introduce lightweight SBOM + scheduled dependency scanning in CI.

## Phase 3 — Next 12 Months (Strategic / Tech Debt + Platform)

- Evaluate splitting the single Cloud Run service (or heavy use of revisions + traffic splitting for risky changes).
- Platform thinking: reduce 188 scripts to fewer first-class, well-documented commands.
- Agent coordination hygiene: reduce meta-doc sprawl (docs/team/ + dev-trace/) while preserving velocity.
- Consider API gateway / service mesh if surface count keeps growing.
- Formal "complexity & debt" review as part of monthly project compass / schedule run.

**Tracking:** Every item above should appear or be referenced in `docs/team/PROJECT-STATE.md`. Re-audit in 90 days and compare debt register scores.

**Prioritization logic:** Security/reliability first (webhook state + secrets), then visibility (tests/docs), then architectural seams (monolith boundaries).

---
*Directly derived from scored TECH-DEBT-REGISTER + security/code findings. All items have owner + effort + business value.*
