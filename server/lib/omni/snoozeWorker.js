// server/lib/omni/snoozeWorker.js — in-process worker that reopens snoozed
// conversations once their snooze window expires.
//
// The "Posponer" action sets status='snoozed' + snoozed_until=<future ts>. This
// worker polls for rows whose window has passed and flips them back to 'open',
// clearing snoozed_until. Mirrors the existing in-process worker pattern
// (startOmniAiWorker / WA sla+followups) rather than an external cron, because
// the API already runs persistent interval jobs.
//
// Best-effort: a failed tick is logged and retried next interval; a lagging
// schema (pre-009, no snoozed_until column) degrades to a no-op without
// crashing the loop.

const DEFAULT_INTERVAL_MS = 60_000; // 1 min — snooze granularity is coarse

export function startOmniSnoozeWorker({ logger, pool, intervalMs = DEFAULT_INTERVAL_MS } = {}) {
  if (!pool) return () => {};
  let stopped = false;

  async function tick() {
    if (stopped) return;
    try {
      const { rowCount } = await pool.query(
        `UPDATE omni_conversations
            SET status = 'open', snoozed_until = NULL, updated_at = now()
          WHERE status = 'snoozed'
            AND snoozed_until IS NOT NULL
            AND snoozed_until <= now()`,
      );
      if (rowCount) {
        logger?.info?.({ reopened: rowCount }, "omni snooze worker reopened conversations");
      }
    } catch (e) {
      logger?.warn?.({ err: e?.message }, "omni snooze worker tick failed");
    }
  }

  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  tick(); // run once on boot so a long-overdue snooze doesn't wait a full interval

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
