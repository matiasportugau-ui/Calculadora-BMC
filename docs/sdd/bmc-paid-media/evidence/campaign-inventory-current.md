# Campaign inventory — current (2026-08-04)

## Meta (snapshot `adsIntelligence.json`, audit 2026-06-29)

| Name | Monthly USD (audit) | line_id | funnel | kpi |
|------|--------------------:|---------|--------|-----|
| Lead Gen Pilar 1 — Rendimiento | 4500 | rendimiento | mof | lead |
| Lead Gen Pilar 2 — Instalación | 3000 | instalacion | mof | lead |
| Tráfico Web | 2000 | generic | tof | traffic |
| Remarketing | 1500 | shared_bof | bof | lead |

- Total audit spend: **11000 USD/mo** (monthly snapshot only — not a 7d window).
- Active: **4** · Zombies: **68** · Diagnóstico: Ghost Town 94% inactive.
- LIVE Graph: requires `META_ADS_*` in Doppler/GSM (not listed in prd names as of 2026-08-04).

## Google

- Accounts documented: MCC `3971648492`, Uruguay `8607757427`, historical `5831137980`.
- LIVE list: **pending** (OAuth client env wiring failed in one smoke; secret names present in Doppler).
- Pattern stubs: Shopping → rendimiento; instalación keywords → instalacion; brand → generic.

## Implementation

- Map: `paidMediaCampaignMap.js`
- Enriched on every Meta report via `attachRulesAndHash`
- Endpoint: `GET /api/marketing/ads/by-line`
