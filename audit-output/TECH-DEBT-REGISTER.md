# TECH-DEBT-REGISTER.md

**Project:** Calculadora-BMC  
**Date:** 2026-06-07  
**Auditor:** Grok (terminal build session)  
**Status:** Final

All items discovered via static analysis, file counts, live scans, and confirmed issues from session transcript. Prioritization formula: **Priority Score = (Impact + Risk) × (6 - Effort)**. Higher score = higher priority.

| Title | Description / Current State | Impact (1-5) | Risk (1-5) | Effort (1-5) | Priority Score | Owner | Business Justification |
|-------|-----------------------------|--------------|------------|--------------|----------------|-------|------------------------|
| Monolithic server/index.js (1196 lines) | Single 1196-line entrypoint imports/mounts 30+ routers + side-effect initializers (WA workers, identity, MFA, SLA, followups, marketIntel scheduler, etc.). Routes, middleware, business logic mixed. See server/index.js:1-150 (imports), 134-137 (in-memory oauthStates Map), 485+ (webhook handlers). | 5 | 5 | 4 | 30 | Backend lead (Matias + specialist) | High blast radius: any bug/deploy affects calculator, all channels (ML/WA/Shopify), AI agent, identity, tasks. Slows refactoring/testing. Blocks independent scaling of AI vs public calc. |
| In-memory OAuth state | `const oauthStates = new Map();` + `stateTtlMs` in server/index.js:134-135. Used for ML/WA/Tasks/identity flows. Breaks on Cloud Run multi-instance / cold starts. | 4 | 5 | 2 | 36 | Backend | Security + reliability: state loss causes OAuth failures, replay risks, broken logins for operators. Confirmed gap in session transcript. |
| Webhook HMAC skipped when secret absent | whatsappSignature.js:9 (`if (!appSecret) return {ok:true, skipped:true}`); mlSignature.js:19 (same). Mounted in index.js:768-778 (WA) and 490-502 (ML). Warns in prod but accepts unsigned payloads. | 4 | 5 | 2 | 36 | Security owner | Direct attack surface for forged webhooks (ML questions, WA messages). Matches "ML webhook lacks HMAC", "WhatsApp HMAC skipped when secret absent" in confirmed issues. |
| Documentation fragmentation & sprawl | 1023 .md files (29MB) in docs/ + 18 stale duplicates in "docs 2/". No clear index. docs/team/ (451) + dev-trace/ (382) dominate (agent meta-system). See docs structure scan. | 3 | 4 | 3 | 21 | Docs / Knowledge owner | Onboarding tax, contradictory knowledge, high maintenance on every change. "docs 2/" is visible unfinished cleanup. Makes architecture hard to discover. |
| Brittle test execution (giant && chain) | `npm test` = one 50+ `node ... && node ...` line in package.json. No coverage, no summary, first failure aborts. 61+ test files exist (tests/ + market-intel/). | 3 | 4 | 2 | 24 | CI/Test owner | Flaky gates, hidden regressions in pricing/calc/auth. Slow feedback. Confirmed "no visible test coverage reports". |
| Legacy backup/duplicate calculator files | src/components/PanelinCalculadoraV3_backup.jsx (7235 lines), _legacy_inline.jsx still present. Largest src files. | 2 | 3 | 1 | 15 | Frontend | Dead code risk, confusion during refactors, bundle bloat potential. Indicates incomplete migration. |
| Inconsistent / relaxed dev auth | server/config.js:53 (`panelinRelaxDevAuth`), warned in index.js:85-88. Skips API_AUTH_TOKEN on powerful /api/internal/* and agent surfaces. | 3 | 4 | 2 | 21 | Security | Easy to misconfigure in staging/prod. Broad internal surfaces (panelinInternal, presupOrchestrator). |
| Multiple semi-independent sub-packages in monorepo | shop-chat-agent/ (full Node+Prisma+Docker, 316KB), wa-package/, transportista-cursor-package, traktime-package. Separate lifecycles inside one git repo. | 3 | 3 | 3 | 18 | Architecture owner | Drift risk (Shopify vs ML paths), complex Docker contexts (past Finanzas 404 from .dockerignore fragility), unclear ownership. |
| Moderate dependency vulns (react-router open redirect) | npm audit: react-router 6.x moderate (GHSA-2j2x-hqr9-3h42, protocol-relative redirect). hono transitive moderates. | 2 | 3 | 2 | 12 | Dependencies | Open redirect in operator hub / admin flows. History of xlsx high vuln (recently fixed via CDN). |
| Large/complex components (frontend) | RoofPreview.jsx (4238 lines), BmcLogisticaApp (2483), AgentAdminModule (2169), BmcWaCockpit (1320). Heavy state + 3D/PDF logic. | 3 | 3 | 3 | 18 | Frontend | Maintainability, re-render perf, testing difficulty. Safari/WebKit crash fixed recently (commit 849f802, onOpenBorrador ReferenceError in DetailDrawer). |

**Sorted by Priority Score descending.** Top items (36) are the immediate "must fix" for security/reliability.

**Legend / Notes:**
- Impact: Business/user impact if exploited or left alone.
- Risk: Likelihood of incident or slowdown.
- Effort: 1=days, 5=months+.
- All items traceable to live scans (server/index.js lines, signature libs, npm audit, file counts).

---
*Generated per BMC Calculadora Audit transcript. Cross-links: CODE-REVIEW-AUDIT.md, SECURITY-AUDIT.md, IMPROVEMENTS-ROADMAP.md*
