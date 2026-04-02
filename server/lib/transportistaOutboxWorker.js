import { sendWhatsAppText } from "./whatsappOutbound.js";

function backoffSeconds(attempt) {
  const base = Math.min(3600, Math.pow(2, attempt) * 5);
  const jitter = Math.floor(Math.random() * 3);
  return base + jitter;
}

/**
 * @param {{ config: import("../config.js").config, logger: import("pino").Logger, pool: import("pg").Pool | null }} opts
 */
export function startTransportistaOutboxWorker({ config, logger, pool }) {
  if (!pool) {
    logger.warn("transportista outbox: no pool, worker not started");
    return () => {};
  }
  const intervalMs = config.transportistaOutboxIntervalMs || 15000;

  let timer = null;

  async function processBatch() {
    if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) return;

    const client = await pool.connect();
    try {
      const { rows } = await client.query(
        `select * from outbox_notifications
         where status = 'pending' and next_attempt_at <= now()
         order by next_attempt_at asc
         limit 20`,
      );

      for (const row of rows) {
        const text = row.payload?.text || "";
        const digits = String(row.to_e164 || "").replace(/\D/g, "");
        if (!digits || !text) {
          await client.query(
            `update outbox_notifications set status = 'failed', last_error_code = $2, last_error = $3::jsonb where notification_id = $1::uuid`,
            [row.notification_id, "invalid_payload", JSON.stringify({ row })],
          );
          continue;
        }

        try {
          const wa = await sendWhatsAppText({
            to: digits,
            text,
            accessToken: config.whatsappAccessToken,
            phoneNumberId: config.whatsappPhoneNumberId,
          });
          const messageId = wa?.messages?.[0]?.id || null;
          await client.query(
            `update outbox_notifications set status = 'sent', sent_at = now(), attempt_count = attempt_count + 1 where notification_id = $1::uuid`,
            [row.notification_id],
          );
          const idem = `outbox:sent:${row.notification_id}`;
          await client.query(
            `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
             values ($1::uuid, null, 'notification_sent', 'system', null, $2, $3::jsonb)
             on conflict (trip_id, idempotency_key) do nothing`,
            [row.trip_id, idem, JSON.stringify({ message_id: messageId, notification_id: row.notification_id })],
          );
        } catch (err) {
          const attempt = Number(row.attempt_count) + 1;
          const delay = backoffSeconds(attempt);
          const next = new Date(Date.now() + delay * 1000).toISOString();
          const permanent = attempt >= 12;
          await client.query(
            `update outbox_notifications
             set attempt_count = $2,
                 next_attempt_at = $3::timestamptz,
                 status = $4,
                 last_error_code = $5,
                 last_error = $6::jsonb
             where notification_id = $1::uuid`,
            [
              row.notification_id,
              attempt,
              next,
              permanent ? "failed" : "pending",
              permanent ? "max_retries" : "send_error",
              JSON.stringify({ message: err?.message || String(err) }),
            ],
          );
          const idemFail = `outbox:fail:${row.notification_id}:${attempt}`;
          if (permanent) {
            await client.query(
              `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
               values ($1::uuid, null, 'notification_failed', 'system', null, $2, $3::jsonb)
               on conflict (trip_id, idempotency_key) do nothing`,
              [row.trip_id, idemFail, JSON.stringify({ notification_id: row.notification_id, error: err?.message })],
            );
          }
        }
      }
    } finally {
      client.release();
    }
  }

  timer = setInterval(() => {
    processBatch().catch((e) => logger.error({ err: e }, "transportista outbox batch failed"));
  }, intervalMs);

  if (typeof timer.unref === "function") timer.unref();

  processBatch().catch((e) => logger.error({ err: e }, "transportista outbox initial batch failed"));

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
