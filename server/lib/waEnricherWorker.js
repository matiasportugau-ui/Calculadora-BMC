/**
 * WA Cockpit — F2 enricher worker.
 * Patrón clonado de transportistaOutboxWorker.js: setInterval + transacción + cola en SQL.
 *
 * Loop:
 *   1. Selecciona N mensajes con `enriched_at IS NULL` y `direction='in'`.
 *   2. Para cada uno: classifyIntent + (si no es chatter) generateSuggestions.
 *   3. UPSERT en wa_suggestions y marca `enriched_at = now()` en el mensaje.
 *
 * Flag: WA_ENRICHER_ENABLED=true en config.waEnricherEnabled.
 */
import { classifyIntent, generateSuggestions } from "./waEnricher.js";
import { runWaQuote } from "./waQuoteRunner.js";
import { extractQuoteParams } from "./waQuoteParams.js";

export function startWaEnricherWorker({ config, logger, pool }) {
  if (!pool) {
    logger.warn?.("[waEnricher] no pool, worker not started");
    return () => {};
  }
  if (!config.waEnricherEnabled) {
    logger.info?.("[waEnricher] disabled (WA_ENRICHER_ENABLED=false)");
    return () => {};
  }

  const intervalMs = Number(config.waEnricherIntervalMs || 8000);
  const batchSize = Number(config.waEnricherBatchSize || 5);

  let timer = null;
  let running = false;

  async function processBatch() {
    if (running) return;
    running = true;

    const client = await pool.connect();
    try {
      // Pull unenriched inbound messages, oldest first (FIFO)
      const { rows: pendingMsgs } = await client.query(
        `select msg_id, chat_id, ts, text
         from wa_messages
         where enriched_at is null
           and direction = 'in'
           and text is not null
         order by ts asc
         limit $1`,
        [batchSize],
      );

      for (const msg of pendingMsgs) {
        const intentHint = classifyIntent(msg.text);
        try {
          if (intentHint === "chatter") {
            // Marca enriched, no genera sugerencias
            await client.query(
              `update wa_messages set enriched_at = now() where msg_id = $1`,
              [msg.msg_id],
            );
            continue;
          }

          // Trae histórico del chat (último 12 msgs orden cronológico)
          const { rows: hist } = await client.query(
            `select direction, text, ts
             from wa_messages
             where chat_id = $1 and text is not null
             order by ts desc
             limit 12`,
            [msg.chat_id],
          );
          const history = hist.reverse();

          const result = await generateSuggestions({ history, intentHint });

          await client.query(
            `insert into wa_suggestions
               (chat_id, trigger_msg_id, intent, options, provider, latency_ms, error, meta)
             values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb)`,
            [
              msg.chat_id,
              msg.msg_id,
              result.intent || intentHint,
              JSON.stringify(result.options || []),
              result.provider,
              result.latency_ms,
              result.error || null,
              JSON.stringify({ confidence: result.confidence ?? null, intent_hint: intentHint }),
            ],
          );

          // F4 — schedule follow-up 24h si todavía no hay respuesta nuestra
          // (best-effort: si ya existe un follow-up pendiente para este chat, no duplica)
          try {
            await client.query(
              `insert into wa_followups (chat_id, due_at, kind, note)
               select $1, now() + interval '24 hours', 'remind_24h', 'Auto: msg cliente sin respuesta nuestra'
               where not exists (
                 select 1 from wa_followups
                 where chat_id = $1 and kind = 'remind_24h' and status = 'pending'
               )`,
              [msg.chat_id],
            );
          } catch (fe) {
            logger.warn?.({ err: fe?.message }, "[waEnricher] followup schedule failed");
          }

          // F3 — auto cotización si intent=cotizacion y los params son detectables
          const finalIntent = result.intent || intentHint;
          if (finalIntent === "cotizacion") {
            const params = extractQuoteParams(msg.text);
            if (params?.ready) {
              try {
                const quoteResp = await runWaQuote({
                  pool,
                  chatId: msg.chat_id,
                  text: msg.text,
                  triggerMsgId: msg.msg_id,
                  generatedByAi: true,
                });
                if (!quoteResp.ok) {
                  logger.warn?.(
                    { chat_id: msg.chat_id, reason: quoteResp.reason },
                    "[waEnricher] auto-quote skipped",
                  );
                }
              } catch (qe) {
                logger.warn?.({ err: qe?.message, chat_id: msg.chat_id }, "[waEnricher] auto-quote failed");
              }
            }
          }

          // Set conversation.intent_last
          await client.query(
            `update wa_conversations
               set intent_last = $2,
                   updated_at = now()
             where chat_id = $1`,
            [msg.chat_id, result.intent || intentHint],
          );

          await client.query(
            `update wa_messages set enriched_at = now() where msg_id = $1`,
            [msg.msg_id],
          );
        } catch (err) {
          // No bloquea la cola: marca enriched para no reintentar infinitamente,
          // y registra el error como suggestion fallida.
          logger.warn?.({ err: err?.message, msg_id: msg.msg_id }, "[waEnricher] msg failed");
          await client.query(
            `insert into wa_suggestions (chat_id, trigger_msg_id, intent, options, error)
             values ($1, $2, $3, '[]'::jsonb, $4)`,
            [msg.chat_id, msg.msg_id, intentHint, err instanceof Error ? err.message : String(err)],
          );
          await client.query(
            `update wa_messages set enriched_at = now() where msg_id = $1`,
            [msg.msg_id],
          );
        }
      }
    } finally {
      client.release();
      running = false;
    }
  }

  timer = setInterval(() => {
    processBatch().catch((e) => logger.error?.({ err: e?.message }, "[waEnricher] batch failed"));
  }, intervalMs);

  if (typeof timer.unref === "function") timer.unref();

  // Initial run
  processBatch().catch((e) => logger.error?.({ err: e?.message }, "[waEnricher] initial batch failed"));

  return () => {
    if (timer) clearInterval(timer);
    timer = null;
  };
}
