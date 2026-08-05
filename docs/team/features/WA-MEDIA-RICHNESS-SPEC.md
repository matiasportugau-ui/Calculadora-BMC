# WA Media Richness — As-Built Spec (G7 / G8 / G9)

**Status:** SHIPPED + PROD VERIFIED (2026-08-05)  
**PR:** [#847](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/847) → `main` `ff312646`  
**Closeout docs:** [#866](https://github.com/matiasportugau-ui/Calculadora-BMC/pull/866) → `2d0b4a6e`  
**Prod revision:** `panelin-calc-00934-lp5` (100% traffic)  
**Goal prompt (archive):** [`../goal-prompts/goal-prompt-wa-media-richness-100.md`](../goal-prompts/goal-prompt-wa-media-richness-100.md)  
**Operator hub:** [`../../wa-cockpit/MEDIA-G7G8G9.md`](../../wa-cockpit/MEDIA-G7G8G9.md)

---

## 1. Product goals

| Goal | Intent | Ship outcome |
|------|--------|--------------|
| **G7** Images | Viewable images in `/hub/wa` for messages with recoverable bytes | **PASS** — Deli 24 ×2 JPEG via signed GCS |
| **G8** Audio STT | Spanish transcript for voice notes with real audio bytes | **PASS via residual** — zero invent; `audio_with_media=0` until real Ogg |
| **G9** Texts | Recoverable plaintext bodies where IDB stored them | **PASS (obtainable)** — ingest/meta path live |

---

## 2. Architecture (Mode C)

```
[Chrome WA Web / extension / IDB sync]
        │  decrypted bytes (base64) or GCS path link
        ▼
POST /api/wa/media  ──magic gate──► GCS private prefix wa-media/
        │                              │
        │                              ▼
        │                     GET /api/wa/media/:msg_id
        │                              │ 302 signed URL
        ▼                              ▼
  Postgres wa_messages          Operator browser / cockpit
  media_gcs_path, media_mime,
  media_bytes, transcript*,
  transcript_status*
        │
        ▼
  Local STT (primary): scripts/wa-local-stt-worker.mjs (Mac Whisper)
  Cloud STT (optional): WA_TRANSCRIPT_CLOUD=1 + OPENAI_API_KEY
```

\*Columns from migration `wa-package/migrations/018_wa_media.sql`.

---

## 3. API contract

Auth: operator JWT **or** shared `API_AUTH_TOKEN` (Bearer / X-Api-Key).  
Base: `https://panelin-calc-q74zutv7dq-uc.a.run.app`

| Method | Path | Write? | Behavior |
|--------|------|--------|----------|
| `POST` | `/api/wa/media` | yes | Upload base64 bytes; magic validation; GCS put; update `wa_messages` |
| `GET` | `/api/wa/media/:msg_id` | no | 302 to short-lived signed GCS URL (or 404 if no path) |
| `POST` | `/api/wa/media/link` | yes | Attach existing `wa-media/…` GCS path to `msg_id` |
| `POST` | `/api/wa/media/clear` | yes | Unset media path; optional transcript/text honesty revert |
| `GET` | `/api/wa/messages?chat_id=` | no | Items include `has_media`, `media_url`, `media_mime`, `media_bytes`, `transcript*` |

### Magic validation (`server/lib/waMedia.js`)

| Expect | Junk / wrong container | Error code |
|--------|------------------------|------------|
| audio | FB JS package (`FB_PKG_DELIM`, `use strict`) | `not_audio_junk` |
| audio | no audio magic | `not_audio_magic` |
| image | junk | `not_image_junk` |
| any | unknown | `unknown_media_magic` / `junk_media` |
| size | &lt; 2KB (unless force) | `media too small (<2KB)` |

**Policy:** never invent STT. Prefer placeholder `[Nota de voz · Ns]` over synthetic transcripts.

### Env flags (documented in `.env.example`; env-drift CI)

| Flag | Default | Meaning |
|------|---------|---------|
| `WA_TRANSCRIPT_CLOUD` | off | `1` = start OpenAI cloud STT worker on API boot |
| `WA_TRANSCRIPT_DISABLED` | off | `1` = force-disable transcript worker |

---

## 4. Key files

| Path | Role |
|------|------|
| `server/lib/waMedia.js` | Magic detect/validate, GCS upload, signed GET helpers |
| `server/lib/waTranscriptWorker.js` | Cloud STT worker (optional) |
| `server/lib/whisperTranscribe.js` | Whisper client helper |
| `server/routes/wa.js` | Media/link/clear + messages media fields |
| `src/components/BmcWaCockpit.jsx` | `MessageBody` image/audio/transcript UI |
| `scripts/wa-local-stt-worker.mjs` | Mac local Whisper (primary G8 path) |
| `scripts/wa-media-backfill.mjs` | Backfill media from caches |
| `scripts/wa-pw-idb-sync.mjs` | Playwright IDB text/media meta sync |
| `wa-package/migrations/018_wa_media.sql` | Schema columns + indexes |
| `Dockerfile.bmc-dashboard` | Must `COPY src/` + `COPY scripts/` (not utils-only) |
| `tests/waMediaPlaceholder.test.js` | 28 unit tests (magic + clear/revert) |

---

## 5. Ship procedure (BMC-safe — mandatory)

1. Feature branch only — **never** `./scripts/deploy-cloud-run.sh` from Envíos / dirty trees.  
2. Merge/rebase current `main`; resolve `docs/team/PROJECT-STATE.md` (keep both narratives).  
3. Env-drift: document new `process.env` keys in `.env.example` (not permanent ALLOWED debt).  
4. Required CI: **Lint Check**, **Validate Calculations**, **Env drift** (`strict` up-to-date).  
5. `gh pr merge` → wait **Deploy Calculator API to Cloud Run** (`workflow_run` after green CI).  
6. Curl acceptance (below).  

**Why:** Ad-hoc Cloud Run revisions are overwritten by the next main deploy.

---

## 6. Production verification (2026-08-05)

**Revision:** `panelin-calc-00934-lp5` · **Token:** Doppler `bmc-backend/prd` `API_AUTH_TOKEN`

| # | Check | Expected | Observed | Pass |
|---|--------|----------|----------|------|
| 1 | `GET /health` | 200 | 200 `ok:true` | ✅ |
| 2 | `GET /api/wa/media/x` unauth | 401 (not path 404) | 401 JWT/token | ✅ |
| 3 | Deli image `…2AC1FCC996B9138FD923` auth | 302/200 | **302** signed GCS | ✅ |
| 4 | Follow signed URL body | JPEG `ffd8` | JFIF, **461 705** B | ✅ |
| 5 | Deli image `…2A9C24890E4B959B0092` auth | 302 | 302 | ✅ |
| 6 | Image #2 body | JPEG | `ffd8`, **97 500** B | ✅ |
| 7 | POST junk FB as audio | 400 `not_audio_junk` | exact match | ✅ |
| 8 | POST tiny payload | 400 too small | exact match | ✅ |
| 9 | POST `/media/link` unauth | 401 | 401 | ✅ |
| 10 | POST `/media/clear` unauth | 401 | 401 | ✅ |
| 11 | `GET /api/wa/messages?chat_id=201563016552503@lid` | media fields | 2× `has_media=true` + `media_url` | ✅ |
| 12 | Audio honesty on sample page | no synthetic STT | `audio_with_media=0` | ✅ |
| 13 | SPA `/hub/wa` | 200 | Vercel 200 | ✅ |
| 14 | `ff312646` on `main` + `waMedia.js` | present | yes | ✅ |

### Reproduce (operator)

```bash
export BASE=https://panelin-calc-q74zutv7dq-uc.a.run.app
export TOKEN="$(doppler secrets get API_AUTH_TOKEN --project bmc-backend --config prd --plain)"

curl -sS -o /dev/null -w "health %{http_code}\n" "$BASE/health"
curl -sS -o /dev/null -w "media_unauth %{http_code}\n" "$BASE/api/wa/media/x"
curl -sS -o /dev/null -w "media_auth %{http_code}\n" -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/wa/media/true_201563016552503%40lid_2AC1FCC996B9138FD923"

JUNK=$(python3 -c 'import base64;print(base64.b64encode(b";/*FB_PKG_DELIM*/\n"+b"x"*3000).decode())')
curl -sS -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"msg_id\":\"probe\",\"chat_id\":\"p@lid\",\"type\":\"audio\",\"mimetype\":\"audio/ogg\",\"bytes_base64\":\"$JUNK\"}" \
  "$BASE/api/wa/media"
```

---

## 7. Residuals (honest, non-blocking)

| Residual | Owner | Notes |
|----------|-------|-------|
| Historical WA voice CDN **410** | Operator | Open chat in WA Web, play notes → `lru-media` → backfill + local STT |
| Extension Mode C auto-upload polish | Product | Not required for route liveness |
| Mode O Meta Cloud media | Out of scope | Separate program |
| Full G9 empty-body residual where IDB never stored body | Documented | Do not invent text |

---

## 8. Non-goals

- Synthetic macOS `say` WAV / invented Spanish STT  
- Deploy from random working tree  
- Permanent env allowlist debt for optional flags  
- Claiming G8 “done” without real Ogg bytes  

---

## 9. Related docs

- Handoff: [`../HANDOFF-2026-08-05-wa-media-100.md`](../HANDOFF-2026-08-05-wa-media-100.md)  
- Local STT: [`../../wa-cockpit/LOCAL-STT.md`](../../wa-cockpit/LOCAL-STT.md)  
- API surface: [`../../wa-cockpit/API-REFERENCE.md`](../../wa-cockpit/API-REFERENCE.md)  
- Cockpit hub: [`../../wa-cockpit/README.md`](../../wa-cockpit/README.md)  
- Goal prompt archive: [`../goal-prompts/goal-prompt-wa-media-richness-100.md`](../goal-prompts/goal-prompt-wa-media-richness-100.md)  
