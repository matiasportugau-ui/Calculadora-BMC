# PDF Generation System Audit

**Date:** 2026-05-18  
**Scope:** calculadora-bmc PDF generation, file naming, versioning, quote structure, client folders  
**Status:** Complete

---

## Executive Summary

Your PDF system has **solid technical foundations** (server-side Chromium rendering, template system, naming conventions) but **critical gaps in production workflow**:

| Area | Status | Key Issue |
|------|--------|-----------|
| **Generation** | ✅ Good | Server + fallback client rendering works well |
| **Storage** | ⚠️ Critical gap | PDFs downloaded locally only — no central storage |
| **Versioning** | ❌ Missing | No version tracking; overwrites unnamed files |
| **Naming** | ⚠️ Incomplete | Date + client slug works, but no incremental versioning |
| **Quote templates** | ✅ Good | 6 layouts + flexible model system |
| **Client folders** | ❌ Missing | Drive structure planned but not implemented |
| **Metadata** | ⚠️ Incomplete | Code stored in Drive, PDF separate — hard to link |

**Immediate blockers for production:**
1. No way to track multiple quote versions for same client/date
2. PDFs not automatically saved to client folders in Drive
3. Quote code generation incomplete (no Drive sync)
4. No audit trail for quote lifecycle

---

## 1. PDF Generation Architecture

### Current Implementation ✅

**Server-side (Preferred):**
- Route: `POST /api/pdf/generate`
- Engine: Puppeteer + @sparticuz/chromium (serverless-optimized)
- Output: Vectorial PDF (same as print preview)
- Margins: 12mm all sides
- Viewport: 1280×900

**Client-side (Fallback):**
- Library: html2pdf.js (for when server unavailable)
- Method: html2canvas + jsPDF (raster, 95% quality)
- Uses iframe to isolate CSS + fonts

**Assessment:** 
- ✅ Chromium path handles both Cloud Run (mounted binary) and local dev
- ✅ Chmod logic ensures executable bit set
- ✅ Graceful fallback if Chromium unavailable (503)
- ⚠️ 30s timeout may be tight for complex PDFs with SVG plans

**Recommendations:**
1. Add timeout configuration (currently hardcoded 30s)
2. Log PDF generation metrics (size, duration, memory) for cost/perf tracking
3. Test with largest realistic quote (panel + many zones + full BOM)

---

## 2. Template System & Quote Structure

### Current Templates ✅

**6 layout options** in `src/pdf-templates/`:

| ID | Label | Status | Notes |
|----|-------|--------|-------|
| `bmc-pdf` | BMC PDF — Blueprint Técnico | ✅ Active | Technical blueprint, recommended for internal |
| `soft-modern` | E — Soft Modern | ✅ Active | Default; warm palette, professional |
| `blueprint` | B — Blueprint | ✅ Active | Blueprint aesthetic |
| `executive-dark` | A — Executive Dark | ✅ Active | Dark, premium feel |
| `minimalist` | C — Minimalist | ✅ Active | Clean, minimal |
| `construction-bold` | D — Construction Bold | ✅ Active | Heavy industrial style |

### Quote Model System ✅

**`buildQuotationModel(data)`** transforms calculator state → PDF-agnostic model with:
- Client details (nombre, razonSocial, dirección, teléfono, contacto)
- Project ref + fecha + scenario label
- Panel description line (family · thickness · color · scenario · zones)
- BOM groups + detailed line items
- Totals (subtotal USD, IVA, final)
- Roof plan SVG + zone dimensions
- KPI summary (area, panel count, support count, fixing count)
- Conditions text (manufacture time, payment terms, validity)

**Assessment:**
- ✅ Model is template-agnostic (good separation of concerns)
- ✅ Includes metadata for Drive (client name, quotation code)
- ⚠️ Panel photo/URL in `bmcExtra` but not used in templates yet
- ⚠️ No quote ID or versioning info passed to model

**Recommendations:**
1. Add `quoteId` + `version` + `timestamp` to model for tracking
2. Pass `projectId` from backend to link with Drive folder
3. Add `createdBy` (operator name) and `approvedBy` for audit trail

---

## 3. File Naming Conventions

### Current System (Partial) ⚠️

**PDF filename:**
```
{QUOTATION_CODE}_{YYYY-MM-DD}_{CLIENT_SLUG}.pdf
Example: BMC-001_2026-05-18_arcor-s-a-uy.pdf
```

**Project file (.bmc.json) filename:**
```
{QUOTATION_CODE}_{YYYY-MM-DD}_{CLIENT_SLUG}.bmc.json
Example: BMC-001_2026-05-18_arcor-s-a-uy.bmc.json
```

**Functions:**
- `montevideoYmd()` — UTC-3 timezone conversion (correct)
- `clientFileSlug()` — Sanitizes client name, max 30 chars (safe)
- `sanitizeFileSegment()` — Removes special chars, preserves Spanish diacritics

**Assessment:**
- ✅ Timezone handling correct (UTC-3)
- ✅ Sanitization handles Spanish (áéíóúñ)
- ⚠️ **No versioning:** If quote modified same day → overwrites
- ⚠️ **No incrementer:** `BMC-001_2026-05-18_arcor.pdf` + `BMC-001_2026-05-18_arcor.pdf` = collision
- ⚠️ No unique quote ID (quotationCode only, not persistent DB ID)

### Naming Problems & Solutions

| Problem | Impact | Solution |
|---------|--------|----------|
| No incremental versioning | Same-day edits overwrite | Add `_v2`, `_v3` or ISO timestamp |
| quotationCode not unique | Multiple quotes same code | Generate UUID-based quote ID |
| No operator name | Audit trail missing | Add operator initials: `BMC-001_20260518_arcor_MP.pdf` |
| Date-based only | Hard to track iterations | Add creation timestamp: `BMC-001_20260518T143045_arcor.pdf` |
| No Drive folder in filename | Requires manual upload | Separate concern; use quotationCode to link |

**Recommended new format:**
```
{QUOTATION_CODE}_{ISO_TIMESTAMP}_{OPERATOR}_{VERSION}.pdf
Example: BMC-001_20260518T143045_MP_v1.pdf

Or with UUID:
{QUOTE_UUID}_{ISO_TIMESTAMP}.pdf
Example: cq_550e8400e29b41d4a716446655440000_20260518T143045.pdf
```

---

## 4. File Persistence & Versioning

### Current State ❌ Critical Gap

**What works:**
- ✅ Browser download (user manually saves)
- ✅ .bmc.json export (calculator state)
- ✅ Filename generation (via `pdfFileName()`)

**What's missing:**
- ❌ No automatic save to Drive (manual step)
- ❌ No version history per quote
- ❌ No central archive
- ❌ No metadata storage linking PDF + code + client

### Missing Pieces

1. **Automatic Drive Upload**
   - After PDF generation, POST to `/api/quotations/:quoteId/upload-pdf`
   - Route should:
     - Check Google Drive auth
     - Create client folder (if not exists): `RUT - ClientName`
     - Create quote subfolder: `{QUOTATION_CODE}`
     - Upload PDF + .bmc.json to subfolder
     - Store metadata (folderId, fileId, uploadedAt, operator)

2. **Version History**
   - No current DB table tracking quotes
   - Need: `quotes` table with (id, projectId, quoteCode, version, createdAt, createdBy, driveFileId, status)
   - Status: `draft` → `sent` → `accepted` → `rejected`

3. **Metadata Database**
   - Currently only localStorage (browser) or Google Sheets (legacy)
   - Need: Postgres table to link:
     - Quote ID → Drive folder ID
     - Quote version → PDF file ID
     - Client ID → quote history

---

## 5. Client Folder Structure

### Planned (docs/clientes-360/FEATURE-BRIEF-v2.md) ❌ Not Implemented

**Intended hierarchy:**
```
Panelin BMC Cotizaciones (app folder)
├── {RUT} - {ClientName}         (level 1: client folder)
│   ├── {QUOTATION_CODE}         (level 2: quote folder)
│   │   ├── cotizacion.pdf       (latest PDF)
│   │   ├── cotizacion_v1.pdf    (archive)
│   │   ├── cotizacion.bmc.json  (latest state)
│   │   └── metadata.json        (quote metadata)
│   └── ...
└── ...
```

### Current Issues

1. **No Drive integration in PDF export**
   - `downloadPdfBlob()` only triggers browser download
   - No automatic upload to client folder
   - Manual workaround: copy-paste from Downloads

2. **quotationCode not stable**
   - Generated per session, not stored
   - If user refreshes, loses quote code
   - Drive folder path depends on code

3. **No audit trail**
   - No log of who created/modified quote
   - No log of when PDF was sent
   - No status tracking (draft/sent/approved)

4. **Metadata not linked**
   - PDF in Drive folder X
   - .bmc.json in browser only
   - Quote DB record in Sheets (legacy)
   - No unified query: "Show me all versions of quote BMC-001"

---

## 6. Current Workflow & Pain Points

### Operator's Current Path (Manual)

1. ✅ Open calculator
2. ✅ Fill form (client, project, panels, BOM)
3. ✅ Click "Generar PDF"
4. ⚠️ PDF downloads locally (user must save file manually)
5. ⚠️ User manually uploads to Drive (or emails)
6. ⚠️ No version tracking if quote is modified
7. ⚠️ No central record of quote status

### What's Lost

- **No reply tracking:** Did client respond? When?
- **No expiry warning:** Quote validity is "10 días hábiles" — no alert
- **No follow-up record:** Who followed up? When?
- **No conversion funnel:** Quote → Sale? When?
- **No archive:** Old quotes scattered in Gmail, Sheets, Drive

### Example Collision Scenario

| Step | Action | Result |
|------|--------|--------|
| 1 | Generate quote for Arcor, code `BMC-001` on 2026-05-18 | `BMC-001_2026-05-18_arcor.pdf` |
| 2 | User modifies specs, regenerates same day | **Overwrites** `BMC-001_2026-05-18_arcor.pdf` |
| 3 | User emails PDF to client | Client has v2, not v1 |
| 4 | Client: "I saw 50 panels, now says 45?" | Confusion — no version record |

---

## 7. Integration Points

### Frontend (React)

**File:** `src/components/PanelinCalculadoraV3_backup.jsx` (main calculator)

**PDF export trigger:**
```javascript
const handlePdf = async () => {
  const htmlString = renderPdfLayout(selectedLayout, quotationModel);
  await downloadPdf(htmlString, pdfFileName(quotationCode, project));
  // ← Stops here. No Drive upload.
};
```

**What should happen:**
```javascript
const handlePdf = async () => {
  const htmlString = renderPdfLayout(selectedLayout, quotationModel);
  const filename = pdfFileName(quotationCode, project);
  
  // 1. Generate PDF blob
  const blob = await htmlToPdfBlob(htmlString, filename);
  
  // 2. Upload to Drive (if authenticated)
  if (gdrive.isAuthenticated()) {
    await gdrive.uploadQuotePdf({
      quoteId,        // from quotationCode
      blob,
      filename,
      clientName: project.nombre,
      clientRut: project.rut,
    });
  }
  
  // 3. Save to Postgres (optional: track quote)
  await fetch('/api/quotes', {
    method: 'POST',
    body: JSON.stringify({
      quoteCode: quotationCode,
      clientId: ...,
      pdfUrl: driveFileId,
      calculatorState: serializeProject({...})
    })
  });
  
  // 4. Download to browser
  downloadPdfBlob(blob, filename);
};
```

### Backend Integration Points

**Current routes:**
- `POST /api/pdf/generate` — PDF rendering ✅
- `GET /api/quotes` — CRM Sheets read ⚠️ (Sheets-based, not DB)
- No quote storage in Postgres

**What's needed:**
- `POST /api/quotes` — Create quote record + link Drive folder
- `PATCH /api/quotes/:id` — Update quote status (sent, approved, rejected)
- `POST /api/quotes/:id/upload-pdf` — Store PDF metadata + Drive link
- `GET /api/quotes/:id/versions` — List all versions of a quote

---

## 8. Gaps Summary

| Gap | Severity | Impact | Fix Effort |
|-----|----------|--------|-----------|
| No automatic Drive upload | 🔴 Critical | Quotes lost; manual workflow | Medium (requires Drive API + auth) |
| No version tracking | 🔴 Critical | Same-day edits overwrite | Low (filename + incrementer) |
| No quote ID persistence | 🔴 Critical | Can't track quote lifecycle | Low (localStorage + URL param) |
| No Postgres quote table | 🟠 High | No analytics/reporting | Medium (schema + migrations) |
| No operator tracking | 🟠 High | No audit trail | Low (add field to quote table) |
| No validity expiry alert | 🟠 High | Quotes sent but never valid | Low (reminder system) |
| No status enum (draft/sent/approved) | 🟠 High | Can't segment by sales stage | Low (add to quote model) |
| Template theming incomplete | 🟡 Medium | Soft-modern only one with tokens | Low (extend to all templates) |
| No A/B testing templates | 🟡 Medium | Can't measure template impact | Low (needs analytics event) |
| Panel photo not displayed | 🟡 Medium | Missing visual context | Low (add to templates) |

---

## 9. Recommendations (Priority Order)

### Phase 1: Core Versioning & Tracking (1-2 days)

1. **Add version incrementer to filename**
   ```javascript
   // quotationNaming.js
   export function pdfFileNameWithVersion(code, project, version = 1) {
     const base = pdfFileName(code, project);
     return base.replace('.pdf', `_v${version}.pdf`);
   }
   ```

2. **Store quotation code in URL/state**
   ```javascript
   // Persist across refresh
   const [quotationCode, setQuotationCode] = useState(() => 
     localStorage.getItem('bmc.currentQuoteCode') || generateQuoteCode()
   );
   ```

3. **Track operator in PDF metadata**
   ```javascript
   // Add to quotationModel
   bmcExtra: {
     operator: getCurrentOperator(), // from auth
     createdAt: new Date().toISOString(),
   }
   ```

### Phase 2: Drive Integration (2-3 days)

1. **Create `/api/quotes` table**
   ```sql
   CREATE TABLE quotes (
     id UUID PRIMARY KEY,
     quote_code VARCHAR(50),
     client_id VARCHAR(100),
     created_by VARCHAR(100),
     created_at TIMESTAMP,
     status VARCHAR(20), -- draft, sent, approved, rejected
     drive_folder_id VARCHAR(100),
     drive_file_ids JSONB, -- track all versions
     metadata JSONB, -- client, totals, area, etc
   );
   ```

2. **POST `/api/quotes/upload-pdf`**
   - Input: quoteCode, blob, client data
   - Creates client folder if missing
   - Creates quote subfolder
   - Uploads PDF + .bmc.json
   - Returns driveFileId + folderPath

3. **Frontend integration**
   ```javascript
   // After PDF generation
   await fetch('/api/quotes/upload-pdf', {
     method: 'POST',
     body: new FormData([['file', pdfBlob], ['metadata', JSON.stringify({...})]])
   });
   ```

### Phase 3: Analytics & Lifecycle (3-5 days)

1. **Add quote status tracking**
   - UI selector: Draft → Sent → Accepted/Rejected
   - Endpoint: `PATCH /api/quotes/:id` { status, sentAt, respondedAt }

2. **Expiry alerts**
   - Daily scan of quotes with status=sent, createdAt > 10 days ago
   - Email Sandra: "Arcor quote (BMC-001) expired"

3. **Dashboard KPIs**
   - Quotes sent (last 7d)
   - Conversion rate (sent → accepted)
   - Average days to response
   - Top clients by quote count

### Phase 4: Polish (1-2 days)

1. **PDF metadata (embedded)**
   - Add quote code + version to header
   - Footer: "Válida hasta {date}" in red if <3 days

2. **Template theme tokens**
   - Extend color system to all 6 templates
   - Brand color config per client?

3. **Backup/archive**
   - Zip all versions of a quote for export
   - One-click "Send quote to client" with tracking

---

## 10. Technical Debt

| Item | Risk | Action |
|------|------|--------|
| **localStorage for quotationCode** | Data loss on clear | Migrate to URL param + session |
| **html2pdf fallback quality** | Raster artifacts | Test on production; consider vector-only |
| **30s PDF timeout** | Fails on large quotes | Make configurable; add instrumentation |
| **Hardcoded 12mm margins** | No client customization | Add to quote model (optional) |
| **No rate limiting on /api/pdf/generate** | DoS risk | Add auth requirement + quota |
| **SVG plan embedding** | Can be 500KB+ | Lazy-load or strip on small screens |

---

## 11. Success Criteria

After implementing Phases 1-2:

- ✅ Quote code persists across sessions
- ✅ PDF versions tracked automatically (`_v1`, `_v2`, ...)
- ✅ PDFs auto-uploaded to Drive in client folder
- ✅ Operator name recorded with each quote
- ✅ Quote metadata stored in Postgres
- ✅ No manual upload required (solve the "manual workflow" pain)

After Phase 3:
- ✅ Sandra sees quote status dashboard (sent, pending, approved)
- ✅ Expiry alerts prevent stale quotes
- ✅ Conversion metrics tracked

---

## Appendix A: File Locations

| File | Purpose | Status |
|------|---------|--------|
| `src/utils/pdfGenerator.js` | Generation logic (server + fallback) | ✅ Good |
| `src/utils/quotationNaming.js` | Filename + Drive path builders | ⚠️ Incomplete (no versioning) |
| `src/utils/projectFile.js` | .bmc.json serialization | ✅ Good |
| `src/pdf-templates/index.js` | Template dispatcher + model builder | ✅ Good |
| `src/pdf-templates/*.js` | 6 layout implementations | ✅ Good |
| `server/routes/pdf.js` | PDF generation endpoint | ✅ Good |
| `src/utils/googleDrive.js` | Drive auth + upload (partial) | ⚠️ Incomplete (no quote folder structure) |
| `docs/clientes-360/` | Planned client panel (not implemented) | ❌ Archived |

---

## Appendix B: Code Examples for Phase 1

### Versioning filename

```javascript
// quotationNaming.js

/** Serialize quote version for filename (v1, v2, ..., v99) */
export function pdfFileNameWithVersion(quoteCode, proyecto, version = 1) {
  const code = quoteCode || "BMC";
  const ymd = montevideoYmd();
  const slug = clientFileSlug(proyecto);
  const versionStr = version > 1 ? `_v${version}` : '';
  return `${code}_${ymd}${versionStr}_${slug}.pdf`;
}
```

### Persistent quote code in React

```javascript
// PanelinCalculadoraV3_backup.jsx

function initializeQuoteCode() {
  // Try localStorage, then URL param, then generate new
  const stored = localStorage.getItem('bmc.quoteCode');
  if (stored) return stored;
  
  const urlParam = new URLSearchParams(window.location.search).get('quoteCode');
  if (urlParam) return urlParam;
  
  return generateQuoteCode();
}

const [quotationCode, setQuotationCode] = useState(() => initializeQuoteCode());

useEffect(() => {
  localStorage.setItem('bmc.quoteCode', quotationCode);
}, [quotationCode]);
```

---

## Appendix C: Migration Scripts

### Create quotes table

```sql
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_code VARCHAR(50) NOT NULL,
  client_id VARCHAR(100),
  client_name VARCHAR(200),
  client_rut VARCHAR(20),
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'draft', -- draft, sent, viewed, approved, rejected, expired
  validity_days INT DEFAULT 10,
  expires_at TIMESTAMP,
  drive_folder_id VARCHAR(100),
  drive_file_ids JSONB DEFAULT '{}', -- { "v1": "fileId1", "v2": "fileId2" }
  calculator_state JSONB,
  totals_snapshot JSONB, -- {subtotalSinIVA, iva, totalFinal}
  metadata JSONB,
  UNIQUE(quote_code, client_rut) -- per client per code
);

CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_status ON quotes(status);
CREATE INDEX idx_quotes_created_by ON quotes(created_by);
CREATE INDEX idx_quotes_expires_at ON quotes(expires_at);
```

---

## End of Audit

**Next step:** Prioritize Phase 1 implementation (2-3 days) to solve immediate pain of version overwriting.


---

## 2026-05-27 Follow-up Improvements (executed in one session)

**Major progress on PDF generator area:**

1. **Default changed** from heavy 'bmc-pdf' → 'simple-carbon' (lightweight, recommended).
2. Legacy templates now visually marked as "(legacy)" in all UI selectors (main calculator + Drive panel).
3. `buildQuotationModel` now returns `quoteId`, `version`, `createdBy`, `generatedAt`.
4. All main `simple-*` templates updated to display versioning info in the footer.
5. `pdfGenerator.js` now logs detailed size + timing metrics on both server and fallback paths.
6. `server/routes/pdf.js` accepts optional `layout` + `quoteId`, logs generation metadata, and returns `X-PDF-Generation-Time` header.
7. Python optimizer script header updated to mark it as legacy support only (new quotes should not need it).

The heavy template + external optimizer path is now de-emphasized for new quotes.

**Next recommended step:** Wire real `quoteId` + `version` from the quote saving / Drive flow into `buildQuotationModel` when triggering PDF generation.

