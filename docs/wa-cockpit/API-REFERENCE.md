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
