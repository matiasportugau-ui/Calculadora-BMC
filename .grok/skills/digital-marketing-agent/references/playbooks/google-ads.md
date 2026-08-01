# Playbook — Google Ads (AdWords)

## Pull

1. `GET /api/ads/accounts` — list accessible customers (proves OAuth).
2. Resolve `customerId` (user-provided or first non-manager account).
3. `GET /api/ads/accounts/:customerId/campaigns`
4. `GET /api/ads/accounts/:customerId/report` (if available for range)
5. Optional MCC: `GET /api/ads/mcc/linked-accounts`
6. Optional MCP `google-ads` after `search_tool`

Code: `server/routes/ads.js`, `server/lib/googleAdsClient.js`.

## Analyze checklist

- [ ] Campaign status + channel type (Search, Performance Max, Display, YouTube)
- [ ] Budget vs spend pacing
- [ ] Search: query themes (if report includes search terms) — negatives candidates
- [ ] Brand vs non-brand split if names encode it
- [ ] Quality/landing signals if present
- [ ] Zombie ENABLED campaigns with zero impressions
- [ ] Conversion tracking nulls → P0 tracking

## Mutations (human-gated)

Routes default to **dry-run** unless body `{ apply: true }`.

Process:

1. Build mutate payload.
2. POST without `apply` (or with apply false) → show preview.
3. User confirms explicitly.
4. POST with `apply: true`.
5. Record in report appendix.

Never apply silently.

## Typical recommendations

| Signal | Action |
|--------|--------|
| High cost / low conversion search terms | Add negatives |
| Brand cannibalizing organic | Bid adjust or pause brand if branded organic strong |
| PMax black box waste | Feed asset report; constrain URLs; check brand inclusions |
| Budget limited on winners | Shift from losers (propose only) |
| No conversions in account | Fix conversion actions before scale |

## Output slice

Report 2.2, 5.2, backlog items with `channel=google_ads`.
