/**
 * WA Cockpit — Follow-ups worker.
 *
 * Consume wa_followups WHERE due_at <= now() AND status='pending', y por
 * cada uno: dispara webhook 'followup.due' (si hay configurado) y deja la
 * fila para que la UI la muestre (no la marca done — eso lo hace el
 * operador desde la UI o el endpoint /api/wa/followups/:id/done).
 *
 * Reglas configurables: config.followups.rules es un array opcional con
 * múltiples kinds; el worker actual solo notifica los due, no recrea
 * follow-ups (la creación es responsabilidad del enricher al insertar
 * mensajes inbound).
 *
 * Flag: ninguno propio — el worker corre siempre que hay pool. Si no hay
 * webhooks ni SSE configurados, simplemente loguea para auditoría.
 */

import { getConfig } from "./waConfig.js";
import { emitWaWebhook } from "./waWebhooks.js";

export function startWaFollowupsWorker({ logger, pool }) {
  const log = logger || { info() {}, warn() {}, error() {} };
  if (!pool) {
    log.warn("[waFollowupsWorker] no pool, worker not started");
    return () => {};
  }

  const ac = new AbortController();
  let timer = null;
  let running = false;

  function readRuntime() {
    let cfg;
    try { cfg = getConfig(); } catch { cfg = null; }
    return {
      intervalMs: Number(cfg?.followups?.workerIntervalMs ?? 60000),
    };
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      // Marcar 'due' (status sigue siendo 'pending' pero "notified_at" se setea
      // mediante meta para no spamear: una vez que ya emitimos webhook por un
      // followup, no lo emitimos de nuevo aunque siga pending).
      const { rows } = await pool.query(
        `select f.id, f.chat_id, f.kind, f.due_at, f.note, f.meta,
                c.contact_name, c.phone
           from wa_followups f
           left join wa_conversations c on c.chat_id = f.chat_id
          where f.status = 'pending'
            and f.due_at <= now()
            and (f.meta->>'webhook_emitted_at') is null
          limit 100`,
      );

      for (const row of rows) {
        emitWaWebhook("followup.due", {
          followup_id: row.id,
          chat_id: row.chat_id,
          kind: row.kind,
          due_at: row.due_at,
          note: row.note,
          contact_name: row.contact_name,
          phone: row.phone,
        });
        await pool.query(
          `update wa_followups
              set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object('webhook_emitted_at', now()::text)
            where id = $1`,
          [row.id],
        );
      }
      if (rows.length > 0) {
        log.info({ count: rows.length }, "[waFollowupsWorker] emitted");
      }
    } catch (e) {
      log.error({ err: e?.message }, "[waFollowupsWorker] tick failed");
    } finally {
      running = false;
    }
  }

  function schedule() {
    if (ac.signal.aborted) return;
    const { intervalMs } = readRuntime();
    timer = setTimeout(() => {
      if (ac.signal.aborted) return;
      tick().finally(() => schedule());
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
