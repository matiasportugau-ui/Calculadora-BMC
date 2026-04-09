# PR Backlog Audit & Prioritized Implementation Roadmap

**Date:** 2026-04-09  
**Scope:** All 22 open pull requests in `matiasportugau-ui/Calculadora-BMC`  
**Project phase:** Phase 2 (~35–45% completion), Cloud Run + Vercel operational

---

## Summary

22 open PRs audited. 8 are duplicates/obsolete (close immediately). 2 are security-critical. 5 are test-only. 7 are feature PRs requiring rebase. Plan reduces backlog to 0 in 6 phases over ~10 working days.

---

## A. Security & Critical Fixes — MERGE IMMEDIATELY

| PR | Title | Status | Mergeable | Action |
|----|-------|--------|-----------|--------|
| **#34** | Fix Sheets auth (ADC), null-safety, shell exit codes, strict 404 | ✅ Approved | Clean | Rebase onto `main` (currently targets `sheets-verify-config-b29b9`), merge |
| **#48** | Bump picomatch 4.0.3→4.0.4 (CVE-2026-33671/33672) | Ready | Unstable (CI fail) | Fix CI lint/test failures, merge |

## B. Test Coverage — HIGH PRIORITY

| PR | Title | Focus |
|----|-------|-------|
| **#52** | scenarioOrchestrator regression tests | `executeScenario()` guard rails, techo_fachada |
| **#51** | knowledge parsing + roof 3D layout tests | `parseRssItems`, `pickTier`, `clamp01` |
| **#49** | MATRIZ EPS price normalization tests | `ISODEC_EPS` roof vs `ISOPANEL_EPS` wall venta |
| **#29** | Calculator GPT API flow integration tests | Camera scenario, freight, PDF generation |
| **#28** | Calc API regression (camera, freight, PDF) | `/calc/cotizar`, `/calc/cotizar/pdf`, `/calc/pdf/:id` |

All test-only, no production code. PRs #28/#29 potentially overlap — consolidate. All are drafts from Cursor automation.

## C. Integrations — MEDIUM PRIORITY

| PR | Title | Status | Notes |
|----|-------|--------|-------|
| **#30** | Meta Social API skill (WA/IG/FB) | Ready | Docs-only (2 files). Has sub-PRs #31 & #32 (pick one, close other) |
| **#31** | Clarify Meta webhook signatures | Draft, sub-PR of #30 | Consolidate into #30 |
| **#32** | Clarify META_WEBHOOK_SECRET alias | Draft, sub-PR of #30 | Consolidate into #30 |
| **#18** | MercadoLibre API token (Phase 1 OAuth) | Draft, dirty | 3245+ lines. Deep conflicts. Security audit needed |

## D. Agent Tooling — LOW PRIORITY (consolidate first)

| PR | Title | Action |
|----|-------|--------|
| **#45** | Chat de equipo interactivo (most complete) | ✅ Keep — rebase, merge |
| **#44** | Chat interactivo (dup) | ❌ Close |
| **#43** | Chat interactivo (dup) | ❌ Close |
| **#42** | Chat interactivo (dup) | ❌ Close |
| **#38** | CEO AI Agent (most complete) | ✅ Keep — rebase, merge |
| **#37** | CEO AI Agent (dup) | ❌ Close |
| **#36** | CEO AI Agent (dup) | ❌ Close |
| **#35** | CEO AI Agent (dup) | ❌ Close |
| **#39** | Full team notification | Review — 10 files, project state updates |

## E. Product Feature — SCHEDULED

| PR | Title | Status | Scope |
|----|-------|--------|-------|
| **#47** | Simulacro: spec management + bid presentation PDF | Draft, dirty | 1400+ lines, 12 files. New views + API endpoints |

## F. Legacy/Stale — CLOSE

| PR | Title | Action |
|----|-------|--------|
| **#14** | Copilot/generate-branch-merge-plan | ❌ Close — superseded by current `src/` modular structure |

---

## Implementation Phases

### Phase 0: Housekeeping (Day 1)
1. ~~Close 8 duplicate/obsolete PRs: #14, #35, #36, #37, #42, #43, #44, and one of #31/#32~~ *(pending — requires GH web UI or CLI)*
2. ~~Label remaining PRs by category~~ *(pending)*
3. ✅ Update PROJECT-STATE.md

### Phase 1: Security & Critical Fixes (Day 1–2) ✅ DONE
1. ✅ Applied **#34** fixes — Sheets auth ADC, null-safety, shell exit codes, strict 404 contract
2. ✅ Applied **#48** — picomatch 4.0.3→4.0.4 (CVE-2026-33671/33672)
3. ~~Run `npm run smoke:prod`~~ *(requires production credentials)*

### Phase 2: Test Coverage (Day 2–3) ✅ DONE
1. ✅ Compared #28 vs #29 — #28 adds `calc-routes.validation.js` (separate file), #29 modifies `npm test` — adopted #28 approach
2. ✅ Applied #49 (SUITE 23b matrizCsvNormalization), #51 (SUITE 34+35 knowledge/3D), #52 (SUITE 33 scenarioOrchestrator)
3. ✅ Tests: 284→315 unit + 17 API route, 0 failures

### Phase 3: Integrations (Day 3–5)
1. Merge **#30** + consolidated webhook doc fix
2. Rebase **#18** (ML OAuth), security audit, contract tests
3. Verify OAuth flow E2E

### Phase 4: Agent Tooling (Day 5–7)
1. Rebase & merge **#45** (chat equipo)
2. Rebase & merge **#38** (CEO agent)
3. Merge **#39** (full team notification)

### Phase 5: Product Feature (Day 7–10)
1. Rebase **#47** (simulacro/bid presentation)
2. Full review: `generateBidPresentationHTML()`, `BidPresentation.jsx`, team-assist API
3. E2E verify: `npm run dev` → `#presentacion-licitacion` → PDF

### Phase 6: Validation & Closure (Day 10)
1. `npm run gate:local:full` + `npm run test:contracts` + `npm run smoke:prod`
2. Update PROJECT-STATE.md + SESSION-WORKSPACE-CRM.md
3. Verify 0 open PRs

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PR #18 deep merge conflicts | High | Medium | Incremental rebase + test after each resolution |
| PR #47 regression in calculator | Medium | High | Full E2E + smoke after merge |
| PR #48 CI failures unrelated to picomatch | Medium | Low | Verify if failures exist on main |
| Stale branches drifted from main | High | Medium | Rebase early per phase |

---

## Metrics

| Metric | Value |
|--------|-------|
| Total open PRs | 22 |
| Close (duplicate/stale) | 8 |
| Merge after review | 13 |
| Consolidate first | 1 |
| Security-critical | 2 |
| Test-only (safe) | 5 |
| Require rebase | 5 |
| Estimated effort | ~27 hours / 10 days |
| Target: open PRs | 0 |
