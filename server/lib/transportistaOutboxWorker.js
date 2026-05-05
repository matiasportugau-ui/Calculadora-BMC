/**
 * Transportista — outbox worker for WhatsApp notifications.
 *
 * Loop:
 *   1. BEGIN tx + SELECT … FOR UPDATE SKIP LOCKED — claim atómico de hasta 20
 *      notificaciones cuyo next_attempt_at <= now() (FIFO por next_attempt_at).
 *   2. Por fila: SAVEPOINT + sendWhatsAppText. Errores aislados via
 *      ROLLBACK TO SAVEPOINT — el resto del batch sobrevive.
 *   3. Backoff exponencial con jitter en fallos (max 12 intentos → 'failed').
 *   4. trip_events idempotentes via (trip_id, idempotency_key).
 *
 * Trade-off: las llamadas HTTP a Meta (WhatsApp Cloud API) corren dentro de
 * la tx, manteniendo locks por la duración del batch. SKIP LOCKED evita
 * bloquear a otras instancias; auditar idle_in_transaction_session_timeout
 * en Postgres si batch × http_latency > timeout.
 */
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
  const log = logger || { info() {}, warn() {}, error() {} };

  if (!pool) {
    log.warn("transportista outbox: no pool, worker not started");
    return () => {};
  }
  const intervalMs = config.transportistaOutboxIntervalMs || 15000;
  const batchSize = Number(config.transportistaOutboxBatchSize || 20);

  // Shutdown coordinado: cleanup llama ac.abort() para que el batch
  // in-flight termine la fila actual y rompa antes de la siguiente.
  const ac = new AbortController();
  let timer = null;
  let running = false;

  async function processBatch() {
    if (running) return;
    if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) return;
    running = true;

    const t0 = Date.now();
    let claimed = 0;
    let sent = 0;
    let retry = 0;
    let failed = 0;

    const client = await pool.connect();
    let inTx = false;
    try {
      await client.query("begin");
      inTx = true;

      const { rows } = await client.query(
        `select * from outbox_notifications
         where status = 'pending' and next_attempt_at <= now()
         order by next_attempt_at asc
         limit $1
         for update skip locked`,
        [batchSize],
      );
      claimed = rows.length;

      for (const row of rows) {
        if (ac.signal.aborted) break;

        await client.query("savepoint tx_row");
        try {
          const text = row.payload?.text || "";
          const digits = String(row.to_e164 || "").replace(/\D/g, "");
          if (!digits || !text) {
            await client.query(
              `update outbox_notifications
                 set status = 'failed',
                     last_error_code = $2,
                     last_error = $3::jsonb
               where notification_id = $1::uuid`,
              [row.notification_id, "invalid_payload", JSON.stringify({ row })],
            );
            await client.query("release savepoint tx_row");
            failed++;
            continue;
          }

          const wa = await sendWhatsAppText({
            to: digits,
            text,
            accessToken: config.whatsappAccessToken,
            phoneNumberId: config.whatsappPhoneNumberId,
            signal: ac.signal,
          });
          const messageId = wa?.messages?.[0]?.id || null;
          await client.query(
            `update outbox_notifications
               set status = 'sent',
                   sent_at = now(),
                   attempt_count = attempt_count + 1
             where notification_id = $1::uuid`,
            [row.notification_id],
          );
          const idem = `outbox:sent:${row.notification_id}`;
          await client.query(
            `insert into trip_events (trip_id, stop_id, event_type, actor_type, actor_id, idempotency_key, payload)
             values ($1::uuid, null, 'notification_sent', 'system', null, $2, $3::jsonb)
             on conflict (trip_id, idempotency_key) do nothing`,
            [row.trip_id, idem, JSON.stringify({ message_id: messageId, notification_id: row.notification_id })],
          );
          await client.query("release savepoint tx_row");
          sent++;
        } catch (err) {
          await client.query("rollback to savepoint tx_row");

          // Si el fallo es por shutdown abort, no penalizamos el row con un
          // intento extra ni programamos backoff: dejamos pending para que la
          // próxima instancia lo recoja inmediatamente.
          if (ac.signal.aborted && (err?.name === "AbortError" || /aborted/i.test(err?.message || ""))) {
            await client.query("release savepoint tx_row").catch(() => {});
            break;
          }

          await client.query("savepoint tx_row_fail");
          try {
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
              failed++;
            } else {
              retry++;
            }
            await client.query("release savepoint tx_row_fail");
          } catch (e2) {
            await client.query("rollback to savepoint tx_row_fail").catch(() => {});
            log.error(
              { err: e2?.message, notification_id: row.notification_id },
              "transportista outbox: failed to record retry/failure",
            );
          }
          await client.query("release savepoint tx_row").catch(() => {});
        }
      }

      await client.query("commit");
      inTx = false;
    } catch (txErr) {
      if (inTx) {
        await client.query("rollback").catch(() => {});
      }
      throw txErr;
    } finally {
      client.release();
      running = false;
      if (claimed > 0) {
        log.info(
          { claimed, sent, retry, failed, duration_ms: Date.now() - t0, aborted: ac.signal.aborted },
          "transportista outbox batch done",
        );
      }
    }
  }

  timer = setInterval(() => {
    if (ac.signal.aborted) return;
    processBatch().catch((e) => log.error({ err: e?.message }, "transportista outbox batch failed"));
  }, intervalMs);

  if (typeof timer.unref === "function") timer.unref();

  processBatch().catch((e) => log.error({ err: e?.message }, "transportista outbox initial batch failed"));

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
    ac.abort();
  };
}
