# Target — Meta Ads Live Report (dual documentation)

| Field | Value |
|-------|--------|
| **System slug** | `meta-ads-live-report` |
| **Repo** | `~/calculadora-bmc` |
| **Target path** | Marketing Hub + marketIntel ads + Google Ads API (sibling) |
| **Depth** | Bounded context: paid-ads surfaces in Marketing Hub — **not** full monorepo |
| **Out of scope** | WhatsApp/IG messaging Graph, full ETL competitor scrape internals, Google Ads UI (API only) |

## Two documents (do not conflate)

| Doc | Status | What it describes |
|-----|--------|-------------------|
| **`SDD-AS-BUILT.md`** | **As-Built Draft** (reverse-engineer) | What **exists in code today** |
| **`SDD.md`** | **Draft design v0.2** (architect + evolution) | **Proposed** Meta Ads Live Report tab/API |

## As-built scope (this reverse-engineer)

1. Marketing Hub UI tabs and Meta audit section (`IntelPanel.Ads`)
2. Static `adsIntelligence.json` loader and `/api/marketing/intel`
3. AI brief + market chat that inject Meta ads snapshot
4. Sibling: live **Google** Ads API `/api/ads` (no Meta Marketing API)
5. Explicit gap: **no** Meta Live Report tab, **no** Graph ads client, **no** `metaAds*` modules

## Recreation goal (as-built)

With `SDD-AS-BUILT.md` + evidence, recreate the **current** static Meta audit path and understand Google Ads live parity pattern for future Meta work.
