-- WA Cockpit — media richness (G7 images / G8 STT / G9 text recovery support)
-- Columns for GCS media paths and Whisper transcription status.

alter table wa_messages
  add column if not exists media_gcs_path text,
  add column if not exists media_mime text,
  add column if not exists media_bytes int,
  add column if not exists transcript text,
  add column if not exists transcript_status text;

-- pending | done | error | skipped | null
create index if not exists wa_messages_transcript_pending_idx
  on wa_messages (transcript_status)
  where transcript_status = 'pending';

create index if not exists wa_messages_media_path_idx
  on wa_messages (media_gcs_path)
  where media_gcs_path is not null;
