# AUDIT-SUMMARY.md (Executive Summary)

**For:** Non-technical leadership (CEO, operators, Matias)  
**Project:** Calculadora-BMC (BMC Uruguay / METALOG SAS)  
**Date:** 2026-06-07  
**Auditor:** Full terminal session audit (90-120 min structured per transcript)

## Current State (Honest, 5-minute read)

**Strong points (what is working well):**
- Real product delivering value: live calculator used for walls/roofs/custom panels with complex pricing (dual lists + IVA + dimension math). Multi-channel intake (ML, WA, Shopify, direct) feeding operator hub + Sheets CRM.
- High automation velocity: 180+ npm scripts, strong gate culture (gate:local, pre-deploy, smoke:prod with MATRIZ canary), recent concrete hardening (GCP secrets to Secret Manager, MATRIZ mapping fixes, Docker context incident root-caused + fixed).
- Modern auth evolution (Supabase identity + JWT + TOTP + module RBAC) alongside backward-compatible service tokens.
- Good engineering hygiene in places: pino logging, timingSafeEqual signatures, raw-body webhooks, lazy frontend bundles, calc loopback contracts for agents.

**Weak points (real issues):**
- Backend is a true monolith (server/index.js = 1,196 lines, one Cloud Run service hosting calculator + AI agent + all channels + workers + identity). High blast radius.
- Webhook security is best-effort: HMAC verification is implemented correctly but **skipped entirely** (with only a log warning) when the secret is not set. OAuth state is purely in-memory (Map) — breaks on multi-instance deploys.
- Documentation is overwhelming (1,023 .md files / 29 MB, dominated by internal agent coordination artifacts; "docs 2/" is a stale duplicate graveyard). No clear index for humans.
- Test execution is brittle (one giant `&&` chain, no coverage reports). 60+ good tests exist but visibility and enforcement of critical paths are weak.
- Operational complexity tax is high (188 scripts, multiple sub-packages inside one repo, many human-gated channels).

## Key Risks (if unaddressed)
- Forged webhooks (ML/WA) if secrets remain optional in prod.
- Login/OAuth breakage and lost state for operators on scaled Cloud Run.
- Slow onboarding + contradictory knowledge due to doc sprawl.
- Regressions in pricing/calc/auth because gates are hard to trust and slow.

No catastrophic secret leaks or classic injection vulns found in committed code. Main risks are design/operational (skipped verification, in-memory state, concentration).

## Top 3 Priorities for Next Quarter
1. **Close webhook + OAuth state gaps** (make secrets mandatory in prod, persist OAuth state). Highest risk × impact items from debt register (score 36).
2. **Stabilize gates + visibility** (fix test runner, add coverage baseline for pricing/auth/signature paths).
3. **Documentation hygiene** (delete/archive "docs 2/", create canonical INDEX separating operator vs agent docs, adopt archiving policy).

These three directly address the highest-scored items in the TECH-DEBT-REGISTER and the "CONFIRMED CURRENT STATE ISSUES" from the audit transcript.

## ROI of Improvements
- Reduced production incidents (past Finanzas 404, pricing drift, potential webhook forgery).
- Faster/safer development (trustworthy gates, smaller cognitive surface after monolith seams).
- Better operator reliability (consistent OAuth, secure channels).
- Lower onboarding and maintenance tax (docs cleanup).
- Estimated: 1-2 engineer-months for Phase 0 items; payback in reliability + development speed within one quarter.

**Recommended budget/timeline:** Prioritize the 3 Phase 0 items immediately (3-6 weeks). Phase 1 items over the following 3 months. Re-audit at 90 days.

**Recommendation:** The system works and the team moves fast. The work now is making that velocity sustainable and reducing self-inflicted risk. Focus on the top 3; the rest of the roadmap (monolith boundaries, sub-package decisions, platform consolidation) can follow.

Full details in the other 9 deliverables in this audit-output/ directory (TECH-DEBT-REGISTER, SECURITY-AUDIT, CODE-REVIEW-AUDIT, etc.).

---
*1-page executive summary. Readable by non-developer in <5 minutes. All claims traceable to the 10 deliverables and live scans.*
