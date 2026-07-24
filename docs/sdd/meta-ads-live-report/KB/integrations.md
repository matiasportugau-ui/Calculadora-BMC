# KB — Integrations (as-built ads surface)

## Meta

| Integration | Status | Evidence |
|-------------|--------|----------|
| Marketing / Ads Insights API | **NOT present** | No `META_ADS_*` in `config.js`; no Graph insights client; grep zero for metaAds |
| Page messaging tokens | Present for omni/WA | `FB_PAGE_TOKEN` etc. — messaging only |
| Static audit file | Present | `adsIntelligence.json` |

## Google Ads

| Integration | Status | Evidence |
|-------------|--------|----------|
| Live API | Present | `googleAdsClient` + `/api/ads` |
| Env names | `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_OAUTH_CLIENT_ID`, `GOOGLE_ADS_OAUTH_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | `config.js:177-181` |
| Mutations | Dry-run unless `apply: true` | `ads.js` header comments |

## LLM

| Integration | Status | Evidence |
|-------------|--------|----------|
| Strategic brief | Uses static Meta ads in prompt | `strategicBrief.js:170-171, 179-184` |
| Market chat | Injects ads summary in context | `marketing.js` `buildMarketChatContext` |
| Transport | `callAgentOnce` channel `chat` | brief maxTokens 8192; chat 1500 / temp 0.4 |

## Pattern for future Meta Live Report

Clone **Google Ads** stack (client + secrets + report route), **not** messaging tokens. Design contract: `SDD.md` v0.2 + `schemas/MetaAdsReport.schema.json`.
