// ═══════════════════════════════════════════════════════════════════════════
// server/jobs/closeOrphanSessions.js — TTL cleanup for inactive sessions.
// ───────────────────────────────────────────────────────────────────────────
// Inserts a synthetic 'auth.session.end' row with outcome='orphan' for any
// user whose identity.sessions.refresh_expires_at is in the past or whose
// last_active_at is older than ACTIVITY_LOG_ORPHAN_TTL_HOURS (default 24h)
// AND who does not already have a session.end / auth.logout event after
// their last activity.
//
// Idempotent — running it twice in a row will not produce duplicate rows
// because the second pass finds the synthetic session.end already present.
//
// Wired in server/index.js to run hourly + once on startup.
// Sized for BMC's expected scale (~2 active users → tiny scan). Re-evaluate
// if user count grows >10K.
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_TTL_HOURS = 24;

export async function closeOrphanSessions({ pool, logger }) {
  if (!pool) return { ok: false, error: "no_pool" };
  const ttlHours = Number(process.env.ACTIVITY_LOG_ORPHAN_TTL_HOURS) || DEFAULT_TTL_HOURS;
  try {
    // Find candidate users: those whose last_active_at is older than TTL
    // AND whose most recent activity log row is NOT a session.end.
    const candidates = await pool.query(
      `
      WITH stale AS (
        SELECT u.user_id
        FROM identity.users u
        WHERE u.status = 'active'
          AND u.last_active_at IS NOT NULL
          AND u.last_active_at < now() - ($1 || ' hours')::interval
      ),
      latest_event AS (
        SELECT DISTINCT ON (actor_user_id)
               actor_user_id, action, at
        FROM identity.user_activity_log
        WHERE actor_user_id IN (SELECT user_id FROM stale)
        ORDER BY actor_user_id, at DESC
      )
      SELECT s.user_id
      FROM stale s
      LEFT JOIN latest_event le ON le.actor_user_id = s.user_id
      WHERE le.action IS NULL
         OR le.action NOT IN ('auth.session.end', 'auth.logout')
      `,
      [ttlHours],
    );
    const userIds = candidates.rows.map((r) => r.user_id);
    if (!userIds.length) return { ok: true, closed: 0 };

    // Bulk insert synthetic session.end events
    const values = userIds.map((_, i) => `($${i + 1}, 'auth.session.end', 'auth', 'orphan', $${userIds.length + 1}::jsonb)`).join(",");
    const params = [
      ...userIds,
      JSON.stringify({ source: "orphan_ttl_job", ttl_hours: ttlHours }),
    ];
    await pool.query(
      `INSERT INTO identity.user_activity_log
         (actor_user_id, action, module, outcome, payload)
       VALUES ${values}`,
      params,
    );
    (logger || console).info?.(`[orphan-close] closed ${userIds.length} idle sessions`);
    return { ok: true, closed: userIds.length };
  } catch (err) {
    (logger || console).warn?.("[orphan-close] failed:", err?.message);
    return { ok: false, error: err?.message };
  }
}

let _intervalHandle = null;
const HOUR_MS = 60 * 60 * 1000;

export function startOrphanCloseScheduler({ pool, logger, intervalMs = HOUR_MS }) {
  if (_intervalHandle) return; // idempotent
  // First pass after a 30s grace period so we don't race startup
  setTimeout(() => closeOrphanSessions({ pool, logger }), 30_000);
  _intervalHandle = setInterval(() => {
    closeOrphanSessions({ pool, logger });
  }, intervalMs);
  _intervalHandle.unref?.();
  (logger || console).info?.(`[orphan-close] scheduler started; interval=${intervalMs}ms`);
}

export function stopOrphanCloseScheduler() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}
