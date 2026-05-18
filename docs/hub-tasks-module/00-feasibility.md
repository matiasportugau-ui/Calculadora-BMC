# 00 — Feasibility: Tareas (Tasks) Module

**Date:** 2026-05-18  
**Status:** GO with operational caveat (DATABASE_URL provision)  
**Verdict:** Implementation feasible within Phase 0–1 (6–8 weeks); technical risk **low**; operational risk **medium**; business value **high**.

---

## Executive Summary

The Tareas module — a bidirectional Google Tasks mirror in the HUB — is **technically feasible** and aligns with BMC's existing infrastructure. The implementation leverages proven patterns (OAuth PKCE, polling, Supabase RLS, Express routing) and introduces **no new external dependencies** beyond @tanstack/react-query for frontend state.

**Verdict:** **GO** — contingent on DATABASE_URL provisioning in Cloud Run (blocked Phase 0 item affecting all database-backed modules).

---

## Verdicts

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| **Technical Feasibility** | ✅ GO | OAuth PKCE proven; polling pattern matches Google Sheets/Drive; Supabase + pg sufficient |
| **Operational Risk** | ⚠️ GO-CON-CAVEATS | DATABASE_URL not yet provisioned in Cloud Run (blocks Phase 1 sync & OAuth routes) |
| **Business Alignment** | ✅ GO | Reduces manual task management; integrates naturally into HUB workflow; low cannibal risk (no feature deprecation) |
| **Data Governance** | ✅ GO | Tasks module explicitly excluded from DGI audit scope; no fiscal/CFE/billing data touched |
| **Deployment Readiness** | ✅ GO | Vercel + Cloud Run infrastructure mature; MCP can run in same Cloud Run process or separate sidecar |

---

## Cost Estimate

[HECHO CONFIRMADO: Database is PostgreSQL on Supabase; Cloud Run is panelin-calc service; GCP project is chatbot-bmc-live.]

### Development Phase 0–4 (Full Implementation)

| Item | Effort | Cost (USD, dev/month ~7K) | Notes |
|------|--------|---------------------------|-------|
| Architecture + Schema Design | 16h | ~560 | Includes polling, conflict resolution, PKCE flow |
| OAuth PKCE Implementation | 24h | ~840 | Challenge/verifier, state nonce persistence, token refresh |
| Google Tasks Sync Engine (pull) | 20h | ~700 | updatedMin, nextPageToken, 429 backoff, batch upsert |
| Mutation Routes (create/update/delete) | 16h | ~560 | Direct Google API push, optimistic update, rollback |
| Conflict Resolution (UI + backend) | 12h | ~420 | Soft-delete view, sync_conflicts table, human picker |
| Frontend Component Tree | 24h | ~840 | TasksModule.jsx, hooks, offline IndexedDB queue, sync UI |
| Testing (API contracts, unit, e2e) | 20h | ~700 | Happy path, 429 retry, conflict detection, state persistence |
| Deployment + DevOps | 8h | ~280 | Cloud Scheduler cron, Secret Manager wiring, HMAC verification |
| **Total** | **140h** | **~4,900** | ~1 senior engineer, 3–4 weeks (Phase 0–1) |

### Monthly Operating Cost (Post-Launch)

| Item | Cost | Notes |
|------|------|-------|
| Cloud Run CPU/Memory (polling sidecar, ~100ms/min) | ~8 | Negligible; shared panelin-calc resource pool |
| Supabase storage (task_lists + tasks rows, 10K avg) | ~2 | ~50MB for typical user base |
| Google Tasks API calls (free tier, 100K/day limit) | 0 | Google Cloud free tier covers typical usage |
| **Total Monthly** | **~10** | Incremental cost near zero; bundled in existing Cloud Run commitment |

---

## Risk Table (Top 5)

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|------|------------|--------|-----------|-------|
| **1** | DATABASE_URL not provisioned in Cloud Run | **High** | **Critical** (Phase 1 blocked entirely) | Operator provisioning task in Phase 0; flag in 04-roadmap.md | Operator (not dev) |
| **2** | Google Tasks API 429 rate-limit under high sync load | **Medium** | **Medium** (sync delay 5–60min, user sees stale tasks) | Exponential backoff (2s, 4s, 8s…120s); batch upsert; token per-user quota | Arch / Backend |
| **3** | OAuth token revocation or scope denied (user action) | **Medium** | **Low** (module graceful degradation, offline queue persists) | Token refresh on 401; revoke handler; offline queue survives multi-hour downtime | Backend |
| **4** | Conflict explosion (user edits same task in GS + Google Tasks + mobile) | **Low** | **Medium** (user confusion, manual resolution needed) | soft-delete + sync_conflicts table; human resolution UI; conflict reaper (7d TTL) | Frontend / Arch |
| **5** | MCP sidecar crash, Cloud Scheduler misses cron | **Low** | **Medium** (tasks stale 60+ min until next cron window) | Health endpoint (`GET /health?module=tareas`); Cloud Scheduler retry policy; alerting | DevOps |

---

## Comparison: Zapier / Make / n8n vs. In-House

[INFERENCIA: Tasks module must integrate into identity.modules for fine-grained module-level access control, matching existing traktime/crm-personal pattern.]

### Zapier / Make / n8n

| Aspect | Zapier | Make | n8n | In-House |
|--------|--------|------|-----|----------|
| **Setup Time** | 2–4h | 3–6h | 4–8h | 16–24h (Phase 0–1) |
| **Monthly Cost** | 29–299 (per user) | 9–99 (per user) | 0 (self-hosted) | ~10 (bundled infra) |
| **Customization** | Limited (templates only) | Medium (no-code visual) | High (code + visual) | Unlimited |
| **Data Residency** | Zapier servers | Make servers | Self-hosted option | Supabase (customer controlled) |
| **User Control** | No (black box) | Minimal (visual rules) | High (code, version control) | Maximum (code + audit log) |
| **Integration with HUB identity** | ❌ None | ❌ None | ⚠️ Complex (webhook auth) | ✅ Native (identity.modules) |
| **Offline Queue** | ❌ No | ❌ No | ⚠️ Partial (n8n queue) | ✅ Yes (IndexedDB) |
| **Conflict Resolution** | ❌ Last-write-wins | ❌ Last-write-wins | ⚠️ Custom webhook | ✅ Yes (sync_conflicts table) |
| **Audit Trail** | ⚠️ Zapier logs (opaque) | ⚠️ Make logs (opaque) | ✅ Git + DB logs | ✅ DB logs + Git |
| **Long-term Strategic Fit** | ❌ Vendor lock-in; per-user cost scales | ❌ Vendor lock-in; per-user cost scales | ✅ Self-hosted; cost stable | ✅ In-house; cost stable |

**Decision:** In-house **GO** because:
1. [HECHO CONFIRMADO: Identity module system exists] — Tasks must integrate for module-level grants, impossible via external tools.
2. Offline queue (IndexedDB) essential for mobile-first HUB; external tools cannot deliver this.
3. Conflict resolution (sync_conflicts + human picker) requires code-level access to task state; not feasible in no-code platforms.
4. Cost trajectory: Zapier/Make scales per-user (~$30–99/user/year); in-house is ~$120/year total.
5. Audit trail: DGI audit in progress; opaque Zapier/Make logs unacceptable for compliance.

---

## Open Items & Caveats

### Phase 0 Blockers

1. **[HECHO CONFIRMADO: DATABASE_URL not yet set in Cloud Run]** — This blocks all database-backed routes (tasks.js, tasksOAuth.js, tasksSync.js) until provisioned. See Phase 0 in 04-roadmap.md. [Operator action: required before Phase 1 starts.]

### [DUDA ABIERTA] Items (TBD before Phase 1)

1. **Token Encryption Strategy** — pgp_sym_encrypt (requires pgcrypto extension, available?) vs application-layer AES-256? To be decided in 05-decisions.md ADR.
2. **Cloud Scheduler Service Account Permissions** — Requires explicit IAM role grant to invoke /sync/google-tasks/pull. See 04-roadmap.md Phase 1 for provisioning checklist.
3. **MCP Sidecar Placement** — Run in same Cloud Run container vs separate service? Trade-off: shared container = simpler deployment, separate = isolated crash domain. Decide in 05-decisions.md.

---

## Conclusion

**The Tareas module is operationally ready for Phase 0 → Phase 1 transition.** Technical barriers are **low** (proven patterns); risk is **medium** (DATABASE_URL provision is the sole critical blocker); business value is **high** (reduces manual task duplication across platforms).

**Recommended Path:**
1. **Phase 0 (now):** Schema design, route stubs, frontend scaffolds, docs ✅ **(in progress)**
2. **Phase 0 → Phase 1 transition:** Operator provisions DATABASE_URL in Cloud Run.
3. **Phase 1:** Implement OAuth, sync engine, conflict resolution.
4. **Phase 2–3:** Frontend polish, offline queue, e2e testing.
5. **Phase 4:** Production readiness, alerting, runbook.

**Sign-off:** Feasibility confirmed. Proceed to 01-architecture.md.

---

## Cross-References

- [[01-architecture.md]] — Detailed C4 diagram, schema, OAuth PKCE flow, polling strategy
- [[04-roadmap.md]] — Phase-by-phase breakdown, DATABASE_URL blocking item, time estimates
- [[05-decisions.md]] — ADRs for token encryption, MCP placement, polling vs middleware
- [[CLAUDE.md]] (line 124) — Note about DATABASE_URL and Sheets integration; same gap affects all modules
