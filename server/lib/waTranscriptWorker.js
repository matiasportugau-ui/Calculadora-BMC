/**
 * WA audio STT worker — claims transcript_status=pending, Whisper, writes transcript.
 * ADR-009: fills text when empty/placeholder.
 */
import { downloadWaMediaBytes, isPlaceholderText } from "./waMedia.js";
import { whisperTranscribeBuffer } from "./whisperTranscribe.js";

const MAX_DURATION_HINT_S = 180;
const DEFAULT_INTERVAL_MS = 12_000;
const DEFAULT_BATCH = 3;

export function startWaTranscriptWorker({ config, logger, pool }) {
  const log = logger || { info() {}, warn() {}, error() {} };
  if (!pool) {
    log.warn("[waTranscript] no pool, worker not started");
    return () => {};
  }

  // Opt-out: WA_TRANSCRIPT_DISABLED=1
  if (process.env.WA_TRANSCRIPT_DISABLED === "1" || config?.waTranscriptDisabled) {
    log.info("[waTranscript] disabled via env");
    return () => {};
  }

  let running = false;
  let timer = null;
  const intervalMs = Number(config?.waTranscriptIntervalMs || DEFAULT_INTERVAL_MS);
  const batchSize = Number(config?.waTranscriptBatchSize || DEFAULT_BATCH);

  async function processBatch() {
    if (running) return;
    running = true;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `select msg_id, chat_id, media_gcs_path, media_mime, text, meta
           from wa_messages
          where transcript_status = 'pending'
            and media_gcs_path is not null
            and type = 'audio'
          order by ts desc
          limit $1
          for update skip locked`,
        [batchSize],
      );
      if (!rows.length) {
        await client.query("COMMIT");
        return;
      }

      for (const row of rows) {
        try {
          const duration = Number(row.meta?.duration ?? row.meta?.media?.duration ?? 0);
          if (duration > MAX_DURATION_HINT_S) {
            await client.query(
              `update wa_messages
                  set transcript_status = 'skipped',
                      meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('transcript_skip', 'duration')
                where msg_id = $1`,
              [row.msg_id],
            );
            continue;
          }

          const buf = await downloadWaMediaBytes(row.media_gcs_path);
          if (!buf?.length) {
            await client.query(
              `update wa_messages set transcript_status = 'error',
                 meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('transcript_error', 'download_failed')
               where msg_id = $1`,
              [row.msg_id],
            );
            continue;
          }

          const result = await whisperTranscribeBuffer(buf, {
            language: "es",
            mime: row.media_mime || "audio/ogg",
          });

          if (!result.ok || !result.text) {
            await client.query(
              `update wa_messages set transcript_status = 'error',
                 meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('transcript_error', $2::text)
               where msg_id = $1`,
              [row.msg_id, String(result.error || "empty").slice(0, 300)],
            );
            continue;
          }

          const fillText = isPlaceholderText(row.text);
          await client.query(
            `update wa_messages
                set transcript = $2,
                    transcript_status = 'done',
                    text = case when $3::boolean then $2 else text end,
                    meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
                      'transcript_ms', $4::int,
                      'transcript_lang', 'es',
                      'stt_source', 'cloud_whisper',
                      'stt_at', now()::text
                    )
              where msg_id = $1`,
            [row.msg_id, result.text, fillText, result.duration_ms],
          );
        } catch (err) {
          log.warn?.({ err: err?.message, msg_id: row.msg_id }, "waTranscript row failed");
          await client.query(
            `update wa_messages set transcript_status = 'error',
               meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('transcript_error', $2::text)
             where msg_id = $1`,
            [row.msg_id, String(err?.message || "error").slice(0, 300)],
          ).catch(() => {});
        }
      }
      await client.query("COMMIT");
      log.info?.({ n: rows.length }, "waTranscript batch done");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      log.warn?.({ err: e?.message }, "waTranscript batch failed");
    } finally {
      client.release();
      running = false;
    }
  }

  timer = setInterval(() => {
    processBatch().catch(() => {});
  }, intervalMs);
  // First tick soon
  setTimeout(() => processBatch().catch(() => {}), 4000);

  log.info({ intervalMs, batchSize }, "WA transcript worker started");
  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
