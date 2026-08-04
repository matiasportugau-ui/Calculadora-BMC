# Evidence — Market Intel Ads foundations

| Claim | Tag | Source |
|-------|-----|--------|
| Hub route `/hub/marketing` | CONFIRMED | `src/App.jsx` |
| Tabs include `ads-meta` | CONFIRMED | `MarketingHubModule.jsx` ~141–146 |
| MetaAdsLiveReport mounts on ads-meta | CONFIRMED | same |
| IntelPanel Ads card + deep-link | CONFIRMED | `IntelPanel.jsx` Ads() |
| Meta report API | CONFIRMED | `GET /api/marketing/ads/meta/report` |
| by-line API | CONFIRMED | `GET /api/marketing/ads/by-line` (2026-08-04) |
| line enrich on report | CONFIRMED | `metaAdsReport.attachRulesAndHash` + `paidMediaCampaignMap` |
| Big 4 snapshot | CONFIRMED | `adsIntelligence.json` |
| Skin tokens | CONFIRMED | SkinProvider / admin-cot styles |
