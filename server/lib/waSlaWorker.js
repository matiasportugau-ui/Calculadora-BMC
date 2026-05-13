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

// ─── Business-hours helpers (pure, exported for unit testing) ─────────────────

/**
 * Returns the UTC-epoch ms of midnight (00:00:00) for the local calendar day
 * that contains `epochMs`, in the given IANA timezone.
 *
 * @param {number} epochMs
 * @param {string} tz  IANA timezone (e.g. "America/Montevideo")
 * @returns {number}
 */
export function localDayStartUtcMs(epochMs, tz) {
  const d = new Date(epochMs);
  // en-CA locale gives "YYYY-MM-DD" format — reliable and parseable.
  const localDateStr = d.toLocaleDateString("en-CA", { timeZone: tz });
  // localDateStr = e.g. "2026-05-13"

  // Get UTC offset in minutes for this timezone at approximately noon on that date
  // (noon avoids edge cases where midnight itself falls on a DST boundary).
  const approxNoon = new Date(localDateStr + "T12:00:00Z");
  const offsetMin = _utcOffsetMin(tz, approxNoon);

  // Midnight local = "YYYY-MM-DDT00:00:00" in tz
  //                = new Date(localDateStr + "T00:00:00Z") - offsetMin*60000
  return new Date(localDateStr + "T00:00:00Z").getTime() - offsetMin * 60000;
}

/**
 * Returns the UTC offset of `tz` at `date` in minutes.
 * local_time = UTC + offsetMin  (e.g. UTC-3 → -180)
 *
 * @param {string} tz
 * @param {Date} date
 * @returns {number}
 */
function _utcOffsetMin(tz, date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const p = {};
    for (const part of parts) p[part.type] = part.value;
    const localAsUtcMs = Date.UTC(
      parseInt(p.year, 10),
      parseInt(p.month, 10) - 1,
      parseInt(p.day, 10),
      parseInt(p.hour, 10),
      parseInt(p.minute, 10),
      parseInt(p.second, 10),
    );
    return Math.round((localAsUtcMs - date.getTime()) / 60000);
  } catch {
    return -180; // fallback: Montevideo UTC-3
  }
}

const _DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/**
 * Compute elapsed hours between `sinceMs` and now(), counting only time within
 * the configured business hours window.  If `bh` is falsy, returns raw elapsed
 * hours (backwards-compatible — same behaviour as the old wall-clock comparison).
 *
 * Algorithm: walk day-by-day from sinceMs to now(), computing the overlap of
 * [cursor, min(now, nextDayStart)] with the business window for each local day.
 *
 * @param {number|string|Date} since  Start timestamp
 * @param {object|null} bh  business-hours config from SettingsSchema.sla.businessHours
 *   { tz: string, mon:[h0,h1]|null, tue:..., wed:..., thu:..., fri:..., sat:..., sun:... }
 * @returns {number}  effective hours elapsed
 */
export function effectiveHoursSince(since, bh) {
  const nowMs = Date.now();
  const sinceMs = new Date(since).getTime();
  if (!bh || !Number.isFinite(sinceMs) || sinceMs >= nowMs) {
    return Number.isFinite(sinceMs) ? (nowMs - sinceMs) / 3_600_000 : 0;
  }

  const tz = bh.tz || "America/Montevideo";
  let totalMs = 0;
  let cursor = sinceMs;
  let guard = 0; // safety: at most ~400 iterations ≈ ~13 months

  while (cursor < nowMs && ++guard <= 400) {
    const dayStart = localDayStartUtcMs(cursor, tz);
    // Next local day: cursor + 25h is always in the next calendar day regardless of DST (±1h max)
    const nextDayStart = localDayStartUtcMs(cursor + 25 * 3_600_000, tz);

    // Day-of-week key for this local day (1 minute past midnight to avoid DST edge)
    const weekdayStr = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" })
      .format(new Date(dayStart + 60_000))
      .toLowerCase()
      .slice(0, 3); // "mon", "tue", "wed", "thu", "fri", "sat", "sun"

    const hours = bh[weekdayStr]; // [startHour, endHour] | null

    if (hours) {
      const windowStartMs = dayStart + hours[0] * 3_600_000;
      const windowEndMs   = dayStart + hours[1] * 3_600_000;

      const effectiveStart = Math.max(cursor, windowStartMs);
      const effectiveEnd   = Math.min(nowMs, windowEndMs, nextDayStart);

      if (effectiveEnd > effectiveStart) {
        totalMs += effectiveEnd - effectiveStart;
      }
    }

    cursor = nextDayStart;
  }

  return totalMs / 3_600_000;
}

export function startWaSlaWorker({ logger, pool }) {
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

      // Detectar breaches nuevos.
      // SQL pre-filter: raw wall-clock age >= threshold (fast index scan).
      // JS post-filter: effectiveHoursSince() trims to business hours when configured.
      // effectiveHours <= rawHours so raw < threshold → effective < threshold (no false negatives).
      const bh = rt.businessHours?.tz ? rt.businessHours : null;

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
        const effectiveHours = effectiveHoursSince(row.last_msg_in_at, bh);
        if (effectiveHours < rt.unrepliedHours) continue; // not yet breached in business hours
        await _insertBreach(pool, row.chat_id, "unreplied", effectiveHours, rt.action);
        detected++;
      }

      // Unassigned: chat sin owner_op viejo.
      const unassigned = await pool.query(
        `select c.chat_id,
                c.created_at,
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
        const effectiveHours = effectiveHoursSince(row.created_at, bh);
        if (effectiveHours < rt.unassignedHours) continue; // not yet breached in business hours
        await _insertBreach(pool, row.chat_id, "unassigned", effectiveHours, rt.action);
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

async function _insertBreach(pool, chatId, kind, ageHours, action) {
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
    });
  }
}
