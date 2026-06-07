# SECURITY-AUDIT.md

**Project:** Calculadora-BMC  
**Date:** 2026-06-07  
**Scope:** Static code review + config + dependency scan (no external pentest or runtime DAST performed).

## Secrets Audit
- **Result:** No hardcoded production secrets found in committed source (server/, src/, scripts/).
- Grep for patterns (API_KEY, SECRET, PASSWORD, private_key, sk-, AIza, BEGIN RSA) returned only:
  - Test constants (e.g. `tests/mlSignature.test.js`: `const SECRET = "test-client-secret-abc123";`, `tests/panelinInternalApi.test.js`: test tokens).
  - Comments and env references (`process.env.*`).
- **Positive:** Secrets are loaded via `server/config.js` from environment (DATABASE_URL, ML_CLIENT_SECRET, WHATSAPP_APP_SECRET, IDENTITY_JWT_SECRET, etc.).
- **Risk:** Many config values default to `""`. If a secret is unset, signature verification is explicitly **skipped** (see below).
- **Recommendation:** Enforce non-empty checks + startup fail-fast for critical secrets in production (beyond current warnings).

## OWASP Top 10 Assessment (2021)

| Category | Status | Evidence / Files | Details |
|----------|--------|------------------|---------|
| A01:2021 – Broken Access Control | At risk | server/index.js:134 (`oauthStates = new Map()` in-memory); requireAuth shim (server/middleware/requireAuth.js → requireServiceOrUser.js); config.panelinRelaxDevAuth | Dual-mode auth (API token or JWT) is an improvement. But in-memory state + relax-dev flag + broad internal routes (/api/internal/panelin, presupOrchestrator) create gaps. RBAC (RequireGrant) present in frontend for hub modules. |
| A02:2021 – Cryptographic Failures | At risk | whatsappSignature.js:9 and mlSignature.js:19 (`if (!secret) return {ok: true, skipped: true}`) | HMAC implemented with timingSafeEqual + replay window (good). But secrets optional → verification skipped in prod (logs warning only). See index.js:776-778 (WA), 500-502 (ML). |
| A03:2021 – Injection | Not vulnerable (current) | pino + structured logging; raw body for webhooks; no obvious SQL string concat in main paths (uses pg + prepared in tasks/wa). | Google Sheets (primary CRM) is the bigger injection surface historically. |
| A04:2021 – Insecure Design | At risk | In-memory OAuth state + webhook event buffers; monolith concentration | Design assumes single-instance or sticky sessions. Multi-replica Cloud Run will lose state. |
| A05:2021 – Security Misconfiguration | At risk | PANELIN_RELAX_DEV_AUTH; many empty defaults in config.js; "docs 2/" stale; no visible CSP in backend (Vercel has good headers) | Relax flag documented with warning but easy to leave on. |
| A06:2021 – Vulnerable & Outdated Components | Moderate | npm audit (3 moderate): react-router open redirect (GHSA-2j2x-hqr9-3h42); hono transitive issues. History of xlsx high (fixed via CDN tarball). | react-router used heavily in hub/admin. |
| A07:2021 – Identification & Auth Failures | At risk | In-memory oauthStates; skipped webhook HMAC when secret absent; WA verify token can be empty (`config.whatsappVerifyToken`) | Confirmed in session transcript and live code. GET /webhooks/whatsapp still does token compare. |
| A08:2021 – Software & Data Integrity Failures | Low | Good use of timingSafeEqual in signatures; auto-learn + training KB has some safeguards. | No unsigned code execution paths found. |
| A09:2021 – Security Logging & Monitoring Failures | Partial | pino + pino-http used (good); some console.log still in agent/superAgent paths. Webhook events buffered in-memory (max 250). | Structured logs present but not all paths (see CODE-REVIEW). |
| A10:2021 – Server-Side Request Forgery (SSRF) | Not vulnerable (current) | No obvious unvalidated outbound fetches in main paths. | Google/Sheets/ML clients use configured endpoints. |

## Authentication & Authorization Review
- **Evolution:** Old `requireAuth` (token-only) shimmed to dual `requireServiceOrUser` (API_AUTH_TOKEN **or** valid identity JWT). Good.
- **RBAC:** `RequireGrant` component + `requireGrant` middleware for module-scoped grants (read/write/admin). Used on admin export, tasks, quotes.
- **Identity:** Supabase Auth + custom /auth/google + TOTP MFA (server/routes/authMfa.js, identity* routes). JWT + cookies.
- **Gaps:**
  - In-memory state for OAuth (multiple flows: ML, Tasks, Google identity).
  - Webhook verification is best-effort (skips silently on missing secret).
- **Files:** server/lib/identityAuth.js, server/config.js:196-199 (identityJwtSecret), src/contexts/BmcAuthProvider.jsx.

## API Security Review
- Webhooks correctly use raw body middleware (index.js:116-120).
- Rate limiting intentionally omitted on /webhooks/whatsapp (Meta retries; see comment).
- CORS allow-list (config + chrome-extension:// support for WA cockpit).
- `app.disable("x-powered-by")`; basic security headers.
- No rate limiting visible on public /calc or /api/agent/chat surfaces in quick scan (budgeting exists for chat but soft).

## Dependency Vulnerability Scan
- **Current (npm audit --audit-level=moderate):** 3 moderate.
  - react-router / react-router-dom: open redirect via // path.
  - hono (transitive?): several (IP bypass, cookie injection, JWT scheme, mount prefix).
- Historical: xlsx high (Prototype Pollution + ReDoS) remediated by switching to CDN tarball (good).
- **Recommendation:** Pin + `npm audit fix` where safe; track react-router upgrade (major change).

## Recommendations & Remediation Plan (tied to TECH-DEBT-REGISTER)
1. **Critical (P0):** Make webhook secrets mandatory in production (fail startup or hard 401). Remove skip path or make it test-only.
2. **Critical (P0):** Replace in-memory `oauthStates` Map with Supabase/Postgres (or Redis) with TTL. See tasks/oauth_state table as precedent.
3. **High:** Enforce non-empty critical secrets + log/alert on relax-dev in non-dev.
4. **Medium:** Add explicit HMAC tests to CI for both ML and WA signature libs (tests/mlSignature.test.js exists; expand).
5. **Medium:** Upgrade react-router (or add redirect validation middleware).

**No critical (P0) vulns undocumented.** The main issues are design/operational (skipped verification, in-memory state) rather than classic injection or secret leaks in code.

---
*Cross-references: TECH-DEBT-REGISTER.md (items with score 36), CODE-REVIEW-AUDIT.md, server/lib/*Signature.js, server/index.js:134-137 & webhook handlers.*
