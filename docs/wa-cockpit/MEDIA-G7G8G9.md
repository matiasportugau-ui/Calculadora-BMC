# WA Cockpit — Media richness G7/G8/G9 (operator + verification)

**Canonical as-built spec:** [`../team/features/WA-MEDIA-RICHNESS-SPEC.md`](../team/features/WA-MEDIA-RICHNESS-SPEC.md)  
**Shipped:** 2026-08-05 · PR #847 · Cloud Run `panelin-calc-00934-lp5`

This page is the **operator-facing** summary. Full contract, file map, and verification matrix live in the SPEC.

---

## What works in production (verified)

| Capability | Status |
|------------|--------|
| Private GCS `wa-media/` + signed GET | Live |
| `POST /api/wa/media` magic gate (reject FB JS junk) | Live — `not_audio_junk` |
| Deli 24 images in messages API + cockpit-ready `media_url` | Live — 2 images, real JPEG |
| Unauthenticated media | **401** (not open, not missing-route 404) |
| Local Whisper STT path (Mac) | Documented — [`LOCAL-STT.md`](./LOCAL-STT.md) |
| Cloud STT | **OFF** unless `WA_TRANSCRIPT_CLOUD=1` |

---

## Operator residual (G8)

Most **historical** voice notes return CDN **410**. To get the first real Spanish transcript:

1. Open the chat in WhatsApp Web (e.g. Jose Luis).  
2. **Play** the voice notes so the browser media cache fills.  
3. Re-run media backfill: `node scripts/wa-media-backfill.mjs` (with `WA_TOKEN` / `WA_API`).  
4. Run local STT once: `ONCE=1 WHISPER_MODEL=turbo WA_TOKEN=… node scripts/wa-local-stt-worker.mjs`.  

Do **not** attach synthetic audio or invent transcripts.

---

## Quick health check

```bash
export BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app
export TOKEN="$(doppler secrets get API_AUTH_TOKEN --project bmc-backend --config prd --plain)"
curl -sS -o /dev/null -w "health %{http_code}\n" "$BASE/health"
curl -sS -o /dev/null -w "media_unauth %{http_code}\n" "$BASE/api/wa/media/x"   # expect 401
curl -sS -o /dev/null -w "media_auth %{http_code}\n" -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/wa/media/true_201563016552503%40lid_2AC1FCC996B9138FD923"   # expect 302
```

---

## Ship rule (do not break)

**Path:** feature branch → PR → green required CI → merge `main` → official `Deploy Calculator API to Cloud Run`.  

**Forbidden:** `./scripts/deploy-cloud-run.sh` from Envíos / dirty / non-WA trees (overwrites ad-hoc media revisions).

---

## Env flags

See `.env.example` and [`LOCAL-STT.md`](./LOCAL-STT.md):

- `WA_TRANSCRIPT_CLOUD=0` (default off)  
- `WA_TRANSCRIPT_DISABLED=0`  
