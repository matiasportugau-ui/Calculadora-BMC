# API & UI surfaces (as-built)

## Marketing Hub UI

| Tab id | Label | Meta-related content | File |
|--------|-------|----------------------|------|
| `resumen` | Resumen | KPI “Campañas activas” from `intel.ads` | `MarketingHubModule.jsx:46-58, 205-223` |
| `inteligencia` | Inteligencia | Full Meta audit section | `IntelPanel.jsx` → `Ads` |
| `detalle` | Detalle | AI brief block “Análisis de Meta Ads” | `AiStrategicBrief.jsx` |

**No tab** `ads-meta` (CONFIRMED: tabs array lines 140-145).

## Marketing API (Meta snapshot path)

| Method | Path | Auth | Rate limit | Meta role |
|--------|------|------|------------|-----------|
| GET | `/api/marketing/intel` | admin | intelLimiter 60/min | Returns `ads: getAdsIntelligence()` |
| POST | `/api/marketing/ai/brief` | admin | none special | Injects ads into LLM + `buildAnalisisAds` |
| POST | `/api/marketing/ai/chat` | admin | intelLimiter | `buildMarketChatContext` includes ads block |

## Google Ads API (live — sibling)

| Method | Path | Auth | Live Meta? |
|--------|------|------|------------|
| GET | `/api/ads/accounts` | admin | No — Google |
| GET | `/api/ads/accounts/:id/campaigns` | admin | No |
| GET | `/api/ads/accounts/:id/report` | admin | No — LAST_90_DAYS metrics |
| GET | `/api/ads/mcc/linked-accounts` | admin | No |
| POST | pause/enable/budget/name | admin dry-run default | No |

**No UI** calls `/api/ads/*` from Marketing Hub (CONFIRMED: hub only calls `/api/marketing/*`).

## Proposed (design only — not as-built)

See `SDD.md` v0.2: `/api/marketing/ads/meta/*`, tab `ads-meta`, `metaAdsClient.js`.
