# Status eval — panelin-front

**Fecha:** 2026-09-07  
**Method:** `/status-eval` pack `panelin-front` (availability probe + 14 d funnel from prior report + VW buckets).  
**Prod vs this branch:** score is **runtime prod**. C1–C4 are on `feat/panelin-front-status-eval` and are **not** in Cloud Run yet.

## Scorecard (0–100)

| Dim | /25 | Why |
|-----|----:|-----|
| Reach | **24** | widget 200 / 80735 B, shop script tag, `/status` Origin=shop `{bubble:true, publicActive:12}`. Silence **10 s**. Orb click-test unstable (video). |
| Capture | **22** | 37 VW rows (was 0 on 28-ago). Identify p50 ~0.9 s. |
| Conversation | **10** | 6/37 VW col J ≥400 chars (**16%**, target 40%). 26 identify-only. |
| Reliability | **12** | 14 d: chat 403×16, session 502×15, action 400×3, Hub table 33 `live` ghosts. Pipeline `/chat` still maps grok-credits to hide-orb **in prod**. |
| **Total** | **68** | Weakness &lt;70: Conversation + Reliability |

## Strengths (CONFIRMED)

- Widget live on bmcuruguay.com.uy; pipeline default; hide-orb when dry.
- Identify writes Admin 2.0 (`origen=VW`).
- `/chat` + `/log` persist col J (6 real transcripts).
- FB Ads reaches galpones / IsoRoof.

## Weaknesses (CONFIRMED)

- Gate burns empty VW (70% identify-only) — **HITL policy**, not shipped here.
- Voice-credits 403 on `/chat` hides the whole orb in **prod** (fixed locally: chat uses shopper-safe error; mint still 403).
- Shop tools POST `/action` HTTP 200 with nested error in **prod** (fixed locally: 400 `shop_tool_client_only`).
- Live list used 2 min window in **prod** (fixed locally: 45 s + `live` filter).
- Shopify sessions UNKNOWN (no reports token).

## Fine detection

VW buckets: identify_only 26 / short 5 / real 6.  
Shop vs QA live rows: 22 / 14.  
Crawler noise on widget.js: ShopifyCrawler + meta-externalads.

## Next action (one)

Merge/deploy `feat/panelin-front-status-eval` so C1–C4 hit `panelin-calc`. Then HITL: tag the 26 empty VW; decide if identify moves after first turn.

Probe this run: `bash ~/.grok/skills/status-eval/scripts/panelin-front-eval.sh` → widget 200, bubble true, shop_script 1, status without Origin 403.
