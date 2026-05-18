# Handoff: Quote Counter Feature — DATABASE_URL Blocker

**Date:** 2026-05-18  
**Status:** BLOCKED (external credential)  
**Completed Work:** 100% implementation code-complete  

## What's Done ✅

All code for the global quote counter system has been implemented and verified:

1. **Database Migration:** `wa-package/migrations/017_bmc_quote_counter.sql` — creates atomic `bmc_quote_counter` table with annual reset
2. **Backend Pool:** `server/lib/quoteCounterDb.js` — singleton pg.Pool (matches `waDb.js` pattern)
3. **API Routes:** `server/routes/quotes.js` — `GET /api/quotes/counter` + `POST /api/quotes/counter/next` endpoints
4. **Server Mount:** `server/index.js` — router wired at line 35
5. **Filename Utilities:** `src/utils/quotationNaming.js` — `montevideoDdmmyy`, `extractCityFromDireccion`, `buildGlobalPdfFileName`
6. **PDF Template Fix:** `src/pdf-templates/index.js` — corrected field names (`nombreRefCliente`, added `rut`)
7. **React Component:** `src/components/PanelinCalculadoraV3_backup.jsx` — state, header badge, confirmation modal, button conversion

**Build Status:** `npm run build` ✅ (814 KB gzipped)  
**Tests:** `npm run gate:local` ✅ (lint warnings pre-existing, all unit/API tests pass)

## What's Blocked ❌

**Missing `DATABASE_URL` environment variable**

The migration and API routes require a PostgreSQL connection string to:
1. Apply the migration: `npm run wa:migrate`
2. Test the counter endpoints
3. Deploy to production

## Next Steps (Operator Action Required)

### 1. Set up Database Connection

Per `PROJECT-STATE.md` (line 15), provision PostgreSQL and configure:

```bash
# Set DATABASE_URL in Cloud Run
gcloud run services update panelin-calc \
  --set-env-vars DATABASE_URL="postgresql://user:pass@host/dbname"

# OR set locally for testing
export DATABASE_URL="postgresql://localhost/bmc_test"
```

### 2. Apply Migration

Once `DATABASE_URL` is available:

```bash
npm run wa:migrate
```

This creates the `bmc_quote_counter` table.

### 3. Manual Testing

```bash
# Start dev server
npm run dev:full

# Verify counter endpoints
curl http://localhost:3001/api/quotes/counter
# Expected: { ok: true, counter: 0, code: "BMC-2026-0000", year: 2026 }

curl -X POST http://localhost:3001/api/quotes/counter/next
# Expected: { ok: true, counter: 1, code: "BMC-2026-0001", year: 2026 }
```

### 4. Update PROJECT-STATE.md

Once deployment is confirmed, add to "Cambios recientes":

```
**2026-05-18 (Global Quote Counter — atomic Postgres + confirmation modal):** 
Feature complete across backend (migration, pool, routes), utilities, and React component. 
Counter resets annually (seq 0001-9999). PDF filename format: `NNNNBMC-DDMMYY-RazonSocial-City.pdf`. 
Header badge shows current count. "Cotización lista" button opens confirmation modal with customer details, 
totals, and filename preview. Fixed customer field-name bug in PDF template (nombreRefCliente).
```

## Files Modified

- **Created:** `wa-package/migrations/017_bmc_quote_counter.sql`, `server/lib/quoteCounterDb.js`, `server/routes/quotes.js`
- **Modified:** `server/index.js`, `src/utils/quotationNaming.js`, `src/pdf-templates/index.js`, `src/components/PanelinCalculadoraV3_backup.jsx`

## Current Branch

```
main
```

No uncommitted changes — all work committed to code.

---

**Blocked by:** DATABASE_URL environment variable not configured  
**Unblocked when:** Operator provisions Postgres and sets DATABASE_URL in Cloud Run / local .env
