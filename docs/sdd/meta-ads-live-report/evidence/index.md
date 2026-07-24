# Evidence index — Meta Ads Live Report (host system)

**Generated:** 2026-07-23 · evolution-loop iter 1  
**Updated:** 2026-07-23 · sdd-reverse-engineer as-built pass  
**Purpose:** Ground claims about *existing* calculadora-bmc (not proposed feature code).  
**As-built SDD:** `../SDD-AS-BUILT.md` · **Design SDD:** `../SDD.md`

Evidence tags:

- **CONFIRMED** — verified path:line in repo  
- **INFERRED** — reasonable from adjacent code  
- **PROPOSED** — design-only (feature not implemented)  
- **UNKNOWN** — not verified  

---

## Host integration claims

| ID | Claim | Tag | Evidence |
|----|-------|-----|----------|
| E-01 | Marketing Hub route is `/hub/marketing` under admin grant | CONFIRMED | `src/App.jsx:414` `path="/hub/marketing"` |
| E-02 | Hub has three tabs: resumen, inteligencia, detalle | CONFIRMED | `src/components/MarketingHubModule.jsx:140-145` |
| E-03 | Static Meta ads served via `GET /api/marketing/intel` → `ads` | CONFIRMED | `server/routes/marketing.js:253-258` |
| E-04 | `getAdsIntelligence()` loads static capture | CONFIRMED | `server/lib/marketIntel/productIntelligence.js:120-122` |
| E-05 | Snapshot file is qualitative audit JSON | CONFIRMED | `server/lib/marketIntel/data/adsIntelligence.json` (`fecha_audit`, Big 4, zombies) |
| E-06 | Marketing routes require admin | CONFIRMED | `server/routes/marketing.js:12` `requireServiceOrUser({ role: 'admin' })` |
| E-07 | Marketing router mounted at `/api/marketing` | CONFIRMED | `server/index.js:1112`; comment in `marketing.js:2-4` |
| E-08 | Intel rate limit 60/min/IP | CONFIRMED | `server/routes/marketing.js:242-247` |
| E-09 | Market AI chat is SSE with text/meta/done/error | CONFIRMED | `marketing.js:411-449`; client `MarketIntelChat.jsx:47-70` |
| E-10 | callAgentOnce used with maxTokens 1500, temperature 0.4 | CONFIRMED | `marketing.js:436-439` |
| E-11 | Chat history capped at 12 turns, content slice 4000 | CONFIRMED | `marketing.js:403-406` |
| E-12 | Google Ads live report exists under `/api/ads` (no Meta) | CONFIRMED | `server/routes/ads.js` header + `server/index.js:56` import |
| E-13 | Meta Ads Live Report tab/API **not implemented** | CONFIRMED | No `ads/meta` routes; no `MetaAdsLiveReport.jsx` (grep 2026-07-23) |
| E-14 | Meta ad account id referenced in goal docs | INFERRED | `docs/team/goal-prompts/goal-prompt-full-competitive-sales-strategy.md` mentions `act=109433652503382` — **confirm at PR3** |
| E-15 | Commercial diagnosis “Ghost Town” / 4 active / $11k | CONFIRMED | `adsIntelligence.json` + `docs/marketing/REVIEW-Y-PLAN-MARKETING-2026-07.md` |

---

## Proposed feature surfaces (not as-built)

| ID | Surface | Tag |
|----|---------|-----|
| P-01 | `GET /api/marketing/ads/meta/report` | PROPOSED |
| P-02 | `GET /api/marketing/ads/meta/health` | PROPOSED |
| P-03 | `POST /api/marketing/ai/ads-insights` | PROPOSED |
| P-04 | `POST /api/marketing/ai/ads-chat` | PROPOSED |
| P-05 | Tab `ads-meta` + `MetaAdsLiveReport.jsx` | PROPOSED |
| P-06 | `metaAdsClient.js` Graph Marketing API | PROPOSED (PR3) |

---

## Pattern reuse map

| Proposed component | Clone from | Why |
|--------------------|------------|-----|
| Ads SSE chat | `MarketIntelChat.jsx` + `POST /ai/chat` | Event shape, heartbeat, history caps |
| Report auth | `requireMarketing` | Admin gate |
| Live provider client (PR3) | `server/lib/googleAdsClient.js` + `routes/ads.js` | Secrets + report endpoint shape |
| Skin / scorecards | `MarketingHubModule` Kpi + `IntelPanel` Section/Tile | `--ac-*` tokens |
| Charts | `src/components/admin/analytics/AnalyticsModule.jsx` | Inline SVG bars |
