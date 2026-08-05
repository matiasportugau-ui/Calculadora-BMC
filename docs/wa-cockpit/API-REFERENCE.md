# WA Cockpit — API reference

Todas las rutas viven bajo `/api/wa/*` y se montan en [server/index.js](../../server/index.js) tras `createTransportistaRouter`.

Auth: `Authorization: Bearer ${API_AUTH_TOKEN}` o `X-Api-Key: ${API_AUTH_TOKEN}` o `?key=${API_AUTH_TOKEN}` (mismo token que `/api/crm/cockpit/*`).

---

## F1 (read-only scrape)

### `GET /api/wa/health`
- **Auth**: público (no expone PII).
- **200**: `{ ok: true, db: true, count_chats: number, count_msgs_24h: number, module: "wa-cockpit" }`.
- **503**: `{ ok: false, db: false, error: "DATABASE_URL not configured" }`.

### `POST /api/wa/ingest`
- **Auth**: Bearer cockpit.
- **Body**:
  ```json
  {
    "operator_id": "matias",
    "batch_id": "uuid",
    "live": false,
    "messages": [ /* ver schema en README */ ]
  }
  ```
- **Idempotencia**: `ON CONFLICT DO NOTHING` por `msg_id`. Re-enviar el mismo batch es seguro.
- **Limits**: máximo 500 mensajes por batch, 8.000 chars por `text`.
- **200**: `{ ok, inserted, deduped, chats_touched, rejected_count, rejected, live, operator_id, batch_id }`.
- **400**: `{ ok: false, error: "validation_failed", details: [...] }`.

### `GET /api/wa/conversations`
- **Query**: `status`, `q`, `limit` (max 500), `cursor` (timestamp ISO).
- **Status especiales**: `stale_24h` calcula chats con `last_msg_in_at > last_msg_out_at` y mayor a 24h.
- **200**: `{ ok, count, next_cursor, items: [...] }`.

### `GET /api/wa/messages`
- **Query**: `chat_id` (requerido), `before` (timestamp ISO), `limit` (max 500).
- **Orden**: ASC por `ts` (revierte el resultado interno DESC para devolver cronológico al cliente).
- **200**: `{ ok, chat_id, count, next_before, items }`.
- **Media fields (G7/G8, 2026-08-05):** each item may include `has_media`, `media_url` (`/api/wa/media/:msg_id`), `media_gcs_path`, `media_mime`, `media_bytes`, `transcript`, `transcript_status`.

---

## Media richness G7/G8/G9 — **LIVE** (PR #847, rev `panelin-calc-00934-lp5`)

Canonical spec: [`../team/features/WA-MEDIA-RICHNESS-SPEC.md`](../team/features/WA-MEDIA-RICHNESS-SPEC.md) · Operator: [`MEDIA-G7G8G9.md`](./MEDIA-G7G8G9.md)

### `POST /api/wa/media`
- **Auth**: write (operator JWT or shared token).
- **Body**: `{ msg_id, chat_id, type?, mimetype?, bytes_base64 }` (or nested `media_upload.bytes_base64`).
- **Gates**: reject empty; reject &lt;2KB unless `force`; **magic-byte** validation (`server/lib/waMedia.js`) before GCS.
- **400 examples**: `not_audio_junk`, `not_audio_magic`, `media too small (<2KB)`, `empty media`.
- **200**: `{ ok, msg_id, path, bytes, mime, kind, transcript_status?, updated }`.

### `GET /api/wa/media/:msg_id`
- **Auth**: read.
- **302**: `Location` = short-lived signed GCS URL under `wa-media/…`.
- **401** unauth · **404** if message has no `media_gcs_path`.

### `POST /api/wa/media/link`
- **Auth**: write.
- **Body**: `{ msg_id, media_gcs_path }` (must start with `wa-media/`), optional `mimetype`, `media_bytes`, `type`.
- Attaches existing GCS object without re-upload (used after backfill / recovery).

### `POST /api/wa/media/clear`
- **Auth**: write.
- Unsets `media_gcs_path`; optional honesty path reverts STT-filled body to `[Nota de voz · Ns]` (no synthetic transcripts left behind).

### Env (optional, default local STT)

| Flag | Default | Effect |
|------|---------|--------|
| `WA_TRANSCRIPT_CLOUD` | off | `1` enables cloud Whisper worker on API boot |
| `WA_TRANSCRIPT_DISABLED` | off | `1` disables transcript worker entirely |

Documented in `.env.example` for env-drift CI. See [`LOCAL-STT.md`](./LOCAL-STT.md).

---

## F2 (sugerencias AI) — pendiente

| Endpoint | Estado |
|----------|--------|
| `GET /api/wa/suggestions?chat_id=&limit=` | F2 |
| `POST /api/wa/suggestions/:id/chosen` | F2 |

## F3 (cotización + CRM) — pendiente

| Endpoint | Estado |
|----------|--------|
| `POST /api/wa/conversations/:chat_id/upsert-lead` | F3 |

## F4 (follow-ups + outbound) — pendiente

| Endpoint | Estado |
|----------|--------|
| `POST /api/wa/outbound` | F4 |
| `POST /api/wa/outbound/:msg_id/confirm` | F4 |

## F5 (multi-operador + métricas) — pendiente

| Endpoint | Estado |
|----------|--------|
| `GET /api/wa/metrics?days=N` | F5 |
| `POST /api/wa/heartbeat` | F5 |
