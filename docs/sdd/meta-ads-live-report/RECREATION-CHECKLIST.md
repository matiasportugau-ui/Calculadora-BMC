# RECREATION-CHECKLIST — Meta Ads Live Report

**Updated 2026-07-24:** PR1–PR3 code shipped on main (#753/#762/#764/#767). Remaining: human Meta secrets for prod LIVE.


**System:** meta-ads-live-report  
**Scope:** PR1 (shell + multi-source report) + PR2 (AI)  
**SDD:** `docs/sdd/meta-ads-live-report/SDD.md`  
**Schema:** `schemas/MetaAdsReport.schema.json`  
**Last updated:** 2026-07-23 (evolution-loop iter 1)

Use this checklist to implement without inventing contracts. Mark `[x]` when done in code.

---

## Host prerequisites (CONFIRMED — do not rebuild)

- [ ] Admin can open `/hub/marketing` (`App.jsx` route + `RequireGrant role=admin`)
- [ ] Marketing API mounted: `app.use("/api/marketing", marketingRouter)` in `server/index.js`
- [ ] Auth pattern: `requireServiceOrUser({ role: 'admin' })` as `requireMarketing`
- [ ] Snapshot loader exists: `getAdsIntelligence()` → `adsIntelligence.json`
- [ ] SSE chat pattern exists: `POST /api/marketing/ai/chat` + `MarketIntelChat.jsx`
- [ ] Rate limit pattern: `intelLimiter` (60 req / 60s / IP)

---

## PR1 — Files to create

### Backend

- [x] `server/lib/marketIntel/metaAdsReport.js` — orchestrate source priority, `report_hash`
- [ ] `server/lib/marketIntel/metaAdsSnapshotMapper.js` — map `adsIntelligence.json` → partial DTO
- [ ] `server/lib/marketIntel/metaAdsFixture.js` — load fixture → full DTO
- [ ] `server/lib/marketIntel/metaAdsRules.js` — deterministic recommendations
- [ ] `server/lib/marketIntel/data/metaAdsFixture.json` — full demo report (see inventory below)
- [ ] Routes on `server/routes/marketing.js` (preferred) **or** new router mounted under `/api/marketing`:
  - [ ] `GET /ads/meta/report?range=&source=`
  - [ ] `GET /ads/meta/health`

### Frontend

- [ ] `src/components/marketing-hub/MetaAdsLiveReport.jsx`
- [ ] `src/components/marketing-hub/meta-ads/` zone components (header, scorecards, trend, table, platform, creatives, recommendations, empty state, format helpers)
- [ ] Tab `{ id: 'ads-meta', label: 'Ads · Meta' }` in `MarketingHubModule.jsx` tabs array
- [ ] Lazy mount panel when `tab === 'ads-meta'`
- [ ] IntelPanel teaser CTA → `setTab('ads-meta')`

### Tests

- [ ] Unit: snapshot mapper produces valid shape (nulls for missing series)
- [ ] Unit: fixture validates against `MetaAdsReport.schema.json` (or subset checks)
- [ ] Unit: rules fire on high zombie ratio
- [ ] Unit: `report_hash` stable for identical payload

---

## PR1 — Fixture minimum inventory

`metaAdsFixture.json` **must** include:

| Element | Minimum |
|---------|---------|
| `meta.freshness` | `"demo"` |
| `meta.range_key` | `"30d"` |
| `series` | ≥28 daily points with spend + results |
| `campaigns` | ≥8 (mix ACTIVE / ZOMBIE / PAUSED; include lead_gen + traffic) |
| `platforms` | facebook + instagram |
| `placements` | feed, reels, stories, other (or equivalent 4) |
| `creatives` | ≥5 with spend/results/cpl/ctr |
| `kpis` | spend, results, cpl, ctr, cpm, frequency non-null |
| `diagnostics` | total/active/zombie populated; optional ghost-town note |
| `recommendations` | ≥1 rules-sourced |

Campaign name inspiration (may adapt): Lead Gen Pilar 1/2, Tráfico Web, Remarketing + zombies.

---

## PR1 — Source resolution (prod Auto)

```
source=auto (production):
  if META_ADS_ACCESS_TOKEN + META_ADS_ACCOUNT_ID → try live (PR3)
  else → snapshot (adsIntelligence.json)
  never auto-select demo in production

source=demo → fixture
source=snapshot → adsIntelligence.json mapper
source=live → Graph (PR3) or 503/fallback
```

---

## PR1 — Smoke (after implement)

```bash
# From repo with admin JWT
export TOKEN='…'
export API="${CALC_API_BASE:-http://localhost:3001}"

curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API/api/marketing/ads/meta/report?range=30d&source=demo" | jq '.meta.freshness, .kpis.spend, (.campaigns|length)'

# Expect: "demo", number, >= 8

curl -sS -H "Authorization: Bearer $TOKEN" \
  "$API/api/marketing/ads/meta/health" | jq .

# Expect: token_configured bool, no secret values

curl -sS -o /dev/null -w "%{http_code}\n" \
  "$API/api/marketing/ads/meta/report?source=demo"
# Expect: 401 without token
```

UI: open `/hub/marketing` → **Ads · Meta** → Demo → all 8 zones filled; badge not LIVE.

```bash
cd ~/calculadora-bmc && npm run gate:local
```

---

## PR2 — AI files

- [ ] `server/lib/marketIntel/metaAdsInsights.js` — prompt + parse + validate campaign names
- [ ] `POST /api/marketing/ai/ads-insights` (+ intelLimiter)
- [ ] `POST /api/marketing/ai/ads-chat` SSE (parity with MarketIntelChat events)
- [ ] `MetaAdsInsightsCard.jsx` + `MetaAdsAnalystChat.jsx`
- [ ] Cache insights by `report_hash` (~30 min memory)
- [ ] On LLM parse fail → rules remain; return `confidence: low` / error flag

### SSE event parity (CONFIRMED host pattern)

| type | payload | Notes |
|------|---------|-------|
| `text` | `{ type, delta }` | Stream or single chunk |
| `meta` | `{ type, provider, model }` | From callAgentOnce |
| `error` | `{ type, message }` | Then usually `done` |
| `done` | `{ type: 'done' }` | End stream |

Host reference: `server/routes/marketing.js` `POST /ai/chat` + `MarketIntelChat.jsx`.

### callAgentOnce defaults for ads (align with market chat)

| Param | Value |
|-------|--------|
| channel | `chat` |
| maxTokens | ≤1500 (chat); insights may use ≤2000 |
| temperature | ~0.3–0.4 (factual) |
| history | last 12 turns, content slice ≤4000 |

---

## PR3 — deferred (not PR1 gate)

- [x] `server/lib/metaAdsClient.js`
- [x] `META_ADS_*` in config + `.env.example`; Doppler/GSM = **human** via bootstrap
- [ ] `docs/procedimientos/META-ADS-SETUP.md`
- [ ] Graph field map → DTO (see SDD appendix)

---

## Acceptance (product)

- [ ] Demo mode: all zones A–H render with numbers/charts in &lt;3s
- [ ] Snapshot mode: honest badge; empty chart has CTA
- [ ] Freshness never shows LIVE without Graph success
- [ ] null metrics render as `—`, not `$0`
- [ ] Rules recommendations present when zombies high
- [ ] PR2: AI narrative cites only DTO metrics; chat grounded

---

## Out of scope (do not implement under this checklist)

- Google Ads tab UI  
- Meta pause/budget mutations  
- Customer Q PDF white-label product  
