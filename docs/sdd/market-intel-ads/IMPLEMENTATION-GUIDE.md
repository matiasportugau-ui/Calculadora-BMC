# Implementation guide — Market Intel · Ads (Hub)

Follow **this** SDD for UI. Server P0a already done.

## Done

- [x] `paidMediaCampaignMap.js` — Big 4 → line_id  
- [x] Enrich on `buildMetaAdsReport`  
- [x] `GET /api/marketing/ads/by-line`  
- [x] Unit tests (map + report + insights + UI helpers)  
- [x] **P0b** `ServiceLinesPanel.jsx` + embed in `MetaAdsLiveReport` after scorecards  
- [x] **P0c** Campaigns table columns Línea + KPI; traffic CPL = n/a (muted)  
- [x] **P0d** `compressReportForPrompt` + chat/insights prompts include `by_line` + line tags  
- [x] **P1a** IntelPanel Ads fetches by-line, line chips strip, deep-link preserved  

## P1b — Ads · Google (not this goal)

New tab `ads-google` in `MarketingHubModule` tabs array; mirror scorecards later.

## Manual QA

1. Login admin → `/hub/marketing` → **Ads · Meta**  
2. Source Snapshot → Servicios shows 4 lines  
3. Tráfico KPI mode ≠ lead CPL panic  
4. Inteligencia → Abrir Ads · Meta works  

## Tests

```bash
cd ~/calculadora-bmc
node tests/market-intel/paidMediaCampaignMap.test.js
node tests/market-intel/metaAdsReport.test.js
node tests/market-intel/metaAdsInsights.test.js
node tests/market-intel/serviceLineUiHelpers.test.js
```
