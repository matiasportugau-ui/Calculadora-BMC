# ARCHITECTURE-DECISIONS.md

**Project:** Calculadora-BMC  
**Date:** 2026-06-07

This document records key architecture decisions (ADRs) discovered during the audit, including current state, options, and consequences.

## ADR-001: Express Monolith on Single Cloud Run Service

**Context:**  
All public calculator, operator hub (/hub/*), AI agent (SSE chat + tools), identity (Google + TOTP), tasks, WA, ML, Shopify, transportista, traktime, wolfboard, and background workers run in one Express process (`server/index.js`, 1196 lines) deployed as a single Cloud Run revision (`panelin-calc`).

**Options Considered:**
- A. Keep monolith (current).
- B. Split into multiple services (e.g. calc-api, agent-api, channel-webhooks).
- C. Keep monolith but extract clear internal contracts + separate workers.

**Decision:** A (with incremental extraction of contracts — calcLoopbackClient, panelinInternal, presupOrchestrator).

**Consequences:**
- Positive: Fast iteration, shared code/config, simple deployment.
- Negative: High blast radius, difficult independent scaling (AI workers vs public calc), cognitive load, testing complexity, one bad deploy affects everything.
- Trade-off matrix: Speed of development (high) vs Operational risk / scaling (low).

**Action Items:**
- Continue extracting stable surfaces (calc, quotes, identity) behind loopback/internal routers.
- Document what must stay together vs what can be split.
- Consider traffic splitting or separate revisions for risky deploys.

## ADR-002: Google Sheets as Primary Operational Store + Supabase for Identity/Structured

**Context:**  
CRM_Operativo, Admin cotizaciones, pricing (MATRIZ), wolfboard, etc. live primarily in Google Sheets. Supabase used for auth, tasks (with rich fields + Calendar pairing), pgvector RAG, some quote persistence, WA cockpit tables.

**Decision:** Hybrid — Sheets for business-user editable data + Supabase for auth/structured/high-integrity.

**Consequences:**
- Positive: Business users stay in familiar tool; fast for pricing sync/reconciles.
- Negative: Mapping drift (multiple past incidents), rate limits, complex reconcile/bake scripts, dual-write complexity.
- Recent improvements: Column mapping standardization + Secret Manager for service accounts.

**Action Items:**
- Treat Sheets as "source of truth for pricing + view layer", not sole runtime DB.
- Strengthen dual-write + reconciliation for high-volume paths (wolfboard, admin cotizaciones).

## ADR-003: In-Memory OAuth State + Optional Webhook HMAC

**Context:**  
`oauthStates = new Map()` in server/index.js. Webhook signature libs (whatsappSignature, mlSignature) explicitly skip verification if secret is absent (return ok + skipped).

**Decision (current, implicit):** Convenience for local dev + "best effort" security.

**Consequences:**
- Negative: Breaks on multi-instance Cloud Run; replay and forgery risks when secrets not set; state loss on restarts.
- Confirmed gaps match session transcript.

**Action Items:** See TECH-DEBT-REGISTER (scores 36) and SECURITY-AUDIT. Persist state; make secrets mandatory in prod.

## ADR-004: Vercel SPA + Cloud Run API via Proxy Rewrites

**Context:**  
Frontend on Vercel, API on Cloud Run. vercel.json rewrites /api/*, /calc/*, /auth/* to the Cloud Run URL. SPA handles client-side routing.

**Decision:** Split deployment with proxy.

**Consequences:**
- Positive: Independent scaling of static assets vs dynamic API; good security headers on Vercel.
- Negative: Contract drift risk (new top-level prefixes must be added to vercel.json); two places to configure CORS/auth.

**Action Items:**
- Keep vercel.json in sync with server route mounts.
- Consider API gateway if number of surfaces grows.

## ADR-005: Dual Auth (Service Token + User JWT) + RBAC Grants

**Context:**  
Legacy API_AUTH_TOKEN for cron/service callers + modern Supabase identity + JWT + module grants (RequireGrant) for operators.

**Decision:** Support both (via requireServiceOrUser shim) during transition.

**Consequences:**
- Positive: Backward compat for existing integrations; progressive enhancement of user auth.
- Negative: Two mental models; relax-dev flag adds surface.

**Action Items:** Continue migration of internal surfaces to identity grants where appropriate. Make relax-dev strictly dev-only.

---
*These ADRs capture the "as-built" architecture. Update when major refactors occur. Cross-link to SYSTEM-DESIGN.md and IMPROVEMENTS-ROADMAP.md.*
