# Productos Maestro — Production Readiness Tracker

**Goal Condition (from user):**  
Do everything needed to see Productos Maestro in production, 100% reviewed and verified before go-live.

**Feature:** Centralized price + stock management system (Productos Maestro)  
**Owner:** Matias + AI pair  
**Created:** 2026-06-01

---

## Definition of Done (Verifiable End State)

Productos Maestro is considered **in production and 100% reviewed/verified** when **ALL** of the following are true:

### 1. Technical Readiness
- [ ] All code merged to `main` (no critical branches open for this feature)
- [ ] `npm run gate:local:full` passes cleanly (lint + test + build)
- [ ] `npm run smoke:prod` passes (especially MATRIZ CSV + new `/api/productos-maestro*` endpoints)
- [ ] Real write-back works in production (MATRIZ + Stock sheet)
- [ ] No console errors or broken flows in production Vercel build
- [ ] New endpoints protected with correct RBAC (ventas read, admin write)

### 2. Operational Readiness
- [ ] New commands documented and working:
  - `npm run productos-maestro:reconcile`
  - `npm run productos-maestro:reconcile:json`
  - (Future) `npm run productos-maestro:mirror`
- [ ] Operator runbook exists (how to use the Maestro editor, when to write, safety rules)
- [ ] StockWebHint is live and useful when selecting "Precio Web"
- [ ] Pre-deploy checklist executed (see section below)

### 3. Documentation & Propagation
- [ ] `docs/team/PROJECT-STATE.md` has clear, up-to-date entry
- [ ] `AGENTS.md` lists all new commands with explanations
- [ ] `docs/google-sheets-module/planilla-inventory.md` updated with maestro tab / usage
- [ ] `server/agentCapabilitiesManifest.js` reflects the new surface
- [ ] Panelin agent / training KB knows about the new tools (if applicable)
- [ ] Capabilities snapshot refreshed (`npm run capabilities:snapshot`)

### 4. Review & Verification
- [ ] Code review completed (at minimum self-review + one other human or strong AI pass)
- [ ] Security review (auth, write permissions, audit logging)
- [ ] UX review (operator can safely edit + write without confusion)
- [ ] End-to-end verification run (local + prod smoke)
- [ ] No open critical or high bugs specific to this feature

### 5. Rollout & Handoff
- [ ] Feature announced / handed off to operators
- [ ] Rollback plan documented (if writes go wrong)
- [ ] Final sign-off recorded in this document

---

## Current Status (as of Turn 2 - 2026-06-01)

**Overall Progress:** ~68% (core solid, UI polish advancing, tooling verified, docs partial)

**Turn 2 Findings (Autonomous Execution):**
- Targeted lint on all Productos Maestro source files: **Clean** (0 errors from our code, only pre-existing warnings elsewhere).
- `npm run productos-maestro:reconcile`: Tool runs successfully and generates reports (returns empty as expected without full Sheets creds).
- `StockWebHint.jsx`: Small cleanups applied (removed unnecessary dependency warning, unused var).
- Working tree still has significant unrelated changes mixed in.
- No operator runbook exists yet.
- No dedicated prod smoke for the new surface.

**Turn 3 Findings (Autonomous Execution):**
- Created `.runtime/productos-maestro-feature-manifest.md` — canonical list of files that belong to this feature (critical for hygiene and reviews).
- Improved `StockWebHint.jsx`: Now shows 1-2 example product names when low-stock items exist (much more actionable for operators).
- `npm run gate:local` started in background as part of verification.
- Created first draft of Operator Runbook (`docs/OPERATOR-RUNBOOK-PRODUCTOS-MAESTRO.md`).
- Readiness tracker updated with latest reality.

**Turn 4–5 Findings (Automated Verification Wave):**
- Launched `npm run gate:local:full` (full local gate) in background — this is the authoritative local validation.
- Launched `npm run smoke:prod -- --json` in background — **completed successfully** against production.
- Direct prod verification: `GET /api/productos-maestro` returns 200 + real data (263 items, linksCount:0).
- **Major milestone:** Productos Maestro is already live and functional in production (Cloud Run).
- Created dedicated verification run log: `.runtime/productos-maestro-verification-run-2026-06-01.md`.
- All heavy automated verification runs are now executing in parallel where possible.

**Critical Update (2026-06-01):** Because the surface is already deployed and serving real data, the "get it into production" part of the goal has been partially achieved. Remaining work is now heavily weighted toward verification, operational readiness, documentation, hygiene, and formal review/sign-off.

**Key Artifacts Already Delivered:**
- `server/lib/productosMaestro.js`
- Full API surface (`/api/productos-maestro*`)
- `ProductosMaestroEditor.jsx` (with revert + diff highlighting + confirmation)
- `StockWebHint.jsx` (integrated in calculator + basic live data)
- `scripts/reconcile-productos-maestro.mjs`
- Real write execution wired to existing engines
- `.runtime/productos-maestro-full-run-plan.md`
- `PRODUCTOS_MAESTRO_PROD_READINESS.md` (this document)
- Updated AGENTS.md + PROJECT-STATE.md (initial)

**Remaining High-Priority Gaps (from tracker):**
- Working tree hygiene (isolate maestro changes)
- Dedicated production smoke test for maestro
- Operator runbook
- Mirror CSV script
- Formal review sign-off section
- Full re-run of `gate:local:full` in clean state
- Stronger StockWebHint (better data + UX)

---

## Pre-Deploy Checklist (Must be 100% before prod)

- [ ] Working tree clean or only maestro-related changes
- [ ] `npm run gate:local:full` (clean)
- [ ] `npm run smoke:prod -- --json` (passes)
- [ ] Manual verification of write flow in prod (with real token)
- [ ] All docs listed in section 3 updated
- [ ] Capabilities snapshot updated
- [ ] Operator runbook written and linked
- [ ] This tracker 100% green

---

## Sign-Off Section

**Final Verification Date:**  
**Reviewed By:**  
**Verified By:**  
**Go / No-Go Decision:**  

---

**This document is the single source of truth for this goal.**  
Update it after every significant turn. Do not declare victory until every checkbox above is genuinely complete and verified.
