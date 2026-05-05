/**
 * WA Cockpit — F2 enricher worker.
 * Patrón clonado de transportistaOutboxWorker.js: setInterval + transacción + cola en SQL.
 *
 * Loop:
 *   1. BEGIN tx + SELECT … FOR UPDATE SKIP LOCKED — claim atómico de N mensajes.
 *   2. Por mensaje: SAVEPOINT + classifyIntent + (si no es chatter) generateSuggestions.
 *      Errores aislados via ROLLBACK TO SAVEPOINT — el resto del batch sobrevive.
 *   3. UPSERT en wa_suggestions y marca `enriched_at = now()` → COMMIT.
 *
 * Trade-off: las llamadas LLM corren dentro de la tx, manteniendo locks por la duración del batch.
 * SKIP LOCKED evita bloquear a otras instancias (las saltean), pero conviene auditar
 * `idle_in_transaction_session_timeout` en Postgres si batch × LLM_latency > timeout.
 *
 * Flag: WA_ENRICHER_ENABLED=true en config.waEnricherEnabled.
 */
import { classifyIntent, generateSuggestions } from "./waEnricher.js";
import { runWaQuote } from "./waQuoteRunner.js";
import { extractQuoteParams } from "./waQuoteParams.js";
import { getConfig, getFlag } from "./waConfig.js";
import { applyRoutingRules } from "./waRoutingRules.js";

export function startWaEnricherWorker({ config, logger, pool }) {
  // Normaliza el logger para evitar `logger?.warn?.()` por todos lados.
  // Inyectar pino o cualquier estructurado funciona; sin logger usa noop.
  const log = logger || { info() {}, warn() {}, error() {} };

  if (!pool) {
    log.warn("[waEnricher] no pool, worker not started");
    return () => {};
  }

  // Config en runtime: leemos getConfig() en cada batch para reflejar cambios
  // hechos vía /api/wa/settings sin reiniciar el server. El flag
  // enricher.enabled o el .env legacy actúan como kill-switch.
  function readRuntime() {
    let cfg, flagOn;
    try { cfg = getConfig(); } catch { cfg = null; }
    try { flagOn = getFlag("enricher.enabled"); } catch { flagOn = false; }
    const intervalMs = Number(cfg?.enricher?.intervalMs ?? config.waEnricherIntervalMs ?? 8000);
    const batchSize = Number(cfg?.enricher?.batchSize ?? config.waEnricherBatchSize ?? 5);
    const maxHistoryMsgs = Number(cfg?.enricher?.maxHistoryMsgs ?? 12);
    const enabled = flagOn || Boolean(config.waEnricherEnabled);
    return { intervalMs, batchSize, maxHistoryMsgs, enabled };
  }

  let runtime = readRuntime();
  if (!runtime.enabled) {
    log.info("[waEnricher] disabled (flag enricher.enabled=false y .env=false)");
    return () => {};
  }

  // Shutdown coordinado: el cleanup retornado dispara `ac.abort()` para que
  // el batch in-flight termine de procesar el mensaje actual (no se interrumpe
  // mid-message — eso podría dejar estado parcial) y rompa el loop antes del
  // siguiente. El COMMIT de la tx se ejecuta normal con el progreso parcial.
  // Las llamadas LLM en curso NO reciben el abort (requiere propagar signal a
  // fetch en waEnricher.js + waQuoteRunner.js — fuera de scope de Fase 4.1).
  const ac = new AbortController();
  let timer = null;
  let running = false;

  async function processBatch() {
    if (running) return;
    running = true;

    // Re-leer config cada batch — refleja cambios de /api/wa/settings inmediatos.
    runtime = readRuntime();
    if (!runtime.enabled) {
      running = false;
      return;
    }
    const { batchSize, maxHistoryMsgs } = runtime;

    const t0 = Date.now();
    let claimed = 0;
    let failed = 0;
    let chatter = 0;

    const client = await pool.connect();
    let inTx = false;
    try {
      await client.query("begin");
      inTx = true;

      // Claim atómico FIFO. SKIP LOCKED permite a otras instancias procesar otras filas
      // sin bloquearse. El lock se mantiene hasta COMMIT/ROLLBACK al final del batch.
      const { rows: pendingMsgs } = await client.query(
        `select msg_id, chat_id, ts, text
         from wa_messages
         where enriched_at is null
           and direction = 'in'
           and text is not null
         order by ts asc
         limit $1
         for update skip locked`,
        [batchSize],
      );
      claimed = pendingMsgs.length;

      for (const msg of pendingMsgs) {
        // Shutdown signal: salir antes de empezar otro mensaje. El COMMIT de
        // abajo persiste lo procesado hasta acá; los msgs no procesados quedan
        // sin lockear (rollback liberaría sus locks; commit los desbloquea
        // igual al cerrar la tx). En la próxima ejecución se re-claman.
        if (ac.signal.aborted) break;
        const intentHint = classifyIntent(msg.text);
        // Aislamos cada mensaje: si su procesamiento falla, hacemos ROLLBACK TO SAVEPOINT
        // y el resto del batch continúa dentro de la misma tx.
        await client.query("savepoint wa_msg");
        try {
          if (intentHint === "chatter") {
            await client.query(
              `update wa_messages
                 set enriched_at = now(),
                     enrichment_status = 'skipped_chatter'
               where msg_id = $1`,
              [msg.msg_id],
            );
            await client.query("release savepoint wa_msg");
            chatter++;
            continue;
          }

          // Trae histórico del chat (config.enricher.maxHistoryMsgs, default 12)
          const { rows: hist } = await client.query(
            `select direction, text, ts
             from wa_messages
             where chat_id = $1 and text is not null
             order by ts desc
             limit $2`,
            [msg.chat_id, maxHistoryMsgs],
          );
          const history = hist.reverse();

          const result = await generateSuggestions({ history, intentHint });

          // Idempotente vía índice parcial wa_suggestions_trigger_unique
          // (migración 008_wa_idempotency.sql). Predicado del ON CONFLICT debe
          // matchear el del índice — no tocar uno sin tocar el otro.
          await client.query(
            `insert into wa_suggestions
               (chat_id, trigger_msg_id, intent, options, provider, latency_ms, error, meta)
             values ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb)
             on conflict (trigger_msg_id) where trigger_msg_id is not null
             do update set
               chat_id = excluded.chat_id,
               intent = excluded.intent,
               options = excluded.options,
               provider = excluded.provider,
               latency_ms = excluded.latency_ms,
               error = excluded.error,
               meta = excluded.meta,
               generated_at = now()`,
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

          // F4 — schedule follow-up con configurable hours (config.followups.defaultHours)
          // (best-effort: si ya existe un follow-up pendiente para este chat, no duplica)
          let followupHours = 24;
          try { followupHours = Number(getConfig().followups.defaultHours) || 24; } catch { /* keep default */ }
          await client.query(
            `insert into wa_followups (chat_id, due_at, kind, note)
             select $1, now() + ($2 || ' hours')::interval, 'remind_24h', 'Auto: msg cliente sin respuesta nuestra'
             where not exists (
               select 1 from wa_followups
               where chat_id = $1 and kind = 'remind_24h' and status = 'pending'
             )`,
            [msg.chat_id, String(followupHours)],
          );

          // F3 — auto cotización si intent=cotizacion, flag autoQuote.enabled,
          // y los params son detectables. runWaQuote usa su propia conexión del
          // pool: NO es parte de esta tx. Si esta tx hace rollback, la cotización
          // queda; idempotencia debe vivir en runWaQuote.
          const finalIntent = result.intent || intentHint;
          let autoQuoteOn = false;
          try { autoQuoteOn = getFlag("autoQuote.enabled"); } catch { /* default off */ }
          if (finalIntent === "cotizacion" && autoQuoteOn) {
            const params = extractQuoteParams(msg.text);
            if (params?.ready) {
              try {
                const quoteResp = await runWaQuote({
                  pool,
                  chatId: msg.chat_id,
                  text: msg.text,
                  triggerMsgId: msg.msg_id,
                  generatedByAi: true,
                  signal: ac.signal,
                });
                if (!quoteResp.ok) {
                  log.warn(
                    { chat_id: msg.chat_id, reason: quoteResp.reason },
                    "[waEnricher] auto-quote skipped",
                  );
                }
              } catch (qe) {
                log.warn({ err: qe?.message, chat_id: msg.chat_id }, "[waEnricher] auto-quote failed");
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

          // F-B2: apply routing rules (assign, label, alert).
          // Usamos el client de la tx para que la asignación sea atómica con el enriched_at.
          try {
            const { rows: [c] } = await client.query("select phone, contact_name from wa_conversations where chat_id = $1", [msg.chat_id]);
            await applyRoutingRules(client, {
              chat_id: msg.chat_id,
              phone: c?.phone || "",
              contact_name: c?.contact_name || "",
              text: msg.text,
              intent: result.intent || intentHint,
              ts: new Date(msg.ts),
            });
          } catch (re) {
            log.warn({ err: re.message, chat_id: msg.chat_id }, "[waEnricher] routing rules failed");
          }

          await client.query(
            `update wa_messages
               set enriched_at = now(),
                   enrichment_status = 'ok'
             where msg_id = $1`,
            [msg.msg_id],
          );
          await client.query("release savepoint wa_msg");
        } catch (err) {
          // Rollback solo este mensaje, mantiene el resto del batch.
          await client.query("rollback to savepoint wa_msg");
          failed++;
          log.warn({ err: err?.message, msg_id: msg.msg_id }, "[waEnricher] msg failed");

          // Sub-savepoint para registrar el fallo: si esto también falla,
          // no aborta el batch entero, solo este mensaje queda sin marcar.
          await client.query("savepoint wa_msg_fail");
          try {
            // Mismo índice idempotente: si ya hay una suggestion previa para este
            // msg, la sobreescribimos con el error en lugar de duplicar.
            await client.query(
              `insert into wa_suggestions (chat_id, trigger_msg_id, intent, options, error)
               values ($1, $2, $3, '[]'::jsonb, $4)
               on conflict (trigger_msg_id) where trigger_msg_id is not null
               do update set
                 chat_id = excluded.chat_id,
                 intent = excluded.intent,
                 options = excluded.options,
                 error = excluded.error,
                 generated_at = now()`,
              [msg.chat_id, msg.msg_id, intentHint, err instanceof Error ? err.message : String(err)],
            );
            await client.query(
              `update wa_messages
                 set enriched_at = now(),
                     enrichment_status = 'failed'
               where msg_id = $1`,
              [msg.msg_id],
            );
            await client.query("release savepoint wa_msg_fail");
          } catch (e2) {
            await client.query("rollback to savepoint wa_msg_fail").catch(() => {});
            log.error({ err: e2?.message, msg_id: msg.msg_id }, "[waEnricher] failed to record failure");
          }
          await client.query("release savepoint wa_msg").catch(() => {});
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
      // Métrica de batch — solo cuando hubo trabajo, evita ruido en cola vacía.
      // Permite detectar si la tx larga (LLM dentro de tx) se acerca a
      // idle_in_transaction_session_timeout en Postgres.
      if (claimed > 0) {
        const durationMs = Date.now() - t0;
        const ok = claimed - failed - chatter;
        log.info(
          { claimed, ok, chatter, failed, duration_ms: durationMs, aborted: ac.signal.aborted },
          "[waEnricher] batch done",
        );
      }
    }
  }

  // setTimeout en lugar de setInterval: cada tick releemos config para honrar
  // cambios de enricher.intervalMs sin reiniciar. Si el flag se apaga, no
  // re-agendamos hasta que vuelva a encenderse (verificado en readRuntime).
  function schedule() {
    if (ac.signal.aborted) return;
    const { intervalMs } = readRuntime();
    timer = setTimeout(() => {
      if (ac.signal.aborted) return;
      processBatch()
        .catch((e) => log.error({ err: e?.message }, "[waEnricher] batch failed"))
        .finally(() => schedule());
    }, intervalMs);
    if (typeof timer.unref === "function") timer.unref();
  }
  schedule();

  return () => {
    if (timer) clearTimeout(timer);
    timer = null;
    ac.abort();
  };
}
