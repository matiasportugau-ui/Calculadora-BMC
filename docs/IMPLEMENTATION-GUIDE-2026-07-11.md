# Calculadora-BMC: Implementation Guide for 5 Improvement Suggestions
**Date:** 2026-07-11  
**Status:** 3 of 5 suggestions implemented ✅

---

## IMPLEMENTATION SUMMARY

This document outlines all **5 improvement suggestions** with their implementation status, usage instructions, and next steps.

---

## ✅ COMPLETED IMPLEMENTATIONS

### 1️⃣ **Suggestion 2: Database Migration Rollback Strategy** [IMPLEMENTED]

**Purpose:** Enable safe schema evolution with rollback capability

**What was added:**
- Enhanced migration manager: `scripts/omni-migrate-enhanced.mjs`
- Features:
  - Forward/backward migration tracking
  - Pre-migration validation (detects unsafe DROP/TRUNCATE)
  - Down migration support (paired `*.down.sql` files)
  - Batch-based rollback mechanism
  - Real-time migration status dashboard

**New Files:**
- `scripts/omni-migrate-enhanced.mjs` — Enhanced migration runner
- `server/migrations/omni/020_pricing_audit_system.sql` — Pricing audit table
- `server/migrations/omni/021_quotes_row_level_security.sql` — RLS setup

**New npm Scripts:**
```bash
npm run omni:migrate:enhanced      # Apply pending migrations (safer than original)
npm run omni:migrate:status        # Show migration history and status
npm run omni:migrate:rollback      # Rollback last N migrations
npm run omni:migrate:rollback -- --rollback 3  # Rollback last 3 migrations
npm run omni:migrate:rollback -- --force       # Override safety checks
```

**Usage Example:**
```bash
# Check current status
npm run omni:migrate:status

# Apply new migrations with validation
npm run omni:migrate:enhanced

# Safely rollback if something goes wrong
npm run omni:migrate:rollback -- --rollback 1
```

**Key Features:**
- ✅ Detects unsafe SQL (unguarded DROP TABLE, bulk DELETE)
- ✅ Tracks row count changes before/after
- ✅ Supports `.down.sql` rollback files
- ✅ Batch-based grouping for group rollback
- ✅ Transactional safety (automatic ROLLBACK on error)

**Next Steps:**
1. Create `.down.sql` rollback files for existing migrations
2. Test rollback on non-prod first
3. Gradually migrate to enhanced system

---

### 2️⃣ **Suggestion 3: Pricing Audit Trail & Calculation Validation** [IMPLEMENTED]

**Purpose:** Track all price changes and flag calculation discrepancies

**What was added:**
- Pricing audit system: `server/lib/pricingAudit.js`
- API routes: `server/routes/pricingAudit.js`
- Database migration: `server/migrations/omni/020_pricing_audit_system.sql`
- Test suite: `tests/pricingAudit.test.js`

**Features:**
- Record all pricing overrides with user ID, timestamp, reason
- Flag discrepancies between frontend/backend calculations
- Generate audit reports by date range
- Mark discrepancies as resolved with explanation
- Admin audit log access

**API Endpoints:**
```
GET  /api/audit/pricing/quote/:quoteId         — Get audit trail for quote
GET  /api/audit/pricing/report                 — Generate audit report
GET  /api/audit/pricing/discrepancies          — List unresolved discrepancies
PATCH /api/audit/pricing/:auditId/resolve      — Mark discrepancy resolved
```

**Usage in Code:**
```javascript
// Record a price override
await recordPricingOverride(
  userId,
  "quote",
  quoteId,
  "Quote #001",
  1000,    // old price
  1100,    // new price
  "Client negotiation"
);

// Flag calculation discrepancy
await recordCalculationDiscrepancy(
  quoteId,
  frontendTotal,  // 1000.00
  backendTotal,   // 1000.50
  calculationHash
);

// Get audit trail
const trail = await getPricingAuditTrail("quote", quoteId);

// Generate report
const report = await getPricingAuditReport(
  new Date("2026-01-01"),
  new Date("2026-07-11")
);
```

**Database Schema:**
```sql
CREATE TABLE pricing_audits (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  entity_type TEXT,          -- 'quote', 'line_item', etc
  entity_id UUID,
  change_type TEXT,          -- 'override', 'bulk_update', 'calculation_discrepancy'
  old_value NUMERIC(12,2),
  new_value NUMERIC(12,2),
  delta NUMERIC(12,2),
  percentage_change NUMERIC(5,2),
  reason TEXT,
  status TEXT,               -- 'recorded', 'discrepancy_flagged', 'resolved'
  created_at TIMESTAMPTZ,
  ...
);
```

**Run Tests:**
```bash
node tests/pricingAudit.test.js
npm run test:core              # Includes pricing audit tests
```

**Alerts:**
- ⚠️ Percentage change > 50% triggers warning log
- ⚠️ Calculation delta > 0.01% automatically flagged
- ⚠️ All flags appear in `/api/audit/pricing/discrepancies`

---

### 3️⃣ **Suggestion 4: Row-Level Security (RLS) on Quotes** [IMPLEMENTED]

**Purpose:** Prevent unauthorized access to other users' quotes

**What was added:**
- Database migration: `server/migrations/omni/021_quotes_row_level_security.sql`
- RLS policies for `quotes` and `quote_audits` tables
- User isolation via `user_id` foreign key

**Changes Made:**
1. Added `user_id` column to `quotes` table (FK to `auth.users`)
2. Added `user_id` column to `quote_audits` table
3. Enabled Postgres RLS on both tables
4. Created 6 RLS policies:
   - `quotes_select_own` — Users see only their quotes
   - `quotes_insert_own` — Users can create their own quotes
   - `quotes_update_own` — Users can update their own quotes
   - `quotes_delete_own` — Users can delete their own quotes
   - `quotes_admin_all` — Admins bypass all policies
   - Similar for `quote_audits`

**How to Activate:**
```bash
# Run migration
npm run omni:migrate:enhanced

# Or manually apply migration
npm run omni:migrate:enhanced
```

**Security Model:**
```sql
-- Only see your own quotes (except admin)
SELECT * FROM quotes WHERE user_id = auth.uid() OR is_admin();

-- Can only create quotes for yourself
INSERT INTO quotes (...) WHERE user_id = auth.uid();

-- Admin bypass (full access)
-- All policies checked with: current_user_is_admin()
```

**Enforcement:**
- RLS enforced at database layer (can't be bypassed from app)
- API middleware should also check `req.user.id` (defense in depth)
- Attempted unauthorized access raises Postgres exception

**Testing RLS:**
```sql
-- As user A, try to access user B's quote
SELECT * FROM quotes WHERE id = 'user-b-quote-id';
-- Result: 0 rows (RLS blocked it)

-- As admin
SELECT * FROM quotes WHERE id = 'user-b-quote-id';
-- Result: 1 row (admin bypass works)
```

**Migration Safety:**
- Migration is idempotent (safe to run multiple times)
- Uses `ALTER TABLE ... IF NOT EXISTS`
- Policies dropped and recreated to avoid conflicts

---

---

## ⏳ NOT YET IMPLEMENTED

### 4️⃣ **Suggestion 1: Centralized State Management with Auto-Persistence** [PENDING]

**Priority:** HIGH  
**Effort:** Medium (3-5 days)  
**Why it matters:** Users lose unsaved quotes on crash/tab close

**What needs to be done:**
1. Install Zustand: `npm install zustand`
2. Create `/src/store/quoteStore.js` with persistence middleware
3. Add `POST /api/quotes/draft` endpoint (server-side)
4. Add `GET /api/quotes/draft` endpoint (restore)
5. Refactor `PanelinCalculadoraV3` to use Zustand
6. Add "Save Draft" + "Restore" UI buttons
7. Add integration tests

**Implementation Outline:**
```javascript
// Create store with persistence
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useQuoteStore = create(
  persist(
    (set) => ({
      techo: {},
      pared: {},
      saveDraft: async () => { /* POST to server */ },
      restoreDraft: async () => { /* GET from server */ },
    }),
    {
      name: 'bmc-quote-store',
      getStorage: () => localStorage,
    }
  )
);
```

**API Endpoints Needed:**
```
POST   /api/quotes/draft              — Save draft to server
GET    /api/quotes/draft              — Restore last draft
DELETE /api/quotes/draft/:draftId     — Delete specific draft
```

---

### 5️⃣ **Suggestion 5: PDF Service with Pagination & Error Recovery** [PENDING]

**Priority:** LOW  
**Effort:** Medium (3-5 days)  
**Why it matters:** Large BOMs (>1000 items) cause PDF generation to timeout

**What needs to be done:**
1. Create `/server/lib/pdfService.js` — dedicated PDF generation
2. Create `pdf_queue` table — track export jobs
3. Create background worker — poll queue and process
4. Add retry logic with exponential backoff
5. Expose queue status via API
6. Add progress UI on frontend

**Implementation Outline:**
```javascript
// PDF Service
const generatePDF = async (quoteId, options) => {
  // Queue the job
  const job = await createPdfJob(quoteId);
  
  // Process async
  processQueue().catch(console.error);
  
  return job; // Return job_id immediately
};

// Frontend polls job status
GET /api/pdf/jobs/:jobId

// Handles large BOMs with pagination
// Falls back to html2pdf if Playwright fails
// Retries with exponential backoff
```

**Database Schema:**
```sql
CREATE TABLE pdf_queue (
  id UUID PRIMARY KEY,
  quote_id UUID NOT NULL,
  status TEXT,          -- 'pending', 'processing', 'completed', 'failed'
  created_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  result_url TEXT,      -- S3/GCS URL
);
```

---

---

## 🚀 DEPLOYMENT CHECKLIST

### Before Deploying

- [ ] Run `npm run lint` to check code style
- [ ] Run `npm run test:core` to verify tests pass
- [ ] Run `npm run gate:local:full` for full validation
- [ ] Review new migration files for safety
- [ ] Test RLS policies on staging database
- [ ] Verify pricing audit logs are being recorded
- [ ] Check that discrepancies are flagged correctly

### Deployment Steps

1. **Create new feature branch:**
   ```bash
   git checkout -b feat/data-integrity-improvements
   ```

2. **Apply migrations:**
   ```bash
   npm run omni:migrate:enhanced
   ```

3. **Verify migration success:**
   ```bash
   npm run omni:migrate:status
   ```

4. **Deploy backend:**
   ```bash
   # Vercel/Cloud Run deployment
   npm run build
   git push
   ```

5. **Verify on production:**
   ```bash
   # Check pricing audits being recorded
   curl https://calculadora-bmc.com/api/audit/pricing/report?startDate=...&endDate=...
   
   # Check RLS is working
   # Try to access another user's quote (should fail)
   ```

6. **Monitor for 24 hours:**
   - Check server logs for RLS errors
   - Verify pricing audit table growth is normal
   - Monitor database performance (new indexes)

---

---

## 📚 DOCUMENTATION REFERENCES

**Analysis & Design:**
- Full analysis: `docs/FULL-ANALYSIS-2026-07-11.md`
- Architecture: `docs/ARCHITECTURE.md`

**Implementation Files:**
- Enhanced migrations: `scripts/omni-migrate-enhanced.mjs`
- Pricing audit: `server/lib/pricingAudit.js`
- Pricing audit routes: `server/routes/pricingAudit.js`
- Pricing audit tests: `tests/pricingAudit.test.js`
- RLS migration: `server/migrations/omni/021_quotes_row_level_security.sql`

**Migration Files:**
- Pricing audit schema: `server/migrations/omni/020_pricing_audit_system.sql`
- RLS setup: `server/migrations/omni/021_quotes_row_level_security.sql`

---

---

## ✅ VALIDATION & NEXT STEPS

### Immediate (This Week)
- [ ] Run all tests via `npm run test:core`
- [ ] Validate pricing audit system works
- [ ] Test RLS policies on staging
- [ ] Review and approve migration rollback strategy

### Short-term (Next 2 weeks)
- [ ] Deploy to production
- [ ] Monitor RLS enforcement
- [ ] Collect audit trail data
- [ ] Resolve any unresolved discrepancies

### Medium-term (Next month)
- [ ] Implement Suggestion 1: Centralized state + auto-persistence
- [ ] Implement Suggestion 5: PDF service refactor
- [ ] Create admin dashboard for pricing audits
- [ ] Add audit report export (CSV/PDF)

### Long-term (Nice-to-have)
- [ ] E2E tests for critical flows
- [ ] Performance profiling
- [ ] Developer onboarding guide
- [ ] Dependency scanning in CI

---

## 📞 SUPPORT & TROUBLESHOOTING

### Migration Issues

**Q: Migration fails with "DROP TABLE without IF EXISTS"**  
A: This is intentional safety check. Use `--force` flag if you're sure.
```bash
npm run omni:migrate:enhanced -- --force
```

**Q: How to rollback a failed migration?**  
A: Create `.down.sql` file, then rollback.
```bash
npm run omni:migrate:rollback -- --rollback 1
```

### Pricing Audit Issues

**Q: Where are pricing overrides logged?**  
A: `pricing_audits` table. Query:
```sql
SELECT * FROM pricing_audits WHERE change_type = 'override' ORDER BY created_at DESC;
```

**Q: How to see calculation discrepancies?**  
A: Query discrepancies:
```bash
curl https://api.example.com/api/audit/pricing/discrepancies
```

### RLS Issues

**Q: User can't see their quotes after RLS enabled**  
A: Verify `user_id` is populated:
```sql
SELECT COUNT(*) FROM quotes WHERE user_id IS NULL;
-- Should be 0
```

**Q: Admin bypass isn't working**  
A: Check `current_user_is_admin()` function and `user_roles` table.

---

**Document Generated:** 2026-07-11  
**Next Review:** 2026-07-25
