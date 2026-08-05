# HANDOFF — All+ residual pass (disk · G8 · Envíos)

**Date:** 2026-08-05  
**Branch at end:** `main` @ `043d8586` (or newer)  
**Status:** Tracks A/C/D closed; G8 **honest residual** (no synthetic STT)

---

## Track A — Disk ✅

| | Before (session start rescue) | After tier 🟡 |
|--|-------------------------------|---------------|
| Free | ~200 MB → ~6.6 GB (worktrees) | **~9.1–9.6 GB** |

**Removed (regenerable):**

- Stale `node_modules`: Panelin calc loca (×2), BMC-Ecosystem, Chatbot Truth base copies, ai-elements-docs, interactive-character  
- `~/.npm/_npx/*`  
- ~47 git worktrees under `.claude/worktrees` + `.worktrees` (earlier in session)

**Kept:** `~/calculadora-bmc/node_modules` (1.4 G)

---

## Track D — PR hygiene ✅

| PR | Action |
|----|--------|
| **#869** G8 one-click | Already **MERGED** (`dd247d41`) — scripts on main |
| **#864 / #865** WA draft duplicates | **Closed** as superseded by #847 + #870 |
| **#870** media type downgrade + GCS | **Left OPEN** — real hardenings not claimed as done by this pass |

---

## Track B — G8 STT ⚠️ residual

**Ran:** `WAIT_USER_SEC=40 node scripts/wa-g8-operator.mjs`  
**Chat:** Jose Luis `115500310863875@lid` — **8 audio**, `with_media=0`, `transcript done=0`

| Step | Result |
|------|--------|
| Chrome headed + profile | Launched; WA Web ready |
| Auto-play | **0** play controls found |
| Network Ogg capture | **0** |
| CDN backfill | All **HTTP 410** (+ some `media.fna.whatsapp.net` ENOTFOUND) |
| Local Whisper | `pending 0` (nothing to STT) |
| Synthetic STT | **None** (correct honesty) |

**Scorecard:** `NO_MEDIA` — historical CDN expired; auto-play UI not found in this run.

**Operator resume (required for real Spanish transcript):**

```bash
cd ~/calculadora-bmc
./scripts/wa-g8-one-click.sh
# In the Chrome window: open Jose Luis, click ▶ until notes play with sound,
# wait for script scorecard → with_media≥1 and transcript done≥1
```

Log: `.runtime/wa-g8-allplus.log` / `.runtime/wa-g8-operator.log`

---

## Track C — Envíos E2E ✅

| Check | Result |
|-------|--------|
| SPA `/logistica` | **200** |
| SPA `/hub/wa` | **200** |
| API health | **200** |
| WA media unauth / Deli auth | **401** / **302** (no regression) |
| Cloud Run | `panelin-calc-00940-5dp` |
| Units | `stopReorder`, `stopStatusFsm`, `ventasSearchFilter`, `coordinationStatus` (NO ENVIADO), `bridgePayload`, `remitoPackageMetrics`, `packageDrop`, `loadPlanPrintModel`, `waMediaPlaceholder` — all green |

Note: #875/#878 already documented Logística+Store verify on main; this pass re-confirmed shell + focused units + prod smoke.

---

## Success condition vs plan

| Criterion | Status |
|-----------|--------|
| Free ≥8 GB | ✅ ~9.1 GB |
| G8 real transcript | ⚠️ residual (410 / no play) |
| Envíos units + `/logistica` 200 | ✅ |
| WA media no regression | ✅ |

---

## Next prompt

```text
Run ./scripts/wa-g8-one-click.sh; manually play Jose Luis voice notes until sound;
confirm scorecard with_media≥1 and Spanish transcript; leave #870 review if still open.
```
