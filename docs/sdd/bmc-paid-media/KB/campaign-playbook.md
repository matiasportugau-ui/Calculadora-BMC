# KB — BMC Campaign Playbook (Meta + Google)

Companion to `SDD.md` §10b. Operator-facing.

## North star

**Qualified conversations and quotes**, not vanity clicks.  
Primary first-party events: `quote.send.whatsapp`, `quote.complete`.

## Pre-flight (every scale decision)

- [ ] Meta Pixel firing on calculadora  
- [ ] Lead-event volume > 0 in last 7d when traffic exists  
- [ ] Google `conversion_action` configured and recording  
- [ ] Platform conversions not “all null” while beacon has events  
- [ ] Budget increase not on pure TOF traffic judged as lead ROAS  

## Google checklist

| Item | Guidance |
|------|----------|
| Primary account | Prefer BMC Uruguay `8607757427` unless Matias reassigns |
| Brand campaign | Always separate; protect CPC inflation |
| Non-brand | Map to keyword monitor P1 themes (paneles, aislamiento, etc.) |
| Negatives | Add weekly from search terms |
| PMax | Only after conversion green + product feed readiness |
| Mutations | API dry-run → confirm → apply |

## Meta checklist

| Item | Guidance |
|------|----------|
| TOF vs BOF | Separate campaigns; different KPIs |
| Learning limited | Don’t rebuild daily; give budget/time |
| Retargeting window | Align with sales cycle (construction = longer) |
| Creative | Refresh when frequency high / CTR drops |
| LIVE data | System user token, not page token |

## Waste definitions

| Signal | Action |
|--------|--------|
| Spend > threshold, 0 results, tracking green | Pause or rebuild |
| Spend > 0, tracking red | Fix tracking first |
| Duplicate audiences Meta↔Google | Cap or exclude |
| Zombie ENABLED campaign 30d no impressions | Archive |

## Budget share starting point

See SDD §10b table. Rebalance monthly with LIVE scorecards.
