# Production Updates — 2026-05-27

## Frontend (Vercel)
- Deployed PDF generator stabilization improvements:
  - Default layout changed to lightweight `simple-carbon`
  - Legacy heavy templates deprecated in UI (with "(legacy)" labels and optgroup)
  - `buildQuotationModel` now includes `quoteId`, `version`, `createdBy`, `generatedAt`
  - Versioning info now rendered in PDF footers for simple templates
  - Client-side metrics logging added in `pdfGenerator.js`

- smoke:prod verified green after deploy.

## Backend (Cloud Run)
- .dockerignore fixed to properly include `docs/walkthrough/admin-cot/source.json` (was causing Vite build failures in Cloud Build).
- Fresh deploy triggered at ~11:31 Montevideo time with the fix.
- This brings:
  - New `GET /api/pdf/metrics` endpoint (lightweight in-memory stats)
  - Better structured logging on PDF generation (with layout and quoteId)
  - `X-PDF-Generation-Time` response header
  - Support for passing `layout` and `quoteId` when calling `/api/pdf/generate`

Current live revision before this deploy: panelin-calc-00411-fzf

## Phase 0 Parallel Work
- Branch cleanup waves ongoing (multiple old cursor/* branches archived today).

