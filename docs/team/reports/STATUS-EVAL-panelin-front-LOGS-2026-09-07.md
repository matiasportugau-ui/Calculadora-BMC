# Status eval — panelin-front (xAI shared request logs)

**Fecha:** 2026-09-07  
**Method:** `/status-eval` + `/panelin-web eval` on xAI console export.  
**Primary file:** `/Users/matias/request-logs-2026-09-07.jsonl` (192 `LOG_KIND_CHAT`, 2026-09-04T09:24Z → 2026-09-07T08:29Z).  
**Join:** live Reach probe same day. Not a replacement of VW col J / Cloud Run HTTP.  
**Prod vs this branch:** runtime scorecard below is **unchanged 68/100**. This file adds conversation quality from Grok `/chat` bodies. C1–C4 still unshipped.

PII: no phones, no col J paste, no full system prompts. Fail-class snippets ≤8 words.

## Brief

El export de xAI es casi todo **QA de pipeline** (`grok-3-mini` vía `/chat`), no shoppers de tienda. Voz S2S no trae body. El pack de tienda **sí vende**: ASR basura llega a PDF/carrito, flete se corrobora, no re-pide nombre. Fallan tres cosas del contrato: el modelo llama tools **sin hablar**, **nunca** usa `present_choices`, y 7 vueltas del 7-sep mezclaron el Panelin **operador** (`ACTION_JSON` / menú techo-pared-cámara) en la misma API key. `shop_*` en el completion de `/chat` es el diseño del widget — este archivo no prueba si el browser las ejecutó o si volaron a `/action`.

## Corpus

| Slice | n | Tag |
|---|---:|---|
| Total líneas | 192 | todas `LOG_KIND_CHAT` |
| Body logged | 133 | `meta=grok-4.3`, request `grok-3-mini` |
| Body missing | 59 | `grok-voice-think-fast-2.0` · `NO_BODY_LOGGED` → calidad voz **UNKNOWN** |
| Health probe | 47 | user `Reply with exactly: OK` — drop (ops) |
| Smoke | 12 | `smoke test automatizado` — drop |
| No Panelin | 2 | drop |
| **Panelin-branded logged** | **72** | 24 hilos por primer user |
| de las 72, pack tienda (16–17 tools) | **65** | eval S1–S10 |
| de las 72, operador/calc (0 tools) | **7** | `ACTION_JSON` / `SUGGEST_JSON` — **otra superficie**, misma key |
| `present_choices` en schema | 37 / 65 | 0 calls |
| Tokens / $ (archivo entero) | ~1.80M · ~USD 1.45 | probes incluidos |

Hosts/pageUrl: **ausentes** en este export → tráfico **INFERRED QA**, no shop `bmcuruguay.com.uy`.

Prompt drift CONFIRMED:

| Pack | n | Markers |
|---|---:|---|
| Storefront sell-loop | 37 | `Sell loop` + `present_choices` + 17 tools |
| Storefront classify/assess (pre-sell-loop) | 28 | Leila + `shop_search`, 16 tools, no chips |
| Operator calculator Panelin | 7 | `ACTION_JSON` + `setTecho`, 0 tools, 2026-09-07 01:19Z |

## Reach probe (this run)

`bash ~/.grok/skills/status-eval/scripts/panelin-front-eval.sh`

widget HTTP **200** / 80 735 B, silence **10 s**, `/status` Origin=shop `{bubble:true, publicActive:12}`, sin Origin **403**, shop script hits **1**. CONFIRMED.

## Scorecard runtime (prod, not this log file)

Same as `STATUS-EVAL-panelin-front-2026-09-07.md`: **68/100** (Reach 24 / Capture 22 / Conversation 10 / Reliability 12). Logs do **not** raise Conversation: 0 shopper `pageUrl`, 0 Admin row ids.

## S1–S10 — 65 tool-bearing storefront requests

Pass = score ≥4. N/A excluded from that row’s denominator.

| ID | Mean | Pass | n | Note |
|----|-----:|-----:|--:|---|
| S1 greeting / no menu / no identity re-ask | 5.00 | 100% | 65 | 0 re-ask nombre+tel. Menu techo/pared/cámara only on the 7 operator rows |
| S2 one question, rioplatense | 4.97 | 98% | 65 | |
| S3 name family **and** open ficha | 3.29 | 29% | 38 | Weakness: quote path names IsoDec without `shop_search` that turn |
| S4 offer aproximación/PDF (no wait “cotizame”) | 4.33 | 67% | 42 | `calcular_cotizacion`×5 + `generar_pdf`×5. 0 wait-cotizame |
| S5 listed SKU → cart | 3.00 | 33% | 3 | Thin: 1 `add_to_cart` (Cardelino). Rest N/A |
| S6 never a flete **number** | 5.00 | 100% | 65 | 9 mentions “sin flete / corroborar”. User-injected USD 280 refused |
| S7 CTA / speech every STOP | 4.20 | 72% | 65 | **16** TOOL_CALLS with empty assistant (speak-before-tool fail) |
| S8 `present_choices` when pick | 3.19 | 59% | 37 | **0 calls** in the whole file. Thickness asked as prose |
| S9 shop_* must not hit `/action` | — | UNKNOWN | — | 11 `shop_*` in **model output** is the widget path. This export cannot see `/action` |
| S10 ASR garbage still sold | 5.00 | 100% | 65 | “coiar techo” → IsoDec 5×6 150 mm + PDF; “j / galpones / crelino” → Cardelino cart |

Spot-reads (8-word caps):

- Quote+PDF: `Ya tenés el PDF y los ítems` — S4/S7 pass after tools return.
- Flete guard: `El flete hay que corroborarlo aparte.`
- ASR quote: `Aproximación lista web: **USD 2.155** (sin flete).`
- Galpón: `Dale, para galpón te recomiendo IsoRoof` then empty `shop_search`.
- FAQ: `IsoDec es un panel de techo` + `shop_search`.
- Operator leak (not scored in table): `SUGGEST_JSON` Techo / Pared / Cámara; `ACTION_JSON setTecho`.

## Fail classes

| Class | n | Evidence |
|---|---:|---|
| Empty assistant + TOOL_CALLS | **16** | ≥3. Instruction: speak + CTA before the tool |
| `present_choices` never called | **0 / 37** schema | chips dead in this window |
| `shop_*` in `/chat` completion | 11 | `shop_search` 8, `navigate` 1, `add_to_cart` 1, `shop_product` 1 — **by design if widget runs them**. `/action` 400 still UNKNOWN here |
| Operator pack on same xAI key | **7** | ACTION_JSON + techo/pared/cámara menu |
| Credits probes | 47 | ops noise, not quality |
| Voice body missing | 59 | cannot score S2S |
| Flete number from agent | **0** | |
| Identity re-ask | **0** | |
| MAX_LEN | 0 in eval set (1 in full logged 133) | |
| Dead “cualquier cosa” | 0 | |

## Strengths (CONFIRMED)

- Sell-loop pack offers PDF without insist; lista web; disclaimer once.
- Flete policy holds even when the user asks to bake in a USD freight.
- ASR repair works (IsoDec / Cardelino).
- Identity is not re-asked in chat (gate already happened, or QA skipped it).
- Reach still green on shop Origin.

## Weaknesses (CONFIRMED)

- Silent tool turns (16) — shopper hears a pause, then a later STOP.
- `present_choices` shipped in schema and never used.
- Opening the ficha (S3) is optional in practice; obra quotes skip `shop_search`.
- Same xAI key serves **operator** Panelin (`ACTION_JSON`) and **storefront** pack — 7-sep 01:19Z. Risk of leaking calculator chrome to a shop-looking system name.
- Voice quality UNKNOWN (59).
- Corpus is QA, not the 37 VW rows.

## Join vs prior eval

| Prior (VW / Cloud Run) | This file |
|---|---|
| Conversation 16% real col J | Cannot recompute; 0 Admin ids |
| `action` 400 shop tools in prod | Model still emits shop_* on `/chat` (expected). Guard C2 still needed until widget+server agree |
| C1 Hub 45 s, C3 chat keeps orb | Not visible in Grok bodies |
| JSONL `data/storefront-turns/2026-09-04.jsonl` | Local-only; not joined (no requestId overlap) |

## Next action (one)

**Ship** `feat/panelin-front-status-eval` to Cloud Run (HITL `sí` / `ship`) so C1–C4 leave local. After that, not before: (1) stop mixing operator `ACTION_JSON` on the storefront xAI key, (2) ratchet speak-before-tool + `present_choices` on a real shop thread, (3) HITL empty VW + identify gate.

Do not theme APPLY. Do not fake identify on the shop.
