# Data sources — Digital Marketing Agent

## Priority order

| Priority | Source | Freshness label | When |
|----------|--------|-----------------|------|
| 1 | BMC API live | LIVE | Auth + secrets OK |
| 1b | MCP google-ads / meta-ads | LIVE | MCP connected + authed |
| 2 | BMC fixture / snapshot JSON | Snapshot / Demo | Fail-open Meta path |
| 3 | Market intel Postgres views | LIVE/DB | `DATABASE_URL` + admin |
| 4 | Public SERP / Autocomplete / Ad Library | PUBLIC | SEO & competitive |
| 5 | User paste (Ads Manager export CSV) | USER | Always valid if labeled |

## BMC endpoints (admin)

Base: `BMC_API_BASE` or `http://127.0.0.1:3001`

| Endpoint | Channel |
|----------|---------|
| `GET /api/marketing/ads/meta/health` | Meta readiness |
| `GET /api/marketing/ads/meta/report?range=7d` | Meta performance DTO |
| `POST /api/marketing/ai/ads-insights` | Server-side AI insights (optional) |
| `GET /api/marketing/dashboard/summary` | Intel summary |
| `GET /api/marketing/keywords` | Tracked keywords |
| `GET /api/marketing/product-intelligence` | Competitor / product intel |
| `GET /api/ads/accounts` | Google accessible customers |
| `GET /api/ads/accounts/:id/campaigns` | Google campaigns |
| `GET /api/ads/accounts/:id/report` | Google performance report |
| `POST /api/ads/...` mutates | Dry-run by default |

## Secrets (names only)

| Domain | Env / GSM names |
|--------|-----------------|
| Meta | `META_ADS_ACCESS_TOKEN`, `META_ADS_ACCOUNT_ID` |
| Google Ads | See `server/lib/googleAdsClient.js` / config (developer token, OAuth refresh, customer id) |
| DB | `DATABASE_URL` |
| Auth | Admin JWT / service user for requireServiceOrUser |

Setup docs: `docs/procedimientos/META-ADS-SETUP.md`

## Public SEO / competitive (no paid SEO API)

| Tool | Use |
|------|-----|
| Google Autocomplete | `market-keyword-research` script |
| WebSearch SERP sample | Top domains, ads density |
| site-spider-analyze | Site crawl, ML, Meta Ad Library |
| Playwright | Only if API/public HTML insufficient |

## Honesty rules

- Missing field → `null` / UNKNOWN, never invent.
- Demo fixture → always say Demo.
- User-exported CSV → source `USER` + file name.
