# Playbook — Meta Ads

## Pull

1. `GET /api/marketing/ads/meta/health` — token/account flags, live_implemented.
2. `GET /api/marketing/ads/meta/report?range={7d|30d}` — prefer `source=live` only when health allows.
3. Optional: MCP `meta-ads` tools (after `search_tool`) if API unavailable.
4. Fallback: Hub snapshot / fixture (`adsIntelligence.json` path via server libs) — label Snapshot/Demo.
5. Competitive: `site-spider-analyze` ads intel / Meta Ad Library for competitors.

Setup: `docs/procedimientos/META-ADS-SETUP.md`.

## Analyze checklist

- [ ] Account-level spend & results for range
- [ ] Campaign hierarchy: active vs paused vs learning
- [ ] Placement / platform split (FB/IG/Audience Network) if present
- [ ] Creative fatigue: high frequency + falling CTR
- [ ] Audience overlap / narrow audiences if signals exist
- [ ] Objective-aware: traffic ≠ leads; do not punish 0 leads on traffic
- [ ] Ghost towns: spend with near-zero results
- [ ] Tracking: null conversion fields → tracking P0

## Typical recommendations

| Signal | Action direction |
|--------|------------------|
| High spend, low results | Pause or cut budget; re-test creative |
| High CTR, low conversion | Landing / offer / pixel check |
| Learning limited forever | Consolidate adsets, raise budget or broaden |
| Creative fatigue | Refresh hooks, UGC, angles |
| Only Demo data | Prioritize LIVE secrets setup as P0 ops |

## Mutations

v1 skill does **not** mutate Meta via BMC (report is read-focused).  
If user wants changes: give Ads Manager step list + priority; never claim applied.

## Output slice

Fill report sections 2.1, 3–4 Meta bullets, 5.1 deep-dive.
