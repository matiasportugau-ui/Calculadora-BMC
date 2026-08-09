# Evidence index — Meta Ads Live Report

**Updated:** 2026-07-24 · post PR1–PR3 + #767 + SDD re-tag  
**Canonical SDD:** `../SDD.md` v0.4  

Tags: **CONFIRMED** | **INFERRED** | **UNKNOWN** | **HUMAN_OPS**

---

## Shipped feature surfaces (CONFIRMED)

| ID | Claim | Tag | Evidence |
|----|-------|-----|----------|
| E-01 | Tab `ads-meta` in Marketing Hub | CONFIRMED | `MarketingHubModule.jsx:141-145` |
| E-02 | `MetaAdsLiveReport` panel | CONFIRMED | `src/components/marketing-hub/MetaAdsLiveReport.jsx` |
| E-03 | `GET /api/marketing/ads/meta/report` | CONFIRMED | `server/routes/marketing.js:467` |
| E-04 | `GET /api/marketing/ads/meta/health` | CONFIRMED | `marketing.js:483` |
| E-05 | `POST /api/marketing/ai/ads-insights` | CONFIRMED | `marketing.js:494` |
| E-06 | `POST /api/marketing/ai/ads-chat` SSE | CONFIRMED | `marketing.js:509` |
| E-07 | Multi-source builder | CONFIRMED | `metaAdsReport.js` `buildMetaAdsReport` |
| E-08 | Live Graph client | CONFIRMED | `server/lib/metaAdsClient.js` |
| E-09 | Demo fixture | CONFIRMED | `data/metaAdsFixture.json` |
| E-10 | Snapshot audit | CONFIRMED | `data/adsIntelligence.json` + mapper |
| E-11 | Rules engine | CONFIRMED | `metaAdsRules.js` |
| E-12 | AI validation / allowlist | CONFIRMED | `metaAdsInsights.js` |
| E-13 | Fail-open Live without secrets | CONFIRMED | `metaAdsReport.js` live branch + tests |
| E-14 | Range-aware KPIs | CONFIRMED | #767 `applyDemoRange` / snapshot null spend |
| E-15 | Admin gate | CONFIRMED | `requireMarketing` on marketing routes |
| E-16 | Env names documented | CONFIRMED | `.env.example` META_ADS_* |
| E-17 | Setup automation | CONFIRMED | `scripts/meta-ads-bootstrap-auto.sh`, `META-ADS-SETUP.md` |
| E-18 | Unit tests | CONFIRMED | `tests/market-intel/metaAds{Report,Insights,Live}.test.js` |
| E-19 | Merged PRs | CONFIRMED | #753, #762, #764, #767 on main |

## Host still used (CONFIRMED)

| ID | Claim | Evidence |
|----|-------|----------|
| H-01 | Hub route `/hub/marketing` | `App.jsx` |
| H-02 | Static intel still in Inteligencia | `IntelPanel` + `GET /intel` |
| H-03 | Google Ads live API separate | `/api/ads` + `googleAdsClient.js` |

## Human ops residual

| ID | Claim | Tag |
|----|-------|-----|
| O-01 | Prod LIVE needs Marketing API system-user token | HUMAN_OPS |
| O-02 | Doppler `bmc-backend/prd` + GSM mount | HUMAN_OPS |
| O-03 | Ad account id must be confirmed in Meta BM | HUMAN_OPS / not code default |

## Superseded historical claims

Pre-feature “no metaAds modules” claims in older `SDD-AS-BUILT.md` body are **obsolete** — see banner on that file.
