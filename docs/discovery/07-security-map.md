# Phase 7 — Security Inventory

**Audit:** EXPORT_SEAL::OMNI_HUB_DISCOVERY_MASTER_V1  
**Date:** 2026-06-22  
**Repo SHA:** `d04a7f4`  
**Cross-links:** [03-api-map](03-api-map.md) · [06-ai-map](06-ai-map.md)

---

## Summary

| Control | Status |
|---------|--------|
| JWT identity | **IMPLEMENTED** |
| RBAC module grants | **IMPLEMENTED** |
| MFA TOTP | **IMPLEMENTED** |
| HMAC webhooks | **IMPLEMENTED** |
| Rate limiting | **IMPLEMENTED** (broad) |
| SSRF protection | **NOT_FOUND** (calc loopback only) |
| Input validation (Zod) | **PARTIAL** |
| CSP / security headers | **IMPLEMENTED** (Vercel edge) |

---

## JWT

| Item | Location | Purpose | Status |
|------|----------|---------|--------|
| Issue/verify | `server/lib/identityAuth.js` | Access 15min, refresh 30d | **IMPLEMENTED** |
| Claims | `identityAuth.js` L115–120 | `iss`, `aud`, `sub`, grants | **IMPLEMENTED** |
| Google OAuth login | `server/routes/authGoogle.js` | Identity bootstrap | **IMPLEMENTED** |
| Refresh rotation | `server/routes/authGoogle.js` L143 | Token refresh | **IMPLEMENTED** |
| Frontend context | `src/contexts/BmcAuthProvider.jsx` | SPA auth state | **IMPLEMENTED** |
| Route guard | `src/components/auth/RequireGrant.jsx` | UI RBAC | **IMPLEMENTED** |

**Evidence:**

- File: `server/lib/identityAuth.js`  
  Path: `/Users/matias/calculadora-bmc/server/lib/identityAuth.js`  
  Lines: 1–17  
  Description: JWT module header and exports.

---

## RBAC

| Item | Location | Purpose | Status |
|------|----------|---------|--------|
| `requireGrant.js` | `server/middleware/requireGrant.js` | Module + minLevel checks | **IMPLEMENTED** |
| `requireUser()` | `identityAuth.js` | JWT validation middleware | **IMPLEMENTED** |
| `requireServiceOrUser()` | `server/middleware/requireServiceOrUser.js` | API token OR user JWT | **IMPLEMENTED** |
| `requireCrmCockpitAuth` | `server/middleware/requireCrmCockpitAuth.js` | CRM cockpit dual auth | **IMPLEMENTED** |
| `requireWaAccess` | `server/routes/wa.js` L26–51 | WA hybrid auth | **IMPLEMENTED** |
| Module catalog | `identityAuth.js` L27–38 | `canales`, `wa`, `ml`, etc. | **IMPLEMENTED** |
| DB grants | `identity.module_grants` | Persistent grants | **IMPLEMENTED** |

**Evidence:**

- File: `server/middleware/requireGrant.js`  
  Lines: 30–39  
  Description: Wraps `requireUser({ module, minLevel })`.

---

## HMAC / webhook signatures

| Surface | File | Header / mechanism | Status |
|---------|------|-------------------|--------|
| ML webhooks | `server/lib/mlSignature.js` | ML HMAC | **IMPLEMENTED** |
| WhatsApp webhooks | `server/lib/whatsappSignature.js` | `x-hub-signature-256` | **IMPLEMENTED** |
| Shopify webhooks | `server/routes/shopify.js` L34–51 | Shopify HMAC | **IMPLEMENTED** |
| Google Tasks sync | `server/routes/tasksSync.js` L496–505 | `X-Sync-Signature` | **IMPLEMENTED** |
| WA outbound webhooks | `server/lib/waWebhooks.js` L66 | Payload HMAC | **IMPLEMENTED** |
| Generic verify token | `WEBHOOK_VERIFY_TOKEN` | Optional query param | **IMPLEMENTED** |

**Evidence:**

- File: `server/index.js`  
  Lines: 534–548, 815–826  
  Description: ML and WA webhook signature enforcement.

- File: `server/index.js`  
  Lines: 151–154  
  Description: Raw body parser for WA HMAC.

**Note:** HMAC skipped when secret unset (dev mode) — documented in ML path.

---

## Rate limiting

Uses `express-rate-limit` on multiple surfaces:

| Route file | Limiter | Purpose |
|------------|---------|---------|
| `authGoogle.js` L39, L48 | auth + refresh | Brute-force mitigation |
| `agentChat.js` L298–313 | public + devMode | Chat abuse |
| `agentVoice.js` L34, L44 | session + action | Voice API |
| `agentTranscribe.js` L25 | transcribe | Whisper cost |
| `wa.js` | outbound | WA send abuse |
| `identityMe.js`, `identityAdmin.js` | admin ops | Identity protection |
| `mlSearch.js` | 60 req/min | Search API |
| `planInterpret.js` | upload | Plan interpret |
| `teamAssist.js` | chat | Team assist |

**Evidence:**

- File: `server/routes/agentChat.js`  
  Lines: 298–313  
  Description: `publicLimiter` 10/min, `devModeLimiter` 30/min.

**Intentional exception:**

- File: `server/index.js`  
  Lines: 653–655  
  Description: WA inbound webhook not rate-limited (HMAC instead).

**Status:** **IMPLEMENTED**

---

## SSRF protection

| Item | Location | Status |
|------|----------|--------|
| General outbound URL validator | — | **NOT_FOUND** |
| Calc loopback restriction | `server/lib/calcLoopbackClient.js` L4–8 | **PARTIAL** (127.0.0.1 only) |
| User-supplied URL fetch guard | — | **NOT_FOUND** |

**Evidence:**

- File: `server/lib/calcLoopbackClient.js`  
  Path: `/Users/matias/calculadora-bmc/server/lib/calcLoopbackClient.js`  
  Lines: 4–8  
  Description: Agent tools call calc via `127.0.0.1:${port}` only.

- Grep `ssrf` under `server/`  
  Description: **NOT_FOUND**

---

## Validation layers

| Layer | File | Scope | Status |
|-------|------|-------|--------|
| Quote payloads | `server/lib/quotePayloadValidator.js` | Agent chat/voice actions | **IMPLEMENTED** |
| WA ingest | `server/lib/waValidate.js` | Extension batch | **IMPLEMENTED** |
| WA config | `server/lib/waConfigSchema.js` | Zod runtime config | **IMPLEMENTED** |
| Email extraction | `bmcDashboard.js` L104–117 | Zod parse/ingest | **IMPLEMENTED** |
| ML query params | `server/index.js` L424–438 | Allowlist | **IMPLEMENTED** |
| Model ID allowlist | `agentChat.js` L66–73 | Regex | **IMPLEMENTED** |
| Global request validation | — | **NOT_FOUND** |

---

## MFA

| Route | Auth | Status |
|-------|------|--------|
| `POST /api/auth/mfa/enroll` | requireUser | **IMPLEMENTED** |
| `POST /api/auth/mfa/verify` | requireUser | **IMPLEMENTED** |
| `POST /api/auth/mfa/disable` | requireUser | **IMPLEMENTED** |
| `POST /api/auth/mfa/challenge` | — | **IMPLEMENTED** |

**Evidence:**

- File: `server/routes/authMfa.js`  
  Path: `/Users/matias/calculadora-bmc/server/routes/authMfa.js`  
  Lines: 85–271  
  Description: MFA routes.

- File: `server/lib/mfaTotp.js`  
  Description: TOTP implementation.

---

## Edge security (Vercel)

| Control | File | Status |
|---------|------|--------|
| CSP headers | `vercel.json` L32–58 | **IMPLEMENTED** |
| API proxy to Cloud Run | `vercel.json` L6–18 | **IMPLEMENTED** |

---

## Open / unauthenticated endpoints (factual inventory)

These routes exist without auth middleware — documented for audit, not as recommendations:

| Method | Path | File | Risk surface |
|--------|------|------|--------------|
| POST | `/api/crm/suggest-response` | bmcDashboard.js L2311 | AI cost/abuse |
| GET | `/api/agent/ai-options` | agentChat.js L99 | Info disclosure |
| GET | `/api/agent/tool-stats` | agentChat.js L110 | Info disclosure |
| POST | `/api/agent/voice/action` | agentVoice.js L228 | Voice actions |
| POST | `/api/internal/presup/run` | presupOrchestrator.js L31 | Internal orchestrator |
| GET | `/api/actualizar-precios-calculadora` | bmcDashboard.js L2287 | MATRIZ CSV (public by design) |
| Most GET `/api/cotizaciones`, stock, ventas | bmcDashboard.js | Sheets read (network trust) |

**Evidence:**

- File: `scripts/smoke-prod-api.mjs`  
  Description: Smoke calls `suggest-response` without token — confirms public behavior.

---

## Security status matrix

| Layer | Location | Purpose | Status |
|-------|----------|---------|--------|
| JWT | identityAuth.js | Session auth | IMPLEMENTED |
| RBAC | requireGrant.js | Module access | IMPLEMENTED |
| requireGrant | middleware | Hub route protection | IMPLEMENTED |
| HMAC | mlSignature, whatsappSignature, shopify, tasksSync | Webhook integrity | IMPLEMENTED |
| Rate limiting | Multiple route files | Abuse mitigation | IMPLEMENTED |
| SSRF | — | Outbound URL safety | NOT_FOUND |
| Validation | Zod in WA, email, quotes | Input sanity | PARTIAL |
| MFA | authMfa.js | 2FA | IMPLEMENTED |
