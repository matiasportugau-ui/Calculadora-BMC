# Evidence inventory — Marketing Hub / Ads (as-built)

**Date:** 2026-07-23  
**Command base:** `~/calculadora-bmc`

## Entrypoints

| Surface | Path | Notes |
|---------|------|-------|
| SPA route | `src/App.jsx:414` | `/hub/marketing` |
| Hub shell | `src/components/MarketingHubModule.jsx` | Tabs, data load, KPI strip |
| Meta UI (static) | `src/components/marketing-hub/IntelPanel.jsx` | `Ads` section |
| Market AI chat UI | `src/components/marketing-hub/MarketIntelChat.jsx` | SSE |
| Strategic brief UI | `src/components/marketing-hub/AiStrategicBrief.jsx` | PDF export |
| Marketing API | `server/routes/marketing.js` | Mounted `/api/marketing` |
| Google Ads API | `server/routes/ads.js` | Mounted `/api/ads` |
| Server mount | `server/index.js:55-56, 1112, 1114` | Both routers |
| Static Meta data | `server/lib/marketIntel/data/adsIntelligence.json` | Audit snapshot |
| Loader | `server/lib/marketIntel/productIntelligence.js:14-34, 120-122` | `getAdsIntelligence()` |
| AI brief | `server/lib/marketIntel/strategicBrief.js` | `formatAdsIntel`, `buildAnalisisAds` |
| Google client | `server/lib/googleAdsClient.js` | Live GAQL |
| Config Google | `server/config.js:177-181` | `GOOGLE_ADS_*` |
| Messaging Meta | `server/config.js:161` `FB_PAGE_TOKEN` | **Not** ads Marketing API |

## Grep results (feature absence)

```
rg MetaAds|ads/meta|metaAds  → No matches in *.js,*.jsx  (CONFIRMED 2026-07-23)
```

## Dependencies (ads-relevant)

| Package / service | Use |
|-------------------|-----|
| express + express-rate-limit | Routes + `intelLimiter` |
| google-ads-api (via googleAdsClient) | Live Google only |
| callAgentOnce / agentCore | Brief + market chat |
| SkinProvider / admin-cot styles | Hub chrome |

## Deploy (parent product — INFERRED from AGENTS.md + config)

| Layer | Host |
|-------|------|
| Frontend | Vercel SPA |
| API | Cloud Run Express |
| Secrets | Doppler / GCP SM — `GOOGLE_ADS_*` present in config; **no** `META_ADS_*` |
