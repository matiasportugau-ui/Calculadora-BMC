# CODE-REVIEW-AUDIT.md

**Project:** Calculadora-BMC  
**Date:** 2026-06-07  
**Method:** Static analysis + targeted file reads + structure scans. Every issue includes File | Line Number where possible.

## Security Issues

| File | Line Number | Severity | Description | Suggested Fix |
|------|-------------|----------|-------------|---------------|
| server/lib/whatsappSignature.js | 9 | High | `if (!appSecret) return { ok: true, skipped: true }` — HMAC verification silently disabled when secret missing. | Make secret mandatory in production; throw or 500 at startup if WHATSAPP_APP_SECRET empty in non-test. |
| server/lib/mlSignature.js | 19 | High | Identical skip pattern for MercadoLibre webhook. | Same as above. Add test that forces secret and asserts rejection of bad signatures. |
| server/index.js | 134-135 | High | `const oauthStates = new Map();` + TTL — in-memory only. Loses state across Cloud Run instances/restarts. | Persist to Supabase (see tasks/oauth_state pattern) or add sticky-session note + warning. |
| server/index.js | 500-502, 776-778 | High | When signature skipped: only a warn log. Request proceeds. | Return 401 or 503 when secret required but absent (except explicit test env). |
| server/config.js | 53 | Medium | `panelinRelaxDevAuth` flag skips API_AUTH_TOKEN on internal/agent surfaces. | Add hard guard: only allowed when APP_ENV=development; emit loud startup banner + metric. |
| tests/mlSignature.test.js | various | Low | Hardcoded test SECRET — fine for tests, but ensure never copied to prod paths. | Already isolated; add comment. |

## Performance Issues

| File | Line Number | Severity | Description | Suggested Fix |
|------|-------------|----------|-------------|---------------|
| src/components/PanelinCalculadoraV3_backup.jsx | 7235 lines | Medium | One of the largest files in the repo. Heavy 2D/3D roof + dimensioning logic. | Split into smaller modules (roof geometry, cota rendering, BOM separate). |
| src/components/RoofPreview.jsx | 4238 lines | Medium | Large 3D preview component. | Lazy-load three.js subtrees; memoize expensive calculations. |
| server/routes/bmcDashboard.js | 3603 lines | High | Massive route file handling Sheets, pricing, wolfboard, admin cotizaciones, etc. | Extract pricing engine, Sheets mappers, and admin logic into lib/. |
| server/lib/agentTools.js | 1759 lines | Medium | All AI tool definitions + calc loopback calls in one place. | Split by domain (calc tools, quote tools, knowledge tools). |
| server/index.js | 1196 lines + many side effects at startup | High | Monolith + cron/worker starts + in-memory maps. | Extract webhook processors, workers, and state into dedicated modules/services. |

## Correctness / Edge Cases

| File | Line Number | Severity | Description | Suggested Fix |
|------|-------------|----------|-------------|---------------|
| server/index.js | 135 | Medium | `oauthStates` Map has no cross-instance invalidation or persistence. | Already noted in security. |
| src/App.jsx | 35 | Low | Uses legacy backup import for main calculator (`PanelinCalculadoraV3_backup.jsx`). | Confirm canonical is the backup or rename; remove _legacy_inline and backup files. |
| server/routes/calc.js + utils/calculations.js | various | Medium | Complex dimension-based pricing (ISODEC au=1.12m etc.). Known bugs tracked in evals (BUG-001, BUG-004) in separate repo. | Ensure golden cases in main repo cover the au constants and IVA application. |

## Maintainability Issues

| File | Line Number | Severity | Description | Suggested Fix |
|------|-------------|----------|-------------|---------------|
| server/index.js | 1-78 (import block) + 91-150 (setup) | High | 30+ route imports + side-effect workers (WA SLA, followups, transportista outbox, traktime mirror, marketIntel scheduler, etc.). | Decompose into feature modules or use a registry pattern. |
| "docs 2/" (18 files) | N/A | Medium | Stale duplicate copies of AGENTS.md, ARCHITECTURE, etc. | Delete or move to `.archive/` with clear README. |
| package.json "test" script | N/A | Medium | One giant `node a && node b && ...` (dozens of tests). | Replace with a small runner script that reports summary and continues on non-fatal failures. |
| Multiple Dockerfiles + complex .dockerignore history | N/A | Medium | Past production 404 (Finanzas dashboard) due to fragile negations. | Keep strict allow-list .dockerignore; add context inspection step to pre-deploy. |

## Other Observations
- Good patterns: pino + pino-http, timingSafeEqual in signatures, raw body for webhooks, lazy loading in App.jsx for hub modules, dual auth evolution.
- Browser-specific crash recently fixed (Safari/WebKit ReferenceError in DetailDrawer) — indicates need for more WebKit testing.

**Total issues catalogued:** 15+ with direct file/line references. See TECH-DEBT-REGISTER.md for scored prioritization.

---
*All claims backed by live reads/greps (server/index.js, lib/*Signature.js, config.js, App.jsx, file counts).*
