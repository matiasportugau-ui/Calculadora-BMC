# Media: GCS vs Drive

No confundir los dos buckets de archivos.

## WhatsApp media (G7/G8/G9) — GCS

**SHIPPED** (PR #847). Spec: `docs/team/features/WA-MEDIA-RICHNESS-SPEC.md`. Hub: `docs/wa-cockpit/MEDIA-G7G8G9.md`.

```
POST /api/wa/media  → magic-byte gate → GCS privado prefix wa-media/
GET  /api/wa/media/:msg_id → 302 signed URL (auth)
```

- Postgres: `wa_messages.media_gcs_path`, `media_mime`, `media_bytes`, `transcript*`.
- Unauth GET → **401**.
- STT: Whisper local Mac (`scripts/wa-local-stt-worker.mjs`) o cloud si `WA_TRANSCRIPT_CLOUD`.
- Código: `server/lib/waMedia.js`. Migración `wa-package/migrations/018_wa_media.sql`.

Esto **no** es Google Drive. El conector WA no debe “buscar la nota de voz en Drive”.

## Drive

PDFs de cotización, `.bmc.json`, envíos `.bmc-envios.json`. Scope `drive.file`. Sin signed-URL GCS.

Logística adjuntos: URL Drive/Dropbox **https** allowlist (`src/utils/logistica/adjuntoUrl.js`). El proxy no usa el token GIS del operador.

## Training KB / brain

También GCS (`kb/training-kb.json`, brain), no Drive.

## Archive WA training

`WA-ARCHIVE-TRAINING-MODE.md` cita un `drive_export.js` en repo **externo** `~/whatsapp-export` (refresh de `conversations.json`). No es el Drive OAuth de la calculadora.

## Regla para contexto

| Contenido | Dónde está | Cómo leerlo |
|-----------|------------|-------------|
| Foto/audio del chat WA | GCS `wa-media/` | API media firmada |
| PDF cotización archivado | Drive (app files) | Drive API con el OAuth que **creó** el archivo |
| Ficha técnica producto | `data/knowledge/*.md` + Training KB | Prompt / few-shot |
| Export histórico chats | Proceso offline + PII | Gym / train import |
