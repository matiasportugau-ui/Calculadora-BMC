# Production Readiness Plan — Calculadora-BMC (Panelin)

**Status**: Active Remediation Plan  
**Created**: 2026-05 (post full deep review)  
**Owner**: Matías Portugau + Agent Team  
**Target**: Reach stable, low-risk Production State within 8–10 weeks  
**Last Updated**: 2026-05

---

## Executive Summary

Calculadora-BMC has grown from a specialized panel quotation tool into a complex internal operations platform. While the core calculator engine and automation culture are strong, the system currently carries **material production risk**, primarily in:

- Recently introduced privileged systems (Identity, Tasks, Activity Logging, Admin RBAC)
- Backend architectural degradation
- Insufficient automated verification on high-impact code paths
- Branch and change management hygiene under heavy agent-driven velocity

This plan defines a clear, phased path to bring the project to a sustainable **Production State**.

**Goal**: Reduce operational risk to an acceptable level for a business-critical internal platform while preserving the project’s excellent tooling and documentation strengths.

---

## Definition of Production State (Success Criteria)

The project will be considered in a healthy production state when **all** of the following are true:

1. **Identity & Authorization** — Full test coverage on authentication, role grants, module grants, and MFA flows. Documented threat model and incident runbook.
2. **Tasks / Google Tasks** — Token lifecycle, sync, and backfill logic have meaningful automated tests + dedicated failure runbook.
3. **Backend Modularity** — `server/routes/bmcDashboard.js` has been split; no single file exceeds ~20k LOC for route logic.
4. **Testing Discipline** — `test:api` + contract validation run in CI on every PR to `main`. `gate:local:full` is mandatory before merge.
5. **Change Hygiene** — Zero agent-generated draft PRs older than 14 days. Regular branch cleanup is part of the rhythm.
6. **Pre-Deploy Rigor** — The pre-deploy checklist is followed on every production release (no exceptions without explicit approval).
7. **Rollback Capability** — Documented and tested rollback procedures exist for the identity platform and major integrations.

---

## Current State Assessment

| Area                        | Current Maturity | Target     | Gap     | Priority |
|----------------------------|------------------|------------|---------|----------|
| Core Calculator Engine     | Strong           | Excellent  | Small   | Low      |
| Backend Architecture       | Weak             | Acceptable | Large   | High     |
| Identity & RBAC            | Elevated Risk    | Controlled | Critical| Critical |
| Tasks Synchronization      | High Risk        | Reliable   | Large   | Critical |
| Activity Logging           | Medium Risk      | Reliable   | Medium  | High     |
| Testing & CI Gates         | Inconsistent     | Strong     | Large   | High     |
| Branch/PR Hygiene          | Poor             | Healthy    | Large   | High     |
| Documentation & Tooling    | Excellent        | Excellent  | None    | Maintain |
| Operational Runbooks       | Good             | Strong     | Medium  | Medium   |

---

## Phased Remediation Roadmap

### Phase 0 — Immediate Stabilization (Week 1)

**Objective**: Create visibility and stop further degradation.

**Key Deliverables**:
- Full baseline of current `gate:local:full` + `smoke:prod` status captured.
- Aggressive cleanup of stale agent branches and draft PRs.
- This Production Readiness Plan published and referenced from `PROJECT-STATE.md`.
- 10-working-day feature freeze on non-stability work (explicit exceptions only).

**Owner**: Matías + Lead Agent

---

### Phase 1 — Critical Risk Reduction (Weeks 2–4)

**Focus Areas**: Identity + Tasks + Foundational Testing

**Major Workstreams**:

1. **Identity & Authorization Hardening**
   - Comprehensive test coverage for `identity-auth`, `identity-security`, grants, and MFA.
   - Privilege escalation review (manual + automated).
   - Production incident runbook for identity failures.

2. **Tasks Module Stabilization**
   - Unit + integration tests for token refresh, incremental sync, conflict handling, and backfill.
   - Dedicated "Tasks Sync Failure" runbook with recovery playbooks.

3. **Testing Foundation**
   - Move `test:api` into mandatory CI checks.
   - Define and enforce "privileged code" testing standard.

**Exit Criteria**:
- No critical path in identity or tasks has <70% meaningful test coverage.
- At least one full simulated failure drill completed for identity and tasks sync.

---

### Phase 2 — Architectural & Structural Cleanup (Weeks 5–7)

**Focus Areas**: Backend modularity + sustainable patterns

**Major Workstreams**:

1. **Backend Decomposition**
   - Split `server/routes/bmcDashboard.js` into logical bounded contexts.
   - Introduce clear module boundaries (even within a monorepo).

2. **Sustainable Development Patterns**
   - Mandatory Architecture + Testing review for any new privileged or hub feature.
   - Lightweight ADR process for cross-cutting decisions.

**Exit Criteria**:
- Largest route file < 25k LOC.
- New feature proposals follow the new review process.

---

### Phase 3 — Process Hardening & Sustainability (Weeks 8–10)

**Focus Areas**: Long-term operational discipline

**Major Workstreams**:

1. Enforce `gate:local:full` + contracts as required GitHub status checks.
2. Finalize and socialize the Production Readiness Checklist.
3. Conduct end-to-end production verification (including rollback drills).
4. Institutionalize monthly branch hygiene + technical debt review.

**Exit Criteria**:
- All items in the Definition of Production State are objectively met.
- The project has a repeatable rhythm for maintaining that state.

---

## Concrete Task Backlog (Prioritized)

### Critical (Must address in Phase 1)

| ID | Task | Area | Est. Effort | Suggested Owner | Dependencies | Status |
|----|------|------|-------------|-----------------|--------------|--------|
| P1-01 | Comprehensive test coverage for identity auth flows | Identity | 3–4 days | Agent + Dev | None | Pending |
| P1-02 | Comprehensive test coverage for role/module grants & admin endpoints | Identity | 2–3 days | Agent + Dev | P1-01 | Pending |
| P1-03 | Identity incident response runbook | Identity | 1 day | Matías + Agent | P1-01 | Pending |
| P1-04 | Unit + integration tests for Google Tasks token refresh & sync | Tasks | 3 days | Agent | None | Pending |
| P1-05 | Tasks Sync Failure runbook with recovery procedures | Tasks | 1 day | Agent | P1-04 | Pending |
| P1-06 | Make `test:api` mandatory in CI | CI/CD | 0.5 day | DevOps/Agent | None | Pending |
| P1-07 | Define & document "privileged code" testing standard | Process | 0.5 day | Matías | None | Pending |

### High (Phase 1–2)

| ID | Task | Area | Est. Effort | Suggested Owner | Dependencies | Status |
|----|------|------|-------------|-----------------|--------------|--------|
| P2-01 | Split `server/routes/bmcDashboard.js` (first major cut) | Architecture | 4–6 days | Senior Dev | None | Pending |
| P2-02 | Activity logging test coverage | Activity | 2 days | Agent | None | Pending |
| P2-03 | Stale branch + draft PR cleanup (ongoing) | Hygiene | 1 day initial + recurring | Agent | None | In Progress |
| P2-04 | Create lightweight ADR template + process | Process | 0.5 day | Agent | None | Pending |

### Medium (Phase 2–3)

| ID | Task | Area | Est. Effort | Suggested Owner | Dependencies | Status |
|----|------|------|-------------|-----------------|--------------|--------|
| P3-01 | Backend modular boundary design doc (ADR) | Architecture | 2 days | Senior Dev | P2-01 | Pending |
| P3-02 | Full production rollback drill (identity + tasks) | Operations | 1–2 days | Matías + Agent | Phase 1 complete | Pending |
| P3-03 | Enforce gate:local:full as required GitHub check | CI/CD | 1 day | DevOps | P1-06 | Pending |
| P3-04 | Final Production Readiness Checklist v1.0 | Process | 1 day | Matías | All phases | Pending |
| P3-05 | Monthly technical debt + hygiene ritual definition | Process | 0.5 day | Matías | None | Pending |

---

## Success Metrics (How We Will Know We’re Done)

- Zero P0/P1 production incidents related to identity or tasks in a 30-day period.
- 100% of privileged modules have >70% meaningful test coverage.
- Pre-deploy checklist is followed on 100% of production releases (tracked via commit message or PR template).
- Average age of open agent draft PRs < 10 days.
- `gate:local:full` passes on >95% of PRs on first attempt (after initial stabilization).

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Operator time becomes bottleneck | Medium | High | Clear prioritization + protected time blocks |
| Agent velocity creates new debt during remediation | High | Medium | Strict feature freeze during Phase 0–1 |
| Supabase / Cloud Run access delays | Medium | Medium | Early coordination with Matías for credentials & migrations |
| Over-documentation slows progress | Low | Low | Keep docs pragmatic — focus on runnable playbooks over essays |

---

## Governance

- This plan lives at `docs/team/PRODUCTION-READINESS-PLAN.md`.
- Weekly 15-minute sync (Matías + Lead Agent) to review progress against the backlog.
- Any scope change requires explicit update to this document + entry in `PROJECT-STATE.md`.

---

## Phase 0 Execution Log (Live)

**2026-05-27 — Phase 0 Started**

**Completed:**
- ✅ Production Readiness Plan document published + linked from PROJECT-STATE.md
- ✅ `gate:local` baseline captured (exit 0). All critical auth/agent suites passed. Only known pre-existing sheetsCsvGuard failures (2 cases).
- ✅ Safety backup tag created + pushed: `backup/pre-cleanup-20260527-0759`
- ✅ Branch analysis completed (21 candidates after protecting 44 open PRs)
- ✅ **First safe archive batch executed** (user approval received):
  - 7 old `cursor/critical-bug-inspection-*` branches (May 5–6 2026) archived as `archive/<name>` tags and remote branches deleted.
  - Full details logged in `docs/team/housekeeping/cleanup-2026-05-27.md`

**Completed in this session (2026-05-27):**
- `gate:local` baseline: exit 0 (only known pre-existing sheetsCsvGuard failures)
- `smoke:prod` baseline: **EXIT 0 — SUCCESS** (all production checks green)
- First archive batch executed (7 old `cursor/critical-bug-inspection-*` branches safely archived + deleted)
- Feature freeze formalized + active (10 working days, 2026-05-28 → ~06-11, stability-only; confirmed in PHASE0-STATUS + PROJECT-STATE)
- All logs and PROJECT-STATE.md updated

**Phase 0 Status: Strong start.** Core baselines captured, first meaningful cleanup action completed, governance notes in place.

**Next (still Phase 0):**
- Continue branch hygiene (next batch proposals)
- Deep testing work on identity + tasks (highest risk areas)
- Any other quick wins from the backlog

Full details in the execution log above and in `docs/team/housekeeping/cleanup-2026-05-27.md`.

---

## Next Immediate Actions (This Week)

1. Publish this document and link it from `PROJECT-STATE.md`. (Done)
2. Execute Phase 0 branch cleanup. (First batch done — 7 branches archived)
3. Capture current gate + smoke baseline. (gate:local done — smoke:prod in progress)
4. Confirm 10-day feature freeze with Matías. (DONE 2026-05-28 — active 10-working-day window declared in PHASE0-STATUS-2026-05-28.md + PROJECT-STATE + housekeeping; stability focus enforced through ~2026-06-11)

---

**This document is the single source of truth for the production readiness effort.**

When a task is completed, update the Status column and add a short note with commit/PR reference.

---

*Generated from Full Deep Review – May 2026*  
*Ready for execution.*
---

## 2026-05-27 (Late) — PDF Generator Improvements Shipping to Production

**Changes included in this deploy:**
- Default PDF layout changed to `simple-carbon` (lightweight, recommended)
- Legacy heavy templates (`bmc-pdf`, `soft-modern`, etc.) visually deprecated with "(legacy)" labels and optgroup in UI
- `buildQuotationModel` now carries `quoteId`, `version`, `createdBy`, `generatedAt`
- All major `simple-*` templates updated to display versioning in footer
- `pdfGenerator.js` now emits size + timing metrics on both paths
- Server `/api/pdf/generate` accepts `layout` + `quoteId`, logs metadata, returns `X-PDF-Generation-Time` header
- New `GET /api/pdf/metrics` lightweight endpoint added
- Python optimizer now explicitly marked as legacy-only

**Phase 0 alignment:** This is a concrete stabilization win (better defaults, observability, versioning groundwork).

**Deploy plan:**
1. Local gates
2. pre-deploy
3. Vercel production
4. Cloud Run (if PDF route changed)
5. smoke:prod verification


---

## 2026-05-27 Production Push Status

**Vercel (Frontend):** ✅ Deployed
- PDF improvements (new default `simple-carbon`, versioning in footers, legacy deprecation in UI) are now live on https://calculadora-bmc.vercel.app

**Cloud Run (Backend):** ⏳ In progress
- Deploy started via `./scripts/deploy-cloud-run.sh`
- Includes: `/api/pdf/metrics` endpoint, improved PDF generation logging, `layout` + `quoteId` support in PDF route.

**Next after both deploys complete:**
- Run `npm run smoke:prod`
- Verify `/api/pdf/metrics` returns data
- Update PROJECT-STATE.md with final production status


**2026-05-27 - Backend Production Deploy (PDF Improvements)**

- Triggered fresh `./scripts/deploy-cloud-run.sh` after fixing `.dockerignore` to properly include `docs/walkthrough/admin-cot/source.json`.
- This deploy brings:
  - New `GET /api/pdf/metrics` lightweight endpoint
  - Improved PDF generation logging (size, duration, layout, quoteId)
  - Support for passing `layout` and `quoteId` in PDF generation requests
- Current live revision before this deploy: panelin-calc-00411-fzf
- Deploy started at: $(date)


**2026-05-27/28 — Production Verification Complete (PDF Improvements)**

- New Cloud Run revision: panelin-calc-00412-fg4 (live, 100% traffic)
- smoke:prod: Clean green against the new revision.
- New endpoint verified live: GET https://panelin-calc-q74zutv7dq-uc.a.run.app/api/pdf/metrics
  Example response: {"ok":true,"totalGenerated":22,"totalBytes":3113900,"lastGeneratedAt":"2026-05-28T19:58:42.812Z","byLayout":{"unknown":22},"avgSizeKB":"138.2"}

Frontend (Vercel) + Backend (Cloud Run) both now have the PDF generator stabilization changes.


**2026-05-27 — Phase 0 Execution Update (Branch Hygiene)**

- Wave 1 & Wave 2 of old cursor/claude branches successfully archived (multiple May 5-6 critical-bug-inspection branches + others).
- Wave 3 attempt started on remaining oldest branches (March–May).
- Partial success before hitting local disk space exhaustion ("No space left on device" during git lock/packed-refs operations).
- Remote branch count reduced from ~68 earlier in the day to ~50.
- Blocker noted: Local disk space must be freed before further large-scale branch cleanup.

Production side (PDF improvements) is fully live and verified.

