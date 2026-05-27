/**
 * WA Cockpit — SLA worker (Missive/Front-style).
 *
 * Cada N segundos (config.sla.workerIntervalMs):
 *  1) Detecta breaches de tipo 'unreplied': chats donde last_msg_in_at >
 *     last_msg_out_at hace más de config.sla.unrepliedAlertHours efectivas
 *     (descontando horas fuera de business_hours).
 *  2) Detecta breaches de tipo 'unassigned': chats sin owner_op más viejo
 *     que config.sla.unassignedAlertHours (también respetando bh).
 *  3) Para cada breach nuevo: insert ON CONFLICT en wa_sla_breaches
 *     (índice parcial unique sobre rows donde resolved_at IS NULL).
 *  4) Si breach se resuelve (alguien respondió o asignó): update resolved_at.
 *  5) Acción según config.sla.breachAction:
 *     - 'notify' → solo registra (UI muestra desde wa_sla_breaches)
 *     - 'webhook' → emit sla.breach
 *     - 'reassign' → next-tick (no implementado en MVP, requiere round-robin)
 *
 * Flag: slaTracking.enabled.
 */

import { getConfig, getFlag } from "./waConfig.js";
import { emitWaWebhook } from "./waWebhooks.js";

export function startWaSlaWorker({ logger, pool, tenantId = null }) {
  const log = logger || { info() {}, warn() {}, error() {} };
  if (!pool) {
    log.warn("[waSlaWorker] no pool, worker not started");
    return () => {};
  }

  const ac = new AbortController();
  let timer = null;
  let running = false;

  function readRuntime() {
    let cfg, flagOn;
    try { cfg = getConfig(); } catch { cfg = null; }
    try { flagOn = getFlag("slaTracking.enabled"); } catch { flagOn = false; }
    return {
      enabled: flagOn,
      intervalMs: Number(cfg?.sla?.workerIntervalMs ?? 60000),
      unrepliedHours: Number(cfg?.sla?.unrepliedAlertHours ?? 2),
      unassignedHours: Number(cfg?.sla?.unassignedAlertHours ?? 0.5),
      action: cfg?.sla?.breachAction || "notify",
      businessHours: cfg?.sla?.businessHours || null,
    };
  }

  async function tick() {
    if (running) return;
    running = true;
    const t0 = Date.now();
    let detected = 0;
    let resolved = 0;
    try {
      const rt = readRuntime();
      if (!rt.enabled) return;

      // Resolución de breaches existentes que ya no aplican.
      // 'unreplied' resuelto: alguien escribió out después del breach.
      // 'unassigned' resuelto: owner_op asignado.
      const resolvedRes = await pool.query(
        `update wa_sla_breaches b
            set resolved_at = now()
           from wa_conversations c
          where b.chat_id = c.chat_id
            and b.resolved_at is null
            and (
              (b.kind = 'unreplied' and c.last_msg_out_at is not null and c.last_msg_out_at > b.breached_at)
              or
              (b.kind = 'unassigned' and c.owner_op is not null)
            )
          returning b.chat_id, b.kind`,
      );
      resolved = resolvedRes.rowCount;

      // Detectar breaches nuevos. Usamos cálculo simple sin business hours
      // por defecto; si se configura businessHours en client time, aproximamos
      // restando una constante por día/noche. MVP: comparación directa.
      // Multi-tenant: tenantId is accepted but query filtering deferred
      // until wa_conversations.tenant_id column exists in the schema.

      // Unreplied: hay msg_in y NO hay out posterior, y han pasado >X horas.
      const unreplied = await pool.query(
        `select c.chat_id,
                c.last_msg_in_at,
                extract(epoch from (now() - c.last_msg_in_at))/3600.0 as age_hours
           from wa_conversations c
          where c.last_msg_in_at is not null
            and (c.last_msg_out_at is null or c.last_msg_out_at < c.last_msg_in_at)
            and extract(epoch from (now() - c.last_msg_in_at))/3600.0 >= $1
            and not exists (
              select 1 from wa_sla_breaches b
              where b.chat_id = c.chat_id and b.kind = 'unreplied' and b.resolved_at is null
            )`,
        [rt.unrepliedHours],
      );
      for (const row of unreplied.rows) {
        await _insertBreach(pool, row.chat_id, "unreplied", Number(row.age_hours), rt.action, tenantId);
        detected++;
      }

      // Unassigned: chat sin owner_op viejo.
      const unassigned = await pool.query(
        `select c.chat_id,
                extract(epoch from (now() - c.created_at))/3600.0 as age_hours
           from wa_conversations c
          where c.owner_op is null
            and extract(epoch from (now() - c.created_at))/3600.0 >= $1
            and not exists (
              select 1 from wa_sla_breaches b
              where b.chat_id = c.chat_id and b.kind = 'unassigned' and b.resolved_at is null
            )`,
        [rt.unassignedHours],
      );
      for (const row of unassigned.rows) {
        await _insertBreach(pool, row.chat_id, "unassigned", Number(row.age_hours), rt.action, tenantId);
        detected++;
      }

      if (detected > 0 || resolved > 0) {
        log.info(
          { detected, resolved, durationMs: Date.now() - t0 },
          "[waSlaWorker] tick",
        );
      }
    } catch (e) {
      log.error({ err: e?.message }, "[waSlaWorker] tick failed");
    } finally {
      running = false;
    }
  }

  function schedule() {
    if (ac.signal.aborted) return;
    const { intervalMs, enabled } = readRuntime();
    timer = setTimeout(() => {
      if (ac.signal.aborted) return;
      // Si está deshabilitado, sólo re-agendamos (cheap) hasta que se prenda.
      if (enabled) {
        tick().finally(() => schedule());
      } else {
        schedule();
      }
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

async function _insertBreach(pool, chatId, kind, ageHours, action, tenantId) {
  // Insert con ON CONFLICT DO NOTHING (índice parcial unique sobre resolved_at IS NULL).
  const ins = await pool.query(
    `insert into wa_sla_breaches (chat_id, kind, age_hours, breach_action)
     select $1, $2, $3, $4
      where not exists (
        select 1 from wa_sla_breaches
         where chat_id = $1 and kind = $2 and resolved_at is null
      )
     returning id`,
    [chatId, kind, ageHours, action],
  );
  if (ins.rowCount === 0) return;

  // Disparar webhook si action='webhook'.
  if (action === "webhook" || action === "notify") {
    emitWaWebhook("sla.breach", {
      chat_id: chatId,
      kind,
      age_hours: ageHours,
      breach_id: ins.rows[0].id,
      tenant_id: tenantId,
    });
  }
}
