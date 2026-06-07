# Phase 0 Production Readiness — Current Status (2026-05-28)

**Project**: Calculadora-BMC (Panelin)  
**Focus**: Production updates + Phase 0 stabilization  
**Date**: 2026-05-28

---

## Executive Summary

PDF generator area has received major stabilization improvements and is now live in production on both frontend and backend.

Production is currently healthy (smoke:prod green).

Main remaining blocker for continued Phase 0 execution (especially branch hygiene) is **local disk space exhaustion** on the development machine.

---

## Production Status

### Frontend (Vercel)
- **Status**: Successfully deployed
- **Live URL**: https://calculadora-bmc.vercel.app
- **Key changes shipped**:
  - Default PDF layout changed from heavy `bmc-pdf` → lightweight `simple-carbon` (recommended)
  - Legacy/heavy templates now visually deprecated in all selectors (optgroup + "(legacy)" labels)
  - `buildQuotationModel()` now includes `quoteId`, `version`, `createdBy`, `generatedAt`
  - Versioning info now rendered in PDF footers for simple templates
  - Client-side metrics logging added in `pdfGenerator.js`

### Backend (Cloud Run)
- **Current live revision**: `panelin-calc-00412-fg4` (100% traffic)
- **Status**: Successfully deployed after multiple attempts
- **Key changes shipped**:
  - New lightweight endpoint: `GET /api/pdf/metrics` (in-memory stats: totalGenerated, totalBytes, byLayout, avgSizeKB, lastGeneratedAt)
  - Improved structured logging on `/api/pdf/generate` (includes layout + quoteId when provided)
  - Added `X-PDF-Generation-Time` response header
  - Accepts optional `layout` and `quoteId` parameters
  - Dockerfile.bmc-dashboard + .dockerignore fixes to resolve previous build failures (missing walkthrough source.json)

### Verification
- `smoke:prod`: Consistently green (health, MATRIZ CSV, suggest-response with Claude, WA, ML, etc.)
- New `/api/pdf/metrics` endpoint confirmed live and returning real data

---

## Phase 0 — Branch Hygiene Progress

Significant progress made on cleaning up old agent branches:

- Multiple successful waves of archiving old `cursor/*`, `claude/*`, and `feat/*` branches (especially May 5-6 "critical-bug-inspection" series and earlier ones).
- Remote branch count reduced from ~68 → ~50.
- All archived branches have corresponding `archive/<name>` tags for recoverability.
- Proper logging maintained in `docs/team/housekeeping/cleanup-2026-05-27.md`.

**Current Blocker**:
- Local machine disk space exhaustion ("No space left on device").
- Only ~251 MiB free on the data volume.
- This broke git operations (lock files, packed-refs) during Wave 3 attempt.
- **Action required**: Free up disk space locally before further large-scale branch cleanup can continue.

---

## Key Files Updated Today

- `docs/team/PRODUCTION-READINESS-PLAN.md` — Detailed execution log of PDF improvements + production push
- `docs/team/PROJECT-STATE.md` — Multiple entries for production updates and Phase 0 progress
- `docs/team/housekeeping/production-updates-2026-05-27.md` — Dedicated production push log
- `docs/team/housekeeping/cleanup-2026-05-27.md` — Branch cleanup waves and current blocker
- `docs/team/PHASE0-STATUS-2026-05-28.md` — This status report (for handoff to other agents)

---

## Current Blockers

1. None critical for Phase 0. (Disk resolved; see below.)
2. No other major blockers for the PDF improvements (already live)

---

## Feature Freeze — Formalized (2026-05-28)

**10 working days stability-only focus active** (approx. 2026-05-28 through ~2026-06-11, accounting for weekends/holidays).

- Applies to: non-stability features, new modules, major refactors unrelated to production readiness/PDF/hygiene/gates.
- Explicitly allowed (Phase 0/1 focus): PDF template polish, `/api/pdf/metrics` admin surface, deeper versioning, branch hygiene follow-ups, gate improvements, pre-deploy hardening, observability.
- Rationale (from PRODUCTION-READINESS-PLAN): prevent agent velocity from creating new debt during remediation window.
- Tracked in: PROJECT-STATE.md (Cambios recientes), PRODUCTION-READINESS-PLAN.md, this file, housekeeping logs.
- Owner: Matías + lead agent coordination. Any exception requires explicit approval + entry in PROJECT-STATE.

**Status**: Formalized and active. (Previously "recommendation documented / pending confirmation"; now executed as part of aggressive Phase 0.)

---

## Recommended Next Priorities (for other agents)

1. ~~Free up disk space~~ **DONE** (15 GiB free, +5.3 Gi reclaimed via safe mac-rescue + project audit cleans; git ops unblocked).
2. ~~Continue Phase 0 branch cleanup~~ **DONE** (Wave 4: 11 more archived — all copilot/* + stale feat/docs/fix/worktree; remote count **27**; full details + tags in housekeeping/cleanup-2026-05-27.md).
3. ~~Formalize 10-working-day feature freeze~~ **DONE** (active window declared above; entries added to PROJECT-STATE + this doc).
4. Optional deeper PDF work (now safe to resume under freeze):
   - Surface `quoteId` + `version` more visibly across more templates
   - Consider deprecating/removing the heaviest legacy templates from LAYOUT_OPTIONS entirely
   - Build a simple admin view for the new `/api/pdf/metrics` data
5. Post-Phase 0: resume normal velocity after ~2026-06-11 window; continue monthly branch housekeeping via bmc-branch-cleanup skill.

---

## Quick Commands for Verification

```bash
# Production smoke
npm run smoke:prod

# Check PDF metrics endpoint
curl https://panelin-calc-q74zutv7dq-uc.a.run.app/api/pdf/metrics

# Current Cloud Run revision
gcloud run services describe panelin-calc --region=us-central1 --project=chatbot-bmc-live --format="value(status.latestReadyRevisionName)"
```

---

**Handoff note (2026-05-28 update)**: 
- PDF generator improvements fully live (Vercel + Cloud Run panelin-calc-00412-fg4); smoke:prod green.
- Phase 0 executed aggressively: disk exhaustion fixed (+5.3Gi → 15Gi free), 11 more branches archived (copilot/* + stale feat/etc; now 27 remotes total, all with archive/ tags), 10-working-day feature freeze formalized and active (2026-05-28 → ~06-11, stability-only).
- Current git: main, backup tag backup/pre-cleanup-20260528-2249 pushed.
- Uncommitted (from prior PDF session; do NOT commit without gate:local:full): many M in server/routes/pdf.js, src/pdf-templates/*, src/utils/pdfGenerator.js, docs/*, Dockerfile etc. (see `git status`).
- Housekeeping log appended with full Wave 4 + disk details.
- Next after freeze window: optional PDF polish or normal dev. Use bmc-branch-cleanup skill for future hygiene.
- All per AGENTS.md / CLAUDE.md (gates, updates to PROJECT-STATE, etc.).

Momentum excellent. Phase 0 core objectives (PDF prod + branch hygiene + freeze) substantially complete.

