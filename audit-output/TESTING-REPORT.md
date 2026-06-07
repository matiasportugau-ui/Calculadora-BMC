# TESTING-REPORT.md

**Project:** Calculadora-BMC  
**Date:** 2026-06-07

## Test Suite Overview
- **Core test files:** 61+ (from `find tests -name "*test*" -o -name "*spec*"`).
- Full list includes:
  - Identity/auth: identity-*.test.js (multiple), auth-routes.test.js, identity-security.test.js
  - Calculations & quotes: calc-routes.validation.js, calcLoopbackClient.test.js, quote*, roofVisualQuoteConsistency.js, verifiedQuotePayload.test.js
  - Integrations: ml-*.test.js, wa-*.test.js (config, rules, sla, webhooks, enricher, operator-auth), sheetsCsvGuard.test.js
  - Agent/AI: agentTools.test.js, agentChat*, suggestResponseKb*, rag.test.js, kb*, toolStats.test.js, policyLoader.test.js
  - Other: budget, chat-hardening, market-intel/* (5 files), pdf-*, traktime-contract, wolfboard-*, e2e-browser.mjs
- **Additional:** Playwright scripts (not in `npm test`), evals in separate private repo (calculadora-bmc-evals).

## Test Types Breakdown
- **Unit / pure logic:** calculations invariants, quote naming, phone normalize, budget, policy loader, roof visuals.
- **Integration (offline):** route validation, loopback client, identity flows (with shims), ML signature, WA contracts, Sheets CSV guard.
- **Contract / E2E-ish:** wa-pro tests (config, auth, rules, webhooks, SLA), panelinInternalApi, ml-etl-run-routes, auth-routes.
- **Browser/Playwright:** Separate scripts for wizard, admin cotizaciones flows, roof visuals (run ad-hoc or scheduled).
- **Golden / AI eval:** agentGolden/runner + separate evals repo (6-agent team, rubric scoring).

## Coverage Estimate
- **Unknown / not measured.** No coverage reports generated in `npm test`, `gate:local`, or CI visible.
- Rough assessment from structure:
  - Strong: auth/identity, calc loopback/contracts, WA module contracts, ML signatures, quote registry/dual-write, pricing CSV guards.
  - Gaps likely: full end-to-end quotation → Sheets → PDF → Drive flow under real auth; complex dimension edge cases (ISODEC au constants, multi-zone roofs); error paths in monolith startup; webhook signature enforcement when secrets present.
- Many tests explicitly skip when DB/Sheets/ML not configured (good for CI, means real integration coverage is environment-dependent).

## Flaky / Skipped / Issues
- No explicit "flaky" markers found in quick scan.
- The `npm test` command itself is fragile (single long `&&` chain in package.json — any failure aborts reporting of later suites).
- `test:api` (offline route tests) and many wa/identity tests are designed to run without live services.
- Playwright/browser tests are outside the core gate (intentional, but means UI regressions can slip).

## Missing Test Categories (from scope & known issues)
- Full webhook HMAC enforcement tests (positive + negative + "secret absent" behavior).
- Multi-replica / stateless OAuth state scenarios (currently in-memory).
- Production-like Cloud Run cold-start + worker initialization.
- Bundle size / lazy-loading regression for hub modules.
- End-to-end quote closing flow (WhatsApp/B2B, not Shopify).
- Relax-dev-auth attack surface.

## Recommendations
1. Replace the giant `npm test` chain with a proper runner (e.g. `node --test` or small script) that always produces summary + JUnit-style output.
2. Add coverage collection (c8 or vitest) for at minimum: pricing/calculations, identity/auth, signature libs, core calc routes. Gate on regression.
3. Promote critical browser flows (admin cotizaciones happy path, calculator wizard, PDF generation) into scheduled smoke or required gate.
4. Add dedicated tests for the two signature libs that assert "when secret present, bad signature → 401".
5. Track coverage % in CI and surface in AUDIT-SUMMARY updates.

**Current state:** Good breadth for a complex system with many integrations. Execution, visibility (coverage), and enforcement of security-critical paths (webhooks, state) are the main gaps.

---
*Cross-references: TECH-DEBT-REGISTER.md (brittle test runner item), package.json "test" script, tests/ directory listing.*
