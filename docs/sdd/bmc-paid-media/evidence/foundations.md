# Evidence — foundations for target SDD (2026-08-04)

| Claim | Tag | Source |
|-------|-----|--------|
| Meta Live Report as-built v0.4 | CONFIRMED | `docs/sdd/meta-ads-live-report/SDD.md` |
| `metaAdsClient.js` Graph v21 insights | CONFIRMED | `server/lib/metaAdsClient.js` |
| Google `googleAdsClient` + dry-run mutations | CONFIRMED | `server/lib/googleAdsClient.js`, `server/routes/ads.js` |
| Google accounts/report/pause routes | CONFIRMED | `server/routes/ads.js` |
| MCC + child account IDs documented | CONFIRMED | `docs/procedimientos/GOOGLE-ADS-SETUP.md` |
| Meta bootstrap procedure | CONFIRMED | `docs/procedimientos/META-ADS-SETUP.md` |
| Historical 0-conversion / high spend diagnosis | CONFIRMED | PROJECT-STATE 2026-07-13; goal-prompt Google Ads PDF context |
| Public lead-event for WA/quote | CONFIRMED | PROJECT-STATE + publicLeadEvent route (cited in state) |
| DMA skill expects Meta+Google APIs | CONFIRMED | `~/.grok/skills/digital-marketing-agent/SKILL.md` |
| Meta mutations in Hub | N/A v1 Meta SDD | meta-ads-live-report non-goals |

This SDD is **target architecture**, not a full reverse-engineer of live campaign graphs.
