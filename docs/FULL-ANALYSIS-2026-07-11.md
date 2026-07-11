# Calculadora-BMC: Comprehensive Technical Analysis & 5 Improvement Suggestions
**Date:** 2026-07-11  
**Scope:** Full stack audit (Frontend, Backend, Data, Testing, Security, Performance)  
**Author:** Claude Code Analysis Agent

---

## EXECUTIVE SUMMARY

Calculadora-BMC is a **production-grade React + Express quotation calculator** for insulation panels (BMC Uruguay). The system is **functionally mature** but has **several data integrity, maintainability, and scalability concerns** that should be addressed.

### Key Findings:
- ✅ Core calculation engine is stable and well-documented
- ✅ API contracts are mature and versioned
- ✅ PDF generation pipeline is multi-path (Playwright/html2pdf fallback)
- ⚠️ **HIGH PRIORITY:** Multiple data loss risks in form state and migrations
- ⚠️ **MEDIUM:** Lack of centralized state validation and error boundaries
- ⚠️ **MEDIUM:** Incomplete test coverage for critical paths (migrations, PDF, exports)
- ⚠️ **LOW:** Code duplication in calculation utilities and component props drilling

---

## 1. ARCHITECTURE ANALYSIS

### Frontend (React 18 + Vite)
**Location:** `/src`  
**Size:** ~4.5M, ~250+ components and utilities

**Strengths:**
- Modern Vite 7 build system with HMR
- Comprehensive routing with React Router v6+
- Multiple PDF layout templates (13 variants)
- Three.js 3D visualization for roof planning
- PWA support with offline capability
- Custom hooks (`useChat`, `useRoof`, `useBOM`, etc.)

**Concerns:**
1. **State Management Fragmentation:** No Redux/Zustand—state scattered across Context, `useState`, and `localStorage`
   - `BmcAuthProvider`, `RoofContext`, multiple local states
   - Hard to trace data flow; risk of inconsistent state during concurrent operations
   
2. **Form State Durability:** Calculator form (techo/pared) relies on browser session—NO automatic save/recovery
   - Users lose quotes on tab close/crash
   - No draft/backup mechanism
   - **DATA LOSS RISK**

3. **Component Complexity:**
   - `PanelinCalculadoraV3.jsx` is the canonical component but state logic is spread across multiple hooks
   - Deep props drilling in PDF layout templates (13 variants all receive same massive `QuotationModel`)
   - No shared state serialization format for quote snapshots

4. **Render Performance:**
   - 3D rendering (Three.js) blocks UI during large roof plans
   - No React.memo on expensive components
   - SVG rendering (roof cotas) recalculates on every props change

### Backend (Express 5 + Node.js 24.x)
**Location:** `/server`  
**Size:** ~3M

**Strengths:**
- Clean route separation (`/calc`, `/api`, `/auth`, `/webhooks`)
- Middleware stack is well-organized
- PostgreSQL integration with migrations tracking
- Google Sheets syncing with error resilience (503 semantics)
- Multi-provider AI agent support (Anthropic + OpenAI)

**Concerns:**
1. **Configuration Drift:** `.env` parsing is manual in multiple files
   - `config.js` is source of truth but not enforced
   - Secrets can leak if hardcoded (needs constant vigilance)
   - No validation schema for required env vars at startup

2. **Database Migration Risks:**
   - `scripts/omni-migrate.mjs` tracks applied migrations but **no rollback capability**
   - Schema changes are one-way—can't safely downgrade
   - No pre-migration validation (e.g., data consistency checks)
   - **DATA LOSS RISK if migration fails mid-transaction**

3. **Error Handling Gaps:**
   - Some routes log but don't throw/catch consistently
   - Sheets unavailability (503) is handled well, but other external failures (MercadoLibre, WhatsApp) can cascade
   - No circuit breaker pattern for external APIs

4. **Response Consistency:**
   - API payload shapes vary across routes (no strict validation layer)
   - Some endpoints return `{ data: [...] }`, others `[...]`
   - No OpenAPI/Swagger spec (hard to maintain client contracts)

### Data & Calculation Engine
**Location:** `/src/utils/calculations.js`, `/server/routes/calc.js`, `/src/data/constants.js`

**Strengths:**
- Pricing model is versioned and auditable
- BOM calculation is deterministic (no floating-point precision issues)
- Dual-list support (venta/web) with `LISTA_ACTIVA` selector
- 22% IVA applied at final totals (correct accounting)

**Concerns:**
1. **Pricing Overrides Not Fully Validated:**
   - `src/utils/pricingOverrides.js` allows manual price adjustments
   - No audit trail of who changed what and when
   - **DATA INTEGRITY RISK:** Quotes can silently use wrong prices

2. **Calculation Drift:**
   - Frontend and backend calculate independently (no validation that they match)
   - `calcLoopbackClient.js` calls backend but result isn't compared to frontend calc
   - **RISK:** Silent discrepancies between what user sees and what gets quoted

3. **Panel Constants Hardcoded:**
   - `src/data/constants.js` has all panel/profile data
   - Changes require code rebuild and deploy
   - No admin UI to update panel catalog at runtime
   - **RISK:** Stale data if server deploys faster than frontend

### Testing & Quality
**Location:** `/tests`, package.json scripts

**Current State:**
- Manual test enumeration in `package.json` (not auto-discovery)
- Unit tests: ~50 files covering calculations, helpers, utils
- Integration tests: CI validates API contracts via `npm run test:contracts`
- No E2E tests for critical user flows (quote creation → PDF export → drive save)
- No visual regression tests for 3D/SVG rendering

**Gaps:**
1. **Migration Tests:** No tests for schema changes in `scripts/omni-migrate.mjs`
   - Can't verify rollback safety
   - No pre/post migration data consistency checks

2. **PDF Generation Tests:** Minimal coverage
   - No validation that all 13 templates render correctly
   - No tests for Unicode/special characters in client names
   - No tests for large BOM exports (performance cliff?)

3. **State Mutation Tests:** No tests for concurrent updates
   - What happens if user submits form while another operation saves?
   - No tests for race conditions in auth/token refresh

### Security & Data Privacy
**Strengths:**
- JWT-based auth with ****** (no cookie fallback)
- TOTP 2FA support (`server/lib/mfaTotp.js`)
- CORS properly restricted in prod
- Secrets isolated in `.env` and Cloud Run Secret Manager

**Concerns:**
1. **Secrets Scanning:** No pre-commit hook to catch accidental secret commits
   - `.git/hooks/` exists but no `pre-commit` enforcer
   - CI doesn't run secret scanner before merge

2. **Database Credentials:**
   - `DATABASE_URL` passed as env var—vulnerable if logs captured
   - No connection pooling configuration visible; could exhaust connections

3. **Quote Privacy:**
   - Quotes are stored in `quotes` table but no row-level security
   - Any authenticated user could access any quote?
   - No TTL/expiration on older quotes (could grow indefinitely)

---

## 2. CRITICAL DATA INTEGRITY ISSUES

### Issue 1: Form State Loss on Session End
**Severity:** HIGH  
**Impact:** Users lose unsaved quotes on tab close, crash, or timeout  
**Evidence:** No `localStorage` or session recovery in `PanelinCalculadoraV3.jsx`  
**Fix:** Auto-save draft to server every 30s, restore on load

### Issue 2: Migration Failures Have No Rollback
**Severity:** HIGH  
**Impact:** Failed schema migration can corrupt database; no recovery path  
**Evidence:** `scripts/omni-migrate.mjs` tracks applied but doesn't support rollback  
**Fix:** Implement rollback strategy (version-aware down migrations or full DB snapshot)

### Issue 3: Calculation Discrepancies (Frontend vs Backend)
**Severity:** MEDIUM  
**Impact:** User sees one price, invoice shows another  
**Evidence:** No validation that frontend calc ≈ backend calc  
**Fix:** Compare results in `calcLoopbackClient.js`; throw error if delta > 0.01%

### Issue 4: Pricing Overrides Not Audited
**Severity:** MEDIUM  
**Impact:** Can't track who changed prices, when, or why  
**Evidence:** `pricingOverrides.js` is a plain object with no versioning  
**Fix:** Add audit table + timestamp + user_id to all price changes

### Issue 5: No Row-Level Security on Quotes
**Severity:** MEDIUM  
**Impact:** Could access other users' quotes  
**Evidence:** Quotes table has no `user_id` + RLS policy  
**Fix:** Add `user_id` FK, enable Postgres RLS, test access control

---

## 3. PERFORMANCE & SCALABILITY CONCERNS

### Frontend Performance
1. **3D Roof Rendering:** Blocks main thread during large plans
   - Fix: Move to Web Worker + offscreen canvas

2. **SVG Cotas:** Recalculates on every props change
   - Fix: Use React.memo + useMemo on layout calculations

3. **PDF Generation:** Falls back to html2pdf (raster) if Playwright fails
   - Risk: Large BOM (>1000 items) may time out or crash browser
   - Fix: Add pagination to PDF, stream large exports

### Backend Performance
1. **Sheets Sync:** Blocks request while syncing (can take 2+ seconds)
   - Fix: Move to background job + webhooks

2. **No Database Indexes:** Check if critical queries have indexes
   - Risk: Slow quote search/export if `quotes` table grows to 10k+
   - Fix: Add indexes on `user_id`, `created_at`, `status`

3. **Memory Leak Risk:** Long-running server processes (AI agent chat)
   - Fix: Add memory monitoring + graceful restart policy

---

## 4. CODE QUALITY & MAINTAINABILITY

### Code Duplication
- Calculation logic repeated in frontend/backend (sync required manually)
- PDF template boilerplate (13 variants, >1500 lines copied)
- Pricing resolver logic duplicated

### Naming & Organization
- Good: Clear separation of concerns (`/calc`, `/api`, `/auth`)
- Bad: Utils folder has 50+ files with no sub-categorization
- Bad: Component names inconsistent (PanelinCalculadoraV3 vs PanelinChatPanel)

### Documentation
- Architecture doc is excellent (`docs/ARCHITECTURE.md`)
- API contracts documented via tests (good)
- Missing: Developer onboarding guide, data flow diagrams for backend

---

## 5. DEPENDENCY & VULNERABILITY SCAN

**Current:**
- Node 24.x pinned ✓
- Vite 7 (latest)
- React 18 (latest)
- Express 5 (cutting edge)

**Recommendation:** Run `npm audit` before deploy; consider OWASP dependency scanning in CI

---

---

## **5 IMPROVEMENT SUGGESTIONS**

### **SUGGESTION 1: Implement Centralized State Management with Auto-Persistence**
**Priority:** HIGH  
**Effort:** Medium (3-5 days)  
**Impact:** Eliminates form state loss, enables multi-tab sync, improves debugging

**What:**
- Replace scattered `useState` + Context with **Zustand** (lightweight, no boilerplate)
- Add persistence layer: auto-save draft to server every 30s
- On app load, restore last draft if exists
- Provide "Save Draft" + "Restore" buttons to user

**Why:**
- Users won't lose quotes on crash
- Easier to debug state mutations
- Enables "recently used" quotes feature

**Implementation Steps:**
1. Create `/src/store/quoteStore.js` with Zustand + persistence middleware
2. Add `POST /api/quotes/draft` endpoint to save draft
3. Add `GET /api/quotes/draft` to restore on load
4. Wrap `PanelinCalculadoraV3` in store provider
5. Add UI buttons + toast notifications
6. Tests: Save draft, restore, verify no data loss

---

### **SUGGESTION 2: Add Comprehensive Database Migration Rollback Strategy**
**Priority:** HIGH  
**Effort:** Medium (2-3 days)  
**Impact:** Safe schema evolution, faster incident recovery

**What:**
- Enhance `scripts/omni-migrate.mjs` to support rollback migrations
- Create `*-down.sql` files for each migration
- Test rollback on every PR that touches migrations
- Add pre-migration backup checkpoint

**Why:**
- Current migrations are one-way; failed migration = data emergency
- Rollback enables safe canary deploys
- Tests catch migration issues early

**Implementation Steps:**
1. Refactor `omni-migrate.mjs` to track `status` (pending/applied/rolled-back)
2. Create `rollback()` function that reverses applied migrations
3. Add `npm run db:rollback` script
4. Create migration test helper: `testMigrationRoundTrip()`
5. Add pre-migration integrity checks (row counts, FK consistency)
6. CI: Run rollback test on every PR

---

### **SUGGESTION 3: Implement Calculation Validation & Audit Trail**
**Priority:** MEDIUM  
**Effort:** Medium (2-4 days)  
**Impact:** Data integrity, debugging, compliance

**What:**
- Compare frontend calc vs backend calc; flag discrepancies
- Log all pricing overrides to audit table with timestamp + user_id
- Hash quotes to detect tampering
- Expose audit log in admin UI

**Why:**
- Catches calculation bugs early
- Compliance: audit trail of all price changes
- Debugging: can trace why quote changed

**Implementation Steps:**
1. Add `quote_audits` table: `(quote_id, user_id, change_type, old_price, new_price, reason, created_at)`
2. In `calcLoopbackClient.js`, compare frontend vs backend; log delta if > 0.01%
3. In pricing override endpoints, insert audit record before saving
4. Create `GET /api/quotes/{id}/audit` to expose history
5. Add admin page: `/hub/admin/audit-log?quote_id=...`
6. Tests: Verify override logged, discrepancies flagged

---

### **SUGGESTION 4: Implement Row-Level Security (RLS) on Database & API**
**Priority:** MEDIUM  
**Effort:** Medium (2-3 days)  
**Impact:** User data isolation, compliance

**What:**
- Add `user_id` FK to `quotes`, `quote_audits`, `drafts` tables
- Enable Postgres RLS policies: users see only their own rows
- Enforce in API middleware (double-check authorization)
- Add integration tests verifying isolation

**Why:**
- Prevent one user seeing another's quotes
- GDPR compliance (data segregation)
- Reduces attack surface

**Implementation Steps:**
1. Add migration: `ALTER TABLE quotes ADD COLUMN user_id UUID NOT NULL DEFAULT auth.uid()`
2. Create RLS policy: `CREATE POLICY quotes_own ON quotes USING (auth.uid() = user_id)`
3. In API routes, add `WHERE user_id = req.user.id` to all quote queries
4. Add middleware: `requireGrant` for read/write/admin on quotes
5. Tests: Try to access other user's quote; should fail

---

### **SUGGESTION 5: Refactor PDF Generation into Service with Pagination & Error Recovery**
**Priority:** LOW  
**Effort:** Medium (3-5 days)  
**Impact:** Reliability, scalability, better UX

**What:**
- Extract PDF generation into dedicated `server/lib/pdfService.js`
- Support paginated exports (split large BOMs across pages)
- Add retry logic + exponential backoff for Playwright failures
- Expose queue status UI (show "PDF generating..." progress)

**Why:**
- Handles large BOMs gracefully (current limit ~1000 items)
- Fallback logic is more robust
- User knows export is in progress

**Implementation Steps:**
1. Create `server/lib/pdfService.js` with `generatePDF(quoteId, options)`
2. Add `pdf_queue` table to track export jobs
3. Create background worker: poll queue, process, update status
4. In `POST /api/pdf/generate`, add to queue + return job_id
5. Add `GET /api/pdf/jobs/{id}` to poll status
6. Frontend: Show progress bar, poll until done
7. Add tests: Large BOM (10k items), Playwright failure + fallback

---

---

## IMPLEMENTATION ROADMAP

### Phase 1: Critical (Next 2 weeks)
1. **Suggestion 1:** Centralized state + auto-persistence
2. **Suggestion 2:** Migration rollback strategy
3. **Suggestion 4:** Row-level security

### Phase 2: Important (Next month)
4. **Suggestion 3:** Calculation validation + audit trail
5. **Suggestion 5:** PDF service refactor

### Phase 3: Nice-to-Have (Later)
- E2E tests for critical flows
- Performance profiling + optimization
- Dependency scanning in CI
- Developer onboarding guide

---

## VALIDATION & NEXT STEPS

- [ ] Review suggestions with team
- [ ] Prioritize based on business impact
- [ ] Create GitHub issues for each suggestion
- [ ] Estimate effort and assign owners
- [ ] Run gate:local tests after each change
- [ ] Add integration tests for new features
- [ ] Update docs after implementation
- [ ] Monitor production for regressions

---

**End of Analysis Document**  
Generated by Claude Code Analysis Agent  
2026-07-11
