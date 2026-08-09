# Data model — Meta ads as-built

## Static snapshot: `adsIntelligence.json`

**Path:** `server/lib/marketIntel/data/adsIntelligence.json`  
**Load:** once per process in `getData()` cache (`productIntelligence.js:24-34`)

| Field | Type (observed) | Example / note |
|-------|-----------------|----------------|
| `fecha_audit` | string date | `2026-06-29` |
| `fuente` | string | Meta Ads audit handoff |
| `nota` | string | Data may be stale |
| `total_campanas` | number | 72 |
| `campanas_activas` | number | 4 |
| `campanas_zombie` | number | 68 |
| `diagnostico` | string | Ghost Town narrative |
| `big_4_campanas[]` | objects | nombre, inversion_mensual_usd, objetivo, rendimiento, notas |
| `inversion_total_mensual_usd` | number | 11000 |
| `presupuesto_recomendado_asc_usd` | string | `"500-1000"` |
| `recomendacion_asc` | string | Consolidate Advantage+ |
| `ad_copy_angles[]` | objects | nombre, headline, descripcion |

**Absent from snapshot (CONFIRMED by file content):** daily series, CTR, CPM, ROAS, placements, platform split, creative IDs, Graph campaign ids.

## Loader failure mode

`loadJson` returns `null` on read/parse error; logs warn (`productIntelligence.js:14-20`).  
`GET /intel` returns 503 if loader throws (`marketing.js:260-262`).

## Postgres

`bmc_market_intel` schema used for competitor ETL, alerts, keywords — **not** for Meta ads spend (CONFIRMED: no meta_ads tables in ads path).

## Google Ads live metrics shape (sibling)

`GET /api/ads/accounts/:customerId/report` returns:

- `customer`, `campaigns[]`, `metrics_last_90_days[]` (clicks, impressions, cost_micros, conversions…), `conversion_actions[]`  
  (`ads.js:121-127`)
