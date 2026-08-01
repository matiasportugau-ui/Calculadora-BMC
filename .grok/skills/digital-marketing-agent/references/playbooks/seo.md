# Playbook — SEO

## Pull

1. BMC keyword monitor: `GET /api/marketing/keywords` (when available).
2. Delegate **market-keyword-research** for expansion, clusters, SERP sample.
3. Delegate **site-spider-analyze** for own site footprint or competitors.
4. WebSearch for SERP samples of P1 keywords (top 10–20 only).

Do **not** invent exact monthly volumes; use tiers (high/medium/low/unknown) unless a real API provides numbers.

## Analyze checklist

- [ ] Priority keyword clusters vs intent (info / commercial / transactional)
- [ ] SERP: organic domains, ads density, PAA, Shopping
- [ ] On-site gaps (missing pages, thin titles, cannibalization)
- [ ] Paid vs organic overlap (same queries in Google Ads)
- [ ] Local/LATAM modifiers (Uruguay: envío, cotizar, precio, Montevideo, etc.)
- [ ] Technical quick flags only if crawl shows them (indexable, title, h1)

## BMC-specific seeds (defaults if none given)

- paneles aislantes / paneles sandwich
- techo / pared aislación
- cotizar paneles Uruguay
- product family names from catalog when known

## Typical recommendations

| Signal | Action |
|--------|--------|
| High commercial KW, no page | New landing / calculadora content |
| Thin blog ranking for transactional | Upgrade CTA + schema + internal links |
| Ads bidding where organic #1 brand | Reduce brand SEM spend (propose) |
| Competitor ranks on P1 | Content brief + backlink/outreach note (no fake DA) |

## Output slice

Report 2.3, 5.3, SEO backlog rows. Attach KW research path if produced.
