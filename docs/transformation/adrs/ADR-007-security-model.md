# ADR-007: Security Model Hardening

**Status:** Proposed  
**Date:** 2026-06-22  
**Deciders:** Security Architecture  
**Related:** [09-security-model.md](../09-security-model.md)

---

## Context

Security scores **50/100 — Functional**:

**Strengths:** JWT + RBAC + MFA, HMAC webhooks (ML/WA/Shopify), rate limiting, CSP on Vercel

**Gaps:**
- `POST /api/crm/suggest-response` unauthenticated
- Many unauthenticated Sheets GET routes (factual)
- SSRF protection NOT_FOUND
- Zod validation PARTIAL

**Evidence:**
- Source: `docs/discovery/07-security-map.md`, `docs/discovery/09-scorecard.md` §Security
- Section: SSRF NOT_FOUND; suggest-response open
- Reasoning: `bmcDashboard.js` L2311 — no auth middleware on suggest-response

---

## Decision

**Phase H1 (immediate, parallel to omni foundation):**

1. **Auth on suggest-response:** `requireCrmCockpitRead` minimum (or `requireServiceOrUser`)
2. **SSRF allowlist** for outbound HTTP from agents/tools: block RFC1918, metadata IPs; allowlist BMC API, ML API, known webhooks
3. **Prompt injection mitigations:** customer content in user role only; system prompt immutable; no tool execution on raw ingest classify
4. **Webhook replay protection:** timestamp + nonce in HMAC payload where channel supports; reject >5min skew
5. **RBAC on all `/api/omni/*`:** `requireGrant('canales', 'read'|'write')`
6. **Secrets:** Doppler canonical; no new secrets in code; rotate on omni ingest webhook creation

**Threat model documented** in [09-security-model.md](../09-security-model.md) with mitigations per STRIDE category.

---

## Alternatives Considered

| Alternative | Rejected because |
|-------------|------------------|
| **Status quo until omni launch** | suggest-response is live prod attack surface |
| **API key only for all CRM** | Breaks operator JWT UX |
| **Full WAF on all GET Sheets** | Breaking change for public calc flows — scope separately |
| **Disable AI suggest entirely** | Business value loss |

---

## Consequences

**Positive:**
- Closes highest-risk open endpoint before omni expands surface
- SSRF protection before automation `webhook_outbound` action

**Negative:**
- Breaking change for unauthenticated GPT/cron callers of suggest-response — must use Bearer token

---

## Risks

| Risk | Mitigation |
|------|------------|
| Legitimate integrators break on auth | Document migration; deprecate window 30d |
| SSRF allowlist too tight | Configurable via env; audit denied URLs |
| Over-restrictive RBAC blocks operators | Default grants for canales module |

---

## Rollback Strategy

1. Feature flag `CRM_SUGGEST_REQUIRE_AUTH=0` (emergency only, logged)
2. SSRF middleware bypass flag for dev only
3. Per-route auth revert via git revert of H1 PR

---

## References

- [07-security-map.md](../../discovery/07-security-map.md)
- [requireGrant.js](../../../server/middleware/requireGrant.js)
