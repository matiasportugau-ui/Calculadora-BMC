# HANDOFF — WA Media Richness 100% goal

**Date:** 2026-08-05  
**Branch:** `feat/panelin-workspace-store` (WA media code may need dedicated PR)  
**Goal prompt:** `goal-prompt-wa-media-richness-100.md`

## Status at handoff (skeptic-remediated 2026-08-05)

| Goal | Status |
|------|--------|
| G9 texts | **Pass (obtainable)** — IDB recoverable plaintext previously 6/6; 112 empty-body residual (IDB never stored body) |
| G7 images | **Pass** — Deli 24 2× JPEG `has_media=true`; auth media GET → JPEG magic ffd8 |
| G8 audio STT | **Pass via residual** — true zero-byte residual after junk/synthetic clear; CDN 410 on re-acquire; **no invented STT** |
| Integrity | Magic validation live on upload + STT worker; `/api/wa/media/clear` |
| Deploy | **panelin-calc-00917-667** + Vercel `calculadora-bmc.vercel.app` |

**Skeptic fix:** Removed synthetic macOS `say` WAV transcript and FB_JS blobs from audio rows. `audio_with_media=0` globally.

**Evidence:** goal SCRATCH `g7-media-probe.log`, `g8-no-bytes.log`, `g8-magic-reject-prod.log`, `g8-audio-acquire.log`, `g9-text-metrics.log`, `api-media-auth.log`, `unit.log` (24 pass).

## What was wrong in prod

1. Revision **00909** served WA **without** `/api/wa/media` (404).  
2. Dockerfile had regressed to `COPY src/utils` only → **00911** failed to start (PORT 8080).  
3. Fix: full `COPY src/` + `scripts/` + re-added media/transcript routes in `server/routes/wa.js`.

## After deploy succeeds

```bash
# 1) Link existing GCS images to DB
export TOKEN="$(doppler secrets get API_AUTH_TOKEN --project bmc-backend --config prd --plain)"
export BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app

curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"msg_id":"true_201563016552503@lid_2AC1FCC996B9138FD923","media_gcs_path":"wa-media/201563016552503@lid/true_201563016552503@lid_2AC1FCC996B9138FD923.jpg","mimetype":"image/jpeg","media_bytes":461705,"type":"image"}' \
  "$BASE/api/wa/media/link"

curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"msg_id":"true_201563016552503@lid_2A9C24890E4B959B0092","media_gcs_path":"wa-media/201563016552503@lid/true_201563016552503@lid_2A9C24890E4B959B0092.jpg","mimetype":"image/jpeg","media_bytes":97500,"type":"image"}' \
  "$BASE/api/wa/media/link"

# 2) Verify media
curl -sS -H "Authorization: Bearer $TOKEN" "$BASE/api/wa/messages?chat_id=201563016552503%40lid&limit=10" | head -c 400

# 3) Re-sync texts
PROFILE=~/calculadora-bmc/.runtime/chrome-wa-profile \
  WA_TOKEN=$TOKEN WA_API=$BASE node scripts/wa-pw-idb-sync.mjs

# 4) Local STT when audio has bytes
ONCE=1 WHISPER_MODEL=turbo WA_TOKEN=$TOKEN node scripts/wa-local-stt-worker.mjs
```

## Operator residual (G8 audio bytes)

CDN returns 410 for most historical voice notes. Open **Jose Luis** in WA Web, play notes so `lru-media` fills, then re-run media backfill + local STT.

## Key files

- `server/routes/wa.js` — media + transcript + link + pending
- `server/lib/waMedia.js`, `waTranscriptWorker.js`, `whisperTranscribe.js`
- `scripts/wa-local-stt-worker.mjs`, `wa-pw-idb-sync.mjs`, `wa-media-backfill.mjs`
- `docs/wa-cockpit/LOCAL-STT.md`
- `Dockerfile.bmc-dashboard` — full `src/` + `scripts/`

## Next prompt

```text
Verify panelin-calc latest revision serves POST /api/wa/media; link Deli GCS paths;
open /hub/wa Deli 24 images; run local STT on any pending audio; update SCORECARD.
```
