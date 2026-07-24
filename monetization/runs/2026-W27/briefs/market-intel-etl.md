# Brief: MercadoLibre competitor price-monitoring SaaS

**Run 2026-W27 · composite 3.75 · packaging: SaaS**

## Asset
Working ETL: scraper, deduplication, delta computation, email alerts, scheduler (`server/lib/marketIntel/`), trigger route (`server/routes/mlEtlRun.js`), competitor seeds (`scripts/seed-full-competitors.mjs`) — hecho confirmado, running for BMC's own category.

## Comparables (verified 2026-07-03)
| Product | URL | Price | ML-specific? |
|---|---|---|---|
| Real Trends | https://www.real-trends.com/ar/precios | ARS 57k–228k/mo (≈US$38–160, conversion estimate) — verified on page | YES (official ML partner) |
| Nubimetrics | https://www.nubimetrics.com/precios | pricing gated ("Consultar precio") — verified gated | YES (official ML partner) |
| VirtualSeller | https://virtualseller.com/precios/ | pricing gated (demo) — verified gated | YES (ML repricing robot, incl. UY) |
| Prisync | https://prisync.com/pricing/ | $99 / $199 / $399/mo — verified on page | no (generic) |
| Priceva | https://priceva.com/subscription | Free / $99 / $199/mo — verified on page | partial (ML tracker landing page) |
| Astroselling | https://apps.shopify.com/astroselling | US$51.99/mo — verified on Shopify listing | ML sync (own listings, not competitor intel) |

**Positioning gap (inferencia from research):** ML-native incumbents sell broad analytics suites; global tools (Prisync/Priceva) have the alert-driven delta mechanics but aren't ML-native. A focused ML-native price-delta alert tool sits in a thinly served intersection.

## Price anchor
Entry **US$49–79/mo**, mid **US$99–149/mo**, top **US$199+/mo**, tiered by monitored listings/competitors and alert frequency. USD list prices with regional discounts (ARS volatility).

## Revenue paths (post-packaging)
1. **Self-serve SMB SaaS** for ML sellers (category-agnostic — pipeline structure already generalizes, inferencia).
2. **Vertical reports/API**: sell category price-intelligence digests (construction materials first, where the seed data already exists) to manufacturers at US$199+/mo.
3. **Add-on to candidate #1**: price-intel module inside the white-label calculator for distributors ("your competitors moved X this week").

## Biggest risk
**MercadoLibre ToS / data access.** ML prohibits unauthorized automated extraction; incumbents operate as official ML partners via the API. A scraper-based product risks IP blocks and — decisively — the ML developer credentials the rest of BMC's stack depends on (same OAuth app, `gs://bmc-ml-tokens`, issue #419). Compliance path = ML partner ecosystem before any external customer.

## Next step (one, concrete)
Assess ML partner-program requirements (Centro de Partners) and whether the current ETL can run on official API endpoints only — a read-only compliance audit of `server/lib/marketIntel/scraper` against ML's API surface.
