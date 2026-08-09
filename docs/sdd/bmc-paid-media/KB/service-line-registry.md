# Service line registry — current campaigns (v1)

Derived from **live Meta structure**, not greenfield rename.

| line_id | Label | Current Meta campaign(s) | Funnel | KPI mode |
|---------|-------|--------------------------|--------|----------|
| `rendimiento` | Rendimiento (paneles / core) | Lead Gen Pilar 1 — Rendimiento | mof | lead |
| `instalacion` | Instalación | Lead Gen Pilar 2 — Instalación | mof | lead |
| `generic` | Tráfico web / genérico | Tráfico Web | tof | traffic |
| `shared_bof` | Remarketing (BOF compartido) | Remarketing | bof | lead |
| `orphan` | Sin línea | Unmapped names | unknown | unknown |

## Code

- Resolver: `server/lib/marketIntel/paidMediaCampaignMap.js`
- API: `GET /api/marketing/ads/by-line?range=30d&source=auto`
- Enriched fields on each campaign: `line_id`, `funnel`, `kpi`, `line_label`, `line_matched_by`
- Report rollup: `by_line[]` on MetaAdsReport

## Rules

1. **Do not** score `kpi: traffic` as lead CPL failures.
2. Zombies (68 in snapshot) stay in diagnostics only until hygiene pass.
3. Google campaigns: pattern-match until LIVE inventory is labeled.
4. Add new exact aliases when Meta renames a Big 4 campaign.

## Optional future lines

Only when a live campaign exists: `isofrig`, `accesorios`.
